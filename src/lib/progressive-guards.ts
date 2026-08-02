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
    //
    // SYLLABLES, not characters. Sliding over the raw string counted spaces and
    // punctuation toward the four, so "다음 주" — three syllables and a space —
    // scored as a content match. Measured 2026-08-02: that is what let the live
    // app ship "…무게를 더하는 건가요? 아니면 별개로 마음에 걸리는 부분인가요"
    // on round 3. The fork guard asked whether the question stood on the user's
    // words, this said yes on a bare time reference, and a manufactured binary
    // reached a person. Both sides are stripped so a window can span a word
    // boundary the way "리드 승진" → "리드승진" needs it to.
    const strip = (s: string) => s.replace(/[^가-힣0-9a-z]/g, '');
    const su = strip(u);
    const sq = strip(q);
    for (let i = 0; i + 4 <= su.length; i += 1) {
      if (sq.includes(su.slice(i, i + 4))) return true;
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
  //
  // KNOWN GAP, measured and deliberately not closed. The right rule is that
  // EVERY pole must be the user's, not just one — the model builds a binary by
  // taking what they said and inventing its opposite, so a fork usually echoes
  // one side. Measured 2026-08-02: "나가서 뭔가 먹고 싶으신 건지, 아니면 집에
  // 있는 게 편하긴 한데…" survived on "집에 있" alone, from someone who wrote
  // "그냥 집에 있는 걸로 해결할까" and nothing about going out.
  //
  // Per-pole checking was implemented and reverted, because no span length
  // works: 4 syllables is too coarse for a short pole ("연봉이요" is theirs and
  // scores zero), and 2 is loose enough that "마음" passes anything. Both
  // settings break a case the other gets right. Shipping either would trade a
  // measured failure for a different measured failure, so the gap stays open
  // and named. The scenario it was found on (light-03, "오늘 저녁 뭐 먹지") is a
  // FLAT decision that should not have reached a second question at all — the
  // fork is a symptom there, and restraint is the actual cure.
}

/**
 * The same rule, for every turn after the first.
 *
 * `guardLowConfidenceOpeningQuestion` was only ever wired to the opening turn,
 * so rounds 2, 3 and 4 emitted questions nothing checked. Driving the real app
 * on 2026-08-02 produced this on round 3, which is the exact shape the spine
 * forbids — an engine-weighted two-pole fork handed to the user as if the poles
 * were theirs:
 *
 *   "그 두 분 얘기가, 다음 주 결정에 무게를 더하는 건가요?
 *    아니면 별개로 마음에 걸리는 부분인가요."
 *
 * A later turn drops the fork rather than replacing it. The opening copy is
 * written for first contact and would read as a reset mid-conversation, and
 * rewriting the model's question into a single pole would be Argus authoring
 * the question — the callers already fall through to a typed question or to no
 * question at all, and no question is a valid, restrained outcome.
 *
 * The corpus is everything the user has written by now, not just the opener:
 * a fork THEY drew ("A랑 B 중에 고민이에요") is theirs to be asked about, and by
 * round 3 they may have drawn it in an answer.
 */
