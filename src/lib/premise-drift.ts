/**
 * Premise drift — the mechanical part of "living premises" (DESIGN §5.2, §6).
 *
 * Between seal and settle, an external premise ("금리가 올해 동결된다") is
 * re-checked. This module decides, purely, whether a re-checked value has
 * DRIFTED enough to be worth pulling the user back in — and whether an alert may
 * actually FIRE (mode + frequency cap + adaptive back-off). It NEVER performs the
 * network fetch: the actual re-check is a seam left to the caller (webapp edge
 * function / plugin WebSearch), so this stays pure and testable.
 *
 * Firing threshold is HIGH by design: enabling monitoring is not over-firing;
 * over-firing is manufacturing a fork on a flat decision. An alert fires only when
 * a premise ACTUALLY changed.
 */

import type { DecisionItem } from './decision-items';
import { shouldBackOff } from './decision-items';

const DAY_MS = 86_400_000;

/** How long after the last check before an on_change premise may be re-checked
 *  again (per-item frequency cap — a stream would be a nag; DESIGN §5.2). */
export const RECHECK_MIN_INTERVAL_DAYS = 7;

/** Relative change (fraction) a numeric premise must move before it counts as
 *  drift. 10% — below this is noise, not a changed premise. */
export const NUMERIC_DRIFT_THRESHOLD = 0.1;

export type DriftKind = 'numeric' | 'text';

export interface DriftInput {
  /** The previously confirmed value summary (baseline). Undefined on first check. */
  last_value?: string;
  /** The freshly re-checked value summary. */
  current_value: string;
  kind?: DriftKind; // default: inferred (numeric if both parse as numbers)
}

export interface DriftResult {
  drifted: boolean;
  /** true on the very first check (no baseline yet) — record the baseline, do NOT alert. */
  baseline_only: boolean;
  reason: string;
}

function parseNumber(s: string): number | null {
  // Pull the first number (handles "0.25%p 인상", "3.5%", "1,200만원").
  const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Decide whether a re-checked premise value has drifted. Pure.
 *   - No baseline yet → baseline_only (never alerts; caller stores current_value).
 *   - Numeric premises → drift when |Δ| / |base| ≥ NUMERIC_DRIFT_THRESHOLD
 *     (or the sign flips, or it crosses zero).
 *   - Text premises → drift when the normalized summary changed.
 */
export function evaluateDrift(input: DriftInput): DriftResult {
  const current = (input.current_value ?? '').trim();
  if (!input.last_value || !input.last_value.trim()) {
    return { drifted: false, baseline_only: true, reason: 'first check — baseline recorded' };
  }
  const last = input.last_value.trim();

  const lastNum = parseNumber(last);
  const curNum = parseNumber(current);
  const kind: DriftKind = input.kind ?? (lastNum !== null && curNum !== null ? 'numeric' : 'text');

  if (kind === 'numeric' && lastNum !== null && curNum !== null) {
    if (lastNum === curNum) return { drifted: false, baseline_only: false, reason: 'numeric unchanged' };
    const signFlip = Math.sign(lastNum) !== Math.sign(curNum);
    const denom = Math.abs(lastNum);
    const rel = denom === 0 ? Infinity : Math.abs(curNum - lastNum) / denom;
    const drifted = signFlip || rel >= NUMERIC_DRIFT_THRESHOLD;
    return {
      drifted,
      baseline_only: false,
      reason: drifted
        ? `numeric moved ${last} → ${current}${signFlip ? ' (sign flip)' : ` (${Math.round(rel * 100)}%)`}`
        : `numeric moved <${Math.round(NUMERIC_DRIFT_THRESHOLD * 100)}%`,
    };
  }

  const drifted = normalizeText(last) !== normalizeText(current);
  return {
    drifted,
    baseline_only: false,
    reason: drifted ? `changed: "${last}" → "${current}"` : 'text unchanged',
  };
}

export interface FireDecision {
  fire: boolean;
  reason: string;
}

/**
 * Combine the drift result with the item's alert state to decide whether an alert
 * may actually surface. Fires only when: mode is on_change, the premise drifted,
 * the per-item frequency cap has elapsed, and the item has not backed off from
 * repeated dismissals. Pure; `now` injected.
 */
export function shouldFireAlert(item: DecisionItem, drift: DriftResult, now: number): FireDecision {
  if (item.status !== 'active') return { fire: false, reason: 'item not active' };
  if (item.alert?.mode !== 'on_change') return { fire: false, reason: `mode is ${item.alert?.mode}` };
  if (shouldBackOff(item)) return { fire: false, reason: 'backed off (dismissed too often)' };
  if (drift.baseline_only) return { fire: false, reason: 'baseline recorded, no prior value' };
  if (!drift.drifted) return { fire: false, reason: 'no material drift' };
  const last = item.alert?.last_checked ? Date.parse(item.alert.last_checked) : NaN;
  if (!Number.isNaN(last) && now - last < RECHECK_MIN_INTERVAL_DAYS * DAY_MS) {
    return { fire: false, reason: 'within frequency cap' };
  }
  return { fire: true, reason: drift.reason };
}

/** True when an on_change premise is due for a fresh re-check (frequency cap
 *  elapsed, or never checked). Callers use this to decide whether to spend a
 *  web lookup. Pure; `now` injected. */
export function isDueForRecheck(item: DecisionItem, now: number): boolean {
  if (item.alert?.mode !== 'on_change' || item.status !== 'active') return false;
  if (shouldBackOff(item)) return false;
  const last = item.alert?.last_checked ? Date.parse(item.alert.last_checked) : NaN;
  if (Number.isNaN(last)) return true;
  return now - last >= RECHECK_MIN_INTERVAL_DAYS * DAY_MS;
}
