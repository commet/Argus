/**
 * 입력 깊이 사이클 5 — 유실 없는 거울. 사이클 1~3이 v1 원장에 모은 인지
 * 필드(질문·가치·버린 대안·하중 가정·확신도)와 채널 표식(elicited)이 v2
 * 거울을 건너 fold 상태까지 도달하는지, 실제 툴 핸들러로 끝에서 끝까지.
 *
 * 지키는 사상: 질문은 열기 것이 이긴다(첫 기록 우선) · 확신도는 봉인마다
 * 갱신 · 확인창 직접 입력(elicited)은 v2 사다리의 제 등급 elicited_user —
 * 모델 전달 user_stated는 종전대로 host_reported(자동 승격 금지).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../tools/init-config.js';
import { seal } from '../tools/seal.js';
import { settle } from '../tools/settle.js';
import { decide } from '../tools/public-tools.js';
import { loadState } from './reducer.js';
import { readLedger } from './ledger.js';
import { setElicitor } from '../lib/elicit.js';
import { resetSealSession } from '../tools/seal.js';

let home: string;
let repoDir: string;
let argusDir: string;
let savedHome: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-cog-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-cog-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  argusDir = path.join(repoDir, '.argus');
  process.env['ARGUS_V2_DEBUG'] = '1';
  savedHome = process.env['ARGUS_HOME'];
  process.env['ARGUS_HOME'] = home;
  resetSealSession();
});
afterEach(() => {
  if (savedHome === undefined) delete process.env['ARGUS_HOME'];
  else process.env['ARGUS_HOME'] = savedHome;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
  setElicitor(null);
  resetSealSession();
});

interface ToolData { [k: string]: unknown; v2_write?: { written: boolean; repository_id?: string } }
async function call(tool: { handler: (a: Record<string, unknown>) => Promise<unknown> }, args: Record<string, unknown>): Promise<ToolData> {
  const res = (await tool.handler(args)) as { structuredContent: { ok: boolean; data: ToolData } };
  expect(res.structuredContent.ok, JSON.stringify(res.structuredContent)).toBe(true);
  return res.structuredContent.data;
}

describe('인지 필드가 v2 거울을 유실 없이 건넌다', () => {
  it('열기의 인지 콰르텟 + 봉인의 질문·확신도가 v2 fold에 남는다 (질문은 열기 것이 이긴다)', async () => {
    await call(init, { argus_dir: argusDir });
    await call(decide, {
      argus_dir: argusDir, action: 'open', id: 'cog-1',
      decision: 'roll out the flagged build to one team',
      stakes: 'high', reversibility: 'costly_to_reverse',
      status_quo: 'hold the rollout',
      question: 'does speed or safety matter more this quarter',
      values: ['user trust', 'ship speed'],
      rejected_alternative: { alternative: 'full rollout', reason: 'blast radius' },
      load_bearing_assumption: 'the flag isolates shared state',
    });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'cog-1',
      predicate: 'error rate stays flat for the pilot team', check_by: '2099-01-01',
      predicate_owner: 'user', question: 'a different later question', confidence: 'uncertain',
      unverified_assumption: 'pilot team is representative',
    });
    const repoId = sealed.v2_write!.repository_id!;
    const d = loadState(home, repoId).decisions.get('cog-1')!;
    expect(d.question).toBe('does speed or safety matter more this quarter'); // 열기 것이 이긴다
    expect(d.values).toEqual(['user trust', 'ship speed']);
    expect(d.rejected_alternative).toEqual({ alternative: 'full rollout', reason: 'blast radius' });
    expect(d.load_bearing_assumption).toBe('the flag isolates shared state');
    expect(d.confidence).toBe('uncertain');
    expect(loadState(home, repoId).anomalies).toEqual([]);
  });

  it('열기 없는 봉인의 질문은 v2에서도 봉인이 채운다', async () => {
    await call(init, { argus_dir: argusDir });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'cog-2',
      predicate: 'churn stays under 3 percent through Q3', check_by: '2099-02-01',
      predicate_owner: 'user', question: 'is retention or acquisition the lever now', confidence: 'confident',
      unverified_assumption: 'cohort mix stays stable',
    });
    const repoId = sealed.v2_write!.repository_id!;
    const d = loadState(home, repoId).decisions.get('cog-2')!;
    expect(d.question).toBe('is retention or acquisition the lever now');
    expect(d.confidence).toBe('confident');
  });

  it('모델 전달 user_stated 전제의 확신도는 host_reported로 남는다 (자동 승격 금지)', async () => {
    await call(init, { argus_dir: argusDir });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'cog-3',
      predicate: 'the vendor delivers within two weeks', check_by: '2099-03-01',
      predicate_owner: 'user', unverified_assumption: 'lead time quote is real',
    });
    await call(decide, {
      argus_dir: argusDir, action: 'add_context', id: 'cog-3',
      premises: [{ text: 'the quoted lead time includes customs', source: 'user_stated', anchor_quote: 'they said customs is included', confidence: 'contested', external: true, load_bearing: true }],
    });
    const repoId = sealed.v2_write!.repository_id!;
    const prems = [...loadState(home, repoId).premises.values()];
    const p = prems.find((x) => x.text.value === 'the quoted lead time includes customs')!;
    expect(p.confidence).toBe('contested');
    expect(p.text.provenance).toBe('host_reported');
  });

  it('확인창 직접 입력 전제는 v2에서 elicited_user 등급을 받는다', async () => {
    await call(init, { argus_dir: argusDir });
    setElicitor(async () => ({ action: 'accept' as const, content: { belief: 'the cache is the real bottleneck' } }), () => true);
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'cog-4',
      predicate: 'p50 latency drops under 150ms after the cache fix', check_by: '2099-04-01',
      predicate_owner: 'user',
    });
    const repoId = sealed.v2_write!.repository_id!;
    const prems = [...loadState(home, repoId).premises.values()];
    const typed = prems.find((x) => x.text.value === 'the cache is the real bottleneck')!;
    expect(typed).toBeDefined();
    expect(typed.text.provenance).toBe('elicited_user'); // 모델 미경유 채널의 제 등급
    expect(typed.load_bearing).toBe(true);
  });

  it('귀환이 남긴 규칙도 유실 없이 건너고 elicited_user 등급을 받는다', async () => {
    await call(init, { argus_dir: argusDir });
    setElicitor(async () => ({ action: 'accept' as const, content: {} }), () => true);
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'cog-5',
      predicate: 'the new pricing page lifts trial starts', check_by: '2026-07-10',
      predicate_owner: 'user', today_override: '2026-07-01',
    });
    const repoId = sealed.v2_write!.repository_id!;
    setElicitor(async () => ({ action: 'accept' as const, content: { lesson: 'pricing tests need two full weeks, not one' } }), () => true);
    await call(settle, {
      argus_dir: argusDir, id: 'cog-5', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: 'trial starts were flat', today_override: '2026-07-11',
    });
    const ev = readLedger(home, repoId).events.filter((e) => e.event === 'settle') as Array<{ lesson?: { value: string; provenance: string } }>;
    expect(ev).toHaveLength(1);
    // 계수되며 유실하는 거울을 막는다: 값과 등급이 둘 다 건너야 한다.
    expect(ev[0]!.lesson?.value).toBe('pricing tests need two full weeks, not one');
    expect(ev[0]!.lesson?.provenance).toBe('elicited_user');
  });
});
