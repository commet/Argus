import type { ContractEntry, LedgerState } from './ledger-replay.js';
import { deriveState } from './state-machine.js';
import { GuardError } from './state-machine.js';
import {
  type PremiseState,
  isMonitored,
  isDueForRecheck,
  isDueForReconsider,
  normalizePremiseText,
  reconsiderAnchor,
  dateOnly,
  daysBetween,
} from './premises-core.js';

/**
 * Living premises — the LEDGER-BOUND half (plan v5). The pure domain (types,
 * ids, cadence, per-premise due-ness) lives in premises-core.ts and is shared
 * byte-for-byte with the webapp; this file adds only what needs the ledger:
 * ref resolution (throws GuardError), nudge-arming (reads decision state), and
 * the cross-decision scans (duePremises / dueOpenQuestions / matching). It
 * re-exports the core so every existing `from './premises.js'` import still works.
 */

export * from './premises-core.js';

/** Is a decision ARMED for nudging as of `today`? Sealing arms the return loop
 *  (plan v5 P4): only a sealed|due decision's premises/open-questions are nudged.
 *  This is the ONE gate duePremises, dueOpenQuestions AND recall's due flags all
 *  share, so "due" can never mean one thing to check_in and another to recall
 *  (the single-source rule — M1 §1.3, extended to recall by M3). */
export function isNudgeArmed(entry: ContractEntry | undefined, today: string): boolean {
  if (!entry) return false;
  const s = deriveState(entry, today);
  return s === 'sealed' || s === 'due';
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

// ── due-ness scans across the ledger ───────────────────────────────────────

export interface DuePremise {
  decision_id: string;
  decision_text: string;
  ordinal: number;
  premise_id: string;
  text: string;
  last_checked?: string;
  /** Days since the last recheck; null = never checked. */
  days_stale: number | null;
  /** Days since the premise was added; null when the add ts is unknown. Lets a
   *  never-checked due line AGE honestly instead of repeating verbatim (the
   *  75-day life loop measured a 20-day byte-identical streak → wallpaper). */
  days_since_add: number | null;
  /** 이 전제가 틀리면 결정에서 무엇이 달라지는지 — 기록될 때 적힌 한 줄.
   *  재확인 순간이 대조할 것을 갖게 하는 유일한 자리다. 공개 스키마가 이것을
   *  약속하고도 소비처가 0이었다(2026-08-18 수리). 없으면 키가 없다. */
  if_false_changes?: string;
}

export interface DueOpenQuestion {
  decision_id: string;
  decision_text: string;
  ordinal: number;
  premise_id: string;
  text: string;
  /** Days since the question was left open (last still_open, else added). null =
   *  no anchor known (due now, treated as most stale). */
  days_open: number | null;
}

/**
 * All open_questions across the ledger that are due for a reconsider nudge. Only
 * decisions in sealed|due state count — an opened-never-sealed decision's
 * questions are tracked but never nagged, mirroring duePremises (M1/M3 §4).
 */
export function dueOpenQuestions(state: LedgerState): DueOpenQuestion[] {
  const out: DueOpenQuestion[] = [];
  for (const entry of state.contracts.values()) {
    if (!isNudgeArmed(entry, state.today)) continue; // shared gate — recall reads it too
    for (const p of entry.premises ?? []) {
      if (!isDueForReconsider(p, state.today)) continue;
      const anchor = reconsiderAnchor(p);
      out.push({
        decision_id: entry.id,
        decision_text: (entry.decision_text || entry.text || '').slice(0, 48),
        ordinal: p.ordinal,
        premise_id: p.premise_id,
        text: p.text,
        days_open: anchor ? daysBetween(anchor, state.today) : null,
      });
    }
  }
  // Never-anchored first (most stale), then by staleness.
  out.sort((a, b) => (b.days_open ?? Infinity) - (a.days_open ?? Infinity));
  return out;
}

/**
 * All due premises across the ledger. Sealing arms monitoring (plan v5 P4): only
 * decisions in sealed|due state count — an opened-never-sealed decision's
 * premises are tracked but never nagged, and settled/dismissed are closed.
 */
export function duePremises(state: LedgerState): DuePremise[] {
  const out: DuePremise[] = [];
  for (const entry of state.contracts.values()) {
    if (!isNudgeArmed(entry, state.today)) continue; // shared gate — recall reads it too
    for (const p of entry.premises ?? []) {
      if (!isDueForRecheck(p, state.today)) continue;
      const last = dateOnly(p.last_recheck?.ts);
      const added = dateOnly(p.added_ts);
      out.push({
        decision_id: entry.id,
        decision_text: (entry.decision_text || entry.text || '').slice(0, 48),
        ordinal: p.ordinal,
        premise_id: p.premise_id,
        text: p.text,
        last_checked: last,
        ...(p.if_false_changes ? { if_false_changes: p.if_false_changes } : {}),
        days_stale: last ? daysBetween(last, state.today) : null,
        days_since_add: added ? daysBetween(added, state.today) : null,
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
 *  premise set is canonical — headline = first active load-bearing premise.
 *  The SHAPE is owned here (core) — renderers import it, never the reverse:
 *  this type used to live in render-receipt.ts, which pulled the whole
 *  presentation layer (surfaces/locale) into the core import closure through
 *  one type-only edge (O2 방2 boundary audit). */
export interface ReceiptPremisesInfo {
  headline?: string;
  tracked: number;
  changed_at_recheck: number;
}

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
