import fs from 'fs';
import { deBom } from './deBom.js';
import { ledgerPath, sessionsRoot, bearingPath } from './layout.js';
import { asDate } from './resolve-today.js';
import { safeSegment } from './safe-path.js';
import type { PremiseState, PremiseKind, PremiseSource, PremiseAmendAction } from './premises.js';

/**
 * Append-only ledger replay (blueprint §3.0/§3.2). Decision STATE is never a
 * stored field — it is the fold of the event log. This is the load-bearing
 * reversal that fixes the old `session_update status` no-op and makes the state
 * machine impossible to bypass regardless of tool-call order.
 *
 * B1/B3 fix: `seal`/`settle` self-create their contract entry if no prior
 * `harvest` exists, so a seal can never silently evaporate.
 */

export type ContractStatus = 'candidate' | 'sealed' | 'settled' | 'dismissed';

export interface ContractEntry {
  id: string;
  status: ContractStatus;
  text: string;
  predicate?: string;
  check_by?: string;
  outcome?: string;
  basis?: string;
  amend_history: Array<{ predicate?: string; check_by?: string; ts?: string }>;
  dismiss_reason?: string;
  /** Living premises (plan v5) — ordinal order preserved; ≤ MAX_ACTIVE_PREMISES
   *  active. Optional so pre-premise ContractEntry literals (tests, old callers)
   *  stay valid; the fold always initializes it via freshEntry. */
  premises?: PremiseState[];
  /** Settle-time, user-attributed: which premise (if any) broke (plan v5 P2). */
  broken_premise_id?: string;
  /** YYYY-MM-DD of the settle event's ts — the wake render's settled column
   *  (P1-E7). Optional: pre-existing literals stay valid. */
  settled_on?: string;
}

export interface LedgerState {
  today: string;
  overdue: Array<{ id: string; date: string; text: string }>;
  ids: Set<string>;
  sealedPredicates: Set<string>;
  contracts: Map<string, ContractEntry>;
  stats: {
    total_sealed: number;
    total_settled: number;
    held: number;
    avoided: number;
    partial: number;
    still_pending: number;
  };
  /** ts of the OLDEST well-formed ledger event — "기록 시작 YYYY-MM-DD" in the
   *  wake render (P1-E7). A date fact, never a duration. */
  oldest_ts?: string;
  integrity: {
    dropped_lines: number;
    /** Well-formed, versioned events of a type this binary doesn't know (written
     *  by a NEWER argus-mcp, e.g. future premise_* events). Skipped, not corrupt
     *  — kept separate from dropped_lines so forward-compat never reads as a
     *  false integrity alarm (plan v5 §6.3). */
    skipped_unknown: number;
  };
}

function freshEntry(id: string): ContractEntry {
  return { id, status: 'candidate', text: '', amend_history: [], premises: [] };
}

/**
 * Fold the ledger into contract states as of `today` (YYYY-MM-DD).
 * `today` is passed in (never read here) so replay is fully deterministic.
 */
