/**
 * sync outbox 처리기 (P4-1) — 정본 규칙 12의 실행부.
 *
 * > "account sync는 최소 outbox 상태머신: sync_pending → sync_attempted →
 * >  sync_succeeded | sync_abandoned, 각 상태에 event_id·attempts·
 * >  next_retry_at·last_error. 원격 API는 event_id를 idempotency key로 수용
 * >  (범용 큐 프레임워크 금지)."
 *
 * 구조:
 *  - 상태의 정본은 **원장**이다 — outbox는 별도 파일이 아니라 sync_* 이벤트의
 *    fold(reducer.SyncRecord)다. 이 모듈은 그 fold를 읽고, 시도하고, 결과를
 *    다시 이벤트로 쓴다. 큐 파일 이중화 없음 (수확 큐와 다른 점: 그쪽은
 *    임시 상태, 이쪽은 사용자 자산의 전송 상태라 원장이 맞다).
 *  - transport는 주입이다: (sourceEventId) => Promise<void> — 성공은 정상
 *    반환, 실패는 throw. 원격 API가 event_id를 멱등 키로 받으므로 재시도가
 *    중복 반영될 수 없다 (그 계약은 서버 쪽 몫 — 여기서는 주입 경계에 명시).
 *  - backoff: BASE_RETRY_MS * 2^(attempt-1). MAX_SYNC_ATTEMPTS 도달 시
 *    sync_abandoned — 가드가 abandoned 후 새 sync_pending(수동 재개)을
 *    허용하므로 포기는 끝이 아니라 손잡이다.
 *  - 시간은 호출자 주입(nowIso) — 시계 없는 결정론 테스트.
 */
import type { SyncRecord } from './reducer.js';
import { syncAbandonedV2, syncAttemptedV2, syncSucceededV2, type V2Context } from './bridge.js';

export const MAX_SYNC_ATTEMPTS = 5;
export const BASE_RETRY_MS = 60 * 60 * 1000; // 1시간 — 2^n 지수 백오프의 밑

export type SyncTransport = (sourceEventId: string) => Promise<void>;

/** 지금 시도할 차례인 레코드 — pending 전부 + next_retry_at이 지난 attempted. */
export function dueForAttempt(records: Iterable<SyncRecord>, nowIso: string): SyncRecord[] {
  const due: SyncRecord[] = [];
  for (const r of records) {
    if (r.state === 'pending') due.push(r);
    else if (r.state === 'attempted' && (r.next_retry_at === undefined || r.next_retry_at <= nowIso)) due.push(r);
  }
  return due;
}

export function nextRetryAt(nowIso: string, attempt: number): string {
  return new Date(Date.parse(nowIso) + BASE_RETRY_MS * 2 ** (attempt - 1)).toISOString();
}

export interface OutboxResult {
  attempted: number;
  succeeded: string[];
  failed: string[];    // 재시도 예약됨 (next_retry_at)
  abandoned: string[]; // MAX 도달 — 수동 재개 대상
}

/** due 레코드를 순서대로 시도하고 결과를 원장에 기록한다. 절대 던지지 않는다
 *  — transport 실패는 이 함수의 실패가 아니라 기록할 사건이다. */
export async function processOutbox(
  ctx: V2Context,
  records: Iterable<SyncRecord>,
  transport: SyncTransport,
  nowIso: string,
): Promise<OutboxResult> {
  const result: OutboxResult = { attempted: 0, succeeded: [], failed: [], abandoned: [] };
  for (const r of dueForAttempt(records, nowIso)) {
    const attempt = r.attempts + 1;
    result.attempted += 1;
    try {
      await transport(r.source_event_id);
      // 시도 기록 + 종결 — attempt 수가 원장에 남아야 "몇 번 만에 갔는지"가 사실로 남는다.
      syncAttemptedV2(ctx, { sourceEventId: r.source_event_id, attempt });
      syncSucceededV2(ctx, { sourceEventId: r.source_event_id });
      result.succeeded.push(r.source_event_id);
    } catch (err) {
      const lastError = err instanceof Error ? err.message : String(err);
      if (attempt >= MAX_SYNC_ATTEMPTS) {
        syncAttemptedV2(ctx, { sourceEventId: r.source_event_id, attempt, lastError });
        syncAbandonedV2(ctx, {
          sourceEventId: r.source_event_id,
          reason: `gave up after ${attempt} attempts — ${lastError}`,
        });
        result.abandoned.push(r.source_event_id);
      } else {
        syncAttemptedV2(ctx, {
          sourceEventId: r.source_event_id, attempt,
          nextRetryAt: nextRetryAt(nowIso, attempt), lastError,
        });
        result.failed.push(r.source_event_id);
      }
    }
  }
  return result;
}
