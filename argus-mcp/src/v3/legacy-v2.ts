/**
 * v2 → v3 읽기 adapter.
 *
 * v2는 provenance를 보존했지만 v3가 요구하는 authorizing human/evidence를 담지
 * 않는다. 따라서 이 adapter는 유효한 SemanticEvent를 위조하지 않는다. 대신
 * LegacySemanticHint와 named loss를 반환한다. 새 write는 v3 schema만 사용한다.
 */
import { ArgusEventSchema, EVENT_NAMES, type ArgusEvent, type ArgusEventName } from '../v2/events.js';
import { SemanticEventSchema, type SemanticEvent } from './types.js';

export type LegacyDisposition = 'exact' | 'split' | 'degraded' | 'opaque';
export type LegacyHintKind =
  | 'proposal'
  | 'judgment'
  | 'return_contract'
  | 'return_deferred'
  | 'premise'
  | 'observation'
  | 'resolution'
  | 'closure'
  | 'withdrawal'
  | 'legacy_extension';

export interface LegacyMapping {
  disposition: LegacyDisposition;
  targets: readonly LegacyHintKind[];
  rationale: string;
}

export const V2_MAPPING: Record<ArgusEventName, LegacyMapping> = {
  harvest: { disposition: 'exact', targets: ['proposal'], rationale: 'harvested text is not user-owned yet' },
  seal: { disposition: 'split', targets: ['judgment', 'return_contract'], rationale: 'v2 couples statement and check date' },
  amend: { disposition: 'degraded', targets: ['legacy_extension'], rationale: 'cannot prove whether a changed predicate is hindsight-safe' },
  dismiss: { disposition: 'degraded', targets: ['withdrawal'], rationale: 'v2 dismiss does not distinguish candidate dismissal from authorial withdrawal' },
  settle: { disposition: 'split', targets: ['resolution', 'closure'], rationale: 'terminal outcome combines answer and close' },
  snooze: { disposition: 'exact', targets: ['return_deferred'], rationale: 'date movement is a non-terminal return change' },
  premise_add: { disposition: 'degraded', targets: ['premise'], rationale: 'legacy source cannot prove v3 authority' },
  premise_amend: { disposition: 'degraded', targets: ['legacy_extension'], rationale: 'in-place legacy amendment is not a v3 premise lifecycle event' },
  premise_recheck: { disposition: 'degraded', targets: ['observation'], rationale: 'recheck result lacks v3 observation context' },
  premise_resolve: { disposition: 'degraded', targets: ['legacy_extension'], rationale: 'resolution text lacks v3 subject and closure authority' },
  candidate_created: { disposition: 'exact', targets: ['proposal'], rationale: 'candidate is an explicit proposal plane' },
  candidate_surfaced: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'surface delivery is not semantic state' },
  candidate_action: { disposition: 'degraded', targets: ['legacy_extension'], rationale: 'promotion target is known but v3 adoption is derived from later authorial event' },
  bearing_set: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'bearing is outside v6 judgment kernel' },
  bearing_updated: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'bearing is outside v6 judgment kernel' },
  bearing_arrived: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'bearing is outside v6 judgment kernel' },
  bearing_abandoned: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'bearing is outside v6 judgment kernel' },
  waypoint: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'waypoint is a repository extension, not judgment meaning' },
  gate_result: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'gate telemetry is system data' },
  sync_pending: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'outbox delivery state is not judgment meaning' },
  sync_attempted: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'outbox delivery state is not judgment meaning' },
  sync_succeeded: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'outbox delivery state is not judgment meaning' },
  sync_abandoned: { disposition: 'opaque', targets: ['legacy_extension'], rationale: 'outbox delivery state is not judgment meaning' },
};

export interface LegacySemanticHint {
  kind: LegacyHintKind;
  entity_id?: string;
  fields: Readonly<Record<string, unknown>>;
}

export interface LegacyLoss {
  field: string;
  reason: string;
}

export interface LegacyAdaptation {
  legacy_event_id: string;
  legacy_event_name: ArgusEventName;
  disposition: LegacyDisposition;
  authority_status: 'legacy_unknown';
  recorded_at: string;
  hints: readonly LegacySemanticHint[];
  losses: readonly LegacyLoss[];
  raw: ArgusEvent;
}

const authorityLoss = (): LegacyLoss => ({
  field: 'authority',
  reason: 'v2 provenance is not v3 human authorization evidence',
});

const extension = (event: ArgusEvent): LegacySemanticHint => ({
  kind: 'legacy_extension',
  fields: { event: event.event, event_id: event.event_id },
});

