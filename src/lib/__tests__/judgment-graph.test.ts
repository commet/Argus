/**
 * Judgment graph — shared ground grouping, spotlight restraint, cross-links.
 *
 * The relationship rule under test is deliberately mechanical (normalized-text
 * equality, same as the MCP ledger's matchingMonitoredPremises). These tests
 * pin BOTH directions: real shared ground is found, and nothing is invented —
 * the spotlight stays null on a flat day (over-fire clause).
 */
import { describe, it, expect } from 'vitest';
import type { JudgmentReceipt } from '@/lib/review';
import type { PremiseState } from '@/lib/premises-core';
import {
  sharedGrounds,
  groundSpotlight,
  sharedGroundCount,
  receiptIsLive,
} from '@/lib/judgment-graph';

let seq = 0;
function premise(text: string, over: Partial<PremiseState> = {}): PremiseState {
  seq += 1;
  return {
    premise_id: `p_${seq}`,
    ordinal: seq,
    kind: 'premise',
    text,
    external: true,
    load_bearing: true,
    source: 'user_stated',
    status: 'active',
    amend_history: [],
    recheck_count: 0,
    ...over,
  };
}

function receipt(
  id: string,
  title: string,
  premises: PremiseState[],
  over: Partial<JudgmentReceipt> = {},
): JudgmentReceipt {
  return {
    receipt_id: id,
    root_mode: 'review',
    state: 'sealed',
    artifact_id: `a_${id}`,
    source_kind: 'pasted_text',
    source_title: title,
    source_fingerprint: `fp_${id}`,
    core_question: 'q',
    judgment_obligations: [],
    claim_ledger: [],
    hidden_assumptions: [],
    forks: [],
    findings: [],
    current_heading: '',
    falsifiable_followups: [
      {
        followup_id: `f_${id}`,
        predicate: `bet of ${id}`,
        predicate_owner: 'user',
        pass_condition: 'a',
        fail_condition: 'b',
        check_by: '2026-08-01',
        sealed_at: '2026-07-01T00:00:00Z',
      },
    ],
    companion_thread: [],
    tracked_premises: premises,
    provenance: { model: 't', lens_version: 'v', prompt_fingerprint: 'pf', reviewed_at: 'now' },
    created_at: 'now',
    updated_at: 'now',
    ...over,
  } as JudgmentReceipt;
}

const GROUND = '귀환 알림 도달률이 99% 수준을 유지한다';

