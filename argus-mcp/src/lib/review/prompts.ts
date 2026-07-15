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
 *   - output in the document's language, pure JSON.
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
- 지적의 "유형"을 다양하게 본다. "근거가 부족하다"만 반복하지 말고, 해당되면 더 날카로운 유형을 짚는다:
  · 섹션 간 모순(A절은 X라는데 B절은 반대로 기술)  · 미충족 선결조건(전제가 아직 안 됐는데 그 위에서 결론)
  · 비현실적/검증 안 된 가정  · 의존관계 역전(선행 과제가 후행보다 늦게 배치)  · 숫자·근거 불일치
  · 이해관계자 반론(승인·예산을 쥔 사람이 먼저 걸 지점). 같은 문서의 findings 제목이 서로 붙여넣기처럼 보이면 실패다.
- 짧고 날카롭게. title은 한 줄(대략 40자 이내), detail은 2문장 이내. 장황한 서술 금지.
- 출력은 순수 JSON. 마크다운/설명 없이 { 로 시작해 } 로 끝난다.
- 모든 사용자 노출 값은 원문과 사용자 맥락의 주된 언어로 쓴다. 한국어 문서는 한국어로, 영어 문서는 영어로 쓴다. 서로 섞지 않는다.`;

export function renderUnits(units: ArtifactUnit[], limit: number): string {
  return units
    .slice(0, limit)
    .map((u) => {
      const a = u.source_anchor;
      const loc =
        a.slide !== undefined
          ? `slide ${a.slide}`
          : a.page !== undefined
            ? a.section_path?.length
              ? `${a.page}쪽 · ${a.section_path.join(' › ')}`
              : `${a.page}쪽`
            : a.section_path?.length
              ? a.section_path.join(' › ')
              : a.line_start !== undefined
                ? `L${a.line_start}`
                : '';
      return `[${u.unit_id}] (${u.kind}${loc ? ' · ' + loc : ''}) ${u.text}`;
    })
    .join('\n');
}

/**
 * A compact, ordered outline of the WHOLE document — its headings and slide
 * titles with their location — so a single map-reduce chunk can see where it
 * sits and flag a genuine conflict with a section it does not itself contain
 * (the "the section-2 claim contradicts the section-8 conclusion" case a chunked
 * review otherwise misses, because each chunk is judged in isolation). This is
 * context only: a chunk may still cite ONLY its own units. Returns '' when the
 * document has no headings/slide titles to outline (flat prose).
 */
export function buildDocumentOutline(units: ArtifactUnit[], maxChars = 1500): string {
  const lines: string[] = [];
  for (const u of units) {
    if (u.kind !== 'heading' && u.kind !== 'slide_title') continue;
    const a = u.source_anchor;
    const loc =
      a.slide !== undefined ? `slide ${a.slide}`
      : a.page !== undefined ? `${a.page}쪽`
      : a.section_path?.length ? a.section_path.join(' › ')
      : a.line_start !== undefined ? `L${a.line_start}`
      : '';
    const text = u.text.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!text) continue;
    lines.push(`- ${loc ? `[${loc}] ` : ''}${text}`);
    if (lines.join('\n').length > maxChars) { lines.push('- …'); break; }
  }
  return lines.join('\n');
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
각 항목은 반드시 관련 unit_id 배열을 포함한다.
논지들 사이의 의존 구조도 표시한다: main_claims에 나온 순서가 곧 번호다(첫 번째=C1, 두 번째=C2 …).
어떤 논거가 특정 논지를 뒷받침하면 그 논거의 supports_claim_ids에 논지 번호(예: "C1")를 넣고,
어떤 논지가 다른 논지가 참이어야 성립하면 그 논지의 depends_on_claim_ids에 기대는 논지 번호를 넣는다.
확실하지 않으면 링크를 억지로 만들지 말고 생략한다(빈 배열).`;

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
  "main_claims": [ { "text": "...", "status": "supported|weak|unsupported|human_check|contradicted", "unit_ids": ["..."], "rationale": "이 상태로 판단한 근거(원문 기준)", "evidence_needed": "이 주장을 확정하려면 무엇을 확인해야 하는가(없으면 생략)", "fix_suggestion": "이 문장 자체를 어떻게 보강할지 한 줄(선택, 없으면 생략)", "depends_on_claim_ids": ["이 논지가 성립하려면 참이어야 하는 다른 논지 번호, 예: C2 (없으면 빈 배열)"] } ],
  "evidence_items": [ { "text": "...", "unit_ids": ["..."], "kind": "internal|external_cited|asserted", "supports_claim_ids": ["이 논거가 뒷받침하는 논지 번호, 예: C1 (없으면 빈 배열)"] } ],
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
// Quick Review: one bounded call for short documents
// ---------------------------------------------------------------------------

