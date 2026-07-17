import { z } from 'zod';

export const SEMANTIC_VERSION = 4 as const;
export const V4_SHADOW_ENV = 'ARGUS_SEMANTIC_V4_SHADOW' as const;

const zId = z.string().min(1).max(256);
const zIsoDateTime = z.string().datetime({ offset: true });

export const PrincipalRefSchema = z.strictObject({
  kind: z.enum(['human', 'ai', 'host', 'imported', 'system']),
  id: zId,
});
export type PrincipalRef = z.infer<typeof PrincipalRefSchema>;

export const AuthorizationRefSchema = z.strictObject({
  kind: z.enum(['user_utterance', 'command_digest', 'signed_import']),
  ref: z.string().min(1).max(1024),
});

export const AuthorityContextSchema = z.strictObject({
  originated_by: PrincipalRefSchema,
  recorded_by: PrincipalRefSchema,
  observed_by: PrincipalRefSchema.optional(),
  authorized_by: PrincipalRefSchema.optional(),
  authorization_mode: z.enum(['direct_command', 'explicit_confirmation', 'signed_import']).optional(),
  authorization_ref: AuthorizationRefSchema.optional(),
});
export type AuthorityContext = z.infer<typeof AuthorityContextSchema>;

export const ProvenanceSchema = z.strictObject({
  source_kind: z.enum(['user_utterance', 'ai_generation', 'host_report', 'import', 'manual']),
  source_ref: z.string().min(1).max(2048).optional(),
  verification: z.enum(['byte_verified', 'pasted', 'host_reported', 'unknown']).optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const TimeRangeSchema = z.strictObject({
  from: zIsoDateTime,
  to: zIsoDateTime,
}).superRefine((range, ctx) => {
  if (Date.parse(range.from) > Date.parse(range.to)) {
    ctx.addIssue({ code: 'custom', message: 'time range from must not exceed to' });
  }
});
export type TimeRange = z.infer<typeof TimeRangeSchema>;

export const TemporalContextSchema = z.strictObject({
  occurred_at: zIsoDateTime.optional(),
  recorded_at: zIsoDateTime,
  authorized_at: zIsoDateTime.optional(),
  temporal_mode: z.enum(['contemporaneous', 'retrospective']),
});
export type TemporalContext = z.infer<typeof TemporalContextSchema>;

export const AssertionScopeSchema = z.strictObject({
  subject_ref: zId.optional(),
  predicate_ref: zId.optional(),
  object_ref: zId.optional(),
  metric: z.string().min(1).max(256).optional(),
  unit: z.string().min(1).max(128).optional(),
  population: z.string().min(1).max(256).optional(),
  valid_time: TimeRangeSchema.optional(),
});
export type AssertionScope = z.infer<typeof AssertionScopeSchema>;

export const AssertionRoleSchema = z.enum([
  'prediction',
  'premise',
  'constraint',
  'criterion',
  'change_signal',
  'open_question',
  'rationale',
]);
export type AssertionRole = z.infer<typeof AssertionRoleSchema>;

export const AssertionSchema = z.strictObject({
  assertion_id: zId,
  role: AssertionRoleSchema,
  proposition: z.string().min(1).max(4000),
  scope: AssertionScopeSchema,
  modality: z.enum(['is', 'may', 'should', 'must', 'expected']).optional(),
  polarity: z.enum(['positive', 'negative']).optional(),
});
export type Assertion = z.infer<typeof AssertionSchema>;

export const EvidenceArtifactSchema = z.strictObject({
  evidence_id: zId,
  kind: z.enum(['url', 'document', 'dataset', 'measurement', 'message', 'manual_note']),
  locator: z.string().min(1).max(4096).optional(),
  content_hash: z.string().min(1).max(512).optional(),
  excerpt: z.string().min(1).max(1000).optional(),
  publisher: z.string().min(1).max(512).optional(),
  published_at: zIsoDateTime.optional(),
  retrieved_at: zIsoDateTime.optional(),
  access: z.enum(['available', 'restricted', 'deleted']),
});
export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>;

export const ObservationSchema = z.strictObject({
  observation_id: zId,
  report: z.string().min(1).max(4000),
  measured_value: z.strictObject({ value: z.number(), unit: z.string().min(1).max(128) }).optional(),
  valid_time: TimeRangeSchema,
  evidence_refs: z.array(zId).max(32),
  confidence: z.number().min(0).max(1).optional(),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const EntityRefSchema = z.strictObject({
  kind: z.enum(['decision', 'judgment', 'assertion', 'observation', 'evidence']),
  id: zId,
});
export type EntityRef = z.infer<typeof EntityRefSchema>;

export const SemanticRelationTypeSchema = z.enum([
  'same_fact',
  'supports',
  'contradicts',
  'updates',
  'depends_on',
  'shared_constraint',
  'same_question',
  'derived_from',
]);
export type SemanticRelationType = z.infer<typeof SemanticRelationTypeSchema>;

const SystemVerifiableRelationTypeSchema = z.enum([
  'same_fact',
  'updates',
  'same_question',
  'derived_from',
]);

export const RelationSchema = z.strictObject({
  relation_id: zId,
  type: SemanticRelationTypeSchema,
  from_ref: EntityRefSchema,
  to_ref: EntityRefSchema,
  direction: z.enum(['directed', 'symmetric']),
  scope: AssertionScopeSchema.optional(),
  valid_time: TimeRangeSchema.optional(),
  evidence_refs: z.array(zId).max(32),
  endpoint_evidence: z.strictObject({
    from: z.array(zId).max(16),
    to: z.array(zId).max(16),
  }).optional(),
  proposed_by: PrincipalRefSchema,
  validator_version: z.string().min(1).max(128).optional(),
  counterexample_checked: z.boolean().optional(),
  importance_reason: z.string().min(1).max(1000).optional(),
  status: z.enum(['proposed', 'system_verified', 'human_confirmed', 'human_rejected', 'superseded']),
});
export type Relation = z.infer<typeof RelationSchema>;

export const ReturnTriggerSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('date'), at: zIsoDateTime }),
  z.strictObject({ kind: z.literal('event'), event: z.string().min(1).max(1000) }),
  z.strictObject({
    kind: z.literal('metric'), metric: z.string().min(1).max(256),
    comparator: z.enum(['gt', 'gte', 'lt', 'lte', 'changed']),
    threshold: z.number(), unit: z.string().min(1).max(128),
  }),
  z.strictObject({ kind: z.literal('evidence'), query: z.string().min(1).max(1000) }),
  z.strictObject({ kind: z.literal('manual') }),
]);
export type ReturnTrigger = z.infer<typeof ReturnTriggerSchema>;

