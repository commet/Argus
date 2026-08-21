import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inScopeForCwd, planInjection } from './select.js';
import { sayInjection } from './say.js';
import { markShown, readShown } from './state.js';
import type { DecisionRecord } from '../types.js';

const base = (id: string, scope: string, extra: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id, type: 'pin', decision: `${id} 의 문장`, scope, binds: '나', author: '나',
  provenance: 'user', adopted: '2026-08-01', unattended: 'park', watch: 'inject_only',
  status: 'active', amendments: [], ...extra,
});

describe('지금 있는 자리에 걸리나 — 회전이 누설이 되지 않게', () => {
  it('이 저장소 전체와 어디서나 걸리는 것은 늘 걸린다', () => {
    expect(inScopeForCwd('repo', 'src/app')).toBe(true);
    expect(inScopeForCwd('global', 'anywhere')).toBe(true);
  });
  it('자리 지정은 앞부분이 겹칠 때만 걸린다', () => {
    expect(inScopeForCwd('path:src/app/**', 'src')).toBe(true);
    expect(inScopeForCwd('path:src/app/**', 'src/app/deep')).toBe(true);
    expect(inScopeForCwd('path:src/app/**', 'docs')).toBe(false);
    expect(inScopeForCwd('path:argus-mcp/', 'src')).toBe(false);
  });
  it('범위가 틀린 결정은 창에 안 들어간다 (빈 값이 새는 자리를 막는다)', () => {
    expect(inScopeForCwd('', 'src')).toBe(false);
    expect(inScopeForCwd('task:pr', 'src')).toBe(false);
  });
});

describe('무엇을 펴 보일지 — 배급이 아니라 회전', () => {
  const records = [
    base('D-0001', 'repo', { review: '2026-08-01' }),          // 지난 것
    base('D-0002', 'repo', { review: '2099-01-01' }),
    base('D-0003', 'path:docs/**'),                              // 다른 자리
    base('D-0004', 'repo'),
    base('D-0005', 'global'),
    base('D-0006', 'repo', { status: 'repealed' }),              // 그만둔 것
  ];

  it('다시 볼 날이 지난 것이 먼저 올라온다', () => {
    const plan = planInjection(records, { cwd_rel: 'src', today: '2026-08-21' });
    expect(plan.picks[0]).toMatchObject({ slot: 'due' });
    expect(plan.picks[0]?.record.id).toBe('D-0001');
  });

  it('다른 자리에만 걸리는 것과 그만둔 것은 창에 안 들어간다', () => {
    const plan = planInjection(records, { cwd_rel: 'src', today: '2026-08-21' });
    const ids = plan.picks.map((p) => p.record.id);
    expect(ids).not.toContain('D-0003');
    expect(ids).not.toContain('D-0006');
    expect(plan.out_of_scope).toBe(1);
  });

  it('한 번도 안 펴 본 것이 오래 전에 편 것보다 먼저다 (조용한 법이 굶지 않게)', () => {
    const plan = planInjection(records, {
      cwd_rel: 'src', today: '2026-08-21',
      last_shown: { 'D-0002': '2026-08-20T00:00:00Z', 'D-0004': '2026-08-19T00:00:00Z' },
    });
    const rotation = plan.picks.filter((p) => p.slot === 'rotation').map((p) => p.record.id);
    expect(rotation[0]).toBe('D-0005'); // 한 번도 안 펴 봤다
    expect(rotation.indexOf('D-0004')).toBeLessThan(rotation.indexOf('D-0002'));
  });

  it('창을 넘는 것은 **감추지 않고 몇 건인지 말한다**', () => {
    const many = Array.from({ length: 20 }, (_, i) => base(`D-${String(i + 10)}`, 'repo'));
    const plan = planInjection(many, { cwd_rel: '', today: '2026-08-21', max: 5 });
    expect(plan.picks).toHaveLength(5);
    expect(plan.omitted).toBe(15);
    expect(sayInjection(plan).join('\n')).toContain('15건 더 있다');
  });

  it('재료가 없는 슬롯은 조용히 다른 것으로 안 메우고 이유를 남긴다', () => {
    const plan = planInjection(records, { cwd_rel: 'src', today: '2026-08-21' });
    expect(plan.empty_slots.map((s) => s.slot).sort()).toEqual(['lesson', 'recent_fire']);
    for (const slot of plan.empty_slots) expect(slot.why.length).toBeGreaterThan(10);
  });
});

describe('에이전트에게 가는 글 — 계약 넷을 반드시 말한다', () => {
  const plan = planInjection([
    base('D-0001', 'repo', {
      watch: 'machine',
      watch_rule: {
        paths: ['src/app/**'], phrases: ['웹 화면'], except_paths: [], except_phrases: [],
        blind_spots: ['다른 이름의 틀은 못 잡는다'], mode: 'machine',
      },
      because: '터미널부터 익히려고',
    }),
    base('D-0002', 'repo'),
  ], { cwd_rel: '', today: '2026-08-21', max: 1 });

  it('어긋나면 사람에게 회부하라고 말한다 (에이전트가 고르지 않는다)', () => {
    expect(sayInjection(plan).join('\n')).toContain('네가 고르지 마라');
  });
  it('모르면 하지 말라고 말한다', () => {
    expect(sayInjection(plan).join('\n')).toContain('모르면 하지 마라');
  });
  it('이 창에 없는 건수를 말한다 (전부라고 믿지 않게)', () => {
    const text = sayInjection(plan).join('\n');
    expect(text).toContain('1건 더 있다');
    expect(text).toContain('전부라고 믿지 마라');
  });
  it('기계가 못 잡는 것을 창에서도 말한다', () => {
    expect(sayInjection(plan).join('\n')).toContain('기계가 못 잡는 것: 다른 이름의 틀은 못 잡는다');
  });
  it('**발원 원문은 창에 안 들어간다** (서명이 세탁기가 되지 않게)', () => {
    const secret = '남이 쓴 3,810줄짜리 외부 문서 원문';
    const withSource = planInjection([base('D-0001', 'repo', { source: secret, source_origin: 'vendor.md' })],
      { cwd_rel: '', today: '2026-08-21' });
    const text = sayInjection(withSource).join('\n');
    expect(text).not.toContain(secret);
    expect(text).not.toContain('vendor.md');
  });
  it('펴 볼 것이 하나도 없으면 아무 말도 안 한다 (침묵이 기본)', () => {
    expect(sayInjection(planInjection([], { cwd_rel: '', today: '2026-08-21' }))).toEqual([]);
  });
});

describe('언제 마지막으로 펴 봤나 — 무한히 안 자란다', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-shown-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('남기고 다시 읽으면 그대로 돌아온다', () => {
    markShown(dir, ['D-0001'], '2026-08-21T00:00:00Z', ['D-0001']);
    expect(readShown(dir)).toEqual({ 'D-0001': '2026-08-21T00:00:00Z' });
  });
  it('원장에서 사라진 id 는 정리된다', () => {
    markShown(dir, ['D-0001', 'D-0002'], '2026-08-21T00:00:00Z', ['D-0001', 'D-0002']);
    markShown(dir, ['D-0001'], '2026-08-22T00:00:00Z', ['D-0001']);
    expect(Object.keys(readShown(dir))).toEqual(['D-0001']);
  });
  it('파일이 깨져 있으면 "한 번도 안 봤다"로 안전하게 돌아간다', () => {
    fs.writeFileSync(path.join(dir, 'dec-shown.json'), '{{{깨짐');
    expect(readShown(dir)).toEqual({});
  });
});