export function adaptV2Event(event: ArgusEvent): LegacyAdaptation {
  const mapping = V2_MAPPING[event.event];
  const base = {
    legacy_event_id: event.event_id,
    legacy_event_name: event.event,
    disposition: mapping.disposition,
    authority_status: 'legacy_unknown' as const,
    recorded_at: event.occurred_at,
    raw: event,
  };

  switch (event.event) {
    case 'harvest':
      return { ...base, hints: [{ kind: 'proposal', entity_id: event.decision_id, fields: { text: event.text.value, provenance: event.text.provenance } }], losses: [] };
    case 'seal':
      return {
        ...base,
        hints: [
          { kind: 'judgment', entity_id: event.decision_id, fields: { statement: event.predicate.value, provenance: event.predicate.provenance, human_judgment: event.human_judgment?.value } },
          { kind: 'return_contract', entity_id: event.decision_id, fields: { review_at: event.check_by.value, review_question: event.real_question } },
        ],
        losses: [authorityLoss()],
      };
    case 'settle':
      if (event.outcome.value === 'still_pending') {
        return {
          ...base,
          disposition: 'exact',
          hints: [{ kind: 'return_deferred', entity_id: event.decision_id, fields: { legacy_outcome: event.outcome.value, note: event.note } }],
          losses: [authorityLoss()],
        };
      }
      return {
        ...base,
        hints: [
          { kind: 'resolution', entity_id: event.decision_id, fields: { legacy_outcome: event.outcome.value, answer_summary: event.note } },
          { kind: 'closure', entity_id: event.decision_id, fields: { legacy_outcome: event.outcome.value } },
        ],
        losses: [authorityLoss(), { field: 'resolution.subject_ref', reason: 'v2 settle has no distinct return contract id' }],
      };
    case 'snooze':
      return { ...base, hints: [{ kind: 'return_deferred', entity_id: event.decision_id, fields: { review_at: event.until } }], losses: [authorityLoss()] };
    case 'premise_add':
      return { ...base, hints: [{ kind: 'premise', entity_id: event.premise_id, fields: { judgment_id: event.decision_id, text: event.text.value, provenance: event.text.provenance } }], losses: [authorityLoss()] };
    case 'premise_recheck':
      return { ...base, hints: [{ kind: 'observation', entity_id: event.premise_id, fields: { result: event.result, note: event.note } }], losses: [{ field: 'observed_by', reason: 'v2 recheck has no observer identity' }] };
    case 'candidate_created':
      return { ...base, hints: [{ kind: 'proposal', entity_id: event.candidate_id, fields: { text: event.quote, quote_speaker: event.quote_speaker, verification: event.verification } }], losses: [] };
    case 'dismiss':
      return { ...base, hints: [{ kind: 'withdrawal', entity_id: event.decision_id, fields: { reason: event.reason } }], losses: [authorityLoss(), { field: 'withdrawal.kind', reason: 'v2 dismiss is not disambiguated from candidate dismissal' }] };
    case 'amend':
      return { ...base, hints: [extension(event)], losses: [authorityLoss(), { field: 'amendment', reason: 'v2 overwrite cannot become a v3 historical revision' }] };
    case 'premise_amend':
    case 'premise_resolve':
    case 'candidate_surfaced':
    case 'candidate_action':
    case 'bearing_set':
    case 'bearing_updated':
    case 'bearing_arrived':
    case 'bearing_abandoned':
    case 'waypoint':
    case 'gate_result':
    case 'sync_pending':
    case 'sync_attempted':
    case 'sync_succeeded':
    case 'sync_abandoned':
      return { ...base, hints: [extension(event)], losses: mapping.disposition === 'opaque' ? [] : [authorityLoss()] };
  }
}

export interface LegacyReadReport {
  adaptations: readonly LegacyAdaptation[];
  by_disposition: Readonly<Record<LegacyDisposition, number>>;
  named_losses: readonly LegacyLoss[];
}

export function readV2Legacy(events: readonly ArgusEvent[]): LegacyReadReport {
  const adaptations = events.map(adaptV2Event);
  const byDisposition: Record<LegacyDisposition, number> = { exact: 0, split: 0, degraded: 0, opaque: 0 };
  for (const adaptation of adaptations) byDisposition[adaptation.disposition] += 1;
  return {
    adaptations,
    by_disposition: byDisposition,
    named_losses: adaptations.flatMap((adaptation) => adaptation.losses),
  };
}

export interface LegacyJsonlDiagnostic {
  line: number;
  kind: 'invalid_json' | 'invalid_v2_event';
  reason: string;
}

/**
 * Read a v2 JSONL payload without rewriting it.  Bad lines stay visible to the
 * caller as diagnostics instead of being silently dropped or "repaired".
 */
export function readV2Jsonl(raw: string): {
  events: readonly ArgusEvent[];
  diagnostics: readonly LegacyJsonlDiagnostic[];
} {
  const events: ArgusEvent[] = [];
  const diagnostics: LegacyJsonlDiagnostic[] = [];
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const source = lines[index]?.trim();
    if (!source) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      diagnostics.push({
        line: index + 1,
        kind: 'invalid_json',
        reason: error instanceof Error ? error.message : 'JSON parse failed',
      });
      continue;
    }

    const event = ArgusEventSchema.safeParse(parsed);
    if (!event.success) {
      diagnostics.push({
        line: index + 1,
        kind: 'invalid_v2_event',
        reason: event.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      });
      continue;
    }
    events.push(event.data);
  }

  return { events, diagnostics };
}

/** P3 write-new proof: v3 writer accepts only current semantic events. */
export function prepareV3Write(event: unknown): SemanticEvent {
  return SemanticEventSchema.parse(event);
}

/** Compile-time/runtime drift guard used by tests and future adapter changes. */
export function mappedV2EventNames(): readonly string[] {
  return Object.keys(V2_MAPPING).sort();
}

export function declaredV2EventNames(): readonly string[] {
  return [...EVENT_NAMES].sort();
}
