/**
 * settle-align — the single-shot outcome-alignment agent (Problem 3 / 닿기).
 *
 * Settlement used to be a cold manual tap-fest: the user re-reads 1–6 predictions
 * they sealed weeks ago and grades each from memory. This adds ONE optional,
 * single-shot agent: the user writes a paragraph of what actually happened, and
 * the model READS that account against each sealed prediction and proposes a
 * draft verdict + a one-line grounding lifted from the user's own words.
 *
 * Spine (CLAUDE.md zero-judgment):
 *  - It is a READING aid, never a judge. The system prompt forbids evaluation,
 *    advice, scores, tiers, "should have", or any claim about who the user is.
 *  - It is SINGLE-SHOT (one call), not a chat — verification is a commitment met
 *    by reality, never a debate (CLAUDE.md §3).
 *  - The draft is NON-BINDING: the modal pre-highlights it and the USER commits,
 *    overrides, or accepts. A draft-accepted verdict is tagged `verdict_via:
 *    'ai_draft'` downstream so it never inflates the self-verified track record.
 *  - 'unclear' (the note doesn't address a prediction) yields NO draft — we never
 *    guess. Empty-evidence items are dropped — no unattributed draft.
 *
 * All user text is wrapped in <user-data> + sanitizeForPrompt (CLAUDE.md prompt
 * injection rule). Pure-ish: lets LLMError throw to the caller (the modal shows a
 * fallback + the manual taps still work).
 */

import { callLLMJson } from '@/lib/llm';
import { sanitizeForPrompt } from '@/lib/persona-prompt';
import type { Predicate } from '@/stores/types';

/** The verdicts the alignment can propose (never 'unknown' / 'pending'). */
export type DraftVerdict = 'happened' | 'avoided' | 'partial';

export interface OutcomeDraft {
  verdict: DraftVerdict;
  /** One line lifted from the user's own account — the grounding for the draft. */
  evidence: string;
}

interface AlignItem {
  id: string;
  occurred: 'yes' | 'no' | 'partial' | 'unclear';
  evidence: string;
}
interface AlignResponse {
  items: AlignItem[];
}

/** Map the model's factual reading onto a predicate verdict. 'unclear' → no draft. */
const OCCURRED_TO_VERDICT: Record<AlignItem['occurred'], DraftVerdict | null> = {
  yes: 'happened',
  no: 'avoided',
  partial: 'partial',
  unclear: null,
};

const SYSTEM_KO = `당신은 결과 정리를 돕는 읽기 도구입니다. 사용자가 과거에 봉인한 예측들과, 방금 적은 '실제로 일어난 일' 기록을 받습니다. 할 일은 단 하나 — 각 예측에 대해, 사용자의 기록이 '그 일이 일어났다'고 말하는지 읽어서 표시하는 것입니다.
규칙:
(1) 판단·평가·조언 금지. 사용자가 잘했는지 못했는지, 어떤 사람인지 절대 말하지 마세요.
(2) 점수·등급·새 질문·'그랬어야 했다' 금지.
(3) 기록이 그 예측을 다루지 않으면 occurred를 'unclear'로 두고 추측하지 마세요.
(4) evidence는 사용자가 적은 문장에서 근거가 된 부분을 1줄로 옮긴 것 — 당신의 해석이 아니라 사용자의 말이어야 합니다.
JSON으로만 응답: {"items":[{"id":"<예측 id>","occurred":"yes|no|partial|unclear","evidence":"사용자 기록에서 근거 1줄"}]}`;

const SYSTEM_EN = `You are a reading aid that helps tidy up an outcome. You receive the predictions a user sealed earlier and a paragraph they just wrote about what actually happened. Your only job: for each prediction, read whether the user's note says that thing occurred.
Rules:
(1) No judgment, evaluation, or advice — never say whether the user did well or badly, or what kind of person they are.
(2) No score, tier, new question, or 'should have'.
(3) If the note doesn't address a prediction, set occurred to 'unclear' and do not guess.
(4) evidence is one line lifted from what the USER wrote — their words, not your interpretation.
Respond with JSON only: {"items":[{"id":"<prediction id>","occurred":"yes|no|partial|unclear","evidence":"one line of grounding from the user's note"}]}`;

/**
 * Read the user's outcome account against their sealed predicates and return a
 * map of predicate id → drafted verdict + grounding. Only the predicates the
 * account actually speaks to get a draft; everything else is omitted (no guess).
 */
export async function alignOutcome(
  predicates: Predicate[],
  account: string,
  locale: 'ko' | 'en',
  signal?: AbortSignal,
): Promise<Record<string, OutcomeDraft>> {
  const valid = (Array.isArray(predicates) ? predicates : []).filter((p) => p && p.id && p.text);
  if (valid.length === 0 || !account.trim()) return {};

  const ids = new Set(valid.map((p) => p.id));
  const riskTag = locale === 'ko' ? '(위험) ' : '(risk) ';
  const list = valid
    .map((p) => `- [${p.id}] ${p.source === 'risk' ? riskTag : ''}${p.text}`)
    .join('\n');

  const user =
    locale === 'ko'
      ? `## 봉인했던 예측들\n${list}\n\n## 실제로 일어난 일 (사용자 기록)\n<user-data>\n${sanitizeForPrompt(account)}\n</user-data>`
      : `## Predictions sealed earlier\n${list}\n\n## What actually happened (the user's note)\n<user-data>\n${sanitizeForPrompt(account)}\n</user-data>`;

  const result = await callLLMJson<AlignResponse>(
    [{ role: 'user', content: user }],
    { system: locale === 'ko' ? SYSTEM_KO : SYSTEM_EN, model: 'fast', maxTokens: 700, signal, shape: { items: 'array' } },
  );

  const out: Record<string, OutcomeDraft> = {};
  for (const it of result.items ?? []) {
    // Drop items for ids we didn't ask about (hallucinated / stale).
    if (!it || typeof it.id !== 'string' || !ids.has(it.id)) continue;
    const verdict = OCCURRED_TO_VERDICT[it.occurred];
    if (!verdict) continue; // 'unclear' / unknown → no draft (never guess)
    const evidence = typeof it.evidence === 'string' ? it.evidence.trim() : '';
    if (!evidence) continue; // no grounding line → no unattributed draft
    out[it.id] = { verdict, evidence };
  }
  return out;
}
