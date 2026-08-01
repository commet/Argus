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

/** The last-resort opener, used only when the model manufactured the fork. */
export function lowConfidenceOpeningCopy(locale: Locale): {
  question: { text: string; type: 'short'; options: string[]; subtext?: undefined };
} {
  return locale === 'ko'
    ? { question: { text: '이 상황에서 지금 가장 마음에 걸리는 건 뭐예요?', type: 'short', options: [] } }
    : { question: { text: 'What feels most unresolved about this situation right now?', type: 'short', options: [] } };
}

/**
 * Does this question actually stand on something the user wrote?
 *
 * Not a similarity score — a plain check for a run of the user's own words
 * inside the question. It is how you tell "리드 승진 얘기가 '나오는 중'이라고
 * 하셨는데, 구두로 오간 얘기예요?" (grounded in their sentence) from "지금 가장
 * 마음에 걸리는 건 뭐예요?" (could be asked of anybody about anything).
 *
 * Korean needs a shorter span than English because content words are denser and
 * particles glue on; 4 syllables is about "리드 승진". Stop-ish spans made of
 * pure whitespace/punctuation don't count.
 */
const ENGLISH_FILLER = new Set([
  'about', 'there', 'their', 'would', 'could', 'should', 'think', 'thinking',
  'really', 'going', 'other', 'because', 'which', 'where', 'while', 'still',
  'thing', 'things', 'something', 'anything', 'better', 'right', 'maybe',
  'whether', 'between', 'these', 'those', 'being', 'having', 'doing', 'over',
  'more', 'much', 'them', 'that', 'this', 'with', 'from', 'want', 'need',
  'know', 'like', 'just', 'been', 'have', 'what', 'when', 'they', 'some',
]);

