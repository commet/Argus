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
  code: 'CRUX_NOT_A_QUESTION' | 'CRUX_CARRIES_LEAN' | 'CRUX_ADMIN_ONLY';
  message: string;
  recovery: string;
}

// Directional / recommendation tells. NOTE: the old `i('| w)?d` alternation
// also matched the bare word "id" ("user id" flagged a neutral question as
// CRUX_CARRIES_LEAN — 11 P1-3); decomposed to the two real tells.
const LEAN = /\b(you should|i'd|i would|the (stronger|better|safer|smarter) (case|choice|option|move|bet)|most (teams|people|founders)|the right (call|move|choice)|go with|lean(s)? toward|my (recommendation|advice|take)|honestly,? (i|you)|if i were you)\b/i;
// Two-pole fork tell ("A or B?" framed as the question).
const FORK = /\b(a or b|option (a|b|1|2)|either\b.*\bor\b.*\?)/i;
// Admin-only logistics a crux is never built from — parity with the webapp's
// question-rules floor (R1 admin_only / R4 internal_structure). ko + en.
const ADMIN_EN = /\b(final decision[-\s]?maker|deadline|what (format|tone)|which section|how many pages|fill (in|out) the (section|outline|template)|skeleton)\b/i;
const ADMIN_KO = /최종\s*결정권자|마감(일|이|은|을|\s*시한|\s*날짜)|데드라인|어떤\s*형식|어느\s*섹션|몇\s*(페이지|장|줄)|어떤\s*톤|스켈레톤|(섹션|항목|목차)(을|를)?\s*채/;
// Leading confirmation ("is this the right direction?") — a verdict in disguise.
const CONFIRM_EN = /\b(does this look right|is this (the )?(right )?(direction|call|approach))\b/i;
const CONFIRM_KO = /이\s*방향(이|으로)?\s*맞(나요|죠|습니까|을까요)|(이게|이\s*방향이)\s*맞다고\s*보(시|나요|죠)/;

export function validateCrux(crux: unknown): CruxError | null {
  if (typeof crux !== 'string') return null;
  const t = crux.trim().normalize('NFC');
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
  if (CONFIRM_EN.test(t) || CONFIRM_KO.test(t)) {
    return {
      code: 'CRUX_CARRIES_LEAN',
      message: 'The crux is a leading confirmation ("is this right?") — a verdict in disguise.',
      recovery: 'Ask the single neutral question, not whether the current direction is correct.',
    };
  }
  if (ADMIN_EN.test(t) || ADMIN_KO.test(t)) {
    return {
      code: 'CRUX_ADMIN_ONLY',
      message: 'The crux asks an administrative/logistics detail, not the load-bearing question.',
      recovery: 'Ask the premise or fork that changes the judgment — not the deadline, format, decision-maker, or which section to fill.',
    };
  }
  return null;
}
