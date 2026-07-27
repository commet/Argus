import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequest } from '@/lib/llm-validation';

const SESSION_ID = /^[A-Za-z0-9:_-]{1,128}$/;

async function principalHash(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(`argus:deep:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(req: NextRequest) {
  const requestError = validateRequest(req, 4_096);
  if (requestError) return requestError;

  let sessionId = '';
  try {
    const body = await req.json();
    sessionId = typeof body?.session_id === 'string' ? body.session_id : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!SESSION_ID.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Deep judgment is temporarily unavailable.' }, { status: 503 });
  }

  let userId: string | null = null;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const auth = createClient(url, anonKey);
    const { data: { user } } = await auth.auth.getUser(authHeader.slice(7));
    userId = user?.id ?? null;
  }

  const ip = req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const hash = await principalHash(ip);
  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.rpc('reserve_deep_judgment', {
    p_user_id: userId,
    p_principal_hash: hash,
    p_session_id: sessionId,
  });
  if (error) {
    return NextResponse.json({ error: 'Deep judgment is temporarily unavailable.' }, { status: 503 });
  }

  const status = data === 'resumed' ? 'resumed' : data === 'granted' ? 'granted' : 'daily_used';
  return NextResponse.json({
    allowed: status !== 'daily_used',
    status,
    window_hours: 24,
  }, {
    status: status === 'daily_used' ? 429 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
