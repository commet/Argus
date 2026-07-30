/**
 * Light path (가벼운 길) — the conversational route for everyday decisions.
 *
 * Three beats, fixed rhythm, variable depth:
 *   비추기 (mirror in the user's own words, name gaps honestly)
 *   → 묻기 (ONE question at a time, max 2 total, free text only, NO tap options)
 *   → 남기기 (offer ONE falsifiable line + a check date; declining is also completion).
 *
 * Structural invariants (code-enforced, not prompt-hoped):
 *   - The deterministic crisis gate (classifyCrisis) runs BEFORE every LLM call —
 *     on the opening text and on every subsequent answer. On fire the light flow
 *     stops and the existing crisis surface owns it (never the light prompt).
 *   - Max 2 questions per session is a HARD code clamp (coerceLightTurn), not a
 *     prompt request. After 2, the turn is forced to offer or a plain close.
 *   - The engine schema has NO options field (the anti-술 invariant): the model
 *     cannot hand the user tap choices, and a stray `options` array in its JSON
 *     is dropped by coercion. Answers are always the user's own words.
 *   - Honest gap over fabrication: a turn that claims "offer" without a sentence
 *     degrades to a plain close — we never invent the leave-behind line.
 *   - When unsure → heavy. NOTE: this is deliberately the REVERSE of the ambient
 *     under-fire default — here the user explicitly asked, and under-treating a
 *     heavy decision is worse than ceremony on a light one.
 *
 * The seal (기억해 둘게요) reuses the EXISTING decision-contract machinery: the
 * record lands on project.decision_contract (projects table) with check_in_at,
 * so it enters the same return loop every surface reads (useDueCount, /project
 * due strip, checkin-due cron emails). No new storage keys, tables, or fields.
 */

import { callLLMJson } from '@/lib/llm';
import { track } from '@/lib/analytics';
import { classifyCrisis, type CrisisSignal } from '@/lib/crisis-gate';
import { sanitizeForPrompt } from '@/lib/persona-prompt';
import type { Locale } from '@/lib/i18n';
import {
  buildEarlyContract,
  webAiAttribution,
  webUserAttribution,
  adoptionLineageForSeal,
} from '@/lib/decision-contract';
import type { DecisionContract } from '@/stores/types';

/** Kill switch — set to false to route every submission to the heavy flow. */
export const LIGHT_PATH_ENABLED = true;

export const LIGHT_MAX_QUESTIONS = 2;
export const LIGHT_DAYS_MIN = 1;
export const LIGHT_DAYS_MAX = 14;
/** Attribution source_ref stamped on light-path seals. */
export const LIGHT_SEAL_SOURCE_REF = 'workspace:light_path_seal';

// ─── Types ───

export interface LightQA {
  question: string;
  answer: string;
}

export type LightWhen = 'tonight' | 'tomorrow_morning' | 'this_weekend' | 'in_days';

export interface LightOffer {
  /** The falsifiable line (rule 7). An INTERNAL record for the seal + receipt —
   *  never shown inside the permission ask itself. */
  sentence: string;
  when: LightWhen;
  days?: number;
  /** The permission-to-return ask — ONE flowing sentence continuing the mirror
   *  ("그럼 {오늘의 정리}하는 걸로 하고 — {확인 시점}에 {확인할 것}, 제가 한 번만
   *  물어볼까요?"). No bracketed 「quote」, no betting vocabulary. Optional: when
   *  the model omits it the UI composes a mechanical fallback from the when
   *  label (known slots only — never invented content). */
  ask?: string;
}

export interface LightGateResult {
  need: 'light' | 'heavy';
  /** Present only when need==='light' — the SAME call already produced the first beat. */
  mirror?: string;
  question?: string;
}

/** 'close' is a code-side outcome (clamp/degenerate output), never requested from the LLM. */
export type LightAction = 'ask' | 'offer' | 'escalate' | 'close';

export interface LightTurn {
  mirror: string;
  action: LightAction;
  question?: string;
  offer?: LightOffer;
  escalate?: { bigger_question: string };
  /** Deterministic pre-empt — set by classifyCrisis in code, NEVER by the LLM.
   *  When present the caller must stop the light flow and route to the existing
   *  crisis surface. */
  crisis?: CrisisSignal;
}

// ─── System prompt (approved verbatim — do not rephrase) ───

