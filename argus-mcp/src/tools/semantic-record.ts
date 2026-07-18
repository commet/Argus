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
import type { Resolution, SemanticEvent } from '../v3/types.js';
import { zArgusDir, type ToolModule } from './tool-types.js';

const zLocalId = z.string().regex(/^[A-Za-z0-9._-]+$/, 'id may only contain A-Z a-z 0-9 . _ -').min(1).max(96);
const zIsoTime = z.string().datetime({ offset: true });

const authorizationSchema = z.strictObject({
  mode: z.enum(['direct_command', 'explicit_confirmation']).describe('사용자가 직접 명령했는지, 표시된 명령을 확인했는지입니다.'),
  evidence_kind: z.enum(['user_utterance', 'command_digest']).describe('승인 근거의 종류입니다.'),
  evidence_ref: z.string().min(1).max(1024).describe('호스트의 사용자 발화 또는 확인 기록을 가리키는 포인터입니다.'),
}).superRefine((value, ctx) => {
  const expected = value.mode === 'direct_command' ? 'user_utterance' : 'command_digest';
  if (value.evidence_kind !== expected) {
    ctx.addIssue({ code: 'custom', path: ['evidence_kind'], message: `${value.mode} requires ${expected}` });
  }
});

const resolutionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('answered').describe('관찰이 질문에 답했음을 기록합니다.'),
    answer_summary: z.string().min(1).max(2000).describe('관찰이 질문에 주는 답을 사용자의 말로 적습니다.'),
    criterion_result: z.enum(['met', 'not_met', 'partial', 'not_applicable']).optional().describe('사전에 둔 기준이 있다면 그 결과를 적습니다.'),
    evidence_refs: z.array(zLocalId).min(1).max(32).describe('답을 뒷받침하는 관찰 기록 id입니다.'),
  }),
  z.strictObject({
    kind: z.literal('indeterminate').describe('충분한 증거가 없어 답할 수 없음을 기록합니다.'),
    reason: z.string().min(1).max(2000).describe('왜 답할 수 없는지 적습니다.'),
    evidence_refs: z.array(zLocalId).max(32).describe('관련 관찰 기록 id입니다.'),
  }),
  z.strictObject({
    kind: z.literal('moot').describe('질문 자체가 더 적용되지 않음을 기록합니다.'),
    reason: z.string().min(1).max(2000).describe('왜 질문이 더 적용되지 않는지 적습니다.'),
    evidence_refs: z.array(zLocalId).max(32).describe('관련 관찰 기록 id입니다.'),
  }),
]);

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  action: z.enum(['seal', 'observe', 'defer', 'resolve', 'close', 'read']).describe('v6 파일럿에서 수행할 기록 동작입니다.'),
  request_id: zLocalId.optional().describe('쓰기 재시도에도 같은 값을 쓰는 호출 식별자입니다. read에는 필요 없습니다.'),
  judgment_id: zLocalId.optional().describe('판단 기록의 안정적인 식별자입니다.'),
  statement: z.string().min(1).max(4000).optional().describe('사용자가 승인한 판단 또는 약속의 문장입니다.'),
  review_at: zIsoTime.optional().describe('현실을 다시 확인할 시각(ISO 8601, 시간대 포함)입니다.'),
  review_question: z.string().min(1).max(4000).optional().describe('돌아와서 답할 구체적인 질문입니다.'),
  resolution_criterion: z.string().min(1).max(4000).optional().describe('있다면, 답을 해석할 사전 기준입니다.'),
  return_contract_id: zLocalId.optional().describe('seal 결과가 돌려주는 return promise id입니다.'),
  observation_id: zLocalId.optional().describe('새 관찰 기록의 안정적인 식별자입니다.'),
  observation_text: z.string().min(1).max(4000).optional().describe('실제로 일어난 일을 출처와 분리해 적은 관찰입니다.'),
  resolution_id: zLocalId.optional().describe('새 recorded answer 또는 close 대상의 식별자입니다.'),
  resolution: resolutionSchema.optional().describe('관찰이 return promise에 주는 답 또는 답할 수 없는 이유입니다.'),
  defer_reason: z.string().max(2000).optional().describe('답이 아직 없어서 다시 확인하는 이유입니다.'),
  authorization: authorizationSchema.optional().describe('사람의 명시적 승인과 그 근거입니다. seal, defer, resolve, close에 필수입니다.'),
  as_of: zIsoTime.optional().describe('read에서 이 기록 시각 이후의 이벤트를 제외할 기준 시각입니다.'),
}).superRefine((value, ctx) => {
  const need = (field: keyof typeof value, message: string) => {
    if (value[field] === undefined) ctx.addIssue({ code: 'custom', path: [field], message });
  };
  const authorial = ['seal', 'defer', 'resolve', 'close'].includes(value.action);
  if (authorial) need('authorization', 'explicit human authorization is required');
  if (value.action !== 'read') need('request_id', 'request_id is required for a write');
  if (['seal', 'observe', 'defer', 'resolve', 'close', 'read'].includes(value.action)) need('judgment_id', 'judgment_id is required');
  if (value.action === 'seal') {
    need('statement', 'statement is required to seal');
    need('review_at', 'review_at is required to seal');
    need('review_question', 'review_question is required to seal');
  }
  if (value.action === 'observe') {
    need('observation_id', 'observation_id is required to observe');
    need('observation_text', 'observation_text is required to observe');
  }
  if (value.action === 'defer') {
    need('return_contract_id', 'return_contract_id is required to defer');
    need('review_at', 'review_at is required to defer');
  }
  if (value.action === 'resolve') {
    need('return_contract_id', 'return_contract_id is required to resolve');
    need('resolution_id', 'resolution_id is required to resolve');
    need('resolution', 'resolution is required to resolve');
  }
  if (value.action === 'close') need('resolution_id', 'resolution_id is required to close');
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
    authorization_ref: { kind: authorization.evidence_kind, ref: authorization.evidence_ref },
  };
}