export function questionEchoesUser(questionText: string, userText: string): boolean {
  const q = (questionText || '').normalize('NFKC').toLocaleLowerCase();
  const u = (userText || '').normalize('NFKC').toLocaleLowerCase();
  if (!q || !u) return false;

  if (/[가-힣]/.test(u)) {
    // Korean packs meaning densely and glues particles on, so a shared run of
    // four syllables ("리드 승진") is already a content match.
    for (let i = 0; i + 4 <= u.length; i += 1) {
      const span = u.slice(i, i + 4);
      if (!/[가-힣]/.test(span)) continue;
      if (q.includes(span)) return true;
    }
    return false;
  }

  // English shares connective tissue between any two sentences — "about ",
  // "think", "would" — so a raw substring match said every question echoed the
  // user. Match on CONTENT words only.
  const content = (u.match(/[a-z][a-z']{3,}/g) || []).filter((w) => !ENGLISH_FILLER.has(w));
  return content.some((w) => new RegExp(`\\b${w}`, 'i').test(q));
}

/**
 * Did the model invent the fork rather than find it?
 *
 * A question that offers branches is only honest when the branches are the
 * user's. "돈이 문제인가요, 번아웃이 문제인가요?" put to someone who wrote
 * "퇴사하고 여행이나 갈까" hands them a choice they never made — the
 * manufactured binary the mirror clause forbids. The same question WITH those
 * words in their message is just good listening.
 */
export function questionManufacturesFork(
  text: string,
  options: unknown[] | undefined,
  userText: string,
): boolean {
  // Only the TEXT can disqualify a question. Invented option chips are stripped
  // separately — throwing away a specific question because its chips were
  // paraphrases is how the canned opener ended up on nearly every screen.
  void options;
  const t = text || '';
  // Korean draws a binary two ways: with a connective ("A요, 아니면 B요?"), and
  // without one, by simply repeating the interrogative ("A인가요, B인가요?").
  const forked = /아니면|,\s*또는|\b(?:or)\b/i.test(t)
    || /(가요|나요|까요|예요|이에요)\s*[,，]\s*[^,，]{2,}(가요|나요|까요|예요|이에요)/.test(t);
  return forked && !questionEchoesUser(t, userText);
}

/**
 * Keep the model's question unless it manufactured the fork.
 *
 * This used to discard the question whenever the model self-reported framing
 * confidence under 70 — and open decisions self-report 55–62 as a matter of
 * course, so it fired almost every session and replaced a question written
 * about THIS person with one that could be asked of anybody. One measured run
 * threw away "리드 승진 얘기가 '나오는 중'이라고 하셨는데, 구두로 오간
 * 얘기예요?" — and that exact fact became the session's only recorded premise
 * two rounds later. The model had listened; the code overruled it.
 *
 * What actually needed guarding was never the model's confidence in itself. It
 * was the invented either/or. So that is all this blocks now.
 */
export function guardLowConfidenceOpeningQuestion<T extends {
  text?: string;
  type?: string;
  options?: unknown[];
  subtext?: string;
}>(
  question: T | null | undefined,
  problemText: string,
  locale: Locale,
): T | null {
  if (question?.text && !questionManufacturesFork(question.text, question.options, problemText)) {
    // The question stays. Its option chips only stay if the user drew them —
    // a chip they never wrote is a choice handed to them, and answering in
    // their own words is always available and always better.
    const chips = (question.options || [])
      .filter((o): o is string => typeof o === 'string' && !!o.trim())
      .filter((o) => questionEchoesUser(o, problemText));
    if (chips.length === (question.options || []).length) return question;
    return chips.length >= 2
      ? ({ ...question, options: chips } as T)
      : ({ ...question, options: undefined, type: 'short' } as unknown as T);
  }
  const open = lowConfidenceOpeningCopy(locale).question;
  // Identity (id, engine_phase) belongs to the flow, not to the copy: replacing
  // the whole object dropped the id, and an id-less question can no longer be
  // answered, upgraded, or matched to its receipt. Overlay the copy instead —
  // and clear the old subtext, which explained a question that no longer exists.
  return question
    ? ({ ...question, ...open, subtext: undefined } as unknown as T)
    : (open as unknown as T);
}

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
 * Ownership (v3 sim, heavy-01, reproduced across judge re-runs): the mirror
 * ranked the user's own concerns for them — "연봉 40% 차이보다 그쪽 회사의
 * 지속 가능성이 더 걸리는 지점인 거죠." Which of their concerns weighs more is
 * the one thing only they can say. The prompt banned it and the model reworded
 * around the ban on the very next run, so the SENTENCE FORM is owned by code.
 * Never empties the insight — the mirror survives, the ranking does not.
 */
const UNEARNED_RANKING =
  /(보다|비해)[^.!?…\n]*(더|덜)\s*[^.!?…\n]*(걸리|걸려|중요|앞[에서]|무겁|무거|크게|우선|신경|마음)|\b(matters?|weighs?|counts?|concerns?)\s+more\s+than\b|\bmore\s+of\s+a\s+(concern|worry)\s+than\b/;
export function stripUnearnedRanking(insight: string | undefined): string | undefined {
  if (!insight) return insight;
  const sentences = insight.split(/(?<=[.!?…])\s+/);
  const kept = sentences.filter((s) => !UNEARNED_RANKING.test(s));
  const out = kept.join(' ').trim();
  return out || insight;
}

function normalizeQuestionForRepeat(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function questionBigramSimilarity(a: string, b: string): number {
  const left = Array.from(normalizeQuestionForRepeat(a));
  const right = Array.from(normalizeQuestionForRepeat(b));
  if (left.length < 12 || right.length < 12) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < left.length - 1; i += 1) {
    const gram = `${left[i]}${left[i + 1]}`;
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  let overlap = 0;
  for (let i = 0; i < right.length - 1; i += 1) {
    const gram = `${right[i]}${right[i + 1]}`;
    const count = counts.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  }
  return (2 * overlap) / ((left.length - 1) + (right.length - 1));
}

/**
 * Drop an exact or near-paraphrase repeat so a useful off-axis answer cannot
 * be followed by the same information request in slightly different wording.
 * The threshold is intentionally high: false negatives are safer than deleting
 * a genuinely new question.
 */
export function dropRepeatedQuestion<T extends { text?: string }>(
  question: T | null | undefined,
  previouslyAsked: string[],
): T | null {
  if (!question?.text) return question ?? null;
  const normalized = normalizeQuestionForRepeat(question.text);
  if (!normalized) return null;
  return previouslyAsked.some((text) =>
    normalizeQuestionForRepeat(text) === normalized
    || questionBigramSimilarity(text, question.text || '') >= 0.28)
    ? null
    : question;
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
export function capEscalationArrival<T extends { hidden_assumptions?: string[] }>(
  result: T,
  problemText: string,
): T {
  if (!ESCALATION_MARKER.test(problemText || '')) return result;
  return { ...result, hidden_assumptions: (result.hidden_assumptions || []).slice(0, 1) };
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
