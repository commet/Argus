export interface ContinuityHealthInput {
  canonical_cursor: string | null;
  projection_cursor: string | null;
  outbox_pending: number;
  queue: { pending: number; retrying: number; exhausted: number };
  artifacts: { staged: number; quarantined: number; unavailable: number };
  last_success: string | null;
  last_error_code: string | null;
  local_archive_path: string | null;
  backup_at: string | null;
  now?: string;
}

export interface ContinuityHealth extends Omit<ContinuityHealthInput, 'queue' | 'artifacts' | 'backup_at' | 'now'> {
  queue_pending: number;
  queue_retrying: number;
  queue_exhausted: number;
  artifact_staged: number;
  artifact_quarantined: number;
  artifact_unavailable: number;
  backup_age_ms: number | null;
  states: Array<
    | 'stored_on_device'
    | 'account_sync_pending'
    | 'account_stored'
    | 'search_projection_pending'
    | 'source_unavailable'
    | 'worker_retrying'
    | 'worker_exhausted'
  >;
}

/** One vocabulary for storage, projection, queue, and artifact truth. It keeps
 * these states separate so a UI cannot collapse them into an ambiguous “saved”. */
export function deriveContinuityHealth(input: ContinuityHealthInput): ContinuityHealth {
  const numeric = [input.outbox_pending, input.queue.pending, input.queue.retrying, input.queue.exhausted,
    input.artifacts.staged, input.artifacts.quarantined, input.artifacts.unavailable];
  if (numeric.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('CONTINUITY_HEALTH_INVALID_COUNT');
  }
  const states: ContinuityHealth['states'] = ['stored_on_device'];
  if (input.outbox_pending > 0) states.push('account_sync_pending');
  else if (input.canonical_cursor) states.push('account_stored');
  if (input.canonical_cursor !== input.projection_cursor || input.queue.pending > 0 || input.artifacts.staged > 0) {
    states.push('search_projection_pending');
  }
  if (input.artifacts.unavailable > 0 || input.artifacts.quarantined > 0) states.push('source_unavailable');
  if (input.queue.retrying > 0) states.push('worker_retrying');
  if (input.queue.exhausted > 0) states.push('worker_exhausted');
  const now = Date.parse(input.now ?? new Date().toISOString());
  const backup = input.backup_at ? Date.parse(input.backup_at) : NaN;
  return {
    canonical_cursor: input.canonical_cursor,
    projection_cursor: input.projection_cursor,
    outbox_pending: input.outbox_pending,
    queue_pending: input.queue.pending,
    queue_retrying: input.queue.retrying,
    queue_exhausted: input.queue.exhausted,
    artifact_staged: input.artifacts.staged,
    artifact_quarantined: input.artifacts.quarantined,
    artifact_unavailable: input.artifacts.unavailable,
    last_success: input.last_success,
    last_error_code: input.last_error_code,
    local_archive_path: input.local_archive_path,
    backup_age_ms: Number.isFinite(backup) && Number.isFinite(now) ? Math.max(0, now - backup) : null,
    states,
  };
}
