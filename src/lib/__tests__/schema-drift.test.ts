/**
 * 스키마 드리프트 가드 (2026-06-13 근원 분석의 두 번째 예방 장치).
 *
 * 구멍의 부류: TS 인터페이스에 필드를 추가하고 upsert로 보내는데 Supabase에
 * 컬럼이 없으면 — sanitizeItem이 (user_id/created_at/updated_at만 빼고) 전부
 * 통과시키므로 — PostgREST가 PGRST204로 **행 전체를 거부**한다. 에러는
 * fire-and-forget으로 삼켜지므로 화면은 멀쩡하고, 그 사용자의 데이터(예:
 * contact가 채워진 페르소나)는 조용히 서버에 영영 안 닿는다.
 *
 * 이 테스트가 그 부류를 PR 시점에 막는다: 동기화되는 인터페이스(Project,
 * Persona)의 모든 최상위 필드는 아래 TABLE_COLUMNS 매니페스트(실DB 컬럼의
 * 사본) 또는 LOCAL_ONLY(업서트 전 제거되거나 보내지 않는 필드)에 선언돼야
 * 한다. 인터페이스에 필드를 더하면, 매니페스트(=마이그레이션)를 갱신하거나
 * LOCAL_ONLY에 사유와 함께 넣기 전까지 빌드가 막힌다.
 *
 * ⚠️ TABLE_COLUMNS는 마이그레이션을 적용할 때마다 같이 갱신해야 한다. 이 테스트는
 *    "인터페이스 필드 ⊆ 매니페스트"만 본다(오프라인). 매니페스트 자체가 실DB와
 *    맞는지는 CI가 실DB에 접속할 수 없으므로 온디맨드 스크립트로 대조한다:
 *      node scripts/check-schema-drift.mjs <list_tables(verbose) 결과.json>
 *    (마지막 대조 2026-06-29: 17개 동기화 테이블 전부 실DB와 일치, 위험 0건.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 실DB 컬럼의 사본 (2026-06-13 마이그레이션 반영 후). 마이그레이션과 함께 갱신. */
