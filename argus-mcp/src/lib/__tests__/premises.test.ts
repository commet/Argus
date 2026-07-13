import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { tmpArgusDir } from '../../test-helpers.js';
import { replayLedger } from '../ledger-replay.js';
import { guardTransition, GuardError, deriveState } from '../state-machine.js';
import {
  premiseId, normalizePremiseText, resolvePremiseRef, isMonitored,
  isDueForRecheck, duePremises, groupDuePremises, matchingMonitoredPremises,
  type PremiseState,
} from '../premises.js';
import { numericDrift } from '../numeric-drift.js';

const TODAY = '2026-07-02';

function writeLedger(dir: string, events: Array<Record<string, unknown>>): void {
  fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'ledger', 'ledger.jsonl'),
    events.map((e) => JSON.stringify({ v: 1, ts: '2026-06-01T00:00:00Z', ...e })).join('\n') + '\n',
  );
}

const sealEvents = (id: string, checkBy = '2099-01-01') => [
  { id, event: 'harvest', decision: `${id} decision text` },
  { id, event: 'seal', predicate: `${id} ships on time`, check_by: checkBy },
];

const addPremise = (id: string, text: string, over: Record<string, unknown> = {}) => ({
  id, event: 'premise_add',
  premise_id: premiseId(id, 'premise', text), ordinal: 1, kind: 'premise',
  text, external: true, load_bearing: true, source: 'ai', ai_original: text,
  ...over,
});

function mkPremise(over: Partial<PremiseState> = {}): PremiseState {
  return {
    premise_id: 'p_x', ordinal: 1, kind: 'premise', text: 'rates stay flat',
    external: true, load_bearing: true, source: 'ai', status: 'active',
    amend_history: [], recheck_count: 0, ...over,
  };
}

// ── identity ──

describe('premiseId / normalize', () => {
  it('is stable across whitespace/case and scoped by decision', () => {
    expect(premiseId('d1', 'premise', ' Rates  Stay FLAT ')).toBe(premiseId('d1', 'premise', 'rates stay flat'));
    expect(premiseId('d1', 'premise', 'x')).not.toBe(premiseId('d2', 'premise', 'x'));
    expect(normalizePremiseText('  A  B ')).toBe('a b');
  });
});

// ── state machine matrix (plan v5 §6.2) ──

describe('premise state-machine matrix', () => {
  it('refuses premise events on an absent decision (no self-create)', () => {
    expect(() => guardTransition('absent', 'premise_add')).toThrowError(/not allowed/);
    try { guardTransition('absent', 'premise_add'); } catch (e) {
      expect((e as GuardError).recovery).toContain('argus_capture');
    }
  });
  it('allows add/amend/recheck/resolve on opened and sealed', () => {
    for (const s of ['opened', 'sealed'] as const) {
      for (const ev of ['premise_add', 'premise_amend', 'premise_recheck', 'premise_resolve'] as const) {
        expect(() => guardTransition(s, ev)).not.toThrow();
      }
    }
  });
  it('locks add/amend once due (PREMISE_LOCKED), keeps recheck/resolve open', () => {
    for (const ev of ['premise_add', 'premise_amend'] as const) {
      try { guardTransition('due', ev); expect.unreachable(); } catch (e) {
        expect((e as GuardError).code).toBe('PREMISE_LOCKED');
      }
    }
    expect(() => guardTransition('due', 'premise_recheck')).not.toThrow();
    expect(() => guardTransition('due', 'premise_resolve')).not.toThrow();
  });
  it('refuses everything on settled/dismissed (DECISION_CLOSED)', () => {
    for (const s of ['settled', 'dismissed'] as const) {
      for (const ev of ['premise_add', 'premise_amend', 'premise_recheck', 'premise_resolve'] as const) {
        try { guardTransition(s, ev); expect.unreachable(); } catch (e) {
          expect((e as GuardError).code).toBe('DECISION_CLOSED');
        }
      }
    }
  });
});

// ── fold ──

