import fs from 'fs';
import { z } from 'zod';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { configPath } from '../lib/layout.js';
import type { McpToolResult } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zDate, zId, type ToolInputSchema, type ToolModule } from './tool-types.js';
import { openDecision } from './open-decision.js';
import { premises } from './premises.js';
import { recheck } from './recheck.js';
import { amend, dismiss } from './amend-dismiss.js';
import { recall } from './recall.js';
import { init, config } from './init-config.js';
import { sync } from './sync.js';
import { review } from './review.js';
import { seal } from './seal.js';
import { checkIn } from './check-in.js';
import { settle } from './settle.js';
import { detectLocaleFromText } from '../lib/locale.js';

const premiseInput = z.strictObject({
  text: z.string().min(3).max(400).describe('결정이 기대는 사실 또는 아직 답하지 못한 질문입니다. 사용자의 표현을 그대로 씁니다.').optional(),
  kind: z.enum(['premise', 'open_question']).default('premise').describe('premise는 확인할 전제, open_question은 사용자가 아직 답하지 않은 질문입니다.'),
  external: z.boolean().default(false).describe('외부 현실에서 나중에 다시 확인할 수 있는 사실인지 표시합니다.'),
  load_bearing: z.boolean().default(false).describe('틀리면 결정이 바뀌는 핵심 전제인지 표시합니다.'),
  source: z.enum(['user_stated', 'ai_surfaced']).describe('문장을 말한 주체입니다. 사용자의 말을 AI의 말로, AI의 말을 사용자의 말로 바꾸지 않습니다.').optional(),
  ai_original: z.string().max(400).describe('source가 ai_surfaced일 때 AI가 처음 제시한 원문입니다.').optional(),
  recheck_cadence_days: z.number().int().min(1).max(365).describe('이 사실을 다시 확인할 간격(일)입니다.').optional(),
  reconsider_cadence_days: z.number().int().min(1).max(365).describe('미결 질문을 다시 볼 간격(일)입니다.').optional(),
});

const common = {
  argus_dir: zArgusDir,
};

