/**
 * Single source of truth for the review pipeline's prompts (CLAUDE.md
 * §"Single Source of Truth for Prompts"). Each pipeline stage has a distinct
 * role + output schema (design doc §"LLM Handoff Protocol"):
 *   1. Extraction  → profile + Document Judgment Map (no evaluation)
 *   2. Lens Review → one lens's findings only (anchored, no global conclusion)
 *   3. Synthesis   → compress into receipt fields (no "proceed" tilt)
 *
 * Hard rules baked into every prompt:
 *   - cite the source by unit_id (anchors) — an unanchored finding is worthless.
 *   - no generic advice ("리스크를 고려하세요") — must reference a specific claim.
 *   - never decide for the user; never invent facts not in the units.
 *   - Korean output, pure JSON.
 */

import { type ArtifactUnit, type JudgmentLens, type UserReviewContext } from './schema.js';

const SPINE = `너는 Argus의 판단 검수기다. 사용자의 결정을 대신 내리지 않는다.
- 절대 "이 전략은 틀렸다", "진행하세요" 같은 평결을 내지 않는다.
- 모든 지적은 문서의 특정 문장에 연결한다. 근거 위치 없는 지적은 내지 않는다.
- 사람이 읽는 문장(title·detail·rationale)에서는 위치를 사람이 읽는 표현으로만 지칭한다
  (예: "결론 섹션의 착수 문장", "slide 4의 시장규모 주장", "3번째 문단"). unit_id 같은 내부
  식별자(u_...)를 문장에 절대 노출하지 않는다. unit_id는 오직 unit_ids 배열에만 넣는다.
- "리스크를 고려하세요", "더 조사하세요" 같은 일반론은 금지한다. 무엇을 확인할지 구체적으로 쓴다.
- 원문에 없는 사실을 지어내지 않는다.
- 출력은 순수 JSON. 마크다운/설명 없이 { 로 시작해 } 로 끝난다. 한국어로 쓴다.`;

