/**
 * Dim9 — self-honesty about empirical maturity.
 *
 * Distinct from the user-facing Zero-Judgment spine (which governs judging the
 * USER). This governs Argus telling the truth about ITSELF: with ~0 settled
 * contracts there are zero validated outcomes, so no accuracy/calibration figure
 * may render as if it were a proven track record. Honest "unproven yet" is a trust
 * asset; a faked track record is a trust bomb. (Metaculus/Manifold only show
 * calibration on RESOLVED questions — but Argus does not convert a person's
 * records into a performance figure at any sample size.)
 *
 * This is the single enforceable invariant; surfaces (patterns card, DQ trend,
 * boss record) call `calibrationDisclosure()` and MUST NOT render an accuracy
 * number when `showStats` is false. Guarded by calibration-disclosure.test.ts.
 */

// A track record needs at least this many SETTLED outcomes before any accuracy/
// Brier/calibration figure is meaningful. Below it: counts only + an honest banner.
/** Retained only for the legacy third-return ceremony. It is not a score gate. */
export const SETTLED_THRESHOLD = 3;

export interface CalibrationCounts {
  runs: number;     // decisions run through Argus
  sealed: number;   // decisions sealed into a falsifiable contract
  settled: number;  // contracts settled against reality (the only validated outcomes)
}

export interface CalibrationDisclosure {
  showStats: boolean;       // may an accuracy/calibration figure render at all?
  banner: string | null;    // honest maturity statement to show when stats are withheld
  counts: CalibrationCounts; // always safe to show: runs / sealed / settled
}

export function calibrationDisclosure(counts: CalibrationCounts): CalibrationDisclosure {
  return {
    showStats: false,
    banner: 'Answers stay with their individual records; Argus does not produce a performance statistic.',
    counts,
  };
}

/**
 * Hard guard for callers that compute an accuracy/Brier figure: returns the figure
 * only when the settled threshold is met, else `null`. Use this so a stat can never
 * be rendered below the threshold even by accident.
 */
export function gatedAccuracy(counts: CalibrationCounts, computeAccuracy: () => number): number | null {
  void counts;
  void computeAccuracy;
  return null;
}
