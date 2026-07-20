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
import { VERDICT_LEAN as LEAN, VERDICT_FORK as FORK, VERDICT_CONFIRM_EN as CONFIRM_EN, VERDICT_CONFIRM_KO as CONFIRM_KO } from './surface-lint.js';

export interface CruxError {
  code: 'CRUX_NOT_A_QUESTION' | 'CRUX_CARRIES_LEAN' | 'CRUX_ADMIN_ONLY';
  message: string;
  recovery: string;
}

// The directional/fork/confirmation tells are the SINGLE source in
// surface-lint.ts (imported above), so the crux guard and the surface-lint loop
// can never drift. Only the crux-specific admin-logistics tells stay local.
const ADMIN_EN = /\b(final decision[-\s]?maker|deadline|what (format|tone)|which section|how many pages|fill (in|out) the (section|outline|template)|skeleton)\b/i;
const ADMIN_KO = /최종\s*결정권자|마감(일|이|은|을|\s*시한|\s*날짜)|데드라인|어떤\s*형식|어느\s*섹션|몇\s*(페이지|장|줄)|어떤\s*톤|스켈레톤|(섹션|항목|목차)(을|를)?\s*채/;

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
      message: 'The crux carries a directional lean; that is a verdict in disguise.',
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
      message: 'The crux is a leading confirmation ("is this right?"), a verdict in disguise.',
      recovery: 'Ask the single neutral question, not whether the current direction is correct.',
    };
  }
  if (ADMIN_EN.test(t) || ADMIN_KO.test(t)) {
    return {
      code: 'CRUX_ADMIN_ONLY',
      message: 'The crux asks an administrative/logistics detail, not the load-bearing question.',
      recovery: 'Ask the premise or fork that changes the judgment, not the deadline, format, decision-maker, or which section to fill.',
    };
  }
  return null;
}
