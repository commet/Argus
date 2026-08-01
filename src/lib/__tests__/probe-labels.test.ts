import { describe, expect, it } from 'vitest';
import { probeExecutorLabels } from '@/lib/probe-labels';

describe('probeExecutorLabels', () => {
  it('labels stochastic samples as independent reads, not people', () => {
    expect(probeExecutorLabels(3, 'ko').map((item) => item.name)).toEqual([
      '독립 검토 1',
      '독립 검토 2',
      '독립 검토 3',
    ]);
    expect(probeExecutorLabels(2, 'en').map((item) => item.name)).toEqual([
      'Independent read 1',
      'Independent read 2',
    ]);
  });

  it('keeps the probe display within its supported range', () => {
    expect(probeExecutorLabels(0)).toHaveLength(1);
    expect(probeExecutorLabels(99)).toHaveLength(5);
  });
});
