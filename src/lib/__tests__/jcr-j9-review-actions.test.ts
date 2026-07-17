import { describe, expect, it } from 'vitest';
import { commandSemanticFingerprint } from '@/lib/epistemic/domain/decide';
import { emptyClaimAuthorityState, type AccountContinuityPolicy, type ClaimAuthorityState } from '@/lib/epistemic/domain/types';
import { buildE3BAuthorityCommand, parseE3BReviewAction } from '@/lib/epistemic/server-review';

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
});
