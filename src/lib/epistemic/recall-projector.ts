import { fold, projectJudgment } from '../../../argus-mcp/src/v3/reducer';
import { SemanticEventSchema, type SemanticEvent } from '../../../argus-mcp/src/v3/types';
import { authorityChecksum } from './domain/checksum';
import type { AuthorityEvent } from './domain/events';
import { foldAuthorityEvents } from './domain/reducer';
import type { ClaimAuthorityState } from './domain/types';
import type { JudgmentCheckpoint, RecallAuthority, RecallDocument } from './recall-types';
import { RECALL_PROJECTION_VERSION } from './recall-types';

function clip(value: string, max = 120): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function eventHash(event: unknown): string {
  return authorityChecksum(event);
}

function claimAuthority(state: ClaimAuthorityState): RecallAuthority {
  const provenance = state.statement?.provenance;
  if (provenance === 'direct_user_command' || provenance === 'elicited_user') return 'user';
  if (provenance === 'imported_unverified') return 'imported';
  if (provenance === 'legacy_unknown') return 'legacy';
  if (provenance === 'host_reported') return 'external';
  return 'ai_proposal';
}

export function projectAuthorityRecallDocument(
  state: ClaimAuthorityState,
  events: readonly AuthorityEvent[] = [],
): RecallDocument | null {
  if (!state.statement || state.lifecycle === 'forgotten') return null;
  const canonicalRefs = events.length > 0
    ? events.map((event) => `authority-event:${event.event_id}`)
    : [`authority:${state.claim_id}:${state.aggregate_version}:${state.last_event_id ?? 'compatibility'}`];
  const searchable = [
    state.statement.value,
    ...state.scope?.value.domains ?? [],
    ...state.counterexamples.map((counterexample) => counterexample.authored.value),
  ].join('\n');
  return {
    document_id: `claim:${state.claim_id}`,
    kind: 'claim',
    canonical_refs: canonicalRefs,
    project_id: state.scope?.value.project_ids?.length === 1 ? state.scope.value.project_ids[0] : null,
    authority: claimAuthority(state),
    lifecycle_status: state.lifecycle,
    title: clip(state.statement.value),
    searchable_text: searchable,
    occurred_at: state.statement.recorded_at,
    valid_from: state.scope?.value.valid_from ?? state.statement.recorded_at,
    ...(state.scope?.value.review_by ? { valid_to: state.scope.value.review_by } : {}),
    source_hashes: events.length > 0 ? events.map(eventHash) : [authorityChecksum(state)],
    sensitivity: 'sensitive',
    projection_version: RECALL_PROJECTION_VERSION,
  };
}

export function projectAuthorityRecallDocuments(
  streams: ReadonlyMap<string, readonly AuthorityEvent[]> | Record<string, readonly AuthorityEvent[]>,
): RecallDocument[] {
  const entries = streams instanceof Map ? [...streams.entries()] : Object.entries(streams);
  return entries.flatMap(([claimId, events]) => {
    const state = foldAuthorityEvents(claimId, events);
    const document = projectAuthorityRecallDocument(state, events);
    return document ? [document] : [];
  }).sort((a, b) => a.document_id.localeCompare(b.document_id));
}

function relevantJudgmentEvents(events: readonly SemanticEvent[], judgmentId: string): SemanticEvent[] {
  const relatedContracts = new Set(events.flatMap((event) =>
    'judgment_id' in event && event.judgment_id === judgmentId && 'return_contract_id' in event
      ? [String(event.return_contract_id)] : []));
  return events.filter((event) =>
    ('judgment_id' in event && event.judgment_id === judgmentId)
    || ('return_contract_id' in event && relatedContracts.has(String(event.return_contract_id))));
}