const TABLE_COLUMNS: Record<string, string[]> = {
  projects: [
    'id', 'user_id', 'name', 'description', 'refs', 'created_at', 'updated_at',
    'team_id', 'meta_reflection', 'decision_contract',
    'deleted_at', 'outcome', 'confidence_at_completion', // ← 2026-06-13 추가
  ],
  personas: [
    'id', 'user_id', 'name', 'role', 'organization', 'priorities',
    'communication_style', 'known_concerns', 'relationship_notes',
    'extracted_traits', 'feedback_logs', 'created_at', 'updated_at',
    'influence', 'is_example', 'decision_style', 'risk_tolerance', 'success_metric',
    'deleted_at', 'user_description', 'contact', // ← 2026-06-13 추가
  ],
  // ← 2026-06-18: 코드가 upsert하지만 실DB에 없던 3개 테이블 신설 (finish-line 감사).
  reframe_items: [
    'id', 'user_id', 'project_id', 'loop_id', 'iteration_number', 'input_text',
    'analysis', 'selected_question', 'final_decomposition', 'status',
    'user_edited_question', 'reanalysis_count', 'interview_signals',
    'deleted_at', 'created_at', 'updated_at',
  ],
  recast_items: [
    'id', 'user_id', 'project_id', 'loop_id', 'iteration_number', 'input_text',
    'analysis', 'steps', 'status', 'deleted_at', 'created_at', 'updated_at',
  ],
  synthesize_items: [
    'id', 'user_id', 'project_id', 'loop_id', 'iteration_number', 'raw_input',
    'sources', 'analysis', 'final_synthesis', 'status',
    'deleted_at', 'created_at', 'updated_at',
  ],
  // ← 2026-06-18: plugin→webapp bridge tables (plugin saved content landing zone).
  plugin_decisions: [
    'id', 'user_id', 'source', 'ledger_id', 'project', 'session', 'decided_at',
    'harvested_at', 'quote', 'decision', 'type', 'stakes', 'status', 'predicate',
    'falsified_if', 'check_by', 'sealed_at', 'predicate_owner', 'outcome', 'settled_at', 'settle_note',
    'dismissed_at', 'dismiss_reason', 'history', 'raw', 'imported_at',
    'created_at', 'updated_at',
  ],
  plugin_bearings: [
    'id', 'user_id', 'source', 'session', 'version_label', 'label', 'current_course',
    'why_this_course', 'fog_or_reef', 'road_not_taken', 'next_helm', 'contract_seed',
    'blocked', 'generated_at', 'raw', 'imported_at', 'created_at', 'updated_at',
  ],
  plugin_events: [
    'id', 'user_id', 'plugin_decision_id', 'ledger_id', 'event_id', 'event',
    'payload', 'source', 'applied_at', 'created_at',
  ],
  // ← 2026-07-01 Judgment Review: the rich JudgmentReceipt rides in `data` jsonb
  // (drift-proof), so this table is NOT a field-by-field synced interface — it is
  // absent from the it.each list below on purpose. Only the lifted query columns
  // + the soft-delete column are asserted here.
  review_receipts: [
    'id', 'user_id', 'state', 'source_title', 'source_kind', 'next_check_by',
    'data', 'created_at', 'updated_at', 'deleted_at', 'companion_notified_at',
  ],
  // ← 2026-06-19 backend audit: the guard covered only 7 of 18 synced interfaces,
  // which is exactly why the agents *En drift went live. Cover the rest.
  agents: [
    'id', 'user_id', 'name', 'role', 'emoji', 'color', 'origin', 'capabilities',
    'group', 'chain_id', 'unlock_condition', 'unlocked', 'expertise', 'tone', 'keywords',
    'organization', 'priorities', 'communication_style', 'known_concerns', 'relationship_notes',
    'influence', 'decision_style', 'risk_tolerance', 'success_metric', 'extracted_traits',
    'feedback_logs', 'personality_code', 'personality_profile', 'boss_gender', 'saju_profile',
    'xp', 'level', 'observations', 'is_builtin', 'is_example', 'archived', 'last_used_at',
    'created_at', 'updated_at', 'chat_history', 'birth_year', 'birth_month',
    'inner_monologue_archive', 'birth_day', 'zodiac_profile', 'boss_locale', 'user_context_hint',
    'nameEn', 'roleEn', 'expertiseEn', 'toneEn', // ← 2026-06-19 added (were the live drift)
  ],
  agent_chains: ['id', 'user_id', 'name', 'agent_ids', 'total_tasks', 'created_at', 'updated_at'],
  agent_activities: ['id', 'user_id', 'agent_id', 'type', 'context', 'session_id', 'xp_earned', 'created_at'],
  feedback_records: [
    'id', 'user_id', 'project_id', 'loop_id', 'iteration_number', 'document_title', 'document_text',
    'persona_ids', 'feedback_perspective', 'feedback_intensity', 'results', 'synthesis',
    'created_at', 'structured_synthesis', 'discussion', 'discussion_takeaway',
  ],
  judgment_records: [
    'id', 'user_id', 'project_id', 'type', 'context', 'decision', 'reasoning',
    'original_ai_suggestion', 'user_changed', 'tool', 'created_at',
  ],
  accuracy_ratings: [
    'id', 'user_id', 'feedback_record_id', 'persona_id', 'accuracy_score', 'accuracy_notes',
    'which_aspects_accurate', 'which_aspects_inaccurate', 'created_at',
  ],
  quality_signals: ['id', 'user_id', 'project_id', 'tool', 'signal_type', 'signal_data', 'created_at'],
  outcome_records: [
    'id', 'user_id', 'project_id', 'hypothesis_result', 'hypothesis_notes', 'materialized_risks',
    'approval_outcomes', 'overall_success', 'key_learnings', 'what_would_change', 'created_at',
  ],
  retrospective_answers: [
    'id', 'user_id', 'project_id', 'question_id', 'question_text', 'category', 'answer', 'data_basis', 'created_at',
  ],
  decision_quality_scores: [
    'id', 'user_id', 'project_id', 'appropriate_frame', 'creative_alternatives', 'relevant_information',
    'clear_values', 'sound_reasoning', 'commitment_to_action', 'initial_framing_challenged',
    'blind_spots_surfaced', 'user_changed_mind', 'overall_dq', 'created_at',
  ],
  // ← 2026-07-01: decision items (premise/phenomenon/… tracked objects). Interface
  //   lives in src/lib/decision-items.ts (the shared brain), not types.ts.
  decision_items: [
    'id', 'user_id', 'decision_id', 'type', 'text', 'source', 'authored', 'edits',
    'external', 'load_bearing', 'alert', 'status', 'created_at', 'updated_at',
  ],
  // ← 2026-07-29: 실DB 재대조 중 이 둘이 db.ts의 동기화 목록에 있으면서
  //   매니페스트에도 커버리지 목록에도 없다는 걸 발견했다 (아래 파생 가드가 그걸 잡아낸 지점).
  //   두 표 다 전체 객체가 아니라 명시적 row shape를 upsert하므로 위험은 낮았지만,
  //   "가드가 없다"는 사실 자체가 이 파일이 막으려는 부류다.
  review_receipts: [
    'id', 'user_id', 'state', 'source_title', 'source_kind', 'next_check_by',
    'data', 'companion_notified_at', 'deleted_at', 'created_at', 'updated_at',
  ],
  progressive_sessions: [
    'id', 'user_id', 'project_id', 'data', 'phase', 'has_pending_humans',
    'created_at', 'updated_at',
  ],
};

