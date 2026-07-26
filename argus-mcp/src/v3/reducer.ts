import {
  AUTHORIAL_EVENT_NAMES,
  SemanticEventSchema,
  type Lifecycle,
  type DecisionKind,
  type KindEvidence,
  type ObservationSourceKind,
  type Resolution,
  type SemanticEvent,
} from './types.js';

export interface Anomaly {
  event_id: string;
  code:
    | 'INVALID_EVENT'
    | 'DUPLICATE_IDEMPOTENCY'
    | 'IDEMPOTENCY_CONFLICT'
    | 'UNKNOWN_REFERENCE'
    | 'ILLEGAL_TRANSITION'
    | 'MISSING_AUTHORITY';
  detail: string;
}

export interface ProposalRecord {
  id: string;
  kind: 'judgment' | 'premise' | 'relationship';
  text: string;
  state: 'active' | 'rejected' | 'adopted';
}

export interface ObservationRecord {
  id: string;
  text: string;
  recorded_at: string;
  source_kind?: ObservationSourceKind;
}

export interface ReturnContractRecord {
  id: string;
  review_at: string;
  review_question: string;
  resolution_criterion?: string;
  review_event?: string;
  fallback_review_at?: string;
  superseded: boolean;
}

export interface JudgmentRecord {
  id: string;
  statement: string;
  sealed_statement: string;
  statement_revisions: Array<{
    from_statement: string;
    to_statement: string;
    reason?: string;
    recorded_at: string;
  }>;
  sealed_at: string;
  kind: DecisionKind;
  kind_evidence?: KindEvidence;
  origin_utterance?: string;
  review_condition_status?: 'answered' | 'skipped' | 'not_asked';
  review_condition?: string;
  premise_ids: Set<string>;
  return_contracts: Map<string, ReturnContractRecord>;
  active_return_contract_id?: string;
  resolution?: { id: string; value: Resolution };
  closed: boolean;
  withdrawn: boolean;
  superseded_by?: string;
  erased: boolean;
  conflicted: boolean;
}

export interface SemanticState {
  proposals: Map<string, ProposalRecord>;
  assertions: Map<string, string>;
  observations: Map<string, ObservationRecord>;
  judgments: Map<string, JudgmentRecord>;
  premises: Map<string, {
    judgment_id: string;
    text: string;
    retired: boolean;
    challenges: Array<{ challenge: string; response?: string; disposition: 'open' | 'corrected' | 'rejected' | 'upheld' }>;
  }>;
  idempotency: Map<string, string>;
  anomalies: Anomaly[];
}

export interface JudgmentProjection {
  judgment_id: string;
  lifecycle: Lifecycle;
  statement?: string;
  kind?: DecisionKind;
  origin_utterance?: string;
  active_return_contract_id?: string;
  resolution?: Resolution;
}

export const emptyState = (): SemanticState => ({
  proposals: new Map(),
  assertions: new Map(),
  observations: new Map(),
  judgments: new Map(),
  premises: new Map(),
  idempotency: new Map(),
  anomalies: [],
});

const fingerprintPayload = (event: SemanticEvent): Record<string, unknown> => {
  const payload = Object.fromEntries(Object.entries(event).filter(([key]) => ![
    'event_id', 'idempotency_key', 'time', 'authority', 'causal_parent_ids', 'atomic_batch_id',
  ].includes(key)));
  if (event.event === 'judgment_sealed' && event.kind_evidence) {
    const { recorded_at: _recordedAt, ...kindEvidence } = event.kind_evidence;
    void _recordedAt;
    payload.kind_evidence = kindEvidence;
  }
  return payload;
};

const fingerprint = (event: SemanticEvent): string => JSON.stringify({
  event: event.event,
  payload: fingerprintPayload(event),
  authority: {
    originated_by: event.authority.originated_by,
    authorized_by: event.authority.authorized_by,
    authorization_mode: event.authority.authorization_mode,
    authorization_ref: event.authority.authorization_ref,
  },
  // Idempotency fingerprint EXCLUDES the timestamps (occurred_at too): a genuine
  // retry of one command (same idempotency_key) re-stamps a fresh recorded_at,
  // and for a contemporaneous command occurred_at == recorded_at, so keeping
  // occurred_at here made an honest retry read as IDEMPOTENCY_CONFLICT. The key
  // already scopes to one command, so timestamp drift within a key is retry
  // bookkeeping, never a new intent. temporal_mode stays — it is the semantic
  // distinction (contemporaneous vs retrospective), stable across retries.
  // NOTE: mirrored verbatim by append_project_semantic_events (SQL) and the
  // dogfood supabase-emulator — keep all three in lockstep. A derived
  // kind_evidence.recorded_at is recorder time too and is stripped likewise.
  time: {
    temporal_mode: event.time.temporal_mode,
  },
});

