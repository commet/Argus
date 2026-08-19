/**
 * 제안 가드 — 한 PR 한 존 (CLAUDE.md 규약의 기계 강제)
 *
 * 이 파일은 **아직 설치되지 않았다.** `src/lib/__tests__/`로 옮기면 CI가
 * 존 혼합을 잡는다. 설치 여부는 창업자 결정이므로 리시트 안에 둔다 —
 * 재정초 브리프 §5는 에이전트의 역할을 측정으로 한정한다.
 *
 * 근거 (실측): `history-scan.mjs`로 origin/main 최근 60커밋을 조사한 결과
 * 6건(10.0%)이 MIT 존과 앱 존을 한 커밋에 섞었고, 그 6건 전부 CI를 통과해
 * 머지됐다. 현재 이 규약은 PR 템플릿의 체크박스로만 존재한다.
 *
 * 설계 결정 둘:
 *  - **비교 대상은 머지 베이스**다. HEAD~1이 아니라 origin/main과의 공통
 *    조상을 써야 브랜치 전체가 검사된다.
 *  - **의도적 예외를 막지 않는다.** 두 존에 같은 로직을 이식해야 하는 작업이
 *    실제로 있다(예: premises-core). 커밋 메시지나 PR 본문에
 *    `zone-exception:` 을 적으면 통과시킨다 — 금지가 아니라 **명시 요구**다.
 *    (조용한 위반을 시끄러운 선언으로 바꾸는 것이 목적이다)
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

const sh = (c: string): string => {
  try {
    return execSync(c, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

type Zone = 'MIT' | 'app' | 'harness' | 'docs';

const zoneOf = (f: string): Zone =>
  f.startsWith('argus-mcp/') || f.startsWith('argus-plugin-v2/')
    ? 'MIT'
    : f.startsWith('src/')
      ? 'app'
      : f.startsWith('method-harness/')
        ? 'harness'
        : 'docs';

describe('한 PR 한 존 (CLAUDE.md 라이선스 경계)', () => {
  it('브랜치의 변경이 MIT 존과 앱 존을 동시에 건드리지 않는다', () => {
    const base = sh('git merge-base origin/main HEAD');
    if (!base) return; // 얕은 클론 등 — 검사 불가 시 침묵(가짜 초록이 아니라 미실행)

    const files = sh(`git diff --name-only ${base}...HEAD`).split('\n').filter(Boolean);
    if (files.length === 0) return;

    // 명시 예외: 커밋 메시지에 zone-exception: 사유
    const messages = sh(`git log ${base}..HEAD --format=%B`);
    if (/zone-exception:/i.test(messages)) return;

    const zones = [...new Set(files.map(zoneOf))].filter((z) => z !== 'docs');
    expect(
      zones.length,
      `한 브랜치가 ${zones.join(' + ')} 존을 동시에 건드린다.\n` +
        `PR을 존별로 쪼개거나, 의도적이면 커밋 메시지에 "zone-exception: <사유>"를 적어라.\n` +
        `파일:\n${files.map((f) => `  [${zoneOf(f)}] ${f}`).join('\n')}`,
    ).toBeLessThanOrEqual(1);
  });
});
