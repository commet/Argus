import { asDate } from './resolve-today.js';

/**
 * Seal validation (blueprint §3.1). The STRONG gates are structural: an empty
 * or too-short predicate, and a check_by that is not a real future date, are
 * hard-refused. The "not falsifiable" check is a WEAK heuristic (m3) — it
 * catches a few obvious vibe-predicates in English and is explicitly NOT
 * claimed to be a complete falsifiability gate.
 *
 * MIRROR: the plugin's SEED gate (argus-plugin-v2/scripts/validate-gates.mjs)
 * carries a copy of the VIBE/VIBE_KO regexes and the structural checks — the
 * packages can't share code (the plugin must be self-contained), so keep the
 * two in sync by hand when editing either.
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
// Korean vibe-predicates (12 P1-4): "잘 될 것 같다 아마도" sealed — and was
// congratulated — because the list was English-only. Same weak/advisory status;
// no \b (word boundaries don't work for Hangul). NOT a hard gate (§5-14).
const VIBE_KO = /(잘\s*될|잘\s*풀릴|괜찮을|좋아질|나아질)\s*(것|거)\s*(같|이)|아마도|어떻게든\s*(될|되)/;

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

  if (VIBE_KO.test(predicate)) {
    return {
      code: 'NOT_FALSIFIABLE',
      message: '이건 기분이지 확인 가능한 예측이 아닙니다.',
      recovery: '숫자·임계값·관찰 가능한 사건으로 다시 적어주세요. (휴리스틱 — 놓칠 수 있음)',
      weak: true,
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
