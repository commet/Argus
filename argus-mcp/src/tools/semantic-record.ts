import { z } from 'zod';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { envelope, toolError, type McpToolResult } from '../lib/envelope.js';
import { fold, foldAsOf, projectJudgment } from '../v3/reducer.js';
import {
  appendSemanticEvents,
  localSpaceId,
  readSemanticLedger,
  semanticLedgerPath,
  SemanticLedgerError,
} from '../v3/store.js';
import {
  DecisionKindSchema,
  KindEvidenceSchema,
  ObservationSourceKindSchema,
  ResolutionSchema,
  ReviewConditionStatusSchema,
  type Resolution,
  type SemanticEvent,
} from '../v3/types.js';
import { deriveDecisionKind } from '../v3/kind.js';
import { zArgusDir, type ToolModule } from './tool-types.js';

const zLocalId = z.string()
  .regex(/^[A-Za-z0-9._-]+$/, 'id may only contain A-Z a-z 0-9 . _ -')
  .min(1)
  .max(96);
const zIsoTime = z.string().datetime({ offset: true });
const be = (ko: string, en: string) => `${ko}\n\n${en}`;

const authorizationSchema = z.strictObject({
  mode: z.enum(['direct_command', 'explicit_confirmation'])
    .describe(be(
      '사용자가 직접 명령했는지, 제안된 기록을 명시적으로 확인했는지 나타냅니다.',
      'Whether the user directly commanded the write or explicitly confirmed a proposed record.',
    )),
  evidence_kind: z.enum(['user_utterance', 'command_digest'])
    .describe(be(
      '권한 근거가 사용자 발화인지 확인 다이제스트인지 나타냅니다.',
      'Whether the authority evidence is a user utterance or a confirmation digest.',
    )),
  evidence_ref: z.string().min(1).max(1024)
    .describe(be(
      '사용자 발화 또는 확인 다이제스트를 가리키는 호스트 참조입니다.',
      'A host reference to the user utterance or confirmation digest.',
    )),
}).superRefine((value, ctx) => {
  const expected = value.mode === 'direct_command' ? 'user_utterance' : 'command_digest';
  if (value.evidence_kind !== expected) {
    ctx.addIssue({
      code: 'custom',
      path: ['evidence_kind'],
      message: `${value.mode} requires ${expected}`,
    });
  }
});

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  action: z.enum(['seal', 'correct_kind', 'revise_statement', 'observe', 'defer', 'resolve', 'close', 'read'])
    .describe('봉인·종류 수정·문장 수정·관찰·연기·정산·닫기·읽기 중 수행할 동작입니다.'),
  request_id: zLocalId.optional()
    .describe(be('쓰기 재시도에서 같은 값을 사용하는 안정적인 요청 id입니다.', 'Stable request id reused when retrying the same write.')),
  judgment_id: zLocalId.optional().describe(be('판단 기록의 안정적인 id입니다.', 'Stable id for this record.')),

  statement: z.string().min(1).max(4000).optional().describe(be('사용자가 승인해 봉인하거나 새로 수정할 문장입니다.', 'The user-authorized sentence to seal or the new wording of a revision.')),
  from_statement: z.string().min(1).max(4000).optional().describe(be('수정 직전의 현재 문장입니다. 과거 문장과의 연결을 검증합니다.', 'The current sentence immediately before a revision, used to verify the append-only link.')),
  revision_reason: z.string().max(2000).optional().describe(be('사용자가 문장을 바꾼 이유입니다. 선택 사항입니다.', 'Optional reason the user gives for revising the sentence.')),
  decision_kind: DecisionKindSchema.optional().describe(be('문장이 하는 일을 예측·약속·기준 선언·기록 중 하나로 나타냅니다.', 'What the sentence does: prediction, commitment, declaration, or witness.')),
  from_kind: DecisionKindSchema.optional().describe(be('종류 수정 전의 종류입니다.', 'The kind immediately before a correction.')),
  to_kind: DecisionKindSchema.optional().describe(be('사용자가 수정해 선택한 새 종류입니다.', 'The new kind explicitly selected by the user.')),
  kind_evidence: KindEvidenceSchema.optional().describe(be('어떤 규칙과 답으로 종류를 정했는지 남기는 근거입니다.', 'Evidence showing which rule or user answer produced the kind.')),
  origin_utterance: z.string().min(1).max(8000).optional().describe(be('구조화하기 전 사용자의 첫 발화 원문입니다.', 'The user’s first verbatim utterance before any structuring.')),
  review_condition_status: ReviewConditionStatusSchema.optional().describe(be('귀환 조건 질문이 답변·건너뜀·묻지 않음 중 무엇이었는지 나타냅니다.', 'Whether the return-condition question was answered, skipped, or not asked.')),
  review_condition: z.string().max(4000).optional().describe(be('왜 이 기록을 다시 볼 가치가 있는지 정한 조건입니다.', 'The condition that makes this record worth returning to.')),

  review_at: zIsoTime.optional().describe(be('늦어도 다시 볼 ISO 시각입니다.', 'ISO time by which the record should be revisited.')),
  review_question: z.string().min(1).max(4000).optional().describe(be('돌아왔을 때 답할 구체적인 질문입니다.', 'The concrete question to answer on return.')),
  review_event: z.string().max(2000).optional().describe(be('날짜보다 먼저 기록을 다시 불러올 현실 사건입니다.', 'A real-world event that can bring the record back before the date.')),
  fallback_review_at: zIsoTime.optional().describe(be('사건이 없더라도 다시 볼 최종 ISO 시각입니다.', 'Fallback ISO time if the event is not detected.')),
  resolution_criterion: z.string().min(1).max(4000).optional().describe(be('답을 해석할 사전 기준입니다.', 'The criterion fixed in advance for interpreting the later answer.')),
  return_contract_id: zLocalId.optional().describe(be('귀환 약속의 안정적인 id입니다.', 'Stable id for the return promise.')),

  proposal_id: zLocalId.optional().describe(be('채택 전 AI 제안의 안정적인 id입니다.', 'Stable id for an AI proposal before adoption.')),
  proposal_text: z.string().min(1).max(4000).optional().describe(be('채택되기 전 AI 제안의 원문입니다.', 'The AI proposal verbatim before adoption.')),
  proposal_source_ref: z.string().min(1).max(1024).optional().describe(be('AI 제안이 나온 문서나 메시지 참조입니다.', 'Reference to the document or message where the AI proposal originated.')),
  adoption_mode: z.enum(['basis', 'check', 'wording']).optional().describe(be('제안의 근거·검사·표현 중 사용자가 채택한 부분입니다.', 'Which part the user adopted: basis, check, or wording.')),

  observation_id: zLocalId.optional().describe(be('관찰 기록의 안정적인 id입니다.', 'Stable id for the observation.')),
  observation_text: z.string().min(1).max(4000).optional().describe(be('실제로 관찰되거나 보고된 내용을 적습니다.', 'What was actually observed or reported.')),
  observation_source_kind: ObservationSourceKindSchema.optional().describe(be('관찰 출처가 사용자 보고·시스템 영수증·AI 분석 중 무엇인지 나타냅니다.', 'Whether the observation came from a user report, system receipt, or AI analysis.')),
  observation_occurred_at: zIsoTime.optional().describe(be('관찰 대상 사건이 실제로 일어난 ISO 시각입니다.', 'ISO time when the observed event actually occurred.')),

  resolution_id: zLocalId.optional().describe(be('한 정산 답의 안정적인 id입니다.', 'Stable id for one return answer.')),
  resolution: ResolutionSchema.optional().describe(be('현실·약속·질문 타당성을 합치지 않고 축별로 남기는 답입니다.', 'A return answer that keeps reality, commitment, and question validity on separate axes.')),
  defer_reason: z.string().max(2000).optional().describe(be('아직 답할 수 없어 귀환을 미루는 이유입니다.', 'Why the user cannot answer yet and is deferring the return.')),
  authorization: authorizationSchema.optional().describe(be('사람이 이 쓰기를 승인했다는 권한 근거입니다.', 'Authority evidence showing that a human approved this write.')),
  as_of: zIsoTime.optional().describe(be('이 시각까지의 이벤트만 접어 읽는 기준 ISO 시각입니다.', 'ISO cutoff used to fold and read only events recorded by that time.')),
}).superRefine((value, ctx) => {
  const need = (field: keyof typeof value, message: string) => {
    if (value[field] === undefined) ctx.addIssue({ code: 'custom', path: [field], message });
  };
  const authorial = ['seal', 'correct_kind', 'revise_statement', 'defer', 'resolve', 'close'].includes(value.action);
  if (authorial) need('authorization', 'explicit human authorization is required');
  if (value.action !== 'read') need('request_id', 'request_id is required for a write');
  need('judgment_id', 'judgment_id is required');

  if (value.action === 'seal') {
    need('statement', 'statement is required to seal');
    if (value.decision_kind !== 'witness') {
      need('review_at', 'review_at is required unless decision_kind is witness');
      need('review_question', 'review_question is required unless decision_kind is witness');
    }
    if ((value.proposal_id && !value.proposal_text) || (!value.proposal_id && value.proposal_text)) {
      ctx.addIssue({
        code: 'custom',
        path: ['proposal_id'],
        message: 'proposal_id and proposal_text must be provided together',
      });
    }
    if (value.proposal_id) need('adoption_mode', 'adoption_mode is required for an adopted proposal');
  }
  if (value.action === 'correct_kind') {
    need('from_kind', 'from_kind is required');
    need('to_kind', 'to_kind is required');
    need('kind_evidence', 'kind_evidence is required');
    if (value.from_kind === 'witness' && value.to_kind !== 'witness') {
      need('return_contract_id', 'return_contract_id is required when a witness becomes a returnable record');
      need('review_at', 'review_at is required when a witness becomes a returnable record');
      need('review_question', 'review_question is required when a witness becomes a returnable record');
    }
  }
  if (value.action === 'revise_statement') {
    need('from_statement', 'from_statement is required');
    need('statement', 'statement is required with the revised wording');
  }
  if (value.action === 'observe') {
    need('observation_id', 'observation_id is required');
    need('observation_text', 'observation_text is required');
  }
  if (value.action === 'defer') {
    need('return_contract_id', 'return_contract_id is required');
    need('review_at', 'review_at is required');
  }
  if (value.action === 'resolve') {
    need('return_contract_id', 'return_contract_id is required');
    need('resolution_id', 'resolution_id is required');
    need('resolution', 'resolution is required');
  }
  if (value.action === 'close') need('resolution_id', 'resolution_id is required');
});

