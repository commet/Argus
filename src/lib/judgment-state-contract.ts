/**
 * Structural contract for AI-surfaced premises.
 *
 * The model may propose a premise, but only a premise traceable to the user's
 * own words can enter the living judgment state. The persisted snapshot stays
 * string[] for backward compatibility; this module keeps the richer proposal
 * and transition audit at the engine boundary.
 *
 * ── One gate for five things was the bug ────────────────────────────────────
 * Until 2026-08-02 every proposal faced the same three tests regardless of what
 * it claimed to be. That single gate failed in both directions at once, and the
 * sim showed both failures inside one session (heavy-04):
 *
 *   over-reject  the sharpest premise of the run — "면담과 계획을 두 차례
 *                거쳤는데도 변화가 없었다면, 지금 방법으로는 달라지지 않는다" —
 *                was dropped because its anchor lacked a Korean connective,
 *                while the emotional standard beside it sailed through.
 *   under-reject "문서로 남긴 두 번째 개선 계획의 기한이 다음 주에 끝난다" was
 *                admitted as a premise. It is a sentence the user had just
 *                finished saying. The judge caught it independently:
 *                "이미 확인된 사실을 전제 칸에 반복 기재한 거예요."
 *
 * The gates now come from KIND_POLICY, because the kinds have different
 * truth-conditions. A premise earns entry by saying something its anchor does
 * NOT already say; a standard earns entry by staying inside the user's own
 * weighing words. Both still need lineage — that test was never the problem.
 */

import { asKind, policyFor, type PremiseKind } from '@/lib/decisive-premises';

export type { PremiseKind };

export interface PremiseCandidate {
  text: string;
  anchor_quote: string;
  support_kind: 'explicit_reason' | 'explicit_condition' | 'explicit_expectation';
  if_false_changes: string;
  kind?: PremiseKind;
  observable?: string;
}

export interface PremiseDelta {
  action: 'keep' | 'add' | 'remove' | 'revise';
  previous_text?: string;
  text?: string;
  anchor_quote?: string;
  reason_from_latest_answer?: string;
  support_kind?: PremiseCandidate['support_kind'];
  if_false_changes?: string;
}

export interface PremiseAuditEntry {
  accepted: boolean;
  action: 'initial' | PremiseDelta['action'];
  text?: string;
  previous_text?: string;
  reason: string;
  /** What the model called it, and what it was actually recorded as. Equal on
   *  the ordinary path; different means the contract reclassified it, which is
   *  the single most useful thing a census can count. */
  declared_kind?: PremiseKind;
  recorded_kind?: PremiseKind;
  /** How far the text travelled from its anchor. Kept on every entry so the
   *  far edge of the claim band can be measured before anything gates on it. */
  band?: ClaimBand;
}

export interface PremiseContractResult {
  /**
   * Legacy projection, for every consumer that predates records — and every one
   * of them renders it under the words "확인할 가정 / assumptions to verify".
   * So it carries ONLY the kinds that are actually assumptions. A fact listed
   * there is Argus asking someone to go verify a sentence they just wrote.
   */
  premises: string[];
  /** Everything admitted, in order, with the lineage that let it in. Facts and
   *  standards live here and nowhere else. */
  records: AdmittedPremise[];
  audit: PremiseAuditEntry[];
}

/** The narrowing that defines `premises`, in one place so no caller re-derives
 *  it slightly differently. */
export function checkableTexts(records: AdmittedPremise[]): string[] {
  return records.filter((r) => policyFor(r.kind).competes).map((r) => r.text);
}

/** An admitted premise and the evidence that let it in. Mirrors PremiseRecord
 *  in stores/types.ts; kept structural here so this file stays import-light. */
export interface AdmittedPremise {
  text: string;
  anchor_quote: string;
  if_false_changes: string;
  support_kind: PremiseCandidate['support_kind'];
  kind: PremiseKind;
  observable?: string;
  /** Set by the USER only, later, and never present on model output — the
   *  runtime strips it (see stripModelOnly). Whether being wrong here would
   *  have moved this particular person is a fact about them. */
  decisive?: 'flips' | 'holds';
}

