import { describe, expect, it } from 'vitest';
import { recordSummaryMarkdown } from '@/lib/record-core';

const empty = { open: 0, settled: 0, happened: 0, avoided: 0, partial: 0 };

describe('record-core neutral chronology', () => {
  it('invites the first record without manufacturing statistics', () => {
    const md = recordSummaryMarkdown(empty, 'ko');
    expect(md).toContain('아직 남긴 기록이 없어요');
    expect(md).not.toMatch(/\d+%|적중|빗나감|점수|승률|track record/i);
  });

  it('shows only records to revisit and records revisited', () => {
    const md = recordSummaryMarkdown(
      { open: 2, settled: 5, happened: 4, avoided: 1, partial: 0 },
      'ko',
    );
    expect(md).toContain('나중에 다시 볼 기록: **2**');
    expect(md).toContain('돌아와 답을 덧붙인 기록: **5**');
    expect(md).not.toMatch(/적중|빗나감|운|정확|점수|성과|승률/);
    expect(md).not.toContain('4');
    expect(md).not.toContain('1');
  });

  it('carries the same neutral meaning in English', () => {
    const md = recordSummaryMarkdown(
      { open: 1, settled: 3, happened: 3, avoided: 0, partial: 0 },
      'en',
    );
    expect(md).toContain('To revisit: **1**');
    expect(md).toContain('Revisited: **3**');
    expect(md).not.toMatch(/held|missed|accuracy|score|win rate|track record/i);
  });
});