describe('sharedGrounds — grouping by normalized text', () => {
  it('groups the same ground across receipts despite case/whitespace differences', () => {
    const rs = [
      receipt('r1', 'launch', [premise(`${GROUND}`)]),
      receipt('r2', 'winback', [premise(`  ${GROUND}  `)]),
      receipt('r3', 'brief', [premise(GROUND.toUpperCase())]),
    ];
    const gs = sharedGrounds(rs);
    expect(gs).toHaveLength(1);
    expect(gs[0].members).toHaveLength(3);
    expect(gs[0].live_bets.map((b) => b.receipt_id).sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('a ground under only ONE receipt is not a shared ground', () => {
    const rs = [
      receipt('r1', 'launch', [premise('금리가 3.5% 근처에 머문다')]),
      receipt('r2', 'winback', [premise('완전히 다른 전제')]),
    ];
    expect(sharedGrounds(rs)).toHaveLength(0);
  });

  it('unmonitored premises (retired / internal / not load-bearing / open_question) never form ground', () => {
    const rs = [
      receipt('r1', 'a', [premise(GROUND, { status: 'retired' })]),
      receipt('r2', 'b', [premise(GROUND, { external: false })]),
      receipt('r3', 'c', [premise(GROUND, { load_bearing: false })]),
      receipt('r4', 'd', [premise(GROUND, { kind: 'open_question' })]),
    ];
    expect(sharedGrounds(rs)).toHaveLength(0);
  });

  it('settled receipts contribute membership but no live bets', () => {
    const settled = receipt('r1', 'done', [premise(GROUND)], {
      state: 'settled',
      falsifiable_followups: [
        {
          followup_id: 'f_r1',
          predicate: 'old bet',
          predicate_owner: 'user',
          pass_condition: 'a',
          fail_condition: 'b',
          check_by: '2026-06-01',
          sealed_at: '2026-05-01T00:00:00Z',
          settled_at: '2026-06-02T00:00:00Z',
          outcome: 'happened',
        },
      ],
    });
    const live = receipt('r2', 'live', [premise(GROUND)]);
    const gs = sharedGrounds([settled, live]);
    expect(gs).toHaveLength(1);
    expect(gs[0].members).toHaveLength(2);
    expect(gs[0].live_bets.map((b) => b.receipt_id)).toEqual(['r2']);
  });

  it('live bets are sorted by check_by ascending', () => {
    const r1 = receipt('r1', 'later', [premise(GROUND)]);
    r1.falsifiable_followups[0].check_by = '2026-09-01';
    const r2 = receipt('r2', 'sooner', [premise(GROUND)]);
    r2.falsifiable_followups[0].check_by = '2026-07-20';
    const gs = sharedGrounds([r1, r2]);
    expect(gs[0].live_bets.map((b) => b.receipt_id)).toEqual(['r2', 'r1']);
  });
});

describe('sharedGrounds — neutral revisit inventory', () => {
  type Outcome = 'happened' | 'avoided' | 'partial' | 'missed' | 'unclear';
  function settledFollowup(id: string, outcome: Outcome) {
    return {
      followup_id: id,
      predicate: `bet ${id}`,
      predicate_owner: 'user' as const,
      pass_condition: 'a',
      fail_condition: 'b',
      check_by: '2026-06-01',
      sealed_at: '2026-05-01T00:00:00Z',
      settled_at: '2026-06-02T00:00:00Z',
      outcome,
    };
  }

  it('counts revisits without outcome buckets across member receipts', () => {
    const r1 = receipt('r1', 'a', [premise(GROUND)], {
      state: 'settled',
      falsifiable_followups: [settledFollowup('f1', 'happened'), settledFollowup('f2', 'missed')],
    });
    const r2 = receipt('r2', 'b', [premise(GROUND)], {
      state: 'settled',
      falsifiable_followups: [settledFollowup('f3', 'avoided'), settledFollowup('f4', 'partial')],
    });
    const gs = sharedGrounds([r1, r2]);
    expect(gs).toHaveLength(1);
    expect(gs[0].record).toEqual({ revisited: 4 });
    expect(gs[0].record).not.toHaveProperty('held');
    expect(gs[0].record).not.toHaveProperty('broke');
  });

  it('excludes unclear and still-open bets — an honest gap, never a fabricated 0-of-0', () => {
    const r1 = receipt('r1', 'a', [premise(GROUND)], {
      falsifiable_followups: [
        settledFollowup('f1', 'unclear'),
        {
          followup_id: 'f2',
          predicate: 'still open',
          predicate_owner: 'user' as const,
          pass_condition: 'a',
          fail_condition: 'b',
          check_by: '2026-09-01',
          sealed_at: '2026-07-01T00:00:00Z',
        },
      ],
    });
    const r2 = receipt('r2', 'b', [premise(GROUND)]); // default open followup
    const gs = sharedGrounds([r1, r2]);
    expect(gs).toHaveLength(1);
    expect(gs[0].record).toBeUndefined();
  });
});

describe('groundSpotlight — fires on a real event, silent on a flat day', () => {
  const drifted = premise(GROUND, {
    last_recheck: {
      finding: '도달률 67%',
      numeric_value: 67,
      baseline_finding: '도달률 99%',
      baseline_numeric_value: 99,
      drifted: true,
      baseline_only: false,
      source: 'url',
      source_detail: 'https://logs.example (2026-07-18)',
      ts: '2026-07-18T00:00:00Z',
    },
  });

  it('drifted shared ground with live bets → spotlight with baseline/current', () => {
    const s = groundSpotlight([
      receipt('r1', 'launch', [drifted]),
      receipt('r2', 'winback', [premise(GROUND)]),
    ]);
    expect(s).not.toBeNull();
    expect(s!.drift!.baseline_numeric).toBe(99);
    expect(s!.drift!.current_numeric).toBe(67);
    expect(s!.live_bets.length).toBe(2);
  });

  it('shared ground WITHOUT drift → null (no manufactured highlight)', () => {
    const s = groundSpotlight([
      receipt('r1', 'a', [premise(GROUND)]),
      receipt('r2', 'b', [premise(GROUND)]),
    ]);
    expect(s).toBeNull();
  });

  it('drift on a NON-shared ground → null (single-receipt drift belongs to PremiseTracker)', () => {
    const s = groundSpotlight([
      receipt('r1', 'a', [drifted]),
      receipt('r2', 'b', [premise('무관한 전제')]),
    ]);
    expect(s).toBeNull();
  });

  it('empty / premise-less receipts → null, no throw', () => {
    expect(groundSpotlight([])).toBeNull();
    expect(groundSpotlight([receipt('r1', 'a', [])])).toBeNull();
  });
});

describe('sharedGroundCount — the quiet cross-link count', () => {
  it('counts OTHER receipts carrying the same ground', () => {
    const rs = [
      receipt('r1', 'a', [premise(GROUND)]),
      receipt('r2', 'b', [premise(GROUND)]),
      receipt('r3', 'c', [premise(GROUND)]),
    ];
    expect(sharedGroundCount(rs, 'r1', GROUND)).toBe(2);
    expect(sharedGroundCount(rs, 'r1', '다른 문장')).toBe(0);
  });
});

describe('receiptIsLive — mirrors the armed rule', () => {
  it('sealed state OR a sealed-unsettled followup arms; settled with no open followups does not', () => {
    const live = receipt('r1', 'a', []);
    expect(receiptIsLive(live)).toBe(true);
    const closed = receipt('r2', 'b', [], {
      state: 'settled',
      falsifiable_followups: [],
    });
    expect(receiptIsLive(closed)).toBe(false);
  });
});
