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

import { KIND_POLICY, asKind, policyFor, type PremiseKind } from './decisive-premises';
import {
  type ClaimBand,
  attributesStanceToUser,
  claimBand,
  cleanText,
  comparable,
  hardensAHedge,
  hasExplicitSupportSignal,
  isTraceableQuote,
  SUPPORT_KINDS,
  statesAClaim,
} from './premise-claim';

export {
  attributesStanceToUser,
  claimBand,
  hardensAHedge,
  statesAClaim,
  type ClaimBand,
};

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
  /**
   * The sentence this one replaced, when an accepted `revise` rewrote it.
   *
   * Without it a revision is unreconstructable downstream: a reader comparing
   * two snapshots sees one text absent and another present, and set difference
   * cannot tell "their answer sharpened this" from "one died, one was born".
   * The card rendered the first as the second — the old sentence struck through
   * in red — so the most encouraging thing this product can show a person was
   * displayed as a deletion.
   *
   * Written by the runtime from the record it actually overwrote, never from
   * the model's `previous_text` (which is only a lookup key and may match
   * loosely) and never from model output at all — lineage the model asserted
   * would let it take credit for an answer that changed nothing.
   *
   * Durable, not per-turn. Whether it counts as "changed just now" is decided
   * by comparing against the previous snapshot, so a record revised three turns
   * ago keeps its lineage without claiming to be new.
   */
  revised_from?: string;
}

/**
 * A model may describe consequences; it may not decide what matters to someone,
 * and it may not narrate what its own proposal did to the record.
 *
 * `decisive` is the user's answer to "이게 틀렸다면 다른 선택을 하셨을까요?".
 * `revised_from` is the runtime's account of what a delta actually overwrote.
 * Both arriving under those keys from a model are dropped rather than trusted —
 * a fail-closed boundary, not a lint.
 */
const MODEL_MAY_NOT_SET = ['decisive', 'revised_from'] as const;

function stripModelOnly<T extends Record<string, unknown>>(item: T | null): T | null {
  if (!item) return item;
  if (!MODEL_MAY_NOT_SET.some((key) => key in item)) return item;
  const rest = { ...item };
  for (const key of MODEL_MAY_NOT_SET) delete rest[key];
  return rest as T;
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
  /** Present only when the model named what would be SEEN. A prediction owes
   *  this; nothing else does. */
  observable = '',
): KindGate {
  const band = claimBand(text, anchorQuote);

  // What the sentence DOES outranks what the model called it. A text asserting
  // that something weighs on this person is a standard however it was labelled,
  // and it must clear the standard's gate rather than the premise's.
  let kind = attributesStanceToUser(text) ? 'standard' : asKind(declared);

  if (KIND_POLICY[kind].needsStance) {
    return stanceFromContext || hasExplicitSupportSignal(anchorQuote)
      ? { ok: true, kind, reason: 'grounded', band }
      : { ok: false, kind, reason: 'standard_without_user_stance', band };
  }

  // A prediction with no way to check it is an assumption with a date on it, so
  // it is read as one rather than refused — and then has to clear that gate.
  let reason = 'grounded';
  if (KIND_POLICY[kind].needsObservable && !observable) {
    kind = 'premise';
    reason = 'prediction_without_observable_read_as_premise';
  }

  if (KIND_POLICY[kind].needsClaim && !statesAClaim(text, anchorQuote)) {
    return { ok: true, kind: 'fact', reason: 'restates_anchor_recorded_as_fact', band };
  }
  return { ok: true, kind, reason, band };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function findExisting(premises: string[], candidate: string): number {
  const target = comparable(candidate);
  return premises.findIndex((premise) => comparable(premise) === target);
}

/**
 * The fields a proposal owes, decided by what it says it is.
 *
 * Checked against the DECLARED kind, not the recorded one: the model committed
 * to a shape when it chose the label, and a premise offered with no consequence
 * is incomplete even if the contract would later have filed it as a fact.
 */
function missingRequiredField(
  declared: unknown,
  text: string,
  anchorQuote: string,
  supportKind: string,
  ifFalseChanges: string,
): boolean {
  if (!text || !anchorQuote) return true;
  const policy = policyFor(declared);
  if (policy.needsSupportKind && !SUPPORT_KINDS.has(supportKind)) return true;
  if (policy.needsCounterfactual && !ifFalseChanges) return true;
  return false;
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

    if (missingRequiredField(item?.kind, text, anchorQuote, supportKind, ifFalseChanges)) {
      audit.push({
        accepted: false,
        action: 'initial',
        text: text || undefined,
        declared_kind: asKind(item?.kind),
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
    const gate = gateByKind(item?.kind, text, anchorQuote, false, cleanText(item?.observable));
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
      support_kind: (SUPPORT_KINDS.has(supportKind) ? supportKind : 'explicit_reason') as PremiseCandidate['support_kind'],
      kind: gate.kind,
      ...(cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}),
    });
    audit.push({ ...entry, accepted: true, reason: gate.reason });
  }

  return { premises: checkableTexts(records), records, audit };
}

