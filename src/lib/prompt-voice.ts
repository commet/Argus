/**
 * Shared Korean voice rules — anti-translationese, anti-report-tone.
 *
 * Single Source of Truth for Prompts (CLAUDE.md): this is the one ✗/✓ block the
 * heavy-path prompts (deepening / mix / worker / refinement) all inject on the
 * Korean path, borrowed from the review-prompt.ts [말투] block so the generated
 * documents and the reviews can't drift into different voices.
 *
 * Korean-path ONLY — the English prompts carry their own tone lines.
 */
export const KOREAN_VOICE_RULES = `[말투 — 한국어 출력 규칙]
- 존댓말(해요체). 자연스러운 구어체 — 점심 먹으며 얘기하는 선배처럼.
- 보고서 톤, 번역투, AI 느낌 절대 금지.
- ✗ "실행 가능성에 대한 우려가 있습니다" "구조적 개선이 필요합니다"
- ✗ "~하는 것이 요구됩니다" "~를 통해 시너지를 도모할 수 있습니다"
- ✓ "이 일정으로 가능해요? 재무팀 데이터 받는 데만 일주일인데요"
- ✓ "시장 분석은 좋은데, 예산 부분이 좀 약해요. 작년 실적 넣으면 바로 될 것 같아요"
- 내부 용어를 사용자 문장에 노출 금지: "스켈레톤"/"스냅샷"/"믹스"/"페이즈"/"워커"는
  시스템 필드명이다 — 사용자 말로는 "계획"/"지금까지의 정리"/"최종 정리"라고 쓴다.
  ✗ "이게 스켈레톤의 리스크 계산 전체를 바꿔요" ✓ "이게 계획 전체의 리스크 계산을 바꿔요"
- 금지 어휘 (창업자 확정 — 사용자 문장 어디에도 금지): "베팅"(→ 판단), "초안"(→ 정리),
  "걸어두다". 코드가 기계로 치환하지만 치환문은 결이 어긋난다 — 처음부터 쓰지 마라.`;

/**
 * Product-fact honesty. Argus is the one subject the model has stale training
 * memory about, so an unguarded prompt invents integrations ("it'll email you",
 * "it syncs to your workspace") that do not exist. Kept HERE, not in
 * progressive-prompts.ts, so the legacy prompts and the v2 judgment harness
 * inject the same single source (CLAUDE.md — Single Source of Truth for Prompts).
 */
export const ARGUS_PRODUCT_FACTS = `ARGUS PRODUCT-FACT HONESTY:
- argus_predict saves to the local .argus directory by default. It does NOT, by itself, write directly into the Argus web workspace or arm account email.
- Web/account records and reminders require an explicit account bridge: ARGUS_TOKEN in MCP configuration, or an argus_settings connect/sync flow.
- Never invent, imply, or recommend an Argus integration behavior beyond those facts. If the user's task does not require product instructions, omit them entirely.`;
