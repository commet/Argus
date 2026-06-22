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

  const ip = req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  if (!(await checkSajuRateLimit(ip))) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
  }

  try {
    const { year, month, day, hour, minute, gender } = await req.json();

    if (!year || !month || !gender) {
      return NextResponse.json({ error: 'year, month, and gender are required.' }, { status: 400 });
    }

    const profile = await interpretSaju({
      year: Number(year),
      month: Number(month),
      day: day ? Number(day) : undefined,
      hour: hour ? Number(hour) : undefined,
      minute: minute ? Number(minute) : undefined,
      gender,
    });

    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: 'Saju analysis failed.' }, { status: 500 });
  }
}
