/**
 * Coverage: the single, honest answer to "how much of this document did we
 * actually review?" (design doc §"실패 UX / 소유권 정직성"; CLAUDE.md spine
 * §"no silent caps"). Every input cap in the review path funnels through here so
 * a receipt can NEVER present "검수 완료" over a document it only half-read.
 *
 * Two responsibilities, both pure + deterministic (unit-tested):
 *  1. packUnitsForPrompt — pick the units that fit the count AND char budget,
 *     hard-capping any single oversized unit, so a prompt never blows the
 *     server's per-message limit (a large paste used to hard-fail with an
 *     opaque 400 instead of degrading honestly).
 *  2. computeCoverage — fold the extractor-side caps (pages/slides/units the
 *     binary parser dropped) and the prompt-side unit cap into one ReviewCoverage
 *     with a band + human-readable notes the UI can surface.
 */

import { type ArtifactUnit, type CanonicalArtifact, type ReviewCoverage } from './schema';

/**
 * Cumulative char budget for the units rendered into ONE prompt. Kept under the
 * server's MAX_MESSAGE_LENGTH (50_000, see lib/llm-validation.ts) with headroom
 * for the prompt's own boilerplate + JSON schema, so a large document degrades
 * (fewer units + a coverage note) instead of failing the request outright.
 */
export const PROMPT_CHAR_BUDGET = 40_000;

/** A single pathological unit (one giant unbroken paragraph) can't alone blow
 *  the budget or the server limit — its text is capped before rendering. */
export const PER_UNIT_CHAR_CAP = 4_000;

export interface PackedUnits {
  /** units to send to the model — count-capped, char-budgeted, per-unit-capped. */
  units: ArtifactUnit[];
  /** how many units existed before capping (the honest denominator). */
  total: number;
}

/**
 * Pick the leading units that fit BOTH `maxUnits` and the cumulative char
 * budget, truncating any single unit longer than `perUnitCap`. Always keeps at
 * least one unit (a lone oversized unit is truncated, not dropped, so the review
 * never runs on nothing).
 */
export function packUnitsForPrompt(
  units: ArtifactUnit[],
  maxUnits: number,
  charBudget = PROMPT_CHAR_BUDGET,
  perUnitCap = PER_UNIT_CHAR_CAP,
): PackedUnits {
  const out: ArtifactUnit[] = [];
  let used = 0;
  for (const u of units) {
    if (out.length >= maxUnits) break;
    const text = u.text.length > perUnitCap ? u.text.slice(0, perUnitCap) : u.text;
    // Stop before overflowing the budget — but never emit zero units.
    if (out.length > 0 && used + text.length > charBudget) break;
    out.push(text === u.text ? u : { ...u, text });
    used += text.length;
  }
  return { units: out, total: units.length };
}

/**
 * Fold extractor-side caps (artifact.source_caps) + the prompt-side unit cap
 * (`unitsReviewed` = how many units actually reached the model) into one honest
 * coverage object. The band is driven by the SMALLEST covered fraction across
 * units / pages / slides — so a 120-of-320-page PDF reads as 'low', not 'full'.
 */
export function computeCoverage(artifact: CanonicalArtifact, unitsReviewed: number): ReviewCoverage {
  const caps = artifact.source_caps ?? {};
  const unitsTotal = artifact.units.length;
  const notes: string[] = [];

  const pagesDropped = caps.pages_total != null && caps.pages_read != null && caps.pages_total > caps.pages_read;
  const slidesDropped = caps.slides_total != null && caps.slides_read != null && caps.slides_total > caps.slides_read;
  const unitsDropped = unitsReviewed < unitsTotal;

  if (pagesDropped) notes.push(`이 PDF는 ${caps.pages_total}쪽 중 앞 ${caps.pages_read}쪽만 읽었습니다.`);
  if (slidesDropped) notes.push(`이 덱은 ${caps.slides_total}장 중 앞 ${caps.slides_read}장만 읽었습니다.`);
  if (caps.units_capped) notes.push('문서가 매우 길어 뒷부분 일부는 추출 단계에서 빠졌습니다.');
  if (unitsDropped) notes.push(`문서가 길어 ${unitsTotal}개 항목 중 앞 ${unitsReviewed}개만 검수했습니다.`);

  const unitFraction = unitsTotal > 0 ? unitsReviewed / unitsTotal : 1;
  const pageFraction = caps.pages_total ? (caps.pages_read ?? 0) / caps.pages_total : 1;
  const slideFraction = caps.slides_total ? (caps.slides_read ?? 0) / caps.slides_total : 1;
  const minFraction = Math.min(unitFraction, pageFraction, slideFraction);

  const anyDrop = pagesDropped || slidesDropped || unitsDropped || !!caps.units_capped;
  const band: ReviewCoverage['band'] = !anyDrop ? 'full' : minFraction >= 0.5 ? 'partial' : 'low';

  return {
    units_total: unitsTotal,
    units_reviewed: unitsReviewed,
    pages_total: caps.pages_total,
    pages_read: caps.pages_read,
    slides_total: caps.slides_total,
    slides_read: caps.slides_read,
    band,
    notes,
  };
}
