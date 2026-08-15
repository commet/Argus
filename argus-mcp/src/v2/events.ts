/**
 * Argus v2 원장 이벤트 — envelope + 전수 인벤토리의 zod discriminated union.
 *
 * ★ 이 파일이 payload 스키마의 단일 소스다 (정본 II-A: "payload 스키마는 P1 첫
 *   커밋의 zod discriminated union이 단일 소스 — 문서는 인벤토리와 규칙만
 *   정본으로 유지한다"). 이벤트를 추가·변경할 때:
 *   1. 여기의 스키마를 바꾼다 (필드는 여기서만 정의된다).
 *   2. 이벤트 "이름"이 늘거나 줄면 정본 II-A 인벤토리도 같은 커밋에서 갱신한다
 *      — events.test.ts의 drift 가드가 스펙 문서와 이 union을 대조해 어긋나면
 *      CI가 빨간불이 된다 (스펙 따로 코드 따로를 구조적으로 금지).
 *
 * 설계 규칙 (사람이 수정할 때 지켜야 하는 것):
 *  - 모든 오브젝트는 strictObject — 미지 키는 조용히 통과하지 않고 거절된다.
 *    (LLM-glue 불변식: 끊어진 배선은 시끄럽게 죽어야 한다.)
 *  - 사용자-소유 가능 필드(predicate, check_by, outcome, heading, remaining[],
 *    human_judgment, premise text …)는 반드시 provenanced() — 값과 출처가
 *    한 몸으로만 존재할 수 있다 (정본 II-B 필드 단위 provenance).
 *  - `host_reported`는 절대 user로 자동 승격되지 않는다 — 그 규칙은 스키마가
 *    아니라 소비자(reducer·렌더러)의 몫이지만, 출처 자체를 잃는 것은 여기서
 *    타입으로 막는다.
 *  - due는 파생 상태라 이벤트가 아니다. candidate의 expired도 파생이라 이벤트가
 *    없다 (읽기 시 logical_date로 계산 — 정본 II-A 상태 전이표).
 *  - 정본 순서는 event_id(ULID)가 아니라 JSONL append 순서다 (정본 II-E).
 */
import { z } from 'zod';

// ── 공용 원자 ──────────────────────────────────────────────

/** Crockford base32 ULID (26자). 시계 역행 환경에서도 유일성만 책임진다 —
 *  순서 보장으로 쓰지 말 것(II-E: 정본 순서는 append 순서). */
const zUlid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'ULID expected');
const zUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'UUID expected');
const zIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD expected');
const zIsoDateTime = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  'ISO datetime expected',
);
/** v1 zId와 동일한 슬러그 규율 — 경로 세그먼트로 쓰여도 안전해야 한다. */
const zSlug = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, 'slug expected');
const zSha256Hex = z.string().regex(/^[0-9a-f]{64}$/, 'sha256 hex expected');
const zGitSha = z.string().regex(/^[0-9a-f]{7,40}$/, 'git sha expected');

// ── provenance (정본 II-B) ────────────────────────────────

export const PROVENANCE = ['elicited_user', 'direct_user_command', 'host_reported', 'ai_surfaced'] as const;
export const zProvenance = z.enum(PROVENANCE);
export type Provenance = (typeof PROVENANCE)[number];

/** 값과 출처를 한 몸으로 — 출처 없는 사용자-소유 필드는 타입상 존재 불가. */
const provenanced = <T extends z.ZodType>(value: T) =>
  z.strictObject({ value, provenance: zProvenance });

// ── 증거 포인터 (정본 II-C — 필드명 1:1) ───────────────────

export const zEvidencePointer = z
  .strictObject({
    host_schema_version: z.string().min(1),
    source_ref: z.string().min(1).max(1024),
    source_prefix_length: z.number().int().positive(),
    source_prefix_sha256: zSha256Hex,
    turn_id: z.string().max(128).optional(),
    role: z.enum(['user', 'assistant']),
    quote_byte_start: z.number().int().nonnegative(),
    quote_byte_end: z.number().int().positive(),
    raw_quote: z.string().min(1).max(2000),
    raw_quote_sha256: zSha256Hex,
    normalization_version: z.string().min(1),
  })
  .refine((p) => p.quote_byte_end > p.quote_byte_start, { message: 'quote_byte_end must be > quote_byte_start' })
  .refine((p) => p.source_prefix_length >= p.quote_byte_end, {
    message: 'prefix must cover the quote (source_prefix_length >= quote_byte_end)',
  });

/** 신뢰 등급 (II-C): byte_verified > pasted > host_reported. */
export const QUOTE_VERIFICATION = ['byte_verified', 'pasted', 'host_reported'] as const;
export const zQuoteVerification = z.enum(QUOTE_VERIFICATION);

// ── envelope (정본 II-A — 모든 이벤트 공통) ────────────────

export const ENVELOPE_SHAPE = {
  event_id: zUlid,
  /** 이벤트 스키마 버전. 과거 버전은 영원히 읽는다(II-E) — 리더가 버전별로 분기. */
  v: z.literal(2),
  producer_version: z.string().min(1),
  repository_id: zUuid,
  workspace_id: zUuid,
  session_id: z.string().min(1).max(128),
  occurred_at: zIsoDateTime,
  logical_date: zIsoDate,
  tz: z.string().min(1).max(64),
  idempotency_key: z.string().min(1).max(128),
} as const;

