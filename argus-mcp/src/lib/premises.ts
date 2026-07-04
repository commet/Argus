import type { ContractEntry, LedgerState } from './ledger-replay.js';
import type { ReceiptPremisesInfo } from './render-receipt.js';
import type { MaterialityRule } from './numeric-drift.js';
import { deriveState } from './state-machine.js';
import { GuardError } from './state-machine.js';

/**
 * Living premises — domain logic (plan v5). A decision's premises are the facts
 * and open questions it rests on, tracked as first-class ledger objects:
 * editable (authorship-honest), re-checkable against reality, and closable by
 * the user. This module is pure domain — ids, ordinals, refs, caps, due-ness —
 * with NO fs and NO judgment anywhere.
 */

export type PremiseKind = 'premise' | 'open_question';
export type PremiseSource = 'ai' | 'user';
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
  drifted: boolean;
  baseline_only: boolean;
  source: string;         // url | user_stated | host_reported
  source_detail?: string;
  ts?: string;
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

/** Monitoring is DERIVED, never stored (state-is-the-fold): only an active,
 *  load-bearing, external premise is watched — the opt-out default that arms
 *  the return loop without ceremony (plan v5 §12). */
export function isMonitored(p: PremiseState): boolean {
  return p.kind === 'premise' && p.status === 'active' && p.external && p.load_bearing;
}

// ── ref resolution (ordinals beat opaque ids across turns) ────────────────

/**
 * Resolve a user/host premise reference: an ordinal ("P1"/"p1"/"1"), a full
 * premise_id, or an unambiguous id prefix (≥4 chars). Throws GuardError
 * NO_SUCH_PREMISE / AMBIGUOUS_REF with the current list in the recovery hint.
 */
export function resolvePremiseRef(premises: PremiseState[], ref: string): PremiseState {
  const list = premises ?? [];
  const listing = list.map((p) => `P${p.ordinal}=${p.premise_id} (${p.status}) "${p.text.slice(0, 40)}"`).join('; ') || '(none)';
  const r = ref.trim();

  const ord = /^[Pp]?(\d+)$/.exec(r);
  if (ord) {
    const n = parseInt(ord[1], 10);
    const hit = list.find((p) => p.ordinal === n);
    if (hit) return hit;
    throw new GuardError('NO_SUCH_PREMISE', `No premise P${n} on this decision.`, `Current premises: ${listing}`);
  }

  const exact = list.find((p) => p.premise_id === r);
  if (exact) return exact;

  if (r.length >= 4) {
    const matches = list.filter((p) => p.premise_id.startsWith(r));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new GuardError('AMBIGUOUS_REF', `"${r}" matches ${matches.length} premises.`, `Use the ordinal instead: ${listing}`);
    }
  }
  throw new GuardError('NO_SUCH_PREMISE', `No premise matches "${r}".`, `Use an ordinal like "P1". Current premises: ${listing}`);
}

// ── due-ness (the living half) ─────────────────────────────────────────────

export interface DuePremise {
  decision_id: string;
  decision_text: string;
  ordinal: number;
  premise_id: string;
  text: string;
  last_checked?: string;
  /** Days since the last recheck; null = never checked. */
  days_stale: number | null;
}

