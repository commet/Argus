import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'argus_anon_transfer';
const TICKET_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  const auth = createClient(url, anonKey);
  const { data: { user }, error: authError } = await auth.auth.getUser(authHeader.slice(7));
  if (authError || !user || user.is_anonymous !== true) {
    return NextResponse.json({ error: 'Anonymous session required.' }, { status: 403 });
  }

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + TICKET_TTL_SECONDS * 1000).toISOString();
  const admin = createClient(url, serviceKey);

  const { error: insertError } = await admin
    .from('anonymous_account_transfer_tickets')
    .insert({
      token_hash: tokenHash,
      source_user_id: user.id,
      expires_at: expiresAt,
    });
  if (insertError) {
    return NextResponse.json({ error: 'Could not prepare account transfer.' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TICKET_TTL_SECONDS,
  });
  return response;
}
