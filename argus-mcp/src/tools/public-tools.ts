import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { sanitizeOutput } from '../lib/untrusted.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { resolveToday } from '../lib/resolve-today.js';
import { tunedStandingSense } from '../lib/ambient-prefs.js';
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
import { seal } from './seal.js';
import { checkIn } from './check-in.js';
import { settle } from './settle.js';
import { detectLocaleFromText } from '../lib/locale.js';
import { gitCommonDirOf } from '../v2/git-discovery.js';
import { handleToolException } from './errors.js';

const premiseInput = z.strictObject({
  // Public callers cannot use the internal from_capture shortcut, so allowing a
  // text-less premise here only postpones a deterministic failure until AFTER
  // action=open has already persisted gate_input + harvest.
  text: z.string().min(3).max(400).describe('필수: 기록할 전제 또는 미결 질문의 원문입니다. Required premise/open-question text.'),
  kind: z.enum(['premise', 'open_question']).default('premise').describe('premise는 확인할 전제, open_question은 사용자가 아직 답하지 않은 질문입니다.'),
  external: z.boolean().default(false).describe('외부 현실에서 나중에 다시 확인할 수 있는 사실인지 표시합니다.'),
  load_bearing: z.boolean().default(false).describe('틀리면 결정이 바뀌는 핵심 전제인지 표시합니다.'),
  monitoring_enabled: z.boolean().default(true).describe('이 전제를 현재 다시 확인하거나 알려줄지 정합니다. 꺼도 중요도나 검증 가능성은 바뀌지 않습니다.\n\nWhether Argus should currently re-check or nudge this premise. Turning it off does not change importance or verifiability.'),
  source: z.enum(['user_stated', 'ai_surfaced']).describe('필수: 이 문장을 말한 주체입니다. user_stated=사용자의 말, ai_surfaced=AI가 제시한 말(이때 ai_original도 함께). 사용자의 말을 AI의 말로 바꾸지 않습니다.'),
  ai_original: z.string().max(400).describe('source=ai_surfaced이면 필수: AI가 처음 제시한 원문입니다. Required with ai_surfaced.').optional(),
  recheck_cadence_days: z.number().int().min(1).max(365).describe('이 사실을 다시 확인할 간격(일)입니다.').optional(),
  reconsider_cadence_days: z.number().int().min(1).max(365).describe('미결 질문을 다시 볼 간격(일)입니다.').optional(),
}).superRefine((value, ctx) => {
  if (value.source === 'ai_surfaced' && !value.ai_original?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['ai_original'],
      message: 'source=ai_surfaced requires ai_original; use source=user_stated when these are the user’s words',
    });
  }
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
    load_bearing_assumption: z.string().max(400).describe('결정이 가장 크게 딛고 선 전제 하나입니다.').optional(),
    related_to: z.array(zId).max(20).describe('사용자가 비슷하다고 본 과거 결정 id입니다.').optional(),
    premises: z.array(premiseInput).min(1).max(5).describe('결정이 딛고 선 전제와 미결 질문입니다. 선택 사항이며, 있으면 결정과 함께 기록합니다.').optional(),
  }),
  z.strictObject({
    ...common,
    action: z.literal('add_context').describe('결정이 딛고 선 전제나 미결 질문을 추가합니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    premises: z.array(premiseInput).min(1).max(5).describe('추가할 전제와 미결 질문입니다.'),
  }),
  z.strictObject({
    ...common,
    action: z.literal('amend_context').describe('전제의 문장이나 속성, 확인 알림을 고칩니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    ref: z.string().max(64).describe('고칠 전제 번호 또는 id입니다.'),
    amendment: z.enum(['accept', 'refine', 'replace', 'retire']).describe('전제를 확인·수정·교체·퇴역하는 방식입니다. 알림만 바꿀 때는 accept를 씁니다.'),
    text: z.string().min(3).max(400).describe('refine/replace에서 사용할 사용자의 원문입니다.').optional(),
    external: z.boolean().describe('외부 현실에서 다시 확인할 수 있는 전제인지 고칩니다.').optional(),
    load_bearing: z.boolean().describe('틀리면 결정이 바뀌는 핵심 전제인지 고칩니다.').optional(),
    monitoring_enabled: z.boolean().describe('중요도와 별개로 재확인 알림을 켜거나 끕니다.').optional(),
    recheck_cadence_days: z.number().int().min(1).max(365).describe('재확인 주기(일)를 고칩니다.').optional(),
    note: z.string().max(300).describe('선택적인 수정 이유입니다.').optional(),
  }),
  z.strictObject({
    ...common,
    action: z.literal('answer_question').describe('미결 질문을 사용자의 판단으로 닫습니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    ref: z.string().max(64).describe('답할 미결 질문 번호 또는 id입니다.'),
    // Optional ON PURPOSE. Requiring it (2.0.0) meant the model had to produce
    // the closing call before the tool would run — which put the model in the
    // seat this surface exists to keep empty, and made the elicitation path
    // (the user typing their own answer into a picker) unreachable from the
    // public surface. Omitted, the handler asks the USER directly.
    decision: z.string().min(1).max(400).describe('사용자가 이미 자기 말로 답했을 때만, 그 말을 그대로 넣습니다. 아직 묻지 않았다면 비워두세요. 그러면 사용자에게 직접 묻는 확인창이 뜹니다. AI가 대신 작성하지 않습니다.').optional(),
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
    action: z.literal('update_fact').describe('결정이 딛고 선 외부 사실을 현재 현실과 다시 확인합니다.'),
    id: zId.describe('대상 결정 id입니다.'),
    ref: z.string().max(64).describe('재확인할 전제 번호 또는 id입니다.'),
    finding: z.string().min(1).max(800).describe('현재 확인한 사실을 비교 가능한 한 문장으로 적습니다.'),
    numeric_value: z.number().finite().describe('수치 사실의 현재 값을 명시적으로 전달합니다.').optional(),
    changed: z.boolean().describe('문장형 사실이 기준값에서 실질적으로 달라졌는지 표시합니다.').optional(),
    // default user_stated: the runtime union validates BEFORE the handler-level
    // default can apply, so a required source here made every real update_fact
    // call fail with a baffling INVALID_INPUT (1.4.0 field finding).
    source: z.enum(['url', 'user_stated', 'host_reported']).default('user_stated').describe('현재 사실을 확인한 출처입니다. 생략하면 user_stated입니다.'),
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
    dismiss_reason: z.enum(['became_irrelevant', 'decided_elsewhere', 'superseded', 'user_declined', 'changed_mind', 'other']).describe('결정을 더는 추적하지 않는 이유입니다.'),
    note: z.string().max(500).describe('선택적인 사용자 메모입니다.').optional(),
  }),
]);

// MCP requires a top-level object inputSchema. Keep the action-specific union
// as the runtime validator, while advertising one compatible object whose
// field descriptions state the purpose. This avoids host rejection of a
// top-level oneOf without weakening runtime validation.
const decidePublicSchema = z.strictObject({
  argus_dir: zArgusDir,
  action: z.enum(['open', 'add_context', 'amend_context', 'answer_question', 'keep_question_open', 'update_fact', 'change_prediction', 'close']).describe('수행할 결정 작업입니다. 선택한 작업에 필요한 필드만 전달합니다.'),
  id: zId.min(1).max(128).describe('대상 결정의 짧고 고유한 식별자입니다.').optional(),
  decision: z.string().min(1).max(600).describe('새 결정 또는 미결 질문에 대한 사용자의 판단입니다.').optional(),
  stakes: z.enum(['trivial', 'low', 'moderate', 'high']).describe('틀렸을 때의 비용입니다. 새 결정을 열 때 사용합니다.').optional(),
  reversibility: z.enum(['one_way_door', 'costly_to_reverse', 'easily_reversible']).describe('결정을 되돌릴 수 있는 정도입니다. 새 결정을 열 때 사용합니다.').optional(),
  status_quo: z.string().min(1).max(300).describe('아무것도 하지 않을 때 일어나는 일입니다. 새 결정을 열 때 사용합니다.').optional(),
  already_decided: z.boolean().describe('사용자가 이미 결정을 끝냈는지 표시합니다.').optional(),
  load_bearing_assumption: z.string().max(400).describe('결정이 가장 크게 딛고 선 전제 하나입니다.').optional(),
  related_to: z.array(zId).max(20).describe('사용자가 비슷하다고 본 과거 결정 id입니다.').optional(),
  premises: z.array(premiseInput).min(1).max(5).describe('추가할 전제와 미결 질문입니다.').optional(),
  ref: z.string().max(64).describe('답하거나 재확인할 전제 또는 미결 질문 번호입니다.').optional(),
  amendment: z.enum(['accept', 'refine', 'replace', 'retire']).describe('amend_context에서 전제를 고치는 방식입니다.\n\nHow to amend a premise for action=amend_context.').optional(),
  text: z.string().min(3).max(400).describe('사용자가 고친 전제 원문입니다.\n\nThe user’s corrected premise wording.').optional(),
  external: z.boolean().describe('외부 현실에서 다시 확인할 수 있는 전제인지 표시합니다.\n\nWhether reality can verify this premise later.').optional(),
  load_bearing: z.boolean().describe('틀리면 결정이 바뀌는 핵심 전제인지 표시합니다.\n\nWhether the decision materially depends on this premise.').optional(),
  monitoring_enabled: z.boolean().describe('재확인 알림을 켜거나 끕니다.\n\nWhether Argus should re-check or nudge this premise.').optional(),
  recheck_cadence_days: z.number().int().min(1).max(365).describe('전제 재확인 주기(일)입니다.\n\nHow often this premise becomes due for re-check.').optional(),
  reconsider_cadence_days: z.number().int().min(1).max(365).describe('미결 질문을 다시 볼 간격(일)입니다.').optional(),
  finding: z.string().min(1).max(800).describe('현재 확인한 사실을 비교 가능한 한 문장으로 적습니다.').optional(),
  numeric_value: z.number().finite().describe('수치 사실의 현재 값을 명시적으로 전달합니다.').optional(),
  changed: z.boolean().describe('문장형 사실이 기준값에서 실질적으로 달라졌는지 표시합니다.').optional(),
  source: z.enum(['url', 'user_stated', 'host_reported']).describe('현재 사실을 확인한 출처입니다.').optional(),
  source_detail: z.string().max(1000).describe('출처 URL 또는 짧은 인용 정보입니다.').optional(),
  apply_to_matching: z.boolean().describe('같은 사실을 추적하는 다른 결정에도 적용합니다.').optional(),
  predicate: z.string().min(8).max(500).describe('수정할 예측 문장입니다.').optional(),
  check_by: zDate.describe('수정할 미래 확인일입니다.').optional(),
  dismiss_reason: z.enum(['became_irrelevant', 'decided_elsewhere', 'superseded', 'user_declined', 'changed_mind', 'other']).describe('결정을 더는 추적하지 않는 이유입니다.').optional(),
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
  view: z.enum(['active', 'all', 'receipt', 'decision_context', 'timeline', 'reflection']).default('active').describe('active는 진행 중인 결정, all은 전체 기록, receipt는 판단 영수증, decision_context는 결정의 전제와 미결 질문, timeline은 누적 정산 결과 요약(예측대로·걱정 피함·일부·빗나감 빈도), reflection은 당신이 쓴 예측·전제와 그 결과를 되읽는 기록입니다.'),
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
    import_settlements: z.boolean().default(true).describe('웹에서 기록한 실제 결과를 로컬 판단 기록에 반영합니다.'),
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
  import_settlements: z.boolean().describe('웹에서 기록한 실제 결과를 로컬 판단 기록에 반영합니다.').optional(),
  push_local: z.boolean().describe('계정에 닿지 못한 로컬 변경을 다시 보냅니다.').optional(),
}).superRefine((value, ctx) => {
  const parsed = settingsSchema.safeParse(value);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
});

const PUBLIC_NAME_MAP: Record<string, string> = {
  argus_open_decision: 'argus_capture',
  argus_premises: 'argus_capture',
  argus_recheck: 'argus_capture',
  argus_amend: 'argus_capture',
  argus_dismiss: 'argus_capture',
  argus_clarify_decision: 'argus_capture',
  argus_seal: 'argus_predict',
  argus_save_prediction: 'argus_predict',
  argus_settle: 'argus_resolve',
  argus_record_result: 'argus_resolve',
  argus_recall: 'argus_patterns',
  argus_history: 'argus_patterns',
  argus_init: 'argus_settings',
  argus_config: 'argus_settings',
  argus_sync: 'argus_settings',
};

/** Rewrite only machine-owned routing fields. Free-form strings can contain
 * verbatim user evidence, so a recursive text replacement would corrupt
 * provenance whenever a user happened to mention an old tool name. */
export function publicCopy(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value === '기록하지 않았어요. 남기고 싶으면 argus_watch로 한 줄만 적어둘 수도 있어요.') return '기록하지 않았어요.';
    if (value === 'Not recorded. If you want, jot a one-line note with argus_watch instead.') return 'Not recorded.';
    return value;
  }
  if (Array.isArray(value)) return value.map(publicCopy);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => {
    if (key === 'settle_path') return ['result_path', publicCopy(child)];
    if ((key === 'tool' || key === 'next_action') && typeof child === 'string') {
      return [key, PUBLIC_NAME_MAP[child] ?? child];
    }
    if (key === 'next_actions' && Array.isArray(child)) {
      return [key, child.map((item) => typeof item === 'string' ? (PUBLIC_NAME_MAP[item] ?? item) : item)];
    }
    return [key, publicCopy(child)];
  }));
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
  const hasConfig = fs.existsSync(configPath(dir));
  const insideGit = gitCommonDirOf(dir) !== null;
  let hasValidBinding = false;
  if (insideGit) {
    try {
      const binding = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8')) as Record<string, unknown>;
      hasValidBinding = typeof binding['repository_id'] === 'string' && typeof binding['workspace_id'] === 'string';
    } catch { /* missing or damaged projection: safe init repairs it */ }
  }
  if (hasConfig && (!insideGit || hasValidBinding)) return null;
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