export function dropManufacturedFork<T extends {
  text?: string;
  options?: unknown[];
}>(question: T | null | undefined, userCorpus: string): T | null {
  if (!question?.text) return null;
  return questionManufacturesFork(question.text, question.options, userCorpus)
    ? null
    : question;
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
  // The English clause was missing entirely — not thin, absent. A guard with no
  // branch for a language cannot fail on it, which is why the gap survived a
  // suite that has been green for weeks.
  const COND = /(없다면|없으면|된다면|이라면|아니라면)[^.!?…\n]*(걸림돌|문제(는|가|도)?\s*(없|아니)|괜찮|지장(은|이)?\s*없|무리(는|가)?\s*없|진행해도\s*돼)|\b(if|as long as|assuming|provided)\b[^.!?…\n]*\b(no (real )?(problem|issue|obstacle|blocker|downside)|not (really )?a (problem|issue|concern)|nothing (is )?(standing|stopping|holding)|you(\'|’)?re (fine|good|clear|all set)|(fine|safe|clear|free) to (go|proceed|move|do))\b/i;
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
// The English half covered comparatives ("X matters more than Y") and nothing
// else, so the commonest English form of the same violation — a superlative
// naming which of their concerns is the big one — went through untouched.
// `risk` is deliberately absent: ranking risks in the WORLD is analysis, and
// this guard is about ranking what weighs on the PERSON.
const UNEARNED_RANKING =
  /(보다|비해)[^.!?…\n]*(더|덜)\s*[^.!?…\n]*(걸리|걸려|중요|앞[에서]|무겁|무거|크게|우선|신경|마음)|\b(matters?|weighs?|counts?|concerns?)\s+more\s+than\b|\bmore\s+of\s+a\s+(concern|worry)\s+than\b|\bthe\s+(most|biggest|main|primary|chief)\s+(important|pressing|significant|urgent)?\s*(factor|concern|worry|issue|consideration|thing)\b|\bwhat\s+(really\s+)?matters\s+(most|more)\b/i;
/**
 * Their ranking, attributed to them, is not an unearned ranking.
 *
 * "AND WHEN THEY DO SAY IT, IT STANDS" is a rule of the judgment contract, and
 * this guard was breaking it. Found 2026-08-03 while measuring the English
 * branches: "You said the title matters more than the money" was being deleted
 * by the `matters more than` clause — Argus quoting the user's own weighing back
 * to them, erased as if Argus had done the weighing.
 *
 * That is the worse of the two failure directions. A missed ranking is one bad
 * sentence; a deleted attribution takes the user's voice out of their own
 * mirror, which is the thing the product is for.
 */
const ATTRIBUTED_TO_USER = new RegExp(
  '(말씀하셨|말씀하신|하셨듯|하신 대로|라고 하셨|쓰셨|적으셨|하셨는데|하셨고)'
  + '|\\b(you (said|wrote|told me|mentioned|put it)|as you (said|put it|described)'
  + '|by your own)\\b',
  'i',
);

export function stripUnearnedRanking(insight: string | undefined): string | undefined {
  if (!insight) return insight;
  const sentences = insight.split(/(?<=[.!?…])\s+/);
  const kept = sentences.filter(
    (s) => !UNEARNED_RANKING.test(s) || ATTRIBUTED_TO_USER.test(s),
  );
  const out = kept.join(' ').trim();
  return out || insight;
}

/**
 * Reading the user's GRAMMAR as evidence about their feelings.
 *
 * Measured 2026-08-02, the worst single line the sim has produced. Someone
 * wrote six words — "퇴사하고 여행이나 갈까" — and Argus answered:
 *
 *   "'이나'가 붙은 거, 그냥 탈출하고 싶다는 말처럼 들려요."
 *
 * It analysed their PARTICLE and returned a psychological state they had never
 * named. The independent judge scored three separate H failures on that one
 * sentence (route_fit, ownership, fact_lineage) — H being "제품 정체성을 직접
 * 훼손". It is the manufactured-meaning trap in its purest form: a person's
 * choice of ending is not a confession, and telling someone what their word
 * choice reveals about them is the one thing the spine forbids outright.
 *
 * SILENCE IS NOT DATA already says what they did NOT say carries no meaning.
 * This is its twin, and the sharper of the two: HOW they said it carries none
 * either.
 *
 * Only the mechanically certain half is clamped here — a sentence that points
 * at the user's own wording as its evidence. The other half (naming an inner
 * state they never named) is semantic and lives in the prompt, where it can be
 * measured rather than guessed at.
 */
/**
 * ── The English branch, and why it was worth nothing ────────────────────────
 *
 * Measured 2026-08-03: of ten English sentences of exactly this violation, this
 * guard caught two. Both catches were the two shapes someone had already
 * imagined while writing the alternation; every shape an English speaker
 * actually reaches for went straight through. The other guards in this file
 * scored the same way, and one had no English clause at all.
 *
 * The mechanism is the LLM-glue invariant aimed at our own guards: a regex that
 * cannot fire is indistinguishable from a regex with nothing to catch. Same code
 * path, same green suite, same silence — so an unguarded English session looked
 * exactly like a well-guarded one.
 *
 * The rule underneath is one clause: a sentence whose EVIDENCE is the user's own
 * utterance. Encoded as (their utterance) followed by (an inference verb) inside
 * one sentence, which is narrower than either half alone. That matters here —
 * "you said X matters more than Y" is the user's own ranking being quoted back,
 * which the contract explicitly protects (AND WHEN THEY DO SAY IT, IT STANDS),
 * so the naming-a-word half requires an actual quoted fragment.
 */
const EN_UTTERANCE = '(the way|how) you (put|said|phrased|worded|framed|described|wrote)'
  + '|your (tone|phrasing|wording|language|framing|word choice|choice of words)'
  + '|the fact that you (led|started|opened|began) with';

const WORD_CHOICE_READING = new RegExp(
  // '이나'가 붙은 거 / "여행이나"라고 쓰신 걸 보면 / 그 표현을 보면
  '[\'"“”‘’][^\'"“”‘’]{1,20}[\'"“”‘’]\\s*(가|이|을|를|라고|이라고)?\\s*(붙|쓰|적|말씀|하신|한 것|한 거)'
  + '|(표현|말투|단어|어투|말씨|어감|뉘앙스)\\s*(을|를|이|가|에서)?\\s*보면'
  + '|(표현|말투|단어|어투|말씨|어감|뉘앙스)(을|를|이|가)?\\s*(쓰신|고르신|택하신|선택하신)'
  + '|라고\\s*(하신|쓰신|말씀하신)\\s*(거|것|걸|점)'
  // Their utterance, named as such. Always the violation — there is no honest
  // reading of someone's tone.
  + `|\\b(${EN_UTTERANCE})\\b`
  // Their utterance, QUOTED, followed by what it supposedly shows. The quote is
  // required: without it "you said the offer matters more" — them, being quoted
  // — would be deleted as if Argus had said it.
  + '|\\b(you (said|wrote|used|chose)|the (word|phrase|term|expression)|that)\\s*'
  + '[\'"“”‘’][^\'"“”‘’]{1,24}[\'"“”‘’][^.!?…\\n]*'
  + '\\b(read|reads|sound|sounds|suggest|suggests|tell|tells|say|says|mean|means'
  + '|reveal|reveals|matter|matters|instead of|rather than|is doing|at the (end|start|beginning))\\b'
  // "Calling it a break rather than quitting says something."
  + '|\\bcalling it\\b[^.!?…\\n]*\\b(rather than|instead of)\\b',
  'i',
);

/**
 * Drop any sentence whose evidence is the user's own phrasing.
 *
 * Returns '' when nothing survives, rather than falling back to the original.
 * `stripUnearnedRanking` keeps the original in that case on purpose — a ranked
 * sentence is still mostly about the decision. A sentence reading someone's
 * grammar is ENTIRELY the violation, so handing it back would defeat the guard,
 * and the caller decides what an honest empty means on its route.
 */
export function stripWordChoiceReading(insight: string | undefined): string {
  if (!insight) return '';
  return insight
    .split(/(?<=[.!?…])\s+/)
    .filter((s) => !WORD_CHOICE_READING.test(s))
    .join(' ')
    .trim();
}

/**
 * Telling someone their question is not their question.
 *
 * Measured 2026-08-02, unanimous H across three independent judge runs — the
 * only unanimous H the sim has produced. A team lead wrote "내보내야 하나
 * 고민입니다" and after one answer Argus replied:
 *
 *   "'내보낼지'를 고민하는 게 아니라, 다음 주 기한 결과를 보고 어떻게 할지
 *    판단하는 순서가 이미 설계되어 있는 거예요."
 *
 * That is the frame taken. Rule 8 of the judgment contract — "do not replace
 * their question with a grander one" — and rule 9 of the synthesis contract,
 * which bans "진짜 질문" outright, both forbid it. But rule 9 was only ever
 * enforced on the receipt, and this sentence is an insight on round 2, where
 * nothing looked.
 *
 * The detectable shape is narrow on purpose. "A가 아니라 B" is ordinary Korean
 * and usually about the world ("호가가 아니라 실제 가격이 핵심이에요" is fine).
 * What is never fine is negating the user's own act of deciding: nobody may
 * tell a person they are not deliberating about the thing they said they are
 * deliberating about.
 */
const FRAME_SEIZURE = new RegExp(
  // Two shapes, both narrow. Nominalised — "고민하는 게 아니라" — and
  // subject-negated — "질문이 그게 아니라". In the second the particle has to
  // sit directly on the noun, so "선택지가 두 개가 아니라" (an ordinary factual
  // correction) does not match.
  '(고민|질문|결정|선택|판단|묻고|정하)[가-힣]*\\s*(게|것이|것도|문제가|문제는|일이)\\s*아니라'
  + '|(고민|질문|결정|선택|판단)(이|가|은|는)\\s*[가-힣\\s]{0,6}아니라'
  // '내보낼지'를 …하는 게 아니라 — their own word, quoted and then denied
  + '|[\'"“”‘’][^\'"“”‘’]{1,24}[\'"“”‘’]\\s*(을|를|이|가|은|는)?\\s*[가-힣\\s]{0,12}아니라'
  // the frame seized by naming itself
  + '|(진짜|사실|핵심|본질적인|실제)\\s*(질문|문제|고민)(은|는|이)'
  // ── English. The three clauses that used to live here matched CONTRACTIONS
  // ONLY — `you.?re`, `it.?s` — so "What you are actually deciding is when" and
  // "It is not really about the money" both sailed past, and careful prose is
  // exactly where a model stops contracting. Measured 2026-08-03: one of nine.
  //
  // Every shape below negates the user's own act of deciding, or renames what
  // they said they were deciding about. Ordinary factual correction is not in
  // here: "The number in the letter is gross, not net" must survive, which is
  // why `not` alone is never enough — it has to attach to their question.
  + '|\\bthe (real|actual|deeper|underlying|bigger|true|core) '
  + '(question|issue|problem|decision|choice|thing)\\b'
  + '|\\bwhat you(\'|’|\\s+a)?re (actually|really|truly) '
  + '(deciding|asking|choosing|weighing|facing)\\b'
  + '|\\b(it|this|that)(\'|’)?s? (is )?not (really |actually )?(a question )?about\\b'
  + '|\\byou(\'|’|\\s+a)?re not (choosing|deciding|asking|weighing)\\b'
  + '|\\bthe (question|decision|choice) (is|\'s|’s) not\\b'
  + '|\\bunderneath (that|this|your) (question|decision|problem|choice)\\b'
  + '|\\byou think (this|that|it) is about\\b[^.!?…\\n]*\\bbut\\b',
  'i',
);

/**
 * Drop any sentence that redefines what the user said they are deciding.
 *
 * Returns '' when nothing survives — same reasoning as stripWordChoiceReading:
 * a sentence of this shape is entirely the violation, so handing it back would
 * defeat the guard, and the caller substitutes the user's own frame.
 */
export function stripFrameSeizure(insight: string | undefined): string {
  if (!insight) return '';
  return insight
    .split(/(?<=[.!?…])\s+/)
    .filter((s) => !FRAME_SEIZURE.test(s))
    .join(' ')
    .trim();
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
