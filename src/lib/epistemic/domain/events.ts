import type {
  Authored,
  AuthorityActorType,
  AuthorityClaimScope,
  AuthorityCounterexample,
  AuthorityGrantScope,
  AuthoritySupportUnit,
  ClaimKind,
  ClaimSupportState,
  InfluenceEffect,
  InfluenceSurface,
} from './types';

export const AUTHORITY_EVENT_SCHEMA_VERSION = 2 as const;

export interface AuthorityEventEnvelope {
  schema_version: typeof AUTHORITY_EVENT_SCHEMA_VERSION;
  aggregate_type: 'claim';
  aggregate_id: string;
  aggregate_version: number;
  authority_epoch: number;
  event_id: string;
  event_type: AuthorityEventType;
  command_id: string;
  idempotency_key: string;
  semantic_fingerprint: string;
  user_id: string;
  actor_type: AuthorityActorType;
  origin_id: string;
  origin_sequence?: number;
  occurred_at: string;
  recorded_at: string;
  payload_ref?: string;
}

export type AuthorityEventType =
  | 'claim_proposed'
  | 'claim_endorsed'
  | 'claim_reopened'
  | 'claim_retired'
  | 'claim_reworded'
  | 'claim_contested'
  | 'counterexample_added'
  | 'influence_granted'
  | 'influence_revoked'
  | 'ask_once_rearmed'
  | 'claim_grants_invalidated'
  | 'claim_forgotten';

export interface ClaimProposedEvent extends AuthorityEventEnvelope {
  event_type: 'claim_proposed';
  payload: {
    statement: Authored<string>;
    claim_kind: ClaimKind;
    scope: Authored<AuthorityClaimScope>;
    support_units: AuthoritySupportUnit[];
    support_state: ClaimSupportState;
  };
}

export interface ClaimEndorsedEvent extends AuthorityEventEnvelope {
  event_type: 'claim_endorsed';
  payload: { reason?: Authored<string> };
}

export interface ClaimReopenedEvent extends AuthorityEventEnvelope {
  event_type: 'claim_reopened';
  payload: { reason?: Authored<string> };
}

export interface ClaimRetiredEvent extends AuthorityEventEnvelope {
  event_type: 'claim_retired';
  payload: { reason?: Authored<string> };
}

export interface ClaimRewordedEvent extends AuthorityEventEnvelope {
  event_type: 'claim_reworded';
  payload: { statement: Authored<string>; reason?: Authored<string> };
}

export interface ClaimContestedEvent extends AuthorityEventEnvelope {
  event_type: 'claim_contested';
  payload: { reason: Authored<string> };
}

export interface CounterexampleAddedEvent extends AuthorityEventEnvelope {
  event_type: 'counterexample_added';
  payload: AuthorityCounterexample;
}

export interface InfluenceGrantedEvent extends AuthorityEventEnvelope {
  event_type: 'influence_granted';
  payload: {
    grant_id: string;
    revision: number;
    effect: InfluenceEffect;
    surfaces: InfluenceSurface[];
    scope: Authored<AuthorityGrantScope>;
    starts_at: string;
    expires_at?: string;
  };
}

export interface InfluenceRevokedEvent extends AuthorityEventEnvelope {
  event_type: 'influence_revoked';
  payload: { grant_id: string; reason?: Authored<string> };
}

export interface AskOnceRearmedEvent extends AuthorityEventEnvelope {
  event_type: 'ask_once_rearmed';
  payload: { grant_id: string; revision: number };
}

export interface ClaimGrantsInvalidatedEvent extends AuthorityEventEnvelope {
  event_type: 'claim_grants_invalidated';
  payload: { reason: 'reword' | 'contest' | 'reopen' | 'retire' | 'material_counterexample' | 'forget' };
}

export interface ClaimForgottenEvent extends AuthorityEventEnvelope {
  event_type: 'claim_forgotten';
  payload: {
    confirmation_provenance: Authored<string>['provenance'];
    confirmation_source_ref: string;
  };
}

export type AuthorityEvent =
  | ClaimProposedEvent
  | ClaimEndorsedEvent
  | ClaimReopenedEvent
  | ClaimRetiredEvent
  | ClaimRewordedEvent
  | ClaimContestedEvent
  | CounterexampleAddedEvent
  | InfluenceGrantedEvent
  | InfluenceRevokedEvent
  | AskOnceRearmedEvent
  | ClaimGrantsInvalidatedEvent
  | ClaimForgottenEvent;
