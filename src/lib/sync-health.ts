/**
 * Observable async-write health.
 *
 * Fire-and-forget Supabase writes (db.insertToSupabase, loadAndMerge's local-only
 * push, analytics.track) used to swallow failures into the log, so a user whose
 * work wasn't backing up to the cloud had zero signal. reportSyncFailure() makes
 * those failures observable: it bumps a per-session counter and (for real data
 * writes) dispatches `argus:sync`, consumed by the SyncStatus badge — which
 * auto-recovers so the indicator never sticks.
 *
 * Pure module (no store/db/logger import) → safe to call from any layer without
 * the circular-dependency risk documented in storage.ts.
 */

let sessionSyncFailures = 0;

/** Number of swallowed async-write failures this session (a readable canary). */
export function getSyncFailureCount(): number {
  return sessionSyncFailures;
}

/**
 * Report a CONFIRMED successful user-data write. The SyncStatus badge starts
 * 'idle' (no badge) and only turns green after this fires — "synced" is a
 * verified fact, never an optimistic default. Called from db.ts success
 * branches (P1-C1); also clears a lingering error/backup_pending state.
 */
export function reportSyncSuccess(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('argus:sync', { detail: { status: 'synced' } }));
  }
}

/**
 * @param context  short tag of the failing write, e.g. `insert:signals`.
 * @param opts.surface  whether to flip the SyncStatus badge (true for user-data
 *   writes; false for non-critical telemetry, which only increments the counter).
 */
export function reportSyncFailure(
  context: string,
  opts: { message?: string; surface?: boolean } = {},
): void {
  sessionSyncFailures++;
  const surface = opts.surface ?? true;
  if (surface && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('argus:sync', {
        detail: { status: 'error', context, message: opts.message },
      }),
    );
  }
}