export function renderUnits(units: ArtifactUnit[], limit: number): string {
  return units
    .slice(0, limit)
    .map((u) => {
      const a = u.source_anchor;
      const loc =
        a.slide !== undefined
          ? `slide ${a.slide}`
          : a.section_path?.length
            ? a.section_path.join(' › ')
            : a.line_start !== undefined
              ? `L${a.line_start}`
              : '';
      return `[${u.unit_id}] (${u.kind}${loc ? ' · ' + loc : ''}) ${u.text}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// 1. Extraction: Canonical Artifact → profile + Document Judgment Map
// ---------------------------------------------------------------------------

export function buildExtractionPrompt(
  units: ArtifactUnit[],
  ctx: UserReviewContext,
  unitLimit: number,
): { system: string; user: string } {
  const concerns = ctx.concerns?.length ? `사용자 관심사: ${ctx.concerns.join(', ')}.` : '';
  const hints = [
    ctx.audience_hint && `대상 독자 힌트: ${ctx.audience_hint}`,
    ctx.decision_wanted && `얻으려는 결정: ${ctx.decision_wanted}`,
    ctx.biggest_worry && `가장 불안한 부분: ${ctx.biggest_worry}`,
  ]
    .filter(Boolean)
    .join('\n');

  const system = `${SPINE}

이번 단계는 "추출"이다. 평가/비판/추천은 하지 않는다. 문서를 판단 가능한 지도로만 바꾼다.
document_type, intent, audience, stakes, artifact_maturity를 추론하고, 확신이 낮으면 source_confidence를 낮게 준다.
각 항목은 반드시 관련 unit_id 배열을 포함한다.`;

  const user = `아래는 검수할 문서의 단위(unit)들이다. 각 줄은 [unit_id] (종류 · 위치) 텍스트 형식이다.

${renderUnits(units, unitLimit)}

${hints}
${concerns}

다음 JSON을 출력하라:
{
  "profile": { "document_type": "...", "intent": "...", "audience": "...", "stakes": "low|medium|high", "artifact_maturity": "...", "source_confidence": 0.0 },
  "core_question": "이 문서가 실제로 결정해야 하는 질문",
  "explicit_recommendation": "문서가 겉으로 미는 결론(없으면 생략)",
  "implicit_recommendation": "은연중 미는 결론(없으면 생략)",
  "main_claims": [ { "text": "...", "status": "supported|weak|unsupported|human_check|contradicted", "unit_ids": ["..."], "rationale": "이 상태로 판단한 근거(원문 기준)", "evidence_needed": "이 주장을 확정하려면 무엇을 확인해야 하는가(없으면 생략)", "fix_suggestion": "이 문장 자체를 어떻게 보강할지 한 줄(선택, 없으면 생략)" } ],
  "evidence_items": [ { "text": "...", "unit_ids": ["..."], "kind": "internal|external_cited|asserted" } ],
  "assumptions": [ { "text": "말하지 않은 가정", "unit_ids": ["..."], "if_false": "틀리면 무너지는 것" } ],
  "tradeoffs": [ { "text": "...", "unit_ids": ["..."] } ],
  "stakeholders": [ { "role": "...", "likely_objection": "...", "unit_ids": ["..."] } ],
  "open_questions": [ { "text": "...", "unit_ids": ["..."] } ],
  "decision_points": [ { "text": "...", "human_only": true, "unit_ids": ["..."] } ],
  "missing_sections": [ { "label": "...", "why_it_matters": "..." } ]
}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// 2. Lens Review: one lens → findings only
// ---------------------------------------------------------------------------

export function buildLensPrompt(
  lens: JudgmentLens,
  mapSummary: string,
  units: ArtifactUnit[],
  unitLimit: number,
): { system: string; user: string } {
  const system = `${SPINE}

너는 "${lens.label}" 렌즈다. 목적: ${lens.purpose}
이 렌즈의 검토 질문:
${lens.review_questions.map((q) => `- ${q}`).join('\n')}

금지된 출력(이런 문장을 내면 실패로 간주한다):
${lens.failure_modes.map((f) => `- "${f}"`).join('\n')}

너의 렌즈에 해당하는 finding만 낸다. 전체 결론이나 다른 렌즈의 영역은 건드리지 않는다.
finding이 없으면 빈 배열을 낸다(억지로 만들지 않는다).`;

  const user = `문서 판단 지도 요약:
${mapSummary}

원문 단위:
${renderUnits(units, unitLimit)}

다음 JSON을 출력하라:
{
  "findings": [
    {
      "title": "특정 claim에 걸린 짧은 제목 (예: slide 4 시장규모 주장에 근거 없음)",
      "detail": "무엇이 문제인지 원문 기준으로",
      "severity": "minor|caution|critical",
      "confidence": "low|medium|high",
      "suggested_action": "무엇을 확인/보완할지 구체적으로 (일반론 금지)",
      "unit_ids": ["관련 unit_id (필수, 하나 이상)"]
    }
  ]
}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// 3. Synthesis: lens findings + map → receipt-level fields
// ---------------------------------------------------------------------------

export function buildSynthesisPrompt(
  mapSummary: string,
  findingsSummary: string,
  ctx: UserReviewContext,
  today: string,
): { system: string; user: string } {
  const system = `${SPINE}

이번 단계는 "종합"이다. 렌즈 결과를 Judgment Receipt 필드로 압축한다.
- current_heading은 중립적 방향 한 줄이다. "진행하세요" 같은 평결이 아니다.
- judgment_obligations는 사람이 직접 판단해야 하는 항목이다. AI가 대신 결론내지 않는다.
- 사용자가 결론을 냈다고 말하지 않는다.
- follow-up predicate는 나중에 현실이 pass/fail로 답할 수 있어야 한다. check_by는 ${today} 이후의 미래 날짜(YYYY-MM-DD)로 제안한다.`;

  const worry = ctx.biggest_worry ? `사용자가 가장 불안해한 부분: ${ctx.biggest_worry}` : '';

  const user = `문서 판단 지도 요약:
${mapSummary}

렌즈 finding 요약:
${findingsSummary}
${worry}

다음 JSON을 출력하라:
{
  "core_question": "한 문장으로 다듬은 핵심 판단 질문",
  "current_heading": "지금 이 문서의 중립적 방향 한 줄 (평결 아님)",
  "judgment_obligations": [
    {
      "statement": "사람이 책임지고 판단해야 할 항목",
      "owner": "사용자",
      "why_human": "왜 모델/근거로 대체할 수 없는가",
      "decision_needed_by": "언제까지 (없으면 생략)",
      "evidence_needed": "무엇을 보면 판단할 수 있는가",
      "unit_ids": ["..."]
    }
  ],
  "followups": [
    { "predicate": "현실이 답할 예측", "pass_condition": "맞았다고 볼 조건", "fail_condition": "틀렸다고 볼 조건", "check_by": "YYYY-MM-DD" }
  ]
}`;

  return { system, user };
}
