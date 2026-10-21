import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dueDecisions } from './due.js';
import { sayReceipt } from './receipt.js';
import { signDecision, reviewDecision, pauseDecision } from '../write.js';
import { foldDecisions } from '../fold.js';
import { runDecCloseCli } from '../dec-cli.js';
import { makeRecord } from '../test-helpers.js';
import type { DecSignedPayload } from '../types.js';

/**
 * 정산 — **답하고 나면 무엇이 달라졌는지 말하고, 답한 것을 일로 센다.**
 */

describe('답한 것도 일이다 (조용함 계산)', () => {
  const long_ago = '2026-06-01';

  it('어제 답한 결정을 오늘 "아무 일도 없었다"며 다시 묻지 않는다', () => {
    const r = makeRecord('D-0001', {
      adopted: long_ago,
      review: '2026-12-01', // 달력으로는 아직 아니다
      reviews: [{ at: '2026-09-10T00:00:00.000Z', outcome: 'keep', next_review: '2026-12-01' }],
    });
    expect(dueDecisions([r], '2026-09-11')).toEqual([]);
  });

  it('멈춘 것도 일이다', () => {
    const r = makeRecord('D-0001', {
      adopted: long_ago,
      pauses: [{ at: '2026-09-10T00:00:00.000Z', until: '2026-09-20', why: '급하다', by_tty: true }],
    });
    expect(dueDecisions([r], '2026-09-11')).toEqual([]);
  });

  it('정말로 아무 일 없이 오래 지난 것은 여전히 한 번 묻는다', () => {
    const r = makeRecord('D-0001', { adopted: long_ago });
    const due = dueDecisions([r], '2026-09-11');
    expect(due).toHaveLength(1);
    expect(due[0]!.reason).toBe('quiet');
  });
});

describe('영수증 — 닫고 나면 무엇이 달라졌는지', () => {
  let repo: string;
  let dir: string;

  const sign = (id: string, extra: Partial<DecSignedPayload> = {}): Promise<unknown> =>
    signDecision(dir, id, {
      type: 'pin', decision: `${id} 의 문장이 여기 있다`, scope: 'repo', binds: '나', author: '나',
      provenance: 'user', adopted: '2026-07-01', unattended: 'park', watch: 'inject_only',
      review: '2026-08-10', ...extra,
    } as DecSignedPayload, '2026-07-01T00:00:00.000Z');

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-receipt-'));
    dir = path.join(repo, '.argus');
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  const capture = async (run: () => Promise<void> | void): Promise<Record<string, unknown>> => {
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (c: string): boolean => { chunks.push(String(c)); return true; };
    try { await run(); } finally { (process.stdout as { write: unknown }).write = original; }
    return JSON.parse(chunks.join('').trim()) as Record<string, unknown>;
  };

  it('그대로 둔 뒤: 다음에 볼 날과 살아 있는 개수를 말한다', async () => {
    await sign('D-0001'); await sign('D-0002');
    const out = await capture(() => runDecCloseCli(
      ['--argus-dir', dir, '--id', 'D-0001', '--keep', '--next-review', '2026-10-10']));
    const say = (out['say'] as string[]).join('\n');
    expect(say).toContain('다음에 볼 날은 2026-10-10');
    expect(say).toContain('살아 있는 결정은 2개다');
  });

  it('그만둔 뒤: 줄어든 개수를 말한다', async () => {
    await sign('D-0001'); await sign('D-0002');
    const out = await capture(() => runDecCloseCli(
      ['--argus-dir', dir, '--id', 'D-0001', '--sunset', '--why', '웹을 먼저 연다']));
    const say = (out['say'] as string[]).join('\n');
    expect(say).toContain('이제 법이 아니다');
    expect(say).toContain('살아 있는 결정은 1개다');
  });

  it('교훈을 적었으면 **재 보고** 말한다 — 약속하지 않는다', async () => {
    await sign('D-0001');
    const out = await capture(() => runDecCloseCli(
      ['--argus-dir', dir, '--id', 'D-0001', '--keep', '--next-review', '2026-10-10',
       '--lesson', '범위를 좁게 잡으니 덜 걸렸다']));
    const say = (out['say'] as string[]).join('\n');
    expect(say).toContain('배운 것 한 줄을 적었다');
    // 하나뿐이라 반드시 창에 든다 — 그러면 "나온다"고 말해야 한다.
    expect(say).toContain('앞에 나온다');
  });

  it('안 적은 것은 말하지 않는다 (없는 것을 있는 척하지 않는다)', async () => {
    await sign('D-0001');
    const out = await capture(() => runDecCloseCli(
      ['--argus-dir', dir, '--id', 'D-0001', '--keep', '--next-review', '2026-10-10']));
    const say = (out['say'] as string[]).join('\n');
    expect(say).not.toContain('배운 것');
    expect(say).not.toContain('막았는지');
  });

  it('마지막 하나를 그만두면 "없다"고 말한다 (0을 개수로 쓰지 않는다)', async () => {
    await sign('D-0001');
    const out = await capture(() => runDecCloseCli(
      ['--argus-dir', dir, '--id', 'D-0001', '--sunset', '--why', '더는 필요 없다']));
    expect((out['say'] as string[]).join('\n')).toContain('살아 있는 결정이 없다');
  });

  it('영수증은 원장을 직접 읽는다 — 부르는 쪽이 세어 준 숫자를 안 믿는다', async () => {
    await sign('D-0001'); await sign('D-0002'); await sign('D-0003');
    await reviewDecision(dir, 'D-0001', { outcome: 'keep', next_review: '2026-10-10' },
      '2026-09-10T00:00:00.000Z');
    const say = sayReceipt(dir, {
      id: 'D-0001', outcome: 'keep', next_review: '2026-10-10',
      lesson_written: false, prevented_written: false,
      exported: { file: 'x', action: 'unchanged', verdict: 'match', count: 3 },
    }, '2026-09-11');
    expect(say.join('\n')).toContain('살아 있는 결정은 3개다');
  });

  it('멈춘 적이 있어도 영수증은 그것을 세지 않는다 (개수는 살아 있는 것만)', async () => {
    await sign('D-0001'); await sign('D-0002');
    await pauseDecision(dir, 'D-0001', { until: '2026-09-20', why: '급하다', by_tty: true },
      '2026-09-10T00:00:00.000Z');
    expect(foldDecisions(dir).records.filter((r) => r.status === 'active')).toHaveLength(2);
  });
});
