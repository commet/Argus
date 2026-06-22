/**
 * Under-fire judgment gates — ported from plugin v2.6 clarify (rule 1b + §2 rule 4).
 *
 * - assessFrameStatus: the leverage test. "Would flipping the surface question to
 *   the reframed real_question actually change the action?" If no → FLAT: do NOT
 *   manufacture a different question (the mirror clause — the validated stress
 *   test measured ~60% over-fire on flat decisions inventing reframes that
 *   changed nothing). This is a DETERMINISTIC guard/fallback; the richer signal
 *   is the LLM's own frame_status, but this catches the obvious flat case and
 *   validates the LLM output.
 *
 * - applyDecisionDensityGate: the low-density gate. Returns 'low' (→ a 1-line
 *   directive instead of the full scaffold) ONLY when ALL four conditions hold.
 *   When in doubt, NOT low — false-low is more harmful than false-medium (it
 *   hands a directive the user may act on without verification).
 *
 * Pure functions, fully unit-testable, no LLM, no clock.
 */

export type FrameStatus = 'flat' | 'load_bearing';
export type DecisionDensity = 'low' | 'medium' | 'high';
export type Reversibility = 'reversible' | 'partial' | 'irreversible';

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[?.!,…·"'""''()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaccard overlap of word sets — a cheap "are these the same question?" proxy. */
function wordOverlap(a: string, b: string): number {
  const wa = new Set(normalize(a).split(' ').filter(Boolean));
  const wb = new Set(normalize(b).split(' ').filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / new Set([...wa, ...wb]).size;
}

export interface FrameStatusInput {
  realQuestion: string;
  surfaceQuestion: string;
  /** Hidden assumptions surfaced by analysis — none usually means nothing to reframe around. */
  assumptions?: string[];
}

/**
 * FLAT when the reframed question is essentially the surface question (the
 * reframe carries no leverage). LOAD_BEARING when it materially differs.
 * When genuinely ambiguous, default LOAD_BEARING (rule 1b: a missed real fork is
 * worse than one honest flat answer) — but a near-identical reframe with no
 * assumptions is treated as flat.
 */
export function assessFrameStatus(input: FrameStatusInput): FrameStatus {
  const real = normalize(input.realQuestion);
  const surface = normalize(input.surfaceQuestion);
  if (!real || !surface) return 'load_bearing';

  // Identical (post-normalize) → unambiguously flat.
  if (real === surface) return 'flat';

  const overlap = wordOverlap(real, surface);
  const assumptions = (input.assumptions || []).filter((a) => a && a.trim());

  // Very high overlap AND no distinct assumptions to pivot on → flat (the reframe
  // is cosmetic). Otherwise the reframe carries content → load_bearing.
  if (overlap >= 0.8 && assumptions.length === 0) return 'flat';

  return 'load_bearing';
}

export interface DecisionDensityInput {
  reversibility: Reversibility;
  framingConfidence: number; // 0-100
  /** The right action collapses to a single imperative sentence ("rename / don't"). */
  actionCollapsesToOneSentence: boolean;
  /** The one check is verifiable in <5 min with no external dependency. */
  checkIsQuick: boolean;
}

/**
 * Returns 'low' ONLY when ALL four hold. Otherwise 'medium' (the safe default).
 * Never returns 'high' — high is a substantive judgment the LLM makes; this gate
 * exists solely to catch the over-engineering failure mode (forcing a 5-section
 * scaffold onto a tab-rename).
 */
export function applyDecisionDensityGate(input: DecisionDensityInput): DecisionDensity {
  const low =
    input.reversibility === 'reversible' &&
    input.framingConfidence >= 80 &&
    input.actionCollapsesToOneSentence === true &&
    input.checkIsQuick === true;
  return low ? 'low' : 'medium';
}
