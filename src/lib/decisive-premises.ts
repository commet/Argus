/**
 * What a collected item IS FOR — one shared answer, used by every surface.
 *
 * PURE FILE ON PURPOSE (no store, no React, no llm): admission, the card, the
 * seal, the return and the MCP bridge all have to agree on what each kind is
 * for, and a rule that lives in five components is five rules.
 *
 * ── The kinds are verbs, not labels ─────────────────────────────────────────
 * The five kinds were introduced (2026-08-01) so that each thing collected
 * names what can be DONE with it later. But they were only read at render time,
 * so they decided nothing: a bare fact entered under the same gate as a claim,
 * occupied one of the two scarce premise slots, and was then displayed to the
 * user under the heading "확인할 가정" — Argus asking someone to go verify
 * something they had just finished telling it.
 *
 * Measured on the flagship session (heavy-04, 2026-08-01): of the two items
 * that survived to the screen, one was a restated fact and the other was the
 * user's own standard, while the genuinely load-bearing premise had been
 * rejected at the door. Everything downstream was working on the wrong two.
 *
 * So the policy below is authoritative and consulted at ADMISSION, not just at
 * paint time. Each kind gets the gate its truth-conditions actually require.
 *
 * ── Who may answer "did this matter?" ───────────────────────────────────────
 * Only the user. The model writes `if_false_changes` — its read of the
 * consequence — but whether that consequence would actually move THIS person is
 * a fact about them. Inferring it would be Argus deciding what matters to
 * someone, which is the one thing it must never do. `judgment-state-contract`
 * strips `decisive` from model output; nothing here can re-introduce it.
 *
 * ── What "unanswered" means ─────────────────────────────────────────────────
 * Unanswered is not "holds". A premise nobody has ruled on is still a candidate
 * for checking — dropping it silently would quietly shrink the record, and the
 * user never chose that. Unanswered is carried; only an explicit 'holds' is
 * set aside.
 */

export type Decisive = 'flips' | 'holds';

export type PremiseKind =
  | 'fact'
  | 'premise'
  | 'prediction'
  | 'standard'
  | 'open_question';

export interface KindPolicy {
  /** Reality can settle it, so it may be checked later and may carry a check
   *  line into the receipt. A fact is already settled; a standard never is. */
  verifiable: boolean;
  /** Occupies one of the two scarce premise slots. Only the kinds that make a
   *  claim compete — a fact that crowds out a premise is a pure loss. */
  competes: boolean;
  /** Admission requires the text to say something its anchor does not already
   *  say. This is what separates a premise from a restated fact. */
  needsClaim: boolean;
  /** Admission requires the user's own stance inside the anchor. Only a
   *  standard needs this: it is a claim about what matters to THEM, so their
   *  own weighing word has to be in the quote or it is our attribution. */
  needsStance: boolean;
}

/**
 * The table. Every gate, filter and label reads this and nothing else.
 *
 * The asymmetry between `needsClaim` and `needsStance` is the whole design:
 * a premise earns entry by going BEYOND the quote, a standard by staying
 * inside it. One flat gate for five different things is why the old contract
 * simultaneously over-rejected (it killed the sharpest premise in the sim for
 * lacking a connective) and under-rejected (it waved through bare facts).
 */
export const KIND_POLICY: Record<PremiseKind, KindPolicy> = {
  fact: { verifiable: false, competes: false, needsClaim: false, needsStance: false },
  premise: { verifiable: true, competes: true, needsClaim: true, needsStance: false },
  prediction: { verifiable: true, competes: true, needsClaim: true, needsStance: false },
  standard: { verifiable: false, competes: false, needsClaim: false, needsStance: true },
  open_question: { verifiable: true, competes: false, needsClaim: false, needsStance: false },
};

export const PREMISE_KINDS = Object.keys(KIND_POLICY) as PremiseKind[];

/** Unknown or absent → 'premise', the conservative reading: it faces the
 *  strictest gate and gets verified rather than silently skipped or graded. */
