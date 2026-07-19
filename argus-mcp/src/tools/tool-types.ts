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
// The single id type: 1–128 chars, [A-Za-z0-9._-]. The bound lives here so
// every tool (predict/amend/dismiss/recheck) advertises the SAME limit the
// runtime path guard enforces — previously bare `zId` promised an unbounded id
// that then threw a PathSafetyError deep in the write path.
export const zId = z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/, 'id may only contain A-Z a-z 0-9 . _ -');
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const KO_FIELD_DESCRIPTIONS: Record<string, string> = {
  argus_dir: '프로젝트의 .argus 절대 경로입니다. 생략하면 MCP 설정의 ARGUS_DIR을 사용합니다.',
  id: '결정 식별자입니다.',
  decision: '사용자가 실제로 마주한 선택 또는 사용자가 직접 내린 판단입니다.',
  stakes: '틀렸을 때의 비용입니다.',
  reversibility: '결정을 되돌릴 수 있는 정도입니다.',
  status_quo: '아무것도 하지 않을 때 일어나는 일입니다.',
  already_decided: '이미 결정을 내렸는지 여부입니다.',
  crux_question: '결정을 좌우하는 중립적인 핵심 질문 하나입니다.',
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
  reconsider_cadence_days: '미결 질문을 다시 살펴볼 간격(일)입니다.',
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
  include_upcoming_days: '며칠 안에 확인일이 오는 예측까지 함께 표시합니다.',
  fleet: '이 컴퓨터의 다른 Argus 프로젝트에 있는 확인 건수도 함께 봅니다.',
  view: '불러올 기록의 종류입니다.',
  due_only: '확인일이 된 기록만 표시합니다.',
  limit: '표시할 최대 기록 수입니다.',
  import_settlements: '웹에서 기록한 실제 결과를 로컬 판단 기록으로 가져옵니다.',
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

/** English half of the public schema copy. tools/list has no request locale,
 * so every field a user or model can see must carry both languages. Keep this
 * map independent of whichever language the underlying compatibility schema
 * happened to use. */
const EN_FIELD_DESCRIPTIONS: Record<string, string> = {
  argus_dir: 'Absolute path to the project .argus directory. Omit it to use ARGUS_DIR from the MCP configuration.',
  id: 'Stable identifier for the decision.',
  decision: 'The choice the user is facing, or the user’s own answer to an open question.',
  stakes: 'Cost of being wrong.',
  reversibility: 'How difficult the decision is to reverse.',
  status_quo: 'What happens if nothing changes.',
  already_decided: 'Whether the user has already made the decision.',
  crux_question: 'The one neutral, load-bearing question the decision turns on.',
  load_bearing_assumption: 'The single assumption the decision depends on most.',
  related_to: 'Past decision ids the user considers related.',
  action: 'The operation to perform.',
  premises: 'Premises or open questions to add.',
  text: 'The original sentence. Do not rewrite or summarize it.',
  kind: 'Whether this item is a premise or an open question.',
  external: 'Whether this is a fact that can be checked against external reality.',
  load_bearing: 'Whether the decision would change if this premise were false.',
  source: 'Where the fact or sentence came from.',
  ai_original: 'The AI’s original wording when the source is ai_surfaced.',
  recheck_cadence_days: 'Number of days between checks of a premise fact.',
  reconsider_cadence_days: 'Number of days before revisiting an open question.',
  ref: 'Reference number or id of the target premise or open question.',
  finding: 'The currently verified fact in a sentence that can be compared later.',
  numeric_value: 'Current numeric value of a measurable fact.',
  changed: 'Whether a sentence-based fact materially changed from its baseline.',
  source_detail: 'Source URL or short citation detail.',
  apply_to_matching: 'Apply this re-check to other decisions tracking the same fact.',
  predicate: 'A falsifiable prediction that reality can answer.',
  check_by: 'Future date, in YYYY-MM-DD, when the prediction can be checked.',
  dismiss_reason: 'Why this decision no longer needs tracking.',
  note: 'Optional note.',
  file_path: 'Absolute path to the document to review.',
  source_kind: 'Override the automatically detected document type.',
  title: 'Title of the document or record.',
  concerns: 'Areas to emphasize in the review.',
  audience_hint: 'Hint about the document’s intended audience.',
  biggest_worry: 'The user’s main concern about the document.',
  predicate_owner: 'Who authored the prediction. Never forge provenance.',
  confirm_draft: 'Ask for one-tap confirmation when the AI drafted the prediction.',
  basis: 'How the user characterizes the role of judgment and luck when looking back.',
  real_question: 'The real question behind the recorded answer.',
  unverified_assumption: 'The core assumption that has not yet been verified.',
  human_only: 'The part only a human can judge.',
  human_judgment: 'The user’s own one-line judgment.',
  include_upcoming_days: 'Also show predictions whose check date falls within this many days.',
  fleet: 'Also report due counts from other Argus projects on this computer.',
  outcome: 'What actually happened to the prediction. The model must not infer it.',
  outcome_source: 'Who stated the result. Only user_stated is accepted.',
  what_happened: 'What actually happened, in the user’s own words.',
  broken_premise_ref: 'Premise the user says affected the outcome.',
  defer_to: 'Future date to check again when reality has not answered yet.',
  view: 'Which part of the decision record to read.',
  locale: 'User-facing language: ko or en.',
  ambient_mute: 'Hide due reminder lines during the session.',
  premise_sync: 'When explicitly enabled, sync tracked premises with the account.',
  due_only: 'Sync only records whose check date has arrived.',
  import_settlements: 'Import results recorded on the web into the local decision record.',
  push_local: 'Retry local changes that have not reached the account.',
};

/** JSON Schema for tools/list, generated from the Zod source (drop $schema noise). */
export function toolJsonSchema(schema: ToolInputSchema): Record<string, unknown> {
  // io:'input' — this schema describes the tool's ARGUMENTS. Zod v4 defaults
  // z.toJSONSchema to io:'output', which marks every `.default()` field as
  // REQUIRED (while still emitting its default) — so a strict host / the MCP
  // Inspector would reject `argus_check_in {}` (the mandated session-start call),
  // `argus_patterns {}`, and a premise without kind/external/load_bearing, even
  // though the runtime validator fills those defaults. Input mode advertises them
  // as optional; additionalProperties:false (strictObject) is preserved.
  const json = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
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
          const existing = typeof field['description'] === 'string' ? field['description'].trim() : '';
          const en = EN_FIELD_DESCRIPTIONS[key] ?? existing;
          const base = en ? `${ko}\n\n${en}` : ko;
          // A richer Zod .describe() (e.g. the argus_patterns `view` enum-value
          // glossary) must not be dropped by the short bilingual map — append it
          // when it carries more than the base already says. Never append a
          // describe that references an internal tool name (argus_*): the
          // bilingual map masks those on purpose, and re-surfacing one leaks an
          // internal name into tools/list (public-surface-names guard).
          field['description'] = existing.length > base.length && !base.includes(existing) && !/argus_/.test(existing)
            ? `${base}\n\n${existing}`
            : base;
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
    // error results also carry these — declared so a host that validates
    // structuredContent against outputSchema on ERROR results (the SDK does, even
    // when isError) would still pass if the schema were ever hardened to
    // additionalProperties:false.
    recovery: { type: 'string' },
    invalid_fields: { type: 'array', items: { type: 'object' } },
  },
  required: ['ok', 'tool'],
} as const;