const LIGHT_RULES_KO = `당신은 Argus — 판단을 비추는 거울입니다. 사용자가 일상의 결정을 한 줄 던졌습니다.

절대 규칙:
1. 닻: 사용자의 상황이라고 말할 수 있는 것은 사용자가 실제로 쓴 것뿐입니다. 안 한 말을 상황으로 만들지 마세요 (예: '파티'에서 '술'을 연상해 언급하는 것 금지). 모르는 것은 모른다고 말하거나 질문하세요.
   시제·진행 상태도 쓴 그대로만 — 반대 상태나 안 쓴 상태를 단정하지 마세요. 모호하면 모른다고 하세요.
   ✗ (상태를 안 밝혔는데) "아직 파티가 끝나지 않은 거네요" ✓ "지금이 파티 중인지 끝난 뒤인지는 안 쓰셨고요"
2. 판정 금지: 어느 쪽이 낫다고 말하지 않습니다. 결정을 가르는 변수 하나를 이름 붙여 돌려줄 뿐입니다.
3. 질문은 한 번에 하나, 전체 최대 2개. 답이 당신의 다음 말을 실제로 바꿀 질문만. 안 바꿀 거면 묻지 말고 남기기로 가세요.
4. 보기(선택지)를 만들지 않습니다. 답은 사용자가 자기 말로 씁니다.
5. 말투: 다정한 해요체, 친구처럼 짧게. 보고서 톤·번역체 금지.
   ✗ "컨디션 관리 차원의 접근이 필요해요" ✓ "내일 피곤만 아니면 되는 거네요"
   ✗ "~에 대한 우려가 있으시군요" ✓ "그게 걸리시는 거군요"
   빈칸을 이름 붙일 때도 다정하게, 퉁명스럽지 않게:
   ✗ "왜 망설여지시는지는 모르겠어요" ✓ "어느 쪽 이유인지는 아직 얘기 안 하셨고요"
6. 놀라울 필요 없습니다. 정확하면 됩니다. 연구·통계·숫자를 지어내지 마세요.
7. 남기기 문장은 나중에 현실이 참/거짓을 답할 수 있는 한 문장, 사용자의 말을 재료로 만듭니다. 일상 결정의 확인 시점 기본값은 내일 아침입니다.
   반드시 평서문으로 — 의문형("~는지", "~는가", "~을까") 금지, 조건 분기("되면 A, 안 되면 B") 금지. 확인일에 참/거짓을 매길 수 없는 문장은 남기기가 아닙니다.
   ✗ "남편 반응이 어땠는가" ✓ "남편이 선물을 마음에 들어 했다"
8. 무거움 신호(반복되는 괴로움, 관계·건강·돈의 큰 갈림, 되돌리기 어려움)가 보이면 escalate: 더 큰 질문을 한 줄로 이름 붙여 제안만 하세요. 강요하지 않습니다.
   bigger_question은 구체적인 결정의 이름이어야 합니다 (예: "이 팀에서 계속 일할지"). "더 깊은 곳에서 오는 건 아닐까요" 같은 모호한 심리 수사는 이름이 아닙니다.
9. 비추기(mirror)는 서술로 끝냅니다 — 질문으로 끝내지 마세요. 질문은 question 칸에만 삽니다 (안 그러면 화면에 같은 질문이 두 번 보입니다).
   ✗ "…걱정되시는 거네요. 지금 마음은 어느 쪽이에요?" ✓ "…걱정되시는 거네요. 어느 쪽인지는 아직 얘기 안 하셨고요."
10. 질문 문장에 "한 줄이면 돼요"를 넣지 마세요 — 입력창이 이미 그 말을 하고 있습니다.
11. 확인 시점은 문장이 답해질 수 있게 된 뒤여야 합니다 — 문장의 시간대가 나중이면 확인을 내일 아침으로 당기지 마세요.
   원칙: 문장이 가리키는 일이 끝난 뒤의 첫 아침(또는 첫 순간)을 고르세요.
   ✗ 주말 약속인데 when이 "tomorrow_morning" ✓ 주말 약속이면 "this_weekend" (더 뒤가 필요하면 "in_days")
   ✗ 내일 저녁 일인데 when이 "tomorrow_morning" ✓ 내일 저녁 일이면 "in_days"에 days 2 (모레 아침)
12. 사용자가 어렵다고 말한 것을 평가하거나 축소하지 마세요 — "별거 아니에요", "그렇게 ~한 것도 아니고요", "충분히 ~해요" 같은 저울질 금지. 그대로 비추거나, 모르면 물으세요.
   ✗ "일곱 시 반이면 그렇게 이른 것도 아니고요" ✓ "일곱 시 반이 이르게 느껴지시는 거네요"
13. 질문 하나 = 대비 하나, 한 번에 읽히게. 겹겹이 안긴 갈래 금지.
   ✗ "눈치보이는 게 빠진다는 말 자체인지, 아니면 이유를 뭐라고 말할지인지 어느 쪽이에요?" ✓ "눈치가 보이는 건 빠지는 것 자체예요, 아니면 뭐라고 말할지예요?"
14. 다른 결정을 이름 붙여 미뤘다면("~은 또 다른 얘기니까"), 남기기/마무리 비추기의 끝에 손잡이를 한 줄로 돌려주세요. 예: "부업 얘기는 언제든 따로 던져 주세요." 버튼도 의식도 없이, 그 한 줄만.`;