/**
 * The audit, reduced to what is worth telling the model next turn.
 *
 * A clean acceptance says nothing — silence is the reward. Only a demotion or a
 * refusal is carried, because those are the moves the model would otherwise
 * repeat unchanged: it has no way to know its proposal was filed as something
 * else, so on the next answer it makes the same one again. Measured in the
 * 2026-08-02 run: heavy-01 offered a verbatim copy of the user's answer as a
 * premise on round 2 after the same thing had already happened on round 1.
 */
export function verdictsWorthTelling(audit: PremiseAuditEntry[]): Array<{
  text: string;
  declared: PremiseKind;
  recorded?: PremiseKind;
  reason: string;
}> {
  return (audit || [])
    .filter((entry) => entry.text && entry.declared_kind
      && (!entry.accepted || entry.declared_kind !== entry.recorded_kind))
    .map((entry) => ({
      text: entry.text as string,
      declared: entry.declared_kind as PremiseKind,
      ...(entry.accepted ? { recorded: entry.recorded_kind } : {}),
      reason: entry.reason,
    }));
}

/**
 * What to DO about it, in one line, phrased as the next move rather than as a
 * complaint. The runtime is reporting an outcome that already happened — it is
 * not a critic, and a scolding tone buys nothing but hedging on the next turn.
 */
export function verdictInstruction(reason: string): string {
  switch (reason) {
    case 'restates_anchor_recorded_as_fact':
      return 'it repeats its own anchor, so it was filed as a fact. If it really is '
        + 'load-bearing, say what that fact makes possible or impossible in THIS '
        + 'decision. If you cannot, leaving it as a fact is the right outcome.';
    case 'standard_without_user_stance':
      return 'it states what weighs on this person, but the quote does not carry '
        + 'their own weighing words — so it was refused rather than put in their '
        + 'mouth. Ask them instead of asserting it.';
    case 'prediction_without_observable_read_as_premise':
      return 'no observable, so it cannot promise a settle date and was filed as an '
        + 'assumption. Name what would be SEEN and it can be a prediction.';
    case 'anchor_not_in_user_words':
      return 'the quote does not appear in anything they wrote. Quote exactly.';
    case 'premise_limit':
      return 'two assumptions are already open. Revise one instead of stacking a third.';
    case 'record_limit':
      return 'the record is full. Revise or remove before adding.';
    case 'duplicate':
      return 'already recorded.';
    case 'missing_required_field':
      return 'an add needs text, anchor_quote, support_kind and if_false_changes.';
    case 'latest_answer_evidence_missing':
      return 'a change to an existing item needs a quote from the answer they just gave.';
    default:
      return reason;
  }
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
      if (missingRequiredField(item?.kind, text, anchorQuote, supportKind, ifFalseChanges)) {
        audit.push({
          accepted: false, action, text: text || undefined,
          declared_kind: asKind(item?.kind), reason: 'missing_required_field',
        });
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
        cleanText(item?.observable),
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
        support_kind: (SUPPORT_KINDS.has(supportKind) ? supportKind : 'explicit_reason') as PremiseCandidate['support_kind'],
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
    if (missingRequiredField(item?.kind, text, anchorQuote, supportKind, ifFalseChanges)) {
      audit.push({
        accepted: false,
        action,
        previous_text: previousText,
        text: text || undefined,
        declared_kind: asKind(item?.kind),
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
    const revised = gateByKind(item?.kind, text, anchorQuote, true, cleanText(item?.observable));
    // The record that is about to be overwritten — not the model's
    // `previous_text`, which findExisting matched loosely and which may differ
    // from what is actually on file. Lineage has to name the sentence the
    // reader last saw, or the screen shows them a "before" they never read.
    const overwritten = records[existingIndex].text;
    records[existingIndex] = {
      text,
      anchor_quote: anchorQuote,
      if_false_changes: ifFalseChanges,
      support_kind: (SUPPORT_KINDS.has(supportKind) ? supportKind : 'explicit_reason') as PremiseCandidate['support_kind'],
      kind: revised.kind,
      ...(cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}),
      // A revise whose text is unchanged after normalisation is a keep wearing
      // another label; claiming lineage for it would put a "changed" mark on a
      // row that did not move.
      ...(comparable(overwritten) === comparable(text) ? {} : { revised_from: overwritten }),
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
