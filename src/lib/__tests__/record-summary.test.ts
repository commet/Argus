/**
 * record-summary (P1-A2 = 08 S2·S8) — the one display brain for the 자차표.
 *
 * The load-bearing test here is the CROSS test (08 S8): the web RecordStrip
 * sentence and the telegram recordSummaryMarkdown must render the SAME numbers
 * from the same fake data. Sentences may differ per surface; digits may not
 * (the reframeSystemPrompt pattern, miniature edition).
 *
 * Spine: everything asserted here is a count — a % anywhere is a failure.
 */
import { describe, it, expect } from 'vitest';
import { recordSummaryMarkdown } from '@/lib/record-core';
import {
  summarizeReviewRecord,
  recordStripLine,
  recordCompactLine,
  recordStartDate,
  shouldShowThirdLoop,
} from '@/lib/record-summary';
import { SETTLED_THRESHOLD } from '@/lib/calibration-disclosure';
import type { CrossProjectRecord } from '@/lib/decision-contract';
import type { JudgmentReceipt } from '@/lib/review/schema';

/** Minimal review-receipt fixtures — summarizeReviewRecord is defensive by
 *  contract (Defensive Data Access), so partial shapes are the honest test. */
function receiptsFixture(): JudgmentReceipt[] {
  const f = (patch: Record<string, unknown>) => ({ followup_id: 'f', predicate: 'p', ...patch });
  return [
    {
      created_at: '2026-05-02T09:00:00Z',
      falsifiable_followups: [
        f({ sealed_at: '2026-05-02' }), // open
        f({ sealed_at: '2026-05-03', settled_at: '2026-06-01', outcome: 'happened' }),
        f({ sealed_at: '2026-05-04', settled_at: '2026-06-02', outcome: 'avoided' }),
        f({}), // unsealed draft — never part of the record
      ],
    },
    {
      created_at: '2026-05-10T09:00:00Z',
      falsifiable_followups: [
        f({ sealed_at: '2026-05-10' }), // open
        f({ sealed_at: '2026-05-11', settled_at: '2026-06-03', outcome: 'partial' }),
      ],
    },
  ] as unknown as JudgmentReceipt[];
}

const webRecord: CrossProjectRecord = {
  loops: 2,
  betsHeld: 2,
  risksAvoided: 1,
  betsBroke: 0,
  risksHappened: 0,
  goodOutcomesOnLuck: 1,
};

describe('summarizeReviewRecord (the review half of the record)', () => {
  it('counts sealed-open vs settled, buckets outcomes, ignores unsealed drafts', () => {
    expect(summarizeReviewRecord(receiptsFixture())).toEqual({
      open: 2,
      settled: 3,
      happened: 1,
      avoided: 1,
      partial: 1,
    });
  });

  it('is defensive: empty / malformed input yields zeros, never throws', () => {
    expect(summarizeReviewRecord([])).toEqual({ open: 0, settled: 0, happened: 0, avoided: 0, partial: 0 });
    expect(summarizeReviewRecord([{} as unknown as JudgmentReceipt])).toEqual({ open: 0, settled: 0, happened: 0, avoided: 0, partial: 0 });
  });
});

