// src/lib/decisive-premises.ts
var KIND_POLICY = {
  fact: { verifiable: false, competes: false, needsClaim: false, needsStance: false, needsObservable: false },
  premise: { verifiable: true, competes: true, needsClaim: true, needsStance: false, needsObservable: false },
  // A prediction is NOT gated on saying something new. Its whole job is to turn
  // a hedge into something reality can answer — "올려달라고 할 것 같기도
  // 하고요" into "올려달라고 할 것이다" — which adds no vocabulary at all. What
  // it owes instead is a way to check it.
  prediction: { verifiable: true, competes: true, needsClaim: false, needsStance: false, needsObservable: true },
  standard: { verifiable: false, competes: false, needsClaim: false, needsStance: true, needsObservable: false },
  open_question: { verifiable: true, competes: false, needsClaim: false, needsStance: false, needsObservable: false }
};
var PREMISE_KINDS = Object.keys(KIND_POLICY);
function asKind(value) {
  const k = typeof value === "string" ? value.trim() : "";
  return PREMISE_KINDS.includes(k) ? k : "premise";
}
function policyFor(kind) {
  return KIND_POLICY[asKind(kind)];
}

// src/lib/judgment-state-contract.ts
function checkableTexts(records) {
  return records.filter((r) => policyFor(r.kind).competes).map((r) => r.text);
}
function stripModelOnly(item) {
  if (!item) return item;
  if ("decisive" in item) {
    const { decisive: _ignored, ...rest } = item;
    void _ignored;
    return rest;
  }
  return item;
}
var STOP_TOKENS = /* @__PURE__ */ new Set([
  "\uADF8",
  "\uC774",
  "\uC800",
  "\uAC83",
  "\uC218",
  "\uB54C",
  "\uB4F1",
  "\uBC0F",
  "\uB354",
  "\uC880",
  "\uC798",
  "\uC548",
  "\uBABB",
  "\uB610",
  "\uB098",
  "\uB108",
  "\uB0B4",
  "\uC81C",
  "\uC800\uD76C",
  "\uC6B0\uB9AC",
  "\uAC70",
  "\uAC8C",
  "\uAC74",
  "\uC810",
  "\uBD84",
  "\uC911",
  "\uD6C4",
  "\uC804",
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "of",
  "to",
  "in",
  "on",
  "at",
  "is",
  "are",
  "be",
  "been",
  "that",
  "this",
  "it",
  "as",
  "for",
  "with",
  "my",
  "i",
  "we",
  "they",
  // Slot names. "런웨이가 18개월이라는 전제" is the anchor with the word
  // "전제" stapled on — the model naming the box it is filling, which the
  // harness prompt already calls out (✗ "같은 사실에 이름만 붙인 것"). Left
  // countable, these words were enough novelty to pass a restatement as a claim.
  "\uC804\uC81C",
  "\uAC00\uC815",
  "\uC870\uAC74",
  "\uBCC0\uC218",
  "\uC694\uC778",
  "\uB9AC\uC2A4\uD06C",
  "\uC774\uC288",
  "\uC9C0\uC810",
  "\uBD80\uBD84",
  "\uCE21\uBA74",
  "\uC0C1\uD669",
  "\uC0C1\uD0DC",
  "\uD3EC\uC778\uD2B8",
  "\uBB38\uC81C",
  "\uC0AC\uC2E4",
  "\uC598\uAE30",
  "\uC774\uC57C\uAE30",
  "premise",
  "assumption",
  "condition",
  "factor",
  "risk",
  "issue",
  "point",
  "situation",
  "state",
  "aspect",
  "thing",
  "fact"
]);
var STANCE_CLAIM = new RegExp(
  "(\uB9C8\uC74C\uC5D0\\s*\uAC78\uB9AC|\uAC78\uB9AC\uB294|\uAC78\uB824\\s*\uD558|\uBB34\uAC81|\uBD80\uB2F4|\uBD88\uC548|\uC2E0\uACBD\\s*(\uC4F0|\uC368)|\uC911\uC694\uD558|\uC911\uC2DC|\uC6B0\uC120\uC21C\uC704|\uAE30\uC900\uC774\uB2E4|\uAE30\uC900\uC774\\s*(\uB41C|\uB418)|\uB192\uAC8C\\s*\uBCF4|\uD06C\uAC8C\\s*\uBCF4|\uB0AE\uAC8C\\s*\uBCF4|\uC911\uC694\uD558\uAC8C\\s*\uBCF4|\uBCF4\uACE0\\s*\uC788|\uC0DD\uAC01\uD558\uACE0\\s*\uC788|\uBBFF\uACE0\\s*\uC788|\uAE30\uB300\uD558\uACE0\\s*\uC788|\uC5EC\uAE30\uACE0\\s*\uC788|\uC5EC\uAE34\uB2E4)|\\b(matters? to|weighs? on|cares? (most )?about|believes?|expects?|values?|prioriti[sz]es?)\\b",
  "i"
);
function attributesStanceToUser(text) {
  return STANCE_CLAIM.test(comparable(text));
}
function stemToken(token) {
  return /[가-힣]/.test(token) ? token.slice(0, 2) : token.slice(0, 4);
}
function contentStems(text) {
  const stems = comparable(text).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 0 && !STOP_TOKENS.has(token)).map(stemToken);
  return [...new Set(stems)];
}
var CLAIM_NOVELTY_FLOOR = 0.34;
var CLAIM_NOVEL_TOKENS_FLOOR = 2;
function claimBand(text, anchorQuote) {
  const stems = contentStems(text);
  const anchor = new Set(contentStems(anchorQuote));
  if (stems.length === 0) return { novelty: 0, anchor_overlap: 0, novel_count: 0 };
  const novel = stems.filter((s) => !anchor.has(s));
  return {
    novelty: novel.length / stems.length,
    anchor_overlap: stems.length - novel.length,
    novel_count: novel.length
  };
}
var HEDGE = /것\s*같|듯|아마|싶은|싶어|지\s*않을까|할지도|모르겠|같기도|생각도\s*들|\b(maybe|might|probably|possibly|seems?|i think|not sure|could be)\b/i;
function hardensAHedge(text, anchorQuote) {
  return HEDGE.test(comparable(anchorQuote)) && !HEDGE.test(comparable(text));
}
function statesAClaim(text, anchorQuote) {
  const band = claimBand(text, anchorQuote);
  const lexical = band.novelty >= CLAIM_NOVELTY_FLOOR && band.novel_count >= CLAIM_NOVEL_TOKENS_FLOOR;
  return lexical || hardensAHedge(text, anchorQuote);
}
function clampSynthesisToLivingState(result, living) {
  const records = (living?.premise_records || []).filter(Boolean);
  const assumptions = records.length > 0 ? records.filter((r) => policyFor(r.kind).competes).map((r) => cleanText(r.text)).filter((text) => text.length > 0) : (living?.hidden_assumptions || []).filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => cleanText(item));
  const checkableCount = records.filter((r) => policyFor(r.kind).verifiable && cleanText(r.if_false_changes).length > 0).length;
  const modelSteps = (result.next_steps || []).filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => cleanText(item));
  const nextSteps = modelSteps.slice(0, checkableCount);
  const assumptionHeading = /(전제|가정|아직.*(?:확인|모르)|확인되지|assumptions?|unverified|unknown)/i;
  const realityCheckHeading = /(현실.*확인|확인할\s*것|reality checks?|to verify)/i;
  const actionHeading = /(다음\s*(?:단계|행동)|행동\s*계획|실행\s*계획|next steps?|action plans?|execution plans?)/i;
  return {
    ...result,
    sections: (result.sections || []).filter((section) => {
      const heading = cleanText(section?.heading);
      if (assumptions.length === 0 && assumptionHeading.test(heading)) return false;
      if (nextSteps.length === 0 && (realityCheckHeading.test(heading) || actionHeading.test(heading))) return false;
      return true;
    }),
    key_assumptions: assumptions,
    next_steps: nextSteps
  };
}
var MAX_CLAIMS = 2;
var MAX_RECORDS = 4;
function claimCount(records) {
  return records.filter((r) => policyFor(r.kind).competes).length;
}
function gateByKind(declared, text, anchorQuote, stanceFromContext = false, observable = "") {
  const band = claimBand(text, anchorQuote);
  let kind = attributesStanceToUser(text) ? "standard" : asKind(declared);
  if (KIND_POLICY[kind].needsStance) {
    return stanceFromContext || hasExplicitSupportSignal(anchorQuote) ? { ok: true, kind, reason: "grounded", band } : { ok: false, kind, reason: "standard_without_user_stance", band };
  }
  let reason = "grounded";
  if (KIND_POLICY[kind].needsObservable && !observable) {
    kind = "premise";
    reason = "prediction_without_observable_read_as_premise";
  }
  if (KIND_POLICY[kind].needsClaim && !statesAClaim(text, anchorQuote)) {
    return { ok: true, kind: "fact", reason: "restates_anchor_recorded_as_fact", band };
  }
  return { ok: true, kind, reason, band };
}
function asRecord(value) {
  return value != null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
function comparable(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
function isTraceableQuote(quote, userText) {
  const needle = comparable(quote);
  const haystack = comparable(userText);
  return needle.length > 0 && haystack.includes(needle);
}
var SUPPORT_KINDS = /* @__PURE__ */ new Set([
  "explicit_reason",
  "explicit_condition",
  "explicit_expectation"
]);
function hasExplicitSupportSignal(text) {
  const normalized = comparable(text);
  return /(때문|그래서|이라서|라서|으니까|니까|다면|라면|하면|이면|전제|기대|믿|것 같|거라|될 것|할 것|중요|기준|우선순위|우선|걸리|걸려|부담|불안|포기|조건|원하|바라)|\b(because|since|if|unless|expect|assume|believe|count on|depend|rely|matters?|important|likely|probably|worried|worries|concern|prefer|priority|trade-?off|give up)\b/i.test(normalized);
}
function findExisting(premises, candidate) {
  const target = comparable(candidate);
  return premises.findIndex((premise) => comparable(premise) === target);
}
function coercePremiseCandidates(raw, userCorpus) {
  const records = [];
  const audit = [];
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
        action: "initial",
        text: text || void 0,
        reason: "missing_required_field"
      });
      continue;
    }
    if (!isTraceableQuote(anchorQuote, userCorpus)) {
      audit.push({
        accepted: false,
        action: "initial",
        text,
        reason: "anchor_not_in_user_words"
      });
      continue;
    }
    const gate = gateByKind(item?.kind, text, anchorQuote, false, cleanText(item?.observable));
    const entry = {
      action: "initial",
      text,
      declared_kind: asKind(item?.kind),
      recorded_kind: gate.kind,
      band: gate.band
    };
    if (!gate.ok) {
      audit.push({ ...entry, accepted: false, reason: gate.reason });
      continue;
    }
    if (findExisting(records.map((r) => r.text), text) >= 0) {
      audit.push({ ...entry, accepted: false, reason: "duplicate" });
      continue;
    }
    if (policyFor(gate.kind).competes && claimCount(records) >= MAX_CLAIMS) {
      audit.push({ ...entry, accepted: false, reason: "premise_limit" });
      continue;
    }
    if (records.length >= MAX_RECORDS) {
      audit.push({ ...entry, accepted: false, reason: "record_limit" });
      continue;
    }
    records.push({
      text,
      anchor_quote: anchorQuote,
      if_false_changes: ifFalseChanges,
      support_kind: supportKind,
      kind: gate.kind,
      ...cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}
    });
    audit.push({ ...entry, accepted: true, reason: gate.reason });
  }
  return { premises: checkableTexts(records), records, audit };
}
function verdictsWorthTelling(audit) {
  return (audit || []).filter((entry) => entry.text && entry.declared_kind && (!entry.accepted || entry.declared_kind !== entry.recorded_kind)).map((entry) => ({
    text: entry.text,
    declared: entry.declared_kind,
    ...entry.accepted ? { recorded: entry.recorded_kind } : {},
    reason: entry.reason
  }));
}
function verdictInstruction(reason) {
  switch (reason) {
    case "restates_anchor_recorded_as_fact":
      return "it repeats its own anchor, so it was filed as a fact. If it really is load-bearing, say what that fact makes possible or impossible in THIS decision. If you cannot, leaving it as a fact is the right outcome.";
    case "standard_without_user_stance":
      return "it states what weighs on this person, but the quote does not carry their own weighing words \u2014 so it was refused rather than put in their mouth. Ask them instead of asserting it.";
    case "prediction_without_observable_read_as_premise":
      return "no observable, so it cannot promise a settle date and was filed as an assumption. Name what would be SEEN and it can be a prediction.";
    case "anchor_not_in_user_words":
      return "the quote does not appear in anything they wrote. Quote exactly.";
    case "premise_limit":
      return "two assumptions are already open. Revise one instead of stacking a third.";
    case "record_limit":
      return "the record is full. Revise or remove before adding.";
    case "duplicate":
      return "already recorded.";
    case "missing_required_field":
      return "an add needs text, anchor_quote, support_kind and if_false_changes.";
    case "latest_answer_evidence_missing":
      return "a change to an existing item needs a quote from the answer they just gave.";
    default:
      return reason;
  }
}
function applyPremiseDeltas(currentRecords, raw, fullUserCorpus, latestAnswer) {
  const records = (currentRecords || []).map((entry) => {
    if (typeof entry === "string") {
      return entry.trim() ? { text: cleanText(entry), anchor_quote: "", if_false_changes: "", support_kind: "explicit_reason", kind: "premise" } : null;
    }
    return entry && typeof entry.text === "string" && entry.text.trim() ? { ...entry, text: cleanText(entry.text) } : null;
  }).filter((r) => r !== null).slice(0, MAX_RECORDS);
  const premises = records.map((r) => r.text);
  const audit = [];
  const deltas = Array.isArray(raw) ? raw : [];
  for (const value of deltas) {
    const item = stripModelOnly(asRecord(value));
    const action = cleanText(item?.action);
    const previousText = cleanText(item?.previous_text);
    const text = cleanText(item?.text);
    const anchorQuote = cleanText(item?.anchor_quote);
    const reason = cleanText(item?.reason_from_latest_answer);
    const supportKind = cleanText(item?.support_kind);
    const ifFalseChanges = cleanText(item?.if_false_changes);
    if (!["keep", "add", "remove", "revise"].includes(action)) {
      audit.push({ accepted: false, action: "keep", reason: "invalid_action" });
      continue;
    }
    if (action === "keep") {
      const target = previousText || text;
      const existingIndex2 = findExisting(premises, target);
      audit.push({
        accepted: existingIndex2 >= 0,
        action,
        previous_text: target || void 0,
        reason: existingIndex2 >= 0 ? "preserved" : "premise_not_found"
      });
      continue;
    }
    if (action === "add") {
      if (!text || !anchorQuote || !ifFalseChanges || !SUPPORT_KINDS.has(supportKind)) {
        audit.push({ accepted: false, action, text: text || void 0, reason: "missing_required_field" });
        continue;
      }
      if (!isTraceableQuote(anchorQuote, fullUserCorpus)) {
        audit.push({ accepted: false, action, text, reason: "anchor_not_in_user_words" });
        continue;
      }
      const gate = gateByKind(
        item?.kind,
        text,
        anchorQuote,
        isTraceableQuote(anchorQuote, latestAnswer),
        cleanText(item?.observable)
      );
      const entry = {
        action,
        text,
        declared_kind: asKind(item?.kind),
        recorded_kind: gate.kind,
        band: gate.band
      };
      if (!gate.ok) {
        audit.push({ ...entry, accepted: false, reason: gate.reason });
        continue;
      }
      if (findExisting(premises, text) >= 0) {
        audit.push({ ...entry, accepted: false, reason: "duplicate" });
        continue;
      }
      if (policyFor(gate.kind).competes && claimCount(records) >= MAX_CLAIMS) {
        audit.push({ ...entry, accepted: false, reason: "premise_limit" });
        continue;
      }
      if (records.length >= MAX_RECORDS) {
        audit.push({ ...entry, accepted: false, reason: "record_limit" });
        continue;
      }
      records.push({
        text,
        anchor_quote: anchorQuote,
        if_false_changes: ifFalseChanges,
        support_kind: supportKind,
        kind: gate.kind,
        ...cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}
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
        previous_text: previousText || void 0,
        text: text || void 0,
        reason: "premise_not_found"
      });
      continue;
    }
    if (!reason || !anchorQuote || !isTraceableQuote(anchorQuote, latestAnswer)) {
      audit.push({
        accepted: false,
        action,
        previous_text: previousText,
        text: text || void 0,
        reason: "latest_answer_evidence_missing"
      });
      continue;
    }
    if (action === "remove") {
      records.splice(existingIndex, 1);
      premises.splice(existingIndex, 1);
      audit.push({ accepted: true, action, previous_text: previousText, reason: "latest_answer_grounded" });
      continue;
    }
    if (!text || !ifFalseChanges || !SUPPORT_KINDS.has(supportKind)) {
      audit.push({
        accepted: false,
        action,
        previous_text: previousText,
        text: text || void 0,
        reason: "missing_required_field"
      });
      continue;
    }
    const duplicateIndex = findExisting(premises, text);
    if (duplicateIndex >= 0 && duplicateIndex !== existingIndex) {
      audit.push({ accepted: false, action, previous_text: previousText, text, reason: "duplicate" });
      continue;
    }
    const revised = gateByKind(item?.kind, text, anchorQuote, true, cleanText(item?.observable));
    records[existingIndex] = {
      text,
      anchor_quote: anchorQuote,
      if_false_changes: ifFalseChanges,
      support_kind: supportKind,
      kind: revised.kind,
      ...cleanText(item?.observable) ? { observable: cleanText(item?.observable) } : {}
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
      reason: "latest_answer_grounded"
    });
  }
  const kept = records.slice(0, MAX_RECORDS);
  return { premises: checkableTexts(kept), records: kept, audit };
}
export {
  applyPremiseDeltas,
  attributesStanceToUser,
  checkableTexts,
  claimBand,
  clampSynthesisToLivingState,
  coercePremiseCandidates,
  hardensAHedge,
  statesAClaim,
  verdictInstruction,
  verdictsWorthTelling
};
