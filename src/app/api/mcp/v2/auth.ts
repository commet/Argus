// Bearer 토큰 → user_id. 기존 /api/mcp/seal 이 쓰던 검증 절차와 **같은 규칙**을
// 따른다 (동일 토큰 체계 `argus_pat_*`, 동일 테이블 `plugin_tokens`, 동일 만료
// 판정). seal 라우트는 자기 흐름 안에 인라인으로 갖고 있는데, 두 번째 소비자가
// 생긴 지금 복사하지 않고 여기로 뽑는다 — 검증 규칙이 두 곳에서 갈라지면 한쪽만
// 조이는 순간 다른 쪽이 뚫린다.

import { createHash } from 'crypto';
import { adminClient } from '@/lib/share-guard';
import { isTokenExpired } from '@/lib/plugin-token';

export type AuthResult =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; reason: 'missing' | 'malformed' | 'unknown_or_expired' };

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function authenticate(authHeader: string | null): Promise<AuthResult> {
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, reason: 'missing' };
  const raw = authHeader.slice(7).trim();
  if (!raw.startsWith('argus_pat_')) return { ok: false, reason: 'malformed' };

  const admin = adminClient();
  const { data: row } = await admin
    .from('plugin_tokens')
    .select('id, user_id, expires_at')
    .eq('token_hash', hashToken(raw))
    .single();

  if (!row || isTokenExpired(row.expires_at)) return { ok: false, reason: 'unknown_or_expired' };

  // 마지막 사용 시각은 관측용이므로 실패해도 요청을 막지 않는다.
  admin
    .from('plugin_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
    .then(({ error }) => {
      if (error) console.error('[mcp/v2] last_used:', error.message);
    });

  return { ok: true, userId: row.user_id, tokenId: row.id };
}

// 401 응답에 붙일 헤더 — 클라이언트가 어디서 인증받아야 하는지 알려준다
// (RFC 9728). Claude·ChatGPT 커넥터가 이 헤더를 보고 OAuth 흐름을 시작한다.
export function wwwAuthenticate(origin: string): string {
  return `Bearer realm="argus", resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
}
