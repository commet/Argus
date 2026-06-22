/**
 * Plugin → webapp bridge (browser entry). Parses the Argus plugin's local files
 * and lands them in Supabase under the logged-in account via the shared
 * ingest core (lib/plugin-ingest-core.ts) — the SAME fold used by the automatic
 * `argus push` server endpoint, so the two paths can never diverge.
 *
 * Idempotent: rows are keyed by (user_id, ledger_id) for decisions and
 * (user_id, session, version_label) for bearings; a re-upload updates in place.
 */
import { supabase, getCurrentUserId } from './supabase';
import { ingestPluginFiles, type ImportSummary, type FileInput } from './plugin-ingest-core';

export type { ImportSummary } from './plugin-ingest-core';

export async function importPluginFiles(files: FileInput[]): Promise<ImportSummary> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      loggedIn: false,
      decisions: { parsed: 0, written: 0 },
      bearings: { parsed: 0, written: 0 },
      skipped: [],
      error: 'not_logged_in',
    };
  }
  return ingestPluginFiles(supabase, userId, files);
}
