// 원격 커넥터용 OAuth — 규칙 한 곳.
//
// 왜 기존 /api/mcp/oauth/* 를 고치지 않고 새로 만드는가:
// 그쪽은 **로컬 CLI 전용**으로 설계돼 있다. redirect_uri를 loopback(http://127.0.0.1)
// 으로만 받고, authorize가 브라우저 리다이렉트가 아니라 Supabase Bearer를 든
// JSON POST이며, token 교환도 JSON이다. Claude·ChatGPT 커넥터는 정확히 그 셋의
// 반대를 요구한다 — https 콜백, 브라우저 302, form-encoded 토큰 교환, 그리고
// 사전 등록 없는 클라이언트를 위한 동적 등록(RFC 7591).
//
// 한쪽을 다른 쪽에 맞춰 넓히면 로컬 흐름의 loopback 제약(= DNS rebinding 방어)이
// 풀린다. 그래서 **넓히지 않고 나란히 둔다.** 공유하는 것은 발급되는 자격증명뿐
// (같은 `argus_pat_*`, 같은 plugin_tokens, 같은 만료 규칙) — 검증 규칙은 각자.

import { createHash, randomBytes } from 'crypto';

// scope 와 리소스 경로는 **발견 문서가 정본**이다. 여기서 다시 선언하면 두 값이
// 갈라지고, 갈라지는 순간 클라이언트가 읽는 메타데이터와 서버가 발급하는 토큰의
// scope 가 달라진다 — 어느 쪽도 에러를 내지 않으므로 아무도 모른다.
export { REMOTE_SCOPE, RESOURCE_PATH as MCP_RESOURCE_PATH } from '@/lib/mcp-discovery';

export const AUTH_CODE_TTL_SECONDS = 10 * 60;

// 사용자가 이 화면에서 승인한다. 원격 커넥터는 브라우저를 여기로 보낸다.
// locale 접두사를 붙이지 않는다 — proxy 가 쿼리를 보존한 채 사용자의 언어로
// 307 한다. 여기에 /ko 를 박으면 영어 사용자가 한국어 동의 화면을 본다.
export const CONSENT_PATH = '/connect/mcp';

const PKCE_VALUE = /^[A-Za-z0-9._~-]{43,128}$/;

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function randomCode(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString('base64url')}`;
}

export function isPkce(value: unknown): value is string {
  return typeof value === 'string' && PKCE_VALUE.test(value);
}

export function safeName(value: unknown, fallback = 'MCP client'): string {
  if (typeof value !== 'string') return fallback;
  // 제어문자 제거 — 이 이름은 동의 화면과 토큰 라벨에 그대로 나온다.
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 80) || fallback;
}

// 원격 커넥터의 콜백. https 만 받는다 — 단 하나의 예외가 로컬 개발용 loopback이고,
// 그것도 http 로만 허용한다(RFC 8252). 여기서 http://example.com 을 허용하면
// 인가 코드가 평문으로 흐른다.
export function validRedirectUri(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return null;
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
    if (url.protocol === 'https:') return url.toString();
    if (url.protocol === 'http:' && loopback) return url.toString();
    return null;
  } catch {
    return null;
  }
}

export function expiresAt(seconds: number, now = Date.now()): string {
  return new Date(now + seconds * 1000).toISOString();
}

// OAuth 오류를 **리다이렉트로** 돌려줄지, 화면에 그릴지 (RFC 6749 §4.1.2.1).
// redirect_uri 자체가 못 믿을 것이면 절대 리다이렉트하지 않는다 — 그러면
// 열린 리다이렉터가 된다.
export function errorRedirect(redirectUri: string, state: string | null, error: string, description?: string): string {
  const u = new URL(redirectUri);
  u.searchParams.set('error', error);
  if (description) u.searchParams.set('error_description', description);
  if (state) u.searchParams.set('state', state);
  return u.toString();
}

// 같은 커넥터의 재등록을 알아보기 위한 지문. 콜백 목록은 순서가 달라도 같은
// 클라이언트이므로 정렬해서 넣는다.
export function clientFingerprint(name: string, redirectUris: readonly string[]): string {
  return sha256(`${name}\n${[...redirectUris].sort().join('\n')}`);
}

export interface ClientRow {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

export function redirectUriRegistered(client: ClientRow, redirectUri: string): boolean {
  // 정확 일치만 (RFC 8252 §7.3). 접두사 일치를 허용하면 등록된 도메인 아래
  // 아무 경로로나 코드를 흘릴 수 있다.
  return client.redirect_uris.includes(redirectUri);
}
