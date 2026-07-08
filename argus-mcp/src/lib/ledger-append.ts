import fs from 'fs';
import fsP from 'fs/promises';
import { ledgerPath, ledgerDir } from './layout.js';
import { SCHEMA_VERSION } from './spine.js';
import type { LedgerEventType } from './state-machine.js';

/**
 * The one internal writer for the append-only ledger. Tools call this; it is
 * never exposed as an MCP tool. True atomic append via O_APPEND, each event
 * stamped with schema version and an ISO timestamp.
 */

export interface LedgerEventInput {
  id: string;
  /** watch_anchor / watch_capture are 당직-loop events (BLUEPRINT §9): outside
   *  the decision state machine, so they bypass guardTransition by design. */
  event: LedgerEventType | 'gate_input' | 'watch_anchor' | 'watch_capture';
  predicate?: string;
  check_by?: string;
  decision?: string;
  outcome?: string;
  basis?: string;
  dismiss_reason?: string;
  /** gate audit (over-fire inputs) — meta event, ignored by replay (N3 counts unknowns; gate_input is known-meta) */
  gate?: Record<string, unknown>;
  // ── living premises (plan v5 §6.1) ──
  premise_id?: string;
  ordinal?: number;
  kind?: string;
  text?: string;
  external?: boolean;
  load_bearing?: boolean;
  source?: string;
  ai_original?: string;
  /** M2 materiality rule (jsonb-nested on premise_add) — no schema migration. */
  materiality_rule?: unknown;
  /** M1 re-check cadence in days (jsonb-nested on premise_add/amend) — no migration. */
  recheck_cadence_days?: number;
  /** M3 open_question reconsider cadence in days (jsonb-nested on premise_add/amend/
   *  reconsider) — no migration. */
  reponder_cadence_days?: number;
  /** M3 — the logical `today` (YYYY-MM-DD) the reconsider clock anchors from, on
   *  premise_add (open_question) and premise_reconsider. Distinct from the wall-
   *  clock event `ts` so the reconsider timeline is deterministic (honors
   *  today_override) instead of drifting with real time. */
  anchor_date?: string;
  action?: string;
  from?: string;
  to?: string;
  note?: string;
  finding?: string;
  numeric_value?: number;
  drifted?: boolean;
  baseline_only?: boolean;
  source_detail?: string;
  /** settle-time, user-attributed broken premise (plan v5 P2) */
  broken_premise_id?: string;
  /** watch_capture: the capture's stable id. On premise_add: the capture this
   *  premise was PROMOTED from (§9.3 승격 — a reference, never a move). */
  capture_id?: string;
  ts?: string;
}

export async function appendLedger(argusDir: string, events: LedgerEventInput[], now: string): Promise<{ written: number }> {
  await fsP.mkdir(ledgerDir(argusDir), { recursive: true });
  const lPath = ledgerPath(argusDir);

  const lines = events
    .map((ev) => JSON.stringify({ v: SCHEMA_VERSION, ts: ev.ts || now, ...ev }))
    .join('\n') + '\n';

  await new Promise<void>((resolve, reject) => {
    let fd: number | undefined;
    try {
      fd = fs.openSync(lPath, fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY);
      fs.writeSync(fd, lines, null, 'utf8');
      resolve();
    } catch (e) {
      reject(e);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  });

  return { written: events.length };
}
