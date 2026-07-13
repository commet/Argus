import { z } from 'zod';

export const SEMANTIC_VERSION = 3 as const;

const zId = z.string().min(1).max(128);
const zIsoDateTime = z.string().datetime({ offset: true });
const zPrincipalKind = z.enum(['human', 'ai', 'host', 'imported', 'system']);

export const PrincipalRefSchema = z.strictObject({
  kind: zPrincipalKind,
  id: zId,
});
export type PrincipalRef = z.infer<typeof PrincipalRefSchema>;

export const AuthorizationRefSchema = z.strictObject({
  kind: z.enum(['user_utterance', 'command_digest', 'signed_import']),
  ref: z.string().min(1).max(1024),
});
export type AuthorizationRef = z.infer<typeof AuthorizationRefSchema>;

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
  source_ref: z.string().min(1).max(1024).optional(),
  verification: z.enum(['byte_verified', 'pasted', 'host_reported', 'unknown']).optional(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const TemporalContextSchema = z.strictObject({
  occurred_at: zIsoDateTime.optional(),
  recorded_at: zIsoDateTime,
  authorized_at: zIsoDateTime.optional(),
  temporal_mode: z.enum(['contemporaneous', 'retrospective']),
});
export type TemporalContext = z.infer<typeof TemporalContextSchema>;

const B = {
  event_id: zId,
  v: z.literal(SEMANTIC_VERSION),
  space_id: zId,
  idempotency_key: zId,
  time: TemporalContextSchema,
  authority: AuthorityContextSchema,
  provenance: ProvenanceSchema.optional(),
  causal_parent_ids: z.array(zId).max(16).optional(),
  atomic_batch_id: zId.optional(),
} as const;

const zAuthorial = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject(shape).superRefine((event, ctx) => {
    const authority = (event as { authority: AuthorityContext }).authority;
    if (authority.authorized_by?.kind !== 'human') {
      ctx.addIssue({ code: 'custom', message: 'authorial event requires a human authorized_by' });
    }
    if (!authority.authorization_mode || !authority.authorization_ref) {
      ctx.addIssue({ code: 'custom', message: 'authorial event requires authorization mode and evidence' });
    }
  });

const zAnsweredResolution = z.strictObject({
  kind: z.literal('answered'),
  answer_summary: z.string().min(1).max(2000),
  criterion_result: z.enum(['met', 'not_met', 'partial', 'not_applicable']).optional(),
  evidence_refs: z.array(zId).min(1).max(32),
});
const zIndeterminateResolution = z.strictObject({
  kind: z.literal('indeterminate'),
  reason: z.string().min(1).max(2000),
  evidence_refs: z.array(zId).max(32),
});
const zMootResolution = z.strictObject({
  kind: z.literal('moot'),
  reason: z.string().min(1).max(2000),
  evidence_refs: z.array(zId).max(32),
});
export const ResolutionSchema = z.discriminatedUnion('kind', [
  zAnsweredResolution,
  zIndeterminateResolution,
  zMootResolution,
]);
export type Resolution = z.infer<typeof ResolutionSchema>;

export const SemanticEventSchema = z.discriminatedUnion('event', [
  z.strictObject({
    ...B,
    event: z.literal('proposal_created'),
    proposal_id: zId,
    proposal_kind: z.enum(['judgment', 'premise', 'relationship']),
    text: z.string().min(1).max(4000),
  }),
  z.strictObject({
    ...B,
    event: z.literal('proposal_rejected'),
    proposal_id: zId,
    reason: z.string().max(2000).optional(),
  }),
  z.strictObject({
    ...B,
    event: z.literal('assertion_recorded'),
    assertion_id: zId,
    text: z.string().min(1).max(4000),
  }),
  z.strictObject({
    ...B,
    event: z.literal('observation_recorded'),
    observation_id: zId,
    text: z.string().min(1).max(4000),
  }).superRefine((event, ctx) => {
    if (!event.authority.observed_by && !event.provenance) {
      ctx.addIssue({ code: 'custom', message: 'observation requires observed_by or provenance' });
    }
  }),
  zAuthorial({
    ...B,
    event: z.literal('judgment_sealed'),
    judgment_id: zId,
    statement: z.string().min(1).max(4000),
    source_proposal_id: zId.optional(),
  }),
  zAuthorial({
    ...B,
    event: z.literal('premise_adopted'),
    premise_id: zId,
    judgment_id: zId,
    text: z.string().min(1).max(4000),
  }),
  zAuthorial({
    ...B,
    event: z.literal('premise_retired'),
    premise_id: zId,
    judgment_id: zId,
    reason: z.string().max(2000).optional(),
  }),
  zAuthorial({
    ...B,
    event: z.literal('return_promised'),
    return_contract_id: zId,
    judgment_id: zId,
    review_at: zIsoDateTime,
    review_question: z.string().min(1).max(4000),
    resolution_criterion: z.string().max(4000).optional(),
  }),
  zAuthorial({
    ...B,
    event: z.literal('return_deferred'),
    return_contract_id: zId,
    review_at: zIsoDateTime,
    reason: z.string().max(2000).optional(),
  }),
  zAuthorial({
    ...B,
    event: z.literal('return_contract_superseded'),
    judgment_id: zId,
    old_return_contract_id: zId,
    new_return_contract_id: zId,
  }),
  zAuthorial({
    ...B,
    event: z.literal('resolution_asserted'),
    resolution_id: zId,
    judgment_id: zId,
    return_contract_id: zId,
    resolution: ResolutionSchema,
  }),
  zAuthorial({
    ...B,
    event: z.literal('judgment_closed'),
    judgment_id: zId,
    resolution_id: zId,
  }),
  zAuthorial({
    ...B,
    event: z.literal('judgment_withdrawn'),
    judgment_id: zId,
    reason: z.string().max(2000).optional(),
  }),
  zAuthorial({
    ...B,
    event: z.literal('judgment_superseded'),
    judgment_id: zId,
    successor_judgment_id: zId,
  }),
  zAuthorial({
    ...B,
    event: z.literal('judgment_erased'),
    judgment_id: zId,
    erasure_receipt_id: zId,
  }),
]);

export type SemanticEvent = z.infer<typeof SemanticEventSchema>;
export type SemanticEventName = SemanticEvent['event'];

export const AUTHORIAL_EVENT_NAMES = new Set<SemanticEventName>([
  'judgment_sealed',
  'premise_adopted',
  'premise_retired',
  'return_promised',
  'return_deferred',
  'return_contract_superseded',
  'resolution_asserted',
  'judgment_closed',
  'judgment_withdrawn',
  'judgment_superseded',
  'judgment_erased',
]);

export type Lifecycle =
  | 'proposal'
  | 'sealed'
  | 'due'
  | 'resolved_answered'
  | 'resolved_indeterminate'
  | 'resolved_moot'
  | 'withdrawn'
  | 'superseded'
  | 'erased'
  | 'conflict';
