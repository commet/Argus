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

function normalizePremiseSource(source: unknown): PremiseSource {
  return source === 'user' || source === 'user_stated' ? 'user_stated' : 'ai_surfaced';
}

export interface ContractEntry {
  id: string;
  status: ContractStatus;
  text: string;
  predicate?: string;
  check_by?: string;
  outcome?: string;
  /** What reality did, in the user's words, retained from the settle event's
   *  `decision`/`what_happened` field. The receipt file is the primary keepsake,
   *  but the fold keeps this too so a LOST receipt on a settled decision can be
   *  reconstructed honestly instead of misreported as "no prediction" (recall). */
  what_happened?: string;
  basis?: string;
  /** Provenance of the sealed line as recorded on the seal event. Absent means
   *  UNKNOWN (pre-2026-07 ledgers), never 'user' — no reader may upgrade a
   *  missing value into an authorship claim. */
  predicate_owner?: 'user' | 'ai_surfaced';
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
  /** How many times this contract was deferred (still_pending at its check-by →
   *  re-armed, not settled). Surfaced as a neutral FACT on the eventual receipt
   *  ("originally due X · deferred N×"), never a grade. */
  defer_count?: number;
  /** Each deferral: the date it was due (from), the new check-by (to), and the
   *  user's note on why reality had not answered yet. defer_history[0].from is
   *  the ORIGINAL check-by — what the receipt reports as "originally due". */
  defer_history?: Array<{ from?: string; to?: string; note?: string; ts?: string }>;
}

/** 당직 루프 (BLUEPRINT §9) — the daily watch fold. Anchors and captures live
 *  OUTSIDE the decision state machine: no status, no outcome, no stats. An
 *  anchor is a note, not a bet (§9.2-3) — nothing here feeds track_record. */
export interface WatchAnchor {
  date: string;
  /** the user's whole anchor sentence, verbatim — including any stated stance.
   *  Deliberately ONE field: a separate stance key would be a fork-adjacent
   *  schema shape the spine drift guard (FORBIDDEN_FORK_KEYS) exists to refuse. */
  text: string;
  ts?: string;
}
export interface WatchCapture {
  /** stable id (wc-xxxxxxxx) — the promotion reference for argus_premises from_capture. */
  id?: string;
  date: string;
  kind: 'claim' | 'premise' | 'question';
  text: string;
  source: PremiseSource;
  ai_original?: string;
  ts?: string;
}
export interface WatchState {
  /** by date (YYYY-MM-DD) — the latest anchor of a day wins (re-anchoring a day
   *  is a correction, and the ledger keeps the history anyway). */
  anchors: Map<string, WatchAnchor>;
  captures: WatchCapture[];
}

