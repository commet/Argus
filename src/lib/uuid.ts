export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * UUID 형태 검사 — 단일 정본.
 *
 * 왜 여기 있는가: 이 패턴은 원래 `team-server.ts`에 있었고, 그 파일은
 * `import 'server-only'`로 시작해서 **vitest가 읽을 수 없다.** 그래서 이 검사기를
 * 직접 겨냥한 테스트가 하나도 없었고, 2026-07-19부터 10일 동안 묶음이 하나 빠진
 * 정규식(`8-4-4-12`)이 **진짜 id를 전부 거절**하며 살아 있었다. 팀을 만드는 것
 * 말고는 초대·멤버 삭제·프로젝트 공유·리뷰가 전부 400 "Invalid team."이었다.
 *
 * 교훈은 "정규식을 조심하자"가 아니다: **검증기가 테스트할 수 없는 자리에 있으면
 * 검증기는 검증되지 않는다.** 순수한 것은 순수한 파일에 둔다.
 *
 * UUID는 다섯 묶음이다: 8-4-4-4-12.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
