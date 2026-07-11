/**
 * P4-1 — sync outbox 상태머신 (정본 규칙 12)의 수용 기준.
 * 원장이 상태의 정본이다: 모든 검증은 이벤트를 fold한 SyncRecord로 한다.
 * transport는 주입 — 시계·네트워크 없는 결정론.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerRepository } from './ledger.js';
import { loadState } from './reducer.js';
import { contextFor, syncPendingV2, ulid, type V2Context } from './bridge.js';
import { BASE_RETRY_MS, MAX_SYNC_ATTEMPTS, dueForAttempt, nextRetryAt, processOutbox } from './outbox.js';

let home: string;
let repoDir: string;
let repoId: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-ob-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-ob-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  repoId = registerRepository(home, path.join(repoDir, '.git'));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

function ctx(): V2Context {
  return contextFor({
    home, gitCommonDir: path.join(repoDir, '.git'),
    workspaceArgusDir: path.join(repoDir, '.argus'),
    sessionId: 's-ob', producerVersion: '2.0.0-p4', today: '2026-07-11',
  });
}
const syncMap = () => loadState(home, repoId).sync;

const T0 = '2026-07-11T10:00:00.000Z';

describe('processOutbox — 성공 경로', () => {
  it('pending → attempted(1) + succeeded, 원장 fold가 terminal이 된다', async () => {
    const c = ctx();
    const src = ulid();
    syncPendingV2(c, { sourceEventId: src });

    const sent: string[] = [];
    const r = await processOutbox(c, syncMap().values(), async (id) => { sent.push(id); }, T0);
    expect(r).toMatchObject({ attempted: 1, succeeded: [src], failed: [], abandoned: [] });
    expect(sent).toEqual([src]); // transport가 받는 것은 event_id — 원격 멱등 키 계약

    const rec = syncMap().get(src)!;
    expect(rec.state).toBe('succeeded');
    expect(rec.attempts).toBe(1); // 몇 번 만에 갔는지가 사실로 남는다

    // terminal 후 재처리 대상이 아니다
    expect(dueForAttempt(syncMap().values(), T0)).toEqual([]);
  });
});

describe('processOutbox — 실패와 백오프', () => {
  it('실패는 next_retry_at 지수 백오프로 예약되고, 그 전에는 due가 아니다', async () => {
    const c = ctx();
    const src = ulid();
    syncPendingV2(c, { sourceEventId: src });

    const r = await processOutbox(c, syncMap().values(), async () => { throw new Error('ECONNREFUSED'); }, T0);
    expect(r.failed).toEqual([src]);

    const rec = syncMap().get(src)!;
    expect(rec.state).toBe('attempted');
    expect(rec.attempts).toBe(1);
    expect(rec.last_error).toBe('ECONNREFUSED');
    expect(rec.next_retry_at).toBe(nextRetryAt(T0, 1));

    // 백오프 전에는 조용 — 재시도 폭풍 금지
    expect(dueForAttempt(syncMap().values(), T0)).toEqual([]);
    const afterBackoff = new Date(Date.parse(T0) + BASE_RETRY_MS + 1000).toISOString();
    expect(dueForAttempt(syncMap().values(), afterBackoff).map((x) => x.source_event_id)).toEqual([src]);
  });

  it(`${MAX_SYNC_ATTEMPTS}회째 실패 = abandoned — 그러나 수동 재개(새 pending)는 가드가 허용한다`, async () => {
    const c = ctx();
    const src = ulid();
    syncPendingV2(c, { sourceEventId: src });

    let now = T0;
    for (let i = 0; i < MAX_SYNC_ATTEMPTS; i++) {
      await processOutbox(c, syncMap().values(), async () => { throw new Error(`down #${i + 1}`); }, now);
      now = new Date(Date.parse(now) + BASE_RETRY_MS * 2 ** i + 1000).toISOString();
    }
    const rec = syncMap().get(src)!;
    expect(rec.state).toBe('abandoned');
    expect(rec.last_error).toContain(`gave up after ${MAX_SYNC_ATTEMPTS} attempts`);
    expect(dueForAttempt(syncMap().values(), now)).toEqual([]); // 자동 경로 끝

    // 수동 재개 — abandoned 후 새 pending은 규칙 12가 허용 (포기는 손잡이지 끝이 아니다).
    // 재개는 별개 사건이므로 새 멱등 키 필수 — 기본 키 재사용은 duplicate로 접힌다 (의도된 함정 방지).
    const dup = syncPendingV2(c, { sourceEventId: src });
    expect(dup.appended).toBe(false); // 동일 키 = 같은 사건의 재시도로 접힘
    expect(syncMap().get(src)!.state).toBe('abandoned'); // 기본 키로는 재개 안 됨 — 정직한 no-op

    syncPendingV2(c, { sourceEventId: src, idempotencyKey: `sync-revive-${src}-1` });
    expect(syncMap().get(src)!.state).toBe('pending');
  });

  it('여러 레코드 처리 중 하나가 실패해도 나머지는 계속 간다 (절대 안 던짐)', async () => {
    const c = ctx();
    const bad = ulid();
    const good = ulid();
    syncPendingV2(c, { sourceEventId: bad });
    syncPendingV2(c, { sourceEventId: good });

    const r = await processOutbox(c, syncMap().values(), async (id) => {
      if (id === bad) throw new Error('boom');
    }, T0);
    expect(r.succeeded).toEqual([good]);
    expect(r.failed).toEqual([bad]);
  });
});
