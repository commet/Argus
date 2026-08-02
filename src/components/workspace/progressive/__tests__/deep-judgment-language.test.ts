import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const flow = readFileSync(new URL('../ProgressiveFlow.tsx', import.meta.url), 'utf8');

describe('additional review language', () => {
  it('leads with what the user receives, not the internal worker count', () => {
    expect(flow).toContain('근거·반대 가능성·빠뜨린 위험 확인');
    expect(flow).toContain('근거와 위험 더 확인하기');
    expect(flow).toContain("phase === 'conversing' && (!curQ || deepMode)");
    expect(flow).not.toContain('전문 검토 2 · 필요할 때 위험 검토 1');
    expect(flow).not.toContain('심층 검토 켜기');
  });
});
