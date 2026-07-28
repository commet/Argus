import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'argus_anon_transfer';

function clearTransferCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function POST(req: NextRequest) {
  const rawTicket = req.cookies.get(COOKIE_NAME)?.value;
  if (!rawTicket) return new NextResponse(null, { status: 204 });

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
  if (authError || !user || user.is_anonymous === true) {
    return NextResponse.json({ error: 'Permanent account required.' }, { status: 403 });
  }

  const tokenHash = createHash('sha256').update(rawTicket).digest('hex');
  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.rpc('claim_anonymous_account_transfer', {
    p_token_hash: tokenHash,
    p_target_user_id: user.id,
  });

  if (error) {
    // Do not clear the cookie: the database transaction rolled back and the
    // same verified target account can safely retry the claim.
    return NextResponse.json({ error: 'Could not transfer anonymous work.' }, { status: 409 });
  }

  const response = NextResponse.json({ ok: true, transferred: true, receipt: data });
  clearTransferCookie(response);
  return response;
}