describe('CROSS test (08 S8): web strip and telegram markdown render the same numbers', () => {
  it('the same counts flow into both surfaces and every digit matches', () => {
    const counts = summarizeReviewRecord(receiptsFixture());

    // Telegram surface — counts shape is the cross-surface contract
    // (ReviewRecordCounts is structurally RecordCounts; this call IS the proof).
    const md = recordSummaryMarkdown(counts, 'ko');
    expect(md).toContain('봉인 중(확인 대기): **2**');
    expect(md).toContain('정산 완료: **3**');
    expect(md).toContain('적중 1');
    expect(md).toContain('빗나감 1');
    expect(md).toContain('반반 1');

    // Web strip — the review-settled digit is the SAME number
    const strip = recordStripLine(webRecord, counts, 'ko');
    expect(strip).toContain(`문서 검수 결과 확인 ${counts.settled}건`);
    expect(strip).toContain('결과 확인 완료 2건');
    expect(strip).toContain('적중한 가설 2개');

    // digit-level identity: telegram's settled digit === web's settled digit
    const tgSettled = md.match(/정산 완료: \*\*(\d+)\*\*/)?.[1];
    const webSettled = strip.match(/문서 검수 결과 확인 (\d+)건/)?.[1];
    expect(tgSettled).toBe(webSettled);

    // spine: counts only — no percentage on either surface
    expect(md).not.toMatch(/\d+\s*%/);
    expect(strip).not.toMatch(/\d+\s*%/);
  });

  it('vocabulary family matches across surfaces (08 S2-5: 적중/빗나감, not 잘됨/안됨)', () => {
    const md = recordSummaryMarkdown({ open: 0, settled: 3, happened: 2, avoided: 1, partial: 0 }, 'ko');
    expect(md).toContain('적중');
    expect(md).toContain('빗나감');
    expect(md).not.toContain('잘됨');
    expect(md).not.toContain('안됨');
  });
});

describe('recordStripLine (the shared sentence)', () => {
  it('omits zero clauses instead of zero-padding a thin record', () => {
    const thin: CrossProjectRecord = { loops: 1, betsHeld: 0, risksAvoided: 0, betsBroke: 0, risksHappened: 0, goodOutcomesOnLuck: 0 };
    const line = recordStripLine(thin, { open: 0, settled: 0, happened: 0, avoided: 0, partial: 0 }, 'ko');
    expect(line).toBe('결과 확인 완료 1건');
  });

  it('renders review-only records (the ON FILE cohort finally counts)', () => {
    const none: CrossProjectRecord = { loops: 0, betsHeld: 0, risksAvoided: 0, betsBroke: 0, risksHappened: 0, goodOutcomesOnLuck: 0 };
    const line = recordStripLine(none, { open: 1, settled: 2, happened: 2, avoided: 0, partial: 0 }, 'ko');
    expect(line).toBe('문서 검수 결과 확인 2건');
  });
});

describe('recordCompactLine (workspace header one-liner)', () => {
  it('loops → closed-loop count; sealed-only → honest forming fact; empty → null', () => {
    const rec = (loops: number): CrossProjectRecord => ({ loops, betsHeld: 0, risksAvoided: 0, betsBroke: 0, risksHappened: 0, goodOutcomesOnLuck: 0 });
    expect(recordCompactLine(rec(4), 6, 'ko')).toBe('결과 확인 완료 4건');
    expect(recordCompactLine(rec(0), 2, 'ko')).toBe('확인 대기 2건 — 확인일이 오면 결과를 이어서 기록해요');
    expect(recordCompactLine(rec(0), 0, 'ko')).toBeNull();
  });
});

describe('recordStartDate (기록 시작 각인 — a date fact, never a duration)', () => {
  it('picks the oldest across projects and receipts', () => {
    expect(
      recordStartDate(
        [{ created_at: '2026-06-01T00:00:00Z' }],
        [{ created_at: '2026-05-10T09:00:00Z' }],
      ),
    ).toBe('2026-05-10');
  });

  it('undefined when nothing carries a date', () => {
    expect(recordStartDate([], [])).toBeUndefined();
    expect(recordStartDate([{}], [{ created_at: 'not-a-date' }])).toBeUndefined();
  });
});

describe('shouldShowThirdLoop (P1-A5 gate — once, exactly at the threshold)', () => {
  it(`fires only at exactly ${SETTLED_THRESHOLD} and only when never seen`, () => {
    expect(shouldShowThirdLoop(SETTLED_THRESHOLD, false)).toBe(true);
    expect(shouldShowThirdLoop(SETTLED_THRESHOLD, true)).toBe(false); // lifetime once
    expect(shouldShowThirdLoop(SETTLED_THRESHOLD - 1, false)).toBe(false);
    // a user already past the threshold never gets a late "third loop" line
    expect(shouldShowThirdLoop(SETTLED_THRESHOLD + 2, false)).toBe(false);
  });
});