export function asKind(value: unknown): PremiseKind {
  const k = typeof value === 'string' ? value.trim() : '';
  return (PREMISE_KINDS as string[]).includes(k) ? (k as PremiseKind) : 'premise';
}

export function policyFor(kind: unknown): KindPolicy {
  return KIND_POLICY[asKind(kind)];
}

export interface DecidablePremise {
  text: string;
  decisive?: Decisive;
  kind?: string;
  observable?: string;
}

/** Explicitly set aside by the user: true whichever way the decision went. */
export function isBackground(premise: DecidablePremise): boolean {
  return premise.decisive === 'holds';
}

/**
 * The items worth carrying into the future: the ones reality could still
 * settle, minus the ones the user said would not have moved them.
 *
 * A fact is excluded because reality already fixed it, and a standard because
 * reality does not settle values — asking "그거 맞았어요?" about someone's
 * weighting grades who they are, the spine's first prohibition.
 */
export function carriedPremises<T extends DecidablePremise>(premises: T[]): T[] {
  return (premises || []).filter((p) => policyFor(p.kind).verifiable && !isBackground(p));
}

/**
 * The ones to actually ask about on the return day. Same rule, tighter: when
 * the user has marked at least one as decisive, only those come back — they
 * already told us where the weight is, and asking about the rest wastes the one
 * moment of attention the return gets.
 */
export function premisesToRevisit<T extends DecidablePremise>(premises: T[]): T[] {
  const carried = carriedPremises(premises);
  const decisive = carried.filter((p) => p.decisive === 'flips');
  return decisive.length > 0 ? decisive : carried;
}

/** Has the user ruled on every item that could still be ruled on? Used to
 *  decide whether asking again is worth a screen — never to nag. */
export function allPremisesAnswered(premises: DecidablePremise[]): boolean {
  return carriedPremises(premises).every((p) => p.decisive != null);
}

/** The question, in one place, so every surface asks it the same way. */
export function decisiveQuestion(locale: 'ko' | 'en'): string {
  return locale === 'ko'
    ? '이게 틀렸다면, 다른 선택을 하셨을까요?'
    : 'If this turned out wrong, would you have chosen differently?';
}

export function decisiveAnswerLabel(value: Decisive, locale: 'ko' | 'en'): string {
  if (locale === 'ko') return value === 'flips' ? '네, 달라졌을 거예요' : '아니요, 그래도 같았을 거예요';
  return value === 'flips' ? 'Yes, I would have' : 'No, same either way';
}

/**
 * What to call each kind on screen, in the user's language rather than ours.
 * Deliberately plain: "사실" not "확인된 정보", "내 기준" not "가치 판단".
 * A person should be able to disagree with the label at a glance, which is
 * only possible if the label is a word they already use.
 */
export function kindLabel(kind: unknown, locale: 'ko' | 'en'): string {
  const k = asKind(kind);
  if (locale === 'ko') {
    return { fact: '사실', premise: '가정', prediction: '예측', standard: '내 기준', open_question: '열린 질문' }[k];
  }
  return { fact: 'fact', premise: 'assumption', prediction: 'prediction', standard: 'my standard', open_question: 'open question' }[k];
}

/**
 * The heading for a mixed list. Calling a list that contains facts and
 * standards "확인할 가정" is the lie this whole module exists to stop, so the
 * heading narrows only when the list has actually narrowed.
 */
export function premiseListHeading(premises: DecidablePremise[], locale: 'ko' | 'en'): string {
  const kinds = new Set((premises || []).map((p) => asKind(p.kind)));
  const onlyCheckable = kinds.size > 0 && [...kinds].every((k) => KIND_POLICY[k].competes);
  if (locale === 'ko') return onlyCheckable ? '확인할 가정' : '이 판단이 서 있는 것';
  return onlyCheckable ? 'Assumptions to verify' : 'What this rests on';
}
