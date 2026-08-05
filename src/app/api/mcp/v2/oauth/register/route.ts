// RFC 7591 — 동적 클라이언트 등록.
//
// Claude·ChatGPT 커스텀 커넥터는 사람이 client_id 를 미리 발급받아 붙여넣지
// 않는다. 서버 URL 하나만 받고, 이 엔드포인트에 스스로 등록해 client_id 를
// 얻는다. 이 라우트가 없으면 커넥터 추가는 "OAuth 설정 실패"로 끝난다 —
// 401 → 메타데이터 → 등록 사슬의 마지막 고리다.
//
// 등록은 **인증 없이** 열려 있다 (사양이 그렇게 정의한다: 등록 시점에는 아직
// 아무 자격증명도 없다). 그래서 남용 가능한 표면이므로 세 가지로 좁힌다:
//  1. redirect_uri 는 https(또는 loopback)만, 개수·길이 상한
//  2. 공개 클라이언트만 — 비밀을 발급하지 않으므로 훔칠 비밀이 없다
//  3. 등록만으로는 아무것도 못 한다 — 실제 권한은 사용자가 동의 화면에서 준다

import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';
import { clientFingerprint, randomCode, REMOTE_SCOPE, safeName, validRedirectUri } from '../lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REDIRECT_URIS = 5;

function err(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err('invalid_client_metadata', 'body must be JSON');
  }

  const raw = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (raw.length === 0) return err('invalid_redirect_uri', 'redirect_uris is required');
  if (raw.length > MAX_REDIRECT_URIS) return err('invalid_redirect_uri', `at most ${MAX_REDIRECT_URIS} redirect_uris`);

  const redirectUris: string[] = [];
  for (const value of raw) {
    const ok = validRedirectUri(value);
    // 하나라도 못 믿을 것이면 조용히 버리지 않고 등록 자체를 거부한다 —
    // 걸러진 채 등록되면 클라이언트는 등록됐다고 믿고 그 URI로 흐름을 시작한다.
    if (!ok) return err('invalid_redirect_uri', `redirect_uri must be https (or http loopback): ${String(value).slice(0, 120)}`);
    redirectUris.push(ok);
  }

  const authMethod = typeof body.token_endpoint_auth_method === 'string' ? body.token_endpoint_auth_method : 'none';
  if (authMethod !== 'none') {
    return err('invalid_client_metadata', 'only public clients are supported; use token_endpoint_auth_method="none" with PKCE');
  }

  const grantTypes = Array.isArray(body.grant_types) ? (body.grant_types as string[]) : ['authorization_code'];
  if (!grantTypes.includes('authorization_code')) {
    return err('invalid_client_metadata', 'authorization_code is the only supported grant type');
  }

  const clientName = safeName(body.client_name);
  const fingerprint = clientFingerprint(clientName, redirectUris);

  // 재등록은 멱등이다. 커넥터는 재연결할 때마다 등록하므로, 매번 새 행을 만들면
  // 인증 없이 열린 이 표면이 무한히 쌓인다. 같은 (이름, 콜백)이면 같은 client_id.
  let clientId: string;
  try {
    const admin = adminClient();
    const { data: existing, error: readError } = await admin
      .from('argus_oauth_clients')
      .select('client_id')
      .eq('fingerprint', fingerprint)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    if (existing) {
      clientId = (existing as { client_id: string }).client_id;
    } else {
      clientId = randomCode('argus_client_', 16);
      const { error } = await admin.from('argus_oauth_clients').insert({
        client_id: clientId,
        client_name: clientName,
        redirect_uris: redirectUris,
        fingerprint,
        token_endpoint_auth_method: 'none',
      });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    // adminClient() 자체가 던질 수 있다(설정 누락). 던진 것을 그대로 새어 나가게
    // 두면 클라이언트는 사양 밖의 500을 받고 OAuth 오류로 해석하지 못한다.
    console.error('[mcp/v2/oauth/register] register failed:', e);
    return err('temporarily_unavailable', 'could not register client', 503);
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: REMOTE_SCOPE,
    },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  );
}
