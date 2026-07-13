import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { sync } from '../sync.js';
import { checkIn, resetCheckInSession } from '../check-in.js';
import { settle } from '../settle.js';
import { guardTransition, GuardError } from '../../lib/state-machine.js';
import { appendLedger } from '../../lib/ledger-append.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { ledgerPath } from '../../lib/layout.js';

/**
 * Hardening pass: every case here is a bug that shipped, was found by an audit,
 * and would have silently broken a real user's record or nagged them forever.
 */

const D = (r: Record<string, unknown>) => r['data'] as Record<string, unknown>;

function accountReceipt(over: Record<string, unknown> = {}) {
  return {
    id: 'mcp_web-x', source_title: 'x', state: 'settled', next_check_by: null,
    due: false, core_question: '', open_predicates: [],
    ...over,
  };
}
function mockAccount(receipts: unknown[]) {
  process.env.ARGUS_TOKEN = 'argus_pat_test';
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok: true, receipts }), { status: 200 }),
  );
}
async function sealedLocally(dir: string, id = 'web-x') {
  await seal.handler({
    argus_dir: dir, id, predicate: 'churn stays under 3% this quarter',
    check_by: '2026-06-30', predicate_owner: 'user', today_override: '2026-06-01',
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ARGUS_TOKEN;
});
beforeEach(() => resetCheckInSession());

describe('argus_sync · the account is a network trust boundary', () => {
  it('a web "unclear" is NOT imported as a settlement — the bet stays alive and due', async () => {
    const dir = tmpArgusDir();
    await sealedLocally(dir);
    mockAccount([accountReceipt({
      settled_predicates: [{ predicate: 'churn', outcome: 'unclear', what_happened: '아직 데이터가 없다' }],
    })]);

    const r = body(await sync.handler({ argus_dir: dir, import_settlements: true }));
    expect(D(r)['imported']).toBeUndefined();                 // nothing imported
    expect(String(r['surface'])).toMatch(/unclear|불분명/);     // and it is named honestly
    // the local record is untouched: still sealed, still due
    const c = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-02' }));
    expect(D(c)['due_count']).toBe(1);
  });

  it('a web "unclear" with NO words is still classified as unresolved, not "settled on web"', async () => {
    const dir = tmpArgusDir();
    await sealedLocally(dir);
    // outcome unclear, but what_happened empty — safeRemoteSettlement() returns
    // null here, so classification must read the raw outcome, not the sanitized one.
    mockAccount([accountReceipt({ state: 'settled', settled_predicates: [{ predicate: 'churn', outcome: 'unclear', what_happened: '' }] })]);
    const r = body(await sync.handler({ argus_dir: dir, import_settlements: true }));
    expect(String(r['surface'])).toMatch(/unclear|불분명/);            // named as unresolved
    expect(String(r['surface'])).not.toMatch(/already settled on the web|웹에서 이미 정산/); // NOT miscounted
    const row = (D(r)['receipts'] as Array<Record<string, unknown>>)[0];
    expect(row['unresolved_in_account']).toBe(true);
    expect(row['settled_in_account']).toBeUndefined();
  });

  it('a prototype key ("constructor") from the account cannot close a decision', async () => {
    const dir = tmpArgusDir();
    await sealedLocally(dir);
    mockAccount([accountReceipt({
      settled_predicates: [{ predicate: 'churn', outcome: 'constructor', what_happened: 'pwned' }],
    })]);

    const r = body(await sync.handler({ argus_dir: dir, import_settlements: true }));
    expect(D(r)['imported']).toBeUndefined();
    const c = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-02' }));
    expect(D(c)['due_count']).toBe(1); // NOT terminally settled
  });

  it('remote text is length-capped and control-stripped, and a forged ts is ignored', async () => {
    const dir = tmpArgusDir();
    await sealedLocally(dir);
    const nasty = 'a'.repeat(900) + String.fromCharCode(7);
    mockAccount([accountReceipt({
      settled_predicates: [{ predicate: 'churn', outcome: 'happened', what_happened: nasty, settled_at: 'not-a-timestamp' }],
    })]);

    const r = body(await sync.handler({ argus_dir: dir, import_settlements: true }));
    const imported = D(r)['imported'] as Array<Record<string, unknown>>;
    expect(imported).toHaveLength(1);
    const line = fs.readFileSync(ledgerPath(dir), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).pop();
    expect(String(line.decision).length).toBeLessThanOrEqual(600);   // capped like argus_settle
    expect(String(line.decision)).not.toContain(String.fromCharCode(7)); // control char stripped
    expect(String(line.ts)).toMatch(/^\d{4}-\d{2}-\d{2}T/);          // forged ts rejected, ours used
  });

  it('two account rows mapping to one local id settle it exactly once (no double-count)', async () => {
    const dir = tmpArgusDir();
    await sealedLocally(dir);
    const sp = [{ predicate: 'churn', outcome: 'happened', what_happened: 'churn 2.4%' }];
    // a legacy row and a namespaced row can both resolve to the same local id
    mockAccount([accountReceipt({ id: 'mcp_web-x', settled_predicates: sp }), accountReceipt({ id: 'mcp_web-x', settled_predicates: sp })]);

    const r = body(await sync.handler({ argus_dir: dir, import_settlements: true }));
    expect((D(r)['imported'] as unknown[]).length).toBe(1); // the guard refuses the second
    const settles = fs.readFileSync(ledgerPath(dir), 'utf8').split('\n').filter(Boolean)
      .map((l) => JSON.parse(l)).filter((e) => e.event === 'settle');
    expect(settles).toHaveLength(1);
    expect(replayLedger(dir, '2026-07-02').stats.total_settled).toBe(1);
  });

  it('declares that it writes (readOnlyHint must not lie)', () => {
    expect(sync.annotations?.readOnlyHint).toBe(false);
  });
});

describe('state machine · a refusal must name a move that works', () => {
  it('re-sealing a sealed decision does NOT send the caller back to argus_open_decision', () => {
    for (const state of ['sealed', 'due'] as const) {
      try {
        guardTransition(state, 'seal');
        throw new Error('should have thrown');
      } catch (e) {
        const g = e as GuardError;
        expect(g.code).toBe('ILLEGAL_TRANSITION');
        // the old advice looped forever: opening cannot un-seal an append-only ledger
        expect(g.recovery).not.toMatch(/argus_open_decision/);
        expect(g.recovery).toMatch(state === 'due' ? /argus_resolve/ : /argus_capture/);
      }
    }
  });

  it('amend/dismiss on an unknown id gets a recovery instead of silence', () => {
    for (const ev of ['amend', 'dismiss'] as const) {
      try { guardTransition('absent', ev); } catch (e) {
        expect((e as GuardError).recovery).toBeTruthy();
      }
    }
  });
});

describe('ledger durability', () => {
  it('a torn tail costs its own line, never the next event', async () => {
    const dir = tmpArgusDir();
    await sealedLocally(dir, 'a1');
    // simulate a crash mid-append: a truncated line with no trailing newline
    fs.appendFileSync(ledgerPath(dir), '{"v":1,"id":"a1","event":"set');

    await appendLedger(dir, [{ id: 'a1', event: 'settle', outcome: 'held', decision: 'it did' }], '2026-07-02T12:00:00.000Z');

    const l = replayLedger(dir, '2026-07-02');
    expect(l.integrity.dropped_lines).toBe(1);      // the torn line, disclosed
    expect(l.contracts.get('a1')?.status).toBe('settled'); // and the settle SURVIVED
  });

  it('re-capturing the same watch note twice leaves one capture (promotable)', async () => {
    const dir = tmpArgusDir();
    const ev = { id: 'w', event: 'watch_capture' as const, capture_id: 'wc-dupe', kind: 'claim', text: 'the vendor is stable', source: 'user_stated', anchor_date: '2026-07-01' };
    await appendLedger(dir, [ev], '2026-07-01T12:00:00.000Z');
    await appendLedger(dir, [ev], '2026-07-01T12:00:00.000Z');
    expect(replayLedger(dir, '2026-07-02').watch.captures).toHaveLength(1);
  });
});

describe('check_in · the anchor mirror cannot nag forever', () => {
  const anchor = async (dir: string, date: string) =>
    appendLedger(dir, [{ id: 'w', event: 'watch_anchor', text: 'ship the settlement screen', anchor_date: date }], `${date}T12:00:00.000Z`);

  it('mirrors yesterday once per session, not on every call', async () => {
    const dir = tmpArgusDir();
    await anchor(dir, '2026-07-01');
    const first = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-02' }));
    expect(String(first['surface'])).toContain('ship the settlement screen');
    const second = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-02' }));
    expect(String(second['surface'])).not.toContain('ship the settlement screen');
  });

  it('never re-asks about a stale anchor the user can no longer close', async () => {
    const dir = tmpArgusDir();
    await anchor(dir, '2026-06-01'); // 40 days old
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-07-10' }));
    expect(String(r['surface'])).not.toContain('ship the settlement screen');
    // the anchor is still a FACT in data — only the question is bounded
    expect(((D(r)['watch'] as Record<string, unknown>)['last_anchor'] as Record<string, unknown>)['date']).toBe('2026-06-01');
  });
});

describe('check_in · a deferred bet returns with the reason it was deferred', () => {
  it('surfaces the user\'s own words for why reality had not answered', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'p', predicate: 'the paywall lifts conversion above 6%', check_by: '2026-07-01', predicate_owner: 'user', today_override: '2026-06-01' });
    await settle.handler({
      argus_dir: dir, id: 'p', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'the trial data does not land until August', defer_to: '2026-08-01', today_override: '2026-07-02',
    });
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-08-02' }));
    const due = (D(r)['due'] as Array<Record<string, unknown>>)[0];
    expect(due['deferred_times']).toBe(1);
    expect(due['deferred_because']).toBe('the trial data does not land until August');
  });
});
