import { describe, it, expect } from 'vitest';
import { summarizeReceipt, sortByUrgency, daysBetween } from '../status';
import type { JudgmentReceipt, FalsifiableFollowup } from '../schema';

function followup(over: Partial<FalsifiableFollowup>): FalsifiableFollowup {
  return {
    followup_id: over.followup_id ?? 'fu_1',
    predicate: 'p',
    predicate_owner: 'ai_surfaced',
    pass_condition: '',
    fail_condition: '',
    check_by: '2026-08-01',
    ...over,
  };
}

function receipt(over: Partial<JudgmentReceipt>): JudgmentReceipt {
  return {
    receipt_id: over.receipt_id ?? 'r1',
    root_mode: 'review',
    state: 'reviewed',
    artifact_id: 'a',
    source_kind: 'paste',
    source_title: 't',
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
    falsifiable_followups: [],
    companion_thread: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provenance: {} as any,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

describe('daysBetween', () => {
  it('counts whole days and signs overdue negative', () => {
    expect(daysBetween('2026-07-01', '2026-07-08')).toBe(7);
    expect(daysBetween('2026-07-10', '2026-07-08')).toBe(-2);
  });
});

describe('summarizeReceipt', () => {
  it('a reviewed receipt with no follow-ups stays reviewed', () => {
    const s = summarizeReceipt(receipt({}), '2026-07-01');
    expect(s.derived).toBe('reviewed');
    expect(s.urgent).toBe(false);
  });

  it('a sealed future prediction shows days-until, not due', () => {
    const r = receipt({
      state: 'sealed',
      falsifiable_followups: [followup({ sealed_at: '2026-07-01T00:00:00Z', check_by: '2026-07-15' })],
    });
    const s = summarizeReceipt(r, '2026-07-01');
    expect(s.derived).toBe('sealed');
    expect(s.days_until).toBe(14);
    expect(s.urgent).toBe(false);
  });

  it('a sealed prediction whose date has passed is due + urgent', () => {
    const r = receipt({
      state: 'sealed',
      falsifiable_followups: [followup({ sealed_at: '2026-07-01T00:00:00Z', check_by: '2026-06-28' })],
    });
    const s = summarizeReceipt(r, '2026-07-01');
    expect(s.derived).toBe('due');
    expect(s.urgent).toBe(true);
    expect(s.label).toContain('지남');
  });

  it('all sealed follow-ups settled → settled', () => {
    const r = receipt({
      state: 'settled',
      falsifiable_followups: [
        followup({ sealed_at: '2026-07-01T00:00:00Z', settled_at: '2026-07-20T00:00:00Z', outcome: 'happened' }),
      ],
    });
    const s = summarizeReceipt(r, '2026-07-21');
    expect(s.derived).toBe('settled');
  });
});

describe('sortByUrgency', () => {
  it('puts due first, settled last', () => {
    const due = receipt({
      receipt_id: 'due',
      state: 'sealed',
      falsifiable_followups: [followup({ sealed_at: '2026-07-01T00:00:00Z', check_by: '2026-06-20' })],
    });
    const settled = receipt({
      receipt_id: 'settled',
      state: 'settled',
      falsifiable_followups: [followup({ sealed_at: '2026-07-01T00:00:00Z', settled_at: '2026-07-02T00:00:00Z', outcome: 'happened' })],
    });
    const reviewed = receipt({ receipt_id: 'reviewed' });
    const order = sortByUrgency([settled, reviewed, due], '2026-07-01').map((r) => r.receipt_id);
    expect(order[0]).toBe('due');
    expect(order[order.length - 1]).toBe('settled');
  });
});
