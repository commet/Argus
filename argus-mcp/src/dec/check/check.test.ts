import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSubject } from './match.js';
import { decideSpeak, DAILY_LIMIT, MISFIRE_LIMIT } from './speak.js';
import { markSpoken, readSpoken } from './state.js';
import { signDecision, recordMisfire } from '../write.js';
import { foldDecisions } from '../fold.js';
import { runDecCheckCli, runDecMisfireCli } from '../dec-cli.js';
import { makeRecord } from '../test-helpers.js';
import type { DecisionRecord, DecSignedPayload } from '../types.js';
import type { WatchRule } from '../watch/rule.js';

const WATCH: WatchRule = {
  paths: ['src/app/**'], phrases: ['웹 화면'],
  except_paths: ['src/app/**/*.test.tsx'], except_phrases: [],
  blind_spots: ['다른 이름의 틀은 못 잡는다'], mode: 'machine',
};

const rec = (id: string, extra: Partial<DecisionRecord> = {}): DecisionRecord =>
  makeRecord(id, { watch: 'machine', watch_rule: WATCH, ...extra });

describe('걸렸나 — 판정은 전부 결정론이다', () => {
  const records = [
    rec('D-0001'),
    rec('D-0002', { scope: 'path:docs/**' }),
    rec('D-0003', { watch: 'inject_only', watch_rule: undefined }),
    rec('D-0004', { status: 'repealed' }),
  ];

  it('그 자리를 건드리면 걸린다', () => {
    const r = checkSubject(records, { kind: 'file', path: 'src/app/page.tsx' });
    expect(r.matches.map((m) => m.id)).toEqual(['D-0001']);
    expect(r.matches[0]?.channel).toBe('file');
  });

  it('다른 자리에 걸리는 법은 여기서 안 걸린다 (범위를 먼저 본다)', () => {
    const only = [rec('D-0002', { scope: 'path:docs/**' })];
    expect(checkSubject(only, { kind: 'file', path: 'src/app/page.tsx' }).matches).toEqual([]);
    expect(checkSubject(only, { kind: 'file', path: 'docs/a.md' }).matches).toEqual([]); // 규칙 자체가 안 맞음
  });

  it('봐주는 자리는 안 걸린다', () => {
    expect(checkSubject(records, { kind: 'file', path: 'src/app/x.test.tsx' }).matches).toEqual([]);
  });

  it('그 말이 나와도 걸린다', () => {
    const r = checkSubject(records, { kind: 'text', text: '오늘 웹 화면 좀 볼까' });
    expect(r.matches.map((m) => m.id)).toEqual(['D-0001']);
    expect(r.matches[0]?.channel).toBe('word');
  });

  it('**말만 오갈 때는 자리 지정 법을 안 건다** — 대신 몇 개를 못 봤는지 센다', () => {
    const r = checkSubject(records, { kind: 'text', text: '오늘 웹 화면 좀 볼까' });
    expect(r.matches.map((m) => m.id)).not.toContain('D-0002'); // path:docs/**
    expect(r.scope_unknown).toBe(1);
  });

  it('그만둔 결정은 안 걸린다', () => {
    expect(checkSubject([rec('D-0004', { status: 'repealed' })], { kind: 'file', path: 'src/app/a.tsx' }).matches).toEqual([]);
  });

  it('**"안 걸렸다"를 "괜찮다"로 말하지 않는다** — 기계가 못 보는 법을 센다', () => {
    const r = checkSubject(records, { kind: 'file', path: 'README.md' });
    expect(r.matches).toEqual([]);
    expect(r.unwatchable).toBe(1);   // D-0003
    expect(r.considered).toBe(3);    // 살아 있는 것 셋
  });

  it('걸렸을 때도 **못 잡는 것**을 같이 들고 온다', () => {
    expect(checkSubject(records, { kind: 'file', path: 'src/app/page.tsx' }).matches[0]?.blind_spots)
      .toEqual(['다른 이름의 틀은 못 잡는다']);
  });
});

describe('말할지 말지가 형태보다 먼저다 (거울 조항)', () => {
  const hit = checkSubject([rec('D-0001')], { kind: 'file', path: 'src/app/page.tsx' });
  const base = { result: hit, spoken_this_session: [], misfires: {}, spoken_today: 0 };

  it('걸린 게 없으면 침묵한다', () => {
    expect(decideSpeak({ ...base, result: checkSubject([], { kind: 'file', path: 'a.ts' }) }))
      .toEqual({ speak: false, why: 'no_match' });
  });

  it('이번 세션에 이미 말했으면 또 말하지 않는다', () => {
    expect(decideSpeak({ ...base, spoken_this_session: ['D-0001'] }))
      .toEqual({ speak: false, why: 'already_said' });
  });

  it(`잘못 잡았다고 ${MISFIRE_LIMIT}번 들으면 그 규칙은 말하기를 멈춘다`, () => {
    expect(decideSpeak({ ...base, misfires: { 'D-0001': MISFIRE_LIMIT } }))
      .toEqual({ speak: false, why: 'too_many_misfires' });
    expect(decideSpeak({ ...base, misfires: { 'D-0001': MISFIRE_LIMIT - 1 } }).speak).toBe(true);
  });

  it(`하루 ${DAILY_LIMIT}번을 넘기지 않는다`, () => {
    expect(decideSpeak({ ...base, spoken_today: DAILY_LIMIT }))
      .toEqual({ speak: false, why: 'daily_limit' });
  });

  it('말할 때는 한 줄이고, 못 잡는 것과 **되돌리는 법**이 같이 나온다', () => {
    const said = decideSpeak(base);
    expect(said.speak).toBe(true);
    const text = said.speak ? said.lines.join('\n') : '';
    expect(text).toContain('D-0001');
    expect(text).toContain('src/app/**');
    expect(text).toContain('못 잡는 것');
    expect(text).toContain('dec misfire D-0001');
  });

  it('여러 개가 걸려도 한 번에 하나만 말한다 (목록을 던지지 않는다)', () => {
    const many = checkSubject([rec('D-0001'), rec('D-0002')], { kind: 'file', path: 'src/app/page.tsx' });
    const said = decideSpeak({ ...base, result: many });
    expect(many.matches).toHaveLength(2);
    expect(said.speak && said.lines.filter((l) => l.startsWith('[아르고스]'))).toHaveLength(1);
  });
});

