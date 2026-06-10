/**
 * Decision-moment detection + seal drafting (the two LLM calls of argus-watch).
 * The detection definition lives in prompts/detector.md — single source of truth.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callClaudeJson } from './llm.mjs';
import { localToday } from './ledger.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DETECTOR_DOC = fs.readFileSync(path.join(here, '..', 'prompts', 'detector.md'), 'utf8');

const VALID_TYPES = new Set(['direction', 'scope', 'kill', 'adopt', 'defer', 'constraint', 'approval']);
const VALID_STAKES = new Set(['high', 'medium', 'low']);

/** Run the shippable single-pass detector on one digest segment. */
export async function detectDecisions(segmentText, { model = 'sonnet' } = {}) {
  const prompt = `너는 결정 수확기다. 아래 작업 대화에서 인간 사용자가 내린 결정의 순간만 골라낸다.

${DETECTOR_DOC}

<user-data>
${segmentText}
</user-data>

JSON만 출력하라 (설명 금지): {"decisions": [{"quote": "...", "decision": "...", "type": "...", "stakes": "..."}]}
결정이 없으면 {"decisions": []}.`;

  const out = await callClaudeJson(prompt, { model });
  const arr = Array.isArray(out) ? out : out.decisions;
  if (!Array.isArray(arr)) throw new Error('detector returned no decisions array');
  return arr.filter(d =>
    d && typeof d.quote === 'string' && typeof d.decision === 'string'
    && VALID_TYPES.has(d.type) && VALID_STAKES.has(d.stakes)
  );
}

/** Draft a falsifiable bet for a harvested decision. */
export async function draftSeal(decision, contextText, { model = 'sonnet', today = localToday() } = {}) {
  const prompt = `사용자가 작업 중 이런 결정을 내렸다:

결정: ${decision.decision}
원문: "${decision.quote}"
종류: ${decision.type} / 무게: ${decision.stakes}

${contextText ? `당시 대화 맥락 일부:\n<user-data>\n${contextText.slice(0, 3000)}\n</user-data>\n` : ''}
이 결정에 대한 **반증 가능한 내기 1개**를 초안하라. 규칙:
- predicate: 이 결정이 옳다면 참이 될, 관측 가능한 한 문장 (한국어, 사용자 1인칭 시점)
- falsified_if: 이 결정이 틀렸음을 보여줄 구체적 신호 한 문장 — 막연한 "잘 안 되면" 금지
- check_by: 그 신호가 보일 만큼의 현실적 기한 (오늘 = ${today}, ISO 날짜). 기능 단위면 1~3주, 방향 전환이면 3~6주.
- 판정·점수·조언 어휘 금지. 이것은 예측이지 평가가 아니다.

JSON만 출력: {"predicate": "...", "falsified_if": "...", "check_by": "YYYY-MM-DD"}`;

  const out = await callClaudeJson(prompt, { model });
  if (!out.predicate || !out.falsified_if || !/^\d{4}-\d{2}-\d{2}$/.test(out.check_by || '')) {
    throw new Error('seal draft incomplete');
  }
  return out;
}
