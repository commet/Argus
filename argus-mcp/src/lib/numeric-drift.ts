/**
 * Numeric premise drift — the only MECHANICAL drift decision (plan v5 §7.1).
 *
 * Deliberately takes explicit numbers, never parses them out of prose: the
 * webapp's regex-first-number approach reads "2026년 기준금리 3.5%" as 2026 and
 * manufactures fake drift. The HOST names the number; this function only compares.
 *
 * Text premises are NOT decided here — a paraphrase is not a changed fact, so
 * string comparison over-fires. For text, the host asserts `changed` as a
 * research finding (provenance-armed, recorded verbatim; see argus_recheck).
 */

/** Relative move (fraction) below which a numeric change is noise, not drift. */
export const NUMERIC_DRIFT_THRESHOLD = 0.1;

export interface NumericDrift {
  drifted: boolean;
  reason: string;
}

export function numericDrift(prev: number, next: number): NumericDrift {
  if (!Number.isFinite(prev) || !Number.isFinite(next)) {
    return { drifted: false, reason: 'non-finite input — not comparable' };
  }
  if (prev === next) return { drifted: false, reason: 'unchanged' };
  const signFlip = Math.sign(prev) !== Math.sign(next) && prev !== 0 && next !== 0;
  if (prev === 0) {
    // No relative base — any move off zero is a real change.
    return { drifted: true, reason: `moved off zero: 0 → ${next}` };
  }
  const rel = Math.abs(next - prev) / Math.abs(prev);
  if (signFlip) return { drifted: true, reason: `sign flip: ${prev} → ${next}` };
  if (rel >= NUMERIC_DRIFT_THRESHOLD) {
    return { drifted: true, reason: `moved ${Math.round(rel * 100)}%: ${prev} → ${next}` };
  }
  return { drifted: false, reason: `moved ${Math.round(rel * 100)}% (<${Math.round(NUMERIC_DRIFT_THRESHOLD * 100)}% threshold)` };
}
