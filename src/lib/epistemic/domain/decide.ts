import type { AuthorityCommand } from './commands';
import type { AuthorityEvent, AuthorityEventEnvelope } from './events';
import { AUTHORITY_EVENT_SCHEMA_VERSION } from './events';
import { authorityChecksum } from './checksum';
import type { Authored, AuthoritySupportUnit, ClaimAuthorityState } from './types';

export class AuthorityDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorityDecisionError';
  }
}

function semanticCommand(command: AuthorityCommand): Record<string, unknown> {
  const semantic: Record<string, unknown> = { ...command };
  delete semantic.semantic_fingerprint;
  delete semantic.command_id;
  delete semantic.occurred_at;
  return semantic;
}

export function commandSemanticFingerprint(command: AuthorityCommand): string {
  return authorityChecksum(semanticCommand(command));
}

export function hasIndependentRealitySupport(units: readonly AuthoritySupportUnit[]): boolean {
  const resolved = units.filter((unit) =>
    unit.verification_state === 'resolved'
    && unit.observation_authority !== 'ai_only'
    && unit.causal_cluster_id !== 'unknown_shared'
    && unit.source_cluster_id !== 'unknown_shared');
  const unique = (values: string[]) => new Set(values.filter(Boolean)).size;
  return resolved.length >= 3
    && unique(resolved.map((unit) => unit.support_unit_id)) >= 3
    && unique(resolved.map((unit) => unit.case_id)) >= 3
    && unique(resolved.map((unit) => unit.resolution_event_ref)) >= 3
    && unique(resolved.map((unit) => unit.observation_ref)) >= 3
    && unique(resolved.map((unit) => unit.causal_cluster_id)) >= 3
    && unique(resolved.map((unit) => unit.source_cluster_id)) >= 3;
}

function validIso(value: string | undefined): boolean {
  return value === undefined || Number.isFinite(Date.parse(value));
}

function validRequiredIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validAuthored<T>(value: Authored<T> | undefined): value is Authored<T> {
  return !!value
    && ['direct_user_command', 'elicited_user', 'host_reported', 'ai_surfaced', 'imported_unverified', 'legacy_unknown']
      .includes(value.provenance)
    && typeof value.source_ref === 'string' && value.source_ref.trim().length > 0
    && validRequiredIso(value.recorded_at);
}

function assertEnvelope(command: AuthorityCommand): void {
  if (command.schema_version !== 1) throw new AuthorityDecisionError('unsupported command schema');
  for (const value of [
    command.command_id,
    command.idempotency_key,
    command.semantic_fingerprint,
    command.user_id,
    command.claim_id,
    command.origin_id,
  ]) {
    if (!value.trim()) throw new AuthorityDecisionError('command envelope contains an empty identifier');
  }
  if (!Number.isInteger(command.expected_aggregate_version) || command.expected_aggregate_version < 0
    || !Number.isInteger(command.expected_authority_epoch) || command.expected_authority_epoch < 0
    || !Number.isInteger(command.account_erasure_epoch) || command.account_erasure_epoch < 0) {
    throw new AuthorityDecisionError('command versions must be non-negative integers');
  }
  if (!validIso(command.occurred_at)) throw new AuthorityDecisionError('occurred_at is invalid');
  if (command.semantic_fingerprint !== commandSemanticFingerprint(command)) {
    throw new AuthorityDecisionError('semantic fingerprint does not match command payload');
  }
}

function isDirectUserText(provenance: string): boolean {
  return provenance === 'direct_user_command' || provenance === 'elicited_user';
}

function eventEnvelope(args: {
  command: AuthorityCommand;
  eventType: AuthorityEvent['event_type'];
  aggregateVersion: number;
  authorityEpoch: number;
  eventIndex: number;
  recordedAt: string;
  originSequence?: number;
}): AuthorityEventEnvelope {
  return {
    schema_version: AUTHORITY_EVENT_SCHEMA_VERSION,
    aggregate_type: 'claim',
    aggregate_id: args.command.claim_id,
    aggregate_version: args.aggregateVersion,
    authority_epoch: args.authorityEpoch,
    event_id: `${args.command.command_id}:${args.eventIndex}`,
    event_type: args.eventType,
    command_id: args.command.command_id,
    idempotency_key: args.command.idempotency_key,
    semantic_fingerprint: args.command.semantic_fingerprint,
    user_id: args.command.user_id,
    actor_type: args.command.actor_type,
    origin_id: args.command.origin_id,
    origin_sequence: args.originSequence,
    occurred_at: args.command.occurred_at,
    recorded_at: args.recordedAt,
  };
}