function anomaly(state: SemanticState, event: { event_id: string }, code: Anomaly['code'], detail: string): void {
  state.anomalies.push({ event_id: event.event_id, code, detail });
}

function conflict(state: SemanticState, event: SemanticEvent, judgment: JudgmentRecord, detail: string): void {
  judgment.conflicted = true;
  anomaly(state, event, 'ILLEGAL_TRANSITION', detail);
}

function authorialAuthorityPresent(event: SemanticEvent): boolean {
  if (!AUTHORIAL_EVENT_NAMES.has(event.event)) return true;
  const { authority } = event;
  return authority.authorized_by?.kind === 'human'
    && authority.authorization_mode !== undefined
    && authority.authorization_ref !== undefined;
}

export function fold(events: readonly unknown[]): SemanticState {
  const state = emptyState();
  for (const raw of events) {
    const parsed = SemanticEventSchema.safeParse(raw);
    if (!parsed.success) {
      const candidate = raw as { event_id?: string };
      anomaly(state, { event_id: candidate.event_id ?? 'unknown' }, 'INVALID_EVENT', parsed.error.issues[0]?.message ?? 'invalid event');
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
  const existing = state.idempotency.get(event.idempotency_key);
  const nextFingerprint = fingerprint(event);
  if (existing !== undefined) {
    anomaly(state, event, existing === nextFingerprint ? 'DUPLICATE_IDEMPOTENCY' : 'IDEMPOTENCY_CONFLICT', 'idempotency key already observed');
    return;
  }
  state.idempotency.set(event.idempotency_key, nextFingerprint);

  if (!authorialAuthorityPresent(event)) {
    anomaly(state, event, 'MISSING_AUTHORITY', `${event.event} requires human authorization`);
    return;
  }

  switch (event.event) {
    case 'proposal_created':
      if (state.proposals.has(event.proposal_id)) {
        return anomaly(state, event, 'ILLEGAL_TRANSITION', 'proposal already exists');
      }
      state.proposals.set(event.proposal_id, {
        id: event.proposal_id,
        kind: event.proposal_kind,
        text: event.text,
        state: 'active',
      });
      return;
    case 'proposal_rejected': {
      const proposal = state.proposals.get(event.proposal_id);
      if (!proposal) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'proposal does not exist');
      proposal.state = 'rejected';
      return;
    }
    case 'assertion_recorded':
      state.assertions.set(event.assertion_id, event.text);
      return;
    case 'observation_recorded':
      state.observations.set(event.observation_id, {
        id: event.observation_id,
        text: event.text,
        recorded_at: event.time.recorded_at,
        ...(event.source_kind ? { source_kind: event.source_kind } : {}),
      });
      return;
    case 'judgment_sealed': {
      if (state.judgments.has(event.judgment_id)) return anomaly(state, event, 'ILLEGAL_TRANSITION', 'judgment already sealed');
      if (event.source_proposal_id) {
        const proposal = state.proposals.get(event.source_proposal_id);
        if (!proposal) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'source proposal does not exist');
        if (proposal.state !== 'active') return anomaly(state, event, 'ILLEGAL_TRANSITION', 'source proposal is not active');
        if (proposal.kind !== 'judgment') return anomaly(state, event, 'ILLEGAL_TRANSITION', 'source proposal is not a judgment proposal');
      }
      state.judgments.set(event.judgment_id, {
        id: event.judgment_id,
        statement: event.statement,
        sealed_statement: event.statement,
        statement_revisions: [],
        sealed_at: event.time.recorded_at,
        kind: event.kind ?? 'prediction',
        ...(event.kind_evidence ? { kind_evidence: event.kind_evidence } : {}),
        ...(event.origin_utterance ? { origin_utterance: event.origin_utterance } : {}),
        ...(event.review_condition_status ? { review_condition_status: event.review_condition_status } : {}),
        ...(event.review_condition ? { review_condition: event.review_condition } : {}),
        premise_ids: new Set(),
        return_contracts: new Map(),
        closed: false,
        withdrawn: false,
        erased: false,
        conflicted: false,
      });
      if (event.source_proposal_id) {
        state.proposals.get(event.source_proposal_id)!.state = 'adopted';
      }
      return;
    }
    case 'judgment_kind_corrected': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      if (terminal(judgment)) return conflict(state, event, judgment, 'terminal judgment cannot change kind');
      if (judgment.kind !== event.from_kind) return conflict(state, event, judgment, 'kind correction does not match current kind');
      judgment.kind = event.to_kind;
      judgment.kind_evidence = event.kind_evidence;
      if (event.to_kind === 'witness') judgment.active_return_contract_id = undefined;
      return;
    }
    case 'judgment_statement_revised': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      if (terminal(judgment)) return conflict(state, event, judgment, 'terminal judgment cannot be revised');
      if (judgment.statement !== event.from_statement) {
        return conflict(state, event, judgment, 'statement revision does not match current wording');
      }
      judgment.statement_revisions.push({
        from_statement: event.from_statement,
        to_statement: event.to_statement,
        ...(event.reason ? { reason: event.reason } : {}),
        recorded_at: event.time.recorded_at,
      });
      judgment.statement = event.to_statement;
      return;
    }
    case 'premise_adopted': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      if (event.source_proposal_id) {
        const proposal = state.proposals.get(event.source_proposal_id);
        if (!proposal) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'source proposal does not exist');
        if (proposal.state !== 'active') return anomaly(state, event, 'ILLEGAL_TRANSITION', 'source proposal is not active');
        if (proposal.kind !== 'premise') return anomaly(state, event, 'ILLEGAL_TRANSITION', 'source proposal is not a premise proposal');
      }
      judgment.premise_ids.add(event.premise_id);
      state.premises.set(event.premise_id, {
        judgment_id: event.judgment_id,
        text: event.text,
        retired: false,
        challenges: [],
      });
      if (event.source_proposal_id) {
        state.proposals.get(event.source_proposal_id)!.state = 'adopted';
      }
      return;
    }
    case 'premise_challenged': {
      const premise = state.premises.get(event.premise_id);
      if (!premise || premise.judgment_id !== event.judgment_id) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'premise does not exist');
      premise.challenges.push({
        challenge: event.challenge,
        ...(event.response ? { response: event.response } : {}),
        disposition: event.disposition,
      });
      return;
    }
    case 'premise_retired': {
      const premise = state.premises.get(event.premise_id);
      if (!premise || premise.judgment_id !== event.judgment_id) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'premise does not exist');
      premise.retired = true;
      return;
    }
    case 'return_promised': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      if (terminal(judgment)) return conflict(state, event, judgment, 'terminal judgment cannot receive a return contract');
      judgment.return_contracts.set(event.return_contract_id, {
        id: event.return_contract_id,
        review_at: event.review_at,
        review_question: event.review_question,
        ...(event.resolution_criterion ? { resolution_criterion: event.resolution_criterion } : {}),
        ...(event.review_event ? { review_event: event.review_event } : {}),
        ...(event.fallback_review_at ? { fallback_review_at: event.fallback_review_at } : {}),
        superseded: false,
      });
      judgment.active_return_contract_id = event.return_contract_id;
      return;
    }
    case 'return_deferred': {
      const judgment = judgmentByContract(state, event.return_contract_id, event);
      if (!judgment) return;
      if (terminal(judgment)) return conflict(state, event, judgment, 'terminal judgment cannot be deferred');
      const contract = judgment.return_contracts.get(event.return_contract_id)!;
      contract.review_at = event.review_at;
      return;
    }
    case 'return_contract_superseded': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      const old = judgment.return_contracts.get(event.old_return_contract_id);
      const next = judgment.return_contracts.get(event.new_return_contract_id);
      if (!old || !next) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'return contract does not exist');
      old.superseded = true;
      judgment.active_return_contract_id = next.id;
      return;
    }
    case 'resolution_asserted': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      if (terminal(judgment)) return conflict(state, event, judgment, 'terminal judgment cannot receive resolution');
      const contract = judgment.return_contracts.get(event.return_contract_id);
      if (!contract || contract.superseded) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'active return contract does not exist');
      if (event.resolution.kind === 'answered' && event.resolution.evidence_refs.some((id) => !state.observations.has(id))) {
        return anomaly(state, event, 'UNKNOWN_REFERENCE', 'answered resolution references missing observation');
      }
      judgment.resolution = { id: event.resolution_id, value: event.resolution };
      return;
    }
    case 'judgment_closed': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      if (terminal(judgment)) return conflict(state, event, judgment, 'judgment is terminal');
      if (judgment.resolution?.id !== event.resolution_id) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'resolution does not exist');
      judgment.closed = true;
      return;
    }
    case 'judgment_withdrawn': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      if (terminal(judgment)) return conflict(state, event, judgment, 'judgment is terminal');
      judgment.withdrawn = true;
      return;
    }
    case 'judgment_superseded': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      if (terminal(judgment)) return conflict(state, event, judgment, 'judgment is terminal');
      judgment.superseded_by = event.successor_judgment_id;
      return;
    }
    case 'judgment_erased': {
      const judgment = state.judgments.get(event.judgment_id);
      if (!judgment) return anomaly(state, event, 'UNKNOWN_REFERENCE', 'judgment does not exist');
      judgment.erased = true;
      return;
    }
  }
}

