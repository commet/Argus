/**
 * 수확 큐 (P3-2) — 정본 규칙 4의 저장층.
 *
 * > "큐 영속화가 유일 경로. SessionStart 훅은 큐 확인·클레임만 하고 즉시
 * > 반환 — 실제 추출은 lease+retry count를 가진 처리 단계에서, 실패 시
 * > 큐 항목 보존, 재시도는 다음 SessionStart 또는 /argus:debrief."
 *
 * 자산 등급 (정본 규칙 3 — 저장 3분할): 이 큐는 `${CLAUDE_PLUGIN_DATA}`에
 * 사는 **임시 상태**다. 플러그인 제거로 삭제돼도 잃는 것은 "아직 추출 안
 * 한 수확 작업"뿐이고, 사용자 자산(원장·후보 이벤트)은 전부 ~/.argus에
 * 있다. 그래서 이 파일에는 발화 원문을 절대 넣지 않는다 — transcript의
 * **경로**만 넣는다 (추출 단계가 그 경로를 읽는다). 경로는 local-only
 * 필드다 (규칙 18 — telemetry/sync 반출 금지).
 *
 * 동시성 모델: 한 저장 디렉토리에 여러 세션이 붙을 수 있으므로 모든 변이는
 * read→modify→tmp+rename 원자 교체이고, 소유권은 lease nonce로 판정한다
 * (v2 원장 락과 같은 사상 — 죽은 보유자의 lease는 만료로 자연 회수).
 * 파일 파손은 빈 큐 + corrupt 플래그로 **정직하게** 읽힌다 — 임시 상태라
 * 데이터 복구를 시도하지 않지만, 파손 사실 자체는 숨기지 않는다.
 *
 * 이 모듈은 저장·상태 전이만 안다. "하루 1회·주 2건 캡·추출기·opt-in"
 * (창업자 확정값)은 처리 단계(추출기)의 정책이지 큐의 정책이 아니다 —
 * 큐에 정책을 심으면 정책 변경마다 저장층이 흔들린다.
 */
import fs from 'node:fs';
import path from 'node:path';

export const MAX_ATTEMPTS = 3;

export type QueueItemStatus =
  | 'pending'
  | 'leased'
  | 'succeeded'
  | 'no_candidate'
  | 'retryable_failed'
  | 'exhausted'
  | 'purged_by_user';

export interface QueueItem {
  /** 중복 인입 방지 키 — 보통 session_id + transcript 경로에서 유도. */
  item_id: string;
  kind: 'harvest';
  /** 추출 대상 transcript의 절대 경로 (원문은 절대 큐에 넣지 않는다). */
  transcript_path: string;
  session_id: string;
  enqueued_at: string;
  attempts: number;
  status: QueueItemStatus;
  /** 처리 단계가 잡은 임대 — 만료 전까지 다른 클레임에서 제외. */
  lease?: { nonce: string; claimed_at: string; expires_at: string };
  /** 마지막 실패 사유 (다음 시도·debrief가 읽는 정직 기록). */
  last_error?: string;
  /** attempts가 MAX_ATTEMPTS에 닿음 — 자동 재시도 대상에서 제외되지만
   *  항목은 보존된다 (조용한 소실 금지; /argus:debrief가 수동 재개 가능). */
  exhausted?: boolean;
  candidate_ids?: string[];
  completed_at?: string;
}

export interface QueueState {
  items: QueueItem[];
  /** 파일이 있었는데 JSON이 아니었다 — 임시 상태라 복구하지 않지만 사실은 보고. */
  was_corrupt: boolean;
}

export function queuePath(dataDir: string): string {
  return path.join(dataDir, 'harvest-queue.json');
}

export function readQueue(dataDir: string): QueueState {
  let raw: string;
  try {
    raw = fs.readFileSync(queuePath(dataDir), 'utf8');
  } catch {
    return { items: [], was_corrupt: false }; // 부재 = 빈 큐 (정상)
  }
  try {
    const parsed = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return { items: [], was_corrupt: true };
    const items = (parsed.items as QueueItem[]).map((item) => ({
      ...item,
      status: item.status ?? (item.exhausted ? 'exhausted' : item.lease ? 'leased' : 'pending'),
    }));
    return { items, was_corrupt: false };
  } catch {
    return { items: [], was_corrupt: true };
  }
}

function writeQueue(dataDir: string, items: QueueItem[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const target = queuePath(dataDir);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ items }, null, 1), 'utf8');
  fs.renameSync(tmp, target);
}

/** 인입 — item_id 멱등 (같은 세션을 두 훅이 겹쳐 넣어도 1건). */
export function enqueue(
  dataDir: string,
  a: { itemId: string; transcriptPath: string; sessionId: string },
  nowIso: string,
): 'enqueued' | 'duplicate' {
  const { items } = readQueue(dataDir);
  if (items.some((i) => i.item_id === a.itemId)) return 'duplicate';
  items.push({
    item_id: a.itemId, kind: 'harvest', transcript_path: a.transcriptPath,
    session_id: a.sessionId, enqueued_at: nowIso, attempts: 0, status: 'pending',
  });
  writeQueue(dataDir, items);
  return 'enqueued';
}

