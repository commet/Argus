import { describe, it, expect, vi } from 'vitest';

// Stub db so importing review-sync doesn't require the supabase client.
vi.mock('@/lib/db', () => ({
  fetchFromSupabase: vi.fn(() => Promise.resolve([])),
  upsertToSupabase: vi.fn(),
  softDeleteFromSupabase: vi.fn(),
}));

import { toReceiptRow } from '../review-sync';
import type { JudgmentReceipt, FalsifiableFollowup } from '../review';

function receipt(followups: FalsifiableFollowup[], over: Partial<JudgmentReceipt> = {}): JudgmentReceipt {
  return {
    receipt_id: 'rcp_1',
    root_mode: 'review',
    state: 'sealed',
    artifact_id: 'a',
    source_kind: 'paste',
    source_title: '전략 메모',
    source_fingerprint: 'fp',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profile: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reviewability: {} as any,
    routing: { selected: [], skipped: [], disclosure: '' },
    core_question: 'q',
    judgment_obligations: [],
    claim_ledger: [],
    hidden_assumptions: [],
    forks: [],
    findings: [],
    current_heading: '',
    falsifiable_followups: followups,
    companion_thread: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provenance: {} as any,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

const fu = (over: Partial<FalsifiableFollowup>): FalsifiableFollowup => ({
  followup_id: 'fu', predicate: 'p', predicate_owner: 'user',
  pass_condition: '', fail_condition: '', check_by: '2026-08-01', ...over,
});

describe('toReceiptRow', () => {
  it('lifts the soonest open sealed check date to next_check_by (for the cron)', () => {
    const r = receipt([
      fu({ followup_id: 'a', sealed_at: '2026-07-01T00:00:00Z', check_by: '2026-09-01' }),
      fu({ followup_id: 'b', sealed_at: '2026-07-01T00:00:00Z', check_by: '2026-08-15' }),
    ]);
    const row = toReceiptRow(r);
    expect(row.id).toBe('rcp_1');
    expect(row.next_check_by).toBe('2026-08-15');
    expect(row.data.receipt_id).toBe('rcp_1'); // whole receipt in jsonb blob
  });

  it('next_check_by is null when nothing is sealed', () => {
    const row = toReceiptRow(receipt([fu({})], { state: 'reviewed' }));
    expect(row.next_check_by).toBeNull();
  });

  it('a settled follow-up no longer counts as open', () => {
    const row = toReceiptRow(
      receipt([fu({ sealed_at: '2026-07-01T00:00:00Z', settled_at: '2026-07-20T00:00:00Z', outcome: 'happened' })], {
        state: 'settled',
      }),
    );
    expect(row.next_check_by).toBeNull();
  });

  it('persists missed as missed in the review_receipts jsonb row', () => {
    const row = toReceiptRow(
      receipt([fu({
        sealed_at: '2026-07-01T00:00:00Z',
        settled_at: '2026-07-20T00:00:00Z',
        outcome: 'missed',
        what_happened: 'The read was wrong.',
      })], {
        state: 'settled',
      }),
    );

    expect(row.state).toBe('settled');
    expect(row.next_check_by).toBeNull();
    expect(row.data.falsifiable_followups[0].outcome).toBe('missed');
  });
});
