/**
 * [C1·P0] Retro-isolation — the load-bearing invariant of 베팅③ (회고 봉인).
 *
 * A retrospective seal closes the seal→settle loop on an already-known past
 * outcome so a first-session user can taste settlement now, without the 2–3 week
 * wait. But hindsight bias is native to retro accuracy, so a retro loop must NEVER
 * enter the 자차표 (cross-project record). `summarizeRecord` is the SINGLE
 * aggregation source (project record strip + SettlementModal both read it), so
 * one exclusion filter there isolates every surface at once.
 *
 * This test is the guard: it proves a fully-graded `origin:'retro'` contract
 * contributes nothing to loops/betsHeld/risksAvoided/betsBroke/risksHappened,
 * while an otherwise-identical real contract counts. If the filter is dropped,
 * a practice loop would silently inflate the record = goalpost-guard violation.
 */

import { describe, it, expect } from 'vitest';
import { summarizeRecord } from '../decision-contract';
import type { DecisionContract, Predicate } from '@/stores/types';

const T0 = new Date('2026-07-01T00:00:00Z').getTime();

/** A fully-graded contract: one held bet + one avoided risk → counts as a closed loop. */
function settledContract(overrides: Partial<DecisionContract> = {}): DecisionContract {
  const predicates: Predicate[] = [
    { id: 'bet1', text: 'the bet holds', source: 'governing_idea', verdict: 'happened' },
    { id: 'risk1', text: 'the risk hits', source: 'risk', verdict: 'avoided' },
  ];
  return {
    id: 'c1',
    project_id: 'p1',
    predicates,
    created_at: new Date(T0).toISOString(),
    graded_at: new Date(T0).toISOString(),
    ...overrides,
  };
}

describe('[C1·P0] summarizeRecord excludes retro (practice) loops', () => {
  it('a normal settled contract counts in the record', () => {
    const rec = summarizeRecord([{ decision_contract: settledContract() }], T0 + 1);
    expect(rec.loops).toBe(1);
    expect(rec.betsHeld).toBe(1);
    expect(rec.risksAvoided).toBe(1);
  });

  it('an identical retro contract contributes NOTHING to any field', () => {
    const rec = summarizeRecord(
      [{ decision_contract: settledContract({ origin: 'retro' }) }],
      T0 + 1,
    );
    expect(rec.loops).toBe(0);
    expect(rec.betsHeld).toBe(0);
    expect(rec.risksAvoided).toBe(0);
    expect(rec.betsBroke).toBe(0);
    expect(rec.risksHappened).toBe(0);
    expect(rec.goodOutcomesOnLuck).toBe(0);
  });

  it('a retro loop does not inflate a record that already has a real loop', () => {
    const real = { decision_contract: settledContract({ id: 'real' }) };
    const retro = { decision_contract: settledContract({ id: 'retro', origin: 'retro' }) };
    const withRetro = summarizeRecord([real, retro], T0 + 1);
    const realOnly = summarizeRecord([real], T0 + 1);
    // Adding a settled retro loop leaves every count identical to the real-only record.
    expect(withRetro).toEqual(realOnly);
  });
});
