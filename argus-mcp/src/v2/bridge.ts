/**
 * 툴 브리지 — MCP 툴이 v2 원장에 쓰는 유일한 관문.
 *
 * 툴 핸들러는 이벤트를 손으로 조립하지 않는다: 여기의 동사(sealV2/settleV2/…)를
 * 부른다. envelope(ULID·repository/workspace id·logical_date·tz·idempotency
 * key)은 전부 이 파일이 채우므로, 툴마다 envelope 조립이 흩어져 드리프트할
 * 방법이 없다 (프롬프트의 single-source 원칙과 같은 사상 — 배선은 한 곳에).
 *
 * 바인딩 (정본 II-D):
 *  - repository_id는 registry(git_common_dir 실경로 → UUID)에서만 온다.
 *    매핑이 없으면 INIT_REQUIRED 명시 거절 — 자동 생성 금지, init이 동사다.
 *  - workspace_id는 worktree의 `.argus/project.json`에 산다 (없으면 생성).
 *    worktree `.argus`에는 projection과 바인딩만 — 원장은 절대 여기 안 산다.
 *
 * 멱등 key (정본 II-E):
 *  - 호출자가 key를 주면 `${tool}:${key}`로 네임스페이스해 쓴다 (재시도 멱등).
 *  - 생략하면 server가 유일 key를 만들어 준다 — 이때 재시도 멱등성은 보장되지
 *    않는다 (II-E 문서화 조항 그대로: 같은 호출을 다시 하면 새 이벤트다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { lookupRepository } from './ledger.js';
import { appendEventGuarded, type IdempotentAppendResult } from './reducer.js';
import type { Provenance } from './events.js';

// ── ULID (의존성 0 — Crockford base32, 48bit time + 80bit random) ──

const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(now: number = Date.now()): string {
  let ts = now;
  let t = '';
  for (let i = 0; i < 10; i++) {
    t = CROCK[ts % 32] + t;
    ts = Math.floor(ts / 32);
  }
  const rnd = randomBytes(16);
  let r = '';
  for (let i = 0; i < 16; i++) r += CROCK[rnd[i] % 32];
  return t + r;
  // 주의: 같은 밀리초 안의 단조성은 구현하지 않았다 — 정본 순서는 어차피
  // JSONL append 순서이고(II-E), ULID는 유일성만 책임진다.
}

// ── workspace 바인딩 (worktree .argus/project.json) ───────

interface WorkspaceBinding {
  repository_id: string;
  workspace_id: string;
}

/** worktree의 .argus에서 바인딩을 읽거나 만든다. repository_id가 이미 다른
 *  값으로 묶여 있으면 명시 거절 — 조용한 재바인딩은 원장을 가른다. */
export function workspaceBinding(workspaceArgusDir: string, repositoryId: string): WorkspaceBinding {
  const file = path.join(workspaceArgusDir, 'project.json');
  try {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8')) as WorkspaceBinding;
    if (existing.repository_id !== repositoryId) {
      throw new Error(
        `WORKSPACE_REBIND: ${file} is bound to repository ${existing.repository_id}, not ${repositoryId} — ` +
        `remove the stale binding explicitly if this worktree really moved repos`,
      );
    }
    if (typeof existing.workspace_id === 'string' && existing.workspace_id) return existing;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('WORKSPACE_REBIND')) throw e;
    // 부재·파손 → 새로 만든다 (바인딩은 projection급 — 원장이 아니라 재생성 가능)
  }
  const fresh: WorkspaceBinding = { repository_id: repositoryId, workspace_id: randomUUID() };
  fs.mkdirSync(workspaceArgusDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(fresh, null, 2) + '\n', 'utf8');
  return fresh;
}

// ── 컨텍스트 ──────────────────────────────────────────────

export interface V2Context {
  home: string;
  repository_id: string;
  workspace_id: string;
  session_id: string;
  producer_version: string;
  tz: string;
  /** logical_date — 호출 측 resolveToday 결과를 받는다 (테스트 override 포함). */
  today: string;
}

