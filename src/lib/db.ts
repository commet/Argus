import { supabase, getCurrentUserId } from './supabase';
import { getStorage, setStorage } from './storage';
import { handleError } from './error-handler';
import { log } from './logger';
import { reportSyncFailure, reportSyncSuccess } from './sync-health';
import {
  announceForeignData,
  getForeignIds,
  isForeignOwnerError,
  localDataBelongsToAnotherAccount,
  markForeignRows,
} from './account-scope';

/**
 * Database abstraction layer.
 *
 * Strategy: "localStorage first, Supabase merge"
 * - On load: localStorage (instant) → fetch Supabase → merge by updated_at
 * - On write: localStorage (instant) + Supabase (async)
 * - This ensures the app works offline AND syncs across devices.
 */

type TableName = 'projects' | 'personas' | 'reframe_items' | 'recast_items'
  | 'feedback_records' | 'judgment_records' | 'accuracy_ratings'
  | 'quality_signals' | 'outcome_records' | 'retrospective_answers' | 'decision_quality_scores'
  | 'agents' | 'agent_chains' | 'agent_activities'
  | 'synthesize_items'
  | 'progressive_sessions'
  | 'plugin_decisions' | 'plugin_bearings' | 'plugin_events'
  | 'decision_items' | 'review_receipts';

type SoftDeletableTable = 'projects' | 'personas' | 'reframe_items' | 'recast_items' | 'synthesize_items' | 'review_receipts';

/**
 * Built-in agents and chains deliberately use stable semantic IDs (for example
 * "hayoon" and "research") on every account. Their database identity is
 * therefore (id, user_id), not id alone. Keeping this in one helper prevents
 * one write path from quietly reverting to the global-ID assumption.
 */
function upsertConflictTarget(table: TableName): string {
  return table === 'agents' || table === 'agent_chains' ? 'id,user_id' : 'id';
}

/**
 * Strip fields that must only be set by the server/database.
 *
 * - user_id: always set by getCurrentUserId(), never from client
 * - created_at/updated_at: set by DB triggers (update_updated_at),
 *   stripping prevents merge-logic manipulation via future timestamps
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeItem(item: any): any {
  if (!item || typeof item !== 'object') return item;
  const {
    user_id: _uid,
    created_at: _ca,
    updated_at: _ua,
    ...rest
  } = item;
  return rest;
}

/**
 * Upper bound on the one-by-one retry below. A pathological pile (hundreds of
 * rows) must not turn one failed batch into a request storm; past the cap the
 * remainder keeps the ordinary batch failure. Logged, never silent — a truncated
 * sweep that reports success reads as "all covered" when it wasn't.
 */
const PER_ROW_RETRY_CAP = 300;

interface PushOutcome {
  pushed: number;
  /** ids the server proved belong to another account (42501). */
  foreign: string[];
  /** rows that failed for any other reason — a real, retryable sync failure. */
  failed: number;
  message?: string;
}

/**
 * Push rows for the signed-in account, surviving a single poisoned row.
 *
 * A PostgREST upsert of N rows is ONE statement: if the server refuses one row,
 * all N roll back. That is how a browser carrying another account's decisions
 * stopped backing up the user's OWN new work — the healthy rows were hostages of
 * the rejected ones, on every load, forever. So on a batch failure we retry row
 * by row: whatever is genuinely this account's lands, and each refusal is
 * attributed to the row that caused it instead of to the whole pile.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pushRowsResilient(table: TableName, rows: any[], userId: string): Promise<PushOutcome> {
  const onConflict = upsertConflictTarget(table);
  const payload = rows.map((item) => ({ ...sanitizeItem(item), user_id: userId }));

  const { error } = await supabase.from(table).upsert(payload, { onConflict });
  if (!error) return { pushed: rows.length, foreign: [], failed: 0 };

  if (rows.length === 1) {
    return isForeignOwnerError(error)
      ? { pushed: 0, foreign: [String(rows[0]?.id)], failed: 0, message: error.message }
      : { pushed: 0, foreign: [], failed: 1, message: error.message };
  }

  const attempts = Math.min(rows.length, PER_ROW_RETRY_CAP);
  if (attempts < rows.length) {
    log.error(`push ${table}: batch refused; retrying only the first ${attempts} of ${rows.length} rows individually`, { context: 'db' });
  }

  let pushed = 0;
  let failed = rows.length - attempts; // rows past the cap stay unbacked — counted, not hidden
  const foreign: string[] = [];
  let message = error.message;
  for (let i = 0; i < attempts; i++) {
    const { error: rowError } = await supabase.from(table).upsert(payload[i], { onConflict });
    if (!rowError) { pushed++; continue; }
    message = rowError.message;
    if (isForeignOwnerError(rowError)) foreign.push(String(rows[i]?.id));
    else failed++;
  }
  return { pushed, foreign, failed, message };
}

// ─── Merge Logic ───

interface Timestamped {
  id: string;
  updated_at?: string;
  created_at?: string;
}

/**
 * Merge local and remote arrays by ID.
 * - Items only in local → keep (created offline)
 * - Items only in remote → keep (from another device)
 * - Items in both → pick the one with newer updated_at
 */
