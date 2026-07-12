import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { interpretSaju } from '@/lib/boss/saju-interpreter';
import { validateContentType, validateOrigin } from '@/lib/api-security';

const MAX_BODY = 1024; // 1KB — only needs 6 small fields
const SAJU_DAILY_LIMIT = 60;

/** Per-IP daily cap (distinct "saju:" bucket) — this route is unauthenticated and
 * runs a CPU-bound computation; without this the origin check is bypassable. */
async function checkSajuRateLimit(ip: string): Promise<boolean> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`saju:${ip}`));
  const ipHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: allowed, error } = await supabase.rpc('check_anon_rate_limit', { p_ip_hash: ipHash, p_limit: SAJU_DAILY_LIMIT });
  if (error) { console.error('[api/boss/saju] rate-limit RPC error:', error.message); return false; }
  return allowed === true;
}

export async function POST(req: NextRequest) {
  const ctError = validateContentType(req);
  if (ctError) return ctError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  const cl = Number(req.headers.get('content-length') || 0);
  if (cl > MAX_BODY) {
    return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const year = Number(body.year);
  const month = Number(body.month);
  const day = Number(body.day);
  const hour = body.hour === undefined ? undefined : Number(body.hour);
  const minute = body.minute === undefined ? undefined : Number(body.minute);
  const gender = body.gender;
  const valid = Number.isInteger(year) && year >= 1900 && year <= 2100
    && Number.isInteger(month) && month >= 1 && month <= 12
    && Number.isInteger(day) && day >= 1 && day <= 31
    && (hour === undefined || (Number.isInteger(hour) && hour >= 0 && hour <= 23))
    && (minute === undefined || (Number.isInteger(minute) && minute >= 0 && minute <= 59))
    && (gender === '남' || gender === '여');
  if (!valid) {
    return NextResponse.json({ error: 'Invalid birth data.' }, { status: 400 });
  }

  const ip = req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  if (!(await checkSajuRateLimit(ip))) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  try {
    const profile = await interpretSaju({
      year,
      month,
      day,
      hour,
      minute,
      gender,
    });

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: 'Saju analysis failed.' }, { status: 500 });
  }
}
