/**
 * Pure post-generation guards for the heavy path (sim campaign F1/R1/R2/R4/R7).
 *
 * PURE FILE ON PURPOSE (structural-pair lesson: 순수 검증은 순수 파일에) — no
 * store, analytics, or llm imports, so BOTH consumers can share one brain:
 *   - progressive-engine.ts applies these on the product path (re-exported
 *     there, so existing imports/tests keep working);
 *   - scripts/sim/sim-entry.ts applies the same guards in the harness, so the
 *     sim judge measures what the product actually ships, not the raw model
 *     output (batch-3: the harness flagged pre-guard output as product H).
 *
 * Every guard is code enforcement of a rule the prompts already state — each
 * was added only after a sim run measured the prompt being ignored or
 * rephrased around on the shipping tier.
 */

import { formatConcernMessage } from '@/lib/crisis-gate';
import type { Locale } from '@/lib/i18n';

/**
 * F1 (sim, heavy-09): a MODEL-flagged crisis (STEP-0 request_type === 'crisis')
 * that the deterministic regex missed produced an empty-handed answer — zero
 * resources in the whole output. The resource line must be a CODE guarantee,
 * never model discretion. STEP-0 gives no category, so the most general
 * human-line concern (the self_harm copy: "a moment for a person, not a
 * decision tool" + the 24h line) is appended to the insight — UNLESS the
 * model's own text already carries a real hotline number.
 */
export function ensureCrisisResource(insight: string | undefined, locale: Locale): string {
  const resource = formatConcernMessage('self_harm', locale === 'ko' ? 'ko' : 'en');
  const text = (insight || '').trim();
  if (!text) return resource;
  if (/109|988|1366|1[-.\s]?800/.test(text)) return text; // a real line is already named
  return `${text}\n\n${resource}`;
}

/**
 * R1 (sim v2): the VALIDATION conditional reassurance survived the prompt ban
 * by rephrasing ("없다면 진행에 걸림돌은 없지만" → "없다면 걸림돌은 없어요") —
 * the SENTENCE FORM is the violation, so a code post-scan owns it now (mirror
 * of the lean-scan neutralize doctrine: a laundered verdict cannot be prompted
 * away on a weak tier). Drops any sentence of the shape
 * [condition]없다면/된다면 + 걸림돌·문제없음·괜찮음. Never empties the whole
 * insight (the check itself must survive).
 */
export function stripConditionalReassurance(insight: string | undefined): string | undefined {
  if (!insight) return insight;
  const COND = /(없다면|없으면|된다면|이라면|아니라면)[^.!?…\n]*(걸림돌|문제(는|가|도)?\s*(없|아니)|괜찮|지장(은|이)?\s*없|무리(는|가)?\s*없|진행해도\s*돼)/;
  const sentences = insight.split(/(?<=[.!?…])\s+/);
  const kept = sentences.filter((s) => !COND.test(s));
  const out = kept.join(' ').trim();
  return out || insight;
}

/**
 * R4 (sim v2): "framing_confidence<70 → skeleton ≤2" existed only as prose and
 * the model ignored it (light-06: confidence 45, skeleton 5). Purely
 * subtractive code enforcement, applyRouteContract-style: only a REPORTED low
 * confidence truncates — an absent report never shrinks a legitimate plan.
 */
export function truncateLowConfidenceSkeleton(
  skeleton: string[] | undefined,
  reportedConfidence: number | null | undefined,
): string[] {
  const sk = Array.isArray(skeleton) ? skeleton : [];
  if (reportedConfidence != null && reportedConfidence < 70 && sk.length > 2) return sk.slice(0, 2);
  return sk;
}

/**
 * R2 (sim batch-3): the ESCALATION ARRIVAL minimal-structure rule went into the
 * prompt and the very next run still shipped a 5-step plan + full assumption
 * list on first contact. Enforce the caps by code: when the problem text
 * carries the light path's hand-up marker (written by composeDeepenText — a
 * first-party wire, not user data), skeleton ≤2 and assumptions ≤1. Purely
 * subtractive; depth is earned in later rounds.
 */
const ESCALATION_MARKER = /'더 깊이 보기'를 직접 선택|chose to open this question up/;
export function capEscalationArrival<T extends { skeleton?: string[]; hidden_assumptions?: string[] }>(
  result: T,
  problemText: string,
): T {
  if (!ESCALATION_MARKER.test(problemText || '')) return result;
  return {
    ...result,
    skeleton: (result.skeleton || []).slice(0, 2),
    hidden_assumptions: (result.hidden_assumptions || []).slice(0, 1),
  };
}

/**
 * R7 (sim v2): banned vocabulary leaked through heavy prose ("베팅" in an
 * insight, "초안" in a skeleton) — the light path has a vocabulary guard, the
 * heavy path had none. Mechanical token swaps that stay natural in Korean
 * prose; the prompt (KOREAN_VOICE_RULES) bans them at the source and this is
 * the structural floor.
 */
const HEAVY_VOCAB_SWAPS: Array<[RegExp, string]> = [
  [/베팅/g, '판단'],
  // '밑그림' was a rejected vocabulary candidate — the ratified scheme is the
  // 정리 axis (founder ruling 2026-07-31), so model-emitted 초안 becomes 정리.
  [/초안/g, '정리'],
];
export function scrubBannedVocabulary(text: string): string {
  let out = text || '';
  for (const [re, sub] of HEAVY_VOCAB_SWAPS) out = out.replace(re, sub);
  return out;
}
export function scrubList(items: string[] | undefined): string[] {
  return (items || []).map((s) => scrubBannedVocabulary(s));
}