describe('premise fold', () => {
  it('folds add → amend → recheck → resolve with provenance preserved', () => {
    const dir = tmpArgusDir();
    const pid = premiseId('d1', 'premise', 'rates stay flat');
    const qid = premiseId('d1', 'open_question', 'rent out or live in');
    writeLedger(dir, [
      ...sealEvents('d1'),
      addPremise('d1', 'rates stay flat'),
      { id: 'd1', event: 'premise_add', premise_id: qid, ordinal: 2, kind: 'open_question', text: 'rent out or live in', source: 'user' },
      { id: 'd1', event: 'premise_amend', premise_id: pid, action: 'refine', from: 'rates stay flat', to: 'rates stay flat through 2026' },
      { id: 'd1', event: 'premise_recheck', premise_id: pid, finding: 'base rate 3.5%', numeric_value: 3.5, drifted: false, baseline_only: true, source: 'url', source_detail: 'https://bok.example' },
      { id: 'd1', event: 'premise_resolve', premise_id: qid, decision: 'live in it myself' },
    ]);
    const s = replayLedger(dir, TODAY);
    const prems = s.contracts.get('d1')!.premises!;
    expect(prems).toHaveLength(2);

    const p = prems.find((x) => x.premise_id === pid)!;
    expect(p.text).toBe('rates stay flat through 2026'); // amended
    expect(p.ai_original).toBe('rates stay flat');       // provenance preserved
    expect(p.amend_history).toHaveLength(1);
    expect(p.last_recheck?.numeric_value).toBe(3.5);
    expect(p.last_recheck?.baseline_only).toBe(true);
    expect(p.recheck_count).toBe(1);

    const q = prems.find((x) => x.premise_id === qid)!;
    expect(q.status).toBe('resolved');
    expect(q.resolved_decision).toBe('live in it myself');
    expect(s.integrity.dropped_lines).toBe(0);
  });

  it('re-add of the same premise id is idempotent; retire keeps it on the record', () => {
    const dir = tmpArgusDir();
    const pid = premiseId('d1', 'premise', 'x');
    writeLedger(dir, [
      ...sealEvents('d1'),
      addPremise('d1', 'x', { premise_id: pid }),
      addPremise('d1', 'x', { premise_id: pid }), // dup
      { id: 'd1', event: 'premise_amend', premise_id: pid, action: 'retire' },
    ]);
    const prems = replayLedger(dir, TODAY).contracts.get('d1')!.premises!;
    expect(prems).toHaveLength(1);
    expect(prems[0].status).toBe('retired');
    expect(prems[0].ordinal).toBe(1); // permanent ordinal, never renumbered
  });

  it('flag corrections via amend re-derive monitoring', () => {
    const dir = tmpArgusDir();
    const pid = premiseId('d1', 'premise', 'y');
    writeLedger(dir, [
      ...sealEvents('d1'),
      addPremise('d1', 'y', { premise_id: pid, external: false, load_bearing: false }),
      { id: 'd1', event: 'premise_amend', premise_id: pid, action: 'accept', external: true, load_bearing: true },
    ]);
    const p = replayLedger(dir, TODAY).contracts.get('d1')!.premises![0];
    expect(isMonitored(p)).toBe(true);
  });
});

// ── refs ──

describe('resolvePremiseRef', () => {
  const list = [mkPremise({ premise_id: 'p_abc123', ordinal: 1 }), mkPremise({ premise_id: 'p_def456', ordinal: 2, text: 'supply stays high' })];
  it('resolves ordinals (P2 / p2 / 2), full ids, and unambiguous prefixes', () => {
    expect(resolvePremiseRef(list, 'P2').premise_id).toBe('p_def456');
    expect(resolvePremiseRef(list, '1').premise_id).toBe('p_abc123');
    expect(resolvePremiseRef(list, 'p_def456').premise_id).toBe('p_def456');
    expect(resolvePremiseRef(list, 'p_ab').premise_id).toBe('p_abc123');
  });
  it('throws NO_SUCH_PREMISE / AMBIGUOUS_REF with a listing in recovery', () => {
    try { resolvePremiseRef(list, 'P9'); expect.unreachable(); } catch (e) {
      expect((e as GuardError).code).toBe('NO_SUCH_PREMISE');
      expect((e as GuardError).recovery).toContain('P1=');
    }
    const twins = [mkPremise({ premise_id: 'p_aa1', ordinal: 1 }), mkPremise({ premise_id: 'p_aa2', ordinal: 2 })];
    try { resolvePremiseRef(twins, 'p_aa'); expect.unreachable(); } catch (e) {
      expect((e as GuardError).code).toBe('AMBIGUOUS_REF');
    }
  });
});

// ── due-ness (P4: sealing arms monitoring) ──