const decideSchema = z.discriminatedUnion('action', [
  z.strictObject({
    ...common,
    action: z.literal('open').describe('새 결정을 검토합니다.'),
    id: zId.min(1).max(128).describe('이 결정의 짧고 고유한 식별자입니다.'),
    decision: z.string().min(1).max(600).describe('사용자가 실제로 마주한 선택을 중립적인 한 문장으로 적습니다.'),
    stakes: z.enum(['trivial', 'low', 'moderate', 'high']).describe('틀렸을 때의 비용입니다. 애매하면 낮은 쪽을 선택합니다.'),
    reversibility: z.enum(['one_way_door', 'costly_to_reverse', 'easily_reversible']).describe('결정을 되돌릴 수 있는 정도입니다.'),
    status_quo: z.string().min(1).max(300).describe('아무것도 하지 않을 때 일어나는 일입니다.'),
    already_decided: z.boolean().default(false).describe('사용자가 이미 결정을 끝냈는지 표시합니다.'),
    crux_question: z.string().max(400).describe('결정을 가르는 중립적인 질문 하나입니다. 선택지나 권고가 아닙니다.').optional(),
    load_bearing_assumption: z.string().max(400).describe('결정이 가장 크게 기대는 전제 하나입니다.').optional(),
    related_to: z.array(zId).max(20).describe('사용자가 비슷하다고 본 과거 결정 id입니다.').optional(),
    premises: z.array(premiseInput).min(1).max(5).describe('결정이 기대는 전제와 미결 질문입니다. 선택 사항이며, 있으면 결정과 함께 기록합니다.').optional(),
  }),
  z.strictObject({
    ...common,
    action: z.literal('add_context').describe('결정이 기대는 전제나 미결 질문을 추가합니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    premises: z.array(premiseInput).min(1).max(5).describe('추가할 전제와 미결 질문입니다.'),
  }),
  z.strictObject({
    ...common,
    action: z.literal('answer_question').describe('미결 질문을 사용자의 판단으로 닫습니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    ref: z.string().max(64).describe('답할 미결 질문 번호 또는 id입니다.'),
    decision: z.string().min(1).max(400).describe('사용자가 직접 내린 판단입니다. AI가 대신 작성하지 않습니다.'),
  }),
  z.strictObject({
    ...common,
    action: z.literal('keep_question_open').describe('미결 질문을 지금은 열린 채로 둡니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    ref: z.string().max(64).describe('열어둘 미결 질문 번호 또는 id입니다.'),
    reconsider_cadence_days: z.number().int().min(1).max(365).describe('다시 물어볼 간격(일)입니다.').optional(),
  }),
  z.strictObject({
    ...common,
    action: z.literal('update_fact').describe('결정이 기대는 외부 사실을 현재 현실과 다시 확인합니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    ref: z.string().max(64).describe('재확인할 전제 번호 또는 id입니다.'),
    finding: z.string().min(1).max(800).describe('현재 확인한 사실을 비교 가능한 한 문장으로 적습니다.'),
    numeric_value: z.number().describe('수치 사실의 현재 값을 명시적으로 전달합니다.').optional(),
    changed: z.boolean().describe('문장형 사실이 기준값에서 실질적으로 달라졌는지 표시합니다.').optional(),
    source: z.enum(['url', 'user_stated', 'host_reported']).describe('현재 사실을 확인한 출처입니다.'),
    source_detail: z.string().max(1000).describe('출처 URL 또는 짧은 인용 정보입니다.').optional(),
    apply_to_matching: z.boolean().default(false).describe('같은 사실을 추적하는 다른 결정에도 이 확인 결과를 적용합니다.'),
  }),
  z.strictObject({
    ...common,
    action: z.literal('change_prediction').describe('현실이 답하기 전에 기록한 예측이나 확인일을 수정합니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    predicate: z.string().min(8).max(500).describe('수정할 예측 문장입니다.').optional(),
    check_by: zDate.describe('수정할 미래 확인일입니다.').optional(),
  }),
  z.strictObject({
    ...common,
    action: z.literal('close').describe('더는 답이 필요 없는 결정을 평결 없이 닫습니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    dismiss_reason: z.enum(['became_irrelevant', 'decided_elsewhere', 'superseded', 'user_declined']).describe('결정을 더는 추적하지 않는 이유입니다.'),
    note: z.string().max(500).describe('선택적인 사용자 메모입니다.').optional(),
  }),
]);

// MCP requires a top-level object inputSchema. Keep the action-specific union
// as the runtime validator, while advertising one compatible object whose
// field descriptions state the purpose. This avoids host rejection of a
// top-level oneOf without weakening runtime validation.
const decidePublicSchema = z.strictObject({
  argus_dir: zArgusDir,
  action: z.enum(['open', 'add_context', 'answer_question', 'keep_question_open', 'update_fact', 'change_prediction', 'close']).describe('수행할 결정 작업입니다. 선택한 작업에 필요한 필드만 전달합니다.'),
  id: zId.min(1).max(128).describe('대상 결정의 짧고 고유한 식별자입니다.').optional(),
  decision: z.string().min(1).max(600).describe('새 결정 또는 미결 질문에 대한 사용자의 판단입니다.').optional(),
  stakes: z.enum(['trivial', 'low', 'moderate', 'high']).describe('틀렸을 때의 비용입니다. 새 결정을 열 때 사용합니다.').optional(),
  reversibility: z.enum(['one_way_door', 'costly_to_reverse', 'easily_reversible']).describe('결정을 되돌릴 수 있는 정도입니다. 새 결정을 열 때 사용합니다.').optional(),
  status_quo: z.string().min(1).max(300).describe('아무것도 하지 않을 때 일어나는 일입니다. 새 결정을 열 때 사용합니다.').optional(),
  already_decided: z.boolean().describe('사용자가 이미 결정을 끝냈는지 표시합니다.').optional(),
  crux_question: z.string().max(400).describe('결정을 가르는 중립적인 질문 하나입니다.').optional(),
  load_bearing_assumption: z.string().max(400).describe('결정이 가장 크게 기대는 전제 하나입니다.').optional(),
  related_to: z.array(zId).max(20).describe('사용자가 비슷하다고 본 과거 결정 id입니다.').optional(),
  premises: z.array(premiseInput).min(1).max(5).describe('추가할 전제와 미결 질문입니다.').optional(),
  ref: z.string().max(64).describe('답하거나 재확인할 전제 또는 미결 질문 번호입니다.').optional(),
  reconsider_cadence_days: z.number().int().min(1).max(365).describe('미결 질문을 다시 볼 간격(일)입니다.').optional(),
  finding: z.string().min(1).max(800).describe('현재 확인한 사실을 비교 가능한 한 문장으로 적습니다.').optional(),
  numeric_value: z.number().describe('수치 사실의 현재 값을 명시적으로 전달합니다.').optional(),
  changed: z.boolean().describe('문장형 사실이 기준값에서 실질적으로 달라졌는지 표시합니다.').optional(),
  source: z.enum(['url', 'user_stated', 'host_reported']).describe('현재 사실을 확인한 출처입니다.').optional(),
  source_detail: z.string().max(1000).describe('출처 URL 또는 짧은 인용 정보입니다.').optional(),
  apply_to_matching: z.boolean().describe('같은 사실을 추적하는 다른 결정에도 적용합니다.').optional(),
  predicate: z.string().min(8).max(500).describe('수정할 예측 문장입니다.').optional(),
  check_by: zDate.describe('수정할 미래 확인일입니다.').optional(),
  dismiss_reason: z.enum(['became_irrelevant', 'decided_elsewhere', 'superseded', 'user_declined']).describe('결정을 더는 추적하지 않는 이유입니다.').optional(),
  note: z.string().max(500).describe('선택적인 사용자 메모입니다.').optional(),
}).superRefine((value, ctx) => {
  const parsed = decideSchema.safeParse(value);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
});

const historySchema = z.strictObject({
  argus_dir: zArgusDir,
  view: z.enum(['active', 'all', 'receipt', 'decision_context', 'timeline']).default('active').describe('active는 진행 중인 결정, all은 전체 기록, receipt는 판단 영수증, decision_context는 결정의 전제와 미결 질문, timeline은 시간순 기록입니다.'),
  id: zId.describe('receipt 또는 decision_context를 볼 때 필요한 결정 id입니다.').optional(),
});

const settingsSchema = z.discriminatedUnion('action', [
  z.strictObject({
    argus_dir: zArgusDir,
    action: z.literal('status').describe('현재 Argus 설정을 확인합니다.'),
  }),
  z.strictObject({
    argus_dir: zArgusDir,
    action: z.literal('update').describe('사용자가 선택한 설정을 수정합니다.'),
    locale: z.enum(['ko', 'en']).describe('사용자 표면 언어입니다.').optional(),
    ambient_mute: z.boolean().describe('세션 중 확인일 알림 문장을 숨길지 정합니다.').optional(),
    premise_sync: z.boolean().describe('추적 전제를 계정과 동기화할지 명시적으로 선택합니다.').optional(),
  }),
  z.strictObject({
    argus_dir: zArgusDir,
    action: z.literal('sync').describe('로컬 기록과 Argus 계정 기록을 지금 동기화합니다.'),
    due_only: z.boolean().default(false).describe('확인일이 된 기록만 가져옵니다.'),
    import_settlements: z.boolean().default(true).describe('웹에서 정산한 결과를 로컬 원장에 반영합니다.'),
    push_local: z.boolean().default(true).describe('계정에 닿지 못한 로컬 변경을 다시 보냅니다.'),
  }),
]);

const settingsPublicSchema = z.strictObject({
  argus_dir: zArgusDir,
  action: z.enum(['status', 'update', 'sync']).describe('설정을 확인하거나 수정하거나 계정과 동기화합니다.'),
  locale: z.enum(['ko', 'en']).describe('사용자 표면 언어입니다.').optional(),
  ambient_mute: z.boolean().describe('세션 중 확인일 알림 문장을 숨길지 정합니다.').optional(),
  premise_sync: z.boolean().describe('추적 전제를 계정과 동기화할지 명시적으로 선택합니다.').optional(),
  due_only: z.boolean().describe('동기화할 때 확인일이 된 기록만 가져옵니다.').optional(),
  import_settlements: z.boolean().describe('웹에서 정산한 결과를 로컬 원장에 반영합니다.').optional(),
  push_local: z.boolean().describe('계정에 닿지 못한 로컬 변경을 다시 보냅니다.').optional(),
}).superRefine((value, ctx) => {
  const parsed = settingsSchema.safeParse(value);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
});

const PUBLIC_NAME_MAP: Record<string, string> = {
  argus_open_decision: 'argus_clarify_decision',
  argus_premises: 'argus_clarify_decision',
  argus_recheck: 'argus_clarify_decision',
  argus_amend: 'argus_clarify_decision',
  argus_dismiss: 'argus_clarify_decision',
  argus_review: 'argus_review_document',
  argus_seal: 'argus_save_prediction',
  argus_settle: 'argus_record_result',
  argus_recall: 'argus_history',
  argus_init: 'argus_settings',
  argus_config: 'argus_settings',
  argus_sync: 'argus_settings',
};

function publicCopy(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value === '기록하지 않았어요. 남기고 싶으면 argus_watch로 한 줄만 적어둘 수도 있어요.') return '기록하지 않았어요.';
    if (value === 'Not recorded. If you want, jot a one-line note with argus_watch instead.') return 'Not recorded.';
    return Object.entries(PUBLIC_NAME_MAP).reduce(
      (copy, [legacy, current]) => copy.replaceAll(legacy, current),
      value,
    );
  }
  if (Array.isArray(value)) return value.map(publicCopy);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, publicCopy(child)]));
  }
  return value;
}

