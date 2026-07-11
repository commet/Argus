/**
 * v2 reducer — 원장(사실의 나열)을 상태로 접고, 다음 이벤트의 합법성을 판정한다.
 *
 * 두 얼굴이 한 파일에 사는 이유: 전이 규칙은 한 곳에만 존재해야 한다.
 *  - reduce():   과거를 접는다. **총함수** — 과거는 이미 일어난 사실이므로 절대
 *                던지지 않는다. 말이 안 되는 이벤트(가드 없이 append된 시절의
 *                흔적·버그)는 조용히 삼키지 않고 anomalies[]에 계상한다.
 *  - transitionGuard(): 미래를 막는다. append 전에 락 안에서 실행되어(ledger.ts
 *                의 lock→replay→guard 순서) 불법 전이를 **코드 있는 에러**로
 *                거절한다 — ALREADY_SETTLED 류 (정본 II-A: "terminal 상태 이후
 *                재호출은 명시 오류").
 *
 * 상태 전이 정본 (II-A):
 *  - decision:  absent → harvested → sealed → settled | dismissed
 *  - candidate: created → surfaced → promoted | dropped | snoozed(→surfaced)
 *               (expired는 이벤트가 아니라 읽기 시 logical_date로 파생 — 14일)
 *  - bearing:   set → updated* → arrived | abandoned (terminal 후 재-set은 새 id)
 *  - sync:      pending → attempted* → succeeded | abandoned(수동 재개 = 새 pending 허용)
 *
 * 멱등 (II-E 정밀 계약):
 *  - uniqueness scope는 repository_id + tool_name + idempotency_key. envelope에는
 *    key만 있으므로 **툴 계층이 key를 `${tool_name}:${...}`로 네임스페이스**하는
 *    것이 규약이다 (이 파일은 key 문자열 전체로만 판정한다).
 *  - 동일 key + 동일 payload hash → 중복 재시도: append 없이 기존 이벤트 반환.
 *  - 동일 key + 다른 payload hash → IDEMPOTENCY_CONFLICT 명시 거절.
 *  - payload hash는 event_id·occurred_at을 제외하고 계산한다 — 재시도는 그 둘을
 *    새로 만들 수밖에 없기 때문이다.
 */
import { createHash } from 'node:crypto';
import type { ArgusEvent } from './events.js';
import { appendEvent, readLedger, type LedgerReadResult } from './ledger.js';
import { foldV1, readV1File, v1LedgerPath, type V1Extras } from './v1-reader.js';

// ── 상태 모형 ─────────────────────────────────────────────

export interface DecisionRecord {
  id: string;
  state: 'harvested' | 'sealed' | 'settled' | 'dismissed';
  text?: { value: string; provenance: string };
  predicate?: { value: string; provenance: string };
  check_by?: { value: string; provenance: string };
  outcome?: { value: string; provenance: string };
  snoozed_until?: string;
  snooze_count: number;
}

export interface PremiseRecord {
  id: string;
  decision_id?: string;
  kind: 'premise' | 'fact' | 'question';
  text: { value: string; provenance: string };
  load_bearing: boolean;
  recheck_cadence_days?: number;
  last_recheck?: { on: string; result: string };
  resolved: boolean;
}

export interface CandidateRecord {
  id: string;
  state: 'created' | 'surfaced' | 'promoted' | 'dropped' | 'snoozed';
  kind: string;
  created_on: string; // logical_date — expired(14일) 파생의 기준
  snooze_until?: string;
  promoted_to?: { kind: 'decision' | 'premise'; id: string };
}

export interface BearingRecord {
  id: string;
  state: 'active' | 'arrived' | 'abandoned';
  heading: { value: string; provenance: string };
  remaining: { value: string; provenance: string }[];
}

export interface SyncRecord {
  source_event_id: string;
  state: 'pending' | 'attempted' | 'succeeded' | 'abandoned';
  attempts: number;
  next_retry_at?: string;
  last_error?: string;
}

