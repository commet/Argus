import { describe, expect, it } from 'vitest';
import { recordSummaryMarkdown } from '@/lib/record-core';
import {
  firstVoyageInscription,
  recordCompactLine,
  recordStartDate,
  recordStripLine,
  shouldShowThirdLoop,
  summarizeReviewRecord,
} from '@/lib/record-summary';
import { SETTLED_THRESHOLD } from '@/lib/calibration-disclosure';
import type { CrossProjectRecord } from '@/lib/decision-contract';
import type { JudgmentReceipt } from '@/lib/review/schema';

function receiptsFixture(): JudgmentReceipt[] {
  const followup = (patch: Record<string, unknown>) => ({ followup_id: 'f', predicate: 'p', ...patch });
  return [
    {
      created_at: '2026-05-02T09:00:00Z',
      falsifiable_followups: [
        followup({ sealed_at: '2026-05-02' }),
        followup({ sealed_at: '2026-05-03', settled_at: '2026-06-01', outcome: 'happened' }),
        followup({ sealed_at: '2026-05-04', settled_at: '2026-06-02', outcome: 'avoided' }),
        followup({}),
      ],
    },
    {
      created_at: '2026-05-10T09:00:00Z',
      falsifiable_followups: [
        followup({ sealed_at: '2026-05-10' }),
        followup({ sealed_at: '2026-05-11', settled_at: '2026-06-03', outcome: 'partial' }),
      ],
    },
  ] as unknown as JudgmentReceipt[];
}

const record = (loops: number): CrossProjectRecord => ({
  loops,
  betsHeld: 20,
  risksAvoided: 10,
  betsBroke: 5,
  risksHappened: 3,
  goodOutcomesOnLuck: 9,
});

describe('summarizeReviewRecord', () => {
  it('counts open and revisited rows defensively', () => {
    expect(summarizeReviewRecord(receiptsFixture())).toEqual({
      open: 2,
      settled: 3,
      happened: 1,
      avoided: 1,
      partial: 1,
    });
    expect(summarizeReviewRecord([])).toEqual({
      open: 0,
      settled: 0,
      happened: 0,
      avoided: 0,
      partial: 0,
    });
  });
});

describe('neutral accumulation copy', () => {
  it('uses only revisit count across web and Telegram', () => {
    const review = summarizeReviewRecord(receiptsFixture());
    const web = recordStripLine(record(2), review, 'ko');
    const telegram = recordSummaryMarkdown(review, 'ko');
    expect(web).toBe('다시 돌아와 답한 기록 5건');
    expect(telegram).toContain('돌아와 답을 덧붙인 기록: **3**');
    expect(`${web}\n${telegram}`).not.toMatch(/적중|빗나감|운|정확|점수|성과|승률/);
  });

  it('does not leak the legacy outcome buckets into copy', () => {
    const line = recordStripLine(record(4), undefined, 'en');
    expect(line).toBe('4 records revisited');
    expect(line).not.toMatch(/held|missed|luck|score|track record/i);
  });

  it('keeps the workspace line equally neutral', () => {
    expect(recordCompactLine(record(4), 6, 'ko')).toBe('다시 돌아와 답한 기록 4건');
    expect(recordCompactLine(record(0), 2, 'ko')).toBe('나중에 다시 볼 기록 2건');
    expect(recordCompactLine(record(0), 0, 'ko')).toBeNull();
  });
});

describe('chronology helpers', () => {
  it('picks the oldest valid date across projects and receipts', () => {
    expect(recordStartDate(
      [{ created_at: '2026-06-01T00:00:00Z' }],
      [{ created_at: '2026-05-10T09:00:00Z' }],
    )).toBe('2026-05-10');
    expect(recordStartDate([], [])).toBeUndefined();
  });

  it('renders an elapsed-time inscription without claiming a streak', () => {
    const line = firstVoyageInscription('2026-07-01', Date.parse('2026-07-15T00:00:00Z'), 'en');
    expect(line).toContain('2 weeks ago');
    expect(line).not.toMatch(/streak|consistent|score/i);
  });

  it('keeps the legacy one-time gate deterministic', () => {
    expect(shouldShowThirdLoop(SETTLED_THRESHOLD, false)).toBe(true);
    expect(shouldShowThirdLoop(SETTLED_THRESHOLD, true)).toBe(false);
    expect(shouldShowThirdLoop(SETTLED_THRESHOLD + 1, false)).toBe(false);
  });
});