/**
 * A model may describe consequences; it may not decide what matters to someone.
 * `decisive` is the user's answer to "이게 틀렸다면 다른 선택을 하셨을까요?", so
 * anything arriving under that key from a model is dropped rather than trusted —
 * a fail-closed boundary, not a lint.
 */
function stripModelOnly<T extends Record<string, unknown>>(item: T | null): T | null {
  if (!item) return item;
  if ('decisive' in item) {
    const { decisive: _ignored, ...rest } = item;
    void _ignored;
    return rest as T;
  }
  return item;
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
const STOP_TOKENS = new Set([
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

/** True when the text goes beyond its anchor far enough to be a claim rather
 *  than a restatement of something the user already said. */
export function statesAClaim(text: string, anchorQuote: string): boolean {
  const band = claimBand(text, anchorQuote);
  return band.novelty >= CLAIM_NOVELTY_FLOOR && band.novel_count >= CLAIM_NOVEL_TOKENS_FLOOR;
}

interface SynthesisSectionLike {
  heading?: string;
}

/**
 * The synthesis model may phrase the receipt, but it may not create new state.
 * Premises and actions come only from the last accepted living projection.
 * Until open threads have their own typed ledger, "unverified" sections have
 * no trustworthy source and are omitted when the living state has none.
 */
export function clampSynthesisToLivingState<
  S extends SynthesisSectionLike,
  T extends {
    sections?: S[];
    key_assumptions?: string[];
    next_steps?: string[];
  },
>(
  result: T,
  living: {
    hidden_assumptions?: string[];
    premise_records?: { text: string; if_false_changes?: string; kind?: string }[];
    skeleton?: string[];
  } | null | undefined,
): T {
  const records = (living?.premise_records || []).filter(Boolean);

  // key_assumptions is what the receipt calls ASSUMPTIONS, so a fact or a
  // standard listed there is the receipt lying about its own contents. When
  // typed records exist they are the authority; the string list is the fallback
  // for snapshots written before kinds existed.
  const assumptions = records.length > 0
    ? records.filter((r) => policyFor(r.kind).competes).map((r) => cleanText(r.text))
      .filter((text) => text.length > 0)
    : (living?.hidden_assumptions || [])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => cleanText(item));

  // What to check next is not invented — it is the counterfactual each premise
  // already carries ("이게 틀리면 무엇이 달라지는가"), which the premise contract
  // validated on the way in. So the receipt can name checks WITHOUT a second
  // source of truth: at most one per premise, and none when there are none.
  // Only a kind reality can settle earns a check: telling someone to go verify
  // a fact they supplied, or to verify their own standard, is the receipt
  // inventing homework.
  const checkableCount = records
    .filter((r) => policyFor(r.kind).verifiable && cleanText(r.if_false_changes).length > 0).length;
  const modelSteps = (result.next_steps || [])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => cleanText(item));
  const nextSteps = modelSteps.slice(0, checkableCount);

  // Two different jobs, two different sources — folding them into one regex
  // meant an empty premise list also deleted the reality-check section, and a
  // session WITH premises kept a reality-check section nothing grounded.
  const assumptionHeading =
    /(전제|가정|아직.*(?:확인|모르)|확인되지|assumptions?|unverified|unknown)/i;
  const realityCheckHeading =
    /(현실.*확인|확인할\s*것|reality checks?|to verify)/i;
  const actionHeading =
    /(다음\s*(?:단계|행동)|행동\s*계획|실행\s*계획|next steps?|action plans?|execution plans?)/i;

  return {
    ...result,
    sections: (result.sections || []).filter((section) => {
      const heading = cleanText(section?.heading);
      if (assumptions.length === 0 && assumptionHeading.test(heading)) return false;
      if (nextSteps.length === 0 && (realityCheckHeading.test(heading) || actionHeading.test(heading))) return false;
      return true;
    }),
    key_assumptions: assumptions,
    next_steps: nextSteps,
  };
}

/** "Never stack premises" — but only the kinds that make a CLAIM stack. A fact
 *  occupying one of the two slots is a pure loss: it evicts something the user
 *  could still be wrong about in favour of something they cannot. */
const MAX_CLAIMS = 2;
/** Everything else is context, and context still has to fit on a card. */
const MAX_RECORDS = 4;

function claimCount(records: AdmittedPremise[]): number {
  return records.filter((r) => policyFor(r.kind).competes).length;
}

interface KindGate {
  ok: boolean;
  kind: PremiseKind;
  reason: string;
  band: ClaimBand;
}

/**
 * The per-kind door. Lineage is checked before this (it applies to everything);
 * what remains is the test each kind's own truth-conditions require.
 *
 * Two different outcomes on purpose:
 *   reject   — the item would misattribute something to the user. A standard
 *              with no weighing word in the quote says "this is what matters to
 *              you" on their behalf, and calling it a fact instead would only
 *              launder the attribution into their voice.
 *   reclass  — the item is real but mislabelled. A text that restates its own
 *              anchor IS a fact, accurately and by construction, so it is
 *              recorded as one: named in the audit, shown honestly on screen,
 *              and no longer competing for a premise slot.
 */
function gateByKind(
  declared: unknown,
  text: string,
  anchorQuote: string,
  /** True when the anchor was lifted from the answer the user just gave to a
   *  decision-shaping question. There the act of answering IS the stance — they
   *  were asked what bears on the call and this is what they wrote. Demanding a
   *  connective on top of it rejected 100% of real premises in the live run. */
  stanceFromContext = false,
): KindGate {
  // What the sentence DOES outranks what the model called it. A text asserting
  // that something weighs on this person is a standard however it was labelled,
  // and it must clear the standard's gate rather than the premise's.
  const kind = attributesStanceToUser(text) ? 'standard' : asKind(declared);
  const policy = policyFor(kind);
  const band = claimBand(text, anchorQuote);

  if (policy.needsStance && !stanceFromContext && !hasExplicitSupportSignal(anchorQuote)) {
    return { ok: false, kind, reason: 'standard_without_user_stance', band };
  }
  if (policy.needsClaim && !statesAClaim(text, anchorQuote)) {
    return { ok: true, kind: 'fact', reason: 'restates_anchor_recorded_as_fact', band };
  }
  return { ok: true, kind, reason: 'grounded', band };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function comparable(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function isTraceableQuote(quote: string, userText: string): boolean {
  const needle = comparable(quote);
  const haystack = comparable(userText);
  return needle.length > 0 && haystack.includes(needle);
}

const SUPPORT_KINDS = new Set([
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
function hasExplicitSupportSignal(text: string): boolean {
  const normalized = comparable(text);
  // Two families, both the user's own stance rather than a bare fact:
  //  - causal/conditional ("때문에", "…라면"), and
  //  - declared weight ("걸려요", "부담이에요", "포기해야") — measured addition:
  //    the v3 sim rejected "물어보니 런웨이는 18개월 정도래요" as an anchor even
  //    though the user volunteered it as what they had gone and checked.
  return /(때문|그래서|이라서|라서|으니까|니까|다면|라면|하면|이면|전제|기대|믿|것 같|거라|될 것|할 것|중요|기준|우선순위|우선|걸리|걸려|부담|불안|포기|조건|원하|바라)|\b(because|since|if|unless|expect|assume|believe|count on|depend|rely|matters?|important|likely|probably|worried|worries|concern|prefer|priority|trade-?off|give up)\b/i
    .test(normalized);
}

function findExisting(premises: string[], candidate: string): number {
  const target = comparable(candidate);
  return premises.findIndex((premise) => comparable(premise) === target);
}

export function coercePremiseCandidates(
  raw: unknown,
  userCorpus: string,
): PremiseContractResult {
  const records: AdmittedPremise[] = [];
  const audit: PremiseAuditEntry[] = [];
  const candidates = Array.isArray(raw) ? raw : [];

  for (const value of candidates) {
    const item = stripModelOnly(asRecord(value));
    const text = cleanText(item?.text);
    const anchorQuote = cleanText(item?.anchor_quote);
    const supportKind = cleanText(item?.support_kind);
    const ifFalseChanges = cleanText(item?.if_false_changes);

    if (!text || !anchorQuote || !ifFalseChanges || !SUPPORT_KINDS.has(supportKind)) {
      audit.push({
        accepted: false,
        action: 'initial',
        text: text || undefined,
        reason: 'missing_required_field',
      });
      continue;
    }
    if (!isTraceableQuote(anchorQuote, userCorpus)) {
      audit.push({
        accepted: false,
        action: 'initial',
        text,
        reason: 'anchor_not_in_user_words',
      });
      continue;
    }
    const gate = gateByKind(item?.kind, text, anchorQuote);
    const entry = {
      action: 'initial' as const,
      text,
      declared_kind: asKind(item?.kind),
      recorded_kind: gate.kind,
      band: gate.band,
    };
    if (!gate.ok) {
      audit.push({ ...entry, accepted: false, reason: gate.reason });
      continue;
    }
    if (findExisting(records.map((r) => r.text), text) >= 0) {
      audit.push({ ...entry, accepted: false, reason: 'duplicate' });
      continue;
    }
    if (policyFor(gate.kind).competes && claimCount(records) >= MAX_CLAIMS) {
      audit.push({ ...entry, accepted: false, reason: 'premise_limit' });
      continue;
    }
    if (records.length >= MAX_RECORDS) {
      audit.push({ ...entry, accepted: false, reason: 'record_limit' });
      continue;
    }

    records.push({
      text,
      anchor_quote: anchorQuote,
      if_false_changes: ifFalseChanges,
      support_kind: supportKind as PremiseCandidate['support_kind'],
      kind: gate.kind,
      ...(cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}),
    });
    audit.push({ ...entry, accepted: true, reason: gate.reason });
  }

  return { premises: checkableTexts(records), records, audit };
}

export function applyPremiseDeltas(
  /** Records carry lineage; bare strings are accepted so snapshots written
   *  before 2026-08-01 (and any legacy caller) keep working. */
  currentRecords: Array<AdmittedPremise | string>,
  raw: unknown,
  fullUserCorpus: string,
  latestAnswer: string,
): PremiseContractResult {
  const records = (currentRecords || [])
    .map((entry): AdmittedPremise | null => {
      if (typeof entry === 'string') {
        return entry.trim()
          ? { text: cleanText(entry), anchor_quote: '', if_false_changes: '', support_kind: 'explicit_reason', kind: 'premise' as const }
          : null;
      }
      return entry && typeof entry.text === 'string' && entry.text.trim()
        ? { ...entry, text: cleanText(entry.text) }
        : null;
    })
    .filter((r): r is AdmittedPremise => r !== null)
    .slice(0, MAX_RECORDS);
  const premises = records.map((r) => r.text);
  const audit: PremiseAuditEntry[] = [];
  const deltas = Array.isArray(raw) ? raw : [];

  for (const value of deltas) {
    const item = stripModelOnly(asRecord(value));
    const action = cleanText(item?.action) as PremiseDelta['action'];
    const previousText = cleanText(item?.previous_text);
    const text = cleanText(item?.text);
    const anchorQuote = cleanText(item?.anchor_quote);
    const reason = cleanText(item?.reason_from_latest_answer);
    const supportKind = cleanText(item?.support_kind);
    const ifFalseChanges = cleanText(item?.if_false_changes);

    if (!['keep', 'add', 'remove', 'revise'].includes(action)) {
      audit.push({ accepted: false, action: 'keep', reason: 'invalid_action' });
      continue;
    }

    if (action === 'keep') {
      const target = previousText || text;
      const existingIndex = findExisting(premises, target);
      audit.push({
        accepted: existingIndex >= 0,
        action,
        previous_text: target || undefined,
        reason: existingIndex >= 0 ? 'preserved' : 'premise_not_found',
      });
      continue;
    }

    if (action === 'add') {
      if (!text || !anchorQuote || !ifFalseChanges || !SUPPORT_KINDS.has(supportKind)) {
        audit.push({ accepted: false, action, text: text || undefined, reason: 'missing_required_field' });
        continue;
      }
      if (!isTraceableQuote(anchorQuote, fullUserCorpus)) {
        audit.push({ accepted: false, action, text, reason: 'anchor_not_in_user_words' });
        continue;
      }
      // An anchor pulled from OLDER narration is the user describing, where any
      // sentence could be lifted at random; one pulled from the answer they
      // just gave carries its own stance (see gateByKind).
      const gate = gateByKind(
        item?.kind,
        text,
        anchorQuote,
        isTraceableQuote(anchorQuote, latestAnswer),
      );
      const entry = {
        action,
        text,
        declared_kind: asKind(item?.kind),
        recorded_kind: gate.kind,
        band: gate.band,
      };
      if (!gate.ok) {
        audit.push({ ...entry, accepted: false, reason: gate.reason });
        continue;
      }
      if (findExisting(premises, text) >= 0) {
        audit.push({ ...entry, accepted: false, reason: 'duplicate' });
        continue;
      }
      if (policyFor(gate.kind).competes && claimCount(records) >= MAX_CLAIMS) {
        audit.push({ ...entry, accepted: false, reason: 'premise_limit' });
        continue;
      }
      if (records.length >= MAX_RECORDS) {
        audit.push({ ...entry, accepted: false, reason: 'record_limit' });
        continue;
      }
      records.push({
        text,
        anchor_quote: anchorQuote,
        if_false_changes: ifFalseChanges,
        support_kind: supportKind as PremiseCandidate['support_kind'],
        kind: gate.kind,
        ...(cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}),
      });
      premises.push(text);
      audit.push({ ...entry, accepted: true, reason: gate.reason });
      continue;
    }

    const existingIndex = findExisting(premises, previousText);
    if (existingIndex < 0) {
      audit.push({
        accepted: false,
        action,
        previous_text: previousText || undefined,
        text: text || undefined,
        reason: 'premise_not_found',
      });
      continue;
    }
    if (!reason || !anchorQuote || !isTraceableQuote(anchorQuote, latestAnswer)) {
      audit.push({
        accepted: false,
        action,
        previous_text: previousText,
        text: text || undefined,
        reason: 'latest_answer_evidence_missing',
      });
      continue;
    }

    if (action === 'remove') {
      records.splice(existingIndex, 1);
      premises.splice(existingIndex, 1);
      audit.push({ accepted: true, action, previous_text: previousText, reason: 'latest_answer_grounded' });
      continue;
    }

    // A revise/remove anchor is already required to come from the latest answer
    // (checked above), so the same reasoning applies: no connective demanded.
    if (!text || !ifFalseChanges || !SUPPORT_KINDS.has(supportKind)) {
      audit.push({
        accepted: false,
        action,
        previous_text: previousText,
        text: text || undefined,
        reason: 'missing_required_field',
      });
      continue;
    }
    const duplicateIndex = findExisting(premises, text);
    if (duplicateIndex >= 0 && duplicateIndex !== existingIndex) {
      audit.push({ accepted: false, action, previous_text: previousText, text, reason: 'duplicate' });
      continue;
    }

    // A revise anchor is already required to come from the latest answer, so
    // its stance is supplied by the act of answering.
    const revised = gateByKind(item?.kind, text, anchorQuote, true);
    records[existingIndex] = {
      text,
      anchor_quote: anchorQuote,
      if_false_changes: ifFalseChanges,
      support_kind: supportKind as PremiseCandidate['support_kind'],
      kind: revised.kind,
      ...(cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}),
    };
    premises[existingIndex] = text;
    audit.push({
      accepted: true,
      action,
      previous_text: previousText,
      text,
      declared_kind: asKind(item?.kind),
      recorded_kind: revised.kind,
      band: revised.band,
      reason: 'latest_answer_grounded',
    });
  }

  const kept = records.slice(0, MAX_RECORDS);
  return { premises: checkableTexts(kept), records: kept, audit };
}
