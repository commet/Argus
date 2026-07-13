import { z } from 'zod';
import type { McpToolResult } from '../lib/envelope.js';

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * A tool's input schema is a Zod object — the SINGLE source of truth. It powers
 * BOTH runtime validation (safeParse at dispatch, in server.ts) AND the JSON
 * Schema advertised in tools/list (generated via z.toJSONSchema). No hand-kept
 * JSON schema to drift from the validator (mcp-builder best-practices §Zod).
 */
export type ToolInputSchema = z.ZodType;

export interface ToolModule {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  /** kept for reference; the server advertises z.toJSONSchema(inputSchema). */
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

// ── Shared field builders (DRY — argus_dir / id / date recur on every tool) ──
// argus_dir is OPTIONAL: omit it to use the ARGUS_DIR env var from your MCP
// config (the ergonomic default — set once, never pass again). A per-call value
// still wins. Resolution + validation live in resolveToolArgusDir.
export const zArgusDir = z
  .string()
  .describe('Absolute path to the .argus directory (no ".."). Omit to use the ARGUS_DIR env var from your MCP config.')
  .optional();
export const zId = z.string().regex(/^[A-Za-z0-9._-]+$/, 'id may only contain A-Z a-z 0-9 . _ -');
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const KO_FIELD_DESCRIPTIONS: Record<string, string> = {
  argus_dir: '프로젝트의 .argus 절대 경로입니다. 생략하면 MCP 설정의 ARGUS_DIR을 사용합니다.',
  id: '결정 식별자입니다.',
  decision: '사용자가 실제로 마주한 선택 또는 사용자가 직접 내린 판단입니다.',
  stakes: '틀렸을 때의 비용입니다.',
  reversibility: '결정을 되돌릴 수 있는 정도입니다.',
  status_quo: '아무것도 하지 않을 때 일어나는 일입니다.',
  already_decided: '이미 결정을 내렸는지 여부입니다.',
  crux_question: '결정을 가르는 중립적인 핵심 질문 하나입니다.',
  load_bearing_assumption: '결정이 가장 크게 기대는 전제 하나입니다.',
  related_to: '사용자가 비슷하다고 본 과거 결정 id입니다.',
  today_override: '테스트 또는 명시적 기준일에만 사용하는 오늘 날짜입니다.',
  text: '사용자가 작성한 원문입니다. 고치거나 요약하지 않습니다.',
  file_path: '검수할 문서의 절대 경로입니다.',
  source_kind: '자동 감지한 문서 종류를 덮어씁니다.',
  title: '문서 또는 기록 제목입니다.',
  concerns: '검수에서 더 중요하게 볼 관심사입니다.',
  audience_hint: '문서 대상 독자에 대한 힌트입니다.',
  biggest_worry: '사용자가 가장 우려하는 부분입니다.',
  op: '수행할 작업입니다.',
  premises: '추가할 전제 또는 미결 질문 목록입니다.',
  from_capture: 'argus_watch에서 포착한 문장을 가져올 때 사용하는 캡처 id입니다.',
  materiality_rule: '어떤 변화가 이 결정에 중요한지 판정하는 명시적 규칙입니다.',
  type: '규칙의 종류입니다.',
  params: '규칙 계산에 사용하는 수치 매개변수입니다.',
  modifiers: '수치의 의미와 방향을 해석하는 보정 정보입니다.',
  direction: '값이 커질수록 좋은지 나쁜지 나타냅니다.',
  harmful_dir: '결정에 해로운 변화 방향입니다.',
  unit_axis: '수치가 놓인 단위 또는 축입니다.',
  boundary: '의미가 달라지는 경계값입니다.',
  scale: '수치의 해석 규모입니다.',
  resolution: '수치에서 의미 있는 최소 변화 폭입니다.',
  zero_meaningful: '0이 실제 의미를 갖는 값인지 나타냅니다.',
  safety_floor: '넘지 말아야 할 안전 하한입니다.',
  near_zero_cut: '0에 가깝다고 볼 기준값입니다.',
  ref: '대상 전제나 질문의 번호 또는 식별자입니다.',
  action: '수행할 세부 작업입니다.',
  note: '선택적인 메모입니다.',
  external: '외부 현실과 다시 확인할 사실인지 표시합니다.',
  load_bearing: '틀리면 결정이 바뀌는 핵심 전제인지 표시합니다.',
  recheck_cadence_days: '전제 사실을 다시 확인할 간격(일)입니다.',
  reponder_cadence_days: '미결 질문을 다시 볼 간격(일)입니다.',
  reconsider_cadence_days: 'reponder_cadence_days의 호환 별칭입니다.',
  predicate: '현실이 참/거짓으로 확인할 수 있는 예측입니다.',
  check_by: '예측을 현실과 대조할 미래 확인일(YYYY-MM-DD)입니다.',
  predicate_owner: '예측 문장의 작성 주체입니다. 출처를 꾸미지 않습니다.',
  confirm_draft: 'AI가 만든 예측 초안을 사용자에게 한 번에 확인받을 때 사용합니다.',
  basis: '결과를 돌아볼 때 사용자가 밝힌 판단의 성격입니다.',
  real_question: '답 뒤에 있던 실제 질문입니다.',
  unverified_assumption: '아직 확인하지 못한 핵심 전제입니다.',
  human_only: '사람만 판단할 수 있는 부분입니다.',
  human_judgment: '사용자가 직접 쓴 한 줄 판단입니다.',
  finding: '현재 확인한 사실을 비교 가능한 한 문장으로 적습니다.',
  numeric_value: '수치 사실의 현재 값을 명시적으로 전달합니다.',
  changed: '문장형 전제가 기준값에서 실질적으로 바뀌었는지 표시합니다.',
  source: '사실 또는 문장의 출처입니다.',
  source_detail: '출처 URL 또는 짧은 인용 정보입니다.',
  apply_to_matching: '같은 사실을 추적하는 다른 결정에도 재확인을 적용합니다.',
  outcome: '예측에 대해 현실에서 실제로 일어난 결과입니다. 모델이 추론하지 않습니다.',
  outcome_source: '결과를 말한 주체입니다. 현재는 user_stated만 허용합니다.',
  what_happened: '실제로 일어난 일을 사용자의 말로 기록합니다.',
  broken_premise_ref: '결과에 영향을 줬다고 사용자가 지목한 전제입니다.',
  defer_to: '현실이 아직 답하지 않았을 때 다시 확인할 미래 날짜입니다.',
  include_upcoming_days: '며칠 안에 확인일이 오는 계약까지 함께 표시합니다.',
  fleet: '이 컴퓨터의 다른 Argus 프로젝트에 있는 확인 건수도 함께 봅니다.',
  view: '불러올 기록의 종류입니다.',
  due_only: '확인일이 된 기록만 표시합니다.',
  limit: '표시할 최대 기록 수입니다.',
  import_settlements: '웹에서 정산한 결과를 로컬 원장으로 가져옵니다.',
  push_local: '계정에 닿지 못한 로컬 변경을 다시 보냅니다.',
  dismiss_reason: '결정을 더는 추적하지 않는 이유입니다.',
  candidate_id: '포착된 결정 후보 id입니다.',
  decision_id: '후보를 연결할 결정 id입니다.',
  snooze_until: '후보를 다시 보여줄 날짜입니다.',
  kind: '포착한 내용의 종류입니다.',
  ai_original: 'AI가 만든 문장의 원문입니다.',
  days: '최근 며칠의 기록을 볼지 정합니다.',
  locale: '사용자 표면 언어입니다. ko 또는 en입니다.',
  boss: '설정할 검토 상대입니다.',
  team: '설정할 팀입니다.',
  archive: '기록 보관 설정입니다.',
  ambient_mute: '세션 중 확인일 알림 문장을 숨깁니다.',
  premise_sync: '명시적으로 켜면 추적 전제를 계정과 동기화합니다.',
};

/** JSON Schema for tools/list, generated from the Zod source (drop $schema noise). */
export function toolJsonSchema(schema: ToolInputSchema): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json['$schema'];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const properties = record['properties'];
    if (properties && typeof properties === 'object') {
      for (const [key, raw] of Object.entries(properties as Record<string, unknown>)) {
        if (!raw || typeof raw !== 'object') continue;
        const field = raw as Record<string, unknown>;
        const ko = KO_FIELD_DESCRIPTIONS[key];
        if (ko) {
          const en = typeof field['description'] === 'string' ? field['description'].trim() : '';
          field['description'] = en ? `${ko}\n\n${en}` : ko;
        }
        visit(field);
      }
    }
    if (record['items']) visit(record['items']);
    for (const branch of ['anyOf', 'oneOf', 'allOf']) {
      if (Array.isArray(record[branch])) (record[branch] as unknown[]).forEach(visit);
    }
  };
  visit(json);
  return json;
}

/** Shared envelope output schema fragment (structuredContent contract). */
export const ENVELOPE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    tool: { type: 'string' },
    surface: { type: 'string' },
    next_actions: { type: 'array', items: { type: 'string' } },
    data: { type: 'object' },
    over_fire_gate: { type: 'object' },
    error_code: { type: 'string' },
    message: { type: 'string' },
  },
  required: ['ok', 'tool'],
} as const;
