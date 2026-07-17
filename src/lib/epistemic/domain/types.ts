export type AuthoredProvenance =
  | 'direct_user_command'
  | 'elicited_user'
  | 'host_reported'
  | 'ai_surfaced'
  | 'imported_unverified'
  | 'legacy_unknown';

export interface Authored<T> {
  value: T;
  provenance: AuthoredProvenance;
  source_ref: string;
  recorded_at: string;
}

export type AuthorityActorType = 'user' | 'system' | 'migration' | 'imported_unverified';
export type ClaimLifecycle = 'candidate' | 'endorsed' | 'contested' | 'retired' | 'forgotten';
export type ClaimSupportState = 'insufficient' | 'emerging' | 'supported' | 'contested';
export type ClaimKind = 'descriptive_sequence' | 'contextual_preference' | 'personal_principle' | 'causal_hypothesis';
export type InfluenceEffect = 'retrieve_only' | 'ask_once' | 'adapt_generation';
export type InfluenceSurface = 'web' | 'mcp' | 'plugin';

export interface ModelLineage {
  provider: string;
  model_family: string;
  model_id: string;
  prompt_hash: string;
  extractor_or_stage_version: string;
  source_input_cluster_ids: string[];
}

export interface AuthoritySupportUnit {
  support_unit_id: string;
  claim_id: string;
  case_id: string;
  resolution_event_ref: string;
  observation_ref: string;
  observation_authority: 'user' | 'external_reality' | 'ai_only';
  causal_cluster_id: string;
  source_cluster_id: string;
  model_lineages: ModelLineage[];
  valid_time?: string;
  verification_state: 'resolved' | 'unresolved' | 'contested' | 'superseded';
}

export interface AuthorityClaimScope {
  domains: string[];
  project_ids?: string[];
  roles?: string[];
  valid_from?: string;
  review_by?: string;
}

export interface AuthorityGrantScope {
  domain?: string;
  project_id?: string;
  session_id?: string;
}

export interface AuthorityGrantState {
  grant_id: string;
  revision: number;
  effect: InfluenceEffect;
  surfaces: InfluenceSurface[];
  scope: Authored<AuthorityGrantScope>;
  starts_at: string;
  expires_at?: string;
  status: 'active' | 'revoked' | 'expired' | 'needs_reconfirmation';
  authority_epoch: number;
}

export interface AuthorityCounterexample {
  counterexample_ref: string;
  material: boolean;
  authored: Authored<string>;
}

export interface ClaimAuthorityState {
  claim_id: string;
  aggregate_version: number;
  authority_epoch: number;
  statement: Authored<string> | null;
  claim_kind: ClaimKind | null;
  scope: Authored<AuthorityClaimScope> | null;
  support_units: AuthoritySupportUnit[];
  counterexamples: AuthorityCounterexample[];
  lifecycle: ClaimLifecycle;
  support_state: ClaimSupportState;
  grants: Record<string, AuthorityGrantState>;
  forgotten_at?: string;
  last_event_id?: string;
}

export function emptyClaimAuthorityState(claimId: string): ClaimAuthorityState {
  return {
    claim_id: claimId,
    aggregate_version: 0,
    authority_epoch: 0,
    statement: null,
    claim_kind: null,
    scope: null,
    support_units: [],
    counterexamples: [],
    lifecycle: 'candidate',
    support_state: 'insufficient',
    grants: {},
  };
}

export interface AccountContinuityPolicy {
  account_id: string;
  erasure_epoch: number;
  retention_policy: 'local_default' | 'account_default' | 'custom';
  sync_origins: string[];
  blocked_origins: string[];
}

export type AuthorityProjectionStatus = 'complete' | 'blocked_unknown' | 'invalid';

export interface AuthorityProjection<T> {
  state: T;
  status: AuthorityProjectionStatus;
  projection_version: number;
  source_cursor: number;
  source_checksum: string;
  unknown_count: number;
  invalid_count: number;
  minimum_reader_version?: number;
}