type Command = z.infer<typeof inputSchema>;

function now(): string {
  return new Date().toISOString();
}

function authority(spaceId: string, authorization: NonNullable<Command['authorization']>) {
  const human = { kind: 'human' as const, id: `local:${spaceId}` };
  return {
    originated_by: human,
    recorded_by: { kind: 'system' as const, id: 'mcp:argus-record' },
    authorized_by: human,
    authorization_mode: authorization.mode,
    authorization_ref: {
      kind: authorization.evidence_kind,
      ref: authorization.evidence_ref,
    },
  };
}

function base(
  command: Command,
  sequence: number,
  time: string,
  auth: NonNullable<Command['authorization']>,
): Pick<SemanticEvent, 'event_id' | 'v' | 'space_id' | 'idempotency_key' | 'time' | 'authority'> {
  const spaceId = localSpaceId(resolveToolArgusDir(command.argus_dir));
  return {
    event_id: `${command.request_id!}.${sequence}`,
    v: 3,
    space_id: spaceId,
    idempotency_key: `${command.request_id!}.${sequence}`,
    time: {
      recorded_at: time,
      authorized_at: time,
      temporal_mode: 'contemporaneous',
    },
    authority: authority(spaceId, auth),
  };
}

function proposalEvent(command: Command, time: string): SemanticEvent {
  const spaceId = localSpaceId(resolveToolArgusDir(command.argus_dir));
  return {
    event_id: `${command.request_id!}.0`,
    v: 3,
    space_id: spaceId,
    idempotency_key: `${command.request_id!}.0`,
    time: { recorded_at: time, temporal_mode: 'contemporaneous' },
    authority: {
      originated_by: { kind: 'ai', id: 'mcp:argus-record' },
      recorded_by: { kind: 'system', id: 'mcp:argus-record' },
    },
    provenance: {
      source_kind: 'ai_generation',
      ...(command.proposal_source_ref ? { source_ref: command.proposal_source_ref } : {}),
      verification: 'unknown',
    },
    event: 'proposal_created',
    proposal_id: command.proposal_id!,
    proposal_kind: 'judgment',
    text: command.proposal_text!,
  };
}

