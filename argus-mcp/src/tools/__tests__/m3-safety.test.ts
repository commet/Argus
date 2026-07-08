/**
 * 공정 M3 · 전제 개통 + 두 기기 안전 — exit evidence (BLUEPRINT §9.5).
 *
 *  1. BS-1: two ledgers sealing the SAME natural slug push DIFFERENT account
 *     ids (per-ledger install namespace) — collision 0. Reverse mapping only
 *     claims rows that are ours (legacy or our namespace), never another
 *     ledger's.
 *  2. 동시 이중 settle: two concurrent settles record exactly ONE settlement
 *     (the ledger lock re-guards under the lock; the loser gets
 *     ALREADY_SETTLED). Calibration never double-counts.
 *  3. 전제 opt-in: monitored premises ride the seal push ONLY when the user
 *     set premise_sync:true — the default push carries none (§9.2-4 자동
 *     업로드 금지).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { openDecision } from '../open-decision.js';
import { premises } from '../premises.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { config } from '../init-config.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { ledgerInstallId, accountPushId, localIdFromAccountId } from '../../lib/install-id.js';

const ORIG_TOKEN = process.env.ARGUS_TOKEN;
afterEach(() => {
  vi.restoreAllMocks();
  if (ORIG_TOKEN === undefined) delete process.env.ARGUS_TOKEN; else process.env.ARGUS_TOKEN = ORIG_TOKEN;
});

function mockPushCapture(): Array<Record<string, unknown>> {
  const bodies: Array<Record<string, unknown>> = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    if (init?.body) bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return new Response('{}', { status: 200 });
  });
  return bodies;
}

describe('M3 · BS-1 — 두 원장, 같은 slug, 계정 충돌 0', () => {
  it('namespaces the account id per ledger and reverse-maps only what is ours', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_test';
    const bodies = mockPushCapture();
    const dirA = tmpArgusDir();
    const dirB = tmpArgusDir();

    for (const dir of [dirA, dirB]) {
      await seal.handler({
        argus_dir: dir, id: 'migrate-db', predicate: 'cutover downtime stays under 5 minutes',
        check_by: '2027-01-01', predicate_owner: 'user',
      });
    }
    const pushedIds = bodies.map((b) => String(b['id']));
    expect(pushedIds).toHaveLength(2);
    expect(pushedIds[0]).not.toBe(pushedIds[1]); // the collision BS-1 names, gone
    expect(pushedIds[0]).toBe(`${ledgerInstallId(dirA)}_migrate-db`);
    expect(pushedIds[1]).toBe(`${ledgerInstallId(dirB)}_migrate-db`);

    // reverse mapping: ours → slug; another ledger's → null; legacy → slug
    expect(localIdFromAccountId(dirA, `mcp_${accountPushId(dirA, 'migrate-db')}`)).toBe('migrate-db');
    expect(localIdFromAccountId(dirA, `mcp_${accountPushId(dirB, 'migrate-db')}`)).toBe(null);
    expect(localIdFromAccountId(dirA, 'mcp_migrate-db')).toBe('migrate-db');
  });

  it('the install id is stable across reads', () => {
    const dir = tmpArgusDir();
    expect(ledgerInstallId(dir)).toBe(ledgerInstallId(dir));
    expect(ledgerInstallId(dir)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('M3 · 동시 이중 settle — 한 건만 기록된다', () => {
  it('two concurrent settles: one ok, one ALREADY_SETTLED, total_settled === 1', async () => {
    const dir = tmpArgusDir();
    await seal.handler({
      argus_dir: dir, id: 'race-1', predicate: 'the pilot converts two customers',
      check_by: '2026-06-30', predicate_owner: 'user', today_override: '2026-06-01',
    });
    const args = {
      argus_dir: dir, id: 'race-1', outcome: 'held' as const, outcome_source: 'user_stated' as const,
      what_happened: 'two pilots converted', today_override: '2026-07-08',
    };
    const [r1, r2] = await Promise.all([settle.handler(args), settle.handler(args)]);
    const oks = [r1, r2].filter((r) => !isError(r));
    const errs = [r1, r2].filter((r) => isError(r));
    expect(oks).toHaveLength(1);
    expect(errs).toHaveLength(1);
    expect(body(errs[0])['error_code']).toBe('ALREADY_SETTLED');
    expect(replayLedger(dir, '2026-07-08').stats.total_settled).toBe(1);
  });
});

describe('M3 · 전제 opt-in — 스위치 없이는 한 건도 안 나간다', () => {
  async function sealWithMonitoredPremise(dir: string, id: string) {
    await openDecision.handler({
      argus_dir: dir, id, decision: '조달 시점 — 갈림길', stakes: 'high',
      reversibility: 'one_way_door', status_quo: '보류',
    });
    await premises.handler({
      argus_dir: dir, id, op: 'add',
      premises: [{ text: '기준금리가 3.5% 근처에 머문다', source: 'user_stated', external: true, load_bearing: true }],
    });
    return seal.handler({
      argus_dir: dir, id, predicate: '분기 안에 조달 조건이 유지된다',
      check_by: '2027-01-01', predicate_owner: 'user',
    });
  }

  it('default (no opt-in): the seal push carries NO premises', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_test';
    const bodies = mockPushCapture();
    const dir = tmpArgusDir();
    await sealWithMonitoredPremise(dir, 'fund-timing');
    expect(bodies).toHaveLength(1);
    expect(bodies[0]['tracked_premises']).toBeUndefined();
  });

  it('premise_sync:true: monitored premises ride along, verbatim', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_test';
    const bodies = mockPushCapture();
    const dir = tmpArgusDir();
    await config.handler({ argus_dir: dir, premise_sync: true });
    await sealWithMonitoredPremise(dir, 'fund-timing');
    const sealPush = bodies.find((b) => b['action'] === 'seal')!;
    const tp = sealPush['tracked_premises'] as Array<Record<string, unknown>>;
    expect(tp).toHaveLength(1);
    expect(tp[0]['text']).toBe('기준금리가 3.5% 근처에 머문다');
    expect(tp[0]['external']).toBe(true);
    expect(tp[0]['load_bearing']).toBe(true);
  });
});
