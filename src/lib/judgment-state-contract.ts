/**
 * Structural contract for AI-surfaced premises.
 *
 * The model may propose a premise, but only a premise traceable to the user's
 * own words can enter the living judgment state. The persisted snapshot stays
 * string[] for backward compatibility; this module keeps the richer proposal
 * and transition audit at the engine boundary.
 */

export interface PremiseCandidate {
  text: string;
  anchor_quote: string;
  support_kind: 'explicit_reason' | 'explicit_condition' | 'explicit_expectation';
  if_false_changes: string;
  confidence?: 'low' | 'medium' | 'high';
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
}

export interface PremiseContractResult {
  premises: string[];
  audit: PremiseAuditEntry[];
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
  living: { hidden_assumptions?: string[]; skeleton?: string[] } | null | undefined,
): T {
  const assumptions = (living?.hidden_assumptions || [])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => cleanText(item));
  const nextSteps = (living?.skeleton || [])
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => cleanText(item));

  const unsupportedAssumptionHeading =
    /(전제|가정|아직.*(?:확인|모르)|확인되지|현실.*확인|assumptions?|unverified|unknown|reality checks?|to verify)/i;
  const unsupportedActionHeading =
    /(다음\s*(?:단계|행동)|행동\s*계획|실행\s*계획|next steps?|action plans?|execution plans?)/i;

  return {
    ...result,
    sections: (result.sections || []).filter((section) => {
      const heading = cleanText(section?.heading);
      if (assumptions.length === 0 && unsupportedAssumptionHeading.test(heading)) return false;
      if (nextSteps.length === 0 && unsupportedActionHeading.test(heading)) return false;
      return true;
    }),
    key_assumptions: assumptions,
    next_steps: nextSteps,
  };
}

const MAX_PREMISES = 2;

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
  const premises: string[] = [];
  const audit: PremiseAuditEntry[] = [];
  const candidates = Array.isArray(raw) ? raw : [];

  for (const value of candidates) {
    const item = asRecord(value);
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
    if (!hasExplicitSupportSignal(anchorQuote)) {
      audit.push({
        accepted: false,
        action: 'initial',
        text,
        reason: 'explicit_support_not_in_anchor',
      });
      continue;
    }
    if (findExisting(premises, text) >= 0) {
      audit.push({ accepted: false, action: 'initial', text, reason: 'duplicate' });
      continue;
    }
    if (premises.length >= MAX_PREMISES) {
      audit.push({ accepted: false, action: 'initial', text, reason: 'premise_limit' });
      continue;
    }

    premises.push(text);
    audit.push({ accepted: true, action: 'initial', text, reason: 'grounded' });
  }

  return { premises, audit };
}

export function applyPremiseDeltas(
  currentPremises: string[],
  raw: unknown,
  fullUserCorpus: string,
  latestAnswer: string,
): PremiseContractResult {
  const premises = currentPremises
    .filter((premise): premise is string => typeof premise === 'string' && premise.trim().length > 0)
    .map((premise) => cleanText(premise))
    .slice(0, MAX_PREMISES);
  const audit: PremiseAuditEntry[] = [];
  const deltas = Array.isArray(raw) ? raw : [];

  for (const value of deltas) {
    const item = asRecord(value);
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
      // The explicit link is not always a WORD. When the anchor comes from the
      // answer the user just gave to a decision-shaping question, the act of
      // answering IS the link — demanding "때문에" on top of it rejected 100% of
      // real premises in the live run (both "런웨이 18개월" and "승진은 구두로만",
      // each volunteered in reply to "가장 마음에 걸리는 게 뭐예요?"). An anchor
      // pulled from OLDER narration still needs the connective: there the user
      // is describing, and any sentence could be lifted at random.
      const fromLatestAnswer = isTraceableQuote(anchorQuote, latestAnswer);
      if (!fromLatestAnswer && !hasExplicitSupportSignal(anchorQuote)) {
        audit.push({ accepted: false, action, text, reason: 'explicit_support_not_in_anchor' });
        continue;
      }
      if (findExisting(premises, text) >= 0) {
        audit.push({ accepted: false, action, text, reason: 'duplicate' });
        continue;
      }
      if (premises.length >= MAX_PREMISES) {
        audit.push({ accepted: false, action, text, reason: 'premise_limit' });
        continue;
      }
      premises.push(text);
      audit.push({ accepted: true, action, text, reason: 'grounded' });
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

    premises[existingIndex] = text;
    audit.push({
      accepted: true,
      action,
      previous_text: previousText,
      text,
      reason: 'latest_answer_grounded',
    });
  }

  return { premises: premises.slice(0, MAX_PREMISES), audit };
}
