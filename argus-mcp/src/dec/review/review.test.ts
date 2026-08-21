import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dueDecisions, QUIET_DAYS } from './due.js';
import { DEC_BIN, sayAsk } from './ask.js';
import { signDecision, reviewDecision } from '../write.js';
import { foldDecisions } from '../fold.js';
import { runDecDueCli, runDecCloseCli, runDecAmendCli } from '../dec-cli.js';
import { renderDecisionBody } from '../render.js';
import { makeRecord } from '../test-helpers.js';
import type { DecisionRecord, DecSignedPayload } from '../types.js';

const rec = (id: string, extra: Partial<DecisionRecord> = {}): DecisionRecord => makeRecord(id, extra);

describe('때가 됐나 — 세 이유를 섞지 않는다', () => {
  it('정한 날이 지나면 달력으로 부른다', () => {
    const due = dueDecisions([rec('D-0001', { review: '2026-08-10' })], '2026-08-21');
    expect(due).toHaveLength(1);
    expect(due[0]!.reason).toBe('calendar');
    expect(due[0]!.days).toBe(11);
  });

  it('아직 안 된 날짜는 안 부른다', () => {
    expect(dueDecisions([rec('D-0001', { review: '2026-09-01' })], '2026-08-21')).toHaveLength(0);
  });

  it('계기형은 기계가 판정하지 않고 조건을 들고 사람 앞에 놓는다', () => {
    const due = dueDecisions([rec('D-0002', { review_on_event: '유료 사용자가 생기면' })], '2026-08-21');
    expect(due[0]!.reason).toBe('event');
    // 며칠 지났다는 말을 붙이지 않는다 — 그 일이 언제 일어났는지 기계는 모른다.
    expect(due[0]!.days).toBe(0);
  });

  it('30일 조용하면 한 번 묻는다 (좀비 감쇠의 첫 걸음)', () => {
    const quiet = dueDecisions([rec('D-0003', { adopted: '2026-07-01' })], '2026-08-21');
    expect(quiet[0]!.reason).toBe('quiet');
    expect(quiet[0]!.days).toBeGreaterThanOrEqual(QUIET_DAYS);
  });

  it('걸린 적이 있으면 조용한 것이 아니다', () => {
    const fired = rec('D-0004', {
      adopted: '2026-07-01',
      fires: [{ at: '2026-08-20T10:00:00.000Z', channel: 'file', matched: 'src/app/**', where: 'src/app/x.tsx' }],
    });
    expect(dueDecisions([fired], '2026-08-21')).toHaveLength(0);
  });

  it('그만둔 결정은 다시 묻지 않는다', () => {
    expect(dueDecisions([rec('D-0005', { status: 'repealed', review: '2026-01-01' })], '2026-08-21')).toHaveLength(0);
  });
});

