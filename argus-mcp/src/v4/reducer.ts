import {
  AUTHORIAL_EVENT_NAMES,
  SemanticEventSchema,
  type Assertion,
  type AuthorityContext,
  type EvidenceArtifact,
  type Observation,
  type Relation,
  type Resolution,
  type ReturnTrigger,
  type SemanticEvent,
  type TemporalContext,
} from './types.js';

export type AnomalyCode =
  | 'INVALID_EVENT'
  | 'DUPLICATE_IDEMPOTENCY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'UNKNOWN_REFERENCE'
  | 'ILLEGAL_TRANSITION'
  | 'MISSING_AUTHORITY'
  | 'IMMUTABLE_ASSERTION'
  | 'ATOMIC_BATCH_AUTHORITY_MISMATCH'
  | 'REJECTED_RELATION_REPROPOSED';

export interface Anomaly {
  event_id: string;
  code: AnomalyCode;
  detail: string;
}

export interface DecisionRecord {
  decision_id: string;
  question: string;
  opened_at: string;
  judgment_ids: string[];
  return_contract_ids: string[];
}

export interface AssertionRecord {
  assertion: Assertion;
  status: 'recorded' | 'adopted';
  decision_id?: string;
  proposal_id?: string;
  time: TemporalContext;
  authority: AuthorityContext;
}

export interface ProposalRecord {
  proposal_id: string;
  assertion: Assertion;
  status: 'active' | 'adopted' | 'rejected';
}

export interface JudgmentRecord {
  judgment_id: string;
  decision_id: string;
  version: number;
  statement: string;
  assertion_refs: string[];
  basis_known_as_of: string;
  sealed_at: string;
  supersedes_judgment_id?: string;
  superseded_by?: string;
  change_rationale_ref?: string;
  resolution?: { resolution_id: string; value: Resolution };
  closed: boolean;
}

export interface EvidenceRecord extends EvidenceArtifact {}

export interface ObservationRecord extends Observation {
  status: 'active' | 'challenged';
  challenge_reason?: string;
  time: TemporalContext;
}

export interface RelationRecord extends Relation {}

export interface ReturnContractRecord {
  return_contract_id: string;
  decision_id: string;
  trigger: ReturnTrigger;
  review_question: string;
  resolution_criterion?: string;
}

export interface WatchCheckRecord {
  check_id: string;
  assertion_id: string;
  previous_value?: number;
  current_value?: number;
  source_verified: boolean;
  evidence_refs: string[];
  material: boolean;
}

export interface AtomicBatchAudit {
  authorization_ref: string;
  event_ids: string[];
}

export interface SemanticState {
  decisions: Map<string, DecisionRecord>;
  proposals: Map<string, ProposalRecord>;
  assertions: Map<string, AssertionRecord>;
  judgments: Map<string, JudgmentRecord>;
  evidence: Map<string, EvidenceRecord>;
  observations: Map<string, ObservationRecord>;
  relations: Map<string, RelationRecord>;
  return_contracts: Map<string, ReturnContractRecord>;
  watch_checks: Map<string, WatchCheckRecord>;
  atomic_batches: Map<string, AtomicBatchAudit>;
  idempotency: Map<string, string>;
  rejected_relation_signatures: Set<string>;
  anomalies: Anomaly[];
}

export interface DecisionProjection {
  decision_id: string;
  question: string;
  judgments: Array<{
    judgment_id: string;
    version: number;
    statement: string;
    lifecycle: 'sealed' | 'superseded' | 'resolved' | 'closed';
    resolution?: Resolution;
  }>;
}

export const emptyState = (): SemanticState => ({
  decisions: new Map(),
  proposals: new Map(),
  assertions: new Map(),
  judgments: new Map(),
  evidence: new Map(),
  observations: new Map(),
  relations: new Map(),
  return_contracts: new Map(),
  watch_checks: new Map(),
  atomic_batches: new Map(),
  idempotency: new Map(),
  rejected_relation_signatures: new Set(),
  anomalies: [],
});

function anomaly(state: SemanticState, eventId: string, code: AnomalyCode, detail: string): void {
  state.anomalies.push({ event_id: eventId, code, detail });
}

