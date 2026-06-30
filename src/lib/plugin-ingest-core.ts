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

type ExistingDecisionRow = {
  id: string;
  ledger_id: string;
  status?: FoldedDecision['status'] | null;
  outcome?: FoldedDecision['outcome'] | null;
  settled_at?: string | null;
  settle_note?: string | null;
  dismissed_at?: string | null;
  dismiss_reason?: string | null;
  predicate?: string | null;
  falsified_if?: string | null;
  check_by?: string | null;
  history?: unknown;
};

type WebPluginEvent = {
  ledger_id: string;
  event: 'amend' | 'settle' | 'dismiss';
  payload: Record<string, unknown>;
  created_at?: string | null;
};

async function loadWebEvents(
  client: SupabaseClient,
  userId: string,
): Promise<Map<string, WebPluginEvent[]>> {
  const byLedger = new Map<string, WebPluginEvent[]>();
  const { data, error } = await client
    .from('plugin_events')
    .select('ledger_id, event, payload, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  // Older deployments/tests may not have plugin_events yet. Ingest should still
  // accept pushes; round-trip protection activates once the migration exists.
  if (error) {
    console.error('[plugin-ingest] plugin_events:', error.message);
    return byLedger;
  }

  for (const row of (data ?? []) as WebPluginEvent[]) {
    if (!row.ledger_id || !row.event || !row.payload) continue;
    const list = byLedger.get(row.ledger_id) ?? [];
    list.push(row);
    byLedger.set(row.ledger_id, list);
  }
  return byLedger;
}

function applyWebEvents<T extends FoldedDecision & { id: string; user_id: string }>(
  row: T,
  events: WebPluginEvent[],
): T {
  let next = { ...row };
  for (const event of events) {
    const payload = event.payload ?? {};
    if (event.event === 'settle') {
      if (next.status === 'settled') continue;
      next = {
        ...next,
        status: 'settled',
        outcome: payload.outcome as FoldedDecision['outcome'],
        settled_at: payload.at as string,
        settle_note: payload.note as string | undefined,
      };
      continue;
    }

    if (event.event === 'dismiss') {
      if (next.status === 'settled' || next.status === 'dismissed') continue;
      next = {
        ...next,
        status: 'dismissed',
        dismissed_at: payload.at as string,
        dismiss_reason: payload.reason as string | undefined,
      };
      continue;
    }

    if (event.event === 'amend') {
      if (next.status === 'settled' || next.status === 'dismissed') continue;
      const predicate = (payload.predicate as string | undefined) ?? next.predicate;
      const falsifiedIf = (payload.falsified_if as string | undefined) ?? next.falsified_if;
      const checkBy = (payload.check_by as string | undefined) ?? next.check_by;
      if (predicate === next.predicate && falsifiedIf === next.falsified_if && checkBy === next.check_by) continue;
      next = {
        ...next,
        status: 'sealed',
        predicate,
        falsified_if: falsifiedIf,
        check_by: checkBy,
        history: [
          ...((Array.isArray(next.history) ? next.history : []) as NonNullable<FoldedDecision['history']>),
          {
            predicate: next.predicate,
            falsified_if: next.falsified_if,
            check_by: next.check_by,
            amended_at: payload.at as string,
          },
        ],
      };
    }
  }
  return next;
}

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
      .from('plugin_decisions')
      .select('id, ledger_id, status, outcome, settled_at, settle_note, dismissed_at, dismiss_reason, predicate, falsified_if, check_by, history')
      .eq('user_id', userId);
    const existingByLedger = new Map((existing ?? []).map((r: ExistingDecisionRow) => [r.ledger_id, r]));
    const webEventsByLedger = await loadWebEvents(client, userId);
    const byLedger = new Map<string, FoldedDecision>();
    for (const d of decisions) if (d.ledger_id) byLedger.set(d.ledger_id, d);
    const rows = [...byLedger.values()].map((d) => {
      const existingRow = existingByLedger.get(d.ledger_id);
      let row = {
        ...d,
        id: existingRow?.id ?? generateId(),
        user_id: userId,
        source,
        imported_at: now,
      };

      // A stale local push must not undo a decision already settled/dismissed in
      // the webapp before the user has pulled that event back to local ledger.
      if (existingRow?.status === 'settled' && d.status !== 'settled') {
        row = {
          ...row,
          status: 'settled',
          outcome: existingRow.outcome ?? undefined,
          settled_at: existingRow.settled_at ?? undefined,
          settle_note: existingRow.settle_note ?? undefined,
          check_by: existingRow.check_by ?? row.check_by,
          history: (Array.isArray(existingRow.history) ? existingRow.history : row.history) as FoldedDecision['history'],
        };
      } else if (existingRow?.status === 'dismissed' && d.status !== 'dismissed') {
        row = {
          ...row,
          status: 'dismissed',
          dismissed_at: existingRow.dismissed_at ?? undefined,
          dismiss_reason: existingRow.dismiss_reason ?? undefined,
          history: (Array.isArray(existingRow.history) ? existingRow.history : row.history) as FoldedDecision['history'],
        };
      }

      return applyWebEvents(row, webEventsByLedger.get(d.ledger_id) ?? []);
    });
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
