import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ingestPluginFiles, type FileInput } from '../plugin-ingest-core';

/**
 * ingestPluginFiles is the ONE place the plugin→webapp bridge folds ledger +
 * bearing files into rows (shared by the browser importer and the `argus push`
 * API). We stub the Supabase client so we can assert: the size guard, the
 * classify→parse fold, and — most important — the round-trip protection that
 * stops a stale local push from un-settling a decision the user already closed
 * in the webapp (a silent-data-loss trap CLAUDE.md warns about).
 */

type Row = Record<string, unknown>;

/** Minimal chainable Supabase stub: `.select().eq()[.order()]` resolves to
 *  { data } from `tables`, and `.upsert()` records rows into `captured`. */
function stubClient(tables: Record<string, Row[]>) {
  const captured: Record<string, Row[]> = {};
  const makeQuery = (table: string) => {
    const q: Record<string, unknown> = {
      eq: () => q,
      order: () => q,
      then: (resolve: (r: { data: Row[]; error: null }) => void) => resolve({ data: tables[table] ?? [], error: null }),
    };
    return q;
  };
  const client = {
    from(table: string) {
      return {
        select: () => makeQuery(table),
        upsert: (rows: Row[]) => { captured[table] = rows; return Promise.resolve({ error: null }); },
      };
    },
  } as unknown as SupabaseClient;
  return { client, captured };
}

const LEDGER: FileInput = {
  name: 'ledger.jsonl',
  content: [
    JSON.stringify({ id: 'L1', event: 'harvest', at: '2026-07-01', project: 'p', session: 's', decided_at: '2026-07-01', quote: 'q', decision: 'ship it', type: 'bet', stakes: 'high' }),
    JSON.stringify({ id: 'L1', event: 'seal', at: '2026-07-02', predicate: 'cutover under 5 min', falsified_if: 'over 10', check_by: '2026-08-01' }),
  ].join('\n'),
};

const BEARING: FileInput = {
  name: 'current_bearing.json',
  content: JSON.stringify({ session: 's', version_label: 'v1', current_course: 'north', next_helm: 'go' }),
};

describe('ingestPluginFiles', () => {
  it('aborts with too_large and writes nothing when the payload exceeds the cap', async () => {
    const { client, captured } = stubClient({});
    const big: FileInput = { name: 'x', content: 'a'.repeat(16 * 1024 * 1024) };
    const summary = await ingestPluginFiles(client, 'user-1', [big]);
    expect(summary.error).toBe('too_large');
    expect(captured).toEqual({});
  });

  it('folds a harvest+seal ledger into one sealed decision and upserts it', async () => {
    const { client, captured } = stubClient({});
    const summary = await ingestPluginFiles(client, 'user-1', [LEDGER]);
    expect(summary.decisions).toEqual({ parsed: 1, written: 1 });
    const row = captured['plugin_decisions'][0];
    expect(row.ledger_id).toBe('L1');
    expect(row.status).toBe('sealed');
    expect(row.predicate).toBe('cutover under 5 min');
    expect(row.user_id).toBe('user-1');
  });

  it('records a skip for a file that is neither ledger nor bearing', async () => {
    const { client } = stubClient({});
    const summary = await ingestPluginFiles(client, 'user-1', [{ name: 'notes.txt', content: 'just prose' }]);
    expect(summary.decisions.parsed).toBe(0);
    expect(summary.skipped.some((s) => s.includes('notes.txt'))).toBe(true);
  });

  it('parses and writes a bearing file', async () => {
    const { client, captured } = stubClient({});
    const summary = await ingestPluginFiles(client, 'user-1', [BEARING]);
    expect(summary.bearings).toEqual({ parsed: 1, written: 1 });
    expect(captured['plugin_bearings'][0].session).toBe('s');
  });

  it('round-trip protection: a stale local push does NOT un-settle a web-settled decision', async () => {
    // The webapp already settled L1; the incoming ledger still folds to "sealed".
    const existing: Row[] = [{
      id: 'existing-uuid', ledger_id: 'L1', status: 'settled', outcome: 'held',
      settled_at: '2026-07-05T00:00:00Z', settle_note: 'clean', history: [],
    }];
    const { client, captured } = stubClient({ plugin_decisions: existing });
    await ingestPluginFiles(client, 'user-1', [LEDGER]);
    const row = captured['plugin_decisions'][0];
    expect(row.id).toBe('existing-uuid');   // reuses the existing row id
    expect(row.status).toBe('settled');     // stayed settled, not reverted to sealed
    expect(row.outcome).toBe('held');
  });

  it('applies a pending web settle event captured in plugin_events', async () => {
    const events: Row[] = [{
      ledger_id: 'L1', event: 'settle', created_at: '2026-07-05T00:00:00Z',
      payload: { outcome: 'broke', at: '2026-07-05T00:00:00Z', note: 'missed' },
    }];
    const { client, captured } = stubClient({ plugin_events: events });
    await ingestPluginFiles(client, 'user-1', [LEDGER]);
    const row = captured['plugin_decisions'][0];
    expect(row.status).toBe('settled');
    expect(row.outcome).toBe('broke');
  });
});
