// RFC 6749 §4.1.3 — 인가 코드 → 액세스 토큰.
//
// 사양은 이 엔드포인트가 **application/x-www-form-urlencoded** 를 받도록
// 규정한다 (§4.1.3 "The client makes a request ... using the
// application/x-www-form-urlencoded format"). 기존 /api/mcp/oauth/token 은
// JSON 만 받는데, 그건 우리 CLI 가 유일한 호출자였기 때문이다. 원격 커넥터는
// 사양대로 form 을 보내므로 여기서는 form 을 1급으로 받고 JSON 도 함께 받는다.
//
// 만료 시 재인증: refresh_token 을 발급하지 않는다. PAT 는 90일이고, 만료되면
// 커넥터가 401 → 메타데이터 → 인가 흐름을 처음부터 다시 돈다. 그래서 메타데이터
// 에도 refresh_token 을 **선언하지 않는다** — 지원하지 않는 것을 지원한다고
// 적으면 클라이언트가 조용히 막다른 길로 간다.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { adminClient } from '@/lib/share-guard';
import { PLUGIN_TOKEN_TTL_DAYS, pluginTokenExpiry } from '@/lib/plugin-token';
import { SCOPE_DECISIONS } from '@/lib/plugin-token-auth';
import { isPkce, pkceChallenge, REMOTE_SCOPE, sha256 } from '../lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TOKENS_PER_USER = 10;

function oauthError(error: string, status = 400, description?: string) {
  return NextResponse.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status, headers: { 'cache-control': 'no-store', pragma: 'no-cache' } },
  );
}

// form 과 JSON 을 같은 모양으로 읽는다. 사양은 form 이고, JSON 은 우리 편의다.
async function readParams(req: NextRequest): Promise<Record<string, string> | null> {
  const ct = req.headers.get('content-type') || '';
  try {
    if (ct.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(await req.text()));
    }
    if (ct.includes('application/json')) {
      const body = (await req.json()) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(body).filter(([, v]) => typeof v === 'string') as Array<[string, string]>,
      );
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const params = await readParams(req);
  if (!params) return oauthError('invalid_request', 400, 'send application/x-www-form-urlencoded');

  if (params.grant_type !== 'authorization_code') {
    return oauthError('unsupported_grant_type', 400, 'only authorization_code is supported (no refresh tokens issued)');
  }

  const code = params.code ?? '';
  if (code.length < 30 || code.length > 200) return oauthError('invalid_grant');
  if (!isPkce(params.code_verifier)) return oauthError('invalid_grant', 400, 'code_verifier missing or malformed');

  let admin: ReturnType<typeof adminClient>;
  let data: unknown;
  try {
    admin = adminClient();
    const res = await admin
      .from('argus_oauth_grants')
      .select('id, client_id, user_id, code_challenge, redirect_uri, scope, status, expires_at')
      .eq('code_hash', sha256(code))
      .maybeSingle();
    // 조회 오류와 "그런 코드 없음"을 구분한다. 저장소 장애를 invalid_grant 로
    // 돌려주면 클라이언트는 코드를 버리고 흐름을 처음부터 다시 돌리는데,
    // 그래도 여전히 실패한다 — 원인이 코드가 아니기 때문이다.
    if (res.error) throw new Error(res.error.message);
    data = res.data;
  } catch (e) {
    console.error('[mcp/v2/oauth/token] grant lookup failed:', e);
    return oauthError('temporarily_unavailable', 503);
  }
  if (!data) return oauthError('invalid_grant');

  const grant = data as {
    id: string;
    client_id: string;
    user_id: string;
    code_challenge: string;
    redirect_uri: string;
    scope: string;
    status: string;
    expires_at: string;
  };

  if (Date.parse(grant.expires_at) <= Date.now()) return oauthError('invalid_grant', 400, 'authorization code expired');
  if (grant.status !== 'issued') return oauthError('invalid_grant', 400, 'authorization code already used');
  if (params.client_id && params.client_id !== grant.client_id) return oauthError('invalid_grant');
  // redirect_uri 는 인가 때와 **정확히** 같아야 한다 (RFC 6749 §4.1.3).
  if (!params.redirect_uri || params.redirect_uri !== grant.redirect_uri) return oauthError('invalid_grant');
  if (pkceChallenge(params.code_verifier) !== grant.code_challenge) return oauthError('invalid_grant');

  // 코드를 먼저 소모(claim)한 뒤에 자격증명을 만든다. 순서를 뒤집으면 동시에
  // 도착한 두 요청이 같은 코드로 토큰을 두 개 만든다.
  const { data: claimed } = await admin
    .from('argus_oauth_grants')
    .update({ status: 'consumed', consumed_at: new Date().toISOString() })
    .eq('id', grant.id)
    .eq('status', 'issued')
    .select('id')
    .maybeSingle();
  if (!claimed) return oauthError('invalid_grant', 400, 'authorization code already used');

  const { count } = await admin
    .from('plugin_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', grant.user_id);
  if ((count ?? 0) >= MAX_TOKENS_PER_USER) {
    return oauthError('access_denied', 429, 'Token limit reached; revoke one in Settings.');
  }

  const { data: client } = await admin
    .from('argus_oauth_clients')
    .select('client_name')
    .eq('client_id', grant.client_id)
    .maybeSingle();

  const accessToken = `argus_pat_${randomBytes(24).toString('hex')}`;
  const tokenExpiry = pluginTokenExpiry();
  const { error: tokenError } = await admin.from('plugin_tokens').insert({
    user_id: grant.user_id,
    token_hash: sha256(accessToken),
    label: (client as { client_name?: string } | null)?.client_name ?? 'MCP client',
    expires_at: tokenExpiry,
    // 동의 화면이 약속한 범위를 **토큰에 실제로 새긴다.** 이것이 없으면 같은
    // PAT 으로 ingest·seal 까지 열려, 화면의 문장이 거짓말이 된다.
    scope: SCOPE_DECISIONS,
  });
  if (tokenError) {
    console.error('[mcp/v2/oauth/token] token insert failed:', tokenError.message);
    return oauthError('temporarily_unavailable', 503);
  }

  await admin.from('argus_oauth_clients').update({ last_used_at: new Date().toISOString() }).eq('client_id', grant.client_id);

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: PLUGIN_TOKEN_TTL_DAYS * 24 * 60 * 60,
      scope: grant.scope || REMOTE_SCOPE,
    },
    { headers: { 'cache-control': 'no-store', pragma: 'no-cache' } },
  );
}
