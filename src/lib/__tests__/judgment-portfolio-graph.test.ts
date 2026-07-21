/**
 * Portfolio graph — bipartite premise⇄decision map over the whole account.
 * Pins the founder's redesign: EVERY premise is a node (degree-1 leaves too,
 * not only shared hubs), decisions are nodes, rests-on edges connect them,
 * drift rides the edge as `hot`. Reuses sharedGrounds(minMembers:1).
 */
import { describe, it, expect } from 'vitest';
import type { JudgmentReceipt } from '@/lib/review';
import type { PremiseState } from '@/lib/premises-core';
import { judgmentPortfolioGraph } from '@/lib/judgment-portfolio-graph';

let seq = 0;
function premise(text: string, over: Partial<PremiseState> = {}): PremiseState {
  seq += 1;
  return {
    premise_id: `p_${seq}`, ordinal: seq, kind: 'premise', text, external: true,
    load_bearing: true, source: 'user_stated', status: 'active', amend_history: [], recheck_count: 0, ...over,
  };
}
function receipt(id: string, title: string, premises: PremiseState[], over: Partial<JudgmentReceipt> = {}): JudgmentReceipt {
  return {
    receipt_id: id, root_mode: 'review', state: 'sealed', artifact_id: `a_${id}`, source_kind: 'pasted_text',
    source_title: title, source_fingerprint: `fp_${id}`, core_question: 'q', judgment_obligations: [],
    claim_ledger: [], hidden_assumptions: [], forks: [], findings: [], current_heading: '',
    falsifiable_followups: [{ followup_id: `f_${id}`, predicate: `bet ${id}`, predicate_owner: 'user', pass_condition: 'a', fail_condition: 'b', check_by: '2026-08-01', sealed_at: '2026-07-01T00:00:00Z' }],
    companion_thread: [], tracked_premises: premises,
    provenance: { model: 't', lens_version: 'v', prompt_fingerprint: 'pf', reviewed_at: 'now' },
    created_at: 'now', updated_at: 'now', ...over,
  } as JudgmentReceipt;
}

const SHARED = '귀환 알림 도달률이 99% 수준을 유지한다';
const drifted = (): PremiseState => premise(SHARED, {
  last_recheck: { finding: '67%', numeric_value: 67, baseline_finding: '99%', baseline_numeric_value: 99, drifted: true, baseline_only: false, source: 'url', source_detail: 'x', ts: '2026-07-18T00:00:00Z' },
});

describe('judgmentPortfolioGraph — the browsable bipartite map', () => {
  it('every premise is a node — degree-1 leaves included, not only shared hubs', () => {
    const g = judgmentPortfolioGraph([
      receipt('r1', '런치', [drifted(), premise('r1 전용 전제 A')]),
      receipt('r2', '윈백', [premise(SHARED), premise('r2 전용 전제 B')]),
    ]);
    const keys = g.premises.map((p) => p.text).sort();
    expect(keys).toEqual(['r1 전용 전제 A', 'r2 전용 전제 B', SHARED].sort());
    const hub = g.premises.find((p) => p.text === SHARED)!;
    const leaf = g.premises.find((p) => p.text === 'r1 전용 전제 A')!;
    expect(hub.degree).toBe(2); // shared → hub
    expect(leaf.degree).toBe(1); // leaf is still on the map
  });

  it('decisions are nodes and rests-on edges connect each decision to its premises', () => {
    const g = judgmentPortfolioGraph([
      receipt('r1', '런치', [premise(SHARED), premise('A')]),
      receipt('r2', '윈백', [premise(SHARED)]),
    ]);
    expect(g.decisions.map((d) => d.receiptId).sort()).toEqual(['r1', 'r2']);
    expect(g.decisions.find((d) => d.receiptId === 'r1')!.title).toBe('런치');
    // r1 → {SHARED, A}, r2 → {SHARED} = 3 edges
    expect(g.edges).toHaveLength(3);
    const r1Prem = g.edges.filter((e) => e.decision === 'decision:r1').map((e) => e.premise);
    expect(r1Prem).toHaveLength(2);
  });

  it('drift rides the edges of the drifted premise (hot), not others', () => {
    const g = judgmentPortfolioGraph([
      receipt('r1', 'a', [drifted()]),
      receipt('r2', 'b', [premise(SHARED), premise('무관 전제')]),
    ]);
    const hub = g.premises.find((p) => p.text === SHARED)!;
    expect(hub.drift).toBeDefined();
    const hubEdges = g.edges.filter((e) => e.premise === hub.id);
    expect(hubEdges.every((e) => e.hot)).toBe(true);
    const coldEdge = g.edges.find((e) => e.premise === 'premise:' + '무관 전제'.toLowerCase().replace(/\s+/g, ' '));
    // the unrelated premise's edge is not hot
    const unrelated = g.premises.find((p) => p.text === '무관 전제')!;
    expect(g.edges.filter((e) => e.premise === unrelated.id).every((e) => e.hot)).toBe(false);
    void coldEdge;
  });

  it('empty input → empty graph, no throw', () => {
    const g = judgmentPortfolioGraph([]);
    expect(g.premises).toHaveLength(0);
    expect(g.decisions).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
  });
});