/** Faithful EN variant of the approved KO core — same rules, same order. */
const LIGHT_RULES_EN = `You are Argus — a mirror for judgment. The user just tossed you an everyday decision in a line.

Absolute rules:
1. Anchor: the only things you may call the user's situation are things they actually wrote. Never turn what they didn't say into their situation (e.g. never mention 'drinks' just because they wrote 'party'). If you don't know something, say you don't know or ask.
   Tense and progress state too — never assert the opposite or an unstated state of the world. When ambiguous, say you don't know.
   ✗ (state never given) "So the party isn't over yet" ✓ "You didn't say whether the party is still going or done"
2. No verdicts: never say which side is better. You only name the one variable the decision turns on and hand it back.
3. One question at a time, at most 2 in total. Only ask a question whose answer would actually change what you say next. If it wouldn't, don't ask — go to the leave-behind line.
4. Never create answer options (multiple choice). The user writes the answer in their own words.
5. Tone: warm and casual, short like a friend. No report tone, no translationese.
   ✗ "This calls for a condition-management approach" ✓ "So it's fine as long as you're not wrecked tomorrow"
   ✗ "I sense you have concerns regarding this" ✓ "So that's the part that nags you"
   Name a gap warmly, never bluntly:
   ✗ "I can't tell why you're hesitating" ✓ "You haven't said which reason it is yet"
6. You don't need to be surprising. You need to be accurate. Never invent studies, statistics, or numbers.
7. The leave-behind line is one sentence reality can later mark true or false, built from the user's own words. For everyday decisions the default check time is tomorrow morning.
   Always DECLARATIVE — no interrogatives ("how it went", "whether it was"), no conditional forks ("if A then X, else Y"). A sentence that cannot be graded true/false on the check day is not a leave-behind.
   ✗ "How my husband reacted" ✓ "My husband liked the gift"
8. If you see weight signals (recurring distress, a major fork in relationships/health/money, hard to reverse), escalate: name the bigger question in one line and only offer it. Never push.
   bigger_question must be the NAME of a concrete decision (e.g. "whether to keep working on this team"). Vague psychological rhetoric ("could this come from somewhere deeper?") is not a name.
9. The mirror ends as a statement — never as a question. Questions live ONLY in the question field (otherwise the screen shows the same question twice).
   ✗ "…so that's the worry. Which way are you leaning?" ✓ "…so that's the worry. You haven't said which way you're leaning yet."
10. Never put "one line is enough" inside a question — the input field already says that.
11. The check moment must come AFTER the claim can be answered — never pull the check to tomorrow morning when the claim's own timeframe is later.
   Principle: pick the FIRST morning (or moment) AFTER the event the sentence names.
   ✗ a weekend plan with when "tomorrow_morning" ✓ a weekend plan with "this_weekend" (or "in_days" if it needs longer)
   ✗ a tomorrow-evening event with when "tomorrow_morning" ✓ a tomorrow-evening event with "in_days", days 2 (the morning after)
12. Never appraise or minimize what the user called hard — no "that's not a big deal", "that's not really so early", "you have plenty of time" weighings. Reflect it as theirs, or ask.
   ✗ "7:30 isn't really that early" ✓ "So 7:30 feels early to you"
13. One question = one plain contrast, readable in one pass. No doubly nested forks.
   ✗ "Is it that the awkwardness is about the fact of skipping itself, or about what reason you would give, which one is it?" ✓ "Is the awkward part skipping itself, or what to say?"
14. If you explicitly deferred a named second decision ("that's a separate story"), end the offer/close mirror with ONE quiet line handing the handle back, e.g. "Toss me the side-job question any time, separately." No button, no ceremony — just the line.`;

const GATE_SECTION_KO = `

[분류 기준]
light = 일상의 결정: 걸린 것이 작고, 되돌릴 수 있고, 개인적인 말투.
heavy = 업무 산출물, 외부 청중, 큰 이해관계, 되돌리기 어려움, 위기에 가까움, 또는 사용자가 공들여 쓴 여러 문단.
단, 길이는 무게가 아닙니다 — 문단이 많아도 수다·일상 어조에 걸린 것이 작으면 light입니다 ('공들여 쓴'은 이해관계의 신호일 때만 무게입니다).
결정이 아닌 질문(뜻 풀이·방법·사실 문의)도 heavy로 분류하세요 — 무거워서가 아니라, 답을 바로 주는 경로가 그쪽에 있습니다. 되묻지 말고 넘기세요.
확신이 없으면 heavy로 분류하세요. 무거운 결정을 가볍게 다루는 해가 가벼운 결정에 의식을 치르는 해보다 큽니다.

[첫 생각 — 첫 질문 전용]
입력에 갈림이 보이면 (할까 말까, A냐 B냐) 첫 질문은 지금 기운 쪽과 그 이유를 한 호흡에 자연스럽게 초대하세요.
형태 예시 (그대로 복사 금지 — 매번 사용자의 말로 새로 만드세요. 물음표는 한 번만): "지금 마음은 어느 쪽에 가 있어요? 왜 그런지도 같이요."
규칙: 기울기를 제안하지 마세요. 답을 미리 채워주지 마세요. 건너뛰어도 잃는 것이 없습니다. 기울기 질문은 최대 한 번입니다.
갈림이 안 보이면 평소의 열린 질문을 하세요. 그때는 이유가 곧 첫 생각입니다.

[출력]
JSON만 출력하세요. 다른 텍스트 금지:
{"need":"light" 또는 "heavy","mirror":"...","question":"..."}
need가 "light"일 때만: mirror = 비추기(사용자의 말로 상황을 되비추고, 모르는 것은 모른다고 정직하게 이름 붙이기), question = 첫 질문 하나(규칙 3·4 준수). need가 "heavy"면 mirror와 question은 생략하세요.`;

const GATE_SECTION_EN = `

[Routing criterion]
light = an everyday decision: low stakes, reversible, personal register.
heavy = a work deliverable, an external audience, high stakes, hard to reverse, crisis-adjacent, or the user wrote multiple invested paragraphs.
But length is not weight — many paragraphs in a chatty, everyday register with small stakes stay light ("invested" counts only as a stakes signal).
A question that is NOT a decision (a definition, a how-to, a fact) also routes heavy — not because it is heavy, but because the answering path lives there. Do not answer a question with a question; hand it over.
When unsure, classify heavy. Under-treating a heavy decision is worse than ceremony on a light one.

[First thought — first question only]
If the input shows a visible fork (should I or not, A vs B), let the FIRST question naturally invite the current lean plus the reason in one breath.
Shape example (never copy it verbatim — rebuild it from the user's words every time; ONE question mark only): "Which way is your heart leaning right now? And the why, too."
Rules: never suggest a lean. Never pre-fill an answer. Skipping loses nothing. The lean question is asked at most once.
No visible fork: ask the usual open question. The reason IS the first thought then.

[Output]
Output JSON only. No other text:
{"need":"light" or "heavy","mirror":"...","question":"..."}
Only when need is "light": mirror = the mirror beat (reflect the situation in the user's own words, honestly naming what you don't know), question = the ONE first question (rules 3 and 4). When "heavy", omit mirror and question.`;