export function projectJudgmentRecallDocuments(
  rawEvents: readonly unknown[],
  now = new Date().toISOString(),
): RecallDocument[] {
  const events = rawEvents.flatMap((raw) => {
    const parsed = SemanticEventSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
  const state = fold(events);
  const documents: RecallDocument[] = [];
  for (const judgment of state.judgments.values()) {
    const projection = projectJudgment(state, judgment.id, now);
    if (!projection || projection.lifecycle === 'erased') continue;
    const relevant = relevantJudgmentEvents(events, judgment.id);
    const premises = [...judgment.premise_ids].flatMap((id) => {
      const premise = state.premises.get(id);
      return premise && !premise.retired ? [premise.text] : [];
    });
    const resolution = judgment.resolution?.value;
    const resolutionText = resolution?.kind === 'answered'
      ? resolution.answer_summary
      : resolution?.reason;
    const terminal = [...relevant].reverse().find((event) =>
      ['judgment_closed', 'judgment_withdrawn', 'judgment_superseded', 'judgment_erased'].includes(event.event));
    const spaceId = relevant[0]?.space_id ?? 'unknown-project';
    const projectId = spaceId.startsWith('account-project:') ? spaceId.slice('account-project:'.length) : spaceId;
    documents.push({
      document_id: `judgment:${projectId}:${judgment.id}`,
      kind: 'judgment',
      canonical_refs: relevant.map((event) => `semantic-event:${event.event_id}`),
      project_id: projectId,
      authority: 'user',
      lifecycle_status: projection.lifecycle,
      title: clip(judgment.statement),
      searchable_text: [judgment.statement, ...premises, resolutionText].filter(Boolean).join('\n'),
      occurred_at: judgment.sealed_at,
      valid_from: judgment.sealed_at,
      ...(terminal ? { valid_to: terminal.time.recorded_at } : {}),
      ...(judgment.superseded_by ? { superseded_by: `judgment:${projectId}:${judgment.superseded_by}` } : {}),
      source_hashes: relevant.map(eventHash),
      sensitivity: 'sensitive',
      projection_version: RECALL_PROJECTION_VERSION,
    });
  }
  return documents.sort((a, b) => a.document_id.localeCompare(b.document_id));
}

export interface TimelineEntry {
  event_ref: string;
  occurred_at: string;
  type: string;
  summary: string;
  authority: RecallAuthority;
}

export function buildJudgmentTimeline(rawEvents: readonly unknown[], judgmentId: string): TimelineEntry[] {
  const events = rawEvents.flatMap((raw) => {
    const parsed = SemanticEventSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
  return relevantJudgmentEvents(events, judgmentId).map((event) => {
    let summary: string = event.event;
    if ('statement' in event) summary = event.statement;
    else if ('text' in event) summary = event.text;
    else if (event.event === 'resolution_asserted') summary = event.resolution.kind === 'answered'
      ? event.resolution.answer_summary : event.resolution.reason;
    else if ('reason' in event && event.reason) summary = event.reason;
    return {
      event_ref: `semantic-event:${event.event_id}`,
      occurred_at: event.time.recorded_at,
      type: event.event,
      summary,
      authority: event.authority.authorized_by?.kind === 'human' ? 'user'
        : event.provenance?.source_kind === 'host_report' ? 'external' : 'ai_proposal',
    };
  });
}

export function buildAuthorityTimeline(events: readonly AuthorityEvent[]): TimelineEntry[] {
  return events.map((event) => {
    const payload = event.payload as Record<string, unknown>;
    const statement = payload.statement as { value?: unknown } | undefined;
    const reason = payload.reason as { value?: unknown } | undefined;
    return {
      event_ref: `authority-event:${event.event_id}`,
      occurred_at: event.recorded_at,
      type: event.event_type,
      summary: typeof statement?.value === 'string' ? statement.value
        : typeof reason?.value === 'string' ? reason.value : event.event_type,
      authority: event.actor_type === 'user' ? 'user'
        : event.actor_type === 'imported_unverified' ? 'imported' : 'ai_proposal',
    };
  });
}

export function projectJudgmentCheckpoint(args: {
  events: readonly unknown[];
  generated_at: string;
  files_touched?: Array<{ path: string; sha256: string }>;
}): JudgmentCheckpoint {
  const events = args.events.flatMap((raw) => {
    const parsed = SemanticEventSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
  const state = fold(events);
  const active = [...state.judgments.values()].filter((judgment) =>
    !judgment.closed && !judgment.withdrawn && !judgment.superseded_by && !judgment.erased);
  const nextVerification = active.flatMap((judgment) => {
    const contract = judgment.active_return_contract_id
      ? judgment.return_contracts.get(judgment.active_return_contract_id) : undefined;
    if (!contract) return [];
    const source = [...events].reverse().find((event) =>
      event.event === 'return_promised' && event.return_contract_id === contract.id);
    return source ? [{ case_id: judgment.id, at: contract.review_at, source_ref: `semantic-event:${source.event_id}` }] : [];
  });
  const missingEvidence = active.flatMap((judgment) => {
    if (judgment.resolution?.value.kind !== 'indeterminate') return [];
    const source = [...events].reverse().find((event) =>
      event.event === 'resolution_asserted' && event.judgment_id === judgment.id);
    return source ? [{ text: judgment.resolution.value.reason, source_ref: `semantic-event:${source.event_id}` }] : [];
  });
  const unresolvedQuestions = nextVerification.map((item) => {
    const judgment = state.judgments.get(item.case_id)!;
    return {
      text: judgment.return_contracts.get(judgment.active_return_contract_id!)!.review_question,
      source_ref: item.source_ref,
    };
  });
  const changed = events.flatMap((event) => event.event === 'judgment_superseded'
    ? [{ before_ref: `judgment:${event.judgment_id}`, after_ref: `judgment:${event.successor_judgment_id}` }]
    : []);
  const validFiles = (args.files_touched ?? []).filter((file) =>
    file.path.length > 0 && /^[a-f0-9]{64}$/i.test(file.sha256));
  const cursor = events.at(-1)?.event_id ?? 'empty';
  return {
    checkpoint_id: `checkpoint:${authorityChecksum({ cursor, generated_at: args.generated_at })}`,
    source_cursor: cursor,
    active_case_ids: active.map((judgment) => judgment.id).sort(),
    user_quote_refs: events.filter((event) => event.authority.authorized_by?.kind === 'human')
      .map((event) => `semantic-event:${event.event_id}`),
    changed_assertions: changed,
    unresolved_questions: unresolvedQuestions,
    missing_evidence: missingEvidence,
    files_touched: validFiles,
    next_verification_dates: nextVerification,
    generated_at: args.generated_at,
    generator_version: 1,
    completeness: validFiles.length === (args.files_touched ?? []).length ? 'complete' : 'partial_invalid_source',
    provenance: 'ai_summary_projection',
    support_unit_eligible: false,
  };
}
