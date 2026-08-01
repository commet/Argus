/**
 * Is this sentence a CLAIM about the user's decision, or their own sentence
 * handed back to them?
 *
 * PURE AND DEPENDENCY-FREE ON PURPOSE. This file is copied byte-for-byte into
 * argus-mcp/src/lib/ (guarded by premises-core-drift.test.ts) because an agent
 * in a terminal makes exactly the same move a model in the browser does — it
 * records the user's own words as a premise — and a rule that lives in one
 * surface is not a rule, it is a coincidence.
 *
 * Everything here answers one question with no state, no I/O and no model:
 * given a proposed sentence and the quote it claims to rest on, what is it?
 */

export function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function comparable(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function isTraceableQuote(quote: string, userText: string): boolean {
  const needle = comparable(quote);
  const haystack = comparable(userText);
  return needle.length > 0 && haystack.includes(needle);
}

export const SUPPORT_KINDS = new Set([
  'explicit_reason',
  'explicit_condition',
  'explicit_expectation',
]);

/**
 * High-precision lexical floor for explicit decision support. This deliberately
 * prefers dropping a subtle valid premise over promoting a merely mentioned
 * fact. Semantic validation remains probabilistic; this is only the structural
 * minimum that a claimed "explicit" link must clear.
 */
export function hasExplicitSupportSignal(text: string): boolean {
  const normalized = comparable(text);
  // Two families, both the user's own stance rather than a bare fact:
  //  - causal/conditional ("때문에", "…라면"), and
  //  - declared weight ("걸려요", "부담이에요", "포기해야") — measured addition:
  //    the v3 sim rejected "물어보니 런웨이는 18개월 정도래요" as an anchor even
  //    though the user volunteered it as what they had gone and checked.
  return /(때문|그래서|이라서|라서|으니까|니까|다면|라면|하면|이면|전제|기대|믿|것 같|거라|될 것|할 것|중요|기준|우선순위|우선|걸리|걸려|부담|불안|포기|조건|원하|바라)|\b(because|since|if|unless|expect|assume|believe|count on|depend|rely|matters?|important|likely|probably|worried|worries|concern|prefer|priority|trade-?off|give up)\b/i
    .test(normalized);
}

// ── The claim band ──────────────────────────────────────────────────────────
//
// A premise must live between echo and non-sequitur. Too close to its anchor
// and it is the user's own sentence handed back with "가정" written on it; too
// far and it is an invention wearing a quote.
//
// Only the near edge is enforced, because only the near edge has been measured
// failing (6 of the 11 items collected in the 2026-08-01 census were bare
// facts). The far edge is recorded in the audit as `anchor_overlap` so a later
// census can say whether it fails in practice — a guard nobody has seen fire is
// a guess, and guesses do not get to reject a user's premise.

/** Function words and bare classifiers carry no lexical content, so counting
 *  them would let "그 사람의 그 상황" read as novel material. */
export const STOP_TOKENS = new Set([
  '그', '이', '저', '것', '수', '때', '등', '및', '더', '좀', '잘', '안', '못', '또',
  '나', '너', '내', '제', '저희', '우리', '거', '게', '건', '점', '분', '중', '후', '전',
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'is', 'are',
  'be', 'been', 'that', 'this', 'it', 'as', 'for', 'with', 'my', 'i', 'we', 'they',
  // Slot names. "런웨이가 18개월이라는 전제" is the anchor with the word
  // "전제" stapled on — the model naming the box it is filling, which the
  // harness prompt already calls out (✗ "같은 사실에 이름만 붙인 것"). Left
  // countable, these words were enough novelty to pass a restatement as a claim.
  '전제', '가정', '조건', '변수', '요인', '리스크', '이슈', '지점', '부분', '측면',
  '상황', '상태', '포인트', '문제', '사실', '얘기', '이야기',
  'premise', 'assumption', 'condition', 'factor', 'risk', 'issue', 'point',
  'situation', 'state', 'aspect', 'thing', 'fact',
]);

/**
 * Does this sentence make a claim about the USER'S inner weighting — what
 * matters to them, what they believe, what weighs on them?
 *
 * Rule 4 of the judgment contract says not to attribute a belief to the user,
 * and MENTIONING IS NOT MATTERING calls the inference "the single most-measured
 * failure of this harness". Both were prompt-only, and both leaked: the sim
 * produced "런웨이 18개월이 판단에 걸리는 조건이다" and "리드 승진 가능성을 높게
 * 보고 있다는 전제" from users who had said neither.
 *
 * A sentence like that is a STANDARD by content, whatever the model labelled
 * it — so it inherits the standard's gate and must show the user's own weighing
 * word in the quote. Deliberately narrow: only verbs that are unambiguously
 * about someone's inner state, because the penalty for a false positive is a
 * rejected premise.
 */
const STANCE_CLAIM = new RegExp(
  '(마음에\\s*걸리|걸리는|걸려\\s*하|무겁|부담|불안|신경\\s*(쓰|써)'
  + '|중요하|중시|우선순위|기준이다|기준이\\s*(된|되)'
  + '|높게\\s*보|크게\\s*보|낮게\\s*보|중요하게\\s*보'
  + '|보고\\s*있|생각하고\\s*있|믿고\\s*있|기대하고\\s*있|여기고\\s*있|여긴다)'
  + '|\\b(matters? to|weighs? on|cares? (most )?about|believes?|expects?|values?|prioriti[sz]es?)\\b',
  'i',
);

export function attributesStanceToUser(text: string): boolean {
  return STANCE_CLAIM.test(comparable(text));
}

/** Hangul agglutinates, so "계획을" and "계획은" are the same word with
 *  different josa. Two syllables is where the lexical content sits; Latin needs
 *  four characters before a prefix stops being a coincidence. */
function stemToken(token: string): string {
  return /[가-힣]/.test(token) ? token.slice(0, 2) : token.slice(0, 4);
}

function contentStems(text: string): string[] {
  const stems = comparable(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0 && !STOP_TOKENS.has(token))
    .map(stemToken);
  return [...new Set(stems)];
}

export interface ClaimBand {
  /** Share of the text's content words absent from the anchor. */
  novelty: number;
  /** How many content words it shares with the anchor — recorded, not gated. */
  anchor_overlap: number;
  novel_count: number;
}

/** Below this the text is the anchor rephrased. Chosen from the three measured
 *  cases: the restatements scored 0.00 and 0.10, the real premise 0.50. */
const CLAIM_NOVELTY_FLOOR = 0.34;
/** One novel word is a synonym swap, not a claim. */
const CLAIM_NOVEL_TOKENS_FLOOR = 2;

export function claimBand(text: string, anchorQuote: string): ClaimBand {
  const stems = contentStems(text);
  const anchor = new Set(contentStems(anchorQuote));
  if (stems.length === 0) return { novelty: 0, anchor_overlap: 0, novel_count: 0 };
  const novel = stems.filter((s) => !anchor.has(s));
  return {
    novelty: novel.length / stems.length,
    anchor_overlap: stems.length - novel.length,
    novel_count: novel.length,
  };
}

/**
 * Hedges. A sentence carrying one is not yet answerable by anything — "집주인이
 * 올려달라고 할 것 같기도 하고요" cannot be right or wrong, so it can never
 * settle and never teach.
 */
const HEDGE = /것\s*같|듯|아마|싶은|싶어|지\s*않을까|할지도|모르겠|같기도|생각도\s*들|\b(maybe|might|probably|possibly|seems?|i think|not sure|could be)\b/i;

/**
 * Did the text take the user's hedge off?
 *
 * This is the second way to go beyond a quote, and the one a word-count cannot
 * see. Turning "올려달라고 할 것 같기도 하고요" into "올려달라고 할 것이다"
 * adds no vocabulary and adds the only thing that matters: the sentence becomes
 * something reality can answer. Measured — heavy-03 proposed exactly that,
 * with a counterfactual and a concrete observable attached, and the lexical
 * band demoted the best item of the run to a bare fact.
 *
 * The claim has to be the HARDENED one; a text that keeps the hedge has done
 * nothing but move it.
 */
export function hardensAHedge(text: string, anchorQuote: string): boolean {
  return HEDGE.test(comparable(anchorQuote)) && !HEDGE.test(comparable(text));
}

/**
 * True when the text goes beyond its anchor far enough to be a claim rather
 * than a restatement — either lexically (it says new things) or modally (it
 * says the same thing in a form that can turn out false).
 */
export function statesAClaim(text: string, anchorQuote: string): boolean {
  const band = claimBand(text, anchorQuote);
  const lexical = band.novelty >= CLAIM_NOVELTY_FLOOR && band.novel_count >= CLAIM_NOVEL_TOKENS_FLOOR;
  return lexical || hardensAHedge(text, anchorQuote);
}