function rewriteResult(result: McpToolResult, publicName: string): McpToolResult {
  const sc = result.structuredContent;
  if (!sc) return result;
  const next = Array.isArray(sc['next_actions'])
    ? [...new Set((sc['next_actions'] as unknown[]).map((value) => {
        const name = String(value);
        if (name === 'argus_watch') return 'stop';
        return PUBLIC_NAME_MAP[name] ?? name;
      }))]
    : undefined;
  const rewritten = {
    ...(publicCopy(sc) as Record<string, unknown>),
    tool: publicName,
    ...(next ? { next_actions: next } : {}),
  };
  result.structuredContent = rewritten;
  result.content = [{ type: 'text', text: JSON.stringify(rewritten, null, 2) }];
  return result;
}

async function ensureInitialized(args: Record<string, unknown>): Promise<McpToolResult | null> {
  const dir = resolveToolArgusDir(args['argus_dir']);
  if (fs.existsSync(configPath(dir))) return null;
  const result = await init.handler({ argus_dir: dir });
  if (result.isError) return result;
  const sample = ['decision', 'predicate', 'what_happened', 'finding', 'text', 'title']
    .map((key) => args[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n');
  const locale = detectLocaleFromText(sample);
  if (locale) {
    const configured = await config.handler({ argus_dir: dir, locale });
    if (configured.isError) return configured;
  }
  return null;
}

async function runPublic(
  publicName: string,
  args: Record<string, unknown>,
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>,
): Promise<McpToolResult> {
  const initError = await ensureInitialized(args);
  if (initError) return rewriteResult(initError, publicName);
  return rewriteResult(await handler(args), publicName);
}

export const decide: ToolModule = {
  name: 'argus_clarify_decision',
  description: 'Clarify and maintain one decision without deciding for the user. Use action=open for a new decision; add_context, answer_question, keep_question_open, update_fact, change_prediction, or close for a decision already on record.',
  inputSchema: decidePublicSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: '결정 다루기 · Work with a decision', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (a) => {
    const action = String(a['action']);
    if (action === 'open') {
      const result = await runPublic('argus_clarify_decision', a, openDecision.handler);
      if (result.isError || !Array.isArray(a['premises'])) return result;
      const sc = result.structuredContent;
      if (sc?.['over_fire_gate'] && (sc['over_fire_gate'] as Record<string, unknown>)['fired'] !== true) return result;
      const premiseResult = await premises.handler({
        argus_dir: a['argus_dir'],
        id: a['id'],
        op: 'add',
        premises: a['premises'],
        today_override: a['today_override'],
      });
      if (premiseResult.isError) return rewriteResult(premiseResult, 'argus_clarify_decision');
      const premiseData = premiseResult.structuredContent?.['data'];
      const merged = {
        ...sc,
        tool: 'argus_clarify_decision',
        surface: `${String(sc?.['surface'] ?? '')} ${String(premiseResult.structuredContent?.['surface'] ?? '')}`.trim(),
        data: { ...((sc?.['data'] as Record<string, unknown>) ?? {}), premises: premiseData },
      };
      result.structuredContent = merged;
      result.content = [{ type: 'text', text: JSON.stringify(merged, null, 2) }];
      return result;
    }
    if (action === 'add_context') return runPublic('argus_clarify_decision', { ...a, op: 'add' }, premises.handler);
    if (action === 'answer_question') return runPublic('argus_clarify_decision', { ...a, op: 'resolve' }, premises.handler);
    if (action === 'keep_question_open') {
      return runPublic('argus_clarify_decision', { ...a, op: 'still_open', reponder_cadence_days: a['reconsider_cadence_days'] }, premises.handler);
    }
    if (action === 'update_fact') return runPublic('argus_clarify_decision', a, recheck.handler);
    if (action === 'change_prediction') return runPublic('argus_clarify_decision', a, amend.handler);
    return runPublic('argus_clarify_decision', a, dismiss.handler);
  },
};

export const history: ToolModule = {
  name: 'argus_history',
  description: 'Read decisions already on record: what is open, all contracts, one Judgment Receipt, one decision’s premises, or the accumulated timeline. Read-only.',
  inputSchema: historySchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: '판단 기록 보기 · View judgment history', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (a) => {
    const viewMap: Record<string, string> = {
      active: 'bearing',
      all: 'contracts',
      decision_context: 'premises',
      timeline: 'track_record',
    };
    return runPublic('argus_history', { ...a, view: viewMap[String(a['view'])] ?? a['view'] }, recall.handler);
  },
};

export const settings: ToolModule = {
  name: 'argus_settings',
  description: 'Read or update the few settings a user may need: response language, quiet due reminders, opt-in premise sync, and an explicit account sync. Argus initializes itself on first use.',
  inputSchema: settingsPublicSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Argus 설정 · Argus settings', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (a) => {
    const action = String(a['action']);
    if (action === 'status') return runPublic('argus_settings', { argus_dir: a['argus_dir'] }, config.handler);
    if (action === 'update') {
      const args = Object.fromEntries(Object.entries(a).filter(([key]) => !['action'].includes(key)));
      return runPublic('argus_settings', args, config.handler);
    }
    const args = Object.fromEntries(Object.entries(a).filter(([key]) => key !== 'action'));
    return runPublic('argus_settings', args, sync.handler);
  },
};

function withoutTestClock(schema: ToolInputSchema): ToolInputSchema {
  if (!(schema instanceof z.ZodObject)) return schema;
  const { today_override: _hidden, ...publicShape } = schema.shape;
  return z.strictObject(publicShape);
}

function publicWrapper(tool: ToolModule, name: string, description: string): ToolModule {
  return {
    ...tool,
    name,
    description,
    inputSchema: withoutTestClock(tool.inputSchema),
    handler: (args) => runPublic(name, args, tool.handler),
  };
}

export const publicReview = publicWrapper(review, 'argus_review_document', 'Review a document for claims, evidence, hidden assumptions, and places that still require human judgment. It does not give a verdict.');
export const publicSeal = publicWrapper(seal, 'argus_save_prediction', 'Save a falsifiable prediction and the date when reality can answer it. Use the user\'s own wording whenever possible.');
export const publicCheckIn = publicWrapper(checkIn, 'argus_check_in', 'Show only decisions, facts, and open questions that need attention now. Read-only.');
export const publicSettle = publicWrapper(settle, 'argus_record_result', 'Record what actually happened after a saved prediction reaches its check date. Reality supplies the result; Argus does not grade it.');
