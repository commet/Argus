/**
 * P6-1 — 증거 포인터 졸업 + 결정론 수확 처리 단계의 수용 기준.
 *
 * 스파이크 evidence-pointer.test의 4가지 실증(byte offset·prefix 지문·
 * QUOTE_NOT_FOUND 루드·sanitize 별도)을 src 구현으로 재확인하고, 그 위에
 * 창업자 확정 정책(1일 1회·주 2건 캡)과 규칙 4(실패 보존)를 고정한다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerRepository, readLedger } from './ledger.js';
import { contextFor, type V2Context } from './bridge.js';
import { makeEvidencePointer, verifyEvidencePointer } from './evidence.js';
import { WEEKLY_CANDIDATE_CAP, runHarvestSweep, weekStartOf } from './harvest.js';
import { enqueue, readQueue } from './queue.js';
import { ArgusEventSchema } from './events.js';

let home: string;
let repoDir: string;
let repoId: string;
let dataDir: string;

const T0 = '2026-07-11T10:00:00.000Z';

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hv-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hv-repo-'));
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hv-data-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  repoId = registerRepository(home, path.join(repoDir, '.git'));
});
afterEach(() => {
  for (const d of [home, repoDir, dataDir]) fs.rmSync(d, { recursive: true, force: true });
});

function ctx(today = '2026-07-11'): V2Context {
  return contextFor({
    home, gitCommonDir: path.join(repoDir, '.git'),
    workspaceArgusDir: path.join(repoDir, '.argus'),
    sessionId: 's-hv', producerVersion: '2.0.0-p6', today,
  });
}

function writeTranscript(name: string, userLines: string[]): string {
  const p = path.join(repoDir, name);
  const lines = userLines.map((content) =>
    JSON.stringify({ type: 'user', message: { role: 'user', content } }));
  lines.push(JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [] } }));
  fs.writeFileSync(p, lines.join('\n') + '\n');
  return p;
}

const candidateEvents = () => readLedger(home, repoId).events
  .filter((e) => (e as Record<string, unknown>)['event'] === 'candidate_created') as Array<Record<string, unknown>>;

describe('evidence.ts — 스파이크 계약의 졸업 재확인', () => {
  it('UTF-8 byte offset + prefix 지문: 파일이 자라도 검증이 산다', () => {
    const buf = Buffer.from('한글 앞부분. postgres로 가기로 했다. 뒷부분', 'utf8');
    const ptr = makeEvidencePointer(buf, '/t.jsonl', 'postgres로 가기로 했다', 'user')!;
    expect(ptr.quote_byte_start).toBeGreaterThan('한글 앞부분. '.length); // byte ≠ char
    expect(verifyEvidencePointer(buf, ptr)).toBe('byte_verified');
    const grown = Buffer.concat([buf, Buffer.from(' 나중에 추가된 내용')]);
    expect(verifyEvidencePointer(grown, ptr)).toBe('byte_verified'); // append에도 산다
  });

  it('대조 실패는 QUOTE_NOT_FOUND 명시 값 — 발행 자체도 null (사칭 봉쇄)', () => {
    const buf = Buffer.from('아무 결정 없는 본문', 'utf8');
    expect(makeEvidencePointer(buf, '/t', '없는 인용문', 'user')).toBeNull();
    const ptr = makeEvidencePointer(buf, '/t', '아무 결정', 'user')!;
    expect(verifyEvidencePointer(Buffer.from('변조된 본문'), ptr)).toBe('QUOTE_NOT_FOUND');
  });
});

describe('runHarvestSweep — foreground와 같은 결정론 capture runtime', () => {
  it('게이트 발화 발화만 byte-검증 후보가 되고, zod가 이벤트를 승인한다', async () => {
    const t = writeTranscript('t1.jsonl', [
      '오늘 날씨 얘기나 하자.',                    // silent
      '세션 저장은 postgres로 가기로 했다.',        // fire
      '아직 결정 못 한 것도 있어.',                 // negation guard
    ]);
    enqueue(dataDir, { itemId: 'it-1', transcriptPath: t, sessionId: 'sess1' }, T0);

    const r = await runHarvestSweep(ctx(), dataDir, T0);
    expect(r.ran).toBe(true);
    expect(r.utterances_scanned).toBe(3);
    expect(r.candidates_created).toHaveLength(1);
    expect(r.quote_not_found).toBe(0);

    const evs = candidateEvents();
    expect(evs).toHaveLength(1);
    expect(evs[0]!['verification']).toBe('byte_verified');
    expect(ArgusEventSchema.safeParse(evs[0]).success, JSON.stringify(ArgusEventSchema.safeParse(evs[0]).error)).toBe(true);
    expect(readQueue(dataDir).items[0]).toMatchObject({ status: 'succeeded', candidate_ids: r.candidates_created });
  });

  it(`주 ${WEEKLY_CANDIDATE_CAP}건 캡: 초과 발화는 capped로 정직 계수, 원장 실계수가 기준`, async () => {
    const t = writeTranscript('t2.jsonl', [
      'A는 postgres로 가기로 했다.',
      'B는 redis로 가기로 했다.',
      'C는 sqlite로 가기로 했다.',
    ]);
    enqueue(dataDir, { itemId: 'it-2', transcriptPath: t, sessionId: 'sess2' }, T0);
    const r = await runHarvestSweep(ctx(), dataDir, T0);
    expect(r.candidates_created).toHaveLength(WEEKLY_CANDIDATE_CAP);
    expect(r.capped).toBe(1);
    expect(candidateEvents()).toHaveLength(WEEKLY_CANDIDATE_CAP);
  });

  it('1일 1회: 같은 날 두 번째 호출은 클레임조차 안 한다', async () => {
    const t = writeTranscript('t3.jsonl', ['x로 가기로 했다.']);
    enqueue(dataDir, { itemId: 'it-3', transcriptPath: t, sessionId: 'sess3' }, T0);
    await runHarvestSweep(ctx(), dataDir, T0);
    enqueue(dataDir, { itemId: 'it-3b', transcriptPath: t, sessionId: 'sess3b' }, T0);
    const r2 = await runHarvestSweep(ctx(), dataDir, T0);
    expect(r2).toMatchObject({ ran: false, skipped: 'already_ran_today' });
    expect(readQueue(dataDir).items.find((i) => i.item_id === 'it-3b')?.status).toBe('pending');
  });

  it('주간 캡이 이미 원장에서 소진돼 있으면 큐를 건드리지 않는다 (marker 아닌 원장이 정본)', async () => {
    const t = writeTranscript('t4.jsonl', ['A는 postgres로 가기로 했다.', 'B는 redis로 가기로 했다.']);
    enqueue(dataDir, { itemId: 'it-4', transcriptPath: t, sessionId: 'sess4' }, T0);
    await runHarvestSweep(ctx('2026-07-08'), dataDir, T0); // 화요일 — 2건 생성, 캡 소진
    // 같은 주 다른 날, 다른 dataDir marker (marker 소실 시나리오)
    const freshData = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hv-data2-'));
    try {
      enqueue(freshData, { itemId: 'it-5', transcriptPath: t, sessionId: 'sess5' }, T0);
      const r = await runHarvestSweep(ctx('2026-07-09'), freshData, T0);
      expect(r).toMatchObject({ ran: false, skipped: 'weekly_cap_exhausted' });
      expect(candidateEvents()).toHaveLength(2); // 캡 뚫리지 않음
    } finally {
      fs.rmSync(freshData, { recursive: true, force: true });
    }
  });

  it('transcript 부재 = 항목 보존 + last_error 기록 (규칙 4), 던지지 않는다', async () => {
    enqueue(dataDir, { itemId: 'it-6', transcriptPath: '/no/such/file.jsonl', sessionId: 'sess6' }, T0);
    const r = await runHarvestSweep(ctx(), dataDir, T0);
    expect(r.ran).toBe(true);
    expect(r.error).toContain('no such file');
    const q = readQueue(dataDir).items[0]!;
    expect(q.attempts).toBe(1);
    expect(q.last_error).toContain('no such file');
  });

  it('weekStartOf — 월요일 경계 (UTC)', () => {
    expect(weekStartOf('2026-07-11')).toBe('2026-07-06'); // 토→월
    expect(weekStartOf('2026-07-06')).toBe('2026-07-06'); // 월→그날
    expect(weekStartOf('2026-07-12')).toBe('2026-07-06'); // 일→지난 월
  });
});
