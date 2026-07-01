/**
 * Reviewability scoring (design doc §"Reviewability Score가 필요하다").
 *
 * Not every document can be reviewed to the same depth. Argus judges
 * reviewability FIRST so it never speaks confidently over a scanned PDF or an
 * image-only deck. Bands drive the UX:
 *   80–100 normal · 60–79 caveated · 40–59 limited · <40 no full receipt.
 *
 * The score is computed in two passes: a pre-review estimate from the artifact
 * alone (extraction / structure / anchor coverage), then finalized after the
 * judgment map exists (decision clarity / evidence availability).
 */

import {
  type CanonicalArtifact,
  type DocumentJudgmentMap,
  type ReviewabilityScore,
  reviewabilityBand,
} from './schema';

const EXTRACTION_WEIGHT: Record<CanonicalArtifact['extraction_quality'], number> = {
  high: 100,
  medium: 70,
  low: 35,
  unsupported: 0,
};

export function scoreReviewability(
  artifact: CanonicalArtifact,
  map?: DocumentJudgmentMap,
): ReviewabilityScore {
  const reasons: string[] = [];

  // 1. extraction
  const extraction = EXTRACTION_WEIGHT[artifact.extraction_quality];
  if (artifact.extraction_quality === 'unsupported') {
    reasons.push('텍스트를 추출하지 못해 전체 검수가 어렵습니다.');
  } else if (artifact.extraction_quality === 'low') {
    reasons.push('텍스트 추출 품질이 낮습니다.');
  }

  // 2. structure — headings/sections/slides give the reviewer scaffolding
  const s = artifact.detected_structure;
  const structuralUnits = (s.heading_count ?? 0) + (s.slide_count ?? 0) + (s.section_count ?? 0);
  const structure = clamp(structuralUnits === 0 ? 40 : 60 + Math.min(40, structuralUnits * 8));
  if (structuralUnits === 0 && artifact.units.length > 0) {
    reasons.push('구조(제목/섹션)가 없어 근거 위치를 짚기 어렵습니다.');
  }

  // 3. anchor coverage — share of units that carry a usable anchor
  const anchored = artifact.units.filter((u) => hasAnchor(u.source_anchor)).length;
  const anchor_coverage = artifact.units.length === 0 ? 0 : Math.round((anchored / artifact.units.length) * 100);

  // 4/5. decision clarity + evidence availability (need the map)
  let decision_clarity = 50;
  let evidence_availability = 50;
  if (map) {
    const hasCore = !!map.core_question && map.core_question.length > 8;
    const decisionPoints = map.decision_points.length;
    decision_clarity = clamp((hasCore ? 55 : 20) + Math.min(45, decisionPoints * 15));
    if (!hasCore) reasons.push('문서에서 결정할 질문이 뚜렷하지 않습니다.');

    const claims = map.main_claims.length || 1;
    const withEvidence = map.main_claims.filter((c) => c.anchors.length > 0 || c.status === 'supported').length;
    evidence_availability = clamp(Math.round((withEvidence / claims) * 100));
  }

  const score = Math.round(
    extraction * 0.35 +
      structure * 0.15 +
      anchor_coverage * 0.15 +
      decision_clarity * 0.2 +
      evidence_availability * 0.15,
  );

  const band = reviewabilityBand(score);
  if (band === 'insufficient') {
    reasons.push('전체 receipt 대신 "무엇이 빠졌는지"를 먼저 보여줍니다.');
  } else if (band === 'limited') {
    reasons.push('제한적으로만 검수하고 부족한 맥락을 요청합니다.');
  }

  return {
    score,
    extraction,
    structure,
    decision_clarity,
    evidence_availability,
    anchor_coverage,
    reasons,
  };
}

function hasAnchor(a: { line_start?: number; page?: number; slide?: number; section_path?: string[] }): boolean {
  return (
    a.line_start !== undefined ||
    a.page !== undefined ||
    a.slide !== undefined ||
    (a.section_path !== undefined && a.section_path.length > 0)
  );
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