export interface LedgerState {
  today: string;
  overdue: Array<{ id: string; date: string; text: string }>;
  ids: Set<string>;
  sealedPredicates: Set<string>;
  contracts: Map<string, ContractEntry>;
  watch: WatchState;
  stats: {
    total_sealed: number;
    total_settled: number;
    held: number;
    avoided: number;
    partial: number;
    still_pending: number;
    /** checkpoints v2 §7.2 — the judgment-layer miss ("my read was wrong"),
     *  distinct from avoided. A settled non-held outcome; never a held bet. */
    missed: number;
  };
  /** ts of the OLDEST well-formed ledger event — "기록 시작 YYYY-MM-DD" in the
   *  wake render (P1-E7). A date fact, never a duration. */
  oldest_ts?: string;
  integrity: {
    dropped_lines: number;
    /** Well-formed, versioned events of a type this binary doesn't know (written
     *  by a NEWER argus-decision-mcp, e.g. future premise_* events). Skipped, not corrupt
     *  — kept separate from dropped_lines so forward-compat never reads as a
     *  false integrity alarm (plan v5 §6.3). */
    skipped_unknown: number;
    /** Sealed contracts whose check_by is missing or unparseable (only reachable
     *  via a foreign writer / hand-edit — the MCP seal path validates the date).
     *  Such a seal can NEVER become `due`, so without this it is silently stuck
     *  and invisible to every channel. Listed here so a channel can say so. */
    undated_seals?: string[];
    /**
     * The ledger file EXISTS but could not be read (permissions, a directory in
     * its place, an I/O error, a lock held by another process). Carries the
     * errno so a surface can name it.
     *
     * Why this field exists (adversarial audit 2026-07-27): the read used to
     * swallow every failure into an empty state WITH `dropped_lines: 0` — an
     * affirmative claim that nothing was lost. So an unreadable ledger made
     * every surface say "no decisions on record", made `argus_resolve` answer
     * NO_PRIOR_SEAL for a prediction sitting on disk, and — worst — made
     * `deriveState` return `absent`, so the state machine happily accepted a
     * SECOND seal on the same id and silently moved its check-by. "I could not
     * look" must never be reported as "there is nothing there."
     */
    unreadable?: string;
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
    held: 0, avoided: 0, partial: 0, still_pending: 0, missed: 0,
  };
  let dropped = 0;
  let skippedUnknown = 0;
  let oldestTs: string | undefined;
  // Ids that ever saw a seal EVENT — survives settle/dismiss so total_sealed
  // means "ever sealed", derived per-id (not per-line) below.
  const everSealed = new Set<string>();
  const watch: WatchState = { anchors: new Map(), captures: [] };

  let raw: string;
  try {
    raw = deBom(fs.readFileSync(ledgerPath(argusDir), 'utf8'));
  } catch (e) {
    // ENOENT is the ONLY benign case: no ledger yet, so "nothing on record" is
    // the truth. Every other errno means we could not look — and an empty fold
    // with `dropped_lines: 0` would be a lie that also unlocks a second seal
    // (deriveState sees `absent`). Carry the fact so read surfaces can say it
    // and write paths can refuse.
    const code = (e as NodeJS.ErrnoException)?.code;
    const benign = code === 'ENOENT';
    return {
      today, overdue: [], ids, sealedPredicates, contracts: map, stats, watch,
      integrity: { dropped_lines: 0, skipped_unknown: 0, ...(benign ? {} : { unreadable: code ?? 'UNKNOWN' }) },
    };
  }

