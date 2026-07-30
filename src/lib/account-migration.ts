/**
 * Eager local→account migration on sign-in.
 *
 * Local-first means an anonymous user accumulates work in localStorage; when they
 * later sign in, that work should land in their account. The per-table push
 * already happens lazily inside loadAndMerge (db.ts) the next time each store
 * loads — but that is silent and depends on every store remounting. This makes it
 * eager (run once, right after SIGNED_IN) and reports a count so the user gets the
 * "your work is now saved to your account" confirmation.
 *
 * Only tables whose stored item shape == row shape are pushed here (loadAndMerge
 * does a generic upsert). progressive_sessions (wrapped {data} shape) and agents
 * (own sync path) are deliberately excluded — their own stores migrate them.
 */
import { getCurrentUserId, supabase } from './supabase';
import { getSyncFailureCount, reportSyncFailure } from './sync-health';
import { getStorage, STORAGE_KEYS } from './storage';
import { loadAndMerge } from './db';
import { announceForeignData, getForeignIds, isForeignOwnerError, markForeignRows } from './account-scope';
import type { ProgressiveSession } from '@/stores/types';

type SyncTable = Parameters<typeof loadAndMerge>[0];

const SYNC_MAP: Array<{ key: string; table: SyncTable }> = [
  { key: STORAGE_KEYS.PROJECTS, table: 'projects' },
  { key: STORAGE_KEYS.PERSONAS, table: 'personas' },
  { key: STORAGE_KEYS.FEEDBACK_HISTORY, table: 'feedback_records' },
  { key: STORAGE_KEYS.JUDGMENTS, table: 'judgment_records' },
  { key: STORAGE_KEYS.ACCURACY_RATINGS, table: 'accuracy_ratings' },
  { key: STORAGE_KEYS.QUALITY_SIGNALS, table: 'quality_signals' },
  { key: STORAGE_KEYS.OUTCOME_RECORDS, table: 'outcome_records' },
  { key: STORAGE_KEYS.RETROSPECTIVE_ANSWERS, table: 'retrospective_answers' },
  { key: STORAGE_KEYS.DQ_SCORES, table: 'decision_quality_scores' },
  { key: STORAGE_KEYS.REFRAME_LIST, table: 'reframe_items' },
  { key: STORAGE_KEYS.RECAST_LIST, table: 'recast_items' },
  { key: STORAGE_KEYS.SYNTHESIZE_LIST, table: 'synthesize_items' },
];

// Keyed by user id (not a bare boolean) so signing out and into a DIFFERENT
// account in the same page load still migrates the second account; set only AFTER
// a successful pass so a transient failure can retry.
let _ranForUser: string | null = null;

export interface MigrateResult {
  /** The user's unit — decisions/projects, not internal signal rows. */
  projects: number;
  /** True when at least one push failed this pass (04 S8) — the toast must not
   *  claim "saved" for work that may still be local-only. */
  partial: boolean;
}

/**
 * Push local-only rows to the signed-in account; returns the number of local
 * projects now backed by the account (0 if not signed in or already run for this
 * user) plus whether any push failed, so the confirmation toast can stay honest.
 */
export async function migrateLocalToAccount(): Promise<MigrateResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { projects: 0, partial: false }; // not truly signed in yet — allow a later retry
  if (_ranForUser === userId) return { projects: 0, partial: false };

  const failuresBefore = getSyncFailureCount();
  let localCount = 0;
  // P2: the toast must report the user's UNIT (decisions/projects), not the sum of
  // every internal row (quality_signals, dq_scores…). "23건 saved" for one decision
  // reads as a bug. Track the projects count separately for the toast.
  let projectCount = 0;
  for (const { key, table } of SYNC_MAP) {
    const local = getStorage<unknown[]>(key, []);
    if (Array.isArray(local) && local.length > 0) localCount += local.length;
    if (table === 'projects' && Array.isArray(local)) projectCount = local.length;
    try {
      await loadAndMerge(table, key); // pulls remote + pushes local-only (correct per-table)
    } catch {
      /* best effort per table — one failure must not abort the rest */
    }
  }

  // progressive_sessions is the highest-value artifact (final_deliverable,
  // falsification, drafts) but uses a special {data}-wrapper row shape, so it is
  // NOT in SYNC_MAP (generic loadAndMerge would send the raw shape and be
  // rejected). Its own loadSessions only PULLS remote, so anonymous sessions
  // never reach the account on sign-in unless re-mutated — silent loss. Push the
  // local-only ones here with the same wrapper persist() uses.
  try {
    const sessions = getStorage<ProgressiveSession[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, []);
    const real = sessions.filter(
      (s) => s && s.id && !(s.phase === 'input' && (!s.workers || s.workers.length === 0)),
    );
    if (real.length > 0) {
      localCount += real.length;
      const { data: remote, error: remoteError } = await supabase
        .from('progressive_sessions').select('id').eq('user_id', userId);
      if (remoteError) throw remoteError;
      const remoteIds = new Set((remote ?? []).map((r: { id: string }) => r.id));
      // This is the one push that does NOT go through db.ts (the {data} wrapper
      // shape), so it needs the same two exclusions or it re-fails on every
      // sign-in and reddens a badge the user can do nothing about.
      const quarantined = getForeignIds('progressive_sessions');
      const toPush = real.filter((s) => !remoteIds.has(s.id) && !quarantined.has(s.id));
      if (toPush.length > 0) {
        const row = (s: ProgressiveSession) => ({
          id: s.id,
          user_id: userId,
          project_id: s.project_id,
          data: s,
          phase: s.phase,
          has_pending_humans: (s.workers || []).some(
            (w) => w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response'),
          ),
          updated_at: s.updated_at || new Date().toISOString(),
        });
        const { error: pushError } = await supabase
          .from('progressive_sessions')
          .upsert(toPush.map(row), { onConflict: 'id' });
        if (pushError) {
          const foreign: string[] = [];
          if (toPush.length === 1) {
            // Nothing to disentangle in a one-row batch — re-sending it would
            // only be a second identical request.
            if (!isForeignOwnerError(pushError)) throw pushError;
            foreign.push(toPush[0].id);
          } else {
            // A batch is one statement, so one foreign row rolls back the rest.
            // Attribute per row: this account's sessions still land, and the ones
            // the server proves are someone else's leave the pending set for good.
            for (const s of toPush) {
              const { error: rowError } = await supabase
                .from('progressive_sessions')
                .upsert(row(s), { onConflict: 'id' });
              if (!rowError) continue;
              if (!isForeignOwnerError(rowError)) throw rowError;
              foreign.push(s.id);
            }
          }
          if (foreign.length > 0) {
            markForeignRows('progressive_sessions', foreign);
            announceForeignData('rejected');
          }
        }
      }
    }
  } catch (error) {
    reportSyncFailure('migrate:progressive_sessions', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    /* best effort — local remains the source of truth */
  }

  void localCount; // (kept for potential future telemetry; the toast reports projects)

  // loadAndMerge's local-only push is fire-and-forget, so give the async writes a
  // moment to land before sampling the failure counter (best-effort — a slower
  // failure still surfaces through the SyncStatus badge the toast points at).
  await new Promise((r) => setTimeout(r, 1_000));
  const partial = getSyncFailureCount() > failuresBefore;
  if (!partial) _ranForUser = userId;
  return { projects: projectCount, partial };
}
