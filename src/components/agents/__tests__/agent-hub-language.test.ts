import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../AgentHub.tsx', import.meta.url), 'utf8');

describe('AgentHub public framing', () => {
  it('describes selectable review modes instead of a fictional AI staff', () => {
    expect(source).toContain("L('AI 검토 방식', 'AI review modes')");
    expect(source).toContain('필요한 역할만 골라 씁니다');
    expect(source).not.toContain("L('AI 검토자', 'AI reviewers')");
    expect(source).not.toContain('meta.emoji');
  });
});