function nextSectionKo(questionsAsked: number): string {
  const budget = questionsAsked >= LIGHT_MAX_QUESTIONS
    ? '질문 예산을 다 썼습니다. 더 묻지 마세요 — action은 "offer" 또는 "escalate"만 가능합니다.'
    : `남은 질문 기회는 ${LIGHT_MAX_QUESTIONS - questionsAsked}개입니다.`;
  return `

[지금 상황]
사용자가 지금까지 질문 ${questionsAsked}개에 답했습니다. ${budget}
기울기(첫 생각)를 다시 묻지 마세요 — 물을 수 있는 자리는 첫 질문 하나뿐이었습니다.

[출력]
JSON만 출력하세요. 다른 텍스트 금지:
{"mirror":"...","action":"ask" 또는 "offer" 또는 "escalate","question":"...","offer":{"sentence":"...","when":"tonight" 또는 "tomorrow_morning" 또는 "this_weekend" 또는 "in_days","days":숫자,"ask":"..."},"escalate":{"bigger_question":"..."}}
- mirror: 방금 답을 반영해 상황을 다시 비추는 한두 문장 (규칙 1·5).
- action "ask": question에 다음 질문 하나만 (규칙 3·4).
- action "offer": 남기기는 계약이 아니라 다시 물어봐도 되는지 허락을 구하는 순간입니다.
  · offer.sentence = 규칙 7의 남기기 한 문장. 내부 기록용 — 사용자에게 이 문장을 그대로 보여주지 않습니다.
  · offer.when = 확인 시점 ("in_days"면 days는 1~14).
  · offer.ask = 비추기에서 자연스럽게 이어지는 허락 문장 하나. 패턴: "그럼 {오늘의 정리}하는 걸로 하고 — {확인 시점}에 {확인할 것}, 제가 한 번만 물어볼까요?" ({오늘의 정리}와 {확인할 것}은 사용자의 말로).
  · {오늘의 정리}에는 사용자가 직접 말한 기울기/결정만 넣을 수 있습니다. 아직 안 정했으면 "~하는 걸로 하고"를 통째로 버리고, 어느 쪽도 확정하지 않는 중립 허락문으로 — 확인할 사실만 남기세요. 되묻는 수사의문("아니면 ~해볼 만한지")으로 재심의를 이어가지도 마세요.
    ✗ (사용자가 안 정했는데) "그럼 부모님 뵙고 일요일 저녁에 밀린 일 하는 걸로 하고 —" ✓ "그럼 주말을 보내 보시고 — 일요일 저녁에 어떻게 하셨는지, 제가 한 번만 물어볼까요?"
  · 이 금지는 ask 문장 전체에 적용됩니다 — {확인할 것} 안에서도 안 내린 결정을 전제하지 마세요.
    ✗ (구매를 안 정했는데) "새 노트북으로 실제로 편집이 잘 되는지" ✓ "노트북을 어떻게 하기로 했는지"
  · ask 규칙: 괄호 인용(「」) 금지. 내기 어휘(걸다·걸어두다·베팅) 금지 — 사용자에게 보이는 모든 문장에서.
- action "escalate": 규칙 8. escalate.bigger_question에 더 큰 질문 한 줄.`;
}

function nextSectionEn(questionsAsked: number): string {
  const budget = questionsAsked >= LIGHT_MAX_QUESTIONS
    ? 'The question budget is spent. Do not ask anything else — action must be "offer" or "escalate".'
    : `You have ${LIGHT_MAX_QUESTIONS - questionsAsked} question(s) left.`;
  return `

[Where we are]
The user has answered ${questionsAsked} question(s) so far. ${budget}
Never re-ask the lean (first thought) — its only slot was the first question.

[Output]
Output JSON only. No other text:
{"mirror":"...","action":"ask" or "offer" or "escalate","question":"...","offer":{"sentence":"...","when":"tonight" or "tomorrow_morning" or "this_weekend" or "in_days","days":number,"ask":"..."},"escalate":{"bigger_question":"..."}}
- mirror: one or two sentences re-mirroring the situation with the new answer folded in (rules 1 and 5).
- action "ask": exactly one next question in question (rules 3 and 4).
- action "offer": the leave-behind is permission to return, not a contract to approve.
  · offer.sentence = the rule-7 leave-behind sentence. Internal record only — never show it verbatim to the user.
  · offer.when = the check time (for "in_days", days is 1 to 14).
  · offer.ask = ONE permission sentence flowing naturally out of the mirror. Pattern: "So let's go with {today's call in their words} — and {check time}, {the thing to check}, want me to ask you just once?"
  · {today's call} may hold ONLY a lean/decision the user actually stated. If they have not decided, drop "let's go with" entirely and use a neutral permission framing — name only the fact to check, settling neither side. No rhetorical re-deliberation either ("or whether you could just...").
    ✗ (user undecided) "So let's go with visiting your parents and doing the backlog Sunday evening —" ✓ "So see how the weekend goes — and Sunday evening, how it actually went, want me to ask you just once?"
  · The ban binds the WHOLE ask — never presuppose the undecided choice inside {the thing to check} either.
    ✗ (purchase undecided) "whether editing runs well on the new laptop" ✓ "what you ended up deciding about the laptop"
  · ask rules: no bracketed 「quote」. No betting vocabulary in anything the user sees.
- action "escalate": rule 8 — the bigger question, one line, in escalate.bigger_question.`;
}

/** Build the light-path system prompt. Exported for the contract test. */
export function buildLightSystemPrompt(
  locale: Locale,
  phase: 'gate' | 'next',
  questionsAsked = 0,
): string {
  const rules = locale === 'ko' ? LIGHT_RULES_KO : LIGHT_RULES_EN;
  if (phase === 'gate') return rules + (locale === 'ko' ? GATE_SECTION_KO : GATE_SECTION_EN);
  return rules + (locale === 'ko' ? nextSectionKo(questionsAsked) : nextSectionEn(questionsAsked));
}

