/**
 * Decision Contract — the falsifiable closed loop (§0 KICK).
 *
 * Covers the load-bearing core:
 *  - stablePredicateId: deterministic, source-scoped, whitespace/case-stable
 *  - extractPredicates: priority (governing → critical risks → role bets),
 *    persona specificity, dedupe, cap at 6
 *  - generateDecisionContract: null when nothing falsifiable
 *  - withCheckIn: derives the promised date
 *  - gradePredicate: immutable, stamps, finalizes only when ALL graded
 *  - contractStatus: checkInDue arithmetic (with and without a promised date)
 */

import { describe, it, expect } from 'vitest';
import {
  stablePredicateId,
  extractPredicates,
  generateDecisionContract,
  withCheckIn,
  gradePredicate,
  contractStatus,
  CHECK_IN_MS,
} from '../decision-contract';
import type { RecastItem, FeedbackRecord, RecastStep, ClassifiedRisk } from '@/stores/types';

const T0 = new Date('2026-06-01T00:00:00Z').getTime();

function step(partial: Partial<RecastStep>): RecastStep {
  return {
    task: 'do thing',
    actor: 'ai',
    actor_reasoning: '',
    expected_output: '',
    checkpoint: false,
    checkpoint_reason: '',
    ...partial,
  };
}

function recast(partial: { governing_idea?: string; steps?: RecastStep[] }): RecastItem {
  return {
    id: 'rc1',
    project_id: 'p1',
    input_text: '',
    analysis: {
      governing_idea: partial.governing_idea ?? '',
      storyline: { situation: '', complication: '', resolution: '' },
      goal_summary: '',
      steps: partial.steps ?? [],
      key_assumptions: [],
      critical_path: [],
      total_estimated_time: '',
      ai_ratio: 50,
      human_ratio: 50,
    },
    steps: partial.steps ?? [],
    status: 'done',
    created_at: '',
    updated_at: '',
  };
}

