import type { MaterialityRule } from './numeric-drift';

/**
 * Living premises — PURE domain core (plan v5). The ledger-free half of the
 * premise model: types, ids, ordinals, caps, cadence, and due-ness math. Shared
 * byte-for-byte with the webapp review path (src/lib/review/premises-core.ts,
 * pinned by premises-core-drift.test.ts) so a premise means the same thing in the
 * terminal and in the browser. NO fs, NO ledger, NO judgment anywhere.
 *
 * The ledger-bound half (duePremises / matchingMonitoredPremises / resolvePremiseRef /
 * receiptPremisesInfo / isNudgeArmed) stays in premises.ts, which re-exports this.
 */

export type PremiseKind = 'premise' | 'open_question';
export type PremiseSource = 'ai_surfaced' | 'user_stated';
export type PremiseStatus = 'active' | 'retired' | 'resolved';
export type PremiseAmendAction = 'accept' | 'refine' | 'replace' | 'retire';

/** Hard caps (plan v5 §2): a decision is 5 premises, not a wiki. */
export const MAX_ACTIVE_PREMISES = 5;
export const MAX_LOAD_BEARING = 2;
/** Re-check cadence FLOOR: the minimum interval before a premise is nudged again.
 *  Gates DUE-COMPUTATION ONLY — an explicit recheck is always writable (the
 *  mistake-correction path, plan v5 P3). A premise's own `recheck_cadence_days`
 *  (M1 §1.2) can widen this but never narrows below the floor. */
export const RECHECK_MIN_INTERVAL_DAYS = 7;

/** M1 §1.2 — the default re-check cadence when the user pins none. Volatility is
 *  inferred from the premise's materiality-rule type (the only volatility signal
 *  we have at add-time): a `threshold`/`relative`/`delta`/`band` fact is a moving
 *  number (high volatility → check often); `step`/`map`/`stateful` describe
 *  slower-moving ordinal/nominal state; no rule → a neutral middle. Bounded to
 *  [floor, 180] so the cadence is always a sane, non-nagging interval.
 *
 *  This is a *suggestion* the user overrides — never a verdict about the fact. */
export const DEFAULT_RECHECK_CADENCE_DAYS = 14;
const HIGH_VOLATILITY_CADENCE_DAYS = 7;
const SLOW_STATE_CADENCE_DAYS = 30;
const MAX_RECHECK_CADENCE_DAYS = 180;

export function defaultRecheckCadenceDays(rule?: { type?: string } | null): number {
  switch (rule?.type) {
    case 'threshold':
    case 'relative':
    case 'delta':
    case 'band':
      return HIGH_VOLATILITY_CADENCE_DAYS;
    case 'step':
    case 'map':
    case 'stateful':
      return SLOW_STATE_CADENCE_DAYS;
    default:
      return DEFAULT_RECHECK_CADENCE_DAYS;
  }
}

/** M3 §3 — the reconsider cadence for an `open_question`. Distinct from recheck:
 *  an open_question is NOT compared to reality (nobody re-checks a fact) — it is
 *  a question the USER left explicitly unresolved, and cadence is only a "come
 *  back and see if you can answer it yet" timer. Leaving it open stays a valid
 *  answer, so the floor is generous (14) and the default a middle (21), bounded
 *  to [floor, 90] so it never nags and never sleeps forever. The user pins or
 *  amends it; it is a suggestion about the timer, never a verdict about the
 *  question. */
export const REPONDER_MIN_INTERVAL_DAYS = 14;
export const DEFAULT_REPONDER_CADENCE_DAYS = 21;
const MAX_REPONDER_CADENCE_DAYS = 90;

/** The effective reconsider cadence: the pinned value if any, else the default —
 *  clamped to [floor, 90]. One source for both the due-computation and the
 *  "reconsider again in N days" surface line. */
export function reponderCadenceDays(p: PremiseState): number {
  const raw = typeof p.reponder_cadence_days === 'number' && Number.isFinite(p.reponder_cadence_days)
    ? p.reponder_cadence_days
    : DEFAULT_REPONDER_CADENCE_DAYS;
  return Math.max(REPONDER_MIN_INTERVAL_DAYS, Math.min(MAX_REPONDER_CADENCE_DAYS, Math.round(raw)));
}

/** The effective cadence for a premise: its pinned value if any, else the
 *  rule-derived default — clamped to [floor, 180]. One source for both the
 *  due-computation and the "re-check again in N days" surface line. */
export function recheckCadenceDays(p: PremiseState): number {
  const raw = typeof p.recheck_cadence_days === 'number' && Number.isFinite(p.recheck_cadence_days)
    ? p.recheck_cadence_days
    : defaultRecheckCadenceDays(p.materiality_rule as { type?: string } | undefined);
  return Math.max(RECHECK_MIN_INTERVAL_DAYS, Math.min(MAX_RECHECK_CADENCE_DAYS, Math.round(raw)));
}

