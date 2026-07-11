/**
 * P3-2 — 수확 큐의 수용 기준 (정본 규칙 4·3).
 * 시간은 전부 호출자 주입(nowIso) — 시계 없이 만료·재클레임을 결정론으로 검증.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MAX_ATTEMPTS, claim, complete, enqueue, fail, queuePath, readQueue, revive } from './queue.js';

let dir: string;
const T0 = '2026-07-11T10:00:00.000Z';
const T1 = '2026-07-11T10:05:00.000Z'; // T0 + 5분
const T2 = '2026-07-11T11:00:00.000Z'; // T0 + 1시간 (lease 만료 후)
const LEASE = 10 * 60 * 1000; // 10분

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-q-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const item = (n: number) => ({ itemId: `it-${n}`, transcriptPath: `/t/${n}.jsonl`, sessionId: `s-${n}` });

describe('인입과 멱등', () => {
  it('enqueue는 item_id 멱등 — 겹쳐 넣어도 1건', () => {
    expect(enqueue(dir, item(1), T0)).toBe('enqueued');
    expect(enqueue(dir, item(1), T1)).toBe('duplicate');
    expect(readQueue(dir).items).toHaveLength(1);
  });
});

describe('클레임 — lease 소유권 (규칙 4: 확인·클레임만, 즉시 반환)', () => {
  it('활성 lease 중에는 남이 못 잡고, 만료되면 자연 회수된다', () => {
    enqueue(dir, item(1), T0);
    const a = claim(dir, T0, LEASE, 'nonce-a');
    expect(a?.item_id).toBe('it-1');
    expect(claim(dir, T1, LEASE, 'nonce-b')).toBeNull(); // 5분 뒤 — 아직 활성
    const b = claim(dir, T2, LEASE, 'nonce-b'); // 1시간 뒤 — 만료, 회수
    expect(b?.item_id).toBe('it-1');
    expect(b?.lease?.nonce).toBe('nonce-b');
  });

  it('만료 후 재클레임되면 옛 보유자의 complete/fail은 거절된다 (nonce 불일치)', () => {
    enqueue(dir, item(1), T0);
    claim(dir, T0, LEASE, 'nonce-old');
    claim(dir, T2, LEASE, 'nonce-new');
    expect(complete(dir, 'it-1', 'nonce-old')).toBe(false);
    expect(fail(dir, 'it-1', 'nonce-old', 'late failure')).toBe(false);
    expect(readQueue(dir).items[0]!.lease?.nonce).toBe('nonce-new'); // 무손상
  });
});

describe('완료와 실패 (규칙 4: 실패 시 항목 보존)', () => {
  it('complete는 항목을 제거한다 — 결과의 정본은 원장이지 큐가 아니다', () => {
    enqueue(dir, item(1), T0);
    claim(dir, T0, LEASE, 'n');
    expect(complete(dir, 'it-1', 'n')).toBe(true);
    expect(readQueue(dir).items).toHaveLength(0);
  });

  it('fail은 보존 + attempts 증가 + lease 해제 — 다음 클레임이 즉시 가능', () => {
    enqueue(dir, item(1), T0);
    claim(dir, T0, LEASE, 'n');
    expect(fail(dir, 'it-1', 'n', 'model timeout')).toBe(true);
    const q = readQueue(dir).items[0]!;
    expect(q.attempts).toBe(1);
    expect(q.last_error).toBe('model timeout');
    expect(q.lease).toBeUndefined();
    expect(claim(dir, T1, LEASE, 'n2')?.item_id).toBe('it-1'); // 만료 대기 없이 재시도 가능
  });

  it(`${MAX_ATTEMPTS}회 실패 = exhausted — 자동 클레임 제외, 그러나 항목은 남는다 (조용한 소실 금지)`, () => {
    enqueue(dir, item(1), T0);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      claim(dir, T0, LEASE, `n${i}`);
      fail(dir, 'it-1', `n${i}`, `attempt ${i} failed`);
    }
    const q = readQueue(dir).items[0]!;
    expect(q.exhausted).toBe(true);
    expect(claim(dir, T2, LEASE, 'nx')).toBeNull(); // 자동 경로 제외
    expect(readQueue(dir).items).toHaveLength(1); // 보존
  });

  it('revive(수동 재개)만이 exhausted를 되살린다', () => {
    enqueue(dir, item(1), T0);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      claim(dir, T0, LEASE, `n${i}`);
      fail(dir, 'it-1', `n${i}`, 'x');
    }
    expect(revive(dir, 'it-1')).toBe(true);
    expect(claim(dir, T2, LEASE, 'ny')?.item_id).toBe('it-1');
  });
});

describe('저장 위생', () => {
  it('큐에는 발화 원문이 없다 — transcript 경로만 (규칙 3: 임시 상태)', () => {
    enqueue(dir, item(1), T0);
    const raw = fs.readFileSync(queuePath(dir), 'utf8');
    const fields = Object.keys((JSON.parse(raw) as { items: Record<string, unknown>[] }).items[0]!);
    expect(fields.sort()).toEqual(['attempts', 'enqueued_at', 'item_id', 'kind', 'session_id', 'transcript_path']);
  });

  it('파손 파일은 빈 큐 + was_corrupt로 정직하게 읽힌다', () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(queuePath(dir), '{not json');
    const q = readQueue(dir);
    expect(q.items).toEqual([]);
    expect(q.was_corrupt).toBe(true);
    // 파손 위에서도 인입은 즉시 복구된 새 큐로 동작한다
    expect(enqueue(dir, item(2), T0)).toBe('enqueued');
    expect(readQueue(dir).was_corrupt).toBe(false);
  });

  it('여러 항목 사이에서 클레임은 클레임 가능한 첫 항목을 잡는다', () => {
    enqueue(dir, item(1), T0);
    enqueue(dir, item(2), T0);
    claim(dir, T0, LEASE, 'na'); // it-1 잠금
    expect(claim(dir, T1, LEASE, 'nb')?.item_id).toBe('it-2');
  });
});