function dateOnly(ts?: string): string | undefined {
  return ts && ts.length >= 10 ? ts.slice(0, 10) : undefined;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/** Is this premise due for a re-check as of `today`? Monitored + never checked,
 *  or last checked ≥ the premise's cadence ago (M1 §1.2: the pinned
 *  recheck_cadence_days, else the rule-derived default, clamped to the floor).
 *  (Writing a recheck is never blocked by this — it gates the nudge, not the
 *  pen.) */
export function isDueForRecheck(p: PremiseState, today: string): boolean {
  if (!isMonitored(p)) return false;
  const last = dateOnly(p.last_recheck?.ts);
  if (!last) return true;
  return daysBetween(last, today) >= recheckCadenceDays(p);
}

/** The YYYY-MM-DD a monitored premise next comes due for re-check — the
 *  formalized twin of the old free-text "re-check suggested in 7 days" string
 *  (M1 §1.2, data model §5). null when never checked (it is due now) or the
 *  premise isn't monitored. Pure date arithmetic, no clock read. */
export function nextRecheckDue(p: PremiseState): string | null {
  if (!isMonitored(p)) return null;
  const last = dateOnly(p.last_recheck?.ts);
  if (!last) return null; // due now
  return addDays(last, recheckCadenceDays(p));
}

function addDays(day: string, days: number): string {
  const t = Date.parse(day + 'T00:00:00Z');
  if (Number.isNaN(t)) return day;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

/**
 * All due premises across the ledger. Sealing arms monitoring (plan v5 P4): only
 * decisions in sealed|due state count — an opened-never-sealed decision's
 * premises are tracked but never nagged, and settled/dismissed are closed.
 */
export function duePremises(state: LedgerState): DuePremise[] {
  const out: DuePremise[] = [];
  for (const entry of state.contracts.values()) {
    const dState = deriveState(entry, state.today);
    if (dState !== 'sealed' && dState !== 'due') continue;
    for (const p of entry.premises ?? []) {
      if (!isDueForRecheck(p, state.today)) continue;
      const last = dateOnly(p.last_recheck?.ts);
      out.push({
        decision_id: entry.id,
        decision_text: (entry.text || '').slice(0, 48),
        ordinal: p.ordinal,
        premise_id: p.premise_id,
        text: p.text,
        last_checked: last,
        days_stale: last ? daysBetween(last, state.today) : null,
      });
    }
  }
  // Never-checked first (most stale), then by staleness.
  out.sort((a, b) => (b.days_stale ?? Infinity) - (a.days_stale ?? Infinity));
  return out;
}

/** Group due premises by normalized text — the accumulation lens (plan v5 P1):
 *  the same world-model fact under several decisions is ONE fact to re-check. */
export interface DuePremiseGroup {
  text: string;
  premises: DuePremise[];
}

export function groupDuePremises(due: DuePremise[]): DuePremiseGroup[] {
  const byText = new Map<string, DuePremiseGroup>();
  for (const d of due) {
    const key = normalizePremiseText(d.text);
    const g = byText.get(key);
    if (g) g.premises.push(d);
    else byText.set(key, { text: d.text, premises: [d] });
  }
  return [...byText.values()];
}

/** The living-premises summary a receipt renders from (plan v5 §3.3): the
 *  premise set is canonical — headline = first active load-bearing premise. */
export function receiptPremisesInfo(entry: ContractEntry | undefined): ReceiptPremisesInfo | undefined {
  const list = entry?.premises ?? [];
  if (list.length === 0) return undefined;
  const headline = list.find((p) => p.status === 'active' && p.load_bearing && p.kind === 'premise')?.text;
  return {
    ...(headline ? { headline } : {}),
    tracked: list.length,
    changed_at_recheck: list.filter((p) => p.last_recheck?.drifted === true).length,
  };
}

/** Active monitored premises across OTHER decisions whose normalized text matches
 *  — the explicit apply_to_matching fan-out targets (plan v5 P1). */
export function matchingMonitoredPremises(
  state: LedgerState,
  sourceDecisionId: string,
  text: string,
): Array<{ entry: ContractEntry; premise: PremiseState }> {
  const key = normalizePremiseText(text);
  const out: Array<{ entry: ContractEntry; premise: PremiseState }> = [];
  for (const entry of state.contracts.values()) {
    if (entry.id === sourceDecisionId) continue;
    const dState = deriveState(entry, state.today);
    if (dState !== 'sealed' && dState !== 'due' && dState !== 'opened') continue;
    for (const p of entry.premises ?? []) {
      if (isMonitored(p) && normalizePremiseText(p.text) === key) out.push({ entry, premise: p });
    }
  }
  return out;
}
