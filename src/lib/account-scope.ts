/**
 * Whose work is on this device?
 *
 * localStorage-first means every sot_* key is a bare pile of rows with no owner
 * written on it. That silence is the root of a real production failure
 * (2026-07-30): a browser signed in as account A, lost its session, signed in as
 * account B, and every push of A's rows was correctly refused by RLS — the same
 * poisoned batch retried forever, so NOTHING (not even B's own new work) was ever
 * backed up again. The badge said "백업 보류" and could never clear.
 *
 * Two independent detectors, because they cover different holes:
 *
 *  1. OWNER STAMP (proactive, and the only thing that catches the leak). Records
 *     which account the local pile belongs to. Checked BEFORE any write, so
 *     account B never pushes A's rows at all. This also closes a quieter hole the
 *     server cannot: a row created under A that never reached the server has no
 *     remote owner, so an upsert as B SUCCEEDS and A's private work silently
 *     becomes B's. No RLS error, no signal — exactly the "plausible passes for
 *     correct" failure the LLM-glue invariant warns about.
 *
 *  2. FOREIGN-ROW QUARANTINE (reactive, server truth). A row rejected with
 *     Postgres 42501 provably belongs to another account. Needed because browsers
 *     that predate the stamp (every browser already in the wild, including the
 *     one that found this bug) have nothing to compare against. Quarantined ids
 *     are dropped from the pending set so the retry loop terminates.
 *
 * Neither detector deletes anything on its own. Both surface the situation and
 * hand the choice back to the user (ForeignDataNotice) — an honest gap, never a
 * silent repair.
 */

import { getStorage, setStorage, removeStorage, STORAGE_KEYS } from './storage';

export interface DataOwner {
  /** auth user id the local sot_* pile belongs to. */
  userId: string;
  /** Best-effort label so the notice can name the account. May be absent. */
  email?: string;
}

/** Table → row ids the server proved belong to a different account. */
type ForeignRegistry = Record<string, string[]>;

export interface ForeignDataSummary {
  /** Total quarantined rows across every table. */
  rows: number;
  /** Decisions specifically — the user's unit, for the notice copy. */
  projects: number;
  /** Account the local pile was stamped to, when known. */
  previousEmail?: string;
  /** How it was detected — the notice wording differs. */
  reason: 'stamp' | 'rejected';
}

export const FOREIGN_DATA_EVENT = 'argus:foreign-data';

// ── owner stamp ─────────────────────────────────────────────────────────────

export function readDataOwner(): DataOwner | null {
  const raw = getStorage<DataOwner | null>(STORAGE_KEYS.DATA_OWNER, null);
  if (!raw || typeof raw !== 'object' || typeof raw.userId !== 'string' || !raw.userId) return null;
  return raw;
}

/**
 * Claim the local pile for a permanent account. Called only once the account may
 * legitimately own it: after a clean sign-in with no mismatch, or right after the
 * user resolves a mismatch. Anonymous sessions are deliberately NEVER stamped —
 * the anonymous→account transfer re-keys those rows server-side (verified working
 * 2026-07-30), and a stamp would turn that healthy path into a false mismatch.
 */
export function stampDataOwner(userId: string, email?: string | null): void {
  if (!userId) return;
  setStorage<DataOwner>(STORAGE_KEYS.DATA_OWNER, email ? { userId, email } : { userId });
}

export function clearDataOwner(): void {
  removeStorage(STORAGE_KEYS.DATA_OWNER);
}

/**
 * True when this device's pile is stamped to a DIFFERENT permanent account.
 * An absent stamp is not a mismatch: it means "unknown", which is the state of
 * every browser that existed before this shipped and of every anonymous visitor.
 */
export function localDataBelongsToAnotherAccount(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const owner = readDataOwner();
  return !!owner && owner.userId !== userId;
}

// ── foreign-row quarantine ──────────────────────────────────────────────────

/**
 * Postgres 42501. PostgREST surfaces an upsert whose UPDATE half fails the
 * policy's USING expression as `new row violates row-level security policy
 * (USING expression) for table "x"` — i.e. the row exists and someone else owns
 * it. Matched on the code first; the message is the fallback for older builds.
 */
export function isForeignOwnerError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42501') return true;
  return /row-level security policy/i.test(error.message || '');
}