/**
 * 정산 감각의 구조적 상시화 (2026-07-21, 창업자 지시 "MCP 정산은 구조로").
 * raw MCP가 정산을 놓치는 근본 원인은 지시문이 아니라 모델이 열린 예측 목록을
 * 손에 안 쥔 것 — check_in을 부른 세션만 목록을 봤다. 이 라이더는 어떤 argus
 * 툴이 불리든 결과에 열린 예측(상위 10)과 standing_sense 한 줄을 동봉해,
 * 모든 툴 호출이 배경감각을 재장전하게 한다. 프롬프트는 보조, 구조가 주다.
 * 실패는 절대 툴 결과를 깨지 않는다(부가 정보일 뿐 — 전부 try/catch).
 */
function attachOpenPredictions(result: McpToolResult, args: Record<string, unknown>): McpToolResult {
  try {
    const sc = result.structuredContent as Record<string, unknown> | undefined;
    if (!sc || result.isError || sc['ok'] === false) return result;
    const data = sc['data'] as Record<string, unknown> | undefined;
    if (!data || data['open_predictions']) return result; // check_in 등 이미 동봉이면 그대로
    const dir = resolveToolArgusDir(args['argus_dir']);
    const ledger = replayLedger(dir, resolveToday({ override: typeof args['today_override'] === 'string' ? args['today_override'] : null }));
    const open = [...ledger.contracts.values()]
      .filter((c) => c.status === 'sealed')
      .sort((x, y) => ((x.check_by || '') < (y.check_by || '') ? -1 : 1))
      .slice(0, 10)
      .map((c) => ({ id: c.id, predicate: String(c.predicate).slice(0, 140), check_by: c.check_by }));
    if (!open.length) return result;
    // 신뢰 경계: 이 라이더는 envelope()의 sanitizeOutput 깔때기 '이후'에 실행되므로
    // 원장 predicate(사용자 저작 텍스트)를 직접 세탁해야 한다 — 안 하면 ANSI/bidi/
    // zero-width 벡터가 세탁 안 된 채 모델에 직행하는 새 경로가 된다.
    data['open_predictions'] = sanitizeOutput(open);
    data['standing_sense'] = tunedStandingSense();
    result.content = [{ type: 'text', text: JSON.stringify(sc, null, 2) }];
  } catch { /* 라이더 실패는 침묵 — 본 결과를 해치지 않는다 */ }
  return result;
}

