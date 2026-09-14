/**
 * `scope` — 이 결정이 **어디에** 걸리나.
 *
 * 값 집합은 짐작이 아니라 실측으로 정했다 (미확정 등록부 U1, 2026-08-21):
 * 이 저장소의 CLAUDE.md 를 조항 54개로 갈라 하나씩 분류해 보니 필요한 값이
 * 셋이었고, 넷째가 나오지 않았다.
 *
 *  - `repo`        이 저장소에서 하는 모든 일 (대다수)
 *  - `path:<glob>` 저장소 안의 특정 자리 — "MIT 존은…", "화면 코드에서는…"
 *  - `global`      기계 전체, 저장소와 무관 — "claude 프로세스를 절대 죽이지
 *                  않는다" 처럼 어느 저장소에 있든 참인 것
 *
 * **"어떤 일을 할 때"는 여기 넣지 않는다.** "PR 본문에는…" 은 걸리는 곳이
 * 저장소이고, PR 을 쓰는 순간에 걸린다는 것은 *어긋난 걸 아는 방법* 쪽 이야기다.
 * 둘을 한 칸에 섞으면 범위로 좁히는 일이 망가진다.
 *
 * **미지정을 허용하지 않는 이유**: 범위가 빈 결정이 5%만 섞여도 "다른 프로젝트
 * 규칙이 안 섞인다"는 보증이 무너진다(실측 100%→13%). 그래서 빈 값은 받지 않는다.
 */

export type ParsedScope =
  | { kind: 'repo' }
  | { kind: 'global' }
  | { kind: 'path'; glob: string };

export function parseScope(scope: string): ParsedScope | null {
  if (scope === 'repo') return { kind: 'repo' };
  if (scope === 'global') return { kind: 'global' };
  if (scope.startsWith('path:')) {
    const glob = scope.slice('path:'.length).trim();
    // 절대경로·상위로 올라가기는 받지 않는다 — 저장소 안을 가리키는 말이다.
    if (!glob || glob.startsWith('/') || glob.includes('..') || /^[A-Za-z]:/.test(glob)) return null;
    return { kind: 'path', glob };
  }
  return null;
}

export const isValidScope = (scope: string): boolean => parseScope(scope) !== null;

/** 사람에게 보여줄 말 — 화면에 `path:src/**` 같은 기계 문자열을 내놓지 않는다. */
export function scopeSay(scope: string): string {
  const parsed = parseScope(scope);
  if (!parsed) return scope;
  if (parsed.kind === 'repo') return '이 저장소에서 하는 모든 일';
  if (parsed.kind === 'global') return '어느 저장소에서든';
  return `${parsed.glob} 안에서`;
}