export function replayLedger(argusDir: string, today: string): LedgerState {
  const ids = new Set<string>();
  const sealedPredicates = new Set<string>();
  const map = new Map<string, ContractEntry>();
  const stats = {
    total_sealed: 0, total_settled: 0,
    held: 0, avoided: 0, partial: 0, still_pending: 0,
  };
  let dropped = 0;
  let skippedUnknown = 0;
  let oldestTs: string | undefined;

  let raw: string;
  try {
    raw = deBom(fs.readFileSync(ledgerPath(argusDir), 'utf8'));
  } catch {
    return { today, overdue: [], ids, sealedPredicates, contracts: map, stats, integrity: { dropped_lines: 0, skipped_unknown: 0 } };
  }

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(line) as Record<string, unknown>;
    } catch {
      dropped++; // torn/corrupt line (e.g. crash mid-append) — count, don't silently swallow (N3)
      continue;
    }
    if (!ev['id'] || typeof ev['id'] !== 'string') { dropped++; continue; }
    const id = ev['id'];
    ids.add(id);
    // Record inception (P1-E7): ISO timestamps compare lexicographically.
    if (typeof ev['ts'] === 'string' && ev['ts'] && (!oldestTs || ev['ts'] < oldestTs)) oldestTs = ev['ts'];

    let cur = map.get(id);
    switch (ev['event']) {
      case 'harvest':
        if (!cur) {
          cur = freshEntry(id);
          cur.text = (ev['decision'] as string) || (ev['quote'] as string) || '';
          map.set(id, cur);
        }
        break;

      case 'seal': {
        if (!cur) { cur = freshEntry(id); map.set(id, cur); } // B1: self-create instead of drop
        if (typeof ev['predicate'] === 'string') {
          sealedPredicates.add(ev['predicate']);
          cur.predicate = ev['predicate'];
          cur.text = ev['predicate'];
        }
        cur.check_by = ev['check_by'] as string | undefined;
        if (typeof ev['basis'] === 'string') cur.basis = ev['basis'];
        cur.status = 'sealed';
        stats.total_sealed++;
        break;
      }

      case 'amend':
        if (!cur) { cur = freshEntry(id); map.set(id, cur); }
        if (ev['predicate'] != null) { cur.predicate = ev['predicate'] as string; cur.text = ev['predicate'] as string; }
        if (ev['check_by'] != null) cur.check_by = ev['check_by'] as string;
        cur.amend_history.push({
          predicate: ev['predicate'] as string | undefined,
          check_by: ev['check_by'] as string | undefined,
          ts: ev['ts'] as string | undefined,
        });
        break;

      case 'dismiss':
        if (!cur) { cur = freshEntry(id); map.set(id, cur); }
        cur.status = 'dismissed';
        if (typeof ev['dismiss_reason'] === 'string') cur.dismiss_reason = ev['dismiss_reason'];
        break;

      case 'settle': {
        if (!cur) { cur = freshEntry(id); map.set(id, cur); } // B1: self-create
        cur.status = 'settled';
        stats.total_settled++;
        const outcome = ev['outcome'] as string | undefined;
        cur.outcome = outcome;
        if (typeof ev['ts'] === 'string' && ev['ts'].length >= 10) cur.settled_on = ev['ts'].slice(0, 10);
        if (typeof ev['broken_premise_id'] === 'string') cur.broken_premise_id = ev['broken_premise_id'];
        if (outcome === 'held') stats.held++;
        else if (outcome === 'avoided') stats.avoided++;
        else if (outcome === 'partial') stats.partial++;
        else if (outcome === 'still_pending') stats.still_pending++;
        break;
      }

      // ── living premises (plan v5 §6.1). The fold is not a validator — the
      //    write-time guard is; replay stays defensive and never throws. ──
      case 'premise_add': {
        if (!cur) { cur = freshEntry(id); map.set(id, cur); } // defensive only; the guard refuses absent at write time
        const pid = ev['premise_id'];
        if (typeof pid !== 'string' || typeof ev['text'] !== 'string') { dropped++; break; }
        const list = (cur.premises ??= []);
        if (list.some((p) => p.premise_id === pid)) break; // idempotent re-add
        list.push({
          premise_id: pid,
          ordinal: typeof ev['ordinal'] === 'number' ? ev['ordinal'] : list.length + 1,
          kind: (ev['kind'] === 'open_question' ? 'open_question' : 'premise') as PremiseKind,
          text: ev['text'],
          external: ev['external'] === true,
          load_bearing: ev['load_bearing'] === true,
          source: (ev['source'] === 'user' ? 'user' : 'ai') as PremiseSource,
          ...(typeof ev['ai_original'] === 'string' ? { ai_original: ev['ai_original'] } : {}),
          status: 'active',
          amend_history: [],
          recheck_count: 0,
        });
        break;
      }

      case 'premise_amend': {
        const p = cur?.premises?.find((x) => x.premise_id === ev['premise_id']);
        if (!p) break; // amend of an unknown premise: write-time guard prevents; replay tolerates
        const action = ev['action'] as PremiseAmendAction;
        p.amend_history.push({
          action,
          from: ev['from'] as string | undefined,
          to: ev['to'] as string | undefined,
          note: ev['note'] as string | undefined,
          ts: ev['ts'] as string | undefined,
        });
        if ((action === 'refine' || action === 'replace') && typeof ev['to'] === 'string') p.text = ev['to'];
        if (action === 'retire') p.status = 'retired';
        // Flags may be corrected post-add (e.g. marking a promoted premise external
        // so monitoring can arm) — monitoring stays DERIVED from these flags.
        if (typeof ev['external'] === 'boolean') p.external = ev['external'];
        if (typeof ev['load_bearing'] === 'boolean') p.load_bearing = ev['load_bearing'];
        break;
      }

      case 'premise_recheck': {
        const p = cur?.premises?.find((x) => x.premise_id === ev['premise_id']);
        if (!p) break;
        if (typeof ev['finding'] !== 'string' || typeof ev['source'] !== 'string') break;
        p.last_recheck = {
          finding: ev['finding'],
          ...(typeof ev['numeric_value'] === 'number' ? { numeric_value: ev['numeric_value'] } : {}),
          drifted: ev['drifted'] === true,
          baseline_only: ev['baseline_only'] === true,
          source: ev['source'],
          ...(typeof ev['source_detail'] === 'string' ? { source_detail: ev['source_detail'] } : {}),
          ts: ev['ts'] as string | undefined,
        };
        p.recheck_count++;
        break;
      }

      case 'premise_resolve': {
        const p = cur?.premises?.find((x) => x.premise_id === ev['premise_id']);
        if (!p) break;
        p.status = 'resolved';
        if (typeof ev['decision'] === 'string') p.resolved_decision = ev['decision'];
        break;
      }

      case 'gate_input':
        break; // known meta event (over-fire gate audit) — not a state change, not corrupt

      default:
        // Forward-compat tolerance (plan v5 §6.3): a well-formed, VERSIONED event
        // whose type this binary doesn't know was written by a newer argus-mcp —
        // skip it silently (like gate_input) instead of counting it as corruption,
        // so an old install never raises a false integrity alarm on a new ledger.
        // Only unversioned/structurally-broken events still count as dropped.
        if (typeof ev['event'] === 'string' && typeof ev['v'] === 'number') skippedUnknown++;
        else dropped++;
        break;
    }
  }

  const overdue: Array<{ id: string; date: string; text: string }> = [];
  for (const [id, item] of map.entries()) {
    if (item.status !== 'sealed') continue;
    const date = asDate(item.check_by);
    if (date && date <= today) overdue.push({ id, date, text: item.text || '' });
  }
  overdue.sort((a, b) => (a.date < b.date ? -1 : 1));

  return { today, overdue, ids, sealedPredicates, contracts: map, stats, oldest_ts: oldestTs, integrity: { dropped_lines: dropped, skipped_unknown: skippedUnknown } };
}

