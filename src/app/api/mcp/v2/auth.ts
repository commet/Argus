// Bearer 토큰 → user_id. 검증 규칙 자체는 `@/lib/plugin-token-auth` 가 갖는다
// (같은 토큰 체계 `argus_pat_*`, 같은 테이블 `plugin_tokens`, 같은 만료 판정,
// 그리고 **같은 범위 검사**). 다섯 표면이 같은 토큰을 받으므로 규칙이 두 곳에서
// 갈라지면 한쪽만 조이는 순간 다른 쪽이 뚫린다.
//
// 이 표면이 요구하는 범위는 `argus.decisions` — 원격 커넥터가 동의로 받아 가는
// 최소 범위다. 계정 전체(`argus.full`) 토큰도 당연히 통과한다.

import { authenticatePluginToken, SCOPE_DECISIONS } from '@/lib/plugin-token-auth';

export type AuthResult =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; reason: 'missing' | 'malformed' | 'unknown_or_expired' | 'insufficient_scope' };

export async function authenticate(authHeader: string | null): Promise<AuthResult> {
  const res = await authenticatePluginToken(authHeader, SCOPE_DECISIONS);
  return res.ok ? { ok: true, userId: res.userId, tokenId: res.tokenId } : res;
}

// 401 응답에 붙일 헤더 — 클라이언트가 어디서 인증받아야 하는지 알려준다
// (RFC 9728). Claude·ChatGPT 커넥터가 이 헤더를 보고 OAuth 흐름을 시작한다.
export function wwwAuthenticate(origin: string): string {
  return `Bearer realm="argus", resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
}