function feedback(risks: { persona_id: string; classified_risks: ClassifiedRisk[] }[]): FeedbackRecord {
  return {
    id: 'fb1',
    project_id: 'p1',
    document_title: '',
    document_text: '',
    persona_ids: risks.map((r) => r.persona_id),
    feedback_perspective: '',
    feedback_intensity: '',
    results: risks.map((r) => ({
      persona_id: r.persona_id,
      overall_reaction: '',
      failure_scenario: '',
      untested_assumptions: [],
      classified_risks: r.classified_risks,
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

describe('stablePredicateId', () => {
  it('is deterministic and case/whitespace-insensitive', () => {
    expect(stablePredicateId('risk', 'CFO objects')).toBe(stablePredicateId('risk', '  cfo   OBJECTS '));
  });
  it('is scoped by source — same text, different source → different id', () => {
    expect(stablePredicateId('risk', 'pricing')).not.toBe(stablePredicateId('actor', 'pricing'));
  });
  it('survives re-generation (a grade keyed on it is never orphaned)', () => {
    const a = extractPredicates({ recast: recast({ governing_idea: 'bundle stops churn' }), feedbacks: [] });
    const b = extractPredicates({ recast: recast({ governing_idea: 'bundle stops churn' }), feedbacks: [] });
    expect(a[0].id).toBe(b[0].id);
  });
});

describe('extractPredicates', () => {
  it('leads with the governing idea, then critical risks before manageable', () => {
    const preds = extractPredicates({
      recast: recast({ governing_idea: 'bundle stops churn' }),
      feedbacks: [
        feedback([
          { persona_id: 'cfo', classified_risks: [
            { text: 'minor copy issue', category: 'manageable' },
            { text: 'cost objection', category: 'critical' },
          ] },
        ]),
      ],
      personaName: (id) => (id === 'cfo' ? 'CFO' : undefined),
    });
    expect(preds[0]).toMatchObject({ source: 'governing_idea', text: 'bundle stops churn' });
    // critical sorts ahead of manageable
    expect(preds[1]).toMatchObject({ source: 'risk', category: 'critical' });
    expect(preds[1].text).toBe('CFO: cost objection'); // persona makes it specific
  });

  it('includes human/checkpoint role bets but not pure-AI steps', () => {
    const preds = extractPredicates({
      recast: recast({
        steps: [
          step({ task: 'price decision', actor: 'human' }),
          step({ task: 'draft email', actor: 'ai' }),
          step({ task: 'review legal', actor: 'ai', checkpoint: true }),
        ],
      }),
      feedbacks: [],
    });
    const actorTexts = preds.filter((p) => p.source === 'actor').map((p) => p.text);
    expect(actorTexts).toContain('price decision');
    expect(actorTexts).toContain('review legal'); // checkpoint counts even though actor=ai
    expect(actorTexts).not.toContain('draft email');
  });

  it('dedupes and caps at 6', () => {
    const manyRisks: ClassifiedRisk[] = Array.from({ length: 10 }, (_, i) => ({
      text: `risk ${i}`,
      category: 'critical' as const,
    }));
    const preds = extractPredicates({
      recast: recast({ governing_idea: 'central bet', steps: [step({ task: 's1', actor: 'human' }), step({ task: 's2', actor: 'human' })] }),
      feedbacks: [feedback([{ persona_id: 'p', classified_risks: manyRisks }])],
    });
    expect(preds.length).toBe(6);
    expect(new Set(preds.map((p) => p.id)).size).toBe(6); // all unique
    expect(preds[0].source).toBe('governing_idea'); // priority preserved
  });

  it('dedupes identical risk text from two personas', () => {
    const preds = extractPredicates({
      recast: recast({}),
      feedbacks: [
        feedback([
          { persona_id: 'a', classified_risks: [{ text: 'same risk', category: 'critical' }] },
          { persona_id: 'b', classified_risks: [{ text: 'same risk', category: 'critical' }] },
        ]),
      ],
      // no personaName → text identical → same id → deduped
    });
    expect(preds.filter((p) => p.text === 'same risk')).toHaveLength(1);
  });
});

describe('generateDecisionContract', () => {
  it('returns null when there is nothing falsifiable', () => {
    expect(generateDecisionContract('p1', { recast: recast({}), feedbacks: [] }, T0)).toBeNull();
  });
  it('builds a contract with predicates and a created_at', () => {
    const c = generateDecisionContract('p1', { recast: recast({ governing_idea: 'bet' }), feedbacks: [] }, T0);
    expect(c).not.toBeNull();
    expect(c!.project_id).toBe('p1');
    expect(c!.predicates.length).toBeGreaterThan(0);
    expect(c!.created_at).toBe(new Date(T0).toISOString());
  });
});

describe('withCheckIn', () => {
  it('derives the promised date from the interval', () => {
    const c = generateDecisionContract('p1', { recast: recast({ governing_idea: 'bet' }), feedbacks: [] }, T0)!;
    const committed = withCheckIn(c, '2w', T0);
    expect(committed.check_in_interval).toBe('2w');
    expect(committed.check_in_at).toBe(new Date(T0 + CHECK_IN_MS['2w']).toISOString());
  });
});

describe('gradePredicate', () => {
  const base = () =>
    generateDecisionContract(
      'p1',
      { recast: recast({ governing_idea: 'bet', steps: [step({ task: 'human call', actor: 'human' })] }), feedbacks: [] },
      T0,
    )!;

  it('is immutable and stamps graded_at', () => {
    const c = base();
    const next = gradePredicate(c, c.predicates[0].id, 'happened', T0 + 1000);
    expect(c.predicates[0].verdict).toBeUndefined(); // original untouched
    const p = next.predicates.find((x) => x.id === c.predicates[0].id)!;
    expect(p.verdict).toBe('happened');
    expect(p.graded_at).toBe(new Date(T0 + 1000).toISOString());
  });

  it('finalizes the contract only once EVERY predicate is graded', () => {
    let c = base();
    expect(c.predicates.length).toBe(2);
    c = gradePredicate(c, c.predicates[0].id, 'happened', T0);
    expect(c.graded_at).toBeUndefined(); // one still pending
    c = gradePredicate(c, c.predicates[1].id, 'avoided', T0);
    expect(c.graded_at).toBe(new Date(T0).toISOString());
  });

  it('clears the stamp when a grade is reverted to pending', () => {
    let c = base();
    c = gradePredicate(c, c.predicates[0].id, 'happened', T0);
    c = gradePredicate(c, c.predicates[1].id, 'partial', T0);
    expect(c.graded_at).toBeTruthy();
    c = gradePredicate(c, c.predicates[0].id, 'pending', T0);
    expect(c.graded_at).toBeUndefined();
  });
});

describe('contractStatus', () => {
  const base = () =>
    generateDecisionContract(
      'p1',
      { recast: recast({ governing_idea: 'bet', steps: [step({ task: 'human call', actor: 'human' })] }), feedbacks: [] },
      T0,
    )!;

  it('is not due before the promised check-in date', () => {
    const c = withCheckIn(base(), '2w', T0);
    const s = contractStatus(c, T0 + CHECK_IN_MS['1w']); // 1 week in
    expect(s.checkInDue).toBe(false);
    expect(s.daysUntilCheckIn).toBe(7);
  });

  it('is due once the check-in date passes with ungraded predicates', () => {
    const c = withCheckIn(base(), '2w', T0);
    const s = contractStatus(c, T0 + CHECK_IN_MS['2w'] + DAY());
    expect(s.checkInDue).toBe(true);
    expect(s.pending).toBe(2);
  });

  it('is never due once fully graded, even past the date', () => {
    let c = withCheckIn(base(), '2w', T0);
    c = gradePredicate(c, c.predicates[0].id, 'happened', T0);
    c = gradePredicate(c, c.predicates[1].id, 'avoided', T0);
    const s = contractStatus(c, T0 + CHECK_IN_MS['1m']);
    expect(s.allGraded).toBe(true);
    expect(s.checkInDue).toBe(false);
  });

  it('with no promised date, is due whenever something is ungraded', () => {
    const c = base(); // no withCheckIn
    expect(contractStatus(c, T0).checkInDue).toBe(true);
    expect(contractStatus(c, T0).daysUntilCheckIn).toBeNull();
  });
});

function DAY() {
  return 86_400_000;
}