/** 인터페이스엔 있으나 컬럼이 아닌(보내지지 않거나 sanitize로 제거되는) 필드. */
const LOCAL_ONLY: Record<string, Record<string, string>> = {
  projects: {},
  personas: {},
  reframe_items: {},
  recast_items: {},
  synthesize_items: {},
  // 인지 구조 기록 (2026-08-17 마이그레이션 20260817000000). 동기화 인터페이스가
  // 아직 없으므로(엔진이 순수, 지속은 cognition-db.ts) 컬럼 목록만 실DB 사본으로 둔다.
  cognitive_attributions: {},
  cognitive_frames: {},
  cognitive_frame_elements: {},
  cognitive_frame_readings: {},
  cognitive_premises: {},
  cognitive_frame_premises: {},
  cognitive_premise_readings: {},
  plugin_decisions: {},
  plugin_bearings: {},
  plugin_events: {},
};

/** types.ts에서 한 인터페이스의 최상위 필드명만 추출 (중첩 객체는 brace-depth로 건너뜀). */
function topLevelFields(src: string, ifaceName: string): string[] {
  const start = src.indexOf(`export interface ${ifaceName} {`);
  if (start < 0) throw new Error(`interface ${ifaceName} not found`);
  let i = src.indexOf('{', start) + 1;
  let depth = 1;
  const fields: string[] = [];
  let atLineStart = true;
  for (; i < src.length && depth > 0; i++) {
    const c = src[i];
    if (c === '{') { depth++; atLineStart = false; continue; }
    if (c === '}') { depth--; atLineStart = false; continue; }
    if (c === '\n') { atLineStart = true; continue; }
    if (depth === 1 && atLineStart) {
      // Match `  fieldName?:` or `  fieldName:` at top level, skipping comments.
      const rest = src.slice(i);
      const m = rest.match(/^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)\s*\??\s*:/);
      if (m) { fields.push(m[1]); }
      atLineStart = false;
    } else if (c !== ' ' && c !== '\t') {
      atLineStart = false;
    }
  }
  return [...new Set(fields)];
}

const TYPES_SRC = readFileSync(join(process.cwd(), 'src/stores/types.ts'), 'utf8');
const AGENT_TYPES_SRC = readFileSync(join(process.cwd(), 'src/stores/agent-types.ts'), 'utf8');
const DECISION_ITEMS_SRC = readFileSync(join(process.cwd(), 'src/lib/decision-items.ts'), 'utf8');
const DB_SRC = readFileSync(join(process.cwd(), 'src/lib/db.ts'), 'utf8');