export function decideAuthorityCommand(args: {
  state: ClaimAuthorityState;
  command: AuthorityCommand;
  recorded_at: string;
  origin_sequence_start?: number;
}): AuthorityEvent[] {
  const { state, command } = args;
  assertEnvelope(command);
  if (state.lifecycle === 'forgotten') throw new AuthorityDecisionError('claim is forgotten');

  let version = state.aggregate_version;
  let index = 0;
  const events: AuthorityEvent[] = [];
  const push = <T extends AuthorityEvent>(
    eventType: T['event_type'],
    authorityEpoch: number,
    payload: T['payload'],
  ) => {
    version += 1;
    const envelope = eventEnvelope({
      command,
      eventType,
      aggregateVersion: version,
      authorityEpoch,
      eventIndex: index,
      recordedAt: args.recorded_at,
      originSequence: args.origin_sequence_start === undefined
        ? undefined
        : args.origin_sequence_start + index,
    });
    index += 1;
    events.push({ ...envelope, event_type: eventType, payload } as T);
  };
  const bumpEpoch = state.authority_epoch + 1;
  const invalidate = (
    epoch: number,
    reason: Extract<AuthorityEvent, { event_type: 'claim_grants_invalidated' }>['payload']['reason'],
  ) => push<Extract<AuthorityEvent, { event_type: 'claim_grants_invalidated' }>>(
    'claim_grants_invalidated', epoch, { reason },
  );

  switch (command.type) {
    case 'ProposeClaim':
      if (state.aggregate_version !== 0 || state.statement
        || !validAuthored(command.statement) || !validAuthored(command.scope)
        || command.statement.value.trim().length === 0
        || command.scope.value.domains.length === 0
        || !['descriptive_sequence', 'contextual_preference', 'personal_principle', 'causal_hypothesis']
          .includes(command.claim_kind)
        || command.support_units.some((unit) => unit.claim_id !== command.claim_id)
        || (command.support_state === 'supported'
          && !hasIndependentRealitySupport(command.support_units))) {
        throw new AuthorityDecisionError('invalid claim proposal');
      }
      push<Extract<AuthorityEvent, { event_type: 'claim_proposed' }>>(
        'claim_proposed', 1, {
          statement: command.statement,
          claim_kind: command.claim_kind,
          scope: command.scope,
          support_units: command.support_units,
          support_state: command.support_state,
        },
      );
      break;
    case 'ReviewClaim':
      if (command.actor_type !== 'user') throw new AuthorityDecisionError('review requires user actor');
      if (!['endorse', 'reopen', 'retire'].includes(command.action)
        || (command.reason !== undefined && !validAuthored(command.reason))) {
        throw new AuthorityDecisionError('invalid review action');
      }
      if (command.action === 'endorse') {
        if (state.lifecycle !== 'candidate') throw new AuthorityDecisionError('only a candidate can be endorsed');
        push<Extract<AuthorityEvent, { event_type: 'claim_endorsed' }>>(
          'claim_endorsed', state.authority_epoch, { reason: command.reason },
        );
      } else if (command.action === 'reopen') {
        if (!['contested', 'retired'].includes(state.lifecycle)) {
          throw new AuthorityDecisionError('only contested or retired claim can reopen');
        }
        push<Extract<AuthorityEvent, { event_type: 'claim_reopened' }>>(
          'claim_reopened', bumpEpoch, { reason: command.reason },
        );
        invalidate(bumpEpoch, 'reopen');
      } else {
        if (state.lifecycle === 'retired') throw new AuthorityDecisionError('claim is already retired');
        push<Extract<AuthorityEvent, { event_type: 'claim_retired' }>>(
          'claim_retired', bumpEpoch, { reason: command.reason },
        );
        invalidate(bumpEpoch, 'retire');
      }
      break;
    case 'RewordClaim':
      if (command.actor_type !== 'user' || !validAuthored(command.statement)
        || !isDirectUserText(command.statement.provenance)
        || (command.reason !== undefined && !validAuthored(command.reason))
        || !command.statement.value.trim()) {
        throw new AuthorityDecisionError('reword requires direct user wording');
      }
      push<Extract<AuthorityEvent, { event_type: 'claim_reworded' }>>(
        'claim_reworded', bumpEpoch, { statement: command.statement, reason: command.reason },
      );
      invalidate(bumpEpoch, 'reword');
      break;
    case 'ContestClaim':
      if (command.actor_type !== 'user' || !validAuthored(command.reason)) {
        throw new AuthorityDecisionError('contest requires user actor and authored reason');
      }
      push<Extract<AuthorityEvent, { event_type: 'claim_contested' }>>(
        'claim_contested', bumpEpoch, { reason: command.reason },
      );
      invalidate(bumpEpoch, 'contest');
      break;
    case 'AddCounterexample': {
      if (!command.counterexample_ref.trim() || !validAuthored(command.observation)
        || !command.observation.value.trim()) {
        throw new AuthorityDecisionError('counterexample requires a source and observation');
      }
      const epoch = command.material ? bumpEpoch : state.authority_epoch;
      push<Extract<AuthorityEvent, { event_type: 'counterexample_added' }>>(
        'counterexample_added', epoch, {
          counterexample_ref: command.counterexample_ref,
          material: command.material,
          authored: command.observation,
        },
      );
      if (command.material) invalidate(epoch, 'material_counterexample');
      break;
    }
    case 'GrantInfluence': {
      const userOwnedPrinciple = state.claim_kind === 'personal_principle'
        && !!state.statement && isDirectUserText(state.statement.provenance);
      const evidenceEligible = state.support_state === 'supported'
        && hasIndependentRealitySupport(state.support_units);
      if (command.actor_type !== 'user' || state.lifecycle !== 'endorsed'
        || (!userOwnedPrinciple && !evidenceEligible)
        || !validAuthored(command.scope) || !isDirectUserText(command.scope.provenance)
        || !['retrieve_only', 'ask_once', 'adapt_generation'].includes(command.effect)
        || command.surfaces.length === 0
        || command.surfaces.some((surface) => !['web', 'mcp', 'plugin'].includes(surface))
        || !validRequiredIso(command.starts_at)
        || !validIso(command.expires_at)
        || (command.expires_at && Date.parse(command.expires_at) < Date.parse(command.starts_at))) {
        throw new AuthorityDecisionError('claim is not eligible for an influence grant');
      }
      const prior = state.grants[command.grant_id];
      if (prior && prior.status === 'active') throw new AuthorityDecisionError('grant is already active');
      push<Extract<AuthorityEvent, { event_type: 'influence_granted' }>>(
        'influence_granted', state.authority_epoch, {
          grant_id: command.grant_id,
          revision: (prior?.revision ?? 0) + 1,
          effect: command.effect,
          surfaces: [...new Set(command.surfaces)],
          scope: command.scope,
          starts_at: command.starts_at,
          expires_at: command.expires_at,
        },
      );
      break;
    }
    case 'RevokeInfluence':
      if (command.actor_type !== 'user' || !command.grant_id.trim()
        || (command.reason !== undefined && !validAuthored(command.reason))
        || state.grants[command.grant_id]?.status !== 'active') {
        throw new AuthorityDecisionError('only an active grant can be revoked by the user');
      }
      push<Extract<AuthorityEvent, { event_type: 'influence_revoked' }>>(
        'influence_revoked', state.authority_epoch, {
          grant_id: command.grant_id,
          reason: command.reason,
        },
      );
      break;
    case 'RearmAskOnce': {
      const grant = state.grants[command.grant_id];
      if (command.actor_type !== 'user' || !command.grant_id.trim()
        || !grant || grant.effect !== 'ask_once'
        || grant.status !== 'active') {
        throw new AuthorityDecisionError('rearm requires an active ask_once grant');
      }
      push<Extract<AuthorityEvent, { event_type: 'ask_once_rearmed' }>>(
        'ask_once_rearmed', state.authority_epoch, {
          grant_id: command.grant_id,
          revision: grant.revision + 1,
        },
      );
      break;
    }
    case 'ForgetClaim':
      if (command.actor_type !== 'user'
        || !validAuthored(command.confirmation)
        || !isDirectUserText(command.confirmation.provenance)
        || !command.confirmation.value.trim()) {
        throw new AuthorityDecisionError('forget requires direct user confirmation');
      }
      push<Extract<AuthorityEvent, { event_type: 'claim_forgotten' }>>(
        'claim_forgotten', bumpEpoch, {
          confirmation_provenance: command.confirmation.provenance,
          confirmation_source_ref: command.confirmation.source_ref,
        },
      );
      break;
  }
  return events;
}
