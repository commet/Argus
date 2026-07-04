import { replayLedger, type LedgerState } from './ledger-replay.js';
import { duePremises, groupDuePremises, dueOpenQuestions } from './premises.js';
import { surfacesFor } from './surfaces.js';

/**
 * ambient-due — the ONE due-count source (M1 §1.3 · M3 §3, single-source rule).
 *
 * "What is due right now" is computed in exactly one place so the in-session
 * ambient line, the dispatch-level piggyback, and check_in can never drift:
 *   - contracts past check-by   = ledger.overdue (the same set check_in shows)
 *   - premise facts to re-check = grouped due premises (the same grouping
 *     check_in shows — one world-model fact under several decisions is ONE)
 *   - open questions to reconsider = active open_questions past their reconsider
 *     cadence (M3 — the friend's missing half: an unresolved question is nudged
 *     back, never nagged; leaving it open stays a valid answer)
 *
 * Pure counting: no fs write, no clock read (today is passed in), no judgment.
 * The renderer decides voice; this decides only the numbers.
 */
export interface AmbientDue {
  contractsDue: number;
  premiseFactsDue: number;
  openQuestionsDue: number;
}

/** Count from an already-replayed ledger (when the caller has one in hand). */
export function ambientDueFromState(state: LedgerState): AmbientDue {
  return {
    contractsDue: state.overdue.length,
    premiseFactsDue: groupDuePremises(duePremises(state)).length,
    openQuestionsDue: dueOpenQuestions(state).length,
  };
}

/** Count by replaying the ledger for `dir` as of `today`. */
export function ambientDue(dir: string, today: string): AmbientDue {
  return ambientDueFromState(replayLedger(dir, today));
}

/** True when nothing at all is due — the silence gate (restraint: zero renders
 *  nothing, never an empty nag). */
export function isSilent(due: AmbientDue): boolean {
  return due.contractsDue === 0 && due.premiseFactsDue === 0 && due.openQuestionsDue === 0;
}

/**
 * The localized one-line ambient fact for a due count, or '' when silent.
 * Leads with a space so it appends cleanly to the END of a tool's surface
 * (M1 §1.3, §6: never obscure the result — the line is last, and it is a fact
 * + the argus_check_in handle, never a directive).
 */
export function ambientLine(dir: string | null | undefined, due: AmbientDue): string {
  if (isSilent(due)) return '';
  const A = surfacesFor(dir).ambient;
  const { contractsDue: c, premiseFactsDue: p, openQuestionsDue: q } = due;
  // Fragment-composed so any subset of the three due kinds reads naturally in
  // both locales (M3 adds a third kind — a fixed combo table would be 7 cases).
  const frags: string[] = [];
  if (c > 0) frags.push(A.frag_contracts(c));
  if (p > 0) frags.push(A.frag_premises(p));
  if (q > 0) frags.push(A.frag_open_questions(q));
  return A.wrap(frags);
}