function actionEvents(command: Command, time: string): SemanticEvent[] {
  const auth = command.authorization!;
  const shared = (sequence: number) => base(command, sequence, time, auth);
  switch (command.action) {
    case 'seal': {
      const derived = deriveDecisionKind({
        statement: command.statement!,
        explicit_kind: command.decision_kind,
        record_only: command.decision_kind === 'witness',
        has_return_handle: Boolean(command.review_at || command.review_event),
      });
      const events: SemanticEvent[] = [];
      let sequence = 0;
      if (command.proposal_id && command.proposal_text) {
        events.push(proposalEvent(command, time));
        sequence += 1;
      }
      events.push({
        ...shared(sequence++),
        event: 'judgment_sealed',
        judgment_id: command.judgment_id!,
        statement: command.statement!,
        kind: derived.kind,
        kind_evidence: command.kind_evidence ?? {
          source: command.decision_kind ? 'elicitation_answer' : 'wording_rule',
          rule: derived.rule,
          answer: command.decision_kind ?? derived.kind,
          recorded_at: time,
        },
        origin_utterance: command.origin_utterance ?? command.statement!,
        review_condition_status: command.review_condition_status
          ?? (command.review_condition?.trim() ? 'answered' : 'not_asked'),
        ...(command.review_condition ? { review_condition: command.review_condition } : {}),
        ...(command.proposal_id ? {
          source_proposal_id: command.proposal_id,
          adoption_mode: command.adoption_mode!,
        } : {}),
      });
      if (derived.kind !== 'witness') {
        events.push({
          ...shared(sequence),
          event: 'return_promised',
          return_contract_id: command.return_contract_id ?? `${command.judgment_id}.return`,
          judgment_id: command.judgment_id!,
          review_at: command.review_at!,
          review_question: command.review_question!,
          ...(command.resolution_criterion ? { resolution_criterion: command.resolution_criterion } : {}),
          ...(command.review_event ? { review_event: command.review_event } : {}),
          ...(command.fallback_review_at ? { fallback_review_at: command.fallback_review_at } : {}),
        });
      }
      return events;
    }
    case 'correct_kind': {
      const events: SemanticEvent[] = [{
        ...shared(0),
        event: 'judgment_kind_corrected',
        judgment_id: command.judgment_id!,
        from_kind: command.from_kind!,
        to_kind: command.to_kind!,
        kind_evidence: command.kind_evidence!,
      }];
      if (command.from_kind === 'witness' && command.to_kind !== 'witness') {
        events.push({
          ...shared(1),
          event: 'return_promised',
          return_contract_id: command.return_contract_id!,
          judgment_id: command.judgment_id!,
          review_at: command.review_at!,
          review_question: command.review_question!,
          ...(command.resolution_criterion ? { resolution_criterion: command.resolution_criterion } : {}),
          ...(command.review_event ? { review_event: command.review_event } : {}),
          ...(command.fallback_review_at ? { fallback_review_at: command.fallback_review_at } : {}),
        });
      }
      return events;
    }
    case 'revise_statement':
      return [{
        ...shared(0),
        event: 'judgment_statement_revised',
        judgment_id: command.judgment_id!,
        from_statement: command.from_statement!,
        to_statement: command.statement!,
        ...(command.revision_reason ? { reason: command.revision_reason } : {}),
      }];
    case 'observe': {
      const spaceId = localSpaceId(resolveToolArgusDir(command.argus_dir));
      const sourceKind = command.observation_source_kind ?? 'user_report';
      const origin = sourceKind === 'ai_analysis'
        ? { kind: 'ai' as const, id: 'mcp:argus-record' }
        : sourceKind === 'system_receipt'
          ? { kind: 'host' as const, id: 'mcp-host' }
          : { kind: 'human' as const, id: `local:${spaceId}` };
      return [{
        event_id: `${command.request_id!}.0`,
        v: 3,
        space_id: spaceId,
        idempotency_key: `${command.request_id!}.0`,
        time: {
          occurred_at: command.observation_occurred_at ?? time,
          recorded_at: time,
          temporal_mode: command.observation_occurred_at ? 'retrospective' : 'contemporaneous',
        },
        authority: {
          originated_by: origin,
          recorded_by: { kind: 'system', id: 'mcp:argus-record' },
          observed_by: origin,
        },
        provenance: {
          source_kind: sourceKind === 'user_report'
            ? 'user_utterance'
            : sourceKind === 'system_receipt'
              ? 'host_report'
              : 'ai_generation',
          ...(sourceKind === 'user_report'
            ? {}
            : { verification: sourceKind === 'system_receipt' ? 'host_reported' as const : 'unknown' as const }),
        },
        event: 'observation_recorded',
        observation_id: command.observation_id!,
        text: command.observation_text!,
        source_kind: sourceKind,
      }];
    }
    case 'defer':
      return [{
        ...shared(0),
        event: 'return_deferred',
        return_contract_id: command.return_contract_id!,
        review_at: command.review_at!,
        ...(command.defer_reason ? { reason: command.defer_reason } : {}),
      }];
    case 'resolve':
      return [{
        ...shared(0),
        event: 'resolution_asserted',
        resolution_id: command.resolution_id!,
        judgment_id: command.judgment_id!,
        return_contract_id: command.return_contract_id!,
        resolution: command.resolution! as Resolution,
      }];
    case 'close':
      return [{
        ...shared(0),
        event: 'judgment_closed',
        judgment_id: command.judgment_id!,
        resolution_id: command.resolution_id!,
      }];
    case 'read':
      return [];
  }
}

