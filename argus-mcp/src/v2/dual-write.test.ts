/**
 * P1 수술 2단계 검증 — 실제 argus_seal/argus_settle 툴 핸들러가 v1 원장을
 * 정본으로 유지하면서 v2 내구 원장에도 같은 사건을 남기는지, 끝에서 끝까지.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../tools/init-config.js';
import { seal } from '../tools/seal.js';
import { settle } from '../tools/settle.js';
import { amend, dismiss } from '../tools/amend-dismiss.js';
import { checkIn } from '../tools/check-in.js';
import { loadState } from './reducer.js';
import { mapSealProvenance } from './mirror.js';

let home: string;
let repoDir: string;
let argusDir: string;
let savedHome: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-dw-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-dw-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  argusDir = path.join(repoDir, '.argus');
  // v2 관찰 채널은 1.4.0부터 ARGUS_V2_DEBUG=1 옵트인 (교차-프로젝트 노출 차단).
  process.env['ARGUS_V2_DEBUG'] = '1';
  savedHome = process.env['ARGUS_HOME'];
  process.env['ARGUS_HOME'] = home;
});
afterEach(() => {
  if (savedHome === undefined) delete process.env['ARGUS_HOME'];
  else process.env['ARGUS_HOME'] = savedHome;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

interface ToolData { [k: string]: unknown; v2_write?: { written: boolean; repository_id?: string; reason?: string; error?: string } }
async function call(tool: { handler: (a: Record<string, unknown>) => Promise<unknown> }, args: Record<string, unknown>): Promise<ToolData> {
  const res = (await tool.handler(args)) as { structuredContent: { ok: boolean; data: ToolData; message?: string } };
  expect(res.structuredContent.ok, JSON.stringify(res.structuredContent)).toBe(true);
  return res.structuredContent.data;
}

describe('argus_seal/settle → v2 dual-write (v1 정본 유지)', () => {
  it('seal lands in BOTH ledgers; settle closes the decision in both', async () => {
    await call(init, { argus_dir: argusDir });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'dw-1',
      predicate: 'cutover downtime < 5 min', check_by: '2099-01-01',
      predicate_owner: 'user', basis: 'judgment',
    });
    expect(sealed.v2_write).toMatchObject({ written: true });
    // v1 원장 (정본) — 그대로
    expect(fs.readFileSync(path.join(argusDir, 'ledger', 'ledger.jsonl'), 'utf8')).toContain('"seal"');
    // v2 내구 원장 — 같은 사건, 하향 provenance
    const repoId = sealed.v2_write!.repository_id!;
    const afterSeal = loadState(home, repoId);
    expect(afterSeal.decisions.get('dw-1')?.state).toBe('sealed');
    expect(afterSeal.decisions.get('dw-1')?.predicate?.provenance).toBe('host_reported'); // elicit 없는 'user'

    const settled = await call(settle, {
      argus_dir: argusDir, id: 'dw-1', outcome: 'held', what_happened: 'downtime 3m 40s',
    });
    expect(settled.v2_write).toMatchObject({ written: true });
    expect(loadState(home, repoId).decisions.get('dw-1')?.state).toBe('settled');
    expect(loadState(home, repoId).anomalies).toEqual([]);
  });

  it('without argus_init binding: v1 seal succeeds, v2_write declines with the init pointer', async () => {
    // init 없이 바로 seal — v1은 그대로 성공해야 한다 (파괴 없는 추가).
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'dw-2',
      predicate: 'works without v2 binding', check_by: '2099-01-01',
      predicate_owner: 'ai_surfaced',
    });
    expect(sealed['status']).toBe('sealed'); // v1 무영향
    expect(sealed.v2_write?.written).toBe(false);
    expect(sealed.v2_write?.reason).toMatch(/argus_settings/); // 침묵이 아니라 공개 수리 손잡이
  });

  it('amend/dismiss도 양쪽 원장에 착지한다 (같은 dual-write 패턴)', async () => {
    await call(init, { argus_dir: argusDir });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'dw-3',
      predicate: 'first predicate here', check_by: '2099-01-01', predicate_owner: 'user',
    });
    const repoId = sealed.v2_write!.repository_id!;

    const amended = await call(amend, { argus_dir: argusDir, id: 'dw-3', check_by: '2099-06-01' });
    expect(amended.v2_write).toMatchObject({ written: true });
    expect(loadState(home, repoId).decisions.get('dw-3')?.check_by?.value).toBe('2099-06-01');

    await call(seal, {
      argus_dir: argusDir, id: 'dw-4',
      predicate: 'second predicate here', check_by: '2099-01-01', predicate_owner: 'ai_surfaced',
    });
    const dismissed = await call(dismiss, {
      argus_dir: argusDir, id: 'dw-4', dismiss_reason: 'decided_elsewhere', note: '웹에서 결정함',
    });
    expect(dismissed.v2_write).toMatchObject({ written: true });
    const s = loadState(home, repoId);
    expect(s.decisions.get('dw-4')?.state).toBe('dismissed');
    expect(s.anomalies).toEqual([]);
  });

  it('still_pending defer(재무장)도 v2에 amend로 미러된다 — 재검토 발견 결함의 회귀 방지', async () => {
    await call(init, { argus_dir: argusDir });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'dw-5',
      predicate: 'data lands by friday', check_by: '2026-07-11',
      predicate_owner: 'user', today_override: '2026-07-10', // 봉인은 전날 — check_by는 미래여야
    });
    const repoId = sealed.v2_write!.repository_id!;
    const deferred = await call(settle, {
      argus_dir: argusDir, id: 'dw-5', outcome: 'still_pending',
      what_happened: '데이터가 아직 안 옴', defer_to: '2026-07-25', today_override: '2026-07-11', // due 당일 재무장
    });
    expect(deferred['status']).toBe('sealed'); // v1: 재무장, 정산 아님
    expect(deferred.v2_write).toMatchObject({ written: true });
    const d = loadState(home, repoId).decisions.get('dw-5')!;
    expect(d.state).toBe('sealed'); // v2도 살아있고
    expect(d.check_by?.value).toBe('2026-07-25'); // 새 확인일로 발산 없이 동행
  });

  it('cross-session retry with the same caller key dedupes instead of conflicting (payloadHash = 도메인만)', async () => {
    await call(init, { argus_dir: argusDir });
    const sealed6 = await call(seal, {
      argus_dir: argusDir, id: 'dw-6', predicate: 'same payload twice ok', check_by: '2099-01-01', predicate_owner: 'user',
    });
    expect(sealed6.v2_write, JSON.stringify(sealed6.v2_write)).toMatchObject({ written: true });
    // 같은 도메인 내용의 재시도 — v1 가드(ALREADY_SEALED)에 막히기 전에 v2를 직접 재현:
    // dual-write와 같은 키·같은 도메인 payload지만 세션/날짜가 다른 이벤트.
    const { appendEventGuarded } = await import('./reducer.js');
    const initData = await call(init, { argus_dir: argusDir });
    const repoId = (initData['v2'] as { repository_id: string }).repository_id;
    const prior = loadState(home, repoId);
    const original = [...prior.idempotency.values()].find((v) => v.event.event === 'seal' && (v.event as { decision_id?: string }).decision_id === 'dw-6')!.event;
    const retry = appendEventGuarded(home, repoId, {
      ...original,
      event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4G6H', // 다른 id
      occurred_at: '2026-08-01T00:00:00Z',    // 다른 시각
      session_id: 'another-session',            // 다른 세션
      logical_date: '2026-08-01',               // 다른 날
    });
    expect(retry.appended).toBe(false); // duplicate — CONFLICT가 아니다
  });

  it('A→B→A amend가 v2에서 조용히 증발하지 않는다 (적대 리뷰 F1 회귀 방지)', async () => {
    await call(init, { argus_dir: argusDir });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'dw-7', predicate: 'goes back and forth ok', check_by: '2099-01-01', predicate_owner: 'user',
    });
    const repoId = sealed.v2_write!.repository_id!;
    for (const to of ['2099-08-01', '2099-09-01', '2099-08-01']) { // 마지막이 첫 값으로 회귀
      const r = await call(amend, { argus_dir: argusDir, id: 'dw-7', check_by: to });
      expect(r.v2_write, JSON.stringify(r.v2_write)).toMatchObject({ written: true });
    }
    const s = loadState(home, repoId);
    expect(s.decisions.get('dw-7')?.check_by?.value).toBe('2099-08-01'); // v1과 동행 — 발산 없음
    expect(s.anomalies).toEqual([]);
  });

  it('pre-binding 결정의 정산 후 재init해도 anomaly가 생기지 않는다 (F2 회귀 방지)', async () => {
    // 바인딩 전의 v1 역사: old-1이 이미 봉인돼 있었다.
    const v1src = path.join(argusDir, 'ledger', 'ledger.jsonl');
    fs.mkdirSync(path.dirname(v1src), { recursive: true });
    fs.writeFileSync(v1src, [
      JSON.stringify({ v: 1, ts: '2026-06-01T00:00:00Z', id: 'old-1', event: 'harvest', decision: '옛 결정' }),
      JSON.stringify({ v: 1, ts: '2026-06-01T00:01:00Z', id: 'old-1', event: 'seal', predicate: '옛 예측 12345678', check_by: '2026-07-01' }),
    ].join('\n') + '\n');
    const initData = await call(init, { argus_dir: argusDir }); // 바인딩 + 스냅샷 이전(경계 고정)
    const repoId = (initData['v2'] as { repository_id: string }).repository_id;

    const settled = await call(settle, { argus_dir: argusDir, id: 'old-1', outcome: 'held', what_happened: '그렇게 됨' });
    expect(settled.v2_write).toMatchObject({ written: true }); // v1이 공급한 봉인 위에 v2 정산

    await call(init, { argus_dir: argusDir }); // 재init — marker가 재이전을 막는다
    const s = loadState(home, repoId);
    expect(s.decisions.get('old-1')?.state).toBe('settled');
    expect(s.anomalies).toEqual([]); // 이중 fold 없음 — 정직성 채널 오염 없음
    // 재init 보고도 정직해야: 스냅샷은 already_migrated (재복사 아님)
    const again = await call(init, { argus_dir: argusDir });
    const mig = (again['v2'] as { v1_migration: Array<{ source: string; action: string }> }).v1_migration;
    expect(mig.find((m) => m.source === v1src)?.action).toBe('already_migrated');
  });

  it('premises·watch도 관문이 자동 미러한다 (툴별 배선 불요 — 근본 수리 2의 증명)', async () => {
    await call(init, { argus_dir: argusDir });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'dw-8', predicate: 'premises ride along', check_by: '2099-01-01', predicate_owner: 'user',
      unverified_assumption: '이 전제는 자동으로 미러된다',
    });
    const repoId = sealed.v2_write!.repository_id!;
    const s = loadState(home, repoId);
    // seal이 승격한 전제(premise_add)가 아무 배선 없이 v2에 도착했다.
    expect(s.premises.size).toBe(1);
    expect([...s.premises.values()][0].text.value).toBe('이 전제는 자동으로 미러된다');
    expect(s.anomalies).toEqual([]);
  });

  it('check_in이 v2 BriefState를 병기한다 — surface 무접촉 관찰 채널 (P2-3)', async () => {
    await call(init, { argus_dir: argusDir });
    await call(seal, {
      argus_dir: argusDir, id: 'dw-9', predicate: 'v2 brief rides along', check_by: '2026-07-11',
      predicate_owner: 'user', today_override: '2026-07-10',
    });
    const data = await call(checkIn, { argus_dir: argusDir, today_override: '2026-07-11' });
    const v2 = data['v2_brief'] as { available: boolean; brief?: { due: Array<{ decision_id: string }>; logical_date: string } };
    expect(v2.available).toBe(true);
    expect(v2.brief!.logical_date).toBe('2026-07-11');
    expect(v2.brief!.due.map((d) => d.decision_id)).toEqual(['dw-9']); // v1 due와 같은 답

    // 미바인딩 리포: 정직한 사유, check_in은 그대로 성공.
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-dw-bare-'));
    try {
      const bareData = await call(checkIn, { argus_dir: path.join(bare, '.argus') });
      expect((bareData['v2_brief'] as { available: boolean }).available).toBe(false);
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });

  it('mapSealProvenance: elicit Keep만 elicited_user, 나머지는 위로 위조 금지', () => {
    expect(mapSealProvenance('user', true)).toBe('elicited_user');
    expect(mapSealProvenance('user', false)).toBe('host_reported');
    expect(mapSealProvenance('ai_surfaced', false)).toBe('ai_surfaced');
    expect(mapSealProvenance(undefined, false)).toBe('host_reported');
  });
});
