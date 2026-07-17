import { authorityChecksum } from './domain/checksum';
import type { AuthorityCommand, AuthorityCommandReceipt } from './domain/commands';
import { commandSemanticFingerprint, decideAuthorityCommand } from './domain/decide';
import { reduceAuthorityEvent } from './domain/reducer';
import { projectRawAuthorityEvents } from './domain/upcasters';

// Supabase is intentionally untyped in this repository. Keep the unsafe SDK
// boundary here instead of spreading it into domain/application code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export type ServerAuthorityResult =
  | { ok: true; receipt: AuthorityCommandReceipt }
  | { ok: false; code: string; current?: { aggregate_version: number; authority_epoch: number } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function commandEnvelope(value: unknown): value is AuthorityCommand {
  if (!isRecord(value)) return false;
  return value.schema_version === 1
    && typeof value.type === 'string'
    && ['ProposeClaim', 'ReviewClaim', 'RewordClaim', 'ContestClaim', 'AddCounterexample',
      'GrantInfluence', 'RevokeInfluence', 'RearmAskOnce', 'ForgetClaim'].includes(value.type)
    && typeof value.command_id === 'string' && value.command_id.trim().length > 0
    && typeof value.idempotency_key === 'string' && value.idempotency_key.trim().length > 0
    && typeof value.semantic_fingerprint === 'string' && value.semantic_fingerprint.trim().length > 0
    && typeof value.user_id === 'string' && value.user_id.trim().length > 0
    && typeof value.claim_id === 'string' && value.claim_id.trim().length > 0
    && Number.isInteger(value.expected_aggregate_version) && Number(value.expected_aggregate_version) >= 0
    && Number.isInteger(value.expected_authority_epoch) && Number(value.expected_authority_epoch) >= 0
    && Number.isInteger(value.account_erasure_epoch) && Number(value.account_erasure_epoch) >= 0
    && ['user', 'system', 'migration', 'imported_unverified'].includes(String(value.actor_type))
    && typeof value.origin_id === 'string' && value.origin_id.trim().length > 0
    && typeof value.occurred_at === 'string' && Number.isFinite(Date.parse(value.occurred_at));
}

function receiptFromRow(row: Record<string, unknown>, status: 'exact_retry'): AuthorityCommandReceipt | null {
  if (!Array.isArray(row.event_ids)) return null;
  return {
    command_id: String(row.command_id),
    claim_id: String(row.claim_id),
    status,
    event_ids: row.event_ids.filter((id): id is string => typeof id === 'string'),
    aggregate_version: Number(row.aggregate_version),
    authority_epoch: Number(row.authority_epoch),
    current_state_checksum: String(row.state_checksum),
  };
}

export async function readServerAuthorityEvents(
  admin: AdminClient,
  userId: string,
  claimId: string,
): Promise<unknown[] | null> {
  const { data, error } = await admin
    .from('epistemic_authority_events')
    .select('event')
    .eq('user_id', userId)
    .eq('aggregate_type', 'claim')
    .eq('aggregate_id', claimId)
    .order('aggregate_version', { ascending: true });
  if (error) return null;
  return (data ?? []).map((row: { event: unknown }) => row.event);
}

async function readPriorReceipt(
  admin: AdminClient,
  userId: string,
  command: AuthorityCommand,
): Promise<{ row: Record<string, unknown> | null; failed: boolean }> {
  const { data, error } = await admin
    .from('epistemic_command_receipts')
    .select('*')
    .eq('user_id', userId)
    .eq('origin_id', command.origin_id)
    .eq('idempotency_key', command.idempotency_key)
    .maybeSingle();
  if (error) return { row: null, failed: true };
  return { row: isRecord(data) ? data : null, failed: false };
}

/**
 * Authenticated command gateway. Only this server path creates events; the
 * database RPC re-checks concurrency, erasure epoch, origin, and batch shape
 * under the claim advisory lock.
 */
export async function executeServerAuthorityCommand(
  admin: AdminClient,
  authenticatedUserId: string,
  value: unknown,
  recordedAt = new Date().toISOString(),
): Promise<ServerAuthorityResult> {
  if (!commandEnvelope(value)) return { ok: false, code: 'INVALID_COMMAND' };
  const command = value;
  if (command.user_id !== authenticatedUserId) return { ok: false, code: 'WRONG_OWNER' };
  try {
    if (command.semantic_fingerprint !== commandSemanticFingerprint(command)) {
      return { ok: false, code: 'INVALID_FINGERPRINT' };
    }
  } catch {
    return { ok: false, code: 'INVALID_COMMAND' };
  }

  const prior = await readPriorReceipt(admin, authenticatedUserId, command);
  if (prior.failed) return { ok: false, code: 'READ_FAILED' };
  if (prior.row) {
    if (prior.row.semantic_fingerprint !== command.semantic_fingerprint) {
      return { ok: false, code: 'IDEMPOTENCY_CONFLICT' };
    }
    const receipt = receiptFromRow(prior.row, 'exact_retry');
    return receipt ? { ok: true, receipt } : { ok: false, code: 'INVALID_RECEIPT' };
  }

  const rawEvents = await readServerAuthorityEvents(admin, authenticatedUserId, command.claim_id);
  if (!rawEvents) return { ok: false, code: 'READ_FAILED' };
  const projection = projectRawAuthorityEvents(command.claim_id, rawEvents);
  if (projection.status !== 'complete') {
    return { ok: false, code: projection.status === 'blocked_unknown' ? 'UNKNOWN_EVENT' : 'INVALID_STREAM' };
  }
  if (command.expected_aggregate_version !== projection.state.aggregate_version) {
    return {
      ok: false,
      code: 'STALE_AGGREGATE_VERSION',
      current: {
        aggregate_version: projection.state.aggregate_version,
        authority_epoch: projection.state.authority_epoch,
      },
    };
  }
  if (command.expected_authority_epoch !== projection.state.authority_epoch) {
    return {
      ok: false,
      code: 'STALE_AUTHORITY_EPOCH',
      current: {
        aggregate_version: projection.state.aggregate_version,
        authority_epoch: projection.state.authority_epoch,
      },
    };
  }

  let events;
  let checksum;
  try {
    events = decideAuthorityCommand({ state: projection.state, command, recorded_at: recordedAt });
    checksum = authorityChecksum(events.reduce(reduceAuthorityEvent, projection.state));
  } catch {
    return { ok: false, code: 'ILLEGAL_TRANSITION' };
  }

  // The projection already proved rawEvents are current AuthorityEvent values.
  // Re-projecting the appended batch gives the exact state checksum sent to the
  // locked RPC and recorded in the durable command receipt.
  const nextProjection = projectRawAuthorityEvents(command.claim_id, [...rawEvents, ...events]);
  if (nextProjection.status !== 'complete') return { ok: false, code: 'INVALID_EVENT_BATCH' };
  checksum = authorityChecksum(nextProjection.state);

  const { data, error } = await admin.rpc('append_epistemic_authority_command', {
    p_user_id: authenticatedUserId,
    p_claim_id: command.claim_id,
    p_expected_version: command.expected_aggregate_version,
    p_expected_epoch: command.expected_authority_epoch,
    p_erasure_epoch: command.account_erasure_epoch,
    p_origin_id: command.origin_id,
    p_idempotency_key: command.idempotency_key,
    p_semantic_fingerprint: command.semantic_fingerprint,
    p_command_id: command.command_id,
    p_state_checksum: checksum,
    p_events: events,
  });
  if (error) {
    const message = String(error.message ?? '');
    const known = [
      'IDEMPOTENCY_CONFLICT', 'STALE_ERASURE_EPOCH', 'STALE_AGGREGATE_VERSION',
      'STALE_AUTHORITY_EPOCH', 'BLOCKED_ORIGIN', 'INVALID_EVENT_BATCH', 'ERASED_SUBJECT',
    ].find((code) => message.includes(code));
    return { ok: false, code: known ?? 'APPEND_FAILED' };
  }
  if (!isRecord(data)) return { ok: false, code: 'RECEIPT_UNAVAILABLE' };
  const receipt: AuthorityCommandReceipt = {
    command_id: String(data.command_id),
    claim_id: String(data.claim_id),
    status: data.status === 'exact_retry' ? 'exact_retry' : 'applied',
    event_ids: Array.isArray(data.event_ids)
      ? data.event_ids.filter((id): id is string => typeof id === 'string') : [],
    aggregate_version: Number(data.aggregate_version),
    authority_epoch: Number(data.authority_epoch),
    current_state_checksum: String(data.current_state_checksum),
  };
  return { ok: true, receipt };
}