export const ResolutionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('answered'), answer_summary: z.string().min(1).max(2000),
    criterion_result: z.enum(['met', 'not_met', 'partial', 'not_applicable']).optional(),
    evidence_refs: z.array(zId).min(1).max(32),
  }),
  z.strictObject({ kind: z.literal('indeterminate'), reason: z.string().min(1).max(2000), evidence_refs: z.array(zId).max(32) }),
  z.strictObject({ kind: z.literal('moot'), reason: z.string().min(1).max(2000), evidence_refs: z.array(zId).max(32) }),
]);
export type Resolution = z.infer<typeof ResolutionSchema>;

const EventBase = {
  event_id: zId,
  v: z.literal(SEMANTIC_VERSION),
  space_id: zId,
  idempotency_key: zId,
  time: TemporalContextSchema,
  authority: AuthorityContextSchema,
  provenance: ProvenanceSchema.optional(),
  causal_parent_ids: z.array(zId).max(32).optional(),
  atomic_batch_id: zId.optional(),
} as const;

const authorial = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape).superRefine((event, ctx) => {
  const authority = (event as { authority: AuthorityContext }).authority;
  if (authority.authorized_by?.kind !== 'human') {
    ctx.addIssue({ code: 'custom', message: 'authorial event requires human authorized_by' });
  }
  if (!authority.authorization_mode || !authority.authorization_ref) {
    ctx.addIssue({ code: 'custom', message: 'authorial event requires authorization mode and evidence' });
  }
});

const decisionOpened = authorial({
  ...EventBase,
  event: z.literal('decision_opened'),
  decision_id: zId,
  question: z.string().min(1).max(2000),
});

const assertionProposed = z.strictObject({
  ...EventBase,
  event: z.literal('assertion_proposed'),
  proposal_id: zId,
  assertion: AssertionSchema,
});

const assertionRecorded = authorial({
  ...EventBase,
  event: z.literal('assertion_recorded'),
  assertion: AssertionSchema,
});

const assertionAdopted = authorial({
  ...EventBase,
  event: z.literal('assertion_adopted'),
  proposal_id: zId,
  decision_id: zId,
  assertion: AssertionSchema,
});

const evidenceRecorded = z.strictObject({
  ...EventBase,
  event: z.literal('evidence_recorded'),
  evidence: EvidenceArtifactSchema,
}).superRefine((event, ctx) => {
  if (!event.provenance) ctx.addIssue({ code: 'custom', message: 'evidence requires provenance' });
});

