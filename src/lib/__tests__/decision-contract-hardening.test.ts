/**
 * Decision Contract — hardening regressions from adversarial review.
 *
 * Locks in the fixes for:
 *  - P1 crash: contractStatus / gradePredicate on malformed (remote/old) data
 *  - P1 "unknown" verdict resolves a predicate without scoring it
 *  - P1 summarizeGrades scores PER SOURCE (a risk "happened" is not a "win")
 *  - role-bet extraction includes human-in-the-loop actors (human→ai / ai→human)
 */

import { describe, it, expect } from 'vitest';
import {
  contractStatus,
  gradePredicate,
  summarizeGrades,
  generateDecisionContract,
  withCheckIn,
  extractPredicates,
  isResolved,
  CHECK_IN_MS,
} from '../decision-contract';
import type { RecastItem, RecastStep, DecisionContract } from '@/stores/types';
import type { PredicateSources } from '../decision-contract';

const T0 = new Date('2026-06-08T00:00:00Z').getTime();
const DAY = 86_400_000;

function step(p: Partial<RecastStep>): RecastStep {
  return { task: 't', actor: 'ai', actor_reasoning: '', expected_output: '', checkpoint: false, checkpoint_reason: '', ...p };
}
function recastWith(steps: RecastStep[], governing = ''): RecastItem {
  return {
    id: 'rc', project_id: 'p', input_text: '', status: 'done', created_at: '', updated_at: '', steps,
    analysis: {
      governing_idea: governing, storyline: { situation: '', complication: '', resolution: '' },
      goal_summary: '', steps, key_assumptions: [], critical_path: [], total_estimated_time: '', ai_ratio: 50, human_ratio: 50,
    },
  };
}
function contractWith(verdictsBySource: { source: 'risk' | 'governing_idea' | 'actor'; verdict?: string }[]): DecisionContract {
  return {
    id: 'c', project_id: 'p', created_at: '', predicates: verdictsBySource.map((v, i) => ({
      id: `pred_${i}`, text: `t${i}`, source: v.source, verdict: v.verdict as never,
    })),
  };
}

describe('P1 — defensive: malformed contract never throws mid-render', () => {
  it('contractStatus tolerates missing / non-array predicates', () => {
    expect(() => contractStatus({} as DecisionContract, T0)).not.toThrow();
    expect(() => contractStatus({ predicates: null } as never, T0)).not.toThrow();
    expect(contractStatus({} as DecisionContract, T0).total).toBe(0);
    expect(contractStatus({ predicates: null } as never, T0).checkInDue).toBe(false);
  });
  it('gradePredicate tolerates a malformed contract', () => {
    expect(() => gradePredicate({} as DecisionContract, 'x', 'happened', T0)).not.toThrow();
    expect(() => summarizeGrades({ predicates: undefined } as never).total).not.toThrow();
  });
});

describe('P1 — "unknown" resolves without scoring', () => {
  const base = () => withCheckIn(generateDecisionContract('p', { recast: recastWith([], 'bet'), feedbacks: [] } as PredicateSources, T0)!, '1w', T0);

  it('an unknown verdict counts as resolved and completes the contract', () => {
    let c = base();
    expect(c.predicates.length).toBe(1);
    c = gradePredicate(c, c.predicates[0].id, 'unknown', T0);
    expect(isResolved(c.predicates[0])).toBe(true);
    const s = contractStatus(c, T0 + CHECK_IN_MS['1w'] + DAY);
    expect(s.allGraded).toBe(true);
    expect(s.checkInDue).toBe(false); // the immortal-badge trap is closed
  });

  it('unknown is excluded from the scorecard', () => {
    const c = contractWith([
      { source: 'risk', verdict: 'unknown' },
      { source: 'governing_idea', verdict: 'happened' },
    ]);
    const g = summarizeGrades(c);
    expect(g.unknown).toBe(1);
    expect(g.betsHeld).toBe(1);
    expect(g.risksAvoided).toBe(0);
    expect(g.risksHappened).toBe(0);
  });
});

describe('P1 — summarizeGrades scores per source (no misleading lump sum)', () => {
  it('a risk that HAPPENED is a hit, not a win; a bet that HELD is good', () => {
    const c = contractWith([
      { source: 'risk', verdict: 'happened' }, // bad: the risk bit
      { source: 'risk', verdict: 'avoided' }, // good: steered clear
      { source: 'governing_idea', verdict: 'happened' }, // good: bet held
      { source: 'actor', verdict: 'happened' }, // role call confirmed
    ]);
    const g = summarizeGrades(c);
    expect(g.risksHappened).toBe(1);
    expect(g.risksAvoided).toBe(1);
    expect(g.betsHeld).toBe(1);
    expect(g.rolesConfirmed).toBe(1);
    expect(g.resolved).toBe(4);
    // crucially: there is no single "hits" field that lumps risk-happened with bet-held
    expect(g).not.toHaveProperty('hits');
  });

  it('ignores still-pending predicates', () => {
    const g = summarizeGrades(contractWith([{ source: 'risk' }, { source: 'risk', verdict: 'avoided' }]));
    expect(g.resolved).toBe(1);
    expect(g.risksAvoided).toBe(1);
  });
});

describe('role-bet extraction includes human-in-the-loop actors', () => {
  it('treats human→ai and ai→human hand-offs as eligible role bets; excludes pure-ai', () => {
    // Two human-touch steps (within MAX_ACTORS=2) + one pure-ai that must be skipped.
    const preds = extractPredicates({
      recast: recastWith([
        step({ task: 'handoff up', actor: 'human→ai' }),
        step({ task: 'handoff down', actor: 'ai→human' }),
        step({ task: 'pure ai', actor: 'ai' }),
      ]),
      feedbacks: [],
    });
    const actorTexts = preds.filter((p) => p.source === 'actor').map((p) => p.text);
    expect(actorTexts).toEqual(expect.arrayContaining(['handoff up', 'handoff down']));
    expect(actorTexts).not.toContain('pure ai');
  });
});
