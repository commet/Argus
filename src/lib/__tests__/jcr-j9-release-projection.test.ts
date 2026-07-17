import { describe, expect, it } from 'vitest';
import {
  evaluateE3BReleaseGate,
  productionE3BReleaseDecision,
  type E3BReleaseReceipt,
} from '@/lib/epistemic/e3b-release-gate';
import { independentSourceCount, projectClaimReviewCard, projectPublicPatterns } from '@/lib/epistemic/patterns-projection';
import { emptyClaimAuthorityState, type ClaimAuthorityState } from '@/lib/epistemic/domain/types';

const NOW = '2026-07-18T00:00:00.000Z';

function releaseReceipt(): E3BReleaseReceipt {
  return {
    receipt_id: 'o4:real-study-receipt',
    verdict: 'pass',
    evidence_digest: `sha256:${'a'.repeat(64)}`,
    thresholds_sealed_at: '2026-06-01T00:00:00.000Z',
    study_started_at: '2026-06-02T00:00:00.000Z',
    study_completed_at: '2026-06-23T00:00:00.000Z',
    participant_count: 5,
    observation_days: 21,
    completed_lifecycle_count: 10,
    comparison_cohort_count: 2,
    funnel_counts: {
      noticed: 30, captured: 28, accepted: 24, surfaced: 20,
      returned: 16, resolved: 12, again: 10,
    },
    comprehension: {
      participant_count: 5,
      completed_task_count: 15,
      endorse_grant_confusion_count: 0,
      source_drilldown_success_rate: 1,
      separate_grant_recognition_rate: 1,
    },
  };
}

function supportedState(lifecycle: ClaimAuthorityState['lifecycle'] = 'candidate'): ClaimAuthorityState {
  const state = emptyClaimAuthorityState('claim:j9');
  return {
    ...state,
    aggregate_version: 1,
    authority_epoch: 1,
    lifecycle,
    support_state: 'supported',
    claim_kind: 'causal_hypothesis',
    statement: {
      value: '운영 용량을 약속 뒤에 확인한 결정에서 전제가 반복해 깨졌다.',
      provenance: 'ai_surfaced', source_ref: 'k:candidate:1', recorded_at: NOW,
    },
    scope: {
      value: { domains: ['product'], project_ids: ['p1', 'p2'], review_by: '2026-09-01T00:00:00.000Z' },
      provenance: 'ai_surfaced', source_ref: 'k:scope:1', recorded_at: NOW,
    },
    support_units: [0, 1, 2].map((index) => ({
      support_unit_id: `support:${index}`,
      claim_id: 'claim:j9',
      case_id: `case:${index}`,
      resolution_event_ref: `resolution:${index}`,
      observation_ref: `observation:${index}`,
      observation_authority: index === 1 ? 'external_reality' : 'user',
      causal_cluster_id: `causal:${index}`,
      source_cluster_id: `source:${index}`,
      model_lineages: [],
      verification_state: 'resolved',
    })),
    counterexamples: [{
      counterexample_ref: 'observation:counter:1', material: false,
      authored: {
        value: '한 결정에서는 약속 전에 운영 용량을 확인했다.',
        provenance: 'host_reported', source_ref: 'case:counter:1', recorded_at: NOW,
      },
    }],
  };
}

describe('JCR J9 release gate', () => {
  it('cannot be opened by an environment selector without a registered receipt', () => {
    expect(productionE3BReleaseDecision('o4:any-env-value')).toEqual({
      open: false,
      reason: 'receipt_not_registered',
    });
  });

  it('requires pre-sealed O4 thresholds and zero endorse/grant confusion', () => {
    const valid = releaseReceipt();
    expect(evaluateE3BReleaseGate(valid.receipt_id, [valid])).toMatchObject({ open: true });
    const confused = {
      ...valid,
      comprehension: { ...valid.comprehension, endorse_grant_confusion_count: 1 },
    };
    expect(evaluateE3BReleaseGate(valid.receipt_id, [confused])).toEqual({
      open: false,
      reason: 'comprehension_not_passed',
    });
    const lateSeal = { ...valid, thresholds_sealed_at: valid.study_started_at };
    expect(evaluateE3BReleaseGate(valid.receipt_id, [lateSeal])).toEqual({
      open: false,
      reason: 'thresholds_not_presealed',
    });
  });
});

describe('JCR J9 review and public Patterns projections', () => {
  it('surfaces a candidate only with three independent resolved reality sources', () => {
    const state = supportedState();
    const projected = projectClaimReviewCard(state);
    expect(projected.eligible).toBe(true);
    if (!projected.eligible) throw new Error('fixture must project');
    expect(projected.card.sources).toHaveLength(3);
    expect(projected.card.independent_source_count).toBe(3);
    expect(projected.card.sources.every((source) =>
      source.observation_ref && source.resolution_event_ref && source.source_cluster_id)).toBe(true);
    expect(projected.card.counterexamples).toEqual([expect.objectContaining({
      counterexample_ref: 'observation:counter:1', material: false,
    })]);

    const dependent = { ...state, support_units: state.support_units.map((unit) => ({
      ...unit, source_cluster_id: 'one-shared-source',
    })) };
    expect(projectClaimReviewCard(dependent)).toEqual({
      eligible: false,
      claim_id: state.claim_id,
      reason: 'independent_reality_support_below_three',
    });
  });

  it('reports distinct source clusters rather than raw support row count', () => {
    const projected = projectClaimReviewCard(supportedState());
    if (!projected.eligible) throw new Error('fixture must project');
    expect(independentSourceCount([
      ...projected.card.sources,
      { ...projected.card.sources[0], support_unit_id: 'support:duplicate' },
    ])).toBe(3);
  });

  it('never counts AI-only observations and only publishes endorsed claims', () => {
    const state = supportedState();
    const aiOnly = { ...state, support_units: state.support_units.map((unit) => ({
      ...unit, observation_authority: 'ai_only' as const,
    })) };
    expect(projectClaimReviewCard(aiOnly).eligible).toBe(false);
    expect(projectPublicPatterns([state])).toEqual([]);

    const patterns = projectPublicPatterns([supportedState('endorsed')]);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].dimensions.map((item) => item.dimension)).toEqual([
      'outcome_frequency', 'authorship_trajectory', 'causal_structure',
      'cross_decision_scope', 'transfer_question',
    ]);
    expect(patterns[0].dimensions.at(-1)).toMatchObject({
      available: false,
      source_refs: [],
    });
  });
});