  for (const rawLine of raw.split('\n')) {
    // Strip a per-LINE BOM: deBom only removes one at byte 0, but a U+FEFF can
    // ride the first line of a concatenated second file, or be prepended per
    // append by a Windows PowerShell co-writer (>>/Out-File) sharing the ledger.
    // JSON.parse('﻿{…}') throws, so without this a real settle line would
    // be dropped and its outcome vanish from calibration.
    const line = rawLine.charCodeAt(0) === 0xfeff ? rawLine.slice(1) : rawLine;
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
    // gate_input is an over-fire-gate audit record, not a decision the user
    // opened — counting it made the first-use greeting vanish after a single
    // restrained argus_open_decision call (11 S7). Watch events (당직, §9) are
    // likewise NOT decisions — they must never count as one.
    if (ev['event'] !== 'gate_input' && ev['event'] !== 'watch_anchor' && ev['event'] !== 'watch_capture') ids.add(id);
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
        // Settled is terminal. A stray seal line after settlement (a buggy
        // writer, or a hand-edited ledger) must not flip the record back to
        // "sealed" — that re-arms due nags for a decision reality already
        // answered. Read-side protection also heals ledgers a past writer
        // corrupted, which write guards alone cannot do.
        if (cur.status === 'settled') {
          if (typeof ev['predicate'] === 'string') sealedPredicates.add(ev['predicate']);
          break;
        }
        if (typeof ev['predicate'] === 'string') {
          sealedPredicates.add(ev['predicate']);
          cur.predicate = ev['predicate'];
          cur.text = ev['predicate'];
        }
        cur.check_by = ev['check_by'] as string | undefined;
        if (typeof ev['basis'] === 'string') cur.basis = ev['basis'];
        if (ev['predicate_owner'] === 'user' || ev['predicate_owner'] === 'ai_surfaced') {
          cur.predicate_owner = ev['predicate_owner'];
        }
        cur.status = 'sealed';
        everSealed.add(id);
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
        const outcome = ev['outcome'] as string | undefined;
        cur.outcome = outcome;
        // Retain what-reality-did from the settle line. This binary writes it as
        // `decision`; the plugin CLI writes `what_happened` — read both (same
        // dual-vocab tolerance as ts/at below) so a lost receipt is honestly
        // reconstructable from the fold, whatever surface settled it.
        const wh = typeof ev['decision'] === 'string' ? ev['decision']
          : typeof ev['what_happened'] === 'string' ? (ev['what_happened'] as string) : undefined;
        if (wh) cur.what_happened = wh;
        // Timestamp field is two-vocab across surfaces: this binary stamps `ts`,
        // the plugin CLI stamps `at` — read both so a plugin-settled decision
        // still gets its settled date on the receipt (O2 방1 finding ⑤).
        const settledTs = typeof ev['ts'] === 'string' ? ev['ts'] : typeof ev['at'] === 'string' ? ev['at'] : undefined;
        if (settledTs && settledTs.length >= 10) cur.settled_on = settledTs.slice(0, 10);
        if (typeof ev['broken_premise_id'] === 'string') cur.broken_premise_id = ev['broken_premise_id'];
        // Buckets are NOT counted here — stats derive from the FOLDED STATE
        // after the loop (see below), so a duplicated or reordered settle line
        // in an externally-edited ledger cannot double-count a calibration.
        break;
      }

      case 'defer': {
        // still_pending at the check-by → re-arm, do NOT settle. The contract
        // moves its check_by forward and stays `sealed` (alive, will come due
        // again). The original due date and the deferral reason are preserved so
        // the eventual receipt can state the fact honestly.
        if (!cur) { cur = freshEntry(id); map.set(id, cur); } // defensive; the write-time guard requires `due`
        const to = typeof ev['check_by'] === 'string' ? ev['check_by'] : undefined;
        const from = typeof ev['from'] === 'string' ? ev['from'] : cur.check_by;
        if (to) cur.check_by = to;
        cur.status = 'sealed';
        cur.defer_count = (cur.defer_count ?? 0) + 1;
        (cur.defer_history ??= []).push({
          from, to,
          ...(typeof ev['note'] === 'string' ? { note: ev['note'] } : {}),
          ...(typeof ev['ts'] === 'string' ? { ts: ev['ts'] } : {}),
        });
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
          ...(typeof ev['monitoring_enabled'] === 'boolean' ? { monitoring_enabled: ev['monitoring_enabled'] } : {}),
          source: normalizePremiseSource(ev['source']),
          ...(typeof ev['ai_original'] === 'string' ? { ai_original: ev['ai_original'] } : {}),
          ...(typeof ev['anchor_quote'] === 'string' ? { anchor_quote: ev['anchor_quote'] } : {}),
          ...(isMaterialityRule(ev['materiality_rule']) ? { materiality_rule: ev['materiality_rule'] as PremiseState['materiality_rule'] } : {}),
          ...(typeof ev['recheck_cadence_days'] === 'number' && Number.isFinite(ev['recheck_cadence_days']) ? { recheck_cadence_days: ev['recheck_cadence_days'] } : {}),
          ...(typeof ev['reponder_cadence_days'] === 'number' && Number.isFinite(ev['reponder_cadence_days']) ? { reponder_cadence_days: ev['reponder_cadence_days'] } : {}),
          // M3 — anchor the reconsider clock at add time (an open_question has no
          // last_recheck; this is the date the first reconsider-due is measured
          // from). Prefer the logical anchor_date (deterministic, honors
          // today_override) over the wall-clock ts.
          ...(typeof ev['anchor_date'] === 'string' ? { added_ts: ev['anchor_date'] }
            : typeof ev['ts'] === 'string' ? { added_ts: ev['ts'] } : {}),
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
        if (typeof ev['monitoring_enabled'] === 'boolean') p.monitoring_enabled = ev['monitoring_enabled'];
        // M1 §1.2: the user may re-set the cadence (how often to nudge). A
        // number widens/narrows the interval; nothing else touches it.
        if (typeof ev['recheck_cadence_days'] === 'number' && Number.isFinite(ev['recheck_cadence_days'])) p.recheck_cadence_days = ev['recheck_cadence_days'];
        // M3 §3: the user may re-set the reconsider cadence for an open_question.
        if (typeof ev['reponder_cadence_days'] === 'number' && Number.isFinite(ev['reponder_cadence_days'])) p.reponder_cadence_days = ev['reponder_cadence_days'];
        break;
      }