function receipt(events: readonly SemanticEvent[]) {
  return events.map((event) => ({
    event_id: event.event_id,
    event: event.event,
    recorded_at: event.time.recorded_at,
    ...(event.authority.authorized_by ? {
      authorized_by: event.authority.authorized_by,
      authorization_mode: event.authority.authorization_mode,
      authorization_ref: event.authority.authorization_ref,
    } : {
      observed_by: event.authority.observed_by,
      provenance: event.provenance,
    }),
  }));
}

async function run(command: Command): Promise<McpToolResult> {
  const dir = resolveToolArgusDir(command.argus_dir);
  const ledger = await readSemanticLedger(dir);
  let events: readonly SemanticEvent[] = [];
  let writeStatus: 'read' | 'written' | 'duplicate' = 'read';
  let integrity = { invalid_json_lines: ledger.diagnostics.length };

  if (command.action !== 'read') {
    const appended = await appendSemanticEvents(dir, actionEvents(command, now()));
    events = appended.events;
    writeStatus = appended.status;
    integrity = appended.integrity;
  }

  const refreshed = command.action === 'read' ? ledger : await readSemanticLedger(dir);
  const state = command.as_of ? foldAsOf(refreshed.events, command.as_of) : fold(refreshed.events);
  const projection = projectJudgment(state, command.judgment_id!, command.as_of ?? now());
  return envelope({
    ok: true,
    tool: 'argus_record',
    surface: command.action === 'close'
      ? '정산을 기록했습니다. / Closure recorded.'
      : command.action === 'read'
        ? '기록을 읽었습니다. / Record read.'
        : '기록했습니다. / Recorded.',
    next_actions: ['stop'],
    data: {
      semantic_version: 3,
      write_status: writeStatus,
      judgment_id: command.judgment_id,
      projection,
      authority_receipt: receipt(events),
      ledger_path: semanticLedgerPath(dir),
      integrity,
      ...(command.as_of ? { as_of: command.as_of } : {}),
    },
  });
}

