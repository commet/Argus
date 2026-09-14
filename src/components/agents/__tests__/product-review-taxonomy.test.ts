import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/**
 * 세 표면이 같은 낱말을 쓰는지 지키던 가드였다. 2026-08-19 청소에서 셋 중 하나
 * (`landing/voyage/VoyagePhases.tsx`)가 사라졌다 — 어떤 라우트도 렌더하지 않는
 * 죽은 랜딩 자산이었다 (`scripts/check-reachability.mjs` 판정).
 *
 * 없어진 표면에 대한 기대를 남겨두면 가드가 아니라 부채가 되므로 그 팔은 지우고,
 * **살아 있는 두 표면은 계속 지킨다.** 랜딩이 다시 이 낱말을 쓰게 되면 그때 팔을
 * 다시 붙인다.
 */
describe('public review taxonomy', () => {
  it('keeps directory metadata and real teams conceptually aligned', () => {
    const directory = read('../../../app/[locale]/agents/page.tsx');
    const teams = read('../../../app/[locale]/teams/page.tsx');
    expect(directory).toContain('AI 검토 방식 — Argus');
    expect(teams).toContain('AI 검토 방식과 달리');
  });
});
