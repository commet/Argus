/**
 * 고아 기록 — 전제는 있는데 예측이 없어 현실에 닿을 수 없는 결정.
 *
 * WHY. 첫 사용자 여정 실측 (2026-08-11): 원장 있는 실행 16회 중 **3회**에서
 * 사용자가 직접 쓴 하중 전제가 달린 결정에 예측이 끝내 안 달렸고, **6회**에서
 * 봉인이 여러 id로 쪼개졌다. D1은 한 대화·한 마이그레이션인데 원장에 id가
 * 6개였고 봉인 5건이 전부 고아였다 — 어시스턴트가 봉인마다 새 id를 지어내고
 * 작명 규칙도 매번 바꾼다.
 *
 * 측정으로 확인한 두 가지가 이 수리의 모양을 정했다:
 *   1. 그 결정은 check_in에도 patterns view="active"에도 **뜨지 않는다**
 *      (전체 덤프에만 이름이 보인다). 조용히 죽는다.
 *   2. 그런데 배선은 **이미 완전하다** — 그 id로 argus_predict를 부르면 봉인되고
 *      전제가 살아있고 확인일에 check_in이 불러낸다.
 * 그래서 빠진 것은 관계가 아니라 **손잡이**다. 새 필드를 만들지 않고, 서버가
 * 이미 아는 것을 이름 붙여 돌려준다.
 *
 * 무엇이 이걸 빨간불로 만드는가: 전제가 달린 미봉인 결정이 다시 보이지 않게
 * 되는 것 — 또는 반대로, **건강하게 기다리는** 봉인된 결정까지 부르게 되는 것
 * (그건 과발화이고, 침묵 계약이 지키는 바로 그 경계다).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stuckDecisions } from '../stuck-decisions.js';
import { replayLedger } from '../ledger-replay.js';
import { decide, publicSeal, publicCheckIn } from '../../tools/public-tools.js';

const T = '2026-08-11';
let dir: string;
let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-stuck-'));
  dir = path.join(home, '.argus');
  fs.mkdirSync(dir, { recursive: true });
  process.env['ARGUS_HOME'] = home;
});
afterEach(() => {
  delete process.env['ARGUS_HOME'];
  fs.rmSync(home, { recursive: true, force: true });
});

const body = (r: unknown) => (r as { structuredContent: Record<string, unknown> }).structuredContent;

async function openWithPremise(id: string, decision: string) {
  await decide.handler({
    argus_dir: dir, action: 'open', id, decision,
    stakes: 'moderate', reversibility: 'costly_to_reverse', status_quo: '지금 방식 유지',
    premises: [{ text: `${id} 의 하중 전제`, kind: 'premise', source: 'user_stated', load_bearing: true }],
    today_override: T,
  });
}
async function sealOn(id: string, predicate: string, checkBy = '2026-08-25') {
  return publicSeal.handler({
    argus_dir: dir, id, predicate, check_by: checkBy, predicate_owner: 'user', today_override: T,
  });
}

describe('고아 판정', () => {
  it('전제가 있고 예측이 없는 결정을 잡는다', async () => {
    await openWithPremise('cron-to-queue', '크론을 큐로 옮길지');
    const found = stuckDecisions(replayLedger(dir, T));
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe('cron-to-queue');
    expect(found[0]!.premise_count).toBe(1);
  });

  it('전제 없는 맨 포착은 세지 않는다 (잃을 사용자 문장이 없다)', async () => {
    await decide.handler({
      argus_dir: dir, action: 'open', id: 'bare', decision: '전제 없는 포착',
      stakes: 'low', reversibility: 'easily_reversible', status_quo: '유지', today_override: T,
    });
    expect(stuckDecisions(replayLedger(dir, T))).toHaveLength(0);
  });

  it('예측이 붙는 순간 고아가 아니게 된다', async () => {
    await openWithPremise('cron-to-queue', '크론을 큐로 옮길지');
    await sealOn('cron-to-queue', '작업 실패가 월 1건 아래로 내려간다');
    expect(stuckDecisions(replayLedger(dir, T))).toHaveLength(0);
  });

  it('사용자가 닫은 전제만 남았으면 세지 않는다 (스스로 정리한 것)', async () => {
    await openWithPremise('tidied', '정리한 결정');
    await decide.handler({
      argus_dir: dir, action: 'amend_context', id: 'tidied', ref: 'P1', amendment: 'retire',
      today_override: T,
    });
    expect(stuckDecisions(replayLedger(dir, T))).toHaveLength(0);
  });

  it('긴 결정 문장이 귀환 화면을 삼키지 않는다', async () => {
    await openWithPremise('verbose', '가'.repeat(400));
    const r = body(await publicCheckIn.handler({ argus_dir: dir, today_override: '2026-08-12' }));
    // 표면은 잘린 채로, 손잡이(data)는 온전하게.
    expect(String(r['surface']).length).toBeLessThan(400);
    const stuck = (r['data'] as Record<string, unknown>)['stuck_decisions'] as Array<{ decision: string }>;
    expect(stuck[0]!.decision.length).toBe(400);
  });

  it('건강하게 기다리는 봉인된 결정은 절대 세지 않는다 (침묵 계약의 경계)', async () => {
    await sealOn('far-future', '컷오버 다운타임이 5분 미만이다', '2099-01-01');
    expect(stuckDecisions(replayLedger(dir, T))).toHaveLength(0);
  });
});

describe('손잡이가 실제로 도착한다', () => {
  it('다른 id로 봉인하면 미봉인 결정을 돌려준다', async () => {
    await openWithPremise('cron-to-queue', '크론을 큐로 옮길지');
    const d = body(await sealOn('api-migration-connpool', 'connection pool timeouts stay under 5 per week'))['data'] as Record<string, unknown>;
    const listed = d['unsealed_decisions'] as Array<{ id: string }>;
    expect(listed?.map((x) => x.id)).toEqual(['cron-to-queue']);
    expect(String(d['unsealed_note'])).toMatch(/THAT id/);
  });

  it('제대로 그 결정에 붙였으면 잔소리하지 않는다', async () => {
    await openWithPremise('cron-to-queue', '크론을 큐로 옮길지');
    const d = body(await sealOn('cron-to-queue', '작업 실패가 월 1건 아래로 내려간다'))['data'] as Record<string, unknown>;
    expect(d['unsealed_decisions']).toBeUndefined();
  });

  it('고아가 없으면 아무 말도 붙지 않는다', async () => {
    const d = body(await sealOn('solo', '컷오버 다운타임이 5분 미만이다'))['data'] as Record<string, unknown>;
    expect(d['unsealed_decisions']).toBeUndefined();
  });
});

describe('귀환 화면이 죽은 기록을 덮지 않는다', () => {
  it('마감이 없어도 고아는 이름과 손잡이가 함께 나온다', async () => {
    await openWithPremise('cron-to-queue', '크론을 큐로 옮길지');
    await sealOn('other', '컷오버 다운타임이 5분 미만이다');
    const r = body(await publicCheckIn.handler({ argus_dir: dir, today_override: '2026-08-12' }));
    expect(String(r['surface'])).toContain('크론을 큐로 옮길지');
    const stuck = (r['data'] as Record<string, unknown>)['stuck_decisions'] as Array<{ id: string }>;
    expect(stuck.map((x) => x.id)).toEqual(['cron-to-queue']);
  });

  it('고아가 없으면 침묵 계약 그대로다', async () => {
    await sealOn('far-future', '컷오버 다운타임이 5분 미만이다', '2099-01-01');
    const r = body(await publicCheckIn.handler({ argus_dir: dir, today_override: '2026-08-12' }));
    expect(String(r['surface'])).not.toMatch(/전제만 있고|premises but no prediction/);
    expect((r['data'] as Record<string, unknown>)['stuck_decisions']).toBeUndefined();
  });
});