describe('오늘 몇 번 말했나 — 날짜가 바뀌면 새 하루다', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-spoken-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('세고, 세션별로 나눠 담는다', () => {
    markSpoken(dir, '2026-08-21', 's1', 'D-0001');
    markSpoken(dir, '2026-08-21', 's2', 'D-0002');
    const state = readSpoken(dir, '2026-08-21');
    expect(state.count).toBe(2);
    expect(state.sessions).toEqual({ s1: ['D-0001'], s2: ['D-0002'] });
  });
  it('날짜가 바뀌면 통째로 리셋된다 (무한히 안 자란다)', () => {
    markSpoken(dir, '2026-08-21', 's1', 'D-0001');
    expect(readSpoken(dir, '2026-08-22')).toEqual({ date: '2026-08-22', count: 0, sessions: {} });
  });
});

describe('끝까지 — 걸리면 기록에 남고, 잘못 잡으면 조용해진다', () => {
  let repo: string;
  let argusDir: string;
  let out: string[];
  const NOW = '2026-08-21T10:00:00.000Z';
  const SIGNED: DecSignedPayload = {
    type: 'pin', decision: '웹 화면은 나중에', scope: 'repo', binds: '나', author: '나',
    provenance: 'user', adopted: '2026-08-21', unattended: 'park', watch: 'machine',
    watch_rule: WATCH, review: '2026-09-04',
  };

  beforeEach(async () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-fire-'));
    argusDir = path.join(repo, '.argus');
    fs.mkdirSync(argusDir, { recursive: true });
    await signDecision(argusDir, 'D-0001', SIGNED, NOW);
    out = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { out.push(String(c)); return true; });
  });
  afterEach(() => { vi.restoreAllMocks(); fs.rmSync(repo, { recursive: true, force: true }); });

  const check = (extra: string[] = []) => runDecCheckCli([
    '--argus-dir', argusDir, '--session-id', 's1', '--today', '2026-08-21', ...extra,
  ]);
  const last = () => JSON.parse(out[out.length - 1]!);

  it('걸리면 말하고, 그 순간이 기록과 결정 파일에 남는다', async () => {
    await check(['--file', 'src/app/page.tsx']);
    expect(last().spoke).toBe(true);
    const record = foldDecisions(argusDir).records[0]!;
    expect(record.fires).toHaveLength(1);
    expect(record.fires[0]).toMatchObject({ channel: 'file', matched: 'src/app/**', where: 'src/app/page.tsx' });
    const file = fs.readFileSync(path.join(repo, 'decisions', 'D-0001.md'), 'utf8');
    expect(file).toContain('## 이 규칙이 일한 때');
    expect(file).toContain('src/app/page.tsx');
  });

  it('같은 세션에서 또 걸려도 두 번 말하지 않고, 기록도 안 늘어난다', async () => {
    await check(['--file', 'src/app/page.tsx']);
    await check(['--file', 'src/app/other.tsx']);
    expect(last()).toMatchObject({ spoke: false, why_silent: 'already_said' });
    expect(foldDecisions(argusDir).records[0]?.fires).toHaveLength(1);
  });

  it('**물어보는 것(--plan)은 발화가 아니다** — 아무것도 안 남는다', async () => {
    await check(['--plan', '웹 화면 좀 만들어볼까']);
    expect(last().matches).toHaveLength(1);
    expect(last().would_speak).toBe(true);   // 걸리기는 한다
    expect(last().spoke).toBe(false);        // 그러나 말한 것은 아니다
    expect(last().why_silent).toBe('asked_not_told');
    expect(foldDecisions(argusDir).records[0]?.fires).toEqual([]);
  });

  it('잘못 잡았다고 세 번 말하면 그 규칙은 조용해지고, 파일이 그렇게 적는다', async () => {
    for (let i = 0; i < 3; i += 1) {
      await recordMisfire(argusDir, 'D-0001', { matched: 'src/app/**', where: 'src/app/a.tsx' }, NOW);
    }
    expect(foldDecisions(argusDir).records[0]?.misfires).toBe(3);
    await check(['--file', 'src/app/page.tsx']);
    expect(last()).toMatchObject({ spoke: false, why_silent: 'too_many_misfires' });
    expect(fs.readFileSync(path.join(repo, 'decisions', 'D-0001.md'), 'utf8'))
      .toContain('이 규칙은 지금 말하기를 멈췄다');
  });

  it('dec-misfire 가 몇 번째인지와 멈췄는지를 돌려준다', async () => {
    await runDecMisfireCli(['--argus-dir', argusDir, '--id', 'D-0001', '--matched', 'src/app/**']);
    expect(last()).toMatchObject({ misfires: 1, silenced: false });
  });

  it('서명된 적 없는 결정에는 걸린 기록을 못 남긴다', async () => {
    await expect(runDecMisfireCli(['--argus-dir', argusDir, '--id', 'D-9999']))
      .rejects.toThrow(/NOT_SIGNED/);
  });
});
