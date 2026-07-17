/**
 * E-track authority records.
 *
 * These are projections and permissions around self-knowledge. They never
 * replace K's canonical knowledge objects; `support_refs` may hold read-only K
 * ids or explicit `legacy:` references, but this namespace never mutates K.
 */

export type SelfKnowledgeClaimKind =
  | 'descriptive_sequence'
  | 'contextual_preference'
  | 'personal_principle'
  | 'causal_hypothesis';

export type SelfKnowledgeLifecycle = 'candidate' | 'endorsed' | 'contested' | 'retired';
export type InfluenceEffect = 'retrieve_only' | 'ask_once' | 'adapt_generation';
export type InfluenceSurface = 'web' | 'mcp' | 'plugin';
export type InfluencePurpose = 'ordinary_generation' | 'explicit_recall';

export type SupportObservationAuthority = 'user' | 'external_reality' | 'ai_only';
export type SupportVerificationState = 'resolved' | 'unresolved' | 'contested' | 'superseded';

/**
 * One independently testable reality unit. Model diversity is metadata, never
 * proof of independence: three models summarizing one source still form one
 * causal/source cluster.
 */
export interface SupportUnit {
  support_unit_id: string;
  case_id: string;
  resolution_event_ref: string;
  observation_ref: string;
  observation_authority: SupportObservationAuthority;
  causal_cluster_id: string;
  source_cluster_id: string;
  model_lineage_ids: string[];
  valid_time?: string;
  verification_state: SupportVerificationState;
}

export interface SelfKnowledgeClaim {
  claim_id: string;
  claim_kind: SelfKnowledgeClaimKind;
  statement: string;
  scope: {
    domains: string[];
    project_ids?: string[];
    roles?: string[];
    valid_from?: string;
    review_by?: string;
  };
  support_refs: string[];
  /** Missing on legacy E2 records. Absence never synthesizes independence. */
  support_units?: SupportUnit[];
  counterexample_refs: string[];
  /** Explicit, source-backed conflict relations used by the deterministic gate. */
  conflict_refs?: string[];
  unsearched_counterexample_scope: string[];
  /** @deprecated Legacy summary metadata; never used to prove minimum support. */
  independence: {
    unit_count: number;
    lineage_ids: string[];
    resolved_case_count: number;
  };
  support_state: 'insufficient' | 'emerging' | 'supported' | 'contested';
  lifecycle: SelfKnowledgeLifecycle;
  wording_source: 'system_proposed' | 'user_reworded' | 'user_authored';
  created_at: string;
  reviewed_at?: string;
}

export interface InfluenceGrant {
  grant_id: string;
  claim_id: string;
  effect: InfluenceEffect;
  surfaces: InfluenceSurface[];
  scope: {
    domain?: string;
    project_id?: string;
    session_id?: string;
  };
  starts_at: string;
  expires_at?: string;
  authorized_by: 'user';
  status: 'active' | 'revoked' | 'expired';
}

export type InfluenceExclusionReason =
  | 'no_grant'
  | 'not_endorsed'
  | 'insufficient_support'
  | 'not_started'
  | 'out_of_scope'
  | 'expired'
  | 'revoked'
  | 'already_used'
  | 'budget_exceeded'
  | 'invalid_claim'
  | 'trace_write_failed'
  | 'purpose_mismatch'
  | 'conflicting_authority'
  | 'influence_cap_exceeded'
  | 'contested'
  | 'retired';

export interface InfluenceTrace {
  trace_id: string;
  call_id: string;
  surface: InfluenceSurface;
  used: Array<{
    claim_id: string;
    grant_id: string;
    effect: InfluenceEffect;
    prompt_section: string;
  }>;
  excluded: Array<{
    claim_id: string;
    reason: InfluenceExclusionReason;
    /** Other claims that caused a deterministic conflict exclusion. */
    related_claim_ids?: string[];
  }>;
  created_at: string;
}

export interface ClaimReviewEvent {
  event_id: string;
  claim_id: string;
  action: 'endorse' | 'reword' | 'contest' | 'retire' | 'reopen';
  user_wording?: string;
  reason?: string;
  occurred_at: string;
}

export interface InfluenceContext {
  call_id: string;
  surface: InfluenceSurface;
  purpose?: InfluencePurpose;
  domain?: string;
  project_id?: string;
  session_id?: string;
  role?: string;
  prompt_budget_chars?: number;
  now?: string;
}

export interface PromptInfluenceDecision {
  prompt_sections: string[];
  trace: InfluenceTrace;
}
