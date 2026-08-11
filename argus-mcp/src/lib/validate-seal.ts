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
  code: 'EMPTY_PREDICATE' | 'BAD_CHECK_BY' | 'NOT_FALSIFIABLE' | 'BUNDLED_PREDICATE';
  message: string;
  recovery: string;
  /** weak heuristics are advisory — the caller may downgrade them to a warning */
  weak?: boolean;
  /** BUNDLED_PREDICATE only: the clauses the splitter found, in source order. */
  claims?: string[];
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

// ── Bundle gate (2026-08-11) ────────────────────────────────────────────────
// The first-user journey died here five times out of five. A practitioner's
// real sentence is a BUNDLE — "migration mostly smooth · 1-2 edge cases break ·
// done in ~3 days" — and one predicate can hold one of those. Two failures were
// measured, both fatal: the assistant read the contract, saw no way to keep the
// other claims, and never called at all; or it crammed the bundle into 400
// chars, producing a record settle can only ever mark `partial`. A bundled seal
// is not a smaller truth, it is an ungradeable one — every downstream number
// (calibration, the settled receipt) is built on a true/false that cannot be
// given honestly.
//
// The rule itself is not new. argus-plugin-v2's sense-signal.js has carried it
// since the plugin shipped ("Record exactly ONE falsifiable claim per predicate
// … never conjoin them"), but only as PROSE, in only one of the two zones, and
// as a gate in neither. So a user on the plugin got the rule and a user on bare
// MCP got nothing — the exact drift CLAUDE.md's single-source rule exists to
// stop. Position repair could not close it: the served tool surface is at its
// byte ceiling, and wording had already failed to change this behaviour once.
// A gate here fires no matter what the caller read.
//
// CONSERVATIVE BY CONSTRUCTION, because a false positive manufactures friction
// (the over-fire clause), and unlike the vibe check this one refuses sentences
// that are perfectly clear. Two independent GRADEABLE clauses are required:
//   - dates are stripped first, so "by 2026-09-01, downtime < 5 min" is one
//     claim with its horizon spelled out, not two;
//   - a clause with no magnitude of its own never counts, so "downtime < 5 min
//     and no data loss" stays a single claim and passes untouched.
// It fires on what was actually measured — several separately-gradeable numbers
// stacked into one sentence — and stays quiet everywhere else.
// A check-by restated inside the predicate ("by 2026-09-01, downtime < 5 min")
// is the same claim's horizon, not a second claim. Dates never count as
// magnitudes — this was the first false positive the probe caught.
const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;
// TIER 1 — the writer marked the boundary themselves. Semicolons, sentence
// breaks, bullets and newlines are enumeration: people do not punctuate a
// single claim this way. `\.\s+` needs the trailing space so decimals ("5.5s")
// and a trailing full stop survive intact.
const STRONG_SPLIT = /\s*(?:[;·|]|\n+|\.\s+)\s*/;
// TIER 2 — coordination. "and" joins noun phrases as readily as claims
// ("downtime and latency stay under 5 min"), so this tier only counts when both
// sides carry their own magnitude.
const WEAK_SPLIT = /\s*(?:,\s*(?:and|but|then|so)\b|\s+and\s+|\s+but\s+|,|、|그리고|하지만)\s*/i;
// Digits and thresholds only. HARD_ANCHOR's word forms ("at least", 이상) modify
// a magnitude rather than being one, so they can never split a sentence.
const GRADEABLE = /\d|[%<>=≤≥]/;
// Below the length a predicate needs to be a statement at all, a fragment is
// punctuation debris, not a claim. Reuses the threshold already in force above
// rather than inventing a second one.
const MIN_CLAIM = 8;
// A conditional sets the terms the claim is graded under; it is not a second
// claim. "If we compress the crew to 5, 30-day completion stays above 62%" has
// a magnitude on both sides of the comma and is still ONE prediction — the
// plugin's own SEED fixture, which caught this the moment the gate was mirrored
// over there. Antecedents are dropped before anything is counted.
const CONDITIONAL_HEAD = /^(?:if|when|unless|once|assuming|provided|given|만약|만일)\b/i;
const CONDITIONAL_TAIL_KO = /(?:으면|다면|라면|이면|하면|되면|거든|든지)$/;

function pieces(text: string, splitter: RegExp): string[] {
  return text.split(splitter).map((c) => c.trim()).filter((c) => c.length > 0);
}

function isAntecedent(clause: string): boolean {
  return CONDITIONAL_HEAD.test(clause) || CONDITIONAL_TAIL_KO.test(clause);
}

/**
 * The separately-checkable claims stacked into one predicate, in source order —
 * or null when it is a single claim. Exported so the guard test can pin the
 * two tiers directly instead of only through validateSeal.
 */
export function detectBundledClaims(predicate: string): string[] | null {
  const strong = pieces(predicate, STRONG_SPLIT)
    .filter((c) => c.length >= MIN_CLAIM && !isAntecedent(c));
  if (strong.length > 1) return strong;
  const weak = pieces(predicate, WEAK_SPLIT).filter((c) => !isAntecedent(c));
  const gradeable = weak.filter((c) => GRADEABLE.test(c.replace(ISO_DATE, ' ')));
  // Two magnitudes on either side of a conjunction: unambiguously two claims.
  if (gradeable.length > 1) return weak;
  // ENUMERATION (RUN7, measured). The first version required two magnitudes,
  // and the seal it let through was "Clean cutover with no data loss, roughly
  // 15-30 min of downtime, and query latency improving or staying flat" —
  // three claims carrying one number between them, which settles as `partial`
  // exactly like the bundles the two-magnitude rule does catch. A list of three
  // is the writer enumerating, so one magnitude is enough to confirm it.
  //
  // KNOWN FALSE POSITIVE, accepted deliberately: a single claim wearing two
  // appositives ("P95 latency, measured at the edge, stays under 200ms") reads
  // as three clauses here and will be refused. The costs are not symmetric — a
  // false positive costs the caller one round trip through a recovery that was
  // measured to work (RUN7), while a missed bundle is an ungradeable record
  // that every later number inherits. Weak/advisory, like the vibe check.
  if (weak.length > 2 && gradeable.length > 0) return weak;
  return null;
}

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

  // Runs BEFORE the HARD_ANCHOR bypass on purpose. A bundle is made OF numbers,
  // so the bypass would return null on every sentence this gate exists to catch.
  const claims = detectBundledClaims(predicate);
  if (claims) {
    return {
      code: 'BUNDLED_PREDICATE',
      message: `This holds ${claims.length} separately checkable claims, and a seal grades one. Whatever reality does, a bundle can only ever settle as "partial".`,
      // Names the ONE move that works, and forbids the silent version of it.
      // Dropping the rest quietly is the failure this refusal is preventing —
      // the user said those things and is owed the choice.
      recovery:
        'Seal the single most load-bearing claim, in the user\'s own words. Tell the user which claims you set aside (they are in data.claims) and let them ask for any of them; never drop them silently, and never rejoin them with "and".',
      weak: true,
      claims,
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
