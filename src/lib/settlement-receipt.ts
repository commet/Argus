import type { DecisionContract, PredicateVerdict } from '@/stores/types';

export function applySettlementReceipt(
  contract: DecisionContract,
  verdict: PredicateVerdict,
  nowIso: string,
  userNarrative?: string,
): DecisionContract {
  if (!contract.judgment_receipt || verdict === 'pending') return contract;
  const whatHappened = userNarrative?.trim();

  return {
    ...contract,
    judgment_receipt: {
      ...contract.judgment_receipt,
      // The outcome category is a structured user tap, not a description of
      // reality. Never engrave "Mostly right" / "Missed" as if the user had
      // written what actually happened. Preserve an earlier narrative when a
      // verdict is edited; otherwise leave the optional field honestly blank.
      ...(whatHappened ? { what_happened: whatHappened } : {}),
      settled_at: nowIso,
    },
  };
}
