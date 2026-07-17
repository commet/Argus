import { describe, expect, it } from 'vitest';
import { commandSemanticFingerprint } from '@/lib/epistemic/domain/decide';
import { emptyClaimAuthorityState, type AccountContinuityPolicy, type ClaimAuthorityState } from '@/lib/epistemic/domain/types';
import { buildE3BAuthorityCommand, parseE3BReviewAction, resolveCardSources } from '@/lib/epistemic/server-review';
import type { ClaimReviewCardProjection, CanonicalSourceEventProjection } from '@/lib/epistemic/patterns-projection';

const NOW = '2026-07-18T03:00:00.000Z';
const state: ClaimAuthorityState = {
  ...emptyClaimAuthorityState('claim:j9-action'), aggregate_version: 4, authority_epoch: 2,
};
const policy: AccountContinuityPolicy = {
  account_id: 'user:1', erasure_epoch: 7, retention_policy: 'account_default',
  sync_origins: ['web:e3b'], blocked_origins: [],
};

describe('JCR J9 surface actions', () => {
  it('parses bounded discriminated actions and rejects a combined review/grant payload', () => {
    expect(parseE3BReviewAction({
      kind: 'endorse', action_id: 'action:1', claim_id: 'claim:j9-action',
      effect: 'adapt_generation', surfaces: ['web'], scope: {},
    })).toBeNull();
    expect(parseE3BReviewAction({
      kind: 'grant', action_id: 'action:2', claim_id: 'claim:j9-action',
      effect: 'adapt_generation', surfaces: [], scope: {},
    })).toBeNull();
    expect(parseE3BReviewAction({
      kind: 'grant', action_id: 'action:empty', claim_id: 'claim:j9-action',
      effect: 'ask_once', surfaces: ['web'], scope: {},
    })).toBeNull();
    expect(parseE3BReviewAction({
      kind: 'reword', action_id: 'action:foreign', claim_id: 'claim:j9-action',
      wording: 'My wording', effect: 'retrieve_only',
    })).toBeNull();
    expect(parseE3BReviewAction({
      kind: 'grant', action_id: 'action:foreign-grant', claim_id: 'claim:j9-action',
      effect: 'ask_once', surfaces: ['web'], scope: { domain: 'product' }, reason: 'not allowed',
    })).toBeNull();
  });

  it('maps endorsement and future influence to separate authority commands', () => {
    const endorsement = buildE3BAuthorityCommand({
      user_id: 'user:1', state, policy, now: NOW,
      action: { kind: 'endorse', action_id: 'action:endorse', claim_id: state.claim_id },
    });
    expect(endorsement).toMatchObject({
      type: 'ReviewClaim', action: 'endorse', account_erasure_epoch: 7,
      expected_aggregate_version: 4, expected_authority_epoch: 2,
    });
    expect(endorsement && 'grant_id' in endorsement).toBe(false);

    const grant = buildE3BAuthorityCommand({
      user_id: 'user:1', state, policy, now: NOW,
      action: {
        kind: 'grant', action_id: 'action:grant', claim_id: state.claim_id,
        effect: 'ask_once', surfaces: ['web'], scope: { domain: 'product' },
        expires_at: '2026-10-18T03:00:00.000Z',
      },
    });
    expect(grant).toMatchObject({
      type: 'GrantInfluence', grant_id: 'grant:e3b:action:grant', effect: 'ask_once',
      starts_at: NOW, expires_at: '2026-10-18T03:00:00.000Z',
    });
    expect(grant && 'action' in grant).toBe(false);
    expect(endorsement?.semantic_fingerprint).toBe(commandSemanticFingerprint(endorsement!));
    expect(grant?.semantic_fingerprint).toBe(commandSemanticFingerprint(grant!));
  });

  it('does not silently widen a restricted origin policy', () => {
    expect(buildE3BAuthorityCommand({
      user_id: 'user:1', state, policy: { ...policy, sync_origins: ['device:trusted'] }, now: NOW,
      action: { kind: 'endorse', action_id: 'action:3', claim_id: state.claim_id },
    })).toBeNull();
  });

  it('fails a review card closed unless every observation and resolution can be inspected', () => {
    const card: ClaimReviewCardProjection = {
      claim_id: state.claim_id, statement: 'A bounded pattern', claim_kind: 'descriptive_sequence',
      lifecycle: 'candidate', support_state: 'supported', authority_epoch: 2, aggregate_version: 4,
      independent_source_count: 3,
      scope: { domains: ['product'] }, counterexamples: [], limitations: [], limitations_en: [],
      review_question: '맞나요?', review_question_en: 'Does it fit?', active_grants: [],
      sources: [0, 1, 2].map((index) => ({
        support_unit_id: `support:${index}`, case_id: `case:${index}`,
        observation_ref: `observation:${index}`, resolution_event_ref: `resolution:${index}`,
        observation_authority: 'user', source_cluster_id: `source:${index}`, causal_cluster_id: `causal:${index}`,
      })),
    };
    const source = (event_id: string, event_type: string): CanonicalSourceEventProjection => ({
      project_id: 'project:1', event_id, event_type, occurred_at: NOW, excerpt: event_id,
    });
    const sources = new Map<string, CanonicalSourceEventProjection>();
    for (let index = 0; index < 3; index += 1) {
      sources.set(`observation:${index}`, source(`event:observation:${index}`, 'observation_recorded'));
      sources.set(`resolution:${index}`, source(`event:resolution:${index}`, 'resolution_asserted'));
    }
    expect(resolveCardSources(card, sources)?.sources.every((item) => item.drilldown)).toBe(true);
    sources.delete('resolution:2');
    expect(resolveCardSources(card, sources)).toBeNull();
  });
});