async function runPublic(
  publicName: string,
  args: Record<string, unknown>,
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>,
): Promise<McpToolResult> {
  try {
    const initError = await ensureInitialized(args);
    if (initError) return rewriteResult(initError, publicName);
    return attachOpenPredictions(rewriteResult(await handler(args), publicName), args);
  } catch (e) {
    // ensureInitialized() → resolveToolArgusDir() THROWS ArgusDirError on a
    // relative or unexpanded-${VAR} argus_dir — the #1 setup mistake. Without
    // this catch the throw escaped to the server's String(e) fallback, so the
    // user saw a raw "INTERNAL_ERROR: ArgusDirError: …" with no recovery. Route
    // it through the typed handler to get the localized message + fix.
    return rewriteResult(handleToolException(publicName, e), publicName);
  }
}

export const decide: ToolModule = {
  name: 'argus_capture',
  description: 'Capture a decision and its user-stated context without deciding for the user. Preserve at most one load-bearing assumption; tag an AI-drafted premise as ai_surfaced.',
  inputSchema: decidePublicSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Work with a decision', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (a) => {
    const action = String(a['action']);
    if (action === 'open') {
      const result = await runPublic('argus_capture', a, openDecision.handler);
      if (result.isError || !Array.isArray(a['premises'])) return result;
      const sc = result.structuredContent;
      // Record the user's premises REGARDLESS of the over-fire gate. The gate
      // governs manufactured CEREMONY (a crux/fork on a flat decision), never
      // whether a user-supplied record is persisted — writing down what the user
      // actually gave is record, not ceremony (open-decision.ts: 기록과 의식을
      // 분리한다). Gating this silently dropped premises on low-stakes opens.
      const premiseResult = await premises.handler({
        argus_dir: a['argus_dir'],
        id: a['id'],
        op: 'add',
        premises: a['premises'],
        today_override: a['today_override'],
      });
      if (premiseResult.isError) return rewriteResult(premiseResult, 'argus_capture');
      const premiseData = premiseResult.structuredContent?.['data'];
      // The premise-add result is spliced in RAW here, so — unlike the runPublic
      // path — it never passed through the public-name translation. Its surface
      // says "argus_premises"; publicCopy the whole merged object so that internal
      // name (and any other) is rewritten to the public one before it reaches a host.
      const merged = publicCopy({
        ...sc,
        tool: 'argus_capture',
        surface: `${String(sc?.['surface'] ?? '')} ${String(premiseResult.structuredContent?.['surface'] ?? '')}`.trim(),
        data: { ...((sc?.['data'] as Record<string, unknown>) ?? {}), premises: premiseData },
      }) as Record<string, unknown>;
      result.structuredContent = merged;
      result.content = [{ type: 'text', text: JSON.stringify(merged, null, 2) }];
      return result;
    }
    if (action === 'add_context') return runPublic('argus_capture', { ...a, op: 'add' }, premises.handler);
    if (action === 'amend_context') {
      return runPublic('argus_capture', { ...a, op: 'amend', action: a['amendment'] }, premises.handler);
    }
    if (action === 'answer_question') return runPublic('argus_capture', { ...a, op: 'resolve' }, premises.handler);
    if (action === 'keep_question_open') {
      return runPublic('argus_capture', { ...a, op: 'still_open', reponder_cadence_days: a['reconsider_cadence_days'] }, premises.handler);
    }
    // recheck internally REQUIRES a source; the public update_fact schema never
    // surfaced it, so every real call died with a baffling "source: 값을 확인해
    // 주세요". Default to user_stated — the user telling us what they verified.
    if (action === 'update_fact') return runPublic('argus_capture', { ...a, source: a['source'] ?? 'user_stated' }, recheck.handler);
    if (action === 'change_prediction') return runPublic('argus_capture', a, amend.handler);
    return runPublic('argus_capture', a, dismiss.handler);
  },
};