const evidenceAccessChanged = z.strictObject({
  ...EventBase,
  event: z.literal('evidence_access_changed'),
  evidence_id: zId,
  access: z.enum(['available', 'restricted', 'deleted']),
});

const observationRecorded = z.strictObject({
  ...EventBase,
  event: z.literal('observation_recorded'),
  observation: ObservationSchema,
}).superRefine((event, ctx) => {
  if (!event.authority.observed_by && !event.provenance) {
    ctx.addIssue({ code: 'custom', message: 'observation requires observed_by or provenance' });
  }
});

const observationChallenged = authorial({
  ...EventBase,
  event: z.literal('observation_challenged'),
  observation_id: zId,
  reason: z.string().min(1).max(2000),
});

const judgmentSealed = authorial({
  ...EventBase,
  event: z.literal('judgment_sealed'),
  judgment_id: zId,
  decision_id: zId,
  version: z.number().int().min(1),
  statement: z.string().min(1).max(4000),
  assertion_refs: z.array(zId).max(64),
  basis_known_as_of: zIsoDateTime,
  supersedes_judgment_id: zId.optional(),
  change_rationale_ref: zId.optional(),
});

const returnPromised = authorial({
  ...EventBase,
  event: z.literal('return_promised'),
  return_contract_id: zId,
  decision_id: zId,
  trigger: ReturnTriggerSchema,
  review_question: z.string().min(1).max(4000),
  resolution_criterion: z.string().min(1).max(4000).optional(),
});

const resolutionAsserted = authorial({
  ...EventBase,
  event: z.literal('resolution_asserted'),
  resolution_id: zId,
  decision_id: zId,
  judgment_id: zId,
  resolution: ResolutionSchema,
});

const judgmentClosed = authorial({
  ...EventBase,
  event: z.literal('judgment_closed'),
  decision_id: zId,
  judgment_id: zId,
  resolution_id: zId,
});

const relationProposed = z.strictObject({
  ...EventBase,
  event: z.literal('relation_proposed'),
  relation: RelationSchema,
}).superRefine((event, ctx) => {
  if (event.relation.status !== 'proposed') ctx.addIssue({ code: 'custom', message: 'proposed relation must have proposed status' });
});

const relationVerified = z.strictObject({
  ...EventBase,
  event: z.literal('relation_verified'),
  relation: RelationSchema,
  verification_basis: z.enum(['same_entity_id', 'same_content_hash', 'same_normalized_url', 'same_series_id', 'structural']),
}).superRefine((event, ctx) => {
  if (event.relation.status !== 'system_verified') ctx.addIssue({ code: 'custom', message: 'verified relation must have system_verified status' });
  if (!SystemVerifiableRelationTypeSchema.safeParse(event.relation.type).success) {
    ctx.addIssue({ code: 'custom', message: 'semantic relation type cannot be system_verified in K1' });
  }
});

const relationConfirmed = authorial({
  ...EventBase,
  event: z.literal('relation_confirmed'),
  relation: RelationSchema,
});

const relationRejected = authorial({
  ...EventBase,
  event: z.literal('relation_rejected'),
  relation_id: zId,
  reason: z.string().max(2000).optional(),
});

const watchCheckRecorded = z.strictObject({
  ...EventBase,
  event: z.literal('watch_check_recorded'),
  check_id: zId,
  assertion_id: zId,
  previous_value: z.number().optional(),
  current_value: z.number().optional(),
  source_verified: z.boolean(),
  evidence_refs: z.array(zId).max(32),
  material: z.boolean(),
});

export const SemanticEventSchema = z.union([
  decisionOpened,
  assertionProposed,
  assertionRecorded,
  assertionAdopted,
  evidenceRecorded,
  evidenceAccessChanged,
  observationRecorded,
  observationChallenged,
  judgmentSealed,
  returnPromised,
  resolutionAsserted,
  judgmentClosed,
  relationProposed,
  relationVerified,
  relationConfirmed,
  relationRejected,
  watchCheckRecorded,
]);

export type SemanticEvent = z.infer<typeof SemanticEventSchema>;
export type SemanticEventName = SemanticEvent['event'];

export const AUTHORIAL_EVENT_NAMES = new Set<SemanticEventName>([
  'decision_opened',
  'assertion_recorded',
  'assertion_adopted',
  'observation_challenged',
  'judgment_sealed',
  'return_promised',
  'resolution_asserted',
  'judgment_closed',
  'relation_confirmed',
  'relation_rejected',
]);