export function buildQuickReviewPrompt(
  units: ArtifactUnit[],
  ctx: UserReviewContext,
  unitLimit: number,
  today: string,
): { system: string; user: string } {
  const context = [
    ctx.audience_hint && `Audience hint: ${ctx.audience_hint}`,
    ctx.decision_wanted && `Decision wanted: ${ctx.decision_wanted}`,
    ctx.biggest_worry && `Biggest worry: ${ctx.biggest_worry}`,
    ctx.concerns?.length && `Requested concerns: ${ctx.concerns.join(', ')}`,
  ].filter(Boolean).join('\n');

  const system = `${SPINE}

This is the bounded quick-review path for a short document. Produce the
judgment map and receipt fields in one pass. Apply the complete five-part
judgment spine: core_question, claim_evidence, hidden_assumption,
human_judgment, falsifiable_followup.

Keep the result selective and concise:
- Write every user-facing value in the document's primary language. Use Korean
  for a Korean document and English for an English document. Do not mix them.
- When the document contains unsupported causal claims, untested assumptions,
  or a human-only decision, return 2 to 5 material findings. Return zero only
  when there is genuinely no material issue. Do not manufacture one per lens.
- Every finding and obligation must cite at least one supplied unit_id.
- Copy one exact snake_case lens_id from the five values listed above into every
  finding. Never translate, combine, or omit lens_id.
- Separate claims, evidence, and assumptions. Do not treat repetition as proof.
- current_heading describes the document's present direction without deciding
  for the user.
- A judgment obligation is a DECISION the human must make, NOT a restatement of
  a finding. Never repeat a finding as an obligation. Keep obligations distinct
  from each other and from the findings.
- Vary the finding TYPE — contradiction between sections, an unmet precondition,
  an unrealistic assumption, a reversed dependency, a number that doesn't add up,
  a stakeholder objection. Do not label every claim "evidence insufficient".
- Return at most 3 judgment obligations and 3 falsifiable followups.
- followup check_by must be a real date after ${today}.
- Complete every JSON field below; use empty arrays instead of filler.`;

  const user = `Document units:
${renderUnits(units, unitLimit)}

${context}

Return this JSON shape. The FIRST product fields — findings, judgment_obligations,
followups — are what the user reads: fill them completely and specifically before
the map fields below them. The trailing map fields (evidence_items, tradeoffs,
stakeholders, open_questions, missing_sections) are secondary scaffolding — keep
them brief so they never crowd out the product fields.
{
  "profile": { "document_type": "...", "intent": "...", "audience": "...", "stakes": "low|medium|high", "artifact_maturity": "...", "source_confidence": 0.0 },
  "core_question": "the actual decision question",
  "explicit_recommendation": "stated recommendation or empty",
  "implicit_recommendation": "implied recommendation or empty",
  "findings": [ { "lens_id": "core_question|claim_evidence|hidden_assumption|human_judgment|falsifiable_followup", "title": "...", "detail": "...", "severity": "minor|caution|critical", "confidence": "low|medium|high", "suggested_action": "a concrete check", "unit_ids": ["..."] } ],
  "judgment_obligations": [ { "statement": "...", "owner": "...", "why_human": "...", "decision_needed_by": "...", "evidence_needed": "...", "unit_ids": ["..."] } ],
  "followups": [ { "predicate": "...", "pass_condition": "...", "fail_condition": "...", "check_by": "YYYY-MM-DD" } ],
  "current_heading": "neutral summary of the document's current direction",
  "main_claims": [ { "text": "...", "status": "supported|weak|unsupported|human_check|contradicted", "unit_ids": ["..."], "rationale": "...", "evidence_needed": "...", "fix_suggestion": "...", "depends_on_claim_ids": ["C1"] } ],
  "assumptions": [ { "text": "...", "unit_ids": ["..."], "if_false": "..." } ],
  "decision_points": [ { "text": "...", "human_only": true, "unit_ids": ["..."] } ],
  "evidence_items": [ { "text": "...", "unit_ids": ["..."], "kind": "internal|external_cited|asserted", "supports_claim_ids": ["C1"] } ],
  "tradeoffs": [ { "text": "...", "unit_ids": ["..."] } ],
  "stakeholders": [ { "role": "...", "likely_objection": "...", "unit_ids": ["..."] } ],
  "open_questions": [ { "text": "...", "unit_ids": ["..."] } ],
  "missing_sections": [ { "label": "...", "why_it_matters": "..." } ]
}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Vision review: a single multimodal pass. The model SEES the document (a PDF
// rendered to pages, or a deck's embedded images) alongside the extracted text,
// so it can catch what the text extractor drops — a chart that contradicts the
// prose, a number living inside an image, a layout that changes the meaning.
// Anchors are PAGE/SLIDE numbers (the model sees pages, not our unit ids).
// ---------------------------------------------------------------------------

export function buildVisionReviewPrompt(
  units: ArtifactUnit[],
  ctx: UserReviewContext,
  unitLimit: number,
  today: string,
  isDeck: boolean,
): { system: string; user: string } {
  const context = [
    ctx.audience_hint && `Audience hint: ${ctx.audience_hint}`,
    ctx.decision_wanted && `Decision wanted: ${ctx.decision_wanted}`,
    ctx.biggest_worry && `Biggest worry: ${ctx.biggest_worry}`,
    ctx.concerns?.length && `Requested concerns: ${ctx.concerns.join(', ')}`,
  ].filter(Boolean).join('\n');
  const anchorWord = isDeck ? 'slide' : 'page';

  const system = `${SPINE}

You can SEE the document itself — ${isDeck ? "the deck's images (charts/diagrams) are attached" : 'the PDF pages are attached and rendered'} — in ADDITION to the extracted text below. Use both: read the visuals (charts, tables, figures, numbers inside images, layout) that plain text extraction misses, and cross-check them against the prose. Apply the complete five-part judgment spine: core_question, claim_evidence, hidden_assumption, human_judgment, falsifiable_followup.

Keep the result selective and concise:
- Write every user-facing value in the document's primary language.
- Return 2 to 5 material findings; zero only when genuinely nothing is material. Do not manufacture one per lens.
- Vary the finding TYPE — a contradiction between a chart and the text, a figure that doesn't add up, an unmet precondition, an untested assumption, a reversed dependency, a stakeholder objection. Do not label everything "evidence insufficient".
- Prefer findings that only the VISUAL reveals (a chart trend that contradicts a claim, a number shown only in an image) — that is the point of this pass.
- 짧고 날카롭게. title은 한 줄(대략 40자 이내), detail은 2문장 이내.
- A judgment obligation is a DECISION the human must make, NOT a restatement of a finding. Keep obligations distinct from each other and from the findings.
- Reference locations in prose the human way ("slide 4의 시장규모 차트", "3쪽 표"). In the JSON, cite ${anchorWord} numbers in the "pages" array (e.g. [4] or [4,7]).
- followup check_by must be a real date after ${today}. Return at most 3 obligations and 3 followups.`;

  const user = `Extracted text (for cross-reference — the attached ${isDeck ? 'images' : 'pages'} are the source of truth for anything visual):
${renderUnits(units, unitLimit)}

${context}

Return this JSON shape (findings/obligations/followups first — they are the product; cite ${anchorWord} numbers in "pages"):
{
  "profile": { "document_type": "...", "intent": "...", "audience": "...", "stakes": "low|medium|high", "artifact_maturity": "...", "source_confidence": 0.0 },
  "core_question": "the actual decision question",
  "explicit_recommendation": "stated recommendation or empty",
  "findings": [ { "lens_id": "core_question|claim_evidence|hidden_assumption|human_judgment|falsifiable_followup", "title": "...", "detail": "...", "severity": "minor|caution|critical", "confidence": "low|medium|high", "suggested_action": "a concrete check", "seen_in_visual": true, "pages": [1] } ],
  "judgment_obligations": [ { "statement": "...", "owner": "...", "why_human": "...", "decision_needed_by": "...", "evidence_needed": "...", "pages": [1] } ],
  "followups": [ { "predicate": "...", "pass_condition": "...", "fail_condition": "...", "check_by": "YYYY-MM-DD" } ],
  "current_heading": "neutral summary of the document's current direction",
  "main_claims": [ { "text": "...", "status": "supported|weak|unsupported|human_check|contradicted", "pages": [1], "rationale": "..." } ],
  "assumptions": [ { "text": "...", "pages": [1], "if_false": "..." } ],
  "decision_points": [ { "text": "...", "human_only": true, "pages": [1] } ]
}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Map step: one chunk of a long document → partial judgment map + findings.
// The reduce step (synthesis) merges chunks and de-dups, so a chunk extracts
// ONLY what its own text supports and never restates the whole document.
// ---------------------------------------------------------------------------

export function buildMapPrompt(
  units: ArtifactUnit[],
  ctx: UserReviewContext,
  chunkIndex: number,
  chunkCount: number,
  today: string,
  outline = '',
): { system: string; user: string } {
  const context = [
    ctx.audience_hint && `Audience hint: ${ctx.audience_hint}`,
    ctx.decision_wanted && `Decision wanted: ${ctx.decision_wanted}`,
    ctx.biggest_worry && `Biggest worry: ${ctx.biggest_worry}`,
    ctx.concerns?.length && `Requested concerns: ${ctx.concerns.join(', ')}`,
  ].filter(Boolean).join('\n');

  // Contextual header (Anthropic "Contextual Retrieval" pattern, adapted): a
  // chunk judged in isolation cannot see a section it does not contain, so it
  // misses cross-section conflicts. Give it the whole-document outline as
  // CONTEXT — never as new material to review — so it can flag when its own
  // content genuinely contradicts another section, but still cites only its own units.
  const outlineBlock = outline
    ? `

전체 문서 개요(맥락용 참고 — 이 구간 밖 항목은 그 자체로 지적하지 말 것):
${outline}

이 구간의 내용이 위 개요의 다른 항목과 **명백히 모순**될 때에만 그 관계를 finding으로
낸다(그때도 unit_ids에는 이 구간의 unit_id만 넣는다). 개요 항목 자체를 지적 대상으로 삼지 않는다.`
    : '';

  const system = `${SPINE}

이 문서는 길어서 여러 구간으로 나눠 검수한다. 지금은 ${chunkCount}개 구간 중
${chunkIndex + 1}번째 구간이다. **이 구간의 원문 단위(units)에 실제로 담긴 것만**
지도로 뽑는다 — 다른 구간의 내용이나 문서 전체 요약을 지어내지 않는다.${outlineBlock}

- 이 구간이 뒷받침하는 main_claims / assumptions / decision_points / findings만 낸다.
- 판단 스파인 5개(core_question, claim_evidence, hidden_assumption, human_judgment,
  falsifiable_followup)를 이 구간에 적용한다. finding의 lens_id에 이 다섯 중 하나를
  snake_case 그대로 넣는다(번역·결합·생략 금지).
- 이 구간에 실질 이슈가 있을 때만 finding 0~4개. 없으면 빈 배열. 렌즈마다 억지로 만들지 않는다.
- 모든 claim·assumption·finding은 이 구간의 unit_id를 하나 이상 인용한다.
- core_question은 이 구간에서 읽히는 결정 질문의 최선 추정이다(뒤 구간에서 갱신될 수 있다).
- obligations·followups는 여기서 내지 않는다(전체를 합친 뒤 한 번에 만든다).
- 모든 사용자 노출 값은 원문의 주 언어로 쓴다.`;

  const user = `구간 ${chunkIndex + 1}/${chunkCount}의 원문 단위:
${renderUnits(units, units.length)}

${context}

다음 JSON을 출력하라(이 구간에 없는 항목은 빈 배열):
{
  "profile": { "document_type": "...", "intent": "...", "audience": "...", "stakes": "low|medium|high", "artifact_maturity": "...", "source_confidence": 0.0 },
  "core_question": "이 구간에서 읽히는 결정 질문(최선 추정)",
  "main_claims": [ { "text": "...", "status": "supported|weak|unsupported|human_check|contradicted", "unit_ids": ["..."], "rationale": "...", "evidence_needed": "...", "fix_suggestion": "...", "depends_on_claim_ids": ["C1"] } ],
  "evidence_items": [ { "text": "...", "unit_ids": ["..."], "kind": "internal|external_cited|asserted", "supports_claim_ids": ["C1"] } ],
  "assumptions": [ { "text": "...", "unit_ids": ["..."], "if_false": "..." } ],
  "tradeoffs": [ { "text": "...", "unit_ids": ["..."] } ],
  "stakeholders": [ { "role": "...", "likely_objection": "...", "unit_ids": ["..."] } ],
  "open_questions": [ { "text": "...", "unit_ids": ["..."] } ],
  "decision_points": [ { "text": "...", "human_only": true, "unit_ids": ["..."] } ],
  "missing_sections": [ { "label": "...", "why_it_matters": "..." } ],
  "findings": [ { "lens_id": "core_question|claim_evidence|hidden_assumption|human_judgment|falsifiable_followup", "title": "...", "detail": "...", "severity": "minor|caution|critical", "confidence": "low|medium|high", "suggested_action": "구체적 확인", "unit_ids": ["..."] } ],
  "current_heading": "이 구간의 중립적 방향 한 줄"
}`;

  void today;
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

이 렌즈에 걸리는 **실질 이슈만** 낸다. 없으면 빈 배열 — 렌즈를 채우려고 억지 지적을 만들지 않는다.
다른 finding과 같은 지점·같은 말이 될 것 같으면 내지 않는다(중복 금지). 전체 결론이나 다른 렌즈 영역은 건드리지 않는다.
title은 이 문서에 고유한 한 줄로 쓴다 — "…의 근거가 부족하다" 같은 틀을 반복하지 말고, 무엇이 왜 문제인지 구체적으로.`;

  const user = `문서 판단 지도 요약:
${mapSummary}

원문 단위:
${renderUnits(units, unitLimit)}

다음 JSON을 출력하라:
{
  "findings": [
    {
      "title": "이 문서에 고유한 한 줄 제목 — 무엇이 왜 문제인지 (40자 이내, 근거부족 틀 반복 금지)",
      "detail": "무엇이 문제인지 원문 기준으로, 2문장 이내",
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
- judgment_obligations는 사람이 직접 **결정**해야 하는 갈림길이다. **finding(문서의 결함 지적)의 재진술이 아니다** —
  이미 finding으로 낸 지적을 의무로 다시 쓰지 마라. obligation은 "무엇을 결정할 것인가"이지 "무엇이 근거 부족인가"가 아니다.
- 서로 다른 결정만 남긴다. 의무 2~3개면 충분하고, 겹치는 것은 하나로 합친다.
- 각 항목은 짧게. statement 한 줄, why_human 한 줄.
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
