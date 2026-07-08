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

/**
 * Cross-process critical section for read-check-append sequences (§9.4 두 기기
 * 안전). The in-process dispatcher already serializes calls WITHIN one stdio
 * server; this lockfile extends that to two concurrent sessions on one dir —
 * without it, two settles could both replay 'sealed' and both append, double-
 * counting the calibration record. O_EXCL create is the atomic primitive;
 * a lock older than STALE_MS is treated as a crash leftover and stolen.
 */
const LOCK_STALE_MS = 5000;
const LOCK_WAIT_MS = 25;
const LOCK_TRIES = 120; // ~3s worst case

export async function withLedgerLock<T>(argusDir: string, fn: () => Promise<T>): Promise<T> {
  await fsP.mkdir(ledgerDir(argusDir), { recursive: true });
  const lockPath = ledgerPath(argusDir) + '.lock';
  let acquired = false;
  for (let i = 0; i < LOCK_TRIES && !acquired; i++) {
    try {
      const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, String(process.pid), null, 'utf8');
      fs.closeSync(fd);
      acquired = true;
    } catch {
      try {
        const st = fs.statSync(lockPath);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) { fs.unlinkSync(lockPath); continue; } // crash leftover
      } catch { continue; } // lock vanished between attempts — retry immediately
      await new Promise((r) => setTimeout(r, LOCK_WAIT_MS));
    }
  }
  // Lock or no lock, the work proceeds (availability over strictness — a stuck
  // lock must never brick the ledger; the steal above bounds the wait).
  try {
    return await fn();
  } finally {
    if (acquired) { try { fs.unlinkSync(lockPath); } catch { /* already gone */ } }
  }
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