describe('묻는 글 — 그때의 당신을 먼저 보여준다', () => {
  const item = dueDecisions([rec('D-0001', {
    review: '2026-08-10', because: '두 번 헤맸다', quote: '웹 화면은 나중에.',
    falsified_if: '두 달 안에 사용자가 웹으로 먼저 들어오면',
  })], '2026-08-21')[0]!;
  const lines = sayAsk(item);
  const text = lines.join('\n');

  it('그때 쓴 이유와 문장이 선택지보다 먼저 나온다', () => {
    const because = lines.findIndex((l) => l.includes('그때 쓴 이유'));
    const quote = lines.findIndex((l) => l.includes('그때 이렇게 적혀 있었다'));
    const options = lines.findIndex((l) => l.includes('그대로 둔다'));
    expect(because).toBeGreaterThan(-1);
    expect(quote).toBeGreaterThan(because);
    expect(options).toBeGreaterThan(quote);
  });

  it('반증 조건을 읽어서 묻는다 (적어만 두고 안 읽으면 없는 것과 같다)', () => {
    expect(text).toContain('틀린 것으로 치기로 한 조건');
    expect(text).toContain('두 달 안에 사용자가 웹으로 먼저 들어오면');
  });

  it('남긴 이유가 없으면 없다고 말한다 — 지어내지 않는다', () => {
    const bare = dueDecisions([rec('D-0009', { review: '2026-08-20' })], '2026-08-21')[0]!;
    expect(sayAsk(bare).join('\n')).toContain('그때 남긴 이유는 없다');
  });

  it('사람을 채점하지 않는다', () => {
    for (const word of ['점수', '등급', '정확도', '잘했', '못했', '평가']) {
      expect(text).not.toContain(word);
    }
  });

  it('기계 낱말이 화면에 안 나온다', () => {
    for (const word of ['falsified_if', 'review_on_event', 'provenance', 'unattended', 'watch_rule', 'status']) {
      expect(text).not.toContain(word);
    }
  });

  it('적어 준 명령은 전부 실제로 도는 이름이다', () => {
    const dispatch = fs.readFileSync(new URL('../../index.ts', import.meta.url), 'utf8');
    const named = [...text.matchAll(new RegExp(`${DEC_BIN} ([a-z-]+)`, 'g'))].map((m) => m[1]!);
    expect(named.length).toBeGreaterThan(0);
    for (const command of new Set(named)) {
      expect(dispatch, `${command} 를 화면에 적었는데 index.ts 가 안 받는다`)
        .toContain(`process.argv[2] === '${command}'`);
    }
  });

  /**
   * 화면 글을 쓰는 자리가 늘 때마다 같은 실수가 난다 — 있지도 않은 명령을
   * 적어 두는 것. `dec amend`(띄어쓰기)·`dec check <계획>` 둘 다 실제로 그렇게
   * 나갔다. 그래서 **화면 글을 만드는 파일 전체**를 훑는다.
   */
  it('화면 글에 적힌 dec 명령은 어느 파일에서든 실재한다', () => {
    const dispatch = fs.readFileSync(new URL('../../index.ts', import.meta.url), 'utf8');
    const known = new Set([...dispatch.matchAll(/process\.argv\[2\] === '(dec-[a-z-]+)'/g)].map((m) => m[1]!));
    expect(known.size).toBeGreaterThan(5);

    const surfaces = ['../inject/say.ts', './ask.ts', '../check/speak.ts', '../rehearse/engine.ts',
                      '../block/say.ts', '../export/emit.ts'];
    for (const rel of surfaces) {
      const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
      // 사람에게 보이는 문장 안의 `dec …` 만 본다 (import 경로가 아니라).
      for (const m of src.matchAll(/\bdec[ -]([a-z][a-z-]{2,})\b/g)) {
        const spelled = `dec-${m[1]!}`;
        expect(known, `${rel} 이 "${m[0]}" 를 적었는데 index.ts 가 안 받는다`).toContain(spelled);
      }
    }
  });
});

