/**
 * Shared parse+upsert core for the plugin→webapp bridge. ONE place folds ledger
 * + bearing files into Supabase rows, used by both:
 *   - lib/plugin-import.ts  — browser, anon client, session user (manual upload)
 *   - app/api/plugin/ingest — server, service-role client, PAT-resolved user
 *     (automatic `argus push`)
 *
 * The caller supplies the Supabase client and the resolved user id; this module
 * does the format-agnostic work so the fold logic never diverges between the two
 * entry points.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateId } from './uuid';
import { parseLedger, parseBearing, classify, type FoldedDecision, type FoldedBearing } from './plugin-parse';

export interface ImportSummary {
  loggedIn: boolean;
  decisions: { parsed: number; written: number };
  bearings: { parsed: number; written: number };
  skipped: string[];
  error?: string;
}

export type FileInput = { name: string; content: string };

const MAX_TOTAL = 15 * 1024 * 1024; // 15 MB across all files

export async function ingestPluginFiles(
  client: SupabaseClient,
  userId: string,
  files: FileInput[],
  source: 'import' | 'push' = 'import',
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    loggedIn: true,
    decisions: { parsed: 0, written: 0 },
    bearings: { parsed: 0, written: 0 },
    skipped: [],
  };

  const total = files.reduce((n, f) => n + f.content.length, 0);
  if (total > MAX_TOTAL) { summary.error = 'too_large'; return summary; }

  const decisions: FoldedDecision[] = [];
  const bearings: FoldedBearing[] = [];

  for (const f of files) {
    const kind = classify(f.content);
    if (kind === 'ledger') {
      const folded = parseLedger(f.content);
      if (folded.length === 0) summary.skipped.push(`${f.name}: no decisions found`);
      decisions.push(...folded);
    } else if (kind === 'bearing') {
      try {
        const obj = JSON.parse(f.content);
        const arr = Array.isArray(obj) ? obj : [obj];
        for (const o of arr) {
          const b = parseBearing(o);
          if (b) bearings.push(b); else summary.skipped.push(`${f.name}: unrecognized bearing shape`);
        }
      } catch { summary.skipped.push(`${f.name}: invalid JSON`); }
    } else {
      summary.skipped.push(`${f.name}: not a ledger or bearing file`);
    }
  }

  summary.decisions.parsed = decisions.length;
  summary.bearings.parsed = bearings.length;

  const now = new Date().toISOString();

  if (decisions.length > 0) {
    const { data: existing } = await client
      .from('plugin_decisions').select('id, ledger_id').eq('user_id', userId);
    const idByLedger = new Map((existing ?? []).map((r: { id: string; ledger_id: string }) => [r.ledger_id, r.id]));
    const byLedger = new Map<string, FoldedDecision>();
    for (const d of decisions) if (d.ledger_id) byLedger.set(d.ledger_id, d);
    const rows = [...byLedger.values()].map((d) => ({
      ...d,
      id: idByLedger.get(d.ledger_id) ?? generateId(),
      user_id: userId,
      source,
      imported_at: now,
    }));
    const { error } = await client.from('plugin_decisions').upsert(rows, { onConflict: 'id' });
    if (error) { console.error('[plugin-ingest] plugin_decisions:', error.message); summary.error = error.message; }
    else summary.decisions.written = rows.length;
  }

  if (bearings.length > 0) {
    const { data: existing } = await client
      .from('plugin_bearings').select('id, session, version_label').eq('user_id', userId);
    const keyOf = (s?: string, v?: string) => `${s ?? ''}::${v ?? ''}`;
    const idByKey = new Map((existing ?? []).map((r: { id: string; session: string | null; version_label: string | null }) =>
      [keyOf(r.session ?? undefined, r.version_label ?? undefined), r.id]));
    const byKey = new Map<string, FoldedBearing>();
    for (const b of bearings) byKey.set(keyOf(b.session, b.version_label), b);
    const rows = [...byKey.values()].map((b) => ({
      ...b,
      id: idByKey.get(keyOf(b.session, b.version_label)) ?? generateId(),
      user_id: userId,
      source,
      imported_at: now,
    }));
    const { error } = await client.from('plugin_bearings').upsert(rows, { onConflict: 'id' });
    if (error) { console.error('[plugin-ingest] plugin_bearings:', error.message); summary.error = summary.error ?? error.message; }
    else summary.bearings.written = rows.length;
  }

  return summary;
}