export interface PremiseRecheck {
  finding: string;
  numeric_value?: number;
  /** The previous recorded baseline when this re-check compared against one. */
  baseline_finding?: string;
  baseline_numeric_value?: number;
  drifted: boolean;
  baseline_only: boolean;
  source: string;         // url | user_stated | host_reported
  source_detail?: string;
  confidence?: 'low' | 'medium' | 'high';
  /** Set by notification-gate merge decisions so T5 can carry the item once. */
  brief_pending?: boolean;
  brief_kind?: 'premise_minor_drift' | 'open_question_new_info' | 'standalone_overflow';
  ts?: string;
  /** Workstream E — true when the server watcher (not the user) recorded this
   *  re-check. Lets surfaces say "제가 대신 확인한 거예요" (honest authorship). */
  auto?: boolean;
}

export interface PremiseState {
  premise_id: string;
  /** Permanent, assigned in add order, never renumbered or reused — a retired P2
   *  stays P2 forever (plan v5 §3.2: renumbering makes the host amend the wrong
   *  premise on the next turn). */
  ordinal: number;
  kind: PremiseKind;
  text: string;
  external: boolean;
  load_bearing: boolean;
  /** User-controlled notification/re-check switch. Missing means the historical
   * default (enabled when the premise is external and load-bearing). This is
   * deliberately independent from material importance and verifiability. */
  monitoring_enabled?: boolean;
  /** The user's own words this premise rests on, verbatim.
   *
   *  Collected since the provenance work and thrown away ever since: the schema
   *  asked for it, used it once to decide user_stated vs ai_surfaced, and never
   *  stored it. So the terminal could never show what the browser card shows
   *  under every premise — "내가 쓴 말" — and nothing downstream could check the
   *  lineage it had already been handed. */
  anchor_quote?: string;
  source: PremiseSource;
  /** The AI's original wording, preserved across user edits — the provenance the
   *  receipt's authorship honesty rests on. Its declared reader is the recall
   *  premises view (plan v5 §6.4). */
  ai_original?: string;
  /** M2 materiality rule declared at add-time (jsonb-nested, no migration).
   *  Absent → the under-fire default heuristic decides drift (M2 §2, §10.2). */
  materiality_rule?: MaterialityRule;
  /** M1 §1.2 — how many days between reality re-checks for this fact. Optional
   *  and jsonb-nested (no migration): absent → derived from the rule type
   *  (defaultRecheckCadenceDays). The user pins it at add-time or amends it; it
   *  only moves the DUE nudge cadence, never blocks an explicit recheck. */
  recheck_cadence_days?: number;
  /** M3 §3 — how many days between reconsider nudges for an `open_question`.
   *  Optional and jsonb-nested (no migration): absent → DEFAULT_REPONDER_CADENCE_DAYS.
   *  The user pins it at add-time or amends it; it only moves the reconsider DUE
   *  nudge, never blocks resolving. Meaningful only for kind='open_question'. */
  reponder_cadence_days?: number;
  /** M3 — the ts of this premise's own `premise_add` event, the anchor the very
   *  first reconsider-due is measured from (an open_question has no last_recheck).
   *  Populated by replay from the add event; absent on hand-built literals. */
  added_ts?: string;
  /** M3 §3 — the ts the user last chose `still_open` (deferred the question
   *  without resolving). Resets the reconsider clock: next due = this + cadence.
   *  Absent → the clock runs from added_ts (or "due now" if neither exists). */
  last_reconsidered?: string;
  /** Workstream E — the user opted Argus in to auto-research this premise/question
   *  against the recent web at its cadence (server-side watcher). Default absent =
   *  manual pull only. Sending its text out for search is gated on THIS being true
   *  (privacy: explicit opt-in). jsonb-nested, no migration; the MCP ignores it. */
  auto_watch?: boolean;
  /** Optional refined web-search query for the watcher; falls back to `text`. */
  watch_query?: string;
  status: PremiseStatus;
  amend_history: Array<{ action: PremiseAmendAction; from?: string; to?: string; note?: string; ts?: string }>;
  /** Latest re-check only — full history lives in the ledger (fold stays small). */
  last_recheck?: PremiseRecheck;
  recheck_count: number;
  /** The user's own closing call on an open_question (resolve). */
  resolved_decision?: string;
}

// ── identity ──────────────────────────────────────────────────────────────

export function normalizePremiseText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Stable, decision-scoped premise id (djb2). Stable across re-adds so nothing
 *  is orphaned; scoped by decision so identical facts in two decisions don't
 *  collide on the row while still being groupable by normalized text. */
