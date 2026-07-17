import type { SelfKnowledgeClaim, SupportUnit } from '../types';
import type {
  AuthoredProvenance,
  AuthoritySupportUnit,
  ClaimAuthorityState,
} from './types';

function legacyProvenance(claim: SelfKnowledgeClaim): AuthoredProvenance {
  if (claim.wording_source === 'user_authored') return 'direct_user_command';
  if (claim.wording_source === 'user_reworded') return 'elicited_user';
  return 'legacy_unknown';
}

function supportUnit(claimId: string, value: SupportUnit): AuthoritySupportUnit {
  return {
    ...value,
    claim_id: claimId,
    model_lineages: value.model_lineage_ids.map((lineageId) => ({
      provider: 'legacy_unknown',
      model_family: 'legacy_unknown',
      model_id: lineageId,
      prompt_hash: 'legacy_unknown',
      extractor_or_stage_version: 'e2-compatibility',
      source_input_cluster_ids: [value.source_cluster_id],
    })),
  };
}

/**
 * Read-only E2 bridge. It deliberately returns a compatibility projection,
 * not fabricated authority events or grants.
 */
export function projectE2Claim(claim: SelfKnowledgeClaim): ClaimAuthorityState {
  const recordedAt = claim.reviewed_at ?? claim.created_at;
  return {
    claim_id: claim.claim_id,
    aggregate_version: 0,
    authority_epoch: 0,
    statement: {
      value: claim.statement,
      provenance: legacyProvenance(claim),
      source_ref: `legacy:e2:claim:${claim.claim_id}`,
      recorded_at: recordedAt,
    },
    claim_kind: claim.claim_kind,
    scope: {
      value: claim.scope,
      provenance: 'legacy_unknown',
      source_ref: `legacy:e2:scope:${claim.claim_id}`,
      recorded_at: recordedAt,
    },
    support_units: (claim.support_units ?? []).map((unit) => supportUnit(claim.claim_id, unit)),
    counterexamples: claim.counterexample_refs.map((ref) => ({
      counterexample_ref: ref,
      material: claim.lifecycle === 'contested',
      authored: {
        value: '',
        provenance: 'legacy_unknown',
        source_ref: ref,
        recorded_at: recordedAt,
      },
    })),
    lifecycle: claim.lifecycle,
    support_state: claim.support_state,
    grants: {},
  };
}