/** Resolve an interface's fields from whichever source file declares it. */
function fieldsOf(iface: string): string[] {
  const src = [TYPES_SRC, AGENT_TYPES_SRC, DECISION_ITEMS_SRC].find((s) =>
    s.includes(`export interface ${iface} {`),
  );
  if (!src) throw new Error(`interface ${iface} not found`);
  return topLevelFields(src, iface);
}

/**
 * 이 파일의 커버리지 목록(아래 `SYNCED_INTERFACES`)도, db.ts의 `TableName`도 손으로 쓴
 * 목록이다 — **두 곳이 같아야 하는데 한 곳만 고쳐지는** 바로 그 부류다. 실제로
 * 그렇게 됐다: `review_receipts`와 `progressive_sessions`가 db.ts에 동기화 테이블로
 * 올라간 뒤 이 파일에는 끝내 도착하지 않았고, 2026-07-29 실DB 대조 전까지
 * 아무도 몰랐다.
 *
 * 그래서 커버리지 목록을 **db.ts에서 파생**시켜 대조한다. 새 동기화 테이블은 이제
 * 매니페스트와 커버리지를 갖추거나 사유를 적어야 하고, 둘 다 아니면 CI가 막는다.
 */
function syncedTablesFromDbSource(): string[] {
  const m = /type TableName =([\s\S]*?);/.exec(DB_SRC);
  if (!m) throw new Error('db.ts의 TableName 유니온을 읽지 못했다 — 파서를 고쳐라');
  return [...new Set([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]))];
}

/**
 * 인터페이스가 아니라 **명시적 row 리터럴/타입**으로 업서트하는 표. 전체 객체를
 * 보내지 않으므로 인터페이스 대조 대상은 아니지만, 그 키들도 컬럼이어야 하는 건 같다.
 * 사유 없이 여기 넣는 것은 금지 — 아래 테스트가 사유 길이를 본다.
 */
const ROW_SHAPE_ONLY: Record<string, string> = {
  review_receipts:
    'toReceiptRow()가 JudgmentReceipt 전체가 아니라 6개 컬럼짜리 ReceiptRow만 만들어 보낸다 '
    + '(본문은 data jsonb 안). 인터페이스 대조 대신 TABLE_COLUMNS 매니페스트가 계약이다.',
  progressive_sessions:
    'useProgressiveStore가 인라인 리터럴(id/project_id/data/phase/has_pending_humans/updated_at)로 '
    + '업서트한다. 세션 본문은 data jsonb 안이라 최상위 키는 이 6개로 고정.',
};

