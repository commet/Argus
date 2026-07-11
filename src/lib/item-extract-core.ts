/**
 * Item-extraction brain — the single source of truth for the prompt that
 * decomposes a decision into typed items (premise / phenomenon / open_question).
 *
 * Like reframe-core.ts, this lib is dependency-light and holds the PROMPT ONLY so
 * both faces share one brain and cannot drift (CLAUDE.md → Single Source of Truth
 * for Prompts): the webapp and the plugin's clarify skill both build on this. The
 * actual LLM call is the caller's job (mirrors reframe-core).
 *
 * Copy rule (DESIGN §2): literal, direct language — no metaphorical verbs. The
 * prompt itself instructs the model to keep item text plain and factual.
 *
 * Design: internal design notes
 */

import { createItem, type DecisionItem, type ItemType } from './decision-items';

/** The raw shape the model returns (before normalization to DecisionItem). */
export interface ExtractedItem {
  type: 'premise' | 'phenomenon' | 'open_question';
  text: string;
  external?: boolean; // premise/phenomenon: can reality later verify this fact?
  load_bearing?: boolean; // is the decision especially dependent on this?
}

export interface ItemExtractResult {
  items: ExtractedItem[];
}

const EXTRACT_TYPES: ReadonlyArray<ExtractedItem['type']> = ['premise', 'phenomenon', 'open_question'];

export const ITEM_EXTRACT_PROMPT_KO = `당신은 의사결정을 돕는 사고 파트너입니다. 주어진 결정을, 나중에 각각 추적할 수 있도록 세 종류의 항목으로 분해하세요.

[세 종류]
1. premise(전제): 이 결정이 성립하려면 참이어야 하는 사실이나 믿음.
2. phenomenon(현상): 결정 시점에 이미 관찰된 사실.
3. open_question(미결): 지금 정하지 못했고 나중에 다시 볼 문제.

[각 항목에 표시]
- external(bool): 이 항목이 나중에 현실로 확인 가능한 사실인가? (예: 금리·공급·가격 → true / 개인의 선호·가치판단 → false). premise·phenomenon에만 의미 있음.
- load_bearing(bool): 이 결정이 특히 이 항목에 크게 의존하는가? 결정당 1~2개만 true.

[문장 규칙 — 매우 중요]
- 비유·수사 금지. 직설적이고 사실 그대로 한 문장. 한 번 더 해석하게 만들지 마세요.
- 나쁜 예: "이 결정이 딛고 선 땅". 좋은 예: "금리가 올해 동결된다".
- 과잉 해석 금지. 사용자가 말하지 않은 전제를 지어내지 말고, 말한 것에서 논리적으로 필요한 것만.

[개수]
- premise 2~4개(서로 다른 측면에서), phenomenon 0~3개, open_question 0~2개.

아래 JSON만 응답하세요:
{ "items": [ { "type": "premise|phenomenon|open_question", "text": "...", "external": true, "load_bearing": false } ] }`;

export const ITEM_EXTRACT_PROMPT_EN = `You are a thinking partner for decisions. Break the given decision into three kinds of items so each can be tracked separately later.

[Three kinds]
1. premise: a fact or belief that must be true for this decision to hold.
2. phenomenon: a fact already observed at decision time.
3. open_question: something not decided now, to revisit later.

[Mark each item]
- external (bool): can this be verified against reality later? (e.g. interest rates, supply, price → true / a personal preference or value judgment → false). Meaningful for premise/phenomenon only.
- load_bearing (bool): does the decision depend especially heavily on this? Only 1-2 per decision should be true.

[Sentence rule — very important]
- No metaphor or rhetoric. One plain, literal, factual sentence. Do not make the reader interpret twice.
- Bad: "the ground this decision stands on". Good: "interest rates stay flat this year".
- No over-interpretation. Do not invent premises the user did not state; extract only what their decision logically requires.

[Counts]
- 2-4 premises (from different angles), 0-3 phenomena, 0-2 open_questions.

Respond with JSON only:
{ "items": [ { "type": "premise|phenomenon|open_question", "text": "...", "external": true, "load_bearing": false } ] }`;

export function itemExtractPrompt(locale: string): string {
  return locale?.startsWith('ko') ? ITEM_EXTRACT_PROMPT_KO : ITEM_EXTRACT_PROMPT_EN;
}

/**
 * Normalize a model's raw extraction into DecisionItems. Pure; `now` injected.
 * Defensive: skips malformed rows, unknown types, and empty text; dedupes by
 * stable id; caps counts so one over-eager extraction can't flood the decision.
 * All items are `source: 'ai'` with `ai_original` preserved for the override signal.
 */
export function toDecisionItems(
  raw: unknown,
  decisionId: string,
  now: number,
): DecisionItem[] {
  const rows: ExtractedItem[] = Array.isArray((raw as ItemExtractResult)?.items)
    ? (raw as ItemExtractResult).items
    : [];
  const byId = new Map<string, DecisionItem>();
  const counts: Record<string, number> = { premise: 0, phenomenon: 0, open_question: 0 };
  const caps: Record<string, number> = { premise: 4, phenomenon: 3, open_question: 2 };

  for (const row of rows) {
    if (!row || typeof row.text !== 'string') continue;
    const text = row.text.trim();
    if (!text) continue;
    const type = row.type;
    if (!EXTRACT_TYPES.includes(type)) continue;
    if (counts[type] >= caps[type]) continue;

    const external = type === 'open_question' ? false : row.external === true;
    const load_bearing = row.load_bearing === true;
    const item = createItem(
      { decision_id: decisionId, type: type as ItemType, text, source: 'ai', external, load_bearing, ai_original: text },
      now,
    );
    if (byId.has(item.id)) continue;
    byId.set(item.id, item);
    counts[type]++;
  }
  return [...byId.values()];
}
