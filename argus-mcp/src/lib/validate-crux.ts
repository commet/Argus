/**
 * Crux-question validator (blueprint §3.3, M1). A banned-pattern guard that
 * reduces — but does not eliminate — verdict leak through the one free-text
 * field a fired decision carries. The output schema has only `crux_question`
 * (no options/poles/lean/tilt), so a fork is impossible by type; this guard
 * additionally rejects a crux that smuggles a directional lean.
 *
 * HONEST LIMIT (§6): this is a weak filter on free text. It is bypassable. The
 * "tool-surface verdict-leak" claim rests on this plus the structural absences,
 * not on this regex being complete.
 */
export interface CruxError {
  code: 'CRUX_NOT_A_QUESTION' | 'CRUX_CARRIES_LEAN';
  message: string;
  recovery: string;
}

// Directional / recommendation tells. NOTE: the old `i('| w)?d` alternation
// also matched the bare word "id" ("user id" flagged a neutral question as
// CRUX_CARRIES_LEAN — 11 P1-3); decomposed to the two real tells.
const LEAN = /\b(you should|i'd|i would|the (stronger|better|safer|smarter) (case|choice|option|move|bet)|most (teams|people|founders)|the right (call|move|choice)|go with|lean(s)? toward|my (recommendation|advice|take)|honestly,? (i|you)|if i were you)\b/i;
// Two-pole fork tell ("A or B?" framed as the question).
const FORK = /\b(a or b|option (a|b|1|2)|either\b.*\bor\b.*\?)/i;

export function validateCrux(crux: unknown): CruxError | null {
  if (typeof crux !== 'string') return null;
  const t = crux.trim();
  if (!t) return null;

  if (!t.endsWith('?')) {
    return {
      code: 'CRUX_NOT_A_QUESTION',
      message: 'A crux must be phrased as a single neutral question.',
      recovery: 'End it with "?" and remove any statement of which way to go.',
    };
  }
  if (LEAN.test(t)) {
    return {
      code: 'CRUX_CARRIES_LEAN',
      message: 'The crux carries a directional lean — that is a verdict in disguise.',
      recovery: 'Name the assumption neutrally as a question; do not say which side is stronger.',
    };
  }
  if (FORK.test(t)) {
    return {
      code: 'CRUX_CARRIES_LEAN',
      message: 'The crux is shaped as a two-pole fork.',
      recovery: 'Ask the single load-bearing question, not "A or B?".',
    };
  }
  return null;
}
