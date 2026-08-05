// RFC 6749 §4.1 — 인가 요청. 브라우저가 도착하는 곳.
//
// 여기서 코드를 발급하지 않는다. 요청이 말이 되는지만 검사하고 **사람이 보는
// 동의 화면으로 302** 한다. 발급은 사용자가 그 화면에서 승인할 때 approve
// 라우트가 한다 — 승인 없이 발급하면 그것은 사용자의 행위가 아니다 (§11.2와
// 같은 규칙: 호스트의 승인은 사용자 행위가 아니다).
//
// 오류를 어디로 돌려주는가가 이 파일의 핵심 판단이다: redirect_uri 가 등록된
// 것으로 확인된 뒤에만 리다이렉트로 오류를 돌려준다. 확인 전에 리다이렉트하면
// 이 엔드포인트가 열린 리다이렉터가 된다 (RFC 6749 §4.1.2.1이 정확히 이것을
// 금지한다).

import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';
import { CONSENT_PATH, errorRedirect, isPkce, redirectUriRegistered, type ClientRow } from '../lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function plainError(message: string, status = 400) {
  // 리다이렉트할 수 없는 오류는 사람이 읽는 문장으로 끝낸다. 커넥터 설정
  // 화면에서 이 문장이 그대로 보이므로, 무엇이 틀렸는지 적는다.
  return new NextResponse(`Argus MCP 인가 요청을 처리할 수 없습니다.\n\n${message}\n`, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const p = url.searchParams;
  const clientId = p.get('client_id') ?? '';
  const redirectUri = p.get('redirect_uri') ?? '';
  const state = p.get('state');

  if (!clientId) return plainError('client_id 가 없습니다. 먼저 동적 등록(/api/mcp/v2/oauth/register)을 거쳐야 합니다.');
  if (!redirectUri) return plainError('redirect_uri 가 없습니다.');

  const { data } = await adminClient()
    .from('argus_oauth_clients')
    .select('client_id, client_name, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle();
  const client = data as ClientRow | null;
  if (!client) return plainError('등록되지 않은 client_id 입니다. 커넥터를 지우고 다시 추가해 주세요.');
  if (!redirectUriRegistered(client, redirectUri)) {
    return plainError('redirect_uri 가 이 클라이언트에 등록된 것과 정확히 일치하지 않습니다.');
  }

  // 여기서부터는 redirect_uri 를 믿을 수 있으므로 오류를 사양대로 돌려준다.
  if (p.get('response_type') !== 'code') {
    return NextResponse.redirect(errorRedirect(redirectUri, state, 'unsupported_response_type', 'only response_type=code'));
  }
  if (p.get('code_challenge_method') !== 'S256' || !isPkce(p.get('code_challenge'))) {
    return NextResponse.redirect(
      errorRedirect(redirectUri, state, 'invalid_request', 'PKCE with code_challenge_method=S256 is required'),
    );
  }

  // 동의 화면으로. 파라미터는 그대로 넘기고, 승인 시 approve 라우트가 같은 값을
  // 다시 검증한다 — 이 URL 은 사용자가 편집할 수 있으므로 여기서의 검사는
  // 안내이지 방어가 아니다.
  const consent = new URL(CONSENT_PATH, url.origin);
  consent.searchParams.set('client_id', clientId);
  consent.searchParams.set('redirect_uri', redirectUri);
  consent.searchParams.set('code_challenge', p.get('code_challenge')!);
  if (state) consent.searchParams.set('state', state);
  if (p.get('scope')) consent.searchParams.set('scope', p.get('scope')!);
  consent.searchParams.set('client_name', client.client_name);

  return NextResponse.redirect(consent.toString(), { headers: { 'cache-control': 'no-store' } });
}
