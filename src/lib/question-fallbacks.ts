/**
 * Safe fallback question pool (DESIGN-clarify-question-system-v2 §6.5, Phase 0).
 *
 * When typed-question generation fails or the LLM omits next_question.text, the
 * engine must still hand the user a question — but the old fallback was the
 * single worst line in the system: `'이 결과물을 누가 최종 판단해?'` /
 * `'Who will make the final decision on this?'` — banned-question #1 (admin-only,
 * everyone knows it's the CEO). This pool replaces it with neutral crux
 * questions that are safe in ANY context: they name no direction, carry no lean,
 * and every one passes the banned-pattern rules (pinned by the Phase-0 test).
 *
 * Highest leverage / lowest risk change in the redesign: one wire, and the
 * quality floor of every failed generation rises.
 */

import type { Locale } from '@/lib/i18n';

/** Neutral crux questions — safe under any request. Each must pass
 *  matchBannedPattern() (question-rules.ts); the Phase-0 test enforces that. */
export const SAFE_FALLBACK_QUESTIONS: Record<Locale, readonly string[]> = {
  ko: [
    '이 판단이 틀렸다고 드러난다면, 가장 먼저 어디에서 신호가 나타날까요?',
    '지금 더 불확실한 건 상대의 반응인가요, 우리의 실행력인가요, 아니면 판단이 기대고 있는 전제 자체인가요?',
    '이 결정의 결과를 가장 크게 바꿀 수 있는 조건 하나를 꼽는다면 무엇인가요?',
  ],
  en: [
    'If this judgment turns out wrong, where would the first signal show up?',
    "Right now, what's more uncertain — the other side's reaction, your own execution, or the premise the judgment rests on?",
    'What single condition could change the outcome of this decision the most?',
  ],
};

/**
 * Pick a safe fallback question deterministically. A `seed` (e.g. the reframed
 * question or problem text) spreads the choice across the pool without
 * Math.random, so the same session is stable but different sessions vary. No
 * seed → the first (most broadly safe) question.
 */
export function pickSafeFallbackQuestion(locale: Locale, seed?: string): string {
  const pool = SAFE_FALLBACK_QUESTIONS[locale] ?? SAFE_FALLBACK_QUESTIONS.en;
  if (!seed) return pool[0];
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