export function mergeByTimestamp<T extends Timestamped>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();

  for (const item of local) {
    map.set(item.id, item);
  }

  for (const item of remote) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const remoteTime = item.updated_at || item.created_at || '';
      const localTime = existing.updated_at || existing.created_at || '';
      if (remoteTime > localTime) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

// ─── Core Operations ───

/**
 * Load + merge: localStorage first (instant), then merge with Supabase (async).
 * Returns merged data. Also saves merged result to both localStorage and Supabase.
 *
 * In-flight dedup (NO result caching): a workspace mount triggers loadProjects
 * from several places at once (Providers, Header, Sidebar, the page) — without
 * dedup each ran its own SELECT * + merge + setStorage. Concurrent callers
 * share the one pending promise; once it settles the entry is dropped, so a
 * later call always re-reads fresh local state (a TTL here would let a stale
 * merge clobber a write made just after the cached load).
 */
const _inflight = new Map<string, Promise<unknown>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadAndMerge<T extends Timestamped>(
  table: TableName,
  storageKey: string,
): Promise<T[]> {
  const pending = _inflight.get(table);
  if (pending) return pending as Promise<T[]>;
  const p = loadAndMergeUncached<T>(table, storageKey).finally(() => _inflight.delete(table));
  _inflight.set(table, p);
  return p;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAndMergeUncached<T extends Timestamped>(
  table: TableName,
  storageKey: string,
): Promise<T[]> {
  const local = getStorage<T[]>(storageKey, []);

  const userId = await getCurrentUserId();
  if (!userId) return local; // Not logged in — use local only

  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      reportSyncFailure(`pull:${table}`, { message: error?.message || 'No data returned' });
      return local;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data || []) as any[];
    // P1-C7 delete propagation: collect tombstoned ids BEFORE filtering them
    // out. A row soft-deleted on another device must (a) drop its local ghost
    // copy here and (b) NOT be classified as local-only — otherwise this loop
    // re-pushed the ghost on every load, forever (the upsert payload carries
    // no deleted_at so the server stayed deleted, but the futile push looped).
    // Removing ghosts BEFORE the localOnly computation fixes both in one cut.
    // Tables without a deleted_at column yield undefined → treated as alive
    // (backward-safe; no schema check needed). Items created on this device
    // and not yet uploaded are never in the tombstone set — safe.
    const tombstoned = new Set(rows.filter((r) => r.deleted_at).map((r) => r.id as string));
    const remote = rows.filter((r) => !r.deleted_at) as T[];
    const merged = mergeByTimestamp(local, remote).filter((m) => !tombstoned.has(m.id));

    // Save merged back to localStorage
    setStorage(storageKey, merged);

    // Retry everything whose local timestamp is newer, not just brand-new IDs.
    // A failed write for an EXISTING decision used to survive the merge locally
    // but was excluded from `localOnly`, leaving cloud backup pending forever
    // until the user happened to edit it again.
    const remoteById = new Map(remote.map((item) => [item.id, item]));
    // Rows the server already proved belong to a different account are excluded,
    // or the pile below re-fails identically on every load and the badge can
    // never clear (2026-07-30: exactly that, permanently).
    const quarantined = getForeignIds(table);
    const pendingUpload = merged.filter((item) => {
      if (quarantined.has(item.id)) return false;
      const remoteItem = remoteById.get(item.id);
      if (!remoteItem) return true;
      const localTime = item.updated_at || item.created_at || '';
      const remoteTime = remoteItem.updated_at || remoteItem.created_at || '';
      return localTime > remoteTime;
    });
    if (pendingUpload.length > 0) {
      // Stamped to someone else → do not write at all. Attempting it either gets
      // refused (the loud case) or, for rows that never reached the server,
      // SUCCEEDS and silently re-homes another account's work under this one.
      // The second is worse for being invisible, so this gate precedes the write.
      if (localDataBelongsToAnotherAccount(userId)) {
        announceForeignData('stamp');
        return merged;
      }
      const outcome = await pushRowsResilient(table, pendingUpload, userId);
      if (outcome.foreign.length > 0) {
        markForeignRows(table, outcome.foreign);
        log.error(`push ${table}: ${outcome.foreign.length} row(s) belong to another account — quarantined`, { context: 'db' });
        announceForeignData('rejected');
      }
      if (outcome.failed > 0) {
        log.error(`push pending local rows to ${table}: ${outcome.message}`, { context: 'db' });
        reportSyncFailure(`push:${table}`, { message: outcome.message });
      } else {
        // Every row this account may own is now in the cloud. The foreign ones are
        // not "pending backup" — they are somebody else's, and the notice says so.
        reportSyncSuccess();
      }
    } else {
      // A successful pull that proves every local row already exists remotely is
      // also a verified sync success. This matters for the visible Retry action:
      // the original write may have completed just after its client timed out,
      // leaving nothing to upload on retry. Without this parity success event the
      // badge remained stuck on "Syncing..." despite a healthy backup.
      reportSyncSuccess();
    }

    return merged;
  } catch (err) {
    handleError(err, `db.loadAndMerge:${table}`);
    reportSyncFailure(`pull:${table}`, { message: err instanceof Error ? err.message : 'unknown' });
    return local; // Network error — fall back to local
  }
}

