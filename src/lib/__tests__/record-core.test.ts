/**
 * Record (자차표) formatting — must honor calibration-disclosure: below the
 * settled threshold, show counts only + an honest "unproven yet" line, never a
 * track-record claim. And the spine: frequencies (counts), never a single score.
 */
import { describe, it, expect } from 'vitest';
import { recordSummaryMarkdown } from '@/lib/record-core';
import { SETTLED_THRESHOLD } from '@/lib/calibration-disclosure';

const empty = { open: 0, settled: 0, happened: 0, avoided: 0, partial: 0 };

describe('record-core', () => {
  it('empty record invites the first seal (no fake stats)', () => {
    const md = recordSummaryMarkdown(empty, 'ko');
    expect(md).toContain('아직 봉인한 결정이 없어요');
    expect(md).not.toMatch(/\d+%/);
  });

  it('open bets, 0 settled → counts + honest "too few" line, no track-record claim', () => {
    const md = recordSummaryMarkdown({ ...empty, open: 4 }, 'ko');
    expect(md).toContain('봉인 중');
    expect(md).toContain('일러요'); // honest maturity line
    expect(md).not.toContain('쌓이고 있어요');
    expect(md).not.toMatch(/\d+%/);
  });

  it(`below ${SETTLED_THRESHOLD} settled still withholds the "record building" line`, () => {
    const md = recordSummaryMarkdown({ open: 1, settled: SETTLED_THRESHOLD - 1, happened: 1, avoided: 0, partial: 1 }, 'ko');
    expect(md).toContain('정산 결과'); // outcome counts are always safe
    expect(md).toContain('일러요');
    expect(md).not.toContain('쌓이고 있어요');
  });

  it(`at/above ${SETTLED_THRESHOLD} settled → shows the building line + outcome frequencies (still no score)`, () => {
    const md = recordSummaryMarkdown({ open: 2, settled: 5, happened: 3, avoided: 1, partial: 1 }, 'ko');
    expect(md).toContain('정산 완료: **5**');
    expect(md).toContain('잘됨 3');
    expect(md).toContain('쌓이고 있어요');
    expect(md).toContain('점수가 아니'); // explicitly disclaims it's a score
    expect(md).not.toMatch(/\d+%/);
  });

  it('en variant carries the same gating', () => {
    expect(recordSummaryMarkdown({ ...empty, open: 1 }, 'en')).toContain('too few');
    expect(recordSummaryMarkdown({ open: 1, settled: 5, happened: 4, avoided: 1, partial: 0 }, 'en')).toContain('record is building');
  });
});
