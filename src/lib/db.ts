import { supabase, getCurrentUserId } from './supabase';
import { getStorage, setStorage } from './storage';
import { handleError } from './error-handler';
import { log } from './logger';
import { reportSyncFailure } from './sync-health';

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
  | 'plugin_decisions' | 'plugin_bearings';

type SoftDeletableTable = 'projects' | 'personas' | 'reframe_items' | 'recast_items' | 'synthesize_items';

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

    if (error || !data) return local;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remote = ((data || []) as any[]).filter((r) => !r.deleted_at) as T[];
    const merged = mergeByTimestamp(local, remote);

    // Save merged back to localStorage
    setStorage(storageKey, merged);

    // Push any local-only items to Supabase
    const remoteIds = new Set(remote.map(r => r.id));
    const localOnly = merged.filter(m => !remoteIds.has(m.id));
    if (localOnly.length > 0) {
      await supabase
        .from(table)
        .upsert(localOnly.map(item => ({ ...sanitizeItem(item), user_id: userId })), { onConflict: 'id' })
        .then(({ error }) => { if (error) { log.error(`push local-only to ${table}: ${error.message}`, { context: 'db' }); reportSyncFailure(`push:${table}`, { message: error.message }); } });
    }

    return merged;
  } catch (err) {
    handleError(err, `db.loadAndMerge:${table}`);
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

  try {
    const itemsWithUser = localItems.map((item) => ({
      ...sanitizeItem(item),
      user_id: userId,
    }));

    const { error } = await supabase
      .from(table)
      .upsert(itemsWithUser, { onConflict: 'id' });

    if (error) {
      log.error(`sync to ${table} failed: ${error.message}`, { context: 'db' });
    }
  } catch (err) {
    log.error(`sync to ${table} error`, { context: 'db', data: err });
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

    if (error) return [];
    return (data || []) as T[];
  } catch (err) {
    handleError(err, `db.fetch:${table}`);
    return [];
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
      .upsert({ ...sanitizeItem(item), user_id: userId }, { onConflict: 'id' });

    if (error) {
      log.error(`upsert to ${table} failed: ${error.message}`, { context: 'db' });
      // Light the SyncStatus badge — this is the cloud-persistence path for
      // sealed decision contracts, predicate grades and the full voyage
      // document. A silent failure here = the user's actual decision never
      // reaches the cloud, with zero signal (insert/loadAndMerge already report;
      // this path was the one omission). 2026-06-13 data-wiring audit.
      reportSyncFailure(`upsert:${table}`, { message: error.message });
    }
  } catch (err) {
    handleError(err, `db.upsert:${table}`);
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
export async function deleteAllUserData(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const tables: TableName[] = [
    'agent_activities', 'agent_chains', 'agents',
    'outcome_records', 'retrospective_answers', 'decision_quality_scores',
    'quality_signals', 'accuracy_ratings', 'feedback_records', 'judgment_records',
    'reframe_items', 'recast_items', 'synthesize_items',
    'personas', 'projects',
    'progressive_sessions',
  ];

  for (const table of tables) {
    try {
      await supabase.from(table).delete().eq('user_id', userId);
    } catch (err) {
      handleError(err, `db.deleteAll:${table}`);
    }
  }
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
