import { describe, it, expect } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal } from '../../tools/seal.js';
import { premises } from '../../tools/premises.js';
import { recall } from '../../tools/recall.js';
import { recheck } from '../../tools/recheck.js';
import {
  defaultRecheckCadenceDays, recheckCadenceDays, nextRecheckDue, isDueForRecheck,
  type PremiseState,
} from '../premises.js';

const TODAY = '2026-07-02';

function mkPremise(over: Partial<PremiseState> = {}): PremiseState {
  return {
    premise_id: 'p_x', ordinal: 1, kind: 'premise', text: 'base rate stays at 3.5 percent',
    external: true, load_bearing: true, source: 'ai', status: 'active',
    amend_history: [], recheck_count: 0, ...over,
  };
}

describe('recheck cadence formalization (M1 §1.2)', () => {
  it('derives a default cadence from the materiality-rule type', () => {
    expect(defaultRecheckCadenceDays({ type: 'threshold' })).toBe(7);  // moving number
    expect(defaultRecheckCadenceDays({ type: 'relative' })).toBe(7);
    expect(defaultRecheckCadenceDays({ type: 'step' })).toBe(30);      // slow state
    expect(defaultRecheckCadenceDays({ type: 'map' })).toBe(30);
    expect(defaultRecheckCadenceDays(undefined)).toBe(14);             // neutral middle
  });

  it('a pinned recheck_cadence_days wins over the derived default, clamped to the floor', () => {
    expect(recheckCadenceDays(mkPremise({ recheck_cadence_days: 60 }))).toBe(60);
    expect(recheckCadenceDays(mkPremise({ recheck_cadence_days: 3 }))).toBe(7); // floored
    expect(recheckCadenceDays(mkPremise({ materiality_rule: { type: 'step', params: {} } }))).toBe(30);
    expect(recheckCadenceDays(mkPremise())).toBe(14); // no rule, no pin
  });

  it('isDueForRecheck honors the cadence, not a fixed 7 days', () => {
    // last checked 20 days ago; a 30-day cadence is NOT yet due, a 14-day one IS
    const p30 = mkPremise({ recheck_cadence_days: 30, last_recheck: { finding: 'x', drifted: false, baseline_only: true, source: 'url', ts: '2026-06-12T00:00:00Z' } });
    const p14 = mkPremise({ recheck_cadence_days: 14, last_recheck: { finding: 'x', drifted: false, baseline_only: true, source: 'url', ts: '2026-06-12T00:00:00Z' } });
    expect(isDueForRecheck(p30, TODAY)).toBe(false);
    expect(isDueForRecheck(p14, TODAY)).toBe(true);
  });

  it('nextRecheckDue is last_check + cadence; null when never checked or unmonitored', () => {
    expect(nextRecheckDue(mkPremise())).toBeNull(); // monitored but never checked = due now
    const checked = mkPremise({ recheck_cadence_days: 14, last_recheck: { finding: 'x', drifted: false, baseline_only: true, source: 'url', ts: '2026-06-20T00:00:00Z' } });
    expect(nextRecheckDue(checked)).toBe('2026-07-04'); // 2026-06-20 + 14d
    expect(nextRecheckDue(mkPremise({ external: false }))).toBeNull(); // unmonitored
  });

  it('end-to-end: add with a pinned cadence, recall exposes it, recheck baseline uses it', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'd1', predicate: 'we ship under five minutes downtime', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY });
    await premises.handler({
      argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY,
      premises: [{ text: 'base rate stays at 3.5 percent', kind: 'premise', external: true, load_bearing: true, source: 'ai', ai_original: 'base rate stays at 3.5 percent', recheck_cadence_days: 21 }],
    });

    const rec = body(await recall.handler({ argus_dir: dir, view: 'premises', id: 'd1', today_override: TODAY }));
    const rows = (rec['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(rows[0]['recheck_cadence_days']).toBe(21);

    // baseline surface quotes the pinned cadence, not a hardcoded "7 days"
    const base = body(await recheck.handler({ argus_dir: dir, id: 'd1', ref: 'P1', finding: 'base rate 3.5 percent', numeric_value: 3.5, source: 'url', today_override: TODAY }));
    expect(String(base['surface'])).toContain('21 days');
  });

  it('amend can re-set the cadence', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'd2', predicate: 'we ship under five minutes downtime', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY });
    await premises.handler({
      argus_dir: dir, id: 'd2', op: 'add', today_override: TODAY,
      premises: [{ text: 'base rate stays at 3.5 percent', kind: 'premise', external: true, load_bearing: true, source: 'user' }],
    });
    await premises.handler({ argus_dir: dir, id: 'd2', op: 'amend', ref: 'P1', action: 'accept', recheck_cadence_days: 45, today_override: TODAY });

    const rec = body(await recall.handler({ argus_dir: dir, view: 'premises', id: 'd2', today_override: TODAY }));
    const rows = (rec['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(rows[0]['recheck_cadence_days']).toBe(45);
  });
});
