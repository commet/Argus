// Return portfolio scheduler — v1.0 §7.2.
// One active return per case (reducer enforces), a GLOBAL activation budget
// across cases (check 13), stakes-and-proximity queueing, and the rule that a
// user's explicit priority beats the budget: the budget caps the pressure
// Argus creates, never the user's will.

import { type CaseState, type IsoTime, type ReturnContractDraft, type StakesWeight, type Reversibility } from './types';

export const DEFAULT_GLOBAL_RETURN_BUDGET = 3; // sealed in the measurement contract (§7.2)

export interface GlobalReturnDecision {
  active: Array<{ caseId: string; contract: ReturnContractDraft }>;
  queued: Array<{ caseId: string; contract: ReturnContractDraft; rank: number }>;
}

const WEIGHT_SCORE: Record<StakesWeight, number> = { minor: 0, significant: 1, major: 2 };
const REVERSIBILITY_SCORE: Record<Reversibility, number> = { reversible: 0, costly: 1, one_way: 2 };

function triggerProximityMs(contract: ReturnContractDraft, now: IsoTime): number {
  const t = contract.trigger;
  const nowMs = new Date(now).getTime();
  if (t.type === 'date') return new Date(t.date).getTime() - nowMs;
  if (t.type === 'event' || t.type === 'signal') return new Date(t.dateBackstop).getTime() - nowMs;
  return Number.POSITIVE_INFINITY; // manual returns exert no scheduling pressure
}

export interface ReturnCandidate {
  caseId: string;
  contract: ReturnContractDraft;
  stakes: { weight: StakesWeight; reversibility: Reversibility };
  userPrioritized: boolean; // explicit user act — exempt from the budget
}

// Decide which returns may be active for a user right now. Deterministic:
// same inputs, same activation set — no model in the loop.
export function scheduleGlobalReturns(
  candidates: ReturnCandidate[],
  now: IsoTime,
  budget: number = DEFAULT_GLOBAL_RETURN_BUDGET,
): GlobalReturnDecision {
  const prioritized = candidates.filter((c) => c.userPrioritized);
  const rest = candidates.filter((c) => !c.userPrioritized);

  const ranked = rest
    .map((c) => ({
      ...c,
      rank:
        WEIGHT_SCORE[c.stakes.weight] * 4 +
        REVERSIBILITY_SCORE[c.stakes.reversibility] * 2 -
        // nearer triggers rank higher; clamp so far-future doesn't dominate
        Math.min(triggerProximityMs(c.contract, now), 1000 * 60 * 60 * 24 * 90) / (1000 * 60 * 60 * 24 * 90),
    }))
    .sort((a, b) => b.rank - a.rank);

  const budgetLeft = Math.max(0, budget - prioritized.length);
  const active = [
    ...prioritized.map(({ caseId, contract }) => ({ caseId, contract })),
    ...ranked.slice(0, budgetLeft).map(({ caseId, contract }) => ({ caseId, contract })),
  ];
  const queued = ranked.slice(budgetLeft).map(({ caseId, contract, rank }) => ({ caseId, contract, rank }));
  return { active, queued };
}

// A return contract is due when its trigger fires or its backstop lapses.
export function isReturnDue(contract: ReturnContractDraft, now: IsoTime, eventObserved = false): boolean {
  const t = contract.trigger;
  const nowMs = new Date(now).getTime();
  switch (t.type) {
    case 'date':
      return nowMs >= new Date(t.date).getTime();
    case 'event':
    case 'signal':
      return eventObserved || nowMs >= new Date(t.dateBackstop).getTime();
    case 'manual':
      return false; // only the user opens these
  }
}

// The wording contract for the return opening (v1.0 §7.3 step 1): restore ONLY
// the question and the awaited signal. Choice/rationale/beliefs stay hidden
// until the observation lands — building the opening from the full card here
// would be the exact contamination §7.3 exists to prevent.
export function composeReturnOpening(state: CaseState): { question: string; awaitedSignal: string } {
  if (!state.card) {
    throw new Error('composeReturnOpening requires an adopted card');
  }
  const contract = state.activeReturn?.contract;
  const awaited =
    contract?.expectedSignal ??
    (contract?.trigger.type === 'signal' ? contract.trigger.expectedSignal : undefined) ??
    '지난 결정 이후 실제로 일어난 일';
  return { question: state.card.question, awaitedSignal: awaited };
}
