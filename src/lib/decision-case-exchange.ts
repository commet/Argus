import { z } from 'zod';

/**
 * A read-only, rebuildable view of one decision-to-reality loop.
 *
 * This is deliberately not an event envelope or a reducer. It gives surfaces a
 * strict object to exchange and compare while semantic v3 remains the account
 * event protocol. Unknown legacy meaning stays unknown instead of being guessed.
 */

export const DECISION_CASE_EXCHANGE_VERSION = 'argus.case-projection.v1' as const;

const zId = z.string().min(1).max(256);
const zText = z.string().min(1).max(8000);
const zIsoDateTime = z.string().datetime({ offset: true });

const OriginSchema = z.strictObject({
  surface: z.enum(['web', 'remote_mcp', 'local_mcp', 'plugin', 'telegram', 'import']),
  instance_id: zId,
  canonical_stream: z.enum(['semantic_v3', 'method_harness_v1', 'legacy_decision_contract']),
});

const KnownAdoptedStateSchema = z.strictObject({
  status: z.literal('known'),
  value: z.enum(['decide', 'test', 'research', 'defer', 'reframe', 'stop']),
});

const UnknownAdoptedStateSchema = z.strictObject({ status: z.literal('legacy_unknown') });

const HumanAuthoritySchema = z.strictObject({
  status: z.literal('human_authorized'),
  mode: z.enum(['direct_command', 'explicit_confirmation']),
  source_ref: z.string().min(1).max(1024).optional(),
});

const LegacyAuthoritySchema = z.strictObject({ status: z.literal('legacy_unknown') });

const BaselineSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('captured'),
    lean: z.union([zText, z.literal('none_stated')]),
    stated_reasons: z.array(zText).max(32),
    recorded_at: zIsoDateTime.optional(),
  }),
  z.strictObject({ status: z.literal('not_captured') }),
  z.strictObject({ status: z.literal('legacy_unknown') }),
]);

const ContributionSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('recorded'),
    items: z.array(z.strictObject({
      contribution_id: zId,
      kind: z.enum(['move', 'card_draft', 'return_draft', 'basis', 'check', 'wording']),
      text: zText.optional(),
      recorded_at: zIsoDateTime.optional(),
    })).min(1).max(64),
  }),
  z.strictObject({ status: z.literal('none') }),
  z.strictObject({ status: z.literal('legacy_unknown') }),
]);

const AdoptionSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('adopted'),
    statement: zText,
    state: z.union([KnownAdoptedStateSchema, UnknownAdoptedStateSchema]),
    adopted_at: zIsoDateTime.optional(),
    mode: z.enum(['accept', 'edit_then_accept', 'user_asserted', 'legacy_unknown']),
    authority: z.union([HumanAuthoritySchema, LegacyAuthoritySchema]),
  }),
  z.strictObject({ status: z.literal('not_adopted') }),
  z.strictObject({
    status: z.literal('legacy_unknown'),
    statement: zText.optional(),
  }),
]);

const NextMoveSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('known'),
    action: zText,
    owner: z.string().min(1).max(512).optional(),
    by_or_when: z.string().min(1).max(1000).optional(),
    source: z.enum(['adopted_card', 'adopted_plan']),
  }),
  z.strictObject({
    status: z.literal('intentional_non_action'),
    state: z.enum(['defer', 'stop']),
  }),
  z.strictObject({ status: z.literal('not_captured') }),
  z.strictObject({ status: z.literal('legacy_unknown') }),
]);

const ReturnSchema = z.strictObject({
  permission: z.strictObject({
    status: z.enum(['pending', 'approved', 'declined', 'legacy_unknown']),
    recorded_at: zIsoDateTime.optional(),
  }),
  lifecycle: z.enum(['none', 'armed', 'awaiting_signal', 'returned', 'reviewed', 'legacy_unknown']),
  kind: z.enum(['commitment', 'signal', 'outcome', 'learning', 'legacy_unknown']).optional(),
  due_at: zIsoDateTime.optional(),
  signal: zText.optional(),
});

const ObservationSchema = z.strictObject({
  observation_id: zId,
  text: zText,
  observed_at: zIsoDateTime,
  source_kind: z.enum(['direct', 'relayed', 'user_report', 'system_receipt', 'ai_analysis', 'legacy_unknown']),
});

const LessonSchema = z.strictObject({
  lesson_id: zId,
  text: zText,
  scope: z.string().min(1).max(2000),
  status: z.enum(['candidate', 'approved']),
});

const ChronologySchema = z.strictObject({
  completeness: z.enum(['complete', 'partial', 'legacy_unknown']),
  events: z.array(z.strictObject({
    event_id: zId,
    event_type: z.string().min(1).max(128),
    occurred_at: zIsoDateTime,
    authority: z.enum(['user', 'ai', 'external', 'observed', 'system', 'legacy_unknown']),
  })).max(512),
});

export const DecisionCaseExchangeProjectionV1Schema = z.strictObject({
  schema_version: z.literal(DECISION_CASE_EXCHANGE_VERSION),
  aggregate_id: zId,
  account_id: zId.optional(),
  project_id: zId.optional(),
  linked_aggregate_ids: z.array(zId).max(64),
  origin: OriginSchema,
  baseline: BaselineSchema,
  contribution: ContributionSchema,
  adoption: AdoptionSchema,
  next_move: NextMoveSchema,
  return: ReturnSchema,
  observations: z.array(ObservationSchema).max(512),
  lessons: z.array(LessonSchema).max(256),
  chronology: ChronologySchema,
});

const { $schema: _schemaDialect, ...caseProjectionJsonSchema } = z.toJSONSchema(
  DecisionCaseExchangeProjectionV1Schema,
);

/** JSON Schema twin used by MCP outputSchema. It is generated from the same
 * Zod contract, so transport documentation cannot drift from runtime parsing. */
export const DECISION_CASE_EXCHANGE_JSON_SCHEMA = caseProjectionJsonSchema;

export type DecisionCaseExchangeProjectionV1 = z.infer<typeof DecisionCaseExchangeProjectionV1Schema>;

/** Parse a transport round-trip at the trust boundary. Strict schemas ensure a
 * sender cannot silently smuggle a new semantic field into an older consumer. */
export function parseDecisionCaseExchangeProjectionV1(
  value: unknown,
): DecisionCaseExchangeProjectionV1 {
  return DecisionCaseExchangeProjectionV1Schema.parse(value);
}
