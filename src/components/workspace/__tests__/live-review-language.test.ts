import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('live workspace review language', () => {
  it('describes running work as reviews, not a fictional analysis team', () => {
    const sidebar = read('../progressive/AgentSidebar.tsx');
    const toast = read('../progressive/PingToast.tsx');
    const flow = read('../progressive/ProgressiveFlow.tsx');
    expect(sidebar).toContain("L('검토 과정', 'Review process')");
    expect(sidebar).not.toContain("L('분석 팀', 'Analysis Team')");
    expect(toast).toContain("L('검토 결과가 준비됐어요', 'Review findings are ready')");
    expect(flow).not.toContain('Agent task error occurred.');
  });
});