      // M3 §3 — the user chose `still_open`: the question stays unresolved, but
      // the reconsider clock resets so it is not nagged again until the next
      // cadence. "Leaving it open" is a valid answer — this is a defer, not a
      // resolve; no verdict, no closing decision.
      case 'premise_reconsider': {
        const p = cur?.premises?.find((x) => x.premise_id === ev['premise_id']);
        if (!p) break;
        // Prefer the logical anchor_date over wall-clock ts (deterministic reset).
        p.last_reconsidered = (typeof ev['anchor_date'] === 'string' ? ev['anchor_date']
          : typeof ev['ts'] === 'string' ? ev['ts'] : undefined);
        // optionally re-set cadence at the same time (host may pass it)
        if (typeof ev['reponder_cadence_days'] === 'number' && Number.isFinite(ev['reponder_cadence_days'])) p.reponder_cadence_days = ev['reponder_cadence_days'];
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
          // Prefer the logical anchor_date over the wall-clock ts — the same
          // deterministic clock premise_add (added_ts) and premise_reconsider use.
          // The cadence math reads dateOnly(last_recheck.ts), so a UTC ts made the
          // next nudge fire a day early for a UTC+9 user and broke sim timelines.
          ts: (typeof ev['anchor_date'] === 'string' ? ev['anchor_date'] : ev['ts']) as string | undefined,
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

      case 'wake':
        // Plugin-side event (sail Step 7.5: the in-session 1st settlement of the
        // BIND lean — did the user's own read hold once the reviewers were in?).
        // Session-scoped, not part of the decision state machine; the plugin's
        // own reducer folds it. Until 2026-07-17 this binary counted it as a
        // DROPPED line (plugin events carried no `v` stamp), so a ledger shared
        // between the plugin and the MCP raised a false corruption alarm on
        // check_in (O2 방1 cross-surface finding ①).
        break;

      // ── 당직 루프 (§9) — outside the decision state machine. No contract
      //    entry is created; nothing touches stats. Anchor is a note, not a bet.
      case 'watch_anchor': {
        const date = typeof ev['anchor_date'] === 'string' ? ev['anchor_date']
          : typeof ev['ts'] === 'string' ? ev['ts'].slice(0, 10) : undefined;
        if (!date || typeof ev['text'] !== 'string') { dropped++; break; }
        watch.anchors.set(date, { date, text: ev['text'], ts: ev['ts'] as string | undefined });
        break;
      }

      case 'watch_capture': {
        const date = typeof ev['anchor_date'] === 'string' ? ev['anchor_date']
          : typeof ev['ts'] === 'string' ? ev['ts'].slice(0, 10) : undefined;
        if (!date || typeof ev['text'] !== 'string') { dropped++; break; }
        // capture_id is sha256(date|text), and argus_watch documents re-capturing
        // the same sentence on the same day as idempotent — but the fold used to
        // push blindly, so a double note left TWO identical captures. The user
        // could then never promote it: argus_premises from_capture matched both
        // and hard-errored AMBIGUOUS_REF. Dedup here, like premise_add does.
        const capId = typeof ev['capture_id'] === 'string' ? ev['capture_id'] : undefined;
        if (capId && watch.captures.some((c) => c.id === capId)) break;
        watch.captures.push({
          ...(typeof ev['capture_id'] === 'string' ? { id: ev['capture_id'] } : {}),
          date,
          kind: (ev['kind'] === 'claim' || ev['kind'] === 'question' ? ev['kind'] : 'premise'),
          text: ev['text'],
          source: normalizePremiseSource(ev['source']),
          ...(typeof ev['ai_original'] === 'string' ? { ai_original: ev['ai_original'] } : {}),
          ...(typeof ev['anchor_quote'] === 'string' ? { anchor_quote: ev['anchor_quote'] } : {}),
          ts: ev['ts'] as string | undefined,
        });
        break;
      }

      default:
        // Forward-compat tolerance (plan v5 §6.3): a well-formed, VERSIONED event
        // whose type this binary doesn't know was written by a newer argus-decision-mcp —
        // skip it silently (like gate_input) instead of counting it as corruption,
        // so an old install never raises a false integrity alarm on a new ledger.
        // Only unversioned/structurally-broken events still count as dropped.
        if (typeof ev['event'] === 'string' && typeof ev['v'] === 'number') skippedUnknown++;
        else dropped++;
        break;
    }
  }

  // Stats are DERIVED from the folded state, never counted per event line
  // (state-derivation, 1.4.6 backlog): a hand-edited/merged ledger with a
  // duplicated seal or settle line folds to the same state, so it must fold to
  // the same calibration. Invariant preserved: total_settled == sum of the four
  // buckets; a settled contract with an unknown/legacy outcome ('still_pending',
  // corrupt) is settled but uncounted, exactly as before. `happened` stays the
  // plugin CLI's legacy alias of `held` (old ledgers keep their bytes).
  stats.total_sealed = everSealed.size;
  for (const c of map.values()) {
    if (c.status !== 'settled') continue;
    const o = c.outcome === 'happened' ? 'held' : c.outcome;
    if (o === 'held') { stats.held++; stats.total_settled++; }
    else if (o === 'avoided') { stats.avoided++; stats.total_settled++; }
    else if (o === 'partial') { stats.partial++; stats.total_settled++; }
    else if (o === 'missed') { stats.missed++; stats.total_settled++; }
  }

  const overdue: Array<{ id: string; date: string; text: string }> = [];
  const undatedSeals: string[] = [];
  for (const [id, item] of map.entries()) {
    if (item.status !== 'sealed') continue;
    const date = asDate(item.check_by);
    if (!date) { undatedSeals.push(id); continue; } // sealed but no valid check-by → can never come due; surface it, don't lose it
    if (date <= today) overdue.push({ id, date, text: item.text || '' });
  }
  overdue.sort((a, b) => (a.date < b.date ? -1 : 1));

  return { today, overdue, ids, sealedPredicates, contracts: map, stats, watch, oldest_ts: oldestTs, integrity: { dropped_lines: dropped, skipped_unknown: skippedUnknown, ...(undatedSeals.length ? { undated_seals: undatedSeals } : {}) } };
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

const KNOWN_RULE_TYPES = new Set(['threshold', 'step', 'delta', 'relative', 'band', 'map', 'stateful']);

/** Defensive shape check for a persisted materiality_rule (jsonb from the ledger).
 *  Replay never throws — a malformed rule is simply ignored (heuristic fallback). */
function isMaterialityRule(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r['type'] === 'string' && KNOWN_RULE_TYPES.has(r['type']) && typeof r['params'] === 'object' && r['params'] !== null;
}

// Re-export for callers that imported these from here historically.
export { asDate };
export const _ledgerFileExists = (argusDir: string): boolean => {
  try { return fs.existsSync(ledgerPath(argusDir)); } catch { return false; }
};