export interface LedgerState {
  decisions: Map<string, DecisionRecord>;
  premises: Map<string, PremiseRecord>;
  candidates: Map<string, CandidateRecord>;
  bearings: Map<string, BearingRecord>;
  sync: Map<string, SyncRecord>;
  /** idempotency_key → payload hash + 원본 이벤트 (멱등 판정용). */
  idempotency: Map<string, { payload_hash: string; event: ArgusEvent }>;
  /** reduce가 삼키지 않고 계상한 과거의 불법 전이 (LLM-glue: 조용한 skip 금지). */
  anomalies: { event_id: string; code: string }[];
}

export function emptyState(): LedgerState {
  return {
    decisions: new Map(), premises: new Map(), candidates: new Map(),
    bearings: new Map(), sync: new Map(), idempotency: new Map(), anomalies: [],
  };
}

// ── 멱등: payload hash ────────────────────────────────────

/** event_id·occurred_at 제외, 키 정렬 canonical JSON의 sha256. */
export function payloadHash(event: ArgusEvent): string {
  const { event_id: _id, occurred_at: _at, ...rest } = event as Record<string, unknown>;
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, val]) => [k, canonical(val)]));
    }
    return v;
  };
  return createHash('sha256').update(JSON.stringify(canonical(rest))).digest('hex');
}

// ── 전이 판정 (미래를 막는 얼굴) ──────────────────────────

export class TransitionError extends Error {
  constructor(readonly code: string, detail: string) {
    super(`${code}: ${detail}`);
  }
}

/** 다음 이벤트가 현 상태에서 합법인지 판정. 불법이면 TransitionError.
 *  합법인데 멱등 중복(동일 key+동일 payload)이면 'duplicate'를 반환 —
 *  호출자는 append를 건너뛰고 기존 이벤트를 재구성해 반환한다. */