describe('스키마 드리프트: 커버리지 목록이 db.ts와 갈라지지 않는다', () => {
  const synced = syncedTablesFromDbSource();

  it('db.ts에서 실제 테이블 목록을 읽는다 (빈손으로 통과하지 않는다)', () => {
    expect(synced).toContain('projects');
    expect(synced).toContain('review_receipts');
    expect(synced.length).toBeGreaterThan(15);
  });

  it('동기화되는 모든 테이블에 컬럼 매니페스트가 있다', () => {
    const missing = synced.filter((t) => !(t in TABLE_COLUMNS));
    expect(
      missing,
      `db.ts가 upsert하는데 TABLE_COLUMNS에 없는 테이블 — 컬럼 없는 필드가 붙으면 `
      + `PGRST204로 행 전체가 조용히 거부된다: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('동기화되는 모든 테이블이 인터페이스 대조 대상이거나 사유가 적힐 row-shape 표다', () => {
    const covered = new Set(SYNCED_INTERFACES.map(([t]) => t));
    const undeclared = synced.filter((t) => !covered.has(t) && !(t in ROW_SHAPE_ONLY));
    expect(
      undeclared,
      `이 테이블들은 동기화되는데 필드 대조가 전혀 없다. 인터페이스를 아래 목록에 등록하거나, `
      + `명시적 row shape로만 쓴다면 사유와 함께 ROW_SHAPE_ONLY에 적어라: ${undeclared.join(', ')}`,
    ).toEqual([]);
  });

  it('ROW_SHAPE_ONLY 면제에는 사유가 있다', () => {
    const unreasoned = Object.entries(ROW_SHAPE_ONLY).filter(([, r]) => r.trim().length < 40).map(([t]) => t);
    expect(unreasoned).toEqual([]);
  });
});

const SYNCED_INTERFACES: Array<[string, string]> = [
    ['projects', 'Project'],
    ['personas', 'Persona'],
    ['reframe_items', 'ReframeItem'],
    ['recast_items', 'RecastItem'],
    ['synthesize_items', 'SynthesizeItem'],
    ['plugin_decisions', 'PluginDecision'],
    ['plugin_bearings', 'PluginBearing'],
    ['plugin_events', 'PluginEvent'],
    // ← 2026-06-19 backend audit: cover the remaining synced interfaces.
    ['agents', 'Agent'],
    ['agent_chains', 'AgentChain'],
    ['agent_activities', 'AgentActivity'],
    ['feedback_records', 'FeedbackRecord'],
    ['judgment_records', 'JudgmentRecord'],
    ['accuracy_ratings', 'PersonaAccuracyRating'],
    ['quality_signals', 'QualitySignal'],
    ['outcome_records', 'OutcomeRecord'],
    ['retrospective_answers', 'RetrospectiveAnswer'],
    ['decision_quality_scores', 'DecisionQualityScore'],
    ['decision_items', 'DecisionItem'],
];

describe('스키마 드리프트: 동기화 인터페이스 필드 ⊆ 실제 컬럼', () => {
  it.each(SYNCED_INTERFACES)('%s: 모든 %s 필드가 컬럼 또는 LOCAL_ONLY로 선언돼 있다', (table, iface) => {
    const cols = new Set(TABLE_COLUMNS[table]);
    const localOnly = LOCAL_ONLY[table] ?? {};
    for (const field of fieldsOf(iface)) {
      const ok = cols.has(field) || field in localOnly;
      expect(
        ok,
        `${iface}.${field}: '${table}'에 컬럼이 없음 — 마이그레이션으로 컬럼을 추가하고 ` +
          `TABLE_COLUMNS를 갱신하거나, 보내지 않는 필드면 사유와 함께 LOCAL_ONLY에 선언하라. ` +
          `(미선언 시 contact/description처럼 행 전체가 PGRST204로 동기화 실패)`,
      ).toBe(true);
    }
  });

  it('sanitizeItem은 컬럼 없는 키를 통과시키므로 — 이 가드의 전제가 유지된다', () => {
    // 만약 sanitizeItem이 화이트리스트 필터로 바뀌면 드리프트 부류가 사라지지만
    // 이 테스트의 가정도 바뀐다 — 그 변화를 의식적으로 만들도록 못박는다.
    const fn = DB_SRC.slice(DB_SRC.indexOf('function sanitizeItem'));
    expect(fn).toContain('user_id: _uid');
    expect(fn).toContain('...rest'); // 나머지 통과 = 드리프트 가능 = 이 가드 필요
  });

  it('소프트삭제 대상 테이블은 deleted_at 컬럼을 갖는다 (부활 버그 회귀 방지)', () => {
    // SoftDeletableTable 중 실제 컬럼을 매니페스트로 검증 가능한 것만.
    for (const table of ['projects', 'personas', 'reframe_items', 'recast_items', 'synthesize_items', 'review_receipts']) {
      expect(TABLE_COLUMNS[table], `${table}: soft-delete가 쓰는 deleted_at 컬럼 누락`).toContain('deleted_at');
    }
  });

  it('LOCAL_ONLY 선언에는 사유가 있다 (이유 없는 제외 금지)', () => {
    for (const [table, fields] of Object.entries(LOCAL_ONLY)) {
      for (const [field, reason] of Object.entries(fields)) {
        expect(reason.trim().length, `${table}.${field}: LOCAL_ONLY 사유를 적어라`).toBeGreaterThan(4);
      }
    }
  });
});
