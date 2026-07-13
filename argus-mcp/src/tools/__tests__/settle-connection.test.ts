/**
 * 연결 읽기 통합 (정본 §8-§11) — 실제 seal→seal→settle 핸들러를 통과시켜, 전제가
 * 깨진 정산이 "같은 전제 위에 선 다른 열린 결정"을 표면에 노출하는지 end-to-end로
 * 확인한다. 순수 매칭(connection.test.ts)과 별개로, 배선(seal의 전제 승격 →
 * v2 원장 → settle의 연결 읽기)이 실제로 이어져 있음을 증명하는 골든 여정.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../init-config.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { openDecision } from '../open-decision.js';

let home: string;
let repoDir: string;
let argusDir: string;
let savedHome: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-conn-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-conn-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  argusDir = path.join(repoDir, '.argus');
  savedHome = process.env['ARGUS_HOME'];
  process.env['ARGUS_HOME'] = home;
});
afterEach(() => {
  if (savedHome === undefined) delete process.env['ARGUS_HOME'];
  else process.env['ARGUS_HOME'] = savedHome;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

async function call(tool: { handler: (a: Record<string, unknown>) => Promise<unknown> }, args: Record<string, unknown>) {
  const res = (await tool.handler(args)) as { structuredContent: { ok: boolean; surface: string; data: Record<string, unknown> } };
  expect(res.structuredContent.ok, JSON.stringify(res.structuredContent)).toBe(true);
  return res.structuredContent;
}

const ASSUMPTION = 'write volume stays under 200 per second';

describe('settle 연결 읽기 — 같은 전제에 선 다른 열린 결정', () => {
  it('전제가 깨진 정산이 같은 전제를 봉인한 다른 열린 결정을 표면에 올린다', async () => {
    await call(init, { argus_dir: argusDir });
    await call(seal, {
      argus_dir: argusDir, id: 'events-db', predicate: 'events query p95 stays under 100ms',
      check_by: '2026-09-01', predicate_owner: 'user', unverified_assumption: ASSUMPTION,
      today_override: '2026-07-13',
    });
    await call(seal, {
      argus_dir: argusDir, id: 'rate-limiter', predicate: 'no 429s at launch traffic',
      check_by: '2026-09-15', predicate_owner: 'user', unverified_assumption: ASSUMPTION,
      today_override: '2026-07-13',
    });

    // events-db를 정산하며 P1(그 전제)이 깨졌다고 사용자가 지목.
    const settled = await call(settle, {
      argus_dir: argusDir, id: 'events-db', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: 'traffic spiked to 500/sec at launch', broken_premise_ref: 'P1',
      today_override: '2026-09-01',
    });

    // 아직 열린 rate-limiter가 같은 전제에 기대므로 연결로 떠야 한다.
    // (predicate가 영어 → locale=en, 언어 일치 규칙대로 표면도 영어.)
    expect(settled.data['connections']).toEqual(['rate-limiter']);
    expect(settled.surface).toContain('rate-limiter');
    expect(settled.surface).toContain('same assumption');
    // 스파인: 평결 어휘 없음 — 사실 + 손잡이(check_in)뿐.
    expect(settled.surface).not.toMatch(/recommend|verdict|you were wrong|mistake/i);
    expect(settled.surface).toContain('argus_check_in');
  });

  it('shared_fact: 문장은 달라도 같은 URL을 가리키면 연결한다 (§9 1층)', async () => {
    await call(init, { argus_dir: argusDir });
    await call(seal, {
      argus_dir: argusDir, id: 'launch', predicate: 'ship the paid tier at launch window',
      check_by: '2026-09-01', predicate_owner: 'user',
      unverified_assumption: 'the free deal at https://partner.com/pricing holds through launch',
      today_override: '2026-07-13',
    });
    await call(seal, {
      argus_dir: argusDir, id: 'cost-plan', predicate: 'gross margin stays above 60 percent',
      check_by: '2026-10-01', predicate_owner: 'user',
      unverified_assumption: 'our margin math assumes https://partner.com/pricing stays free',
      today_override: '2026-07-13',
    });
    const settled = await call(settle, {
      argus_dir: argusDir, id: 'launch', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: 'partner started charging for the API', broken_premise_ref: 'P1',
      today_override: '2026-09-01',
    });
    // 두 전제 문장은 다르지만 같은 URL을 가리키므로 shared_fact로 이어져야 한다.
    expect(settled.data['connections']).toEqual(['cost-plan']);
    const reasons = settled.data['connection_reasons'] as Array<{ id: string; reason: string; via?: string }>;
    expect(reasons[0]).toMatchObject({ id: 'cost-plan', reason: 'shared_fact', via: 'url:https://partner.com/pricing' });
    expect(settled.surface).toContain('cost-plan');
  });

  it('한국어 전제 텍스트도 파이프라인을 통과해 매칭된다', async () => {
    await call(init, { argus_dir: argusDir });
    for (const id of ['deploy', 'billing']) {
      await call(seal, {
        argus_dir: argusDir, id, predicate: `${id} 결정은 무사히 간다고 본다`,
        check_by: '2026-09-01', predicate_owner: 'user', unverified_assumption: '초당 쓰기량은 200을 넘지 않는다',
        today_override: '2026-07-13',
      });
    }
    const settled = await call(settle, {
      argus_dir: argusDir, id: 'deploy', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: '출시 때 초당 500까지 튀었다', broken_premise_ref: 'P1', today_override: '2026-09-01',
    });
    // 연결 자체는 locale 무관 (같은 전제 텍스트 매칭). 표면 문구의 언어는 settle의
    // 기존 locale 해석을 따르므로 여기서 언어는 단언하지 않는다.
    expect(settled.data['connections']).toEqual(['billing']);
    expect(settled.surface).toContain('billing');
    expect(settled.surface).toContain('argus_check_in');
  });

  it('깨진 전제가 없으면(broken_premise_ref 생략) 연결을 만들지 않는다', async () => {
    await call(init, { argus_dir: argusDir });
    await call(seal, {
      argus_dir: argusDir, id: 'a', predicate: 'ships on friday for sure', check_by: '2026-09-01',
      predicate_owner: 'user', unverified_assumption: ASSUMPTION, today_override: '2026-07-13',
    });
    await call(seal, {
      argus_dir: argusDir, id: 'b', predicate: 'no rollback needed after launch', check_by: '2026-09-15',
      predicate_owner: 'user', unverified_assumption: ASSUMPTION, today_override: '2026-07-13',
    });
    const settled = await call(settle, {
      argus_dir: argusDir, id: 'a', outcome: 'held', outcome_source: 'user_stated',
      what_happened: 'shipped on time', today_override: '2026-09-01',
    });
    expect(settled.data['connections']).toBeUndefined();
    expect(settled.surface).not.toContain('같은 전제');
  });
});

describe('capture 연결 읽기 — 이미 추적 중인 전제 위에 선 결정 (§8-C, 앞문)', () => {
  it('포착하는 새 결정이 기댄 전제를 이미 봉인한 다른 열린 결정을 그 자리에서 표면에 올린다', async () => {
    await call(init, { argus_dir: argusDir });
    // 이미 열린 결정이 그 전제를 봉인해 v2 원장에 남아 있다.
    await call(seal, {
      argus_dir: argusDir, id: 'events-db', predicate: 'events query p95 stays under 100ms',
      check_by: '2026-09-01', predicate_owner: 'user', unverified_assumption: ASSUMPTION,
      today_override: '2026-07-13',
    });
    // 같은 전제 위에 선 새 결정을 포착 (consequential → 게이트 fire).
    const opened = await call(openDecision, {
      argus_dir: argusDir, id: 'cache-layer',
      decision: 'add a write-through cache in front of the events table',
      stakes: 'high', reversibility: 'one_way_door', status_quo: 'keep direct writes',
      load_bearing_assumption: ASSUMPTION, today_override: '2026-07-13',
    });
    // 이미 추적 중인 전제 위에 섰다는 사실 + 손잡이. 새 전제를 settle의 그것과
    // 똑같은 기계식 읽기(connection-io 단일 소스)로 매칭한다.
    expect(opened.data['connections']).toEqual(['events-db']);
    const reasons = opened.data['connection_reasons'] as Array<{ id: string; reason: string }>;
    expect(reasons[0]).toMatchObject({ id: 'events-db', reason: 'same_premise' });
    expect(opened.surface).toContain('events-db');
    expect(opened.surface).toContain('same assumption');
    expect(opened.surface).toContain('argus_check_in');
    // 스파인: 사실 + 손잡이뿐 — "다시 보라"·평결 어휘 없음.
    expect(opened.surface).not.toMatch(/recommend|verdict|revisit|reconsider|you should|mistake/i);
  });

  it('공유 전제가 없으면 포착에 연결 줄이 없다', async () => {
    await call(init, { argus_dir: argusDir });
    await call(seal, {
      argus_dir: argusDir, id: 'events-db', predicate: 'events query p95 stays under 100ms',
      check_by: '2026-09-01', predicate_owner: 'user', unverified_assumption: ASSUMPTION,
      today_override: '2026-07-13',
    });
    const opened = await call(openDecision, {
      argus_dir: argusDir, id: 'unrelated',
      decision: 'add a dark mode toggle to settings',
      stakes: 'high', reversibility: 'one_way_door', status_quo: 'light only',
      load_bearing_assumption: 'most users browse at night', today_override: '2026-07-13',
    });
    expect(opened.data['connections']).toBeUndefined();
    expect(opened.surface).not.toContain('events-db');
    expect(opened.surface).not.toContain('same assumption');
  });
});
