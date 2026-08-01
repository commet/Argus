/**
 * What a premise is FOR — one shared answer, used by every surface.
 *
 * PURE FILE ON PURPOSE (no store, no React, no llm): the seal, the return, the
 * card and the MCP bridge all have to agree on which premises matter, and a
 * rule that lives in three components is three rules.
 *
 * ── The idea ────────────────────────────────────────────────────────────────
 * A premise earns its place only by DISCRIMINATING between the options. If it
 * is equally true whichever way you go, it is background — it does not bear on
 * the decision at all, and bringing it back on the check-in date is noise
 * dressed as diligence.
 *
 * That single test also answers the question we could not otherwise answer:
 * which branch does this premise belong to? "Being wrong here would have sent
 * me the other way" IS branch membership, stated in a way a person can actually
 * answer. So one question closes both gaps:
 *
 *     "이게 틀렸다면, 다른 선택을 하셨을까요?"   → flips | holds
 *
 * ── Who may answer ──────────────────────────────────────────────────────────
 * Only the user. The model writes `if_false_changes` — its read of the
 * consequence — but whether that consequence would actually move THIS person is
 * a fact about them. Inferring it would be Argus deciding what matters to
 * someone, which is the one thing it must never do. `judgment-state-contract`
 * strips the field from model output; nothing here can re-introduce it.
 *
 * ── What "unanswered" means ─────────────────────────────────────────────────
 * Unanswered is not "holds". A premise nobody has ruled on is still a candidate
 * for checking — dropping it silently would quietly shrink the record, and the
 * user never chose that. Unanswered is carried; only an explicit 'holds' is
 * set aside.
 */

export type Decisive = 'flips' | 'holds';

export interface DecidablePremise {
  text: string;
  decisive?: Decisive;
  kind?: string;
  observable?: string;
}

/** A person's own weighting is never checked against reality, whatever they
 *  said about it flipping them — reality does not settle values. */
function isStandard(premise: DecidablePremise): boolean {
  return premise.kind === 'standard';
}

/** Explicitly set aside by the user: true whichever way the decision went. */
export function isBackground(premise: DecidablePremise): boolean {
  return premise.decisive === 'holds';
}

/**
 * The premises worth carrying into the future: the ones the user said would
 * have changed the call, plus the ones nobody has ruled on yet. Standards never
 * qualify — a value is not a claim about the world.
 */
export function carriedPremises<T extends DecidablePremise>(premises: T[]): T[] {
  return (premises || []).filter((p) => !isStandard(p) && !isBackground(p));
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

/** Has the user ruled on every premise that could still be ruled on? Used to
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