const leaseActive = (i: QueueItem, nowIso: string): boolean =>
  i.lease !== undefined && i.lease.expires_at > nowIso;

/** 클레임 — 즉시 반환 계약 (SessionStart latency budget): 파일 1회 읽고
 *  첫 클레임 가능 항목에 lease만 찍는다. 추출은 여기서 절대 하지 않는다.
 *  만료된 lease는 자연 회수된다 (죽은 처리자가 항목을 영영 잠그지 못함). */
export function claim(
  dataDir: string,
  nowIso: string,
  leaseMs: number,
  nonce: string,
): QueueItem | null {
  const { items } = readQueue(dataDir);
  const target = items.find(
    (i) => ['pending', 'retryable_failed', 'leased'].includes(i.status)
      && !i.exhausted && !leaseActive(i, nowIso) && i.attempts < MAX_ATTEMPTS,
  );
  if (!target) return null;
  target.lease = {
    nonce,
    claimed_at: nowIso,
    expires_at: new Date(Date.parse(nowIso) + leaseMs).toISOString(),
  };
  target.status = 'leased';
  writeQueue(dataDir, items);
  return target;
}

/** 완료 — lease 보유자만. 원문은 애초 큐에 없고, 결과 본문은 원장 하나만
 * 정본으로 둔다. 큐에는 상태·후보 id·완료 시각만 남겨 사용자가 처리 여부를
 * 확인하고 명시적으로 purge할 수 있게 한다. */
export function complete(
  dataDir: string,
  itemId: string,
  nonce: string,
  outcome: { candidateIds?: string[]; noCandidate?: boolean; completedAt?: string } = {},
): boolean {
  const { items } = readQueue(dataDir);
  const item = items.find((i) => i.item_id === itemId && i.lease?.nonce === nonce);
  if (!item) return false; // lease 불일치 = 만료 후 남이 재클레임했다 — 손대지 않는다
  delete item.lease;
  item.status = outcome.noCandidate ? 'no_candidate' : 'succeeded';
  item.candidate_ids = [...(outcome.candidateIds ?? [])];
  item.completed_at = outcome.completedAt ?? new Date().toISOString();
  writeQueue(dataDir, items);
  return true;
}

/** 실패 — 항목 보존 + attempts 증가 + lease 해제 (규칙 4: 실패 시 큐 항목
 *  보존). MAX_ATTEMPTS 도달 시 exhausted로 표시하되 삭제하지 않는다 —
 *  조용한 소실은 금지고, 수동 재개(/argus:debrief)의 대상으로 남는다. */
export function fail(
  dataDir: string,
  itemId: string,
  nonce: string,
  error: string,
): boolean {
  const { items } = readQueue(dataDir);
  const item = items.find((i) => i.item_id === itemId && i.lease?.nonce === nonce);
  if (!item) return false;
  delete item.lease;
  item.attempts += 1;
  item.last_error = error.slice(0, 400);
  item.status = 'retryable_failed';
  if (item.attempts >= MAX_ATTEMPTS) {
    item.exhausted = true;
    item.status = 'exhausted';
  }
  writeQueue(dataDir, items);
  return true;
}

/** 수동 재개 — exhausted 항목의 재시도 카운터를 리셋한다 (debrief의 손잡이).
 *  자동 경로는 이 함수를 절대 부르지 않는다 — 재개는 사람의 결정이다. */
export function revive(dataDir: string, itemId: string): boolean {
  const { items } = readQueue(dataDir);
  const item = items.find((i) => i.item_id === itemId && i.exhausted);
  if (!item) return false;
  item.attempts = 0;
  delete item.exhausted;
  delete item.lease;
  item.status = 'pending';
  writeQueue(dataDir, items);
  return true;
}

/** Explicit privacy action: keep only a content-free lifecycle receipt. */
export function purge(dataDir: string, itemId: string, nowIso: string): boolean {
  const { items } = readQueue(dataDir);
  const item = items.find((candidate) => candidate.item_id === itemId);
  if (!item || item.status === 'leased') return false;
  item.status = 'purged_by_user';
  item.transcript_path = '';
  item.session_id = '';
  item.candidate_ids = [];
  item.completed_at = nowIso;
  delete item.last_error;
  delete item.exhausted;
  writeQueue(dataDir, items);
  return true;
}

/** Bulk privacy action. Leased work is deliberately skipped: deleting a live
 * worker's coordinates would make its eventual completion ambiguous. */
export function purgeAll(dataDir: string, nowIso: string): { purged: number; leased_skipped: number } {
  const { items } = readQueue(dataDir);
  let purged = 0;
  let leasedSkipped = 0;
  for (const item of items) {
    if (item.status === 'leased') {
      leasedSkipped += 1;
      continue;
    }
    if (item.status === 'purged_by_user') continue;
    item.status = 'purged_by_user';
    item.transcript_path = '';
    item.session_id = '';
    item.candidate_ids = [];
    item.completed_at = nowIso;
    delete item.last_error;
    delete item.exhausted;
    purged += 1;
  }
  writeQueue(dataDir, items);
  return { purged, leased_skipped: leasedSkipped };
}
