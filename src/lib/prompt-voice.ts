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
- ✓ "시장 분석은 좋은데, 예산 부분이 좀 약해요. 작년 실적 넣으면 바로 될 것 같아요"`;