/**
 * Sync all items from localStorage to Supabase table.
 * Called on write operations to push changes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncToSupabase(table: TableName, localItems: any[]): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId || localItems.length === 0) return;

  // Bulk sweeps of the local pile are gated on ownership; a single row the user
  // is writing right now is not (see upsertToSupabase). The pile is historical
  // and may be another account's; the keystroke is always the current account's.
  if (localDataBelongsToAnotherAccount(userId)) {
    announceForeignData('stamp');
    return;
  }

  try {
    const outcome = await pushRowsResilient(table, localItems, userId);
    if (outcome.foreign.length > 0) {
      markForeignRows(table, outcome.foreign);
      announceForeignData('rejected');
    }
    if (outcome.failed > 0) {
      log.error(`sync to ${table} failed: ${outcome.message}`, { context: 'db' });
      // Surface to the user via the SyncStatus badge — this path carries agents/
      // XP/boss personas and was the only write helper not reporting failures.
      reportSyncFailure(`sync:${table}`, { message: outcome.message });
    } else { reportSyncSuccess(); } // P1-C1: green badge only after a confirmed write
  } catch (err) {
    log.error(`sync to ${table} error`, { context: 'db', data: err });
    reportSyncFailure(`sync:${table}`, { message: err instanceof Error ? err.message : 'unknown' });
  }
}

/**
 * Fetch all items for current user from Supabase.
 */
const ALLOWED_ORDER_COLUMNS = new Set(['created_at', 'updated_at', 'name']);

export async function fetchFromSupabase<T extends Record<string, unknown> | object>(
  table: TableName,
  orderBy: string = 'created_at'
): Promise<T[]> {
  if (!ALLOWED_ORDER_COLUMNS.has(orderBy)) orderBy = 'created_at';
  const userId = await getCurrentUserId();
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order(orderBy, { ascending: true });

    if (error) throw error;
    return (data || []) as T[];
  } catch (err) {
    handleError(err, `db.fetch:${table}`);
    throw err;
  }
}

