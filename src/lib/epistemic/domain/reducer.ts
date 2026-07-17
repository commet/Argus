import type { AuthorityEvent } from './events';
import { authorityChecksum } from './checksum';
import {
  emptyClaimAuthorityState,
  type AuthorityProjection,
  type ClaimAuthorityState,
} from './types';

export class AuthorityReducerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorityReducerError';
  }
}

function assertSequence(state: ClaimAuthorityState, event: AuthorityEvent): void {
  if (event.aggregate_id !== state.claim_id) {
    throw new AuthorityReducerError('aggregate_id does not match claim state');
  }
  if (event.aggregate_version !== state.aggregate_version + 1) {
    throw new AuthorityReducerError('aggregate_version is not contiguous');
  }
  if (event.authority_epoch < state.authority_epoch) {
    throw new AuthorityReducerError('authority_epoch moved backwards');
  }
  if (event.authority_epoch > state.authority_epoch + 1) {
    throw new AuthorityReducerError('authority_epoch skipped a value');
  }
}

export function reduceAuthorityEvent(
  current: ClaimAuthorityState,
  event: AuthorityEvent,
): ClaimAuthorityState {
  assertSequence(current, event);
  const state: ClaimAuthorityState = {
    ...current,
    grants: { ...current.grants },
    aggregate_version: event.aggregate_version,
    authority_epoch: event.authority_epoch,
    last_event_id: event.event_id,
  };

  switch (event.event_type) {
    case 'claim_proposed':
      if (current.aggregate_version !== 0 || current.statement) {
        throw new AuthorityReducerError('claim_proposed requires an empty aggregate');
      }
      return {
        ...state,
        statement: event.payload.statement,
        claim_kind: event.payload.claim_kind,
        scope: event.payload.scope,
        support_units: [...event.payload.support_units],
        support_state: event.payload.support_state,
        lifecycle: 'candidate',
      };
    case 'claim_endorsed':
      return { ...state, lifecycle: 'endorsed' };
    case 'claim_reopened':
      return {
        ...state,
        lifecycle: 'candidate',
        support_state: current.support_state === 'contested' ? 'emerging' : current.support_state,
      };
    case 'claim_retired':
      return { ...state, lifecycle: 'retired' };
    case 'claim_reworded':
      return { ...state, statement: event.payload.statement };
    case 'claim_contested':
      return { ...state, lifecycle: 'contested', support_state: 'contested' };
    case 'counterexample_added':
      return {
        ...state,
        counterexamples: [...current.counterexamples, event.payload],
        lifecycle: event.payload.material ? 'contested' : current.lifecycle,
        support_state: event.payload.material ? 'contested' : current.support_state,
      };
    case 'influence_granted':
      return {
        ...state,
        grants: {
          ...state.grants,
          [event.payload.grant_id]: {
            ...event.payload,
            status: 'active',
            authority_epoch: event.authority_epoch,
          },
        },
      };
    case 'influence_revoked': {
      const grant = state.grants[event.payload.grant_id];
      if (!grant) throw new AuthorityReducerError('cannot revoke an unknown grant');
      state.grants[event.payload.grant_id] = { ...grant, status: 'revoked' };
      return state;
    }
    case 'ask_once_rearmed': {
      const grant = state.grants[event.payload.grant_id];
      if (!grant || grant.effect !== 'ask_once') {
        throw new AuthorityReducerError('only an existing ask_once grant can be rearmed');
      }
      state.grants[event.payload.grant_id] = {
        ...grant,
        revision: event.payload.revision,
        status: 'active',
        authority_epoch: event.authority_epoch,
      };
      return state;
    }
    case 'claim_grants_invalidated':
      for (const [grantId, grant] of Object.entries(state.grants)) {
        if (grant.status === 'active') state.grants[grantId] = { ...grant, status: 'revoked' };
      }
      return state;
    case 'claim_forgotten':
      return {
        ...state,
        statement: null,
        scope: null,
        support_units: [],
        counterexamples: [],
        lifecycle: 'forgotten',
        support_state: 'insufficient',
        grants: Object.fromEntries(Object.entries(state.grants).map(([id, grant]) => [
          id,
          { ...grant, status: 'revoked' as const },
        ])),
        forgotten_at: event.recorded_at,
      };
  }
}

export function foldAuthorityEvents(
  claimId: string,
  events: readonly AuthorityEvent[],
): ClaimAuthorityState {
  return events.reduce(reduceAuthorityEvent, emptyClaimAuthorityState(claimId));
}

export function projectAuthorityEvents(
  claimId: string,
  events: readonly AuthorityEvent[],
): AuthorityProjection<ClaimAuthorityState> {
  let state = emptyClaimAuthorityState(claimId);
  let invalidCount = 0;
  let cursor = 0;
  try {
    for (const event of events) {
      state = reduceAuthorityEvent(state, event);
      cursor += 1;
    }
  } catch {
    invalidCount += 1;
    return {
      state,
      status: 'invalid',
      projection_version: 1,
      source_cursor: cursor,
      source_checksum: authorityChecksum(events.slice(0, cursor)),
      unknown_count: 0,
      invalid_count: invalidCount,
    };
  }
  return {
    state,
    status: 'complete',
    projection_version: 1,
    source_cursor: cursor,
    source_checksum: authorityChecksum(events),
    unknown_count: 0,
    invalid_count: 0,
  };
}