function fingerprint(event: SemanticEvent): string {
  return JSON.stringify({
    event: event.event,
    payload: Object.fromEntries(Object.entries(event).filter(([key]) => ![
      'event_id', 'idempotency_key', 'time', 'authority', 'causal_parent_ids', 'atomic_batch_id',
    ].includes(key))),
    authority: {
      originated_by: event.authority.originated_by,
      authorized_by: event.authority.authorized_by,
      authorization_mode: event.authority.authorization_mode,
      authorization_ref: event.authority.authorization_ref,
    },
    temporal_mode: event.time.temporal_mode,
  });
}

function relationSignature(relation: Relation): string {
  const endpoints = relation.direction === 'symmetric'
    ? [relation.from_ref, relation.to_ref].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))
    : [relation.from_ref, relation.to_ref];
  return JSON.stringify({
    type: relation.type,
    endpoints,
    evidence_refs: [...relation.evidence_refs].sort(),
  });
}

function auditAtomicBatch(state: SemanticState, event: SemanticEvent): boolean {
  if (!event.atomic_batch_id || !AUTHORIAL_EVENT_NAMES.has(event.event)) return true;
  const ref = event.authority.authorization_ref?.ref;
  if (!ref) {
    anomaly(state, event.event_id, 'MISSING_AUTHORITY', 'atomic authorial event requires authorization reference');
    return false;
  }
  const existing = state.atomic_batches.get(event.atomic_batch_id);
  if (existing && existing.authorization_ref !== ref) {
    anomaly(state, event.event_id, 'ATOMIC_BATCH_AUTHORITY_MISMATCH', 'atomic batch contains more than one authorization receipt');
    return false;
  }
  if (existing) existing.event_ids.push(event.event_id);
  else state.atomic_batches.set(event.atomic_batch_id, { authorization_ref: ref, event_ids: [event.event_id] });
  return true;
}

export function fold(events: readonly unknown[]): SemanticState {
  const state = emptyState();
  for (const raw of events) {
    const parsed = SemanticEventSchema.safeParse(raw);
    if (!parsed.success) {
      const eventId = typeof raw === 'object' && raw !== null && 'event_id' in raw
        ? String((raw as { event_id?: unknown }).event_id ?? 'unknown')
        : 'unknown';
      anomaly(state, eventId, 'INVALID_EVENT', parsed.error.issues[0]?.message ?? 'invalid event');
      continue;
    }
    apply(state, parsed.data);
  }
  return state;
}

export function foldAsOf(events: readonly unknown[], asOf: string): SemanticState {
  return fold(events.filter((raw) => {
    const parsed = SemanticEventSchema.safeParse(raw);
    return parsed.success && parsed.data.time.recorded_at <= asOf;
  }));
}

