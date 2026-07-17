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
  counterexample_refs: string[];
  unsearched_counterexample_scope: string[];
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