describe('닫기 — 원장에 사건으로 쌓인다', () => {
  let repo: string;
  let dir: string;
  const sign = (id: string, extra: Partial<DecSignedPayload> = {}): Promise<unknown> =>
    signDecision(dir, id, {
      type: 'pin', decision: `${id} 의 문장`, scope: 'repo', binds: '나', author: '나',
      provenance: 'user', adopted: '2026-08-01', unattended: 'park', watch: 'inject_only',
      review: '2026-08-10', ...extra,
    } as DecSignedPayload, '2026-08-21T00:00:00.000Z');

  beforeEach(() => {
    // `.argus` 의 **부모가 저장소 뿌리**다 — 그 자리에 `decisions/`·`AGENTS.md`
    // 가 생긴다. 임시 디렉터리를 그대로 argusDir 로 쓰면 그것들이 /tmp 에 떨어지고,
    // 파일 하나(`AGENTS.md`)를 여러 테스트가 나눠 쓰게 된다.
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-review-'));
    dir = path.join(repo, '.argus');
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it('다음에 볼 날 없이는 못 닫는다 (불변식 ⑤ 재확인 필수)', async () => {
    await sign('D-0001');
    await expect(reviewDecision(dir, 'D-0001', { outcome: 'keep', next_review: '' }, '2026-08-21T01:00:00.000Z'))
      .rejects.toThrow(/NO_NEXT_REVIEW/);
  });

  it('그대로 두면 다음 날짜가 결정에 붙고 다시 안 부른다', async () => {
    await sign('D-0001');
    await reviewDecision(dir, 'D-0001', { outcome: 'keep', next_review: '2026-09-30' }, '2026-08-21T01:00:00.000Z');
    const record = foldDecisions(dir).records.find((r) => r.id === 'D-0001')!;
    expect(record.review).toBe('2026-09-30');
    expect(record.reviews).toHaveLength(1);
    expect(dueDecisions([record], '2026-08-21')).toHaveLength(0);
  });

  it('배운 것과 막은 것은 사람이 쓴 것만 들어간다', async () => {
    await sign('D-0001');
    await reviewDecision(dir, 'D-0001', {
      outcome: 'keep', next_review: '2026-09-30', lesson: '범위를 좁게 잡으니 덜 걸렸다',
    }, '2026-08-21T01:00:00.000Z');
    const record = foldDecisions(dir).records.find((r) => r.id === 'D-0001')!;
    expect(record.reviews[0]!.lesson).toBe('범위를 좁게 잡으니 덜 걸렸다');
    expect(record.reviews[0]!.prevented).toBeUndefined();   // 기계가 채우지 않는다
    expect(renderDecisionBody(record)).toContain('범위를 좁게 잡으니 덜 걸렸다');
  });

  it('그만두기는 다시 보기가 아니라 폐지로 나간다 (화면대로 쳤을 때)', async () => {
    await sign('D-0001');
    await runDecCloseCli(['--argus-dir', dir, '--id', 'D-0001', '--sunset', '--why', '웹을 먼저 열기로 했다']);
    const record = foldDecisions(dir).records.find((r) => r.id === 'D-0001')!;
    expect(record.status).toBe('repealed');
    expect(record.reviews).toHaveLength(0);
  });

  it('그만두려면 왜인지 한 줄이 있어야 한다', async () => {
    await sign('D-0001');
    await expect(runDecCloseCli(['--argus-dir', dir, '--id', 'D-0001', '--sunset']))
      .rejects.toThrow(/--why/);
  });

  it('그대로와 나중에를 함께 치면 조용히 하나를 고르지 않는다', async () => {
    await sign('D-0001');
    await expect(runDecCloseCli(['--argus-dir', dir, '--id', 'D-0001', '--keep', '--later', '--next-review', '2026-09-30']))
      .rejects.toThrow(/함께 받지 않는다/);
  });

  it('문장을 바꾸면 덮어쓰지 않고 개정으로 쌓인다', async () => {
    await sign('D-0001');
    await runDecAmendCli(['--argus-dir', dir, '--id', 'D-0001', '--decision', '웹 화면을 먼저 연다', '--why', '사용자가 웹으로 들어온다']);
    const record = foldDecisions(dir).records.find((r) => r.id === 'D-0001')!;
    expect(record.decision).toBe('웹 화면을 먼저 연다');
    expect(record.amendments).toHaveLength(1);
    expect(record.amendments[0]!.why).toBe('사용자가 웹으로 들어온다');
    expect(renderDecisionBody(record)).toContain('D-0001 의 문장');   // 옛 문장이 파일에 남는다
  });

  it('바꿀 것 없이 개정만 부르면 거절한다', async () => {
    await sign('D-0001');
    await expect(runDecAmendCli(['--argus-dir', dir, '--id', 'D-0001', '--why', '그냥']))
      .rejects.toThrow(/바꿀 것을 하나는/);
  });

  it('dec-due 가 내는 명령은 그대로 복사해서 칠 수 있다', async () => {
    await sign('D-0001');
    const write = process.stdout.write.bind(process.stdout);
    let out = '';
    (process.stdout as { write: unknown }).write = (chunk: string): boolean => { out += chunk; return true; };
    try { runDecDueCli(['--argus-dir', dir, '--today', '2026-08-21']); }
    finally { (process.stdout as { write: unknown }).write = write; }

    const parsed = JSON.parse(out) as { due: Array<{ id: string; reason: string }>; say: string[] };
    expect(parsed.due).toEqual([{ id: 'D-0001', reason: 'calendar', days: 11 }]);
    const text = parsed.say.join('\n');
    expect(text).toContain(`--argus-dir ${dir}`);

    // 화면이 내민 "그대로 둔다" 를 그대로 쳐서 실제로 닫힌다.
    const line = parsed.say.find((l) => l.includes('그대로 둔다'))!;
    const args = line.slice(line.indexOf('dec-close')).split(' ').slice(1)
      .map((a) => (a === '<날짜>' ? '2026-09-30' : a));
    await runDecCloseCli(args);
    expect(foldDecisions(dir).records[0]!.review).toBe('2026-09-30');
  });
});
