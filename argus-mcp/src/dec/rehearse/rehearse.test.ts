import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rehearse, sayRehearsal, type PastEvent } from './engine.js';
import { collectGitPast, collectTranscriptPast, transcriptDirFor } from './collect.js';
import type { WatchRule } from '../watch/rule.js';
import { execFileSync } from 'node:child_process';

const RULE: WatchRule = {
  paths: ['src/app/**'], phrases: ['웹 화면'],
  except_paths: [], except_phrases: [],
  blind_spots: ['다른 이름의 틀은 못 잡는다'], mode: 'machine',
};

const past: PastEvent[] = [
  { kind: 'file_change', at: '2026-08-10T01:00:00Z', path: 'src/app/page.tsx', where: 'abc1234', context: '화면 손봄' },
  { kind: 'file_change', at: '2026-08-11T01:00:00Z', path: 'docs/a.md', where: 'def5678', context: '문서' },
  { kind: 'utterance', at: '2026-08-12T01:00:00Z', text: '오늘 웹 화면 좀 볼까', where: 'sess1' },
  { kind: 'utterance', at: '2026-08-12T02:00:00Z', text: '점심 뭐 먹지', where: 'sess1' },
];

describe('시운전 — 지난 기록에 대본다', () => {
  it('부딪힌 것만 세고, 최근 것부터 보여준다', () => {
    const result = rehearse(RULE, past, { days: 30 });
    expect(result.hit_count).toBe(2);
    expect(result.hit_days).toBe(2);
    expect(result.hits[0]?.at).toBe('2026-08-12T01:00:00Z');
    expect(result.hits.map((h) => h.channel)).toEqual(['word', 'file']);
  });

  it('분모를 같이 말한다 — 분모 없는 "2번"은 아무 뜻이 없다', () => {
    const result = rehearse(RULE, past, { days: 30 });
    expect(result.scanned).toEqual({ file_changes: 2, utterances: 2, days: 30 });
    expect(sayRehearsal(result)[0]).toContain('고친 파일 2건');
    expect(sayRehearsal(result)[0]).toContain('오간 말 2줄');
  });

  it('파일이 바뀐 장면에는 그때 무슨 작업이었는지가 같이 나온다', () => {
    const hit = rehearse(RULE, past, { days: 30 }).hits.find((h) => h.channel === 'file');
    expect(hit?.scene).toBe('src/app/page.tsx 를 고쳤다 — 화면 손봄');
  });

  it('한 번도 안 부딪히면 그렇게 말한다 (0을 감추지 않는다)', () => {
    const said = sayRehearsal(rehearse(RULE, past.slice(1, 2), { days: 30 }));
    expect(said.join(' ')).toContain('한 번도 부딪히지 않았다');
  });

  it('기계가 못 잡는 규칙은 숫자를 만들지 않는다', () => {
    const result = rehearse({ ...RULE, paths: [], phrases: [], mode: 'inject_only' }, past, { days: 30 });
    expect(result).toMatchObject({ not_watchable: true, hit_count: 0 });
    expect(sayRehearsal(result).join(' ')).toContain('기계가 못 알아챈다');
  });

  it('너무 자주 부딪히면 좁히라고 말한다 (스팸 법 경고)', () => {
    const many: PastEvent[] = Array.from({ length: 40 }, (_, i) => ({
      kind: 'file_change', at: `2026-08-${String((i % 28) + 1).padStart(2, '0')}T01:00:00Z`,
      path: 'src/app/page.tsx', where: `c${i}`,
    }));
    expect(sayRehearsal(rehearse(RULE, many, { days: 30 })).join(' ')).toContain('너무 넓다는 뜻일 수 있다');
  });

  it('**"막았을 것"이라고 절대 말하지 않는다** (개입은 사실, 결과는 사람 몫)', () => {
    const said = sayRehearsal(rehearse(RULE, past, { days: 30 })).join(' ');
    expect(said).toContain('여기서 물었을 것이다');
    expect(said).not.toContain('막았을');
    expect(said).not.toContain('막아');
  });
});

describe('과거 모으기 — 못 읽으면 못 읽었다고 말한다', () => {
  it('git 이 없는 곳에서는 조용히 0을 내지 않고 이유를 남긴다', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-nogit-'));
    const result = collectGitPast(empty, 30);
    expect(result.past).toEqual([]);
    expect(result.gap).toBeTruthy();
  });

  it('실제 git 이력을 읽어 파일과 커밋 제목을 갈라 담는다', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-git-'));
    const run = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
    run('init', '-q');
    run('config', 'user.email', 'a@b.c');
    run('config', 'user.name', 'tester');
    fs.mkdirSync(path.join(repo, 'src', 'app'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'app', 'page.tsx'), 'x');
    run('add', '-A');
    run('commit', '-q', '-m', '웹 화면 첫 판');
    const result = collectGitPast(repo, 30);
    expect(result.gap).toBeUndefined();
    expect(result.past.some((e) => e.kind === 'file_change' && e.path === 'src/app/page.tsx')).toBe(true);
    const file = result.past.find((e) => e.kind === 'file_change');
    expect(file && file.kind === 'file_change' && file.context).toBe('웹 화면 첫 판');
    expect(result.past.some((e) => e.kind === 'utterance' && e.text === '웹 화면 첫 판')).toBe(true);
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('대화 기록에서 **사람이 친 말만** 가져온다 (도구 결과·끼워 넣은 글 제외)', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-home-'));
    const repo = '/tmp/some/repo';
    const dir = transcriptDirFor(repo, home);
    fs.mkdirSync(dir, { recursive: true });
    const rows = [
      { type: 'user', timestamp: '2026-08-20T01:00:00Z', message: { role: 'user', content: '사람이 친 말이다' } },
      { type: 'user', timestamp: '2026-08-20T02:00:00Z', toolUseResult: {}, message: { role: 'user', content: '도구가 돌려준 것' } },
      { type: 'user', timestamp: '2026-08-20T03:00:00Z', isMeta: true, message: { role: 'user', content: '시스템이 끼운 것' } },
      { type: 'user', timestamp: '2026-08-20T04:00:00Z', isCompactSummary: true, message: { role: 'user', content: '기계가 쓴 요약' } },
      { type: 'user', timestamp: '2026-08-20T05:00:00Z', isSidechain: true, message: { role: 'user', content: '다른 에이전트' } },
      { type: 'assistant', timestamp: '2026-08-20T06:00:00Z', message: { role: 'assistant', content: '에이전트 말' } },
      { type: 'user', timestamp: '2026-08-20T07:00:00Z', message: { role: 'user', content: [{ type: 'text', text: '<task-notification>기계 알림</task-notification> 진짜 내 말' }] } },
      { type: 'user', timestamp: '2026-08-20T08:00:00Z', message: { role: 'user', content: [{ type: 'text', text: '<system-reminder>전부 기계 글</system-reminder>' }] } },
    ];
    fs.writeFileSync(path.join(dir, 'sess.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const result = collectTranscriptPast(repo, 3650, home);
    expect(result.files).toBe(1);
    expect(result.past.map((e) => (e.kind === 'utterance' ? e.text : ''))).toEqual(['사람이 친 말이다', '진짜 내 말']);
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('대화 기록 폴더가 없으면 이유를 남긴다', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-home-'));
    const result = collectTranscriptPast('/tmp/nope', 30, home);
    expect(result.past).toEqual([]);
    expect(result.gaps.length).toBe(1);
    fs.rmSync(home, { recursive: true, force: true });
  });
});