export function apply(state: SemanticState, event: SemanticEvent): void {
  const nextFingerprint = fingerprint(event);
  const priorFingerprint = state.idempotency.get(event.idempotency_key);
  if (priorFingerprint !== undefined) {
    anomaly(
      state,
      event.event_id,
      priorFingerprint === nextFingerprint ? 'DUPLICATE_IDEMPOTENCY' : 'IDEMPOTENCY_CONFLICT',
      'idempotency key already observed',
    );
    return;
  }
  state.idempotency.set(event.idempotency_key, nextFingerprint);
  if (!auditAtomicBatch(state, event)) return;

  switch (event.event) {
    case 'decision_opened':
      if (state.decisions.has(event.decision_id)) {
        anomaly(state, event.event_id, 'ILLEGAL_TRANSITION', 'decision already exists');
        return;
      }
      state.decisions.set(event.decision_id, {
        decision_id: event.decision_id,
        question: event.question,
        opened_at: event.time.recorded_at,
        judgment_ids: [],
        return_contract_ids: [],
      });
      return;

    case 'assertion_proposed':
      state.proposals.set(event.proposal_id, {
        proposal_id: event.proposal_id,
        assertion: event.assertion,
        status: 'active',
      });
      return;

    case 'assertion_recorded':
      if (state.assertions.has(event.assertion.assertion_id)) {
        anomaly(state, event.event_id, 'IMMUTABLE_ASSERTION', 'assertion id already exists');
        return;
      }
      state.assertions.set(event.assertion.assertion_id, {
        assertion: event.assertion,
        status: 'recorded',
        time: event.time,
        authority: event.authority,
      });
      return;

    case 'assertion_adopted': {
      const decision = state.decisions.get(event.decision_id);
      const proposal = state.proposals.get(event.proposal_id);
      if (!decision || !proposal) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'decision or proposal does not exist');
        return;
      }
      if (proposal.status !== 'active') {
        anomaly(state, event.event_id, 'ILLEGAL_TRANSITION', 'proposal is no longer active');
        return;
      }
      if (state.assertions.has(event.assertion.assertion_id)) {
        anomaly(state, event.event_id, 'IMMUTABLE_ASSERTION', 'assertion id already exists');
        return;
      }
      proposal.status = 'adopted';
      state.assertions.set(event.assertion.assertion_id, {
        assertion: event.assertion,
        status: 'adopted',
        decision_id: event.decision_id,
        proposal_id: event.proposal_id,
        time: event.time,
        authority: event.authority,
      });
      return;
    }

    case 'evidence_recorded':
      if (state.evidence.has(event.evidence.evidence_id)) {
        anomaly(state, event.event_id, 'ILLEGAL_TRANSITION', 'evidence id already exists');
        return;
      }
      state.evidence.set(event.evidence.evidence_id, event.evidence);
      return;

    case 'evidence_access_changed': {
      const item = state.evidence.get(event.evidence_id);
      if (!item) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'evidence does not exist');
        return;
      }
      item.access = event.access;
      return;
    }

    case 'observation_recorded':
      if (event.observation.evidence_refs.some((id) => !state.evidence.has(id))) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'observation references missing evidence');
        return;
      }
      state.observations.set(event.observation.observation_id, {
        ...event.observation,
        status: 'active',
        time: event.time,
      });
      return;

    case 'observation_challenged': {
      const observation = state.observations.get(event.observation_id);
      if (!observation) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'observation does not exist');
        return;
      }
      observation.status = 'challenged';
      observation.challenge_reason = event.reason;
      return;
    }

    case 'judgment_sealed': {
      const decision = state.decisions.get(event.decision_id);
      if (!decision) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'decision does not exist');
        return;
      }
      if (state.judgments.has(event.judgment_id)) {
        anomaly(state, event.event_id, 'ILLEGAL_TRANSITION', 'judgment id already exists');
        return;
      }
      if (event.assertion_refs.some((id) => !state.assertions.has(id))) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'judgment references missing assertion');
        return;
      }
      if (event.version === 1 && event.supersedes_judgment_id) {
        anomaly(state, event.event_id, 'ILLEGAL_TRANSITION', 'initial judgment cannot supersede another judgment');
        return;
      }
      let predecessor: JudgmentRecord | undefined;
      if (event.version > 1) {
        predecessor = event.supersedes_judgment_id
          ? state.judgments.get(event.supersedes_judgment_id)
          : undefined;
        if (!predecessor || predecessor.decision_id !== event.decision_id || predecessor.version + 1 !== event.version) {
          anomaly(state, event.event_id, 'ILLEGAL_TRANSITION', 'judgment revision requires the prior version in the same decision');
          return;
        }
        if (event.change_rationale_ref && !state.assertions.has(event.change_rationale_ref)) {
          anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'change rationale does not exist');
          return;
        }
      }
      const record: JudgmentRecord = {
        judgment_id: event.judgment_id,
        decision_id: event.decision_id,
        version: event.version,
        statement: event.statement,
        assertion_refs: [...event.assertion_refs],
        basis_known_as_of: event.basis_known_as_of,
        sealed_at: event.time.recorded_at,
        closed: false,
        ...(event.supersedes_judgment_id ? { supersedes_judgment_id: event.supersedes_judgment_id } : {}),
        ...(event.change_rationale_ref ? { change_rationale_ref: event.change_rationale_ref } : {}),
      };
      state.judgments.set(event.judgment_id, record);
      decision.judgment_ids.push(event.judgment_id);
      if (predecessor) predecessor.superseded_by = event.judgment_id;
      return;
    }

    case 'return_promised': {
      const decision = state.decisions.get(event.decision_id);
      if (!decision) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'decision does not exist');
        return;
      }
      state.return_contracts.set(event.return_contract_id, {
        return_contract_id: event.return_contract_id,
        decision_id: event.decision_id,
        trigger: event.trigger,
        review_question: event.review_question,
        ...(event.resolution_criterion ? { resolution_criterion: event.resolution_criterion } : {}),
      });
      decision.return_contract_ids.push(event.return_contract_id);
      return;
    }

    case 'resolution_asserted': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment || judgment.decision_id !== event.decision_id) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'judgment does not exist in decision');
        return;
      }
      if (event.resolution.evidence_refs.some((id) => !state.evidence.has(id))) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'resolution references missing evidence');
        return;
      }
      judgment.resolution = { resolution_id: event.resolution_id, value: event.resolution };
      return;
    }

    case 'judgment_closed': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment || judgment.decision_id !== event.decision_id || judgment.resolution?.resolution_id !== event.resolution_id) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'authorized resolution does not exist');
        return;
      }
      judgment.closed = true;
      return;
    }

    case 'relation_proposed': {
      const signature = relationSignature(event.relation);
      if (state.rejected_relation_signatures.has(signature)) {
        anomaly(state, event.event_id, 'REJECTED_RELATION_REPROPOSED', 'rejected relation signature cannot be resurfaced');
        return;
      }
      state.relations.set(event.relation.relation_id, event.relation);
      return;
    }

    case 'relation_verified':
      state.relations.set(event.relation.relation_id, event.relation);
      return;

    case 'relation_confirmed':
      if (event.relation.status !== 'human_confirmed') {
        anomaly(state, event.event_id, 'ILLEGAL_TRANSITION', 'confirmed relation requires human_confirmed status');
        return;
      }
      state.relations.set(event.relation.relation_id, event.relation);
      return;

    case 'relation_rejected': {
      const relation = state.relations.get(event.relation_id);
      if (!relation) {
        anomaly(state, event.event_id, 'UNKNOWN_REFERENCE', 'relation does not exist');
        return;
      }
      relation.status = 'human_rejected';
      state.rejected_relation_signatures.add(relationSignature(relation));
      return;
    }

    case 'watch_check_recorded':
      state.watch_checks.set(event.check_id, {
        check_id: event.check_id,
        assertion_id: event.assertion_id,
        source_verified: event.source_verified,
        evidence_refs: [...event.evidence_refs],
        material: event.material,
        ...(event.previous_value !== undefined ? { previous_value: event.previous_value } : {}),
        ...(event.current_value !== undefined ? { current_value: event.current_value } : {}),
      });
      return;
  }
}

