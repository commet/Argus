import type { DecisionContract, Predicate } from '@/stores/types';
import { contractStatus, isResolved } from './decision-contract';

export function isCheckInReminderDue(
  contract: DecisionContract | null | undefined,
  now: number,
): boolean {
  if (!contract?.check_in_at) return false;
  return contractStatus(contract, now).checkInDue;
}

export function selectOpenPredicate(contract: DecisionContract): Predicate | undefined {
  const predicates = Array.isArray(contract.predicates) ? contract.predicates : [];
  return predicates.find((p) => !isResolved(p)) ?? predicates[0];
}