export class InitRequiredError extends Error {
  readonly code = 'INIT_REQUIRED';
  constructor(gitCommonDir: string) {
    super(
      `INIT_REQUIRED: ${gitCommonDir} is not bound to a repository_id yet — run argus_init once in this ` +
      `repository to create the durable ledger home (~/.argus/projects/…). Nothing was written.`,
    );
  }
}

export function contextFor(args: {
  home: string;
  gitCommonDir: string;
  workspaceArgusDir: string;
  sessionId: string;
  producerVersion: string;
  today: string;
  tz?: string;
}): V2Context {
  const repositoryId = lookupRepository(args.home, args.gitCommonDir);
  if (!repositoryId) throw new InitRequiredError(args.gitCommonDir); // 자동 생성 금지 (II-D)
  const binding = workspaceBinding(args.workspaceArgusDir, repositoryId);
  return {
    home: args.home,
    repository_id: repositoryId,
    workspace_id: binding.workspace_id,
    session_id: args.sessionId,
    producer_version: args.producerVersion,
    tz: args.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    today: args.today,
  };
}

// ── envelope + append ─────────────────────────────────────

export type Provenanced = { value: string; provenance: Provenance };

function envelope(ctx: V2Context, tool: string, callerKey: string | undefined) {
  return {
    event_id: ulid(),
    v: 2 as const,
    producer_version: ctx.producer_version,
    repository_id: ctx.repository_id,
    workspace_id: ctx.workspace_id,
    session_id: ctx.session_id,
    occurred_at: new Date().toISOString(),
    logical_date: ctx.today,
    tz: ctx.tz,
    // caller key = 재시도 멱등. server key = 유일하되 멱등 아님 (헤더 참조).
    idempotency_key: callerKey ? `${tool}:${callerKey}` : `${tool}:auto:${ulid()}`,
  };
}

function append(ctx: V2Context, event: Record<string, unknown>): IdempotentAppendResult {
  return appendEventGuarded(ctx.home, ctx.repository_id, event);
}

// ── 동사 (툴이 부르는 전부) ────────────────────────────────

export function harvestV2(ctx: V2Context, a: {
  decisionId: string; text: Provenanced; idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, { ...envelope(ctx, 'harvest', a.idempotencyKey), event: 'harvest', decision_id: a.decisionId, text: a.text });
}

export function sealV2(ctx: V2Context, a: {
  decisionId: string;
  predicate: Provenanced;
  checkBy: Provenanced;
  basis?: 'judgment' | 'luck' | 'mixed' | 'unsure';
  realQuestion?: string;
  unverifiedAssumption?: string;
  humanOnly?: string;
  humanJudgment?: Provenanced;
  idempotencyKey?: string;
}): IdempotentAppendResult {
  // seal은 self-create — 사전 harvest 불요 (reducer의 seal-on-absent 경로).
  return append(ctx, {
    ...envelope(ctx, 'seal', a.idempotencyKey), event: 'seal', decision_id: a.decisionId,
    predicate: a.predicate, check_by: a.checkBy,
    ...(a.basis ? { basis: a.basis } : {}),
    ...(a.realQuestion ? { real_question: a.realQuestion } : {}),
    ...(a.unverifiedAssumption ? { unverified_assumption: a.unverifiedAssumption } : {}),
    ...(a.humanOnly ? { human_only: a.humanOnly } : {}),
    ...(a.humanJudgment ? { human_judgment: a.humanJudgment } : {}),
  });
}

export function settleV2(ctx: V2Context, a: {
  decisionId: string;
  outcome: { value: 'held' | 'avoided' | 'partial' | 'still_pending' | 'missed'; provenance: Provenance };
  note?: string;
  idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'settle', a.idempotencyKey), event: 'settle', decision_id: a.decisionId,
    outcome: a.outcome, ...(a.note ? { note: a.note } : {}),
  });
}

export function amendV2(ctx: V2Context, a: {
  decisionId: string; predicate?: Provenanced; checkBy?: Provenanced; idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'amend', a.idempotencyKey), event: 'amend', decision_id: a.decisionId,
    ...(a.predicate ? { predicate: a.predicate } : {}),
    ...(a.checkBy ? { check_by: a.checkBy } : {}),
  });
}