export function judgeTransition(state: LedgerState, e: ArgusEvent): 'fresh' | 'duplicate' {
  const seen = state.idempotency.get(e.idempotency_key);
  if (seen) {
    if (seen.payload_hash === payloadHash(e)) return 'duplicate';
    throw new TransitionError('IDEMPOTENCY_CONFLICT',
      `key "${e.idempotency_key}" was already used with a different payload — pick a new key or retry the identical call`);
  }

  const need = <T>(map: Map<string, T>, id: string, what: string): T => {
    const rec = map.get(id);
    if (!rec) throw new TransitionError(`UNKNOWN_${what.toUpperCase()}`, `${what} "${id}" does not exist in this ledger`);
    return rec;
  };

  switch (e.event) {
    case 'harvest': {
      if (state.decisions.has(e.decision_id))
        throw new TransitionError('DECISION_EXISTS', `decision "${e.decision_id}" already exists`);
      return 'fresh';
    }
    case 'seal': {
      const d = state.decisions.get(e.decision_id);
      if (!d) return 'fresh'; // 툴 계층이 harvest를 같이 append하는 self-create 경로
      if (d.state === 'sealed') throw new TransitionError('ALREADY_SEALED', `decision "${d.id}" is already sealed`);
      if (d.state === 'settled') throw new TransitionError('ALREADY_SETTLED', `decision "${d.id}" is settled — a settled bet never reopens`);
      if (d.state === 'dismissed') throw new TransitionError('ALREADY_DISMISSED', `decision "${d.id}" was dismissed`);
      return 'fresh';
    }
    case 'amend':
    case 'snooze': {
      const d = need(state.decisions, e.decision_id, 'decision');
      if (d.state === 'settled') throw new TransitionError('ALREADY_SETTLED', `decision "${d.id}" is settled`);
      if (d.state === 'dismissed') throw new TransitionError('ALREADY_DISMISSED', `decision "${d.id}" was dismissed`);
      if (d.state !== 'sealed') throw new TransitionError('NOT_SEALED', `decision "${d.id}" is not sealed yet`);
      return 'fresh';
    }
    case 'settle': {
      const d = need(state.decisions, e.decision_id, 'decision');
      if (d.state === 'settled') throw new TransitionError('ALREADY_SETTLED', `decision "${d.id}" is already settled`);
      if (d.state === 'dismissed') throw new TransitionError('ALREADY_DISMISSED', `decision "${d.id}" was dismissed`);
      if (d.state !== 'sealed') throw new TransitionError('NOT_SEALED', `decision "${d.id}" has no sealed predicate to settle against`);
      return 'fresh';
    }
    case 'dismiss': {
      const d = need(state.decisions, e.decision_id, 'decision');
      if (d.state === 'settled') throw new TransitionError('ALREADY_SETTLED', `decision "${d.id}" is settled`);
      if (d.state === 'dismissed') throw new TransitionError('ALREADY_DISMISSED', `decision "${d.id}" was already dismissed`);
      return 'fresh';
    }

    case 'premise_add': {
      if (state.premises.has(e.premise_id))
        throw new TransitionError('PREMISE_EXISTS', `premise "${e.premise_id}" already exists`);
      return 'fresh';
    }
    case 'premise_amend':
    case 'premise_recheck': {
      const p = need(state.premises, e.premise_id, 'premise');
      if (p.resolved) throw new TransitionError('ALREADY_RESOLVED', `premise "${p.id}" is resolved`);
      return 'fresh';
    }
    case 'premise_resolve': {
      const p = need(state.premises, e.premise_id, 'premise');
      if (p.resolved) throw new TransitionError('ALREADY_RESOLVED', `premise "${p.id}" was already resolved`);
      return 'fresh';
    }

    case 'candidate_created': {
      if (state.candidates.has(e.candidate_id))
        throw new TransitionError('CANDIDATE_EXISTS', `candidate "${e.candidate_id}" already exists`);
      return 'fresh';
    }
    case 'candidate_surfaced': {
      const c = need(state.candidates, e.candidate_id, 'candidate');
      if (c.state === 'promoted' || c.state === 'dropped')
        throw new TransitionError('CANDIDATE_TERMINAL', `candidate "${c.id}" is ${c.state}`);
      return 'fresh';
    }
    case 'candidate_action': {
      const c = need(state.candidates, e.candidate_id, 'candidate');
      if (c.state === 'promoted' || c.state === 'dropped')
        throw new TransitionError('CANDIDATE_TERMINAL', `candidate "${c.id}" is ${c.state}`);
      return 'fresh';
    }

    case 'bearing_set': {
      const b = state.bearings.get(e.bearing_id);
      if (b && b.state === 'active')
        throw new TransitionError('BEARING_EXISTS', `bearing "${b.id}" is still active — terminal 후 재-set은 새 bearing id로`);
      if (b) // terminal 재사용도 금지 — 항적이 섞인다
        throw new TransitionError('BEARING_TERMINAL', `bearing id "${b.id}" was used and closed — pick a new id`);
      return 'fresh';
    }
    case 'bearing_updated':
    case 'bearing_arrived':
    case 'bearing_abandoned': {
      const b = need(state.bearings, e.bearing_id, 'bearing');
      if (b.state !== 'active')
        throw new TransitionError('BEARING_TERMINAL', `bearing "${b.id}" is ${b.state}`);
      return 'fresh';
    }

    case 'waypoint':
    case 'gate_result':
      return 'fresh'; // 상태 제약 없음 — 기록 자체가 목적

    case 'sync_pending': {
      const s = state.sync.get(e.source_event_id);
      // abandoned 후 수동 재개(새 pending)는 허용 — 규칙 12.
      if (s && s.state !== 'abandoned')
        throw new TransitionError('SYNC_EXISTS', `sync for ${e.source_event_id} is ${s.state}`);
      return 'fresh';
    }
    case 'sync_attempted': {
      const s = need(state.sync, e.source_event_id, 'sync');
      if (s.state === 'succeeded' || s.state === 'abandoned')
        throw new TransitionError('SYNC_TERMINAL', `sync for ${e.source_event_id} is ${s.state}`);
      return 'fresh';
    }
    case 'sync_succeeded':
    case 'sync_abandoned': {
      const s = need(state.sync, e.source_event_id, 'sync');
      if (s.state === 'succeeded' || s.state === 'abandoned')
        throw new TransitionError('SYNC_TERMINAL', `sync for ${e.source_event_id} is already ${s.state}`);
      return 'fresh';
    }
  }
}

// ── reduce (과거를 접는 얼굴 — 총함수) ─────────────────────

