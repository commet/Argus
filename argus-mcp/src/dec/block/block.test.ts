import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decideBlock, OBSERVE_DAYS } from './decide.js';
import { sayBlock, sayHeldBack } from './say.js';
import { runDecBlockCli, runDecPauseCli } from '../dec-cli.js';
import { pauseDecision, signDecision } from '../write.js';
import { foldDecisions } from '../fold.js';
import { renderDecisionBody } from '../render.js';
import { makeRecord } from '../test-helpers.js';
import type { DecisionRecord, DecSignedPayload } from '../types.js';
import type { WatchRule } from '../watch/rule.js';

const WATCH: WatchRule = {
  paths: ['src/app/**'], phrases: ['이름으로 죽이기'],
  except_paths: [], except_phrases: [],
  blind_spots: ['다른 이름으로 부르면 못 잡는다'], mode: 'machine',
};

const TODAY = '2026-08-21';

const rec = (id: string, extra: Partial<DecisionRecord> = {}): DecisionRecord =>
  makeRecord(id, {
    type: 'ban', decision: `${id} 은 하지 않는다`, unattended: 'deny',
    watch: 'machine', watch_rule: WATCH, review: '2026-12-01', ...extra,
  });

describe('막을 것인가 — 금지형만', () => {
  it('금지형이 걸리면 막는다', () => {
    const d = decideBlock([rec('D-0001')], { kind: 'file', path: 'src/app/page.tsx' }, TODAY);
    expect(d.block).toBe(true);
    expect(d.blocking.map((m) => m.id)).toEqual(['D-0001']);
  });

  it('고정·열림·예측은 걸려도 안 막는다 — 세어서 알린다', () => {
    for (const type of ['pin', 'open', 'pred'] as const) {
      const d = decideBlock([rec('D-0002', { type })], { kind: 'file', path: 'src/app/page.tsx' }, TODAY);
      expect(d.block, `${type} 이 막았다`).toBe(false);
      expect(d.matched_not_ban).toBe(1);
    }
  });

  it('그만둔 금지는 안 막는다', () => {
    const d = decideBlock([rec('D-0003', { status: 'repealed' })], { kind: 'file', path: 'src/app/page.tsx' }, TODAY);
    expect(d.block).toBe(false);
  });

  it('안 걸리는 자리는 안 막는다', () => {
    expect(decideBlock([rec('D-0001')], { kind: 'file', path: 'docs/note.md' }, TODAY).block).toBe(false);
  });
});

describe('막는 글 — 못 여는 문에 열쇠 설명서를 안 붙인다', () => {
  const text = sayBlock(decideBlock([rec('D-0001')], { kind: 'file', path: 'src/app/page.tsx' }, TODAY)).join('\n');

  it('무엇을 왜 막았는지 말한다', () => {
    expect(text).toContain('D-0001');
    expect(text).toContain('걸린 데');
  });

  it('막을 때도 못 잡는 것을 같이 말한다', () => {
    expect(text).toContain('이 규칙이 못 잡는 것');
    expect(text).toContain('다른 이름으로 부르면 못 잡는다');
  });

  it('우회 방법을 한 줄도 적지 않는다', () => {
    for (const key of ['대신', '우회', '--force', '무시하려면', '정 필요하면', '끄려면', '건너뛰',
                       '이렇게 하세요', '대안']) {
      expect(text, `막는 글이 "${key}" 를 가르친다`).not.toContain(key);
    }
  });

  it('안 막았으면 아무 말도 안 한다', () => {
    expect(sayBlock(decideBlock([rec('D-0001')], { kind: 'file', path: 'docs/x.md' }, TODAY))).toEqual([]);
  });
});