/** User prompt for the gate call. Exported for tests. */
export function buildLightGateUserPrompt(problemText: string, locale: Locale): string {
  const header = locale === 'ko' ? '사용자가 방금 쓴 것:' : 'What the user just wrote:';
  return `${header}\n<user-data context="decision">\n${sanitizeForPrompt(problemText)}\n</user-data>`;
}

/** User prompt for subsequent turns. Exported for tests. */
export function buildLightNextUserPrompt(
  problemText: string,
  qas: LightQA[],
  locale: Locale,
): string {
  const ko = locale === 'ko';
  const qaLines = qas
    .map((qa, i) => `Q${i + 1}. ${sanitizeForPrompt(qa.question)}\nA${i + 1}. ${sanitizeForPrompt(qa.answer)}`)
    .join('\n');
  return [
    ko ? '사용자가 처음 쓴 것:' : 'What the user first wrote:',
    `<user-data context="decision">\n${sanitizeForPrompt(problemText)}\n</user-data>`,
    '',
    ko ? '지금까지의 문답 (질문은 당신, 답은 사용자):' : 'The exchange so far (questions were yours, answers are the user\'s):',
    `<user-data context="answers">\n${qaLines}\n</user-data>`,
  ].join('\n');
}

// ─── Defensive coercion (CLAUDE.md: LLM output may omit fields / add junk) ───

function asTrimmedString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Copy-redundancy guard 1 (production capture): the mirror must not end with a
 * question when a question beat follows — the headline would repeat it word for
 * word. Drops the mirror's trailing question SENTENCE (the reflective statement
 * part stays); a mirror that was nothing but the question drops to ''.
 */
export function stripTrailingQuestion(mirror: string): string {
  const t = (mirror || '').trim();
  if (!/[?？]$/.test(t)) return t;
  const body = t.slice(0, -1);
  const idx = Math.max(
    body.lastIndexOf('.'),
    body.lastIndexOf('!'),
    body.lastIndexOf('?'),
    body.lastIndexOf('？'),
    body.lastIndexOf('…'),
    body.lastIndexOf('\n'),
  );
  return idx >= 0 ? t.slice(0, idx + 1).trim() : '';
}

/**
 * Copy-redundancy guard 2 (production capture): "한 줄이면 돼요" / "one line is
 * enough" belongs to the input placeholder ONLY — a question carrying it makes
 * the phrase appear twice on one screen. Drops the sentence fragment holding
 * the phrase; if that would empty the question, drops just the phrase.
 */
/**
 * F11 residual (sim re-run, mech): "한 번에 하나" said the rule, and the fast
 * tier still emitted two question marks in one question. Keep the FIRST '?'
 * (the main ask) and soften every later one to a period — Korean polite
 * request endings ("~실래요.", "~까요.") stay grammatical with a period, so no
 * content is rewritten, only punctuation.
 */
export function limitQuestionMarks(text: string): string {
  const t = (text || '').trim();
  if (((t.match(/[?？]/g)) || []).length < 2) return t;
  let seen = false;
  return t.replace(/[?？]/g, (m) => {
    if (!seen) { seen = true; return m; }
    return '.';
  });
}

