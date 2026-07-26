import { z } from 'zod';

export const SEMANTIC_VERSION = 3 as const;
const be = (ko: string, en: string) => `${ko}\n\n${en}`;

const zId = z.string().min(1).max(128);
const zIsoDateTime = z.string().datetime({ offset: true });
const zPrincipalKind = z.enum(['human', 'ai', 'host', 'imported', 'system']);

export const DecisionKindSchema = z.enum(['prediction', 'commitment', 'declaration', 'witness']);
export type DecisionKind = z.infer<typeof DecisionKindSchema>;

export const AdoptionModeSchema = z.enum(['basis', 'check', 'wording']);
export type AdoptionMode = z.infer<typeof AdoptionModeSchema>;

export const ObservationSourceKindSchema = z.enum(['user_report', 'system_receipt', 'ai_analysis']);
export type ObservationSourceKind = z.infer<typeof ObservationSourceKindSchema>;

export const ReviewConditionStatusSchema = z.enum(['answered', 'skipped', 'not_asked']);
export type ReviewConditionStatus = z.infer<typeof ReviewConditionStatusSchema>;

export const KindEvidenceSchema = z.strictObject({
  source: z.enum(['wording_rule', 'elicitation_answer', 'user_override', 'legacy_default'])
    .describe(be('종류를 정한 근거가 표현 규칙·질문 답·사용자 수정·레거시 기본값 중 무엇인지 나타냅니다.', 'Which source established the kind: wording rule, elicitation answer, user override, or legacy default.')),
  rule: z.string().min(1).max(128).describe(be('적용한 도출 규칙의 안정적인 이름입니다.', 'Stable name of the derivation rule used.')),
  question: z.string().max(2000).optional().describe(be('종류를 확인하기 위해 사용자에게 물은 질문입니다.', 'Question asked to confirm what the sentence does.')),
  answer: z.string().max(4000).optional().describe(be('종류 확인 질문에 대한 사용자 답입니다.', 'The user’s answer to the kind-confirmation question.')),
  recorded_at: z.string().datetime({ offset: true }).describe(be('이 도출 근거를 기록한 ISO 시각입니다.', 'ISO time when this derivation evidence was recorded.')),
});
export type KindEvidence = z.infer<typeof KindEvidenceSchema>;

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
  kind: z.literal('answered').describe(be('관찰로 답할 수 있는 정산임을 나타냅니다.', 'A return that available observations can answer.')),
  answer_summary: z.string().min(1).max(2000).describe(be('무엇이 일어났는지 사용자의 말로 요약합니다.', 'What happened, summarized in the user’s own words.')),
  criterion_result: z.enum(['met', 'not_met', 'partial', 'unknown', 'not_observable', 'not_applicable']).optional()
    .describe(be('현실 조건이 충족됐는지를 별도 축으로 기록합니다.', 'Whether the real-world criterion was met, kept as a separate axis.')),
  commitment_result: z.enum(['enacted', 'maintained', 'revised', 'withdrawn', 'superseded']).optional()
    .describe(be('사용자의 약속이 어떻게 되었는지를 별도 축으로 기록합니다.', 'What happened to the user’s commitment, kept as a separate axis.')),
  question_validity: z.enum(['valid', 'narrowed', 'reframed', 'moot', 'indeterminate']).optional()
    .describe(be('처음 질문이 지금도 유효한지를 별도 축으로 기록합니다.', 'Whether the original question is still valid, kept as a separate axis.')),
  authorial_response: z.string().min(1).max(2000).optional().describe(be('정산 선택에 덧붙인 사용자 자신의 설명입니다.', 'The user’s own explanation added to the return choice.')),
  present_standard: z.strictObject({
    status: z.enum(['same', 'changed', 'withdrawn', 'skipped']).describe(be('그때의 기준을 지금도 유지하는지 나타냅니다.', 'Whether the user still holds the earlier standard.')),
    response_text: z.string().max(2000).optional().describe(be('현재 기준에 대한 사용자의 짧은 설명입니다.', 'The user’s short description of the present standard.')),
  }).optional().describe(be('현재 시점의 기준을 한 번만 확인한 답입니다.', 'One follow-up answer about the user’s present standard.')),
  evidence_refs: z.array(zId).min(1).max(32).describe(be('이 답을 뒷받침하는 관찰 기록 id 목록입니다.', 'Observation ids that support this answer.')),
});
const zIndeterminateResolution = z.strictObject({
  kind: z.literal('indeterminate').describe(be('현재 증거로 답할 수 없는 정산임을 나타냅니다.', 'A return that current evidence cannot answer.')),
  reason: z.string().min(1).max(2000).describe(be('왜 지금 답할 수 없는지 기록합니다.', 'Why the question cannot be answered yet.')),
  question_validity: z.literal('indeterminate').optional().describe(be('질문의 유효성을 아직 판단할 수 없음을 나타냅니다.', 'The question’s validity cannot yet be determined.')),
  authorial_response: z.string().min(1).max(2000).optional().describe(be('사용자가 덧붙인 자신의 설명입니다.', 'The user’s own additional explanation.')),
  present_standard: z.strictObject({
    status: z.enum(['same', 'changed', 'withdrawn', 'skipped']).describe(be('그때의 기준을 지금도 유지하는지 나타냅니다.', 'Whether the user still holds the earlier standard.')),
    response_text: z.string().max(2000).optional().describe(be('현재 기준에 대한 사용자의 짧은 설명입니다.', 'The user’s short description of the present standard.')),
  }).optional().describe(be('현재 시점의 기준을 한 번만 확인한 답입니다.', 'One follow-up answer about the user’s present standard.')),
  evidence_refs: z.array(zId).max(32).describe(be('관련 관찰 기록 id 목록입니다.', 'Related observation ids.')),
});
const zMootResolution = z.strictObject({
  kind: z.literal('moot').describe(be('처음 질문 자체가 더는 적용되지 않음을 나타냅니다.', 'A return where the original question no longer applies.')),
  reason: z.string().min(1).max(2000).describe(be('왜 질문이 무의미해졌는지 기록합니다.', 'Why the original question became moot.')),
  question_validity: z.literal('moot').optional().describe(be('질문이 더는 적용되지 않음을 별도 축으로 기록합니다.', 'Records on a separate axis that the question no longer applies.')),
  authorial_response: z.string().min(1).max(2000).optional().describe(be('사용자가 덧붙인 자신의 설명입니다.', 'The user’s own additional explanation.')),
  present_standard: z.strictObject({
    status: z.enum(['same', 'changed', 'withdrawn', 'skipped']).describe(be('그때의 기준을 지금도 유지하는지 나타냅니다.', 'Whether the user still holds the earlier standard.')),
    response_text: z.string().max(2000).optional().describe(be('현재 기준에 대한 사용자의 짧은 설명입니다.', 'The user’s short description of the present standard.')),
  }).optional().describe(be('현재 시점의 기준을 한 번만 확인한 답입니다.', 'One follow-up answer about the user’s present standard.')),
  evidence_refs: z.array(zId).max(32).describe(be('관련 관찰 기록 id 목록입니다.', 'Related observation ids.')),
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
    /** Required on new writes; optional here so historic v3 lines still parse. */
    source_kind: ObservationSourceKindSchema.optional(),
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
    /** Required on new writes; optional only for historic v3 compatibility. */
    kind: DecisionKindSchema.optional(),
    kind_evidence: KindEvidenceSchema.optional(),
    origin_utterance: z.string().min(1).max(8000).optional(),
    review_condition_status: ReviewConditionStatusSchema.optional(),
    review_condition: z.string().max(4000).optional(),
    source_proposal_id: zId.optional(),
    adoption_mode: AdoptionModeSchema.optional(),
  }),
  zAuthorial({
    ...B,
    event: z.literal('judgment_kind_corrected'),
    judgment_id: zId,
    from_kind: DecisionKindSchema,
    to_kind: DecisionKindSchema,
    kind_evidence: KindEvidenceSchema,
  }),
  zAuthorial({
    ...B,
    event: z.literal('judgment_statement_revised'),
    judgment_id: zId,
    from_statement: z.string().min(1).max(4000),
    to_statement: z.string().min(1).max(4000),
    reason: z.string().max(2000).optional(),
  }),
  zAuthorial({
    ...B,
    event: z.literal('premise_adopted'),
    premise_id: zId,
    judgment_id: zId,
    text: z.string().min(1).max(4000),
    source_proposal_id: zId.optional(),
    adoption_mode: AdoptionModeSchema.optional(),
  }),
  zAuthorial({
    ...B,
    event: z.literal('premise_challenged'),
    premise_id: zId,
    judgment_id: zId,
    challenge: z.string().min(1).max(4000),
    response: z.string().max(4000).optional(),
    disposition: z.enum(['open', 'corrected', 'rejected', 'upheld']),
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
    review_event: z.string().max(2000).optional(),
    fallback_review_at: zIsoDateTime.optional(),
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
  'judgment_kind_corrected',
  'judgment_statement_revised',
  'premise_adopted',
  'premise_challenged',
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