export const semanticRecord: ToolModule = {
  name: 'argus_record',
  description:
    'Record a human-authorized prediction, commitment, declaration, or witness; append sourced observations and kind-appropriate answers; correct a derived kind; or read the record. AI proposals remain proposals until explicit human authorization seals them. Witness records create no reminder. Resolution keeps reality, commitment, and question-validity axes separate and never creates a score.',
  inputSchema,
  annotations: {
    title: 'Record an accountable judgment',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async (args) => {
    const parsed = inputSchema.safeParse(args);
    if (!parsed.success) {
      return toolError({
        ok: false,
        tool: 'argus_record',
        error_code: 'INVALID_INPUT',
        message: parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
        recovery: 'Provide the named fields and explicit human authorization where required. Do not infer a missing approval.',
      });
    }
    try {
      return await run(parsed.data);
    } catch (error) {
      if (error instanceof SemanticLedgerError) {
        return toolError({
          ok: false,
          tool: 'argus_record',
          error_code: error.code,
          message: error.code === 'UNKNOWN_REFERENCE'
            ? 'The required prior record does not exist.'
            : `The record was not written: ${error.code}.`,
          recovery: 'Read the record, then use active ids and explicit user authorization. Nothing was written.',
        });
      }
      return toolError({
        ok: false,
        tool: 'argus_record',
        error_code: 'INTERNAL_ERROR',
        message: String(error),
        recovery: 'Nothing was intentionally written; retry after checking the local decision record.',
      });
    }
  },
};