const ONE_LINE_PHRASE = /한\s*줄이면\s*돼요|one\s+line\s+is\s+enough/i;
export function stripOneLinePhrase(text: string): string {
  const t = (text || '').trim();
  if (!ONE_LINE_PHRASE.test(t)) return t;
  const withoutSentence = t
    .replace(/[^.!?？\n]*(?:한\s*줄이면\s*돼요|one\s+line\s+is\s+enough)[^.!?？\n]*[.!…]?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (withoutSentence) return withoutSentence;
  const bare = t
    .replace(/(?:한\s*줄이면\s*돼요|one\s+line\s+is\s+enough)/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Orphaned punctuation is not a question — an emptied question stays empty
  // (the action clamps then degrade it honestly).
  return /[\p{L}\p{N}]/u.test(bare) ? bare : '';
}

export function clampLightDays(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.min(LIGHT_DAYS_MAX, Math.max(LIGHT_DAYS_MIN, Math.round(n)));
}

/**
 * F10 (sim campaign, 4/6 offers): the sealed payload must be a DECLARATIVE that
 * reality can grade at the check date. An interrogative sentence ("남편 반응이
 * 어땠는가", "만족스러웠는지") seals a question as a prediction — ungradeable.
 * Exported for tests.
 */
export function isInterrogativeSentence(sentence: string): boolean {
  const t = (sentence || '').trim();
  if (!t) return false;
  // NOTE: [가-힣]까 (not a bare ㄹ까) — a jamo pattern never matches composed
  // syllables (갈까/살까/볼까), the exact dead-rule class the plugin audit found.
  return /[?？]\s*$/.test(t) || /(?:는지|는가|[가-힣]까)(?:요)?\s*[.!…]?\s*$/.test(t);
}

function coerceOffer(v: unknown): LightOffer | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const sentence = asTrimmedString(o.sentence);
  if (!sentence) return undefined; // honest gap: no sentence, no offer — never fabricate
  // F10: an interrogative payload cannot be graded true/false at settle — reject
  // the offer (the turn degrades honestly; we never rewrite it into a claim).
  if (isInterrogativeSentence(sentence)) return undefined;
  let when: LightWhen =
    o.when === 'tonight' || o.when === 'this_weekend' || o.when === 'in_days' || o.when === 'tomorrow_morning'
      ? o.when
      : 'tomorrow_morning'; // rule 7 default
  let days: number | undefined;
  if (when === 'in_days') {
    days = clampLightDays(o.days);
    if (days === undefined) when = 'tomorrow_morning'; // in_days without a usable number → default check time
  }
  // Check-time sanity nudges (production captures: a weekend claim checked
  // tomorrow morning — BEFORE the weekend; a tomorrow-EVENING claim checked
  // tomorrow MORNING — before the event). These are cheap KEYWORD HEURISTICS,
  // not semantics: the prompt's rule 11 ("first morning after the event") owns
  // the real logic; the guards only remove the impossible-to-answer cases.
  if (when === 'tomorrow_morning' && /주말|이번\s*주|다음\s*주|weekend/i.test(sentence)) {
    // Weekend/this-week/next-week timeframe → Sunday. (다음 주 is
    // under-corrected — Sunday is still earlier than next week's end — but
    // strictly later than tomorrow.)
    when = 'this_weekend';
    days = undefined;
  }
  if (
    when === 'tomorrow_morning'
    && /내일.{0,20}(저녁|밤|회식)|(저녁|밤|회식).{0,20}내일|tomorrow.{0,24}(evening|night|dinner)/i.test(sentence)
  ) {
    // Tomorrow-evening event → the morning AFTER (in 2 days).
    when = 'in_days';
    days = 2;
  }
  // The permission ask must FLOW — a bracketed 「quote」 would re-introduce the
  // contractual reading the ask exists to avoid, so brackets are stripped
  // structurally (the prompt also forbids them; prompt rules alone don't
  // survive weak tiers). Absent/empty → undefined; the UI composes a
  // mechanical fallback from the when label.
  const ask = limitQuestionMarks(asTrimmedString(o.ask).replace(/[「」]/g, '').trim()) || undefined;
  return { sentence, when, ...(days !== undefined ? { days } : {}), ...(ask ? { ask } : {}) };
}

/** Gate coercion. Anything short of a renderable light opening falls to heavy. */
export function coerceLightGate(raw: unknown): LightGateResult {
  if (!raw || typeof raw !== 'object') return { need: 'heavy' };
  const r = raw as Record<string, unknown>;
  if (r.need !== 'light') return { need: 'heavy' };
  const question = limitQuestionMarks(stripOneLinePhrase(asTrimmedString(r.question)));
  // A question follows → the mirror may not end on one (redundancy guard 1).
  const mirror = question
    ? stripTrailingQuestion(asTrimmedString(r.mirror))
    : asTrimmedString(r.mirror);
  // 'light' without both beats cannot be rendered — fall through to heavy
  // (when unsure → heavy) instead of fabricating the missing beat.
  if (!mirror || !question) return { need: 'heavy' };
  return { need: 'light', mirror, question };
}

/**
 * Turn coercion + the HARD clamps. `questionsAsked` = number of already-answered
 * questions in this session; at LIGHT_MAX_QUESTIONS a further 'ask' is forced to
 * 'offer' (when the model supplied one) or a plain 'close' — never a third question.
 * NOTE: any `options` field the model emits is structurally dropped (anti-술
 * invariant — the light path never renders generated choices).
 */
export function coerceLightTurn(raw: unknown, questionsAsked: number): LightTurn {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawMirror = asTrimmedString(r.mirror);
  const question = limitQuestionMarks(stripOneLinePhrase(asTrimmedString(r.question)));
  const offer = coerceOffer(r.offer);
  const esc = r.escalate && typeof r.escalate === 'object'
    ? asTrimmedString((r.escalate as Record<string, unknown>).bigger_question)
    : '';
  const escalate = esc ? { bigger_question: esc } : undefined;

  let action: LightAction;
  if (r.action === 'ask' || r.action === 'offer' || r.action === 'escalate' || r.action === 'close') {
    action = r.action;
  } else {
    // Missing/garbled action: infer from what was actually produced.
    action = question ? 'ask' : offer ? 'offer' : escalate ? 'escalate' : 'close';
  }

  // Hard clamp: max 2 questions per session, and an 'ask' without a question is empty.
  if (action === 'ask' && (questionsAsked >= LIGHT_MAX_QUESTIONS || !question)) {
    action = offer ? 'offer' : 'close';
  }
  // Honest gaps: a claimed beat without its payload degrades, never fabricates.
  if (action === 'offer' && !offer) action = escalate ? 'escalate' : 'close';
  if (action === 'escalate' && !escalate) action = offer ? 'offer' : 'close';

  // Redundancy guard 1: when a question beat follows (the next question or the
  // permission ask), the mirror may not end on a question the headline would
  // then repeat.
  const mirror = action === 'ask' || action === 'offer'
    ? stripTrailingQuestion(rawMirror)
    : rawMirror;

  return {
    mirror,
    action,
    ...(action === 'ask' ? { question } : {}),
    ...(action === 'offer' && offer ? { offer } : {}),
    ...(action === 'escalate' && escalate ? { escalate } : {}),
  };
}

// ─── Engine calls ───

/**
 * ONE fast call that both routes AND, when light, returns the first beat
 * (mirror + question) — no second call. The deterministic crisis classifier
 * runs FIRST (zero tokens on a crisis input; the existing crisis handling owns
 * it via the heavy path). Never throws: any failure returns heavy so the
 * existing flow (with its full error surface) takes over.
 */
export async function runLightGate(
  problemText: string,
  locale: Locale,
  signal?: AbortSignal,
): Promise<LightGateResult> {
  const text = (problemText || '').trim();
  if (!text) return { need: 'heavy' };

  const crisis = classifyCrisis(text);
  if (crisis.isCrisis && crisis.category) return { need: 'heavy' };

  try {
    const raw = await callLLMJson<Record<string, unknown>>(
      [{ role: 'user', content: buildLightGateUserPrompt(text, locale) }],
      {
        system: buildLightSystemPrompt(locale, 'gate'),
        model: 'fast',
        maxTokens: 500,
        signal,
        shape: { need: 'string' },
      },
    );
    return coerceLightGate(raw);
  } catch (err) {
    // Fail open to the heavy flow — it owns error surfacing (quota, network, …)
    // and "when unsure → heavy" is the light gate's own rule. Quota fallthrough
    // is COUNTED (not changed): quota-limited users silently miss the light
    // path, and that rate must be visible. Duck-typed (never instanceof — the
    // llm module is mocked in tests) against LLMError's category/message.
    const category = (err as { category?: string } | null)?.category;
    const message = err instanceof Error ? err.message : '';
    if (category === 'rate_limit' || (category === 'auth' && message.startsWith('LOGIN_REQUIRED'))) {
      try { track('light_gate_quota_fallback'); } catch { /* telemetry never blocks the fallback */ }
    }
    return { need: 'heavy' };
  }
}

/**
 * F6 structural clamp (sim: 5 fast-tier runs, 5 variants of the same violation
 * — "~하는 걸로 하고", "새 노트북을 사서", "새 노트북으로 실제로 어떻게
 * 작업되는지" — each escaping the previous prompt rule; prompt rules alone do
 * not survive the weak tier, R29's lesson again). So the guard is structural:
 * a model-composed ask survives ONLY when the user actually STATED a decision
 * somewhere in their own words ("사기로 했어요", "갈래", "decided to…") — the
 * one case where restating their call is honest mirroring. On an UNDECIDED
 * session the tailored ask is dropped entirely and the UI's neutral when-label
 * fallback renders ("{확인 시점}에 제가 한 번만 물어볼까요?") — mechanical,
 * presupposition-free by construction. Deliberate trade: tailoring is lost on
 * undecided sessions; neutrality is not negotiable there (value ∝ tilt).
 */
// [가-힣]기로 (했|정했) covers 사기로 했/가기로 했/하기로 정했 — a bare 하기로
// literal misses ordinary verb stems (same composed-syllable trap as ㄹ까).
const STATED_DECISION = /[가-힣]기로\s*(?:했|정했)|결정했|할래|살래|갈래|보낼래|버릴래|going\s+to\s|decided\s+to\s|i'?ll\s/i;
export function neutralizeUndecidedAsk(turn: LightTurn, problemText: string, qas: LightQA[]): LightTurn {
  if (!turn.offer?.ask) return turn;
  const userTexts = [problemText, ...qas.map((qa) => qa.answer || '')];
  if (userTexts.some((t) => STATED_DECISION.test(t || ''))) return turn;
  const { ask: _dropped, ...offer } = turn.offer;
  void _dropped;
  return { ...turn, offer };
}

/**
 * Subsequent light turns. `qas` includes the just-answered pair. The crisis
 * classifier screens EVERY answer before the LLM is called; on fire it returns
 * a crisis-marked close so the caller can stop the light flow and route to the
 * existing crisis surface. Throws on LLM failure (the caller offers retry).
 */
export async function runLightNext(
  problemText: string,
  qas: LightQA[],
  locale: Locale,
  signal?: AbortSignal,
): Promise<LightTurn> {
  const answersText = qas.map((qa) => qa.answer || '').join('  ');
  const crisis = classifyCrisis(answersText);
  if (crisis.isCrisis && crisis.category) {
    return { mirror: '', action: 'close', crisis };
  }

  const raw = await callLLMJson<Record<string, unknown>>(
    [{ role: 'user', content: buildLightNextUserPrompt(problemText, qas, locale) }],
    {
      system: buildLightSystemPrompt(locale, 'next', qas.length),
      model: 'fast',
      maxTokens: 700,
      signal,
      shape: { mirror: 'string', action: 'string' },
    },
  );
  return neutralizeUndecidedAsk(coerceLightTurn(raw, qas.length), problemText, qas);
}

// ─── check_by date math (founder-specified mapping) ───

const DAY_MS = 86_400_000;

/**
 * when → concrete check date. tonight=today 21:00 · tomorrow_morning=next day
 * 09:00 · this_weekend=next Sunday 10:00 · in_days=now+days (days clamped 1–14).
 * Defensive: a slot already in the past rolls forward (tonight past 21:00 →
 * tomorrow 21:00; Sunday past 10:00 → next Sunday) so a seal is never born due.
 */
export function lightCheckBy(when: LightWhen, days: number | undefined, now: number): Date {
  if (when === 'tonight') {
    const d = new Date(now);
    d.setHours(21, 0, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d;
  }
  if (when === 'tomorrow_morning') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  if (when === 'this_weekend') {
    const d = new Date(now);
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); // 0 if already Sunday
    d.setHours(10, 0, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 7);
    return d;
  }
  const n = clampLightDays(days) ?? LIGHT_DAYS_MIN;
  return new Date(now + n * DAY_MS);
}

/** Human label for the check slot — used in the close line "기억해 뒀어요. {확인 시점}에…"
 *  and in the permission button "{확인 시점}에 물어봐 주세요". */
export function lightWhenLabel(when: LightWhen, days: number | undefined, locale: Locale): string {
  const ko = locale === 'ko';
  switch (when) {
    case 'tonight': return ko ? '오늘 밤 9시' : 'tonight at 9';
    case 'tomorrow_morning': return ko ? '내일 아침' : 'tomorrow morning';
    case 'this_weekend': return ko ? '이번 주 일요일' : 'this Sunday';
    case 'in_days': {
      const n = clampLightDays(days) ?? LIGHT_DAYS_MIN;
      return ko ? `${n}일 뒤` : `in ${n} day${n === 1 ? '' : 's'}`;
    }
  }
}

// ─── First thought (첫 생각) ───

/**
 * The FIRST answer of a light session is the first-thought anchor (첫 생각):
 * on a visible fork the first question invites the current lean + reason in one
 * breath, and with no fork the reason IS the first thought. Always the user's
 * words verbatim — never suggested, never pre-filled (anchor rules in the
 * system prompt). Undefined when nothing was answered (skipping loses nothing).
 */
export function firstThoughtFromQas(qas: LightQA[]): string | undefined {
  const t = (qas[0]?.answer || '').trim();
  return t || undefined;
}

// ─── Seal contract (REUSES the existing decision-contract machinery) ───

export interface LightSealInput {
  /** The falsifiable line as it will be sealed (already trimmed by the caller). */
  sentence: string;
  /** True when the user rewrote the AI-phrased line — provenance becomes user_reworded. */
  edited: boolean;
  when: LightWhen;
  days?: number;
  /** The original problem — kept as origin_utterance. */
  problemText: string;
  /** 첫 생각 — the user's first answer, verbatim. Stored in the EXISTING
   *  judgment_receipt.baseline_judgment slot (the pre-review baseline that is
   *  deliberately never scored), so the later return can read
   *  처음 생각 → 남긴 판단 → 현실 without any new field. */
  firstThought?: string;
}

/**
 * Build the light seal as a normal DecisionContract on project.decision_contract.
 * Provenance is honest per the existing conventions:
 *   - accepted as-is → predicate authored 'ai_surfaced' + webAiAttribution +
 *     adoption_lineage (wording) — the machine phrased it, the user adopted it.
 *   - edited → authored 'user' + webUserAttribution('user_reworded').
 * closed_at + sealed_statement make contractPhase read 'sealed' (not a pre-review
 * baseline awaiting a review that will never come), and check_in_at puts it on
 * the SAME return loop as every other seal (due surfaces + check-in emails).
 */
export function buildLightSealContract(
  projectId: string,
  input: LightSealInput,
  now: number,
): DecisionContract | null {
  const sentence = (input.sentence || '').trim();
  if (!sentence) return null;

  const checkBy = lightCheckBy(input.when, input.days, now);
  const base = buildEarlyContract(
    projectId,
    { lean: sentence, check_in_at: checkBy.toISOString() },
    now,
  );
  if (!base) return null;

  const predicates = base.predicates.map((p) =>
    p.source === 'user_lean'
      ? input.edited
        ? { ...p, authored: 'user' as const, attribution: webUserAttribution(now, LIGHT_SEAL_SOURCE_REF, 'user_reworded') }
        : { ...p, authored: 'ai_surfaced' as const, attribution: webAiAttribution(now, LIGHT_SEAL_SOURCE_REF) }
      : p,
  );
  const wordingId = predicates.find((p) => p.source === 'user_lean')?.id;
  const lineage = input.edited ? [] : adoptionLineageForSeal(predicates, [], wordingId);
  const sealed = predicates.find((p) => p.source === 'user_lean');

  // 첫 생각 → the EXISTING receipt slot for the pre-review baseline. The three
  // review-derived fields stay honestly empty (the light path never computed a
  // reframe/assumption/actor — empty renders nothing, fabricating would lie),
  // while human_judgment + attribution mirror the sealed line so settlement can
  // show 처음 생각 → 남긴 판단 → 현실 through the same JudgmentReceipt renderer.
  const firstThought = (input.firstThought || '').trim();
  const judgment_receipt = firstThought
    ? {
        real_question: '',
        unverified_assumption: '',
        human_only: '',
        baseline_judgment: firstThought,
        human_judgment: sentence,
        judgment_attribution: sealed?.attribution,
      }
    : undefined;

  return {
    ...base,
    predicates,
    sealed_statement: sentence,
    origin_utterance: (input.problemText || '').trim() || sentence,
    closed_at: new Date(now).toISOString(),
    ...(lineage.length ? { adoption_lineage: lineage } : {}),
    ...(judgment_receipt ? { judgment_receipt } : {}),
  };
}

// ─── Heavy handoff context ───

/**
 * Compose the problem + the light Q&A into the text the heavy flow receives.
 * This is the wire that actually reaches the heavy engine (createSession /
 * runInitialAnalysis take the problem text) — the Q&A context travels WITH the
 * decision instead of dangling in a store nothing on that path reads.
 *
 * F9 (sim campaign, light-05): an ACCEPTED escalation used to arrive at heavy
 * as bare emotional content + Q&A — STEP-0 read it as `vent` and produced a
 * dead end (no question, no next step) for a user who explicitly asked to look
 * deeper. `escalation` carries that intent as a plain statement of fact (it is
 * user-visible in the problem echo, so it states what happened — no hidden
 * steering), and names the bigger question as the frame to open.
 */
export function composeDeepenText(
  problemText: string,
  qas: LightQA[],
  locale: Locale,
  escalation?: { biggerQuestion?: string },
): string {
  const ko = locale === 'ko';
  const text = (problemText || '').trim();
  const parts = [text];
  if (qas.length) {
    const header = ko ? '가볍게 먼저 나눈 문답:' : 'Notes from a quick first pass:';
    const lines = qas.map((qa) => `Q. ${qa.question.trim()}\nA. ${qa.answer.trim()}`).join('\n');
    parts.push(`${header}\n${lines}`);
  }
  if (escalation) {
    const bq = (escalation.biggerQuestion || '').trim();
    parts.push(
      ko
        ? `${bq ? `함께 짚은 더 큰 질문: ${bq}\n` : ''}(방금 '더 깊이 보기'를 직접 선택해 이 질문을 열어 보기로 했습니다.)`
        : `${bq ? `The bigger question we named: ${bq}\n` : ''}(The user just chose to open this question up and look deeper.)`,
    );
  }
  return parts.filter(Boolean).join('\n\n');
}