function readRegistry(): ForeignRegistry {
  const raw = getStorage<ForeignRegistry>(STORAGE_KEYS.FOREIGN_ROWS, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/** Row ids to leave out of the pending-upload set for this table. */
export function getForeignIds(table: string): Set<string> {
  return new Set(readRegistry()[table] || []);
}

/** Record ids the server refused as another account's. Idempotent. */
export function markForeignRows(table: string, ids: string[]): void {
  if (!ids.length) return;
  const registry = readRegistry();
  registry[table] = [...new Set([...(registry[table] || []), ...ids.filter(Boolean)])];
  setStorage(STORAGE_KEYS.FOREIGN_ROWS, registry);
}

export function clearForeignRows(): void {
  removeStorage(STORAGE_KEYS.FOREIGN_ROWS);
}

export function foreignRowCounts(): { rows: number; projects: number } {
  const registry = readRegistry();
  return {
    rows: Object.values(registry).reduce((n, ids) => n + ids.length, 0),
    projects: (registry.projects || []).length,
  };
}

/**
 * Tell the app that this device is holding another account's work. Fires a window
 * event (no store import — same pure-module discipline as sync-health) consumed
 * by ForeignDataNotice. Silent when there is nothing to report, so a healthy
 * session never renders the banner.
 */
export function announceForeignData(reason: ForeignDataSummary['reason']): void {
  if (typeof window === 'undefined') return;
  // 'rejected' counts what the server actually refused. 'stamp' fires BEFORE any
  // write, so there is nothing refused yet — there the whole local pile is the
  // other account's, and the honest number is what the user can see on screen.
  const counts = reason === 'stamp' ? localPileCounts() : foreignRowCounts();
  if (counts.rows === 0) return;
  const detail: ForeignDataSummary = { ...counts, previousEmail: readDataOwner()?.email, reason };
  window.dispatchEvent(new CustomEvent(FOREIGN_DATA_EVENT, { detail }));
}

/**
 * The local keys that hold ACCOUNT-OWNED rows — i.e. exactly what changes hands
 * when the device changes account. Deliberately not "every STORAGE_KEY": SETTINGS
 * carries the user's own API key and the flags are device state, so a reset must
 * not touch them.
 *
 * This list has to stay equal to the persistence contract's `synced` set;
 * `account-scope.test.ts` fails if the two drift, because a key missing here is a
 * row that survives the reset and re-poisons the next account.
 */
export const ACCOUNT_SCOPED_KEYS: readonly string[] = [
  STORAGE_KEYS.PROJECTS,
  STORAGE_KEYS.PROGRESSIVE_SESSIONS,
  STORAGE_KEYS.PERSONAS,
  STORAGE_KEYS.FEEDBACK_HISTORY,
  STORAGE_KEYS.JUDGMENTS,
  STORAGE_KEYS.ACCURACY_RATINGS,
  STORAGE_KEYS.QUALITY_SIGNALS,
  STORAGE_KEYS.OUTCOME_RECORDS,
  STORAGE_KEYS.RETROSPECTIVE_ANSWERS,
  STORAGE_KEYS.DQ_SCORES,
  STORAGE_KEYS.REFRAME_LIST,
  STORAGE_KEYS.RECAST_LIST,
  STORAGE_KEYS.SYNTHESIZE_LIST,
  STORAGE_KEYS.AGENTS,
  STORAGE_KEYS.AGENT_CHAINS,
  STORAGE_KEYS.AGENT_ACTIVITIES,
  STORAGE_KEYS.DECISION_ITEMS,
  STORAGE_KEYS.REVIEW_RECEIPTS,
];

/**
 * The user chose "start fresh on this account": drop the other account's pile
 * from this device and hand ownership to the signed-in account. Their own rows
 * come back from the server on the next load.
 *
 * Only ever called from the user's own tap. Whatever of that pile already reached
 * the cloud stays safe under its real owner; whatever never did is genuinely gone
 * — which is why the notice says so plainly instead of this function guessing.
 */
export function discardForeignLocalData(userId: string, email?: string | null): void {
  ACCOUNT_SCOPED_KEYS.forEach(removeStorage);
  clearForeignRows();
  stampDataOwner(userId, email);
}

/**
 * Which account to NAME in the notice, if any.
 *
 * The stamp is not automatically the other account. On a browser that predates
 * the stamp, sign-in stamps the CURRENT user before the first rejected push is
 * even attempted — so a naive read makes the notice tell the user their own
 * address is "another account", which is worse than saying nothing. Naming is
 * only allowed when the label provably differs from who is signed in.
 */
export function otherAccountLabel(
  stampedEmail: string | undefined,
  currentEmail: string | null | undefined,
): string | undefined {
  if (!stampedEmail) return undefined;
  if (currentEmail && stampedEmail.toLowerCase() === currentEmail.toLowerCase()) return undefined;
  return stampedEmail;
}

/** Size of the local pile, in the user's unit (decisions) plus a row total. */
function localPileCounts(): { rows: number; projects: number } {
  const projects = getStorage<unknown[]>(STORAGE_KEYS.PROJECTS, []).length;
  const sessions = getStorage<unknown[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, []).length;
  return { rows: projects + sessions, projects };
}
