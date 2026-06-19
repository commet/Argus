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
import { getStorage, STORAGE_KEYS } from './storage';
import { loadAndMerge } from './db';
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

/**
 * Push local-only rows to the signed-in account; returns the number of local
 * items now backed by the account (0 if not signed in or already run for this user).
 */
export async function migrateLocalToAccount(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;            // not truly signed in yet — allow a later retry
  if (_ranForUser === userId) return 0;

  let localCount = 0;
  for (const { key, table } of SYNC_MAP) {
    const local = getStorage<unknown[]>(key, []);
    if (Array.isArray(local) && local.length > 0) localCount += local.length;
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
      const { data: remote } = await supabase
        .from('progressive_sessions').select('id').eq('user_id', userId);
      const remoteIds = new Set((remote ?? []).map((r: { id: string }) => r.id));
      const toPush = real.filter((s) => !remoteIds.has(s.id));
      if (toPush.length > 0) {
        await supabase.from('progressive_sessions').upsert(
          toPush.map((s) => ({
            id: s.id,
            user_id: userId,
            project_id: s.project_id,
            data: s,
            phase: s.phase,
            has_pending_humans: (s.workers || []).some(
              (w) => w.agent_type === 'human' && (w.status === 'sent' || w.status === 'waiting_response'),
            ),
            updated_at: s.updated_at || new Date().toISOString(),
          })),
          { onConflict: 'id' },
        );
      }
    }
  } catch {
    /* best effort — local remains the source of truth */
  }

  _ranForUser = userId; // mark done only after a full pass (allows retry on earlier throw)
  return localCount;
}
