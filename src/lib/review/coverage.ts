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
 * Safety rail on units-per-chunk. The char budget is the PRIMARY limiter (a real
 * report's ~1k-char paragraphs bind at ~30-40 units before this ever trips); this
 * only guards a pathological doc of thousands of tiny units from packing one
 * unreadably-dense prompt. A doc that fits one chunk keeps the richer single-pass
 * (multi-lens) path — chunking (and the map-reduce path) engages only past it.
 */
export const UNITS_PER_CHUNK = 100;

export interface ReviewChunks {
  /** ordered chunks; each fits the char budget + unit cap, per-unit text capped. */
  chunks: ArtifactUnit[][];
  /** total units across all chunks actually kept (the honest numerator). */
  unitsReviewed: number;
  /** artifact.units.length before chunking (the honest denominator). */
  total: number;
  /** units past the maxChunks capacity that were never placed in a chunk. */
  dropped: number;
}

/**
 * Split the WHOLE document into ordered chunks so a long report is reviewed end
 * to end, not just on the front units that fit one prompt (a 300-item report used
 * to be judged on its first ~13%). Chunk boundaries fall on the char budget first,
 * the unit cap second; a single oversized unit is truncated (never dropped).
 * `maxChunks` bounds cost — any units past it are reported as `dropped` so
 * coverage stays honest (never a silent cap, CLAUDE.md spine).
 */
export function chunkUnitsForReview(
  units: ArtifactUnit[],
  maxChunks: number,
  unitsPerChunk = UNITS_PER_CHUNK,
  charBudget = PROMPT_CHAR_BUDGET,
  perUnitCap = PER_UNIT_CHAR_CAP,
): ReviewChunks {
  const chunks: ArtifactUnit[][] = [];
  let cur: ArtifactUnit[] = [];
  let used = 0;
  const flush = () => {
    if (cur.length) {
      chunks.push(cur);
      cur = [];
      used = 0;
    }
  };
  for (const u of units) {
    const text = u.text.length > perUnitCap ? u.text.slice(0, perUnitCap) : u.text;
    const capped = text === u.text ? u : { ...u, text };
    // Start a new chunk before this unit would overflow — but never emit an empty
    // one (a lone oversized unit is truncated above and kept).
    if (cur.length > 0 && (used + text.length > charBudget || cur.length >= unitsPerChunk)) {
      flush();
      if (chunks.length >= maxChunks) break;
    }
    cur.push(capped);
    used += text.length;
  }
  if (chunks.length < maxChunks) flush();
  const unitsReviewed = chunks.reduce((n, c) => n + c.length, 0);
  return { chunks, unitsReviewed, total: units.length, dropped: units.length - unitsReviewed };
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
