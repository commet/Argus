import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../useProgressiveStore.ts', import.meta.url), 'utf8');

describe('checkpoint public language', () => {
  it('records review stages without turning them into an AI team', () => {
    expect(source).toContain("ko ? '검토 구성' : 'Review setup'");
    expect(source).toContain("ko ? '검토 완료' : 'Review complete'");
    expect(source).not.toContain("'AI 팀 구성'");
    expect(source).not.toContain("'AI 팀원 검토 완료'");
  });
});
