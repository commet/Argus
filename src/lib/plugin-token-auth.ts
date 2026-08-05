// PAT(`argus_pat_*`) → user_id + **범위 검사**. 다섯 표면이 같은 토큰 체계를
// 쓰므로 검증 규칙은 한 곳에만 둔다 — 두 곳에서 갈라지면 한쪽만 조이는 순간
// 다른 쪽이 뚫린다 (mcp/v2/auth.ts 가 이미 같은 이유로 seal 의 인라인 검증을
// 뽑아 왔다).
//
// **왜 범위가 필요한가.** 2026-08-05 이전에는 PAT 이 계정 전체 권한이었고,
// 그래도 됐던 이유는 발급 경로가 둘 다 사용자의 손 안에 있었기 때문이다:
// 설정 화면에서 직접 복사하거나(브라우저 세션 필수), 로컬 CLI 의 loopback
// 흐름(같은 기기 필수). 원격 OAuth 커넥터가 생기면서 **제3자가 동의 클릭 하나로
// PAT 을 받아 가는 경로**가 처음 열렸다. 그 화면은 "결정 기록"만 하겠다고
// 적어 두는데, 범위가 없으면 같은 토큰으로 `/api/plugin/ingest`(파일 적재)와
// `/api/mcp/seal`(영수증 변경)까지 된다. 화면의 문장과 토큰의 실제 권한이
// 다르면 그 문장은 거짓말이다.
//
// 호환: `scope` 가 NULL 인 기존 토큰은 `argus.full` 로 읽는다. 컬럼을 추가한
// 순간 유효한 CLI 토큰이 전부 죽으면 안 되므로, 좁히기는 **새로 발급되는
// 토큰부터** 적용된다.

import { createHash } from 'crypto';
import { adminClient } from '@/lib/share-guard';
import { isTokenExpired } from '@/lib/plugin-token';

/** 계정 전체 — 사용자가 직접 발급했거나 같은 기기의 CLI 가 받은 토큰. */
export const SCOPE_FULL = 'argus.full';
/** 원격 커넥터 — MCP 결정 표면(`/api/mcp/v2`)만. */
export const SCOPE_DECISIONS = 'argus.decisions';

export type PluginScope = typeof SCOPE_FULL | typeof SCOPE_DECISIONS;

// 무엇이 무엇을 포함하는가. full 은 전부, decisions 는 자기 자신만.
// (여기 없는 범위 문자열은 아무것도 열지 않는다 — fail-closed.)
const COVERS: Record<string, readonly PluginScope[]> = {
  [SCOPE_FULL]: [SCOPE_FULL, SCOPE_DECISIONS],
  [SCOPE_DECISIONS]: [SCOPE_DECISIONS],
};

export function scopeAllows(granted: string | null | undefined, required: PluginScope): boolean {
  const effective = granted?.trim() || SCOPE_FULL; // NULL = 컬럼 이전에 발급된 토큰
  return (COVERS[effective] ?? []).includes(required);
}

export type PluginTokenAuth =
  | { ok: true; userId: string; tokenId: string; scope: string }
  | { ok: false; reason: 'missing' | 'malformed' | 'unknown_or_expired' | 'insufficient_scope' };

export function hashPluginToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Authorization 헤더 하나를 받아 토큰을 해석하고 범위까지 본다.
 * 범위가 모자라면 `insufficient_scope` — 401(모르는 토큰)과 구분한다.
 * 재인증해도 열리지 않는 문이므로 호출부는 403 으로 끝내야 한다.
 */
export async function authenticatePluginToken(
  authHeader: string | null,
  required: PluginScope,
): Promise<PluginTokenAuth> {
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, reason: 'missing' };
  const raw = authHeader.slice(7).trim();
  if (!raw.startsWith('argus_pat_')) return { ok: false, reason: 'malformed' };

  const admin = adminClient();
  const { data: row } = await admin
    .from('plugin_tokens')
    .select('id, user_id, expires_at, scope')
    .eq('token_hash', hashPluginToken(raw))
    .single();

  if (!row || isTokenExpired(row.expires_at)) return { ok: false, reason: 'unknown_or_expired' };
  if (!scopeAllows(row.scope, required)) return { ok: false, reason: 'insufficient_scope' };

  // 마지막 사용 시각은 관측용이므로 실패해도 요청을 막지 않는다.
  admin
    .from('plugin_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
    .then(({ error }) => {
      if (error) console.error('[plugin-token] last_used:', error.message);
    });

  return { ok: true, userId: row.user_id, tokenId: row.id, scope: row.scope || SCOPE_FULL };
}

/**
 * `argus.full` 토큰 삽입. `scope` 컬럼이 아직 없는 환경(마이그레이션
 * 20260805190000 미적용)에서는 컬럼 없이 다시 넣는다 — `sanitizeItem` 규약이
 * 적어 둔 그대로, 없는 컬럼을 보내면 PostgREST 가 **행 전체를 거부**한다.
 * NULL 은 `argus.full` 과 같은 뜻이므로 이 되돌림은 무손실이고, 코드가
 * 마이그레이션보다 먼저 배포돼도 기존 발급 화면이 죽지 않는다.
 *
 * **좁은 범위(`argus.decisions`)에는 이 되돌림을 주지 않는다.** 거기서 컬럼이
 * 없는데 조용히 넘어가면 원격 커넥터가 계정 전체 토큰을 받게 되고, 그것이
 * 정확히 이 장치가 막으려는 것이다 — 그 경로는 크게 실패해야 한다.
 */
export async function insertFullScopeToken(
  admin: ReturnType<typeof adminClient>,
  row: { user_id: string; token_hash: string; label: string | null; expires_at: string | null },
) {
  const first = await admin.from('plugin_tokens').insert({ ...row, scope: SCOPE_FULL });
  if (!first.error) return first;
  const missingColumn = first.error.code === 'PGRST204' || /scope/i.test(first.error.message);
  if (!missingColumn) return first;
  console.warn('[plugin-token] scope column missing — issuing legacy full-scope token');
  return admin.from('plugin_tokens').insert(row);
}