function apply(state: LedgerState, e: ArgusEvent): void {
  switch (e.event) {
    case 'harvest':
      state.decisions.set(e.decision_id, { id: e.decision_id, state: 'harvested', text: e.text, snooze_count: 0 });
      break;
    case 'seal': {
      const d = state.decisions.get(e.decision_id)
        ?? { id: e.decision_id, state: 'harvested' as const, snooze_count: 0 };
      state.decisions.set(e.decision_id, { ...d, state: 'sealed', predicate: e.predicate, check_by: e.check_by });
      break;
    }
    case 'amend': {
      const d = state.decisions.get(e.decision_id);
      if (!d) break;
      if (e.predicate) d.predicate = e.predicate;
      if (e.check_by) d.check_by = e.check_by;
      break;
    }
    case 'dismiss': {
      const d = state.decisions.get(e.decision_id);
      if (d) d.state = 'dismissed';
      break;
    }
    case 'settle': {
      const d = state.decisions.get(e.decision_id);
      if (d) { d.state = 'settled'; d.outcome = e.outcome; }
      break;
    }
    case 'snooze': {
      const d = state.decisions.get(e.decision_id);
      if (d) { d.snoozed_until = e.until; d.snooze_count += 1; }
      break;
    }
    case 'premise_add':
      state.premises.set(e.premise_id, {
        id: e.premise_id, decision_id: e.decision_id, kind: e.kind, text: e.text,
        load_bearing: e.load_bearing ?? false, recheck_cadence_days: e.recheck_cadence_days, resolved: false,
      });
      break;
    case 'premise_amend': {
      const p = state.premises.get(e.premise_id);
      if (!p) break;
      if (e.text) p.text = e.text;
      if (e.recheck_cadence_days !== undefined) p.recheck_cadence_days = e.recheck_cadence_days;
      break;
    }
    case 'premise_recheck': {
      const p = state.premises.get(e.premise_id);
      if (p) p.last_recheck = { on: e.logical_date, result: e.result };
      break;
    }
    case 'premise_resolve': {
      const p = state.premises.get(e.premise_id);
      if (p) p.resolved = true;
      break;
    }
    case 'candidate_created':
      state.candidates.set(e.candidate_id, {
        id: e.candidate_id, state: 'created', kind: e.kind, created_on: e.logical_date,
      });
      break;
    case 'candidate_surfaced': {
      const c = state.candidates.get(e.candidate_id);
      if (c) c.state = 'surfaced';
      break;
    }
    case 'candidate_action': {
      const c = state.candidates.get(e.candidate_id);
      if (!c) break;
      if (e.action === 'promote') { c.state = 'promoted'; c.promoted_to = e.promoted_to; }
      else if (e.action === 'drop') c.state = 'dropped';
      else { c.state = 'snoozed'; c.snooze_until = e.snooze_until; }
      break;
    }
    case 'bearing_set':
      state.bearings.set(e.bearing_id, { id: e.bearing_id, state: 'active', heading: e.heading, remaining: e.remaining });
      break;
    case 'bearing_updated': {
      const b = state.bearings.get(e.bearing_id);
      if (!b) break;
      if (e.heading) b.heading = e.heading;
      if (e.remaining) b.remaining = e.remaining;
      break;
    }
    case 'bearing_arrived': {
      const b = state.bearings.get(e.bearing_id);
      if (b) b.state = 'arrived';
      break;
    }
    case 'bearing_abandoned': {
      const b = state.bearings.get(e.bearing_id);
      if (b) b.state = 'abandoned';
      break;
    }
    case 'waypoint':
    case 'gate_result':
      break; // 상태에 접히지 않는 순수 기록 — projection이 원장에서 직접 읽는다
    case 'sync_pending':
      state.sync.set(e.source_event_id, { source_event_id: e.source_event_id, state: 'pending', attempts: 0 });
      break;
    case 'sync_attempted': {
      const s = state.sync.get(e.source_event_id);
      if (s) { s.state = 'attempted'; s.attempts = e.attempt; s.next_retry_at = e.next_retry_at; s.last_error = e.last_error; }
      break;
    }
    case 'sync_succeeded': {
      const s = state.sync.get(e.source_event_id);
      if (s) s.state = 'succeeded';
      break;
    }
    case 'sync_abandoned': {
      const s = state.sync.get(e.source_event_id);
      if (s) { s.state = 'abandoned'; s.last_error = e.reason; }
      break;
    }
  }
  state.idempotency.set(e.idempotency_key, { payload_hash: payloadHash(e), event: e });
}

