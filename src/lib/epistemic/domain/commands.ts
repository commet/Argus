import type {
  Authored,
  AuthorityActorType,
  AuthorityClaimScope,
  AuthorityGrantScope,
  AuthoritySupportUnit,
  ClaimKind,
  ClaimSupportState,
  InfluenceEffect,
  InfluenceSurface,
} from './types';

export interface AuthorityCommandEnvelope {
  schema_version: 1;
  command_id: string;
  idempotency_key: string;
  semantic_fingerprint: string;
  user_id: string;
  claim_id: string;
  expected_aggregate_version: number;
  expected_authority_epoch: number;
  account_erasure_epoch: number;
  actor_type: AuthorityActorType;
  origin_id: string;
  occurred_at: string;
}

export interface ProposeClaimCommand extends AuthorityCommandEnvelope {
  type: 'ProposeClaim';
  statement: Authored<string>;
  claim_kind: ClaimKind;
  scope: Authored<AuthorityClaimScope>;
  support_units: AuthoritySupportUnit[];
  support_state: ClaimSupportState;
}

export interface ReviewClaimCommand extends AuthorityCommandEnvelope {
  type: 'ReviewClaim';
  action: 'endorse' | 'reopen' | 'retire';
  reason?: Authored<string>;
}

export interface RewordClaimCommand extends AuthorityCommandEnvelope {
  type: 'RewordClaim';
  statement: Authored<string>;
  reason?: Authored<string>;
}

export interface ContestClaimCommand extends AuthorityCommandEnvelope {
  type: 'ContestClaim';
  reason: Authored<string>;
}

export interface AddCounterexampleCommand extends AuthorityCommandEnvelope {
  type: 'AddCounterexample';
  counterexample_ref: string;
  material: boolean;
  observation: Authored<string>;
}

export interface GrantInfluenceCommand extends AuthorityCommandEnvelope {
  type: 'GrantInfluence';
  grant_id: string;
  effect: InfluenceEffect;
  surfaces: InfluenceSurface[];
  scope: Authored<AuthorityGrantScope>;
  starts_at: string;
  expires_at?: string;
}

export interface RevokeInfluenceCommand extends AuthorityCommandEnvelope {
  type: 'RevokeInfluence';
  grant_id: string;
  reason?: Authored<string>;
}

export interface RearmAskOnceCommand extends AuthorityCommandEnvelope {
  type: 'RearmAskOnce';
  grant_id: string;
}

export interface ForgetClaimCommand extends AuthorityCommandEnvelope {
  type: 'ForgetClaim';
  confirmation: Authored<string>;
}

export type AuthorityCommand =
  | ProposeClaimCommand
  | ReviewClaimCommand
  | RewordClaimCommand
  | ContestClaimCommand
  | AddCounterexampleCommand
  | GrantInfluenceCommand
  | RevokeInfluenceCommand
  | RearmAskOnceCommand
  | ForgetClaimCommand;

export type AuthorityCommandRejection =
  | 'invalid_command'
  | 'wrong_owner'
  | 'blocked_origin'
  | 'stale_erasure_epoch'
  | 'stale_aggregate_version'
  | 'stale_authority_epoch'
  | 'idempotency_conflict'
  | 'illegal_transition'
  | 'claim_forgotten';

export interface AuthorityCommandReceipt {
  command_id: string;
  claim_id: string;
  status: 'applied' | 'exact_retry' | 'rejected';
  event_ids: string[];
  aggregate_version: number;
  authority_epoch: number;
  rejection?: AuthorityCommandRejection;
  current_state_checksum: string;
}
