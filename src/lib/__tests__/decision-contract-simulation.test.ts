/**
 * Decision Contract — full-voyage lifecycle simulation (§0 KICK).
 *
 * Narrative end-to-end scenarios, the way a real user moves through the loop:
 *   A. seal → wait → check-in due → grade all → verified
 *   B. the return hook only fires on/after the promised date
 *   C. re-generating a contract must NOT orphan an existing grade (the
 *      stable-id contract — the single most important correctness property)
 *   D. degenerate voyages (manageable-only, empty) behave sanely
 *   E. partial grading keeps the project "due" until every predicate is scored
 */

import { describe, it, expect } from 'vitest';
import {
  generateDecisionContract,
  withCheckIn,
  gradePredicate,
  contractStatus,
  extractPredicates,
  CHECK_IN_MS,
} from '../decision-contract';
import type {
  RecastItem,
  FeedbackRecord,
  RecastStep,
  ClassifiedRisk,
  DecisionContract,
} from '@/stores/types';
import type { PredicateSources as PS } from '../decision-contract';

const DAY = 86_400_000;
const T0 = new Date('2026-06-08T00:00:00Z').getTime();

function step(p: Partial<RecastStep>): RecastStep {
  return {
    task: 'task',
    actor: 'ai',
    actor_reasoning: '',
    expected_output: '',
    checkpoint: false,
    checkpoint_reason: '',
    ...p,
  };
}

function makeRecast(governing_idea: string, steps: RecastStep[]): RecastItem {
  return {
    id: 'rc1',
    project_id: 'proj-pricing',
    input_text: '',
    analysis: {
      governing_idea,
      storyline: { situation: '', complication: '', resolution: '' },
      goal_summary: '',
      steps,
      key_assumptions: [],
      critical_path: [],
      total_estimated_time: '',
      ai_ratio: 40,
      human_ratio: 60,
    },
    steps,
    status: 'done',
    created_at: '',
    updated_at: '',
  };
}

function makeFeedback(rows: { persona_id: string; risks: ClassifiedRisk[] }[]): FeedbackRecord {
  return {
    id: 'fb1',
    project_id: 'proj-pricing',
    document_title: '',
    document_text: '',
    persona_ids: rows.map((r) => r.persona_id),
    feedback_perspective: '',
    feedback_intensity: '',
    results: rows.map((r) => ({
      persona_id: r.persona_id,
      overall_reaction: '',
      failure_scenario: '',
      untested_assumptions: [],
      classified_risks: r.risks,
      first_questions: [],
      praise: [],
      concerns: [],
      wants_more: [],
      approval_conditions: [],
    })),
    synthesis: '',
    created_at: '',
  };
}

/** A realistic pricing voyage: a central bet, two critical risks (one per
 *  persona), and a human-led price decision. */
function pricingVoyage(): PS {
  return {
    recast: makeRecast('묶음할인이 이탈을 막는다', [
      step({ task: '가격 책정', actor: 'human' }),
      step({ task: '런치 이메일 초안', actor: 'ai' }),
    ]),
    feedbacks: [
      makeFeedback([
        { persona_id: 'cfo', risks: [{ text: '비용에 반대한다', category: 'critical' }] },
        { persona_id: 'sales', risks: [{ text: '신규 정책에 저항한다', category: 'critical' }] },
      ]),
    ],
    personaName: (id) => ({ cfo: 'CFO', sales: '영업팀장' })[id],
  };
}