// ── 이벤트별 payload ──────────────────────────────────────
// 결정 축의 상태 전이(정본 II-A): absent → harvested → sealed → settled|dismissed.
// terminal 이후 재호출 거절(ALREADY_SETTLED 류)은 reducer의 transition guard 몫.

export const SETTLE_OUTCOMES = ['held', 'avoided', 'partial', 'still_pending', 'missed'] as const;
export const CANDIDATE_KINDS = ['claim', 'premise', 'question', 'decision'] as const;
export const CANDIDATE_ACTIONS = ['promote', 'drop', 'snooze'] as const;
export const PREMISE_RECHECK_RESULTS = ['holds', 'drifted', 'broken', 'unknown'] as const;

const D = ENVELOPE_SHAPE; // 지면 절약용 별칭 — 모든 이벤트에 spread

export const ArgusEventSchema = z.discriminatedUnion('event', [
  // ── 결정 축 ──
  z.strictObject({ ...D, event: z.literal('harvest'), decision_id: zSlug,
    text: provenanced(z.string().min(1).max(400)),
    // 인지 수집 (입력 깊이 사이클 1, v1 harvest에서 미러) — real_question 등
    // seal의 선례를 따라 plain optional. 채널 provenance는 v1 저자성 규율이
    // 나른다 (여기서 떨구면 "계수되며 유실하는 거울"이 된다 — 15차).
    question: z.string().min(1).max(400).optional(),
    values: z.array(z.string().min(1).max(120)).max(3).optional(),
    rejected_alternative: z.strictObject({
      alternative: z.string().min(1).max(200),
      reason: z.string().min(1).max(200),
    }).optional(),
    load_bearing_assumption: z.string().min(1).max(400).optional(),
    evidence: zEvidencePointer.optional() }),
  z.strictObject({ ...D, event: z.literal('seal'), decision_id: zSlug,
    predicate: provenanced(z.string().min(8).max(400)),
    check_by: provenanced(zIsoDate),
    basis: z.enum(['judgment', 'luck', 'mixed', 'unsure']).optional(),
    real_question: z.string().max(400).optional(),
    /** 결정이 답하는 질문 (사이클 2, v1 seal의 question) — real_question(봉인
     *  인자의 별도 필드)과 다른 v1 출처이므로 슬롯을 합치지 않는다(발산 방지). */
    question: z.string().min(1).max(400).optional(),
    /** 사용자가 표현한 확신도 (사이클 2) — 정산 대조·보정 기록의 재료. */
    confidence: z.enum(['confident', 'uncertain', 'contested']).optional(),
    unverified_assumption: z.string().max(400).optional(),
    human_only: z.string().max(400).optional(),
    /** 반드시 사용자의 말 — ai_surfaced로 남더라도 출처를 위조하지 않는다(II-B). */
    human_judgment: provenanced(z.string().min(1).max(400)).optional() }),
  z.strictObject({ ...D, event: z.literal('amend'), decision_id: zSlug,
    predicate: provenanced(z.string().min(8).max(400)).optional(),
    check_by: provenanced(zIsoDate).optional() })
    .refine((e) => e.predicate !== undefined || e.check_by !== undefined,
      { message: 'amend must change at least one field' }),
  z.strictObject({ ...D, event: z.literal('dismiss'), decision_id: zSlug,
    reason: z.string().max(400).optional() }),
  z.strictObject({ ...D, event: z.literal('settle'), decision_id: zSlug,
    outcome: provenanced(z.enum(SETTLE_OUTCOMES)),
    note: z.string().max(2000).optional() }),
  z.strictObject({ ...D, event: z.literal('snooze'), decision_id: zSlug,
    until: zIsoDate }),

  // ── 전제 축 ──
  z.strictObject({ ...D, event: z.literal('premise_add'), premise_id: zSlug,
    decision_id: zSlug.optional(),
    kind: z.enum(['premise', 'fact', 'question']),
    text: provenanced(z.string().min(1).max(400)),
    load_bearing: z.boolean().optional(),
    /** 사용자가 이 전제에 표현한 확신 정도 (입력 깊이 사이클 1). 창 경유
     *  여부는 별도 필드가 아니라 text.provenance='elicited_user'가 나른다. */
    confidence: z.enum(['confident', 'uncertain', 'contested']).optional(),
    recheck_cadence_days: z.number().int().positive().max(365).optional(),
    /** 캡처 후보에서 승격된 경우 원본 참조 — 원본은 원장에 그대로(이동 아님). */
    from_candidate: zSlug.optional() }),
  z.strictObject({ ...D, event: z.literal('premise_amend'), premise_id: zSlug,
    text: provenanced(z.string().min(1).max(400)).optional(),
    recheck_cadence_days: z.number().int().positive().max(365).optional() })
    .refine((e) => e.text !== undefined || e.recheck_cadence_days !== undefined,
      { message: 'premise_amend must change at least one field' }),
  z.strictObject({ ...D, event: z.literal('premise_recheck'), premise_id: zSlug,
    result: z.enum(PREMISE_RECHECK_RESULTS),
    note: z.string().max(400).optional() }),
  z.strictObject({ ...D, event: z.literal('premise_resolve'), premise_id: zSlug,
    resolution: provenanced(z.string().min(1).max(400)) }),

  // ── 캡처 후보 축 (created ≠ surfaced — 별개 사건, 정본 II-A) ──
  z.strictObject({ ...D, event: z.literal('candidate_created'), candidate_id: zSlug,
    kind: z.enum(CANDIDATE_KINDS),
    quote: z.string().min(1).max(2000),
    quote_speaker: z.enum(['user', 'assistant', 'unknown']),
    verification: zQuoteVerification,
    evidence: zEvidencePointer.optional(),
    source: z.enum(['harvest_sweep', 'debrief', 'user']) })
    .refine((e) => e.verification !== 'byte_verified' || e.evidence !== undefined,
      { message: 'byte_verified requires an evidence pointer — 등급을 사칭할 수 없다' }),
  z.strictObject({ ...D, event: z.literal('candidate_surfaced'), candidate_id: zSlug,
    surface: z.enum(['brief', 'check_in', 'debrief', 'logbook']) }),
  z.strictObject({ ...D, event: z.literal('candidate_action'), candidate_id: zSlug,
    action: z.enum(CANDIDATE_ACTIONS),
    snooze_until: zIsoDate.optional(),
    /** promote 시 생성된 대상 참조 (결정 또는 전제). */
    promoted_to: z.strictObject({ kind: z.enum(['decision', 'premise']), id: zSlug }).optional() })
    .refine((e) => e.action !== 'snooze' || e.snooze_until !== undefined,
      { message: 'snooze requires snooze_until' })
    .refine((e) => e.action !== 'promote' || e.promoted_to !== undefined,
      { message: 'promote requires promoted_to' }),

  // ── bearing 축 (set → updated* → arrived|abandoned; terminal 후 재-set은 새 bearing) ──
  z.strictObject({ ...D, event: z.literal('bearing_set'), bearing_id: zSlug,
    heading: provenanced(z.string().min(1).max(400)),
    remaining: z.array(provenanced(z.string().min(1).max(400))).max(20) }),
  z.strictObject({ ...D, event: z.literal('bearing_updated'), bearing_id: zSlug,
    heading: provenanced(z.string().min(1).max(400)).optional(),
    remaining: z.array(provenanced(z.string().min(1).max(400))).max(20).optional() })
    .refine((e) => e.heading !== undefined || e.remaining !== undefined,
      { message: 'bearing_updated must change at least one field' }),
  z.strictObject({ ...D, event: z.literal('bearing_arrived'), bearing_id: zSlug,
    note: z.string().max(400).optional() }),
  z.strictObject({ ...D, event: z.literal('bearing_abandoned'), bearing_id: zSlug,
    note: z.string().max(400).optional() }),

  // ── 귀환점 (정본 II-D: repository/workspace id는 envelope, 나머지는 payload) ──
  z.strictObject({ ...D, event: z.literal('waypoint'), waypoint_id: zSlug,
    decision_id: zSlug.optional(),
    git_common_dir: z.string().min(1).max(1024),
    sha: zGitSha,
    branch: z.string().max(255).optional(),
    label: z.string().max(200).optional() }),

  // ── 게이트 계측 (Matrix "Capture" 행: 게이트 호출률 측정 존재) ──
  z.strictObject({ ...D, event: z.literal('gate_result'),
    gate: z.string().min(1).max(64),
    fired: z.boolean(),
    reason: z.string().max(400).optional() }),

  // ── sync outbox (정본 규칙 12 — 최소 상태머신; key는 원본 이벤트의 event_id) ──
  z.strictObject({ ...D, event: z.literal('sync_pending'), source_event_id: zUlid }),
  z.strictObject({ ...D, event: z.literal('sync_attempted'), source_event_id: zUlid,
    attempt: z.number().int().positive(),
    next_retry_at: zIsoDateTime.optional(),
    last_error: z.string().max(400).optional() }),
  z.strictObject({ ...D, event: z.literal('sync_succeeded'), source_event_id: zUlid }),
  z.strictObject({ ...D, event: z.literal('sync_abandoned'), source_event_id: zUlid,
    reason: z.string().max(400) }),
]);

export type ArgusEvent = z.infer<typeof ArgusEventSchema>;
export type ArgusEventName = ArgusEvent['event'];

/** union이 실제로 커버하는 이벤트 이름들 — drift 가드와 exhaustive 테스트가 소비.
 *  zod 4의 refine은 래퍼 없이 같은 오브젝트에 check를 붙이므로 shape 직접 접근이
 *  안전하다 (이 커밋에서 4.4.3으로 실측 확인). */
export const EVENT_NAMES: readonly string[] = ArgusEventSchema.options.map((o) => {
  const lit = (o as z.ZodObject<Record<string, z.ZodType>>).shape['event'] as z.ZodLiteral<string>;
  return lit.value;
});