/**
 * Upsert a single item to Supabase (async, fire-and-forget).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertToSupabase(table: TableName, item: any): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const { error } = await supabase
      .from(table)
      .upsert(
        { ...sanitizeItem(item), user_id: userId },
        { onConflict: upsertConflictTarget(table) },
      );

    if (error) {
      // A single write is never gated on the owner stamp — it carries work the
      // user is doing NOW. But if the server says the row is another account's,
      // record that so the periodic sweeps stop re-offering it and the user is
      // told once, instead of a badge that reddens forever with no explanation.
      if (isForeignOwnerError(error)) {
        markForeignRows(table, [String(item?.id)]);
        log.error(`upsert to ${table}: row belongs to another account — quarantined`, { context: 'db' });
        announceForeignData('rejected');
        return;
      }
      log.error(`upsert to ${table} failed: ${error.message}`, { context: 'db' });
      // Light the SyncStatus badge — this is the cloud-persistence path for
      // sealed decision contracts, predicate grades and the full voyage
      // document. A silent failure here = the user's actual decision never
      // reaches the cloud, with zero signal (insert/loadAndMerge already report;
      // this path was the one omission). 2026-06-13 data-wiring audit.
      reportSyncFailure(`upsert:${table}`, { message: error.message });
    } else { reportSyncSuccess(); } // P1-C1: green badge only after a confirmed write
  } catch (err) {
    handleError(err, `db.upsert:${table}`);
    reportSyncFailure(`upsert:${table}`, { message: err instanceof Error ? err.message : 'unknown' });
  }
}

/**
 * Soft-delete: set deleted_at instead of removing row.
 * localStorage에서는 즉시 제거 (성능), Supabase에만 deleted_at 보존 (복구용).
 */
export async function softDeleteFromSupabase(table: SoftDeletableTable, id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      log.error(`soft delete from ${table} failed: ${error.message}`, { context: 'db' });
      reportSyncFailure(`softDelete:${table}`, { message: error.message });
    }
  } catch (err) {
    handleError(err, `db.softDelete:${table}`);
  }
}

/**
 * Hard-delete an item from Supabase. Used for append-only tables.
 */
export async function deleteFromSupabase(table: TableName, id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      log.error(`delete from ${table} failed: ${error.message}`, { context: 'db' });
      reportSyncFailure(`delete:${table}`, { message: error.message });
    }
  } catch (err) {
    handleError(err, `db.delete:${table}`);
  }
}

/**
 * Delete ALL user data from Supabase (for account reset).
 */
export interface DeletionReceipt {
  ok: boolean;
  identityDeleted: boolean;
  receipt: Record<string, number | string>;
}

/**
 * Provable, complete account erasure. Delegates to the service-role server
 * endpoint, which deletes EVERY user-scoped table (all 29, single-sourced in
 * user-data-tables.ts) plus the auth identity, and returns a receipt.
 *
 * Replaces a broken client loop that covered only 16 tables, swallowed errors (a
 * failed delete reported success), and never removed the identity. Failures now
 * SURFACE (throw) instead of hiding, and the receipt shows what was actually removed.
 */
export async function deleteAllUserData(): Promise<DeletionReceipt> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // Not signed in → no server-side data to erase (anon data is localStorage-only).
    return { ok: true, identityDeleted: false, receipt: {} };
  }

  const res = await fetch('/api/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  let body: DeletionReceipt;
  try {
    body = await res.json();
  } catch {
    throw new Error('Account deletion failed: could not read server response.');
  }
  if (!res.ok || !body.ok) {
    // Never report a partial/failed erasure as success.
    log.error(`account deletion incomplete: ${JSON.stringify(body.receipt)}`, { context: 'db' });
    reportSyncFailure('account-delete', { message: 'erasure incomplete' });
    throw new Error('Account deletion did not complete — some data may remain. Please contact support.');
  }
  return body;
}

/**
 * Insert a single item (no upsert). For append-only tables like judgments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertToSupabase(table: TableName, item: any): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const { error } = await supabase
      .from(table)
      .insert({ ...sanitizeItem(item), user_id: userId });

    if (error) {
      log.error(`insert to ${table} failed: ${error.message}`, { context: 'db' });
      reportSyncFailure(`insert:${table}`, { message: error.message });
    }
  } catch (err) {
    handleError(err, `db.insert:${table}`);
    reportSyncFailure(`insert:${table}`);
  }
}
