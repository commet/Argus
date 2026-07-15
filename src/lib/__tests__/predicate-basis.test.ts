/**
 * Predicate basis — luck vs. judgment on a WIN (R17 port to the webapp).
 *
 * A held bet / avoided risk the user attributes to luck must NOT compound into
 * the track record as a judgment-win. Locks in:
 *  - setPredicateBasis only attaches to a RESOLVED predicate (never resolves one)
 *  - gradePredicate CLEARS basis when the verdict is re-tapped
 *  - isLuckBasis: luck/external = true; reasoned/mixed/undefined = false
 *  - summarizeGrades / summarizeRecord separate lucky wins from skill wins
 *  - webapp basis set === plugin settle `basis` set (cross-surface parity)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  gradePredicate,
  setPredicateBasis,
  isLuckBasis,
  summarizeGrades,
  summarizeRecord,
} from '../decision-contract';
import { PREDICATE_BASES } from '@/stores/types';
import type { DecisionContract, Predicate } from '@/stores/types';

const T0 = new Date('2026-06-08T00:00:00Z').getTime();

function contractWith(preds: Array<Partial<Predicate> & { source: Predicate['source'] }>): DecisionContract {
  return {
    id: 'c', project_id: 'p', created_at: '',
    predicates: preds.map((p, i) => ({ id: `pred_${i}`, text: `t${i}`, ...p })) as Predicate[],
  };
}

describe('setPredicateBasis — attaches only to a resolved predicate', () => {
  it('is a no-op on a pending (unresolved) predicate', () => {
    const c = contractWith([{ source: 'governing_idea' }]); // no verdict → pending
    const next = setPredicateBasis(c, 'pred_0', 'luck');
    expect(next.predicates[0].basis).toBeUndefined();
  });

  it('attaches to a resolved predicate and never sets a verdict by itself', () => {
    const c = contractWith([{ source: 'governing_idea', verdict: 'happened' }]);
    const next = setPredicateBasis(c, 'pred_0', 'luck');
    expect(next.predicates[0].basis).toBe('luck');
    expect(next.predicates[0].verdict).toBe('happened');
  });

  it('tapping the same basis off (passing undefined) clears it', () => {
    let c = contractWith([{ source: 'risk', verdict: 'avoided' }]);
    c = setPredicateBasis(c, 'pred_0', 'external');
    expect(c.predicates[0].basis).toBe('external');
    c = setPredicateBasis(c, 'pred_0', undefined);
    expect(c.predicates[0].basis).toBeUndefined();
  });
});

describe('gradePredicate — re-tapping the verdict clears the prior basis', () => {
  it('changing the outcome drops the now-stale "why"', () => {
    let c = contractWith([{ source: 'governing_idea', verdict: 'happened' }]);
    c = setPredicateBasis(c, 'pred_0', 'luck');
    expect(c.predicates[0].basis).toBe('luck');
    c = gradePredicate(c, 'pred_0', 'avoided', T0); // bet actually broke
    expect(c.predicates[0].basis).toBeUndefined();
  });
});

describe('isLuckBasis — conservative "not my judgment" marker', () => {
  it('luck and external are lucky; reasoned, mixed, undefined are not', () => {
    expect(isLuckBasis('luck')).toBe(true);
    expect(isLuckBasis('external')).toBe(true);
    expect(isLuckBasis('reasoned')).toBe(false);
    expect(isLuckBasis('mixed')).toBe(false);
    expect(isLuckBasis(undefined)).toBe(false);
  });
});

describe('summarizeGrades — separates lucky wins from skill wins', () => {
  it('counts a held bet AND an avoided risk on luck, but not on reasoned/mixed', () => {
    const c = contractWith([
      { source: 'governing_idea', verdict: 'happened', basis: 'luck' },     // lucky win
      { source: 'governing_idea', verdict: 'happened', basis: 'reasoned' }, // skill win
      { source: 'risk', verdict: 'avoided', basis: 'external' },            // lucky win
      { source: 'risk', verdict: 'avoided', basis: 'mixed' },               // not counted lucky
      { source: 'governing_idea', verdict: 'happened' },                    // unanswered → not lucky
    ]);
    const g = summarizeGrades(c);
    expect(g.betsHeld).toBe(3);
    expect(g.risksAvoided).toBe(2);
    expect(g.goodOutcomesOnLuck).toBe(2); // the luck + external ones only
  });

  it('a broken bet on luck is not counted (luck only flags WINS)', () => {
    const c = contractWith([{ source: 'governing_idea', verdict: 'avoided', basis: 'luck' }]);
    const g = summarizeGrades(c);
    expect(g.betsBroke).toBe(1);
    expect(g.goodOutcomesOnLuck).toBe(0);
  });

  it('separates a held bet that was machine-surfaced (authored=ai_surfaced) from the user\'s judgment (R57/R58)', () => {
    const c = contractWith([
      { source: 'governing_idea', verdict: 'happened', authored: 'ai_surfaced' }, // machine-surfaced, held
      { source: 'governing_idea', verdict: 'happened', authored: 'user' },        // user's own, held
      { source: 'governing_idea', verdict: 'happened' },                          // legacy/untagged → user's own
    ]);
    const g = summarizeGrades(c);
    expect(g.betsHeld).toBe(3);              // still counted as held bets overall
    expect(g.betsHeldAiSurfaced).toBe(1);    // but only the machine-surfaced one is segregated
  });

  it('a held bet on luck AND machine-surfaced lands in both buckets, not as clean judgment', () => {
    const c = contractWith([{ source: 'governing_idea', verdict: 'happened', basis: 'luck', authored: 'ai_surfaced' }]);
    const g = summarizeGrades(c);
    expect(g.betsHeld).toBe(1);
    expect(g.goodOutcomesOnLuck).toBe(1);
    expect(g.betsHeldAiSurfaced).toBe(1);
  });
});

describe('summarizeRecord — luck count aggregates across projects', () => {
  it('sums goodOutcomesOnLuck only over fully-settled contracts', () => {
    const settled = contractWith([{ source: 'governing_idea', verdict: 'happened', basis: 'luck' }]);
    const open = contractWith([{ source: 'governing_idea', verdict: 'happened', basis: 'luck' }, { source: 'risk' }]); // pred_1 pending → not settled
    const rec = summarizeRecord(
      [{ decision_contract: settled }, { decision_contract: open }],
      T0,
    );
    expect(rec.loops).toBe(1);
    expect(rec.goodOutcomesOnLuck).toBe(1);
  });
});

describe('cross-surface parity — webapp basis set === plugin settle basis', () => {
  it('PREDICATE_BASES matches the plugin settle basis values', () => {
    // The plugin's settle event is now written by the single-source CLI
    // (decision-ledger.js), which owns the canonical basis enum. Parity is
    // checked against that source, not the skill prose it used to hand-write.
    const cli = readFileSync(
      join(process.cwd(), 'argus-plugin-v2/scripts/decision-ledger.js'),
      'utf8',
    );
    const m = cli.match(/const BASES\s*=\s*\[([^\]]+)\]/);
    expect(m, 'decision-ledger.js settle must declare a BASES enum').toBeTruthy();
    const pluginSet = (m![1].match(/"([^"]+)"/g) ?? []).map((s) => s.replace(/"/g, ''));
    expect([...PREDICATE_BASES].sort()).toEqual(pluginSet.sort());
  });
});
