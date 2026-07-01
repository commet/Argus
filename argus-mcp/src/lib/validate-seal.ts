import { asDate } from './resolve-today.js';

/**
 * Seal validation (blueprint §3.1). The STRONG gates are structural: an empty
 * or too-short predicate, and a check_by that is not a real future date, are
 * hard-refused. The "not falsifiable" check is a WEAK heuristic (m3) — it
 * catches a few obvious vibe-predicates in English and is explicitly NOT
 * claimed to be a complete falsifiability gate.
 */

export interface SealValidationError {
  code: 'EMPTY_PREDICATE' | 'BAD_CHECK_BY' | 'NOT_FALSIFIABLE';
  message: string;
  recovery: string;
  /** weak heuristics are advisory — the caller may downgrade them to a warning */
  weak?: boolean;
}

// Obvious non-falsifiable vibes. Weak/advisory only.
const VIBE = /\b(go well|be fine|be good|be great|work out|feel right|be successful|do better|improve somehow)\b/i;

export function validateSeal(predicate: unknown, checkBy: unknown, today: string): SealValidationError | null {
  if (typeof predicate !== 'string' || predicate.trim().length < 8) {
    return {
      code: 'EMPTY_PREDICATE',
      message: 'A seal needs a checkable statement (at least 8 characters).',
      recovery: 'Write a prediction reality can mark true or false, e.g. "cutover downtime < 5 min".',
    };
  }

  const date = asDate(checkBy);
  if (!date) {
    return {
      code: 'BAD_CHECK_BY',
      message: 'check_by must be a real date in YYYY-MM-DD form.',
      recovery: 'Pick the date when reality will answer, e.g. "2026-09-01".',
    };
  }
  if (date <= today) {
    return {
      code: 'BAD_CHECK_BY',
      message: `check_by (${date}) must be in the future (today is ${today}).`,
      recovery: 'Pick a future date — the check-by is when you will come back to settle.',
    };
  }

  if (VIBE.test(predicate)) {
    return {
      code: 'NOT_FALSIFIABLE',
      message: 'This reads like a vibe, not a checkable prediction.',
      recovery: 'Re-state it with a number, threshold, or observable event. (Heuristic — may miss cases.)',
      weak: true,
    };
  }

  return null;
}