function judgmentByContract(state: SemanticState, contractId: string, event: SemanticEvent): JudgmentRecord | undefined {
  for (const judgment of state.judgments.values()) {
    if (judgment.return_contracts.has(contractId)) return judgment;
  }
  anomaly(state, event, 'UNKNOWN_REFERENCE', 'return contract does not exist');
  return undefined;
}

function terminal(judgment: JudgmentRecord): boolean {
  return judgment.closed || judgment.withdrawn || judgment.superseded_by !== undefined || judgment.erased;
}

export function projectJudgment(state: SemanticState, judgmentId: string, now: string): JudgmentProjection | undefined {
  const judgment = state.judgments.get(judgmentId);
  if (!judgment) return undefined;
  if (judgment.erased) return { judgment_id: judgmentId, lifecycle: 'erased' };
  if (judgment.conflicted) return { judgment_id: judgmentId, lifecycle: 'conflict', statement: judgment.statement };
  if (judgment.withdrawn) return { judgment_id: judgmentId, lifecycle: 'withdrawn', statement: judgment.statement, kind: judgment.kind, origin_utterance: judgment.origin_utterance };
  if (judgment.superseded_by) return { judgment_id: judgmentId, lifecycle: 'superseded', statement: judgment.statement, kind: judgment.kind, origin_utterance: judgment.origin_utterance };
  if (judgment.closed && judgment.resolution) {
    return {
      judgment_id: judgmentId,
      lifecycle: `resolved_${judgment.resolution.value.kind}` as Lifecycle,
      statement: judgment.statement,
      kind: judgment.kind,
      origin_utterance: judgment.origin_utterance,
      active_return_contract_id: judgment.active_return_contract_id,
      resolution: judgment.resolution.value,
    };
  }
  const active = judgment.kind === 'witness'
    ? undefined
    : judgment.active_return_contract_id
      ? judgment.return_contracts.get(judgment.active_return_contract_id)
      : undefined;
  return {
    judgment_id: judgmentId,
    lifecycle: active && active.review_at <= now ? 'due' : 'sealed',
    statement: judgment.statement,
    kind: judgment.kind,
    origin_utterance: judgment.origin_utterance,
    active_return_contract_id: active?.id,
  };
}

export function guardAppend(events: readonly unknown[], candidate: unknown): { ok: true; event: SemanticEvent } | { ok: false; code: string } {
  const parsed = SemanticEventSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, code: 'INVALID_EVENT' };
  const before = fold(events);
  const after = fold([...events, parsed.data]);
  const newAnomalies = after.anomalies.slice(before.anomalies.length);
  if (newAnomalies.length > 0) return { ok: false, code: newAnomalies[0]!.code };
  return { ok: true, event: parsed.data };
}

/**
 * 한 사용자 확인이 여러 semantic event를 만들 때의 preflight. 저장소 adapter는
 * 이 guard가 성공한 배열만 atomic append해야 한다. 중간 하나라도 실패하면 아무
 * event도 쓰지 않는다.
 */
export function guardAppendBatch(
  events: readonly unknown[],
  candidates: readonly unknown[],
): { ok: true; events: SemanticEvent[] } | { ok: false; code: string } {
  const accepted: SemanticEvent[] = [];
  for (const candidate of candidates) {
    const result = guardAppend([...events, ...accepted], candidate);
    if (!result.ok) return result;
    accepted.push(result.event);
  }
  return { ok: true, events: accepted };
}
