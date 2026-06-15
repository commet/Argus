/**
 * Voyage state machine — the single source of truth for a project's
 * "ship state" on the sea chart.
 *
 * State is DERIVED, never stored. Computing it from real signals means it
 * can never drift out of sync with reality, and users never have to curate
 * a status field by hand (which they wouldn't).
 *
 * Locked decisions:
 *  - 검증(verified) = the outcome was reckoned (every predicate graded). The
 *    strongest landing — settling your predictions IS reckoning the voyage, so
 *    it counts on its own, with or without a Coda. No unfair wreck afterward.
 *  - 도착(arrived) = the Coda (meta_reflection) was written but the outcome
 *    isn't reckoned yet. An intentional "I've landed" act, not merely
 *    "touched the last tool".
 *  - 표류(adrift) at 14 idle days, 난파(wrecked) at 30 — and ONLY when the
 *    voyage is genuinely incomplete. A finished-but-no-Coda voyage is
 *    "approaching port" (sailing), never wrecked. No unfair shipwrecks.
 *  - Wreck is a derived emotional state, not data loss. Reopen → updated_at
 *    refreshes → it refloats to sailing. The voyage is never held hostage.
 */

export type VoyageState =
  | 'docked'    // 출항 전 — named, not yet underway
  | 'sailing'   // 항해 중 — underway (incl. approaching port)
  | 'adrift'    // 표류 — 14d idle, incomplete (warning, not yet wrecked)
  | 'wrecked'   // 난파 — 30d idle, incomplete
  | 'arrived'   // 입항 — Coda written, outcome not yet reckoned
  | 'verified'; // 검증된 항해 — outcome reckoned (사후 정산 complete)

export type OutcomeVerdict = 'right' | 'wrong' | 'mixed' | 'pending';

export const DRIFT_DAYS = 14;
export const WRECK_DAYS = 30;

/** The four legs of the voyage, in order. Mirrors ProjectRef['tool']. */
export const VOYAGE_ROUTE = ['reframe', 'synthesize', 'recast', 'rehearse'] as const;
export type VoyageLeg = (typeof VOYAGE_ROUTE)[number];

/**
 * Normalized signals the state machine reads. Decoupled from the Project
 * shape on purpose — the project list derives these from per-tool stores,
 * not from project.refs (which may be empty even mid-voyage).
 */
export interface VoyageSignals {
  /** Any tool has been touched. */
  started: boolean;
  /** All four legs reached. Caps state at 'sailing' — can't wreck near port. */
  completedAllLegs?: boolean;
  /** ISO timestamp of the most recent activity on this voyage. */
  lastActivityAt: string;
  /** meta_reflection written → intentional landing. */
  hasCoda: boolean;
  /** The last leg touched — used to pin where a wreck ran aground. */
  lastLeg?: VoyageLeg | null;
  /** Outcome reckoning verdict, if any. */
  outcomeVerdict?: OutcomeVerdict;
}

function idleDays(lastActivityAt: string, now: number): number {
  const then = new Date(lastActivityAt).getTime();
  if (Number.isNaN(then)) return 0; // unknown → treat as fresh, never wreck on bad data
  return (now - then) / 86_400_000;
}

export function getVoyageState(s: VoyageSignals, now: number): VoyageState {
  // 1. Outcome reckoned (every predicate graded) is terminal and overrides
  //    idleness — settling your predictions IS landing the voyage, so it counts
  //    on its own even without a written Coda. No unfair wreck after a reckoning.
  if (s.outcomeVerdict && s.outcomeVerdict !== 'pending') return 'verified';
  // 2. A written Coda is an intentional landing → arrived (outcome not yet reckoned).
  if (s.hasCoda) return 'arrived';
  // 3. Never left harbor.
  if (!s.started) return 'docked';
  // 4. Reached the final leg but hasn't landed yet → approaching port.
  //    Deliberately cannot wreck; the nudge is "land it", not "you failed".
  if (s.completedAllLegs) return 'sailing';
  // 5. Incomplete + idle → drift, then wreck. Both conditions required.
  const idle = idleDays(s.lastActivityAt, now);
  if (idle >= WRECK_DAYS) return 'wrecked';
  if (idle >= DRIFT_DAYS) return 'adrift';
  return 'sailing';
}

/** Days until the next state transition (drift→wreck), for gentle UI warnings. Null if N/A. */
export function daysUntilWreck(s: VoyageSignals, now: number): number | null {
  if (s.hasCoda || !s.started || s.completedAllLegs) return null;
  const remaining = WRECK_DAYS - idleDays(s.lastActivityAt, now);
  return remaining > 0 ? Math.ceil(remaining) : 0;
}

interface StateMeta {
  ko: string;
  en: string;
  /** Visual/emotional tone, for tinting cards. */
  tone: 'neutral' | 'active' | 'warning' | 'danger' | 'arrived' | 'gold';
}

export const VOYAGE_STATE_META: Record<VoyageState, StateMeta> = {
  docked:   { ko: '출항 전',     en: 'Docked',   tone: 'neutral' },
  sailing:  { ko: '항해 중',     en: 'Sailing',  tone: 'active' },
  adrift:   { ko: '표류',        en: 'Adrift',   tone: 'warning' },
  wrecked:  { ko: '난파',        en: 'Wrecked',  tone: 'danger' },
  arrived:  { ko: '입항',        en: 'Arrived',  tone: 'arrived' },
  verified: { ko: '검증된 항해', en: 'Verified', tone: 'gold' },
};

const LEG_LABELS: Record<VoyageLeg, { ko: string; en: string }> = {
  reframe:    { ko: '재정의',  en: 'Reframe' },
  synthesize: { ko: '종합',    en: 'Synthesize' },
  recast:     { ko: '설계',    en: 'Recast' },
  rehearse:   { ko: '검증',    en: 'Rehearse' },
};

/** Where a wreck ran aground — "the question they fled". Null if never started. */
export function wreckPin(lastLeg: VoyageLeg | null | undefined, locale: 'ko' | 'en'): string | null {
  if (!lastLeg) return null;
  const label = LEG_LABELS[lastLeg];
  return locale === 'ko'
    ? `${label.ko} 단계에서 멈춤`
    : `Ran aground at ${label.en}`;
}
