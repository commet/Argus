/**
 * Plugin → webapp bridge: parse the Argus Claude Code plugin's local files and
 * land them in Supabase (plugin_decisions / plugin_bearings) under the logged-in
 * account, so the webapp can open them.
 *
 * Two file kinds are accepted:
 *  - `.argus/ledger/ledger.jsonl` — append-only event log (harvest→seal→amend→
 *    settle/dismiss). Folded into one decision per id, porting the exact replay
 *    in tools/argus-watch/lib/ledger.mjs (single source of fold logic — keep in
 *    sync if that file changes).
 *  - `current_bearing.json` — a compressed voyage output (course/fog/contract_seed).
 *
 * Re-import is idempotent: rows are keyed by (user_id, ledger_id) for decisions
 * and (user_id, session, version_label) for bearings; existing ids are reused so
 * a later import (e.g. after a bet settled) updates in place instead of duplicating.
 */
import { supabase, getCurrentUserId } from './supabase';
import { generateId } from './uuid';
import { log } from './logger';
import { parseLedger, parseBearing, classify, type FoldedDecision, type FoldedBearing } from './plugin-parse';

export interface ImportSummary {
  loggedIn: boolean;
  decisions: { parsed: number; written: number };
  bearings: { parsed: number; written: number };
  skipped: string[];           // filename: reason
  error?: string;
}

type FileInput = { name: string; content: string };

// ── Import ──

const MAX_TOTAL = 15 * 1024 * 1024; // 15 MB across all files

export async function importPluginFiles(files: FileInput[]): Promise<ImportSummary> {
  const summary: ImportSummary = {
    loggedIn: false,
    decisions: { parsed: 0, written: 0 },
    bearings: { parsed: 0, written: 0 },
    skipped: [],
  };

  const userId = await getCurrentUserId();
  if (!userId) { summary.error = 'not_logged_in'; return summary; }
  summary.loggedIn = true;

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

  // Decisions: reuse existing id per (user_id, ledger_id) for stable, idempotent upsert.
  if (decisions.length > 0) {
    const { data: existing } = await supabase
      .from('plugin_decisions').select('id, ledger_id').eq('user_id', userId);
    const idByLedger = new Map((existing ?? []).map((r: { id: string; ledger_id: string }) => [r.ledger_id, r.id]));
    // De-dupe within this batch by ledger_id (last write wins).
    const byLedger = new Map<string, FoldedDecision>();
    for (const d of decisions) if (d.ledger_id) byLedger.set(d.ledger_id, d);
    const rows = [...byLedger.values()].map((d) => ({
      ...d,
      id: idByLedger.get(d.ledger_id) ?? generateId(),
      user_id: userId,
      source: 'import' as const,
      imported_at: now,
    }));
    const { error } = await supabase.from('plugin_decisions').upsert(rows, { onConflict: 'id' });
    if (error) { log.error(`plugin_decisions import: ${error.message}`, { context: 'plugin-import' }); summary.error = error.message; }
    else summary.decisions.written = rows.length;
  }

  // Bearings: reuse existing id per (user_id, session, version_label).
  if (bearings.length > 0) {
    const { data: existing } = await supabase
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
      source: 'import' as const,
      imported_at: now,
    }));
    const { error } = await supabase.from('plugin_bearings').upsert(rows, { onConflict: 'id' });
    if (error) { log.error(`plugin_bearings import: ${error.message}`, { context: 'plugin-import' }); summary.error = summary.error ?? error.message; }
    else summary.bearings.written = rows.length;
  }

  return summary;
}
