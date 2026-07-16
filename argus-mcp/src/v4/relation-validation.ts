import type { Assertion, SemanticRelationType } from './types.js';

export interface RelationCandidate {
  type: SemanticRelationType;
  from: Assertion;
  to: Assertion;
  evidence_refs: string[];
}

export type RelationValidation =
  | { eligible: true; reason: 'TYPE_CONTRACT_SATISFIED' }
  | { eligible: false; reason: string };

function overlaps(
  left: Assertion['scope']['valid_time'],
  right: Assertion['scope']['valid_time'],
): boolean {
  if (!left || !right) return false;
  return Date.parse(left.from) <= Date.parse(right.to)
    && Date.parse(right.from) <= Date.parse(left.to);
}

function sameSubject(left: Assertion, right: Assertion): boolean {
  return left.scope.subject_ref !== undefined
    && left.scope.subject_ref === right.scope.subject_ref;
}

function samePredicate(left: Assertion, right: Assertion): boolean {
  const leftPredicate = left.scope.predicate_ref ?? left.scope.metric;
  const rightPredicate = right.scope.predicate_ref ?? right.scope.metric;
  return leftPredicate !== undefined && leftPredicate === rightPredicate;
}

export function validateRelationCandidate(candidate: RelationCandidate): RelationValidation {
  const { from, to, type } = candidate;
  if (!sameSubject(from, to)) return { eligible: false, reason: 'SUBJECT_MISMATCH' };

  if (type === 'same_fact' || type === 'contradicts' || type === 'updates') {
    if (!samePredicate(from, to)) return { eligible: false, reason: 'PREDICATE_MISMATCH' };
    if (!overlaps(from.scope.valid_time, to.scope.valid_time) && type !== 'updates') {
      return { eligible: false, reason: 'TIME_SCOPE_MISMATCH' };
    }
    if (from.scope.unit && to.scope.unit && from.scope.unit !== to.scope.unit) {
      return { eligible: false, reason: 'UNIT_MISMATCH' };
    }
    if (type === 'contradicts' && (from.role === 'prediction' || to.role === 'prediction')) {
      return { eligible: false, reason: 'PREDICTION_REQUIRES_RESOLUTION' };
    }
    if (type === 'same_fact' && from.modality && to.modality && from.modality !== to.modality) {
      return { eligible: false, reason: 'MODALITY_MISMATCH' };
    }
  }

  if (candidate.evidence_refs.length === 0 && type !== 'same_question') {
    return { eligible: false, reason: 'EVIDENCE_REQUIRED' };
  }
  return { eligible: true, reason: 'TYPE_CONTRACT_SATISFIED' };
}
