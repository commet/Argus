/**
 * 공정 M3 exit — (opt-in 시) 터미널 전제 드리프트가 T2 게이트에 도달하는 fixture.
 *
 * The seam this pins: an MCP seal push with `tracked_premises` (sent ONLY when
 * the user set premise_sync:true) → the seal route's sanitizer → a receipt
 * premise the premise-watch cron treats as monitored+auto_watch → a MATERIAL
 * drift builds a T2 candidate the notification gate lets SEND.
 * If any hop drops the wire, this goes red instead of a silent nothing.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeTrackedPremises } from '../../app/api/mcp/seal/route';
import { buildPremiseWatchAlert } from '../../app/api/cron/premise-watch/route';
import { isMonitored } from '../premises-core';
import type { JudgmentReceipt } from '../review';
import type { InvestigationResult } from '../premise-researcher';

const NOW = '2026-07-08T09:00:00.000Z';

// Exactly what argus-mcp sends when premise_sync is on: the local PremiseState.
const MCP_WIRE_PREMISE = {
  premise_id: 'p_rate',
  ordinal: 1,
  kind: 'premise',
  text: '기준금리가 3.5% 근처에 머문다',
  external: true,
  load_bearing: true,
  source: 'user_stated',
  status: 'active',
  amend_history: [],
  recheck_count: 0,
};

describe('M3 · MCP opt-in premise reaches the T2 gate', () => {
  it('wire → sanitizer → monitored+auto_watch → material drift → T2 send', () => {
    const stored = sanitizeTrackedPremises([MCP_WIRE_PREMISE]);
    expect(stored).toBeDefined();
    const p = stored![0];
    expect(p.text).toBe('기준금리가 3.5% 근처에 머문다');
    expect(p.auto_watch).toBe(true);
    expect(isMonitored(p)).toBe(true); // premise-watch will pick it up

    // the receipt as the mcp seal route stores it (BS-1 namespaced row id)
    const receipt = {
      receipt_id: 'mcp_ab12cd34_rate-decision',
      state: 'sealed',
      source_title: '조달 시점 판단',
      core_question: '지금 조달할까?',
      falsifiable_followups: [],
      hidden_assumptions: [],
      claim_ledger: [],
      tracked_premises: [p],
    } as unknown as JudgmentReceipt;

    const result: InvestigationResult = {
      verdict: 'material',
      fact: '기준금리 4.0%로 인상',
      current_value: 4,
      source_url: 'https://bok.example/current',
      source_date: '2026-07-07',
      confidence: 'high',
      materiality: 'material',
    };

    const alert = buildPremiseWatchAlert({
      userId: 'u1', receiptId: 'mcp_ab12cd34_rate-decision', receipt, premise: p, result, checkedAt: NOW,
    });
    expect(alert.materiality).toBe('material');
    expect(alert.gate.decision).toBe('send'); // T2 standalone reaches the user
    expect(alert.email?.markdown).toContain('기준금리');
  });

  it('the sanitizer refuses junk and caps the batch (never trust the wire)', () => {
    expect(sanitizeTrackedPremises('nonsense')).toBeUndefined();
    expect(sanitizeTrackedPremises([{ no_text: true }])).toBeUndefined();
    const many = Array.from({ length: 12 }, (_, i) => ({ ...MCP_WIRE_PREMISE, premise_id: `p${i}`, text: `premise ${i} holds` }));
    expect(sanitizeTrackedPremises(many)!.length).toBe(7);
  });
});
