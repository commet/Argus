// 사용자의 승인 → 인가 코드 발급.
//
// 이 라우트만이 코드를 만든다. 부르려면 **로그인한 사용자의 Supabase 세션**이
// 있어야 한다 — 즉 코드는 언제나 실재하는 사람의 행위에서만 나온다. 커넥터도,
// 모델도, 호스트도 이 자리를 대신할 수 없다.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateContentType, validateOrigin } from '@/lib/api-security';
import { adminClient } from '@/lib/share-guard';
import {
  AUTH_CODE_TTL_SECONDS,
  expiresAt,
  isPkce,
  randomCode,
  redirectUriRegistered,
  REMOTE_SCOPE,
  sha256,
  type ClientRow,
} from '../lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ct = validateContentType(req);
  if (ct) return ct;
  const origin = validateOrigin(req);
  if (origin) return origin;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'login_required' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const clientId = typeof body.client_id === 'string' ? body.client_id : '';
  const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : '';
  const codeChallenge = body.code_challenge;
  const state = typeof body.state === 'string' ? body.state : '';
  if (!clientId || !redirectUri || !isPkce(codeChallenge)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const admin = adminClient();
  const { data } = await admin
    .from('argus_oauth_clients')
    .select('client_id, client_name, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle();
  const client = data as ClientRow | null;
  // 동의 화면의 URL 은 사용자가 고칠 수 있다. 그러므로 authorize 에서 한 검사를
  // **여기서 다시 한다** — 앞 화면의 검사를 방어로 믿으면 그 URL 을 손보는 것만으로
  // 등록되지 않은 곳으로 코드가 간다.
  if (!client || !redirectUriRegistered(client, redirectUri)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(authHeader.slice(7));
  if (userError || !user) return NextResponse.json({ error: 'login_required' }, { status: 401 });

  const code = randomCode('argus_code_');
  const { error } = await admin.from('argus_oauth_grants').insert({
    client_id: clientId,
    user_id: user.id,
    code_hash: sha256(code),
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
    scope: REMOTE_SCOPE,
    expires_at: expiresAt(AUTH_CODE_TTL_SECONDS),
  });
  if (error) {
    console.error('[mcp/v2/oauth/approve] grant insert failed:', error.message);
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 });
  }

  const callback = new URL(redirectUri);
  callback.searchParams.set('code', code);
  if (state) callback.searchParams.set('state', state);
  return NextResponse.json({ redirect_url: callback.toString() }, { headers: { 'cache-control': 'no-store' } });
}