/** 총함수 fold: 과거의 불법 전이는 던지지 않고 anomalies에 계상 후 그 이벤트만
 *  건너뛴다 (가드가 항상 돌았다면 anomalies는 영원히 빈 배열이다 — 비어있지
 *  않다는 것 자체가 조사 신호다). */
export function reduce(events: ArgusEvent[]): LedgerState {
  return reduceInto(emptyState(), events);
}

/** 기존 상태 위에 이어 접기 — v1 fold(v1-reader.ts) 결과 위에 v2 이벤트를
 *  얹을 때 쓴다 (시간상 v1 전량 → v2 전량 순서가 실제 이전 시나리오다). */
export function reduceInto(state: LedgerState, events: ArgusEvent[]): LedgerState {
  for (const e of events) {
    try {
      const verdict = judgeTransition(state, e);
      if (verdict === 'duplicate') continue; // 과거의 중복 재시도 — 상태 영향 0
      apply(state, e);
    } catch (err) {
      state.anomalies.push({
        event_id: e.event_id,
        code: err instanceof TransitionError ? err.code : 'UNEXPECTED',
      });
    }
  }
  return state;
}

// ── 원장 결합: 멱등 append ─────────────────────────────────

export interface IdempotentAppendResult {
  /** false = 동일 key·동일 payload의 재시도 — 기존 이벤트를 재구성해 반환했다.
   *  (II-E: 원 surface 문구 보존은 약속하지 않는다 — 도메인 결과만.) */
  appended: boolean;
  event: ArgusEvent;
}

/** lock → replay → (멱등 + 전이) guard → append/fsync → unlock 를 한 동작으로.
 *  reduce와 judgeTransition이 같은 파일의 같은 규칙을 쓰므로 판정이 갈릴 수 없다. */
export function appendEventGuarded(home: string, repositoryId: string, event: unknown): IdempotentAppendResult {
  let duplicateOf: ArgusEvent | null = null;
  try {
    const appendedEvent = appendEvent(home, repositoryId, event, (prior: LedgerReadResult, next: ArgusEvent) => {
      // v1에서 봉인된 결정을 v2에서 정산할 수 있어야 한다 — 가드가 v1 상태를
      // 못 보면 UNKNOWN_DECISION으로 이전 사용자의 연속성이 끊긴다.
      const state = emptyState();
      foldV1(state, readV1File(v1LedgerPath(home, repositoryId)).events);
      reduceInto(state, prior.events);
      const verdict = judgeTransition(state, next);
      if (verdict === 'duplicate') {
        duplicateOf = state.idempotency.get(next.idempotency_key)!.event;
        throw new TransitionError('__DUPLICATE__', 'internal short-circuit — not an error');
      }
    });
    return { appended: true, event: appendedEvent };
  } catch (err) {
    if (err instanceof TransitionError && err.code === '__DUPLICATE__' && duplicateOf) {
      return { appended: false, event: duplicateOf };
    }
    throw err;
  }
}

/** 편의: 현 원장의 상태 (projection·툴이 소비). 이전된 v1 원장
 *  (ledger.v1.jsonl)이 있으면 먼저 접고 그 위에 v2를 얹는다 — 과거 이벤트는
 *  영원히 읽힌다 (II-E). 카운터는 두 파일 합산. */
export function loadState(home: string, repositoryId: string): LedgerState & {
  v1_extras: V1Extras; skipped_unknown: number; dropped_corrupt: number;
} {
  const v1 = readV1File(v1LedgerPath(home, repositoryId));
  const state = emptyState();
  const v1_extras = foldV1(state, v1.events);
  const read = readLedger(home, repositoryId);
  reduceInto(state, read.events);
  return {
    ...state, v1_extras,
    skipped_unknown: read.skipped_unknown + v1.skipped_unknown,
    dropped_corrupt: read.dropped_corrupt + v1.dropped_corrupt,
  };
}
