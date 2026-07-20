import { asDate, isRealDate } from './resolve-today.js';

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
// A predicate carrying an observable anchor (a number, a date, a threshold or
// comparison, a concrete completion verb) is checkable even when vibe wording
// rides along ("아마도 2월에 이미 1억 넘는다"). The vibe regexes exist to catch
// PURE feelings; without this bypass a single "아마도" hard-blocked legit
// numeric predicates (1.4.6 backlog: weak heuristic acting as a hard gate).
// HARD only. A bare completion WORD (ship/launch/출시/배포…) must NOT defuse the
// vibe check: those words appear as NOUNS inside genuinely vague sentences —
// "The launch will probably go well", "이번 출시는 잘 될 것 같다 아마도" — so
// treating them as anchors let PURE vibes through the falsifiability gate (CI
// caught both, 2026-07-20). Only a gradeable magnitude/threshold rescues a
// predicate that carries vibe wording. This does NOT re-open the 1.4.6
// over-fire: the vibe check only runs when vibe wording is actually present, so
// a plain "we ship the app by Friday" still passes untouched.
const HARD_ANCHOR = /\d|[%<>=≤≥]|(이상|이하|미만|초과)|\b(at least|more than|less than|no more than)\b/i;

export function validateSeal(predicate: unknown, checkBy: unknown, today: string): SealValidationError | null {
  if (typeof predicate !== 'string' || predicate.trim().length < 8) {
    return {
      code: 'EMPTY_PREDICATE',
      message: 'A seal needs a checkable statement (at least 8 characters).',
      recovery: 'Write a prediction reality can mark true or false, e.g. "cutover downtime < 5 min".',
    };
  }

  const date = asDate(checkBy);
  if (!date || !isRealDate(date)) {
    // A calendar-invalid but digit-shaped date (2026-13-01, 2026-09-31) must be
    // refused here: it would otherwise seal a malformed .ics and a wrong due
    // date, and only be caught by luck if it happened to sort before today.
    return {
      code: 'BAD_CHECK_BY',
      message: 'check_by must be a real calendar date in YYYY-MM-DD form.',
      recovery: 'Pick the date when reality will answer, e.g. "2026-09-01".',
    };
  }
  if (date <= today) {
    return {
      code: 'BAD_CHECK_BY',
      message: `check_by (${date}) must be in the future (today is ${today}).`,
      recovery: 'Pick a future date. The check-by is when you will come back to settle.',
    };
  }

  if (HARD_ANCHOR.test(predicate)) return null; // gradeable despite any vibe wording

  if (VIBE_KO.test(predicate)) {
    return {
      code: 'NOT_FALSIFIABLE',
      message: '이건 아직 막연한 느낌에 가까워서, 나중에 맞았는지 확인하기 어렵습니다.',
      recovery: '숫자나 눈에 보이는 사건으로 다시 적어주세요. (자동으로 판단한 것이라 예외가 있을 수 있습니다.)',
      weak: true,
    };
  }
  if (VIBE.test(predicate)) {
    return {
      code: 'NOT_FALSIFIABLE',
      message: 'This reads like a vibe, not a checkable prediction.',
      recovery: 'Re-state it with a number, threshold, or observable event. (A heuristic; it may miss cases.)',
      weak: true,
    };
  }

  return null;
}