function base(command: Command, sequence: number, time: string, auth: NonNullable<Command['authorization']>): Pick<SemanticEvent, 'event_id' | 'v' | 'space_id' | 'idempotency_key' | 'time' | 'authority'> {
  const spaceId = localSpaceId(resolveToolArgusDir(command.argus_dir));
  return {
    event_id: `${command.request_id!}.${sequence}`,
    v: 3,
    space_id: spaceId,
    idempotency_key: `${command.request_id!}.${sequence}`,
    time: { recorded_at: time, authorized_at: time, temporal_mode: 'contemporaneous' },
    authority: authority(spaceId, auth),
  };
}

function actionEvents(command: Command, time: string): SemanticEvent[] {
  const auth = command.authorization!;
  const shared = (sequence: number) => base(command, sequence, time, auth);
  switch (command.action) {
    case 'seal': {
      const returnContractId = command.return_contract_id ?? `${command.judgment_id}.return`;
      return [
        { ...shared(0), event: 'judgment_sealed', judgment_id: command.judgment_id!, statement: command.statement! },
        {
          ...shared(1), event: 'return_promised', return_contract_id: returnContractId, judgment_id: command.judgment_id!,
          review_at: command.review_at!, review_question: command.review_question!,
          ...(command.resolution_criterion ? { resolution_criterion: command.resolution_criterion } : {}),
        },
      ];
    }
    case 'observe': {
      const spaceId = localSpaceId(resolveToolArgusDir(command.argus_dir));
      return [{
        event_id: `${command.request_id!}.0`, v: 3, space_id: spaceId, idempotency_key: `${command.request_id!}.0`,
        time: { recorded_at: time, temporal_mode: 'contemporaneous' },
        authority: {
          originated_by: { kind: 'human', id: `local:${spaceId}` },
          recorded_by: { kind: 'system', id: 'mcp:argus-record' },
          observed_by: { kind: 'human', id: `local:${spaceId}` },
        },
        provenance: { source_kind: 'user_utterance' },
        event: 'observation_recorded', observation_id: command.observation_id!, text: command.observation_text!,
      }];
    }
    case 'defer':
      return [{ ...shared(0), event: 'return_deferred', return_contract_id: command.return_contract_id!, review_at: command.review_at!, ...(command.defer_reason ? { reason: command.defer_reason } : {}) }];
    case 'resolve':
      return [{ ...shared(0), event: 'resolution_asserted', resolution_id: command.resolution_id!, judgment_id: command.judgment_id!, return_contract_id: command.return_contract_id!, resolution: command.resolution! as Resolution }];
    case 'close':
      return [{ ...shared(0), event: 'judgment_closed', judgment_id: command.judgment_id!, resolution_id: command.resolution_id! }];
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
    surface: command.action === 'close' ? '정산을 기록했습니다. / Closure recorded.' : command.action === 'read' ? '기록을 읽었습니다. / Record read.' : '기록했습니다. / Recorded.',
    next_actions: ['stop'],
    data: {
      pilot: 'dkk-v6',
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
  description: 'DKK v6 pilot: explicitly record a human-authorized decision record, observation, answer, and closure. It never infers authorization or closes a record as a side effect.',
  inputSchema,
  annotations: { title: 'Record an accountable decision', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (args) => {
    const parsed = inputSchema.safeParse(args);
    if (!parsed.success) {
      return toolError({
        ok: false, tool: 'argus_record', error_code: 'INVALID_INPUT',
        message: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
        recovery: 'Provide the named fields and explicit human authorization where required. Do not infer a missing approval.',
      });
    }
    try {
      return await run(parsed.data);
    } catch (error) {
      if (error instanceof SemanticLedgerError) {
        return toolError({
          ok: false, tool: 'argus_record', error_code: error.code,
          message: error.code === 'UNKNOWN_REFERENCE' ? 'The required prior record does not exist.' : `The record was not written: ${error.code}.`,
          recovery: 'Read the record, then use the active ids and an explicit user authorization. Nothing was written.',
        });
      }
      return toolError({ ok: false, tool: 'argus_record', error_code: 'INTERNAL_ERROR', message: String(error), recovery: 'Nothing was intentionally written; retry after checking the local decision record.' });
    }
  },
};
