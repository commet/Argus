/**
 * 공정 M2 · 승격과 다리 — exit evidence (BLUEPRINT §9.5).
 *
 *  1. capture → 봉인 → 정산 승격 여정: a watch capture becomes a decision
 *     premise via from_capture (verbatim text + provenance carry over, the
 *     capture stays on the watch log), then the decision seals and settles.
 *  2. 발산 0: a judgment sealed here and settled on the WEB is mirrored into
 *     the local ledger by argus_sync import_settlements — the user's own
 *     web-recorded words, never an inferred outcome — and check_in stops
 *     re-nudging it.
 *  3. fleet: two projects' due items land in ONE check_in (global registry).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { watch } from '../watch.js';
import { premises } from '../premises.js';
import { openDecision } from '../open-decision.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { checkIn } from '../check-in.js';
import { sync } from '../sync.js';
import { init } from '../init-config.js';
import { replayLedger } from '../../lib/ledger-replay.js';

const D1 = '2026-07-08';
const ORIG_TOKEN = process.env.ARGUS_TOKEN;
afterEach(() => {
  vi.restoreAllMocks();
  if (ORIG_TOKEN === undefined) delete process.env.ARGUS_TOKEN; else process.env.ARGUS_TOKEN = ORIG_TOKEN;
});

describe('M2 · capture → 봉인 → 정산 승격 여정', () => {
  it('promotes a capture into a decision premise verbatim, then seals and settles', async () => {
    const dir = tmpArgusDir();
    const cap = body(await watch.handler({
      argus_dir: dir, op: 'capture', today_override: D1, kind: 'premise',
      text: '고객은 간편결제를 우선 원한다', source: 'user_stated',
    }));
    const cid = String((cap['data'] as Record<string, unknown>)['capture_id']);
    expect(cid).toMatch(/^wc-/);

    await openDecision.handler({
      argus_dir: dir, id: 'pay-mvp', decision: '간편결제 먼저 갈까 — 갈림길',
      stakes: 'high', reversibility: 'one_way_door', status_quo: '기존 순서 유지',
    });
    const added = body(await premises.handler({
      argus_dir: dir, id: 'pay-mvp', op: 'add',
      premises: [{ from_capture: cid, external: true, load_bearing: true }],
    }));
    expect(added['ok']).toBe(true);
    const echo = (added['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(echo[0]['text']).toBe('고객은 간편결제를 우선 원한다'); // verbatim carry-over
    expect(echo[0]['source']).toBe('user_stated');

    // the capture STAYS on the watch log — promotion is a reference, not a move
    const listed = body(await watch.handler({ argus_dir: dir, op: 'list', today_override: D1 }));
    expect(((listed['data'] as Record<string, unknown>)['captures'] as unknown[]).length).toBe(1);

    const sealed = body(await seal.handler({
      argus_dir: dir, id: 'pay-mvp', predicate: '출시 4주 안에 간편결제 사용 비중이 30%를 넘는다',
      check_by: '2027-01-01', predicate_owner: 'user',
    }));
    expect(sealed['ok']).toBe(true);
    const settled = body(await settle.handler({
      argus_dir: dir, id: 'pay-mvp', outcome: 'held', outcome_source: 'user_stated',
      what_happened: '첫 달 간편결제 비중 41%',
    }));
    expect(settled['ok']).toBe(true);
  });

  it('a captured QUESTION promotes as an open_question by default', async () => {
    const dir = tmpArgusDir();
    const cap = body(await watch.handler({
      argus_dir: dir, op: 'capture', today_override: D1, kind: 'question',
      text: '이 역할이 6개월 뒤에도 필요한가', source: 'user_stated',
    }));
    const cid = String((cap['data'] as Record<string, unknown>)['capture_id']);
    await openDecision.handler({
      argus_dir: dir, id: 'hire-q', decision: '핵심 채용 지금 할까 — 갈림길',
      stakes: 'high', reversibility: 'one_way_door', status_quo: '보류',
    });
    const added = body(await premises.handler({ argus_dir: dir, id: 'hire-q', op: 'add', premises: [{ from_capture: cid }] }));
    const echo = (added['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(echo[0]['kind']).toBe('open_question');
  });

  it('refuses an unknown capture ref loudly', async () => {
    const dir = tmpArgusDir();
    await openDecision.handler({ argus_dir: dir, id: 'x1', decision: '갈림길', stakes: 'high', reversibility: 'one_way_door', status_quo: 'stay' });
    const res = await premises.handler({ argus_dir: dir, id: 'x1', op: 'add', premises: [{ from_capture: 'wc-deadbeef' }] });
    expect(isError(res)).toBe(true);
    expect(body(res)['error_code']).toBe('CAPTURE_NOT_FOUND');
  });
});

describe('M2 · 발산 0 — 웹 정산이 로컬 판단 기록으로 돌아온다', () => {
  it('import_settlements mirrors the web-recorded outcome and check_in stops nudging', async () => {
    const dir = tmpArgusDir();
    await seal.handler({
      argus_dir: dir, id: 'web-settled', predicate: 'churn stays under 3% this quarter',
      check_by: '2026-06-30', predicate_owner: 'user', today_override: '2026-06-01',
    });
    // locally still sealed → due
    const before = body(await checkIn.handler({ argus_dir: dir, today_override: D1 }));
    expect((before['data'] as Record<string, unknown>)['due_count']).toBe(1);

    process.env.ARGUS_TOKEN = 'argus_pat_test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      receipts: [{
        id: 'mcp_web-settled', source_title: 'churn', state: 'settled', next_check_by: null,
        due: false, core_question: '', open_predicates: [],
        settled_predicates: [{ predicate: 'churn stays under 3% this quarter', outcome: 'happened', what_happened: '분기 churn 2.4%로 마감', settled_at: '2026-07-01T00:00:00.000Z' }],
      }],
    }), { status: 200 }));

    const synced = body(await sync.handler({ argus_dir: dir, import_settlements: true }));
    expect(synced['ok']).toBe(true);
    const imported = (synced['data'] as Record<string, unknown>)['imported'] as Array<Record<string, unknown>>;
    expect(imported).toHaveLength(1);
    expect(imported[0]['outcome']).toBe('held'); // web 'happened' → mcp 'held'

    // 발산 0: the local ledger now carries the user's web-stated settlement
    const ledger = replayLedger(dir, D1);
    expect(ledger.contracts.get('web-settled')?.status).toBe('settled');
    expect(ledger.contracts.get('web-settled')?.outcome).toBe('held');
    const after = body(await checkIn.handler({ argus_dir: dir, today_override: D1 }));
    expect((after['data'] as Record<string, unknown>)['due_count']).toBe(0);
  });

  it('never invents: a settled account row WITHOUT settlement words stays flag-only', async () => {
    const dir = tmpArgusDir();
    await seal.handler({
      argus_dir: dir, id: 'no-words', predicate: 'the pilot converts two customers',
      check_by: '2026-06-30', predicate_owner: 'user', today_override: '2026-06-01',
    });
    process.env.ARGUS_TOKEN = 'argus_pat_test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      receipts: [{ id: 'mcp_no-words', source_title: 'pilot', state: 'settled', next_check_by: null, due: false, core_question: '', open_predicates: [] }],
    }), { status: 200 }));
    const synced = body(await sync.handler({ argus_dir: dir, import_settlements: true }));
    expect((synced['data'] as Record<string, unknown>)['imported']).toBeUndefined();
    expect(replayLedger(dir, D1).contracts.get('no-words')?.status).toBe('sealed'); // untouched
  });
});

describe('M2 · fleet — 두 프로젝트의 due가 한 check_in에', () => {
  it('reports due counts across registered projects', async () => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-fleet-home-'));
    const spy = vi.spyOn(os, 'homedir').mockReturnValue(fakeHome);
    try {
      const dirA = tmpArgusDir();
      const dirB = tmpArgusDir();
      await init.handler({ argus_dir: dirA });
      await init.handler({ argus_dir: dirB });
      await seal.handler({ argus_dir: dirA, id: 'a1', predicate: 'project A prediction comes true', check_by: '2026-07-01', predicate_owner: 'user', today_override: '2026-06-01' });
      await seal.handler({ argus_dir: dirB, id: 'b1', predicate: 'project B prediction comes true', check_by: '2026-07-01', predicate_owner: 'user', today_override: '2026-06-01' });

      const res = body(await checkIn.handler({ argus_dir: dirA, fleet: true, today_override: D1 }));
      expect((res['data'] as Record<string, unknown>)['due_count']).toBe(1); // A's own
      const fleet = (res['data'] as Record<string, unknown>)['fleet'] as Array<Record<string, unknown>>;
      expect(fleet).toHaveLength(1); // B (A itself excluded)
      expect(fleet[0]['argus_dir']).toBe(dirB);
      expect(fleet[0]['due_count']).toBe(1);
      expect(String(res['surface'])).toContain('1'); // fleet line names the count
    } finally {
      spy.mockRestore();
    }
  });
});