/**
 * Bearing-file contract seeds that are due but not yet represented in the
 * ledger (the seal may have been written as a bearing before the ledger event).
 * Directory names read off disk are validated with `safeSegment` before use.
 */
export function bearingContracts(
  argusDir: string,
  today: string,
  ledger: LedgerState,
): Array<{ id: string; date: string; predicate: string; check_by: string }> {
  const out: Array<{ id: string; date: string; predicate: string; check_by: string }> = [];
  const root = sessionsRoot(argusDir);

  let ids: string[] = [];
  try { ids = fs.readdirSync(root); } catch { return out; }

  for (const rawId of ids) {
    let id: string;
    try { id = safeSegment(rawId, 'id'); } catch { continue; } // skip stray/unsafe dir names
    if (ledger.sealedPredicates.size && ledger.ids.has(id)) {
      const entry = ledger.contracts.get(id);
      if (entry && entry.status !== 'candidate') continue; // already represented
    }
    const bearing = readJson(bearingPath(argusDir, id)) as Record<string, unknown> | null;
    const seed = bearing && (bearing['contract_seed'] as Record<string, unknown> | undefined);
    if (!seed || typeof seed['predicate'] !== 'string') continue;
    if (ledger.sealedPredicates.has(seed['predicate'])) continue;
    const date = asDate(seed['check_by']);
    if (date && date <= today) {
      out.push({ id, date, predicate: seed['predicate'], check_by: seed['check_by'] as string });
    }
  }
  return out;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(deBom(fs.readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

// Re-export for callers that imported these from here historically.
export { asDate };
export const _ledgerFileExists = (argusDir: string): boolean => {
  try { return fs.existsSync(ledgerPath(argusDir)); } catch { return false; }
};