describe('due premises', () => {
  it('never-checked monitored premise on a sealed decision is due; opened is not', () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [
      ...sealEvents('sealed1'),
      addPremise('sealed1', 'rates stay flat'),
      { id: 'open1', event: 'harvest', decision: 'not yet sealed' },
      addPremise('open1', 'rates stay flat', { premise_id: premiseId('open1', 'premise', 'rates stay flat') }),
    ]);
    const due = duePremises(replayLedger(dir, TODAY));
    expect(due.map((d) => d.decision_id)).toEqual(['sealed1']); // opened not nagged (P4)
    expect(due[0].days_stale).toBeNull();
    expect(due[0].decision_text.length).toBeGreaterThan(0); // decision context rides along
  });

  it('cadence gates due-ness: recent recheck → not due; past the cadence → due again', () => {
    // Rule-less default cadence is 14 days (M1 §1.2). 2 days ago = not due;
    // 20 days ago (> 14) = due again.
    const recent = mkPremise({ last_recheck: { finding: 'x', drifted: false, baseline_only: true, source: 'url', ts: '2026-06-30T00:00:00Z' }, recheck_count: 1 });
    const stale = mkPremise({ last_recheck: { finding: 'x', drifted: false, baseline_only: true, source: 'url', ts: '2026-06-12T00:00:00Z' }, recheck_count: 1 });
    expect(isDueForRecheck(recent, TODAY)).toBe(false);
    expect(isDueForRecheck(stale, TODAY)).toBe(true);
    // a pinned short cadence brings the recent one due again (user control)
    const recentTight = mkPremise({ recheck_cadence_days: 7, last_recheck: { finding: 'x', drifted: false, baseline_only: true, source: 'url', ts: '2026-06-20T00:00:00Z' }, recheck_count: 1 });
    expect(isDueForRecheck(recentTight, TODAY)).toBe(true); // 12d > 7d cadence
  });

  it('groups due premises across decisions by normalized text (P1)', () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [
      ...sealEvents('d1'), addPremise('d1', 'Rates stay FLAT'),
      ...sealEvents('d2'), addPremise('d2', 'rates stay flat', { premise_id: premiseId('d2', 'premise', 'rates stay flat') }),
    ]);
    const state = replayLedger(dir, TODAY);
    const groups = groupDuePremises(duePremises(state));
    expect(groups).toHaveLength(1);
    expect(groups[0].premises).toHaveLength(2);

    const matches = matchingMonitoredPremises(state, 'd1', 'rates stay flat');
    expect(matches).toHaveLength(1);
    expect(matches[0].entry.id).toBe('d2');
  });
});

// ── numeric drift ──

describe('numericDrift (legacy shim over M2 evaluateMateriality)', () => {
  // M2 §10.5: the old "global 10% + sign-flip-always" behavior is intentionally
  // re-estimated to the axis-aware, UNDER-fire default. `drifted` now means
  // status==='material'. The sign-flip-always over-fire is removed: a bare sign
  // flip with no zero_meaningful declared is `uncertain` (drifted=false), NOT a
  // manufactured alert. Full matrix lives in evaluate-materiality.test.ts.
  it('material on a clear scale-free >10% move', () => {
    expect(numericDrift(3.5, 4.5).drifted).toBe(true); // 28.6%
  });
  it('quiet under the relative threshold', () => {
    expect(numericDrift(3.5, 3.52).drifted).toBe(false); // 0.6%
  });
  it('a bare sign flip no longer auto-fires (under-fire: zero_meaningful undeclared → uncertain)', () => {
    expect(numericDrift(0.1, -0.1).drifted).toBe(false);
  });
  it('a large move off a near-zero base is material (≥2x multiplier, no safety_floor)', () => {
    expect(numericDrift(0, 2).drifted).toBe(true);
  });
  it('unchanged stays quiet', () => {
    expect(numericDrift(5, 5).drifted).toBe(false);
  });
  it('non-finite input is not comparable', () => {
    expect(numericDrift(Number.NaN, 3).drifted).toBe(false);
  });
});

// ── sanity: deriveState unchanged for premise-bearing entries ──

describe('deriveState with premises', () => {
  it('a sealed decision with premises still derives sealed/due by check_by', () => {
    const dir = tmpArgusDir();
    writeLedger(dir, [...sealEvents('d1', '2026-07-01'), addPremise('d1', 'z')]);
    const entry = replayLedger(dir, TODAY).contracts.get('d1')!;
    expect(deriveState(entry, TODAY)).toBe('due');
  });
});
