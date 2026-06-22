/**
 * Dim9 — self-honesty about empirical maturity.
 *
 * Distinct from the user-facing Zero-Judgment spine (which governs judging the
 * USER). This governs Argus telling the truth about ITSELF: with ~0 settled
 * contracts there are zero validated outcomes, so no accuracy/calibration figure
 * may render as if it were a proven track record. Honest "unproven yet" is a trust
 * asset; a faked track record is a trust bomb. (Metaculus/Manifold only show
 * calibration on RESOLVED questions — same principle.)
 *
 * This is the single enforceable invariant; surfaces (patterns card, DQ trend,
 * boss record) call `calibrationDisclosure()` and MUST NOT render an accuracy
 * number when `showStats` is false. Guarded by calibration-disclosure.test.ts.
 */

// A track record needs at least this many SETTLED outcomes before any accuracy/
// Brier/calibration figure is meaningful. Below it: counts only + an honest banner.
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
  const settled = Math.max(0, counts.settled | 0);
  if (settled < SETTLED_THRESHOLD) {
    return {
      showStats: false,
      banner:
        settled === 0
          ? 'No outcomes have settled yet — this is unproven, not a track record.'
          : `Only ${settled} outcome${settled === 1 ? '' : 's'} settled so far — too few to be a track record yet (a figure appears at ${SETTLED_THRESHOLD}).`,
      counts,
    };
  }
  return { showStats: true, banner: null, counts };
}

/**
 * Hard guard for callers that compute an accuracy/Brier figure: returns the figure
 * only when the settled threshold is met, else `null`. Use this so a stat can never
 * be rendered below the threshold even by accident.
 */
export function gatedAccuracy(counts: CalibrationCounts, computeAccuracy: () => number): number | null {
  return counts.settled >= SETTLED_THRESHOLD ? computeAccuracy() : null;
}