export const history: ToolModule = {
  name: 'argus_patterns',
  description: 'Read active decisions, receipts, timelines, and recurring patterns. Read-only; history is context, never a verdict.',
  inputSchema: historySchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  // readOnlyHint:false — like argus_check_in, the first call auto-initializes
  // .argus/ via ensureInitialized, so it can write on first use (honest hint).
  annotations: { title: 'View judgment history', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: (a) => {
    const viewMap: Record<string, string> = {
      active: 'bearing',
      all: 'contracts',
      decision_context: 'premises',
      timeline: 'track_record',
    };
    return runPublic('argus_patterns', { ...a, view: viewMap[String(a['view'])] ?? a['view'] }, recall.handler);
  },
};

export const settings: ToolModule = {
  name: 'argus_settings',
  description: 'Read or update language, reminders, and explicit sync settings. Argus initializes the current project on first use.',
  inputSchema: settingsPublicSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Argus settings', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (a) => {
    const action = String(a['action']);
    if (action === 'status') {
      // Status is also the single public repair handle. init is idempotent and
      // recreates a missing/corrupt v2 binding plus any pending v1 migration
      // marker, without teaching users a separate initialization tool.
      const repaired = await init.handler({ argus_dir: a['argus_dir'] });
      if (repaired.isError) return rewriteResult(repaired, 'argus_settings');
      return runPublic('argus_settings', { argus_dir: a['argus_dir'] }, config.handler);
    }
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

// 툴 설명은 접속 후 유일하게 "항상 컨텍스트에 있는" 서버 발화다 (instructions는
// initialize 1회, 툴 결과는 호출할 때만). 그래서 세 감각의 tell을 여기 한 줄씩
// 심는다 — 모델이 대화 중 알아채는 확률을 매 턴 받쳐주는 상시 지침 통로.
export const publicSeal = publicWrapper(seal, 'argus_predict', 'Record one falsifiable prediction and when reality can answer it. Use the user’s words and offer confirmation once.');
export const publicCheckIn = publicWrapper(checkIn, 'argus_check_in', 'Show only open records that need attention now. Read-only.');
export const publicSettle = publicWrapper(settle, 'argus_resolve', 'Record an outcome the user explicitly stated for a tracked prediction. Reality answers; Argus never grades.');
