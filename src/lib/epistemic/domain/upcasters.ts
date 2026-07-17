import { authorityChecksum } from './checksum';
import {
  AUTHORITY_EVENT_SCHEMA_VERSION,
  type AuthorityEvent,
  type AuthorityEventEnvelope,
  type AuthorityEventType,
} from './events';
import { reduceAuthorityEvent } from './reducer';
import {
  emptyClaimAuthorityState,
  type Authored,
  type AuthorityProjection,
  type ClaimAuthorityState,
} from './types';

export type AuthorityEventReadResult =
  | { status: 'ok'; event: AuthorityEvent }
  | { status: 'unknown'; minimum_reader_version: number; reason: string }
  | { status: 'invalid'; reason: string };

const EVENT_TYPES = new Set<AuthorityEventType>([
  'claim_proposed',
  'claim_endorsed',
  'claim_reopened',
  'claim_retired',
  'claim_reworded',
  'claim_contested',
  'counterexample_added',
  'influence_granted',
  'influence_revoked',
  'ask_once_rearmed',
  'claim_grants_invalidated',
  'claim_forgotten',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validEnvelope(value: Record<string, unknown>): boolean {
  return value.aggregate_type === 'claim'
    && nonEmpty(value.aggregate_id)
    && nonNegativeInteger(value.aggregate_version)
    && Number(value.aggregate_version) > 0
    && nonNegativeInteger(value.authority_epoch)
    && nonEmpty(value.event_id)
    && nonEmpty(value.command_id)
    && nonEmpty(value.idempotency_key)
    && nonEmpty(value.semantic_fingerprint)
    && nonEmpty(value.user_id)
    && ['user', 'system', 'migration', 'imported_unverified'].includes(String(value.actor_type))
    && nonEmpty(value.origin_id)
    && (value.origin_sequence === undefined || nonNegativeInteger(value.origin_sequence))
    && validIso(value.occurred_at)
    && validIso(value.recorded_at)
    && (value.payload_ref === undefined || nonEmpty(value.payload_ref));
}

function validCurrentPayload(eventType: AuthorityEventType, payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  switch (eventType) {
    case 'claim_proposed':
      return isRecord(payload.statement) && isRecord(payload.scope)
        && Array.isArray(payload.support_units)
        && ['insufficient', 'emerging', 'supported', 'contested'].includes(String(payload.support_state));
    case 'claim_endorsed':
    case 'claim_reopened':
    case 'claim_retired':
      return payload.reason === undefined || isRecord(payload.reason);
    case 'claim_reworded':
      return isRecord(payload.statement) && (payload.reason === undefined || isRecord(payload.reason));
    case 'claim_contested':
      return isRecord(payload.reason);
    case 'counterexample_added':
      return nonEmpty(payload.counterexample_ref) && typeof payload.material === 'boolean'
        && isRecord(payload.authored);
    case 'influence_granted':
      return nonEmpty(payload.grant_id) && nonNegativeInteger(payload.revision)
        && Number(payload.revision) > 0 && isRecord(payload.scope)
        && Array.isArray(payload.surfaces) && validIso(payload.starts_at)
        && (payload.expires_at === undefined || validIso(payload.expires_at));
    case 'influence_revoked':
      return nonEmpty(payload.grant_id) && (payload.reason === undefined || isRecord(payload.reason));
    case 'ask_once_rearmed':
      return nonEmpty(payload.grant_id) && nonNegativeInteger(payload.revision)
        && Number(payload.revision) > 0;
    case 'claim_grants_invalidated':
      return ['reword', 'contest', 'reopen', 'retire', 'material_counterexample', 'forget']
        .includes(String(payload.reason));
    case 'claim_forgotten':
      return nonEmpty(payload.confirmation_provenance) && nonEmpty(payload.confirmation_source_ref);
  }
}

function legacyAuthored(value: unknown, recordedAt: string, sourceRef: string): Authored<string> {
  if (isRecord(value) && typeof value.value === 'string') {
    return {
      value: value.value,
      provenance: 'legacy_unknown',
      source_ref: nonEmpty(value.source_ref) ? value.source_ref : sourceRef,
      recorded_at: validIso(value.recorded_at) ? value.recorded_at : recordedAt,
    };
  }
  return {
    value: typeof value === 'string' ? value : '',
    provenance: 'legacy_unknown',
    source_ref: sourceRef,
    recorded_at: recordedAt,
  };
}

/**
 * V1 was never allowed to manufacture user authorship. The compatibility
 * upcaster preserves its text but marks every unproven authored field as
 * legacy_unknown.
 */
function upcastV1(raw: Record<string, unknown>): Record<string, unknown> {
  const payload = isRecord(raw.payload) ? { ...raw.payload } : {};
  const eventType = String(raw.event_type);
  const sourceRef = `legacy-event:${String(raw.event_id)}`;
  const recordedAt = validIso(raw.recorded_at) ? raw.recorded_at : new Date(0).toISOString();

  if (eventType === 'claim_proposed' || eventType === 'claim_reworded') {
    payload.statement = legacyAuthored(payload.statement, recordedAt, sourceRef);
  }
  if (eventType === 'claim_proposed') {
    payload.scope = isRecord(payload.scope) && 'value' in payload.scope
      ? { ...payload.scope, provenance: 'legacy_unknown' }
      : {
          value: isRecord(payload.scope) ? payload.scope : { domains: [] },
          provenance: 'legacy_unknown',
          source_ref: sourceRef,
          recorded_at: recordedAt,
        };
  }
  if (['claim_endorsed', 'claim_reopened', 'claim_retired', 'claim_reworded', 'influence_revoked']
    .includes(eventType) && payload.reason !== undefined) {
    payload.reason = legacyAuthored(payload.reason, recordedAt, sourceRef);
  }
  if (eventType === 'claim_contested') {
    payload.reason = legacyAuthored(payload.reason, recordedAt, sourceRef);
  }
  if (eventType === 'counterexample_added') {
    payload.authored = legacyAuthored(payload.authored ?? payload.observation, recordedAt, sourceRef);
  }
  if (eventType === 'influence_granted') {
    payload.scope = isRecord(payload.scope) && 'value' in payload.scope
      ? { ...payload.scope, provenance: 'legacy_unknown' }
      : {
          value: isRecord(payload.scope) ? payload.scope : {},
          provenance: 'legacy_unknown',
          source_ref: sourceRef,
          recorded_at: recordedAt,
        };
  }
  return { ...raw, schema_version: AUTHORITY_EVENT_SCHEMA_VERSION, payload };
}

export function readAuthorityEvent(raw: unknown): AuthorityEventReadResult {
  if (!isRecord(raw)) return { status: 'invalid', reason: 'event must be an object' };
  if (!nonNegativeInteger(raw.schema_version) || Number(raw.schema_version) < 1) {
    return { status: 'invalid', reason: 'schema_version is missing or invalid' };
  }
  if (Number(raw.schema_version) > AUTHORITY_EVENT_SCHEMA_VERSION) {
    return {
      status: 'unknown',
      minimum_reader_version: Number(raw.schema_version),
      reason: `event schema v${String(raw.schema_version)} requires a newer reader`,
    };
  }
  const current = Number(raw.schema_version) === 1 ? upcastV1(raw) : raw;
  if (!validEnvelope(current)) return { status: 'invalid', reason: 'invalid event envelope' };
  if (!EVENT_TYPES.has(current.event_type as AuthorityEventType)) {
    return {
      status: 'unknown',
      minimum_reader_version: AUTHORITY_EVENT_SCHEMA_VERSION,
      reason: `unknown event type: ${String(current.event_type)}`,
    };
  }
  const eventType = current.event_type as AuthorityEventType;
  if (!validCurrentPayload(eventType, current.payload)) {
    return { status: 'invalid', reason: `invalid payload for ${eventType}` };
  }
  return { status: 'ok', event: current as unknown as AuthorityEvent };
}

export function projectRawAuthorityEvents(
  claimId: string,
  rawEvents: readonly unknown[],
): AuthorityProjection<ClaimAuthorityState> {
  let state = emptyClaimAuthorityState(claimId);
  let cursor = 0;
  for (const raw of rawEvents) {
    const read = readAuthorityEvent(raw);
    if (read.status === 'unknown') {
      return {
        state,
        status: 'blocked_unknown',
        projection_version: 1,
        source_cursor: cursor,
        source_checksum: authorityChecksum(rawEvents.slice(0, cursor)),
        unknown_count: 1,
        invalid_count: 0,
        minimum_reader_version: read.minimum_reader_version,
      };
    }
    if (read.status === 'invalid') {
      return {
        state,
        status: 'invalid',
        projection_version: 1,
        source_cursor: cursor,
        source_checksum: authorityChecksum(rawEvents.slice(0, cursor)),
        unknown_count: 0,
        invalid_count: 1,
      };
    }
    try {
      state = reduceAuthorityEvent(state, read.event);
      cursor += 1;
    } catch {
      return {
        state,
        status: 'invalid',
        projection_version: 1,
        source_cursor: cursor,
        source_checksum: authorityChecksum(rawEvents.slice(0, cursor)),
        unknown_count: 0,
        invalid_count: 1,
      };
    }
  }
  return {
    state,
    status: 'complete',
    projection_version: 1,
    source_cursor: cursor,
    source_checksum: authorityChecksum(rawEvents),
    unknown_count: 0,
    invalid_count: 0,
  };
}

export function currentEventEnvelope(event: AuthorityEvent): AuthorityEventEnvelope {
  return event;
}
