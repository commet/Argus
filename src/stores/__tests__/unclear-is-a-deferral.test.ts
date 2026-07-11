import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pure store test — stub the Supabase sync layer.
vi.mock('@/lib/review-sync', () => ({
  loadReceiptsMerged: vi.fn((local: unknown) => Promise.resolve(local)),
  pushReceipt: vi.fn(),
  deleteReceiptRemote: vi.fn(),
}));

import { useReviewStore } from '../useReviewStore';
import { summarizeReceipt, type JudgmentReceipt } from '@/lib/review';

/**
 * "아직 불분명 (Still unclear)" means reality has not answered. It is a DEFERRAL.
 *
 * It used to be a settlement chip: picking it stamped settled_at, flipped the
 * receipt to the terminal `settled` state, and dropped the decision out of the
 * dashboard due list, the due badge, and the Companion Brief email — closing
 * forever a question reality never answered, while the receipt claimed "what
 * happened". The correct path (reviseFollowup) existed the whole time, wired to
 * a different button.
 */

const CHECK_BY = '2026-07-01';
const TODAY = '2026-07-02';

function receipt(): JudgmentReceipt {
  return {
    receipt_id: 'r1',
    kind: 'judgment',
    root_mode: 'judgment',
    state: 'sealed',
    artifact_id: 'a1',
    source_kind: 'mcp_file',
    source_title: 'paywall bet',
    core_question: 'does the paywall lift conversion?',
    falsifiable_followups: [{
      followup_id: 'f1',
      predicate: 'the hard paywall lifts conversion above 6%',
      predicate_owner: 'user',
      pass_condition: '>6%',
      fail_condition: '<=6%',
      check_by: CHECK_BY,
      sealed_at: '2026-06-01T00:00:00.000Z',
    }],
  } as unknown as JudgmentReceipt;
}

beforeEach(() => useReviewStore.setState({ receipts: [receipt()] }));

describe('"still unclear" defers — it never settles', () => {
  it('keeps the receipt alive and still due, and records why', () => {
    useReviewStore.getState().reviseFollowup('r1', 'f1', '2026-08-01', 'the trial data lands in August');

    const r = useReviewStore.getState().receipts[0];
    const f = r.falsifiable_followups[0];

    expect(f.settled_at).toBeUndefined();   // nothing was settled
    expect(f.outcome).toBeUndefined();      // reality gave no outcome
    expect(r.state).toBe('sealed');         // NOT terminal
    expect(f.check_by).toBe('2026-08-01');  // re-armed
    expect(f.first_check_by).toBe(CHECK_BY); // the original date is kept as a fact
    expect(f.revise_count).toBe(1);
    expect(f.defer_reason).toBe('the trial data lands in August');

    // and it is still on the books: the cron/dashboard still see a check-by
    expect(summarizeReceipt(r, TODAY).next_check_by).toBe('2026-08-01');
  });

  it('remembers the ORIGINAL date across repeated deferrals', () => {
    const s = useReviewStore.getState();
    s.reviseFollowup('r1', 'f1', '2026-08-01', 'not yet');
    useReviewStore.getState().reviseFollowup('r1', 'f1', '2026-09-01', 'still not yet');

    const f = useReviewStore.getState().receipts[0].falsifiable_followups[0];
    expect(f.first_check_by).toBe(CHECK_BY); // set once, never overwritten
    expect(f.revise_count).toBe(2);
  });

  it('a real outcome still settles (the deferral fix did not break settling)', () => {
    useReviewStore.getState().settleFollowup('r1', 'f1', 'happened', 'conversion hit 7.1%');
    const r = useReviewStore.getState().receipts[0];
    expect(r.state).toBe('settled');
    expect(r.falsifiable_followups[0].settled_at).toBeTruthy();
    expect(summarizeReceipt(r, TODAY).next_check_by).toBeFalsy(); // correctly off the due list
  });

  // NOTE: the "unclear can never be settled" guard is NOT here. tsconfig.json
  // excludes **/*.test.ts and **/__tests__/**, so a @ts-expect-error inside a test
  // file in this repo is never evaluated by anything — it reads like a guard and
  // enforces nothing. The real, typechecked guard is `_UnclearIsNeverSettleable`
  // in src/lib/review/schema.ts, which fails the build if the type ever widens.
});
