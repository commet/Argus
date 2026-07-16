import type { Assertion } from './types.js';

export interface DeltaMateriality {
  kind: 'delta';
  threshold: number;
}

export interface WatchCheckInput {
  previous: number | undefined;
  current: number;
  source_verified: boolean;
  materiality: DeltaMateriality;
}

export type WatchCheckResult =
  | { alert: false; reason: 'SOURCE_UNVERIFIED' }
  | { alert: false; reason: 'BASELINE_ESTABLISHED'; baseline: number }
  | { alert: false; reason: 'BELOW_MATERIALITY' }
  | { alert: true; reason: 'MATERIAL_CHANGE'; delta: number };

export function canWatchAssertion(assertion: Assertion): boolean {
  if (assertion.role !== 'premise' && assertion.role !== 'change_signal') return false;
  return assertion.scope.subject_ref !== undefined
    && (assertion.scope.metric !== undefined || assertion.scope.predicate_ref !== undefined)
    && assertion.modality !== 'should';
}

export function evaluateWatchCheck(input: WatchCheckInput): WatchCheckResult {
  if (!input.source_verified) return { alert: false, reason: 'SOURCE_UNVERIFIED' };
  if (input.previous === undefined) {
    return { alert: false, reason: 'BASELINE_ESTABLISHED', baseline: input.current };
  }
  const delta = Math.abs(input.current - input.previous);
  if (delta < input.materiality.threshold) return { alert: false, reason: 'BELOW_MATERIALITY' };
  return { alert: true, reason: 'MATERIAL_CHANGE', delta };
}