export function projectDecision(state: SemanticState, decisionId: string): DecisionProjection | undefined {
  const decision = state.decisions.get(decisionId);
  if (!decision) return undefined;
  return {
    decision_id: decisionId,
    question: decision.question,
    judgments: decision.judgment_ids
      .map((id) => state.judgments.get(id))
      .filter((item): item is JudgmentRecord => item !== undefined)
      .map((judgment) => ({
        judgment_id: judgment.judgment_id,
        version: judgment.version,
        statement: judgment.statement,
        lifecycle: judgment.closed
          ? 'closed'
          : judgment.resolution
            ? 'resolved'
            : judgment.superseded_by
              ? 'superseded'
              : 'sealed',
        ...(judgment.resolution ? { resolution: judgment.resolution.value } : {}),
      })),
  };
}

export function canUseRelationForCoaching(state: SemanticState, relationId: string): boolean {
  const relation = state.relations.get(relationId);
  if (!relation || (relation.status !== 'human_confirmed' && relation.status !== 'system_verified')) return false;
  const endpointEvidence = relation.endpoint_evidence;
  if (!endpointEvidence || endpointEvidence.from.length === 0 || endpointEvidence.to.length === 0) return false;
  const refs = new Set([...endpointEvidence.from, ...endpointEvidence.to]);
  for (const id of refs) {
    const evidence = state.evidence.get(id);
    if (!evidence || evidence.access !== 'available') return false;
  }
  return true;
}