describe('Scenario A — full voyage: seal → wait → due → grade → verified', () => {
  it('walks the entire return loop', () => {
    // Voyage ends → a contract can be sealed.
    const fresh = generateDecisionContract('proj-pricing', pricingVoyage(), T0)!;
    expect(fresh).not.toBeNull();
    // governing idea leads, personas make risks specific
    expect(fresh.predicates[0]).toMatchObject({ source: 'governing_idea' });
    expect(fresh.predicates.map((p) => p.text)).toContain('CFO: 비용에 반대한다');
    expect(fresh.predicates.map((p) => p.text)).toContain('가격 책정'); // the human role bet

    // User commits to a 2-week check-in.
    let contract: DecisionContract = withCheckIn(fresh, '2w', T0);
    expect(contractStatus(contract, T0).checkInDue).toBe(false); // not yet

    // 2 weeks + a day later → the project resurfaces for grading.
    const visitAt = T0 + CHECK_IN_MS['2w'] + DAY;
    const dueStatus = contractStatus(contract, visitAt);
    expect(dueStatus.checkInDue).toBe(true);
    expect(dueStatus.pending).toBe(contract.predicates.length);

    // User grades every prediction.
    for (const p of contract.predicates) {
      const verdict = p.source === 'governing_idea' ? 'happened' : 'avoided';
      contract = gradePredicate(contract, p.id, verdict, visitAt);
    }

    // Now verified — no longer due, even well past the date.
    const finalStatus = contractStatus(contract, visitAt + 30 * DAY);
    expect(finalStatus.allGraded).toBe(true);
    expect(finalStatus.checkInDue).toBe(false);
    expect(contract.graded_at).toBe(new Date(visitAt).toISOString());
  });
});

describe('Scenario B — the return hook fires only on/after the promised date', () => {
  it('stays quiet the whole way until the date, then nudges', () => {
    const contract = withCheckIn(generateDecisionContract('proj-pricing', pricingVoyage(), T0)!, '1m', T0);
    for (let d = 0; d < 30; d++) {
      expect(contractStatus(contract, T0 + d * DAY).checkInDue).toBe(false);
    }
    expect(contractStatus(contract, T0 + 30 * DAY).checkInDue).toBe(true);
  });
});

describe('Scenario C — re-generation must not orphan a grade (stable id)', () => {
  it('a grade keyed by id survives re-deriving the contract from the same voyage', () => {
    const v = pricingVoyage();
    // First contract, grade the CFO risk.
    let contract = withCheckIn(generateDecisionContract('proj-pricing', v, T0)!, '2w', T0);
    const cfo = contract.predicates.find((p) => p.text === 'CFO: 비용에 반대한다')!;
    contract = gradePredicate(contract, cfo.id, 'happened', T0 + DAY);

    // Imagine the contract is re-derived (e.g. a future re-seal path) — ids are
    // deterministic, so the same prediction keeps the same id.
    const regenerated = generateDecisionContract('proj-pricing', v, T0 + 99 * DAY)!;
    const sameCfo = regenerated.predicates.find((p) => p.text === 'CFO: 비용에 반대한다')!;
    expect(sameCfo.id).toBe(cfo.id); // join key stable → grade re-applies cleanly

    // Re-applying the stored grade by id lands on the right prediction.
    const remerged = gradePredicate(regenerated, sameCfo.id, 'happened', T0 + DAY);
    expect(remerged.predicates.find((p) => p.id === cfo.id)!.verdict).toBe('happened');
  });
});

describe('Scenario D — degenerate voyages', () => {
  it('a voyage with only manageable risks still yields gradeable predicates', () => {
    const preds = extractPredicates({
      recast: makeRecast('', []),
      feedbacks: [makeFeedback([{ persona_id: 'p', risks: [{ text: '사소한 문구', category: 'manageable' }] }])],
    });
    expect(preds.length).toBe(1);
    expect(preds[0].source).toBe('risk');
  });

  it('a voyage with nothing falsifiable yields no contract (never an empty card)', () => {
    expect(generateDecisionContract('proj-x', { recast: makeRecast('', []), feedbacks: [] }, T0)).toBeNull();
    expect(generateDecisionContract('proj-x', { recast: null, feedbacks: [] }, T0)).toBeNull();
  });
});

describe('Scenario E — partial grading keeps the project due', () => {
  it('stays due until the LAST prediction is graded', () => {
    let contract = withCheckIn(generateDecisionContract('proj-pricing', pricingVoyage(), T0)!, '1w', T0);
    const visitAt = T0 + CHECK_IN_MS['1w'] + DAY;
    const n = contract.predicates.length;
    for (let i = 0; i < n - 1; i++) {
      contract = gradePredicate(contract, contract.predicates[i].id, 'partial', visitAt);
      expect(contractStatus(contract, visitAt).checkInDue).toBe(true); // still due
    }
    contract = gradePredicate(contract, contract.predicates[n - 1].id, 'partial', visitAt);
    expect(contractStatus(contract, visitAt).checkInDue).toBe(false); // done
    expect(contractStatus(contract, visitAt).allGraded).toBe(true);
  });
});