export function dismissV2(ctx: V2Context, a: {
  decisionId: string; reason?: string; idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'dismiss', a.idempotencyKey), event: 'dismiss', decision_id: a.decisionId,
    ...(a.reason ? { reason: a.reason } : {}),
  });
}

export function snoozeV2(ctx: V2Context, a: {
  decisionId: string; until: string; idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, { ...envelope(ctx, 'snooze', a.idempotencyKey), event: 'snooze', decision_id: a.decisionId, until: a.until });
}

export function premiseAddV2(ctx: V2Context, a: {
  premiseId: string; decisionId?: string; kind: 'premise' | 'fact' | 'question';
  text: Provenanced; loadBearing?: boolean; recheckCadenceDays?: number;
  fromCandidate?: string; idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'premise_add', a.idempotencyKey), event: 'premise_add',
    premise_id: a.premiseId, kind: a.kind, text: a.text,
    ...(a.decisionId ? { decision_id: a.decisionId } : {}),
    ...(a.loadBearing !== undefined ? { load_bearing: a.loadBearing } : {}),
    ...(a.recheckCadenceDays !== undefined ? { recheck_cadence_days: a.recheckCadenceDays } : {}),
    ...(a.fromCandidate ? { from_candidate: a.fromCandidate } : {}),
  });
}

export function premiseAmendV2(ctx: V2Context, a: {
  premiseId: string; text?: Provenanced; recheckCadenceDays?: number; idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'premise_amend', a.idempotencyKey), event: 'premise_amend', premise_id: a.premiseId,
    ...(a.text ? { text: a.text } : {}),
    ...(a.recheckCadenceDays !== undefined ? { recheck_cadence_days: a.recheckCadenceDays } : {}),
  });
}

export function premiseRecheckV2(ctx: V2Context, a: {
  premiseId: string; result: 'holds' | 'drifted' | 'broken' | 'unknown'; note?: string; idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'premise_recheck', a.idempotencyKey), event: 'premise_recheck', premise_id: a.premiseId,
    result: a.result, ...(a.note ? { note: a.note.slice(0, 400) } : {}),
  });
}

export function premiseResolveV2(ctx: V2Context, a: {
  premiseId: string; resolution: Provenanced; idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'premise_resolve', a.idempotencyKey), event: 'premise_resolve', premise_id: a.premiseId,
    resolution: a.resolution,
  });
}

export function candidateCreatedV2(ctx: V2Context, a: {
  candidateId: string; kind: 'claim' | 'premise' | 'question' | 'decision'; quote: string;
  quoteSpeaker: 'user' | 'assistant' | 'unknown';
  source: 'harvest_sweep' | 'debrief' | 'user'; idempotencyKey?: string;
}): IdempotentAppendResult {
  // 미러/수동 경로는 byte 검증이 불가능하므로 host_reported 등급 고정 —
  // byte_verified는 증거 포인터가 있는 수확 경로(P3)만 쓸 수 있다.
  return append(ctx, {
    ...envelope(ctx, 'candidate_created', a.idempotencyKey), event: 'candidate_created',
    candidate_id: a.candidateId, kind: a.kind, quote: a.quote.slice(0, 2000),
    quote_speaker: a.quoteSpeaker, verification: 'host_reported', source: a.source,
  });
}

export function gateResultV2(ctx: V2Context, a: {
  gate: string; fired: boolean; reason?: string;
}): IdempotentAppendResult {
  // 게이트 계측은 caller key가 의미 없다 — 매 판정이 별개 사건.
  return append(ctx, { ...envelope(ctx, 'gate_result', undefined), event: 'gate_result', gate: a.gate, fired: a.fired, ...(a.reason ? { reason: a.reason } : {}) });
}

// ── sync outbox 동사 4종 (정본 규칙 12) — key는 원본 이벤트의 event_id ──