export function premiseId(decisionId: string, kind: PremiseKind, text: string): string {
  const key = `${decisionId}:${kind}:${normalizePremiseText(text)}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return `p_${h.toString(36)}`;
}

/** Monitoring eligibility is derived from meaning, then gated by the user's
 * explicit switch. Turning reminders off must never rewrite a premise as
 * unimportant or unverifiable. */
export function isMonitored(p: PremiseState): boolean {
  return p.kind === 'premise'
    && p.status === 'active'
    && p.external
    && p.load_bearing
    && p.monitoring_enabled !== false;
}

// ── date helpers (pure; exported so the ledger half can reuse them) ─────────

export function dateOnly(ts?: string): string | undefined {
  return ts && ts.length >= 10 ? ts.slice(0, 10) : undefined;
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function addDays(day: string, days: number): string {
  const t = Date.parse(day + 'T00:00:00Z');
  if (Number.isNaN(t)) return day;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

// ── due-ness (the living half) ─────────────────────────────────────────────

/** Is this premise due for a re-check as of `today`? Monitored + never checked,
 *  or last checked ≥ the premise's cadence ago (M1 §1.2: the pinned
 *  recheck_cadence_days, else the rule-derived default, clamped to the floor).
 *  (Writing a recheck is never blocked by this — it gates the nudge, not the
 *  pen.) */
export function isDueForRecheck(p: PremiseState, today: string): boolean {
  if (!isMonitored(p)) return false;
  const last = dateOnly(p.last_recheck?.ts);
  if (!last) {
    // Never checked: wait one cadence from when it was ADDED before the first
    // nudge — the same clock open_questions use (reconsiderAnchor = added_ts).
    // Firing "re-check this" the day after sealing was premature (reality hasn't
    // moved) and left the premise/question loops internally inconsistent
    // (founder decision, 2026-07-10). No add date known → treat as due.
    const added = dateOnly(p.added_ts);
    return added ? daysBetween(added, today) >= recheckCadenceDays(p) : true;
  }
  return daysBetween(last, today) >= recheckCadenceDays(p);
}

/** The YYYY-MM-DD a monitored premise next comes due for re-check — the
 *  formalized twin of the old free-text "re-check suggested in 7 days" string
 *  (M1 §1.2, data model §5). null when never checked (it is due now) or the
 *  premise isn't monitored. Pure date arithmetic, no clock read. */
export function nextRecheckDue(p: PremiseState): string | null {
  if (!isMonitored(p)) return null;
  const last = dateOnly(p.last_recheck?.ts);
  if (!last) {
    // Never checked: first check is due one cadence after it was added (was
    // "due now"; founder decision 2026-07-10 to match the open_question clock).
    const added = dateOnly(p.added_ts);
    return added ? addDays(added, recheckCadenceDays(p)) : null;
  }
  return addDays(last, recheckCadenceDays(p));
}

// ── open_question reconsider due (M3 §3) ───────────────────────────────────

/** An active `open_question` is a candidate for a reconsider nudge — the twin of
 *  isMonitored for premises. Sealing arms it (the caller gates on decision state,
 *  same as duePremises). resolved/retired questions are closed and never nagged. */
export function isReconsiderable(p: PremiseState): boolean {
  return p.kind === 'open_question'
    && p.status === 'active'
    // Same user switch `isMonitored` honours, and for the same reason: the MCP
    // offers `monitoring_enabled` on ANY tracked item and the alert copy promises
    // "끄면 멈춰요". Leaving it out here made it a no-op on exactly the items that
    // promise it — the companion brief kept nudging a muted question every day, and
    // the receipt's next_check_by kept being dragged forward by it. Gating here
    // rather than at each caller keeps ONE answer to "is this item still watched?"
    // (2026-07-29; the premise-watch cron's own guard is now redundant, not wrong).
    && p.monitoring_enabled !== false;
}

/** The anchor date the reconsider clock runs from: the last time the user chose
 *  `still_open`, else the premise's add ts. Date-only, undefined when neither is
 *  known (then the question is treated as due now). Exported so the ledger half
 *  can compute days_open. */
export function reconsiderAnchor(p: PremiseState): string | undefined {
  return dateOnly(p.last_reconsidered) ?? dateOnly(p.added_ts);
}

/** Is this open_question due to be surfaced for reconsideration as of `today`?
 *  Reconsiderable + (never anchored → due now) or (anchor + cadence ≤ today).
 *  Resolving is never blocked by this — it gates the nudge, not the user's call. */
export function isDueForReconsider(p: PremiseState, today: string): boolean {
  if (!isReconsiderable(p)) return false;
  const anchor = reconsiderAnchor(p);
  if (!anchor) return true;
  return daysBetween(anchor, today) >= reponderCadenceDays(p);
}

/** The YYYY-MM-DD an open_question next comes due for reconsideration — the twin
 *  of nextRecheckDue. null when not reconsiderable or when no anchor exists (it
 *  is due now). Pure date arithmetic, no clock read. */
export function nextReponderDue(p: PremiseState): string | null {
  if (!isReconsiderable(p)) return null;
  const anchor = reconsiderAnchor(p);
  if (!anchor) return null; // due now
  return addDays(anchor, reponderCadenceDays(p));
}