describe('판정을 못 하면 안 막는다 (fail-closed = 영향력 0)', () => {
  let repo: string;
  let dir: string;
  const capture = (args: string[]): { block: boolean; why_not?: string; unreadable?: string } => {
    const write = process.stdout.write.bind(process.stdout);
    let out = '';
    (process.stdout as { write: unknown }).write = (c: string): boolean => { out += c; return true; };
    try { runDecBlockCli(args); } finally { (process.stdout as { write: unknown }).write = write; }
    return JSON.parse(out) as { block: boolean; why_not?: string; unreadable?: string };
  };

  beforeEach(() => {
    // `.argus` 의 **부모가 저장소 뿌리**다 — 그 자리에 `decisions/`·`AGENTS.md`
    // 가 생긴다. 임시 디렉터리를 그대로 argusDir 로 쓰면 그것들이 /tmp 에 떨어지고,
    // 파일 하나(`AGENTS.md`)를 여러 테스트가 나눠 쓰게 된다.
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-block-'));
    dir = path.join(repo, '.argus');
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it('원장이 아예 없으면 통과시킨다', () => {
    expect(capture(['--argus-dir', dir, '--file', 'src/app/page.tsx']).block).toBe(false);
  });

  it('원장을 못 읽으면 "안 걸렸다"가 아니라 "모른다"로 통과시킨다', () => {
    const ledger = path.join(dir, 'ledger', 'ledger.jsonl');
    fs.writeFileSync(ledger, '{}\n');
    fs.chmodSync(ledger, 0o000);
    const result = capture(['--argus-dir', dir, '--file', 'src/app/page.tsx']);
    fs.chmodSync(ledger, 0o600);
    if (result.unreadable) {
      expect(result.block).toBe(false);
      expect(result.why_not).toBe('ledger_unreadable');
    }
    // root 로 도는 환경에서는 chmod 가 안 막는다 — 그때는 이 사례를 검사할 수 없다.
  });

  it('서명된 금지가 실제로 막는다 (원장 → 판정까지)', async () => {
    await signDecision(dir, 'D-0001', {
      type: 'ban', decision: '이름으로 죽이지 않는다', scope: 'repo', binds: '나', author: '나',
      provenance: 'user', adopted: '2026-08-01', unattended: 'deny', watch: 'machine',
      watch_rule: WATCH, review: '2026-12-01',
    } as DecSignedPayload, '2026-08-21T00:00:00.000Z');
    expect(capture(['--argus-dir', dir, '--file', 'src/app/page.tsx']).block).toBe(true);
    expect(capture(['--argus-dir', dir, '--text', '이름으로 죽이기 를 하자']).block).toBe(true);
    expect(capture(['--argus-dir', dir, '--file', 'docs/x.md']).block).toBe(false);
  });
});

describe('갓 만든 금지는 사흘 동안 보기만 한다 (§4.7 관찰 모드)', () => {
  const fresh = rec('D-0100', { adopted: '2026-08-20' });

  it('사흘이 안 지났으면 안 막는다 — 잘못 쓴 규칙 하나가 그날 일을 세우지 않게', () => {
    const d = decideBlock([fresh], { kind: 'file', path: 'src/app/page.tsx' }, '2026-08-21');
    expect(d.block).toBe(false);
    expect(d.held_back[0]!.why).toBe('observing');
    expect(d.held_back[0]!.until).toBe('2026-08-23');
  });

  it('사흘이 지나면 문다', () => {
    const d = decideBlock([fresh], { kind: 'file', path: 'src/app/page.tsx' }, '2026-08-23');
    expect(d.block).toBe(true);
    expect(OBSERVE_DAYS).toBe(3);
  });

  it('"지금 바로"를 고른 것은 첫날부터 문다', () => {
    const now = rec('D-0101', { adopted: '2026-08-21', effective_now: true });
    expect(decideBlock([now], { kind: 'file', path: 'src/app/page.tsx' }, '2026-08-21').block).toBe(true);
  });

  it('보고만 있는 것도 조용히 넘기지 않는다 — 안 그러면 물을 재료가 안 쌓인다', () => {
    const d = decideBlock([fresh], { kind: 'file', path: 'src/app/page.tsx' }, '2026-08-21');
    const say = sayHeldBack(d).join('\n');
    expect(say).toContain('D-0100');
    expect(say).toContain('2026-08-23부터 막는다');
    expect(sayBlock(d)).toEqual([]);   // 막는 글은 안 나온다
  });

  it('오늘을 모르면 안 막는다 (날짜를 모르는 채로 손을 붙잡느니 통과)', () => {
    const d = decideBlock([rec('D-0102')], { kind: 'file', path: 'src/app/page.tsx' });
    expect(d.block).toBe(false);
    expect(d.held_back).toHaveLength(1);
    // 관찰도 정지도 아니다 — 읽는 쪽이 "사흘 뒤엔 물겠구나"로 오해하면 안 된다.
    expect(d.held_back[0]!.why).toBe('unknown_date');
    expect(sayHeldBack(d).join('')).toContain('오늘이 며칠인지 몰라');
  });
});

describe('사람이 멈춰 두면 안 막는다 — 그리고 그날이 지나면 저절로 다시 문다', () => {
  const paused = rec('D-0200', { paused_until: '2026-08-25' });

  it('멈춘 동안은 안 막고, 왜 안 막았는지 말한다', () => {
    const d = decideBlock([paused], { kind: 'file', path: 'src/app/page.tsx' }, '2026-08-21');
    expect(d.block).toBe(false);
    expect(d.held_back[0]!.why).toBe('paused');
    expect(sayHeldBack(d).join('\n')).toContain('2026-08-25까지 멈춰 두기로 해서');
  });

  it('그날이 지나면 다시 막는다 — 다시 켜는 한 타가 따로 필요 없다', () => {
    expect(decideBlock([paused], { kind: 'file', path: 'src/app/page.tsx' }, '2026-08-26').block).toBe(true);
  });

  it('마지막 날은 아직 멈춰 있다', () => {
    expect(decideBlock([paused], { kind: 'file', path: 'src/app/page.tsx' }, '2026-08-25').block).toBe(false);
  });
});

describe('멈추는 문 — 잠긴 문이 아니라 발자국이 남는 문이다', () => {
  let repo: string;
  let dir: string;
  const SIGNED = {
    type: 'ban', decision: '이름으로 죽이지 않는다', scope: 'repo', binds: '나', author: '나',
    provenance: 'user', adopted: '2026-08-01', unattended: 'deny', watch: 'machine',
    watch_rule: WATCH, review: '2026-12-01',
  } as unknown as DecSignedPayload;

  const capture = async (fn: () => Promise<void> | void): Promise<Record<string, unknown>> => {
    const write = process.stdout.write.bind(process.stdout);
    let out = '';
    (process.stdout as { write: unknown }).write = (c: string): boolean => { out += c; return true; };
    try { await fn(); } finally { (process.stdout as { write: unknown }).write = write; }
    return JSON.parse(out) as Record<string, unknown>;
  };

  beforeEach(async () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-pause-'));
    dir = path.join(repo, '.argus');
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
    await signDecision(dir, 'D-0001', SIGNED, '2026-08-01T00:00:00.000Z');
  });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it('멈추면 그 뒤로 안 막는다', async () => {
    expect((await capture(() => runDecBlockCli(['--argus-dir', dir, '--file', 'src/app/x.tsx', '--today', TODAY])))['block']).toBe(true);
    await runDecPauseCli(['--argus-dir', dir, '--id', 'D-0001', '--until', '2026-08-25', '--why', '리팩터 중이라 온통 걸린다']);
    const after = await capture(() => runDecBlockCli(['--argus-dir', dir, '--file', 'src/app/x.tsx', '--today', TODAY]));
    expect(after['block']).toBe(false);
    expect((after['say_held_back'] as string[]).join('\n')).toContain('멈춰 두기로 해서');
  });

  it('끝날 날 없이는 못 멈춘다 — 무기한 정지는 이름만 다른 폐지다', async () => {
    await expect(runDecPauseCli(['--argus-dir', dir, '--id', 'D-0001', '--why', '그냥']))
      .rejects.toThrow(/--until/);
    await expect(pauseDecision(dir, 'D-0001', { until: '언젠가', why: 'x', by_tty: true }, '2026-08-21T00:00:00.000Z'))
      .rejects.toThrow(/BAD_DATE/);
  });

  it('왜 멈추는지 없이는 못 멈춘다', async () => {
    await expect(runDecPauseCli(['--argus-dir', dir, '--id', 'D-0001', '--until', '2026-08-25']))
      .rejects.toThrow(/--why/);
  });

  it('터미널이 아니어도 안 막고 기록에 남긴다 (우회는 되고 감사는 남는다)', async () => {
    const result = await capture(() => runDecPauseCli(
      ['--argus-dir', dir, '--id', 'D-0001', '--until', '2026-08-25', '--why', '급하다']));
    expect(result['by_tty']).toBe(false);         // 테스트는 터미널이 아니다
    expect(result['written']).toBe(1);            // 그래도 멈췄다
    const line = fs.readFileSync(path.join(dir, 'ledger', 'ledger.jsonl'), 'utf8')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((e) => e['event'] === 'dec_paused')!;
    expect((line['dec'] as { by_tty: boolean }).by_tty).toBe(false);
    expect((result['say'] as string[]).join('\n')).toContain('터미널에서 온 것이 아니라고 기록에 남겼다');
  });

  it('멈춘 것이 결정 파일에도 남는다 (사람이 여는 것은 원장이 아니라 파일이다)', async () => {
    await runDecPauseCli(['--argus-dir', dir, '--id', 'D-0001', '--until', '2026-08-25', '--why', '리팩터 중이다']);
    const body = renderDecisionBody(foldDecisions(dir).records.find((r) => r.id === 'D-0001')!);
    expect(body).toContain('막는 것을 멈춘 때');
    expect(body).toContain('2026-08-25까지 · 리팩터 중이다');
    expect(body).toContain('터미널이 아닌 데서');   // 테스트는 TTY 가 아니다
  });

  it('멈춤은 폐지가 아니다 — 결정은 살아 있고 방출본에도 남는다', async () => {
    await runDecPauseCli(['--argus-dir', dir, '--id', 'D-0001', '--until', '2026-08-25', '--why', 'x']);
    const record = foldDecisions(dir).records.find((r) => r.id === 'D-0001')!;
    expect(record.status).toBe('active');
    expect(record.paused_until).toBe('2026-08-25');
  });
});
