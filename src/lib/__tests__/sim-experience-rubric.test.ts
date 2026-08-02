import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSim = (name: string) => readFileSync(
  new URL(`../../../scripts/sim/${name}`, import.meta.url),
  'utf8',
);

describe('judgment simulation covers the visible product loop', () => {
  it('judges whether the pre-review baseline was used and whether updates are legible', () => {
    const judge = readSim('judge.mjs');
    expect(judge).toContain('baseline_use');
    expect(judge).toContain('update_legibility');
    expect(judge).toContain('이전 분석을 새 답의 결과처럼 반복하지 않는다');
  });

  it('replays a real baseline-before-analysis journey and reports call latency', () => {
    const scenarios = readSim('scenarios.mjs');
    const runner = readSim('run-sim.mjs');
    expect(scenarios).toContain("id: 'heavy-10-launch-baseline'");
    expect(scenarios).toContain('첫 사용자에게 치명적인 오류만 더 확인');
    expect(runner).toContain("'pre_review_baseline'");
    expect(runner).toContain('LLM 호출:');
  });
});