export function syncPendingV2(ctx: V2Context, a: {
  sourceEventId: string;
  /** abandoned 후 수동 재개는 **별개 사건**이므로 새 키를 넘겨야 한다
   *  (기본 키 그대로면 첫 pending과 같은 사건으로 접혀 duplicate가 된다 —
   *  outbox.test의 수동 재개 케이스가 이 함정을 고정). */
  idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'sync_pending', a.idempotencyKey ?? `sync-pending-${a.sourceEventId}`),
    event: 'sync_pending', source_event_id: a.sourceEventId,
  });
}

export function syncAttemptedV2(ctx: V2Context, a: {
  sourceEventId: string; attempt: number; nextRetryAt?: string; lastError?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'sync_attempted', `sync-attempt-${a.sourceEventId}-${a.attempt}`),
    event: 'sync_attempted', source_event_id: a.sourceEventId, attempt: a.attempt,
    ...(a.nextRetryAt ? { next_retry_at: a.nextRetryAt } : {}),
    ...(a.lastError ? { last_error: a.lastError.slice(0, 400) } : {}),
  });
}

export function syncSucceededV2(ctx: V2Context, a: { sourceEventId: string }): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'sync_succeeded', `sync-done-${a.sourceEventId}`),
    event: 'sync_succeeded', source_event_id: a.sourceEventId,
  });
}

export function syncAbandonedV2(ctx: V2Context, a: { sourceEventId: string; reason: string }): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'sync_abandoned', `sync-abandon-${a.sourceEventId}`),
    event: 'sync_abandoned', source_event_id: a.sourceEventId, reason: a.reason.slice(0, 400),
  });
}

/** 수확 경로 전용 후보 생성 — byte_verified + 증거 포인터 강제 (II-C).
 *  evidence는 evidence.ts에서만 발행되므로 등급 사칭이 구조적으로 불가능하다.
 *  (미러/수동 경로는 candidateCreatedV2 — host_reported 고정.) */
export function harvestCandidateV2(ctx: V2Context, a: {
  candidateId: string; kind: 'claim' | 'premise' | 'question' | 'decision';
  quote: string; quoteSpeaker: 'user' | 'assistant';
  evidence: Record<string, unknown>; idempotencyKey?: string;
}): IdempotentAppendResult {
  return append(ctx, {
    ...envelope(ctx, 'candidate_created', a.idempotencyKey), event: 'candidate_created',
    candidate_id: a.candidateId, kind: a.kind, quote: a.quote.slice(0, 2000),
    quote_speaker: a.quoteSpeaker, verification: 'byte_verified',
    evidence: a.evidence, source: 'harvest_sweep',
  });
}

// ── 후보 표면·행동 동사 (II-A candidate 축 — created ≠ surfaced는 별개 사건) ──

export function candidateSurfacedV2(ctx: V2Context, a: {
  candidateId: string; surface: 'brief' | 'check_in' | 'debrief' | 'logbook';
}): IdempotentAppendResult {
  // 노출 기록은 매 노출이 별개 사건 — caller key 불요.
  return append(ctx, {
    ...envelope(ctx, 'candidate_surfaced', undefined), event: 'candidate_surfaced',
    candidate_id: a.candidateId, surface: a.surface,
  });
}

export function candidateActionV2(ctx: V2Context, a: {
  candidateId: string;
  action: 'promote' | 'drop' | 'snooze';
  snoozeUntil?: string;
  promotedTo?: { kind: 'decision' | 'premise'; id: string };
  idempotencyKey?: string;
}): IdempotentAppendResult {
  // zod refine이 promote↔promoted_to, snooze↔snooze_until 결합을 강제한다 —
  // 여기서 재검사하지 않는다 (검증 두뇌는 스키마 하나).
  return append(ctx, {
    ...envelope(ctx, 'candidate_action', a.idempotencyKey), event: 'candidate_action',
    candidate_id: a.candidateId, action: a.action,
    ...(a.snoozeUntil ? { snooze_until: a.snoozeUntil } : {}),
    ...(a.promotedTo ? { promoted_to: a.promotedTo } : {}),
  });
}
