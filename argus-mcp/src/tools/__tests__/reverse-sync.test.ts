import { describe, it, expect, afterEach, vi } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { dismiss, amend } from '../amend-dismiss.js';
import { sync } from '../sync.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * seal/settle/amend/dismiss push to the account exactly ONCE, when the write
 * happens. If that push failed — offline, or the token was added after the seal —
 * nothing retried, and argus_sync only ever looked for the OPPOSITE divergence.
 * So the account kept listing a decision the user had already settled (or
 * explicitly dismissed) as due, and the Companion Brief kept emailing it. No
 * command in the product could push a local settlement up. Now sync does.
 *
 * Every test here seals/settles with NO token (so the original push is a no-op),
 * then connects the account — exactly the "token added later" case.
 */

const D = (r: Record<string, unknown>) => r['data'] as Record<string, unknown>;

function accountReceipt(over: Record<string, unknown> = {}) {
  return {
    id: 'mcp_bet', source_title: 'bet', state: 'sealed', next_check_by: '2026-07-01',
    due: true, core_question: '', open_predicates: [{ predicate: 'conversion clears 6%', check_by: '2026-07-01' }],
    ...over,
  };
}

/** Mock BOTH sides: the receipts GET and the seal POST. Returns captured pushes. */
function connectAccount(receipts: unknown[], opts: { failPush?: boolean } = {}) {
  process.env.ARGUS_TOKEN = 'argus_pat_test';
  const pushes: Record<string, unknown>[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: unknown, init?: { body?: string }) => {
    const u = String(url);
    if (u.includes('/api/mcp/receipts')) return new Response(JSON.stringify({ ok: true, receipts }), { status: 200 });
    if (u.includes('/api/mcp/seal')) {
      pushes.push(JSON.parse(String(init?.body ?? '{}')));
      return new Response('{}', { status: opts.failPush ? 502 : 200 });
    }
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch);
  return pushes;
}

async function sealedOffline(dir: string) {
  delete process.env.ARGUS_TOKEN; // the seal's push is a no-op
  await seal.handler({
    argus_dir: dir, id: 'bet', predicate: 'conversion clears 6%',
    check_by: '2026-07-01', predicate_owner: 'user', today_override: '2026-06-01',
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ARGUS_TOKEN;
  setElicitor(null);
});

describe('argus_sync pushes local changes the account never received', () => {
  it('a settlement made offline reaches the account, so the Brief stops emailing it', async () => {
    const dir = tmpArgusDir();
    await sealedOffline(dir);
    await settle.handler({
      argus_dir: dir, id: 'bet', outcome: 'held', outcome_source: 'user_stated',
      what_happened: 'conversion landed at 7.1%', today_override: '2026-07-02',
    });

    const pushes = connectAccount([accountReceipt()]); // account still thinks it is sealed + due
    const r = body(await sync.handler({ argus_dir: dir }));

    expect(pushes).toHaveLength(1);
    expect(pushes[0]['action']).toBe('settle');
    expect(pushes[0]['id']).toBe('bet');            // the row we read, un-prefixed
    expect(pushes[0]['outcome']).toBe('held');
    expect(pushes[0]['what_happened']).toBe('conversion landed at 7.1%'); // the USER's words
    expect(D(r)['pushed_to_account']).toEqual([{ local_id: 'bet', as: 'settle' }]);
  });

  it('a dismissed decision is archived in the account, never "settled"', async () => {
    const dir = tmpArgusDir();
    await sealedOffline(dir);
    await dismiss.handler({ argus_dir: dir, id: 'bet', dismiss_reason: 'became_irrelevant', today_override: '2026-06-05' });

    const pushes = connectAccount([accountReceipt()]);
    const r = body(await sync.handler({ argus_dir: dir }));

    expect(pushes).toHaveLength(1);
    expect(pushes[0]['action']).toBe('dismiss'); // NOT a settlement — reality said nothing
    expect(D(r)['pushed_to_account']).toEqual([{ local_id: 'bet', as: 'dismiss' }]);
  });

  it('a deferred bet moves the account\'s check-by, so the email arrives on the right day', async () => {
    const dir = tmpArgusDir();
    await sealedOffline(dir);
    await settle.handler({
      argus_dir: dir, id: 'bet', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'the data lands in August', defer_to: '2026-08-01', today_override: '2026-07-02',
    });

    const pushes = connectAccount([accountReceipt()]); // account still holds 2026-07-01
    await sync.handler({ argus_dir: dir });

    expect(pushes).toHaveLength(1);
    expect(pushes[0]['action']).toBe('defer');
    expect(pushes[0]['check_by']).toBe('2026-08-01');
    expect(pushes[0]['what_happened']).toBe('the data lands in August'); // why it was pushed
  });

  it('nothing is pushed when the account already agrees', async () => {
    const dir = tmpArgusDir();
    await sealedOffline(dir);
    const pushes = connectAccount([accountReceipt()]); // both say sealed, same check-by
    await sync.handler({ argus_dir: dir });
    expect(pushes).toHaveLength(0);
  });

  it('push_local:false inspects the account without writing to it', async () => {
    const dir = tmpArgusDir();
    await sealedOffline(dir);
    await settle.handler({
      argus_dir: dir, id: 'bet', outcome: 'held', outcome_source: 'user_stated',
      what_happened: 'it did', today_override: '2026-07-02',
    });
    const pushes = connectAccount([accountReceipt()]);
    await sync.handler({ argus_dir: dir, push_local: false });
    expect(pushes).toHaveLength(0);
  });

  it('argus_dismiss tells the account right away, not only at the next sync', async () => {
    const dir = tmpArgusDir();
    await sealedOffline(dir);
    const pushes = connectAccount([]);
    await dismiss.handler({ argus_dir: dir, id: 'bet', dismiss_reason: 'changed_mind', today_override: '2026-06-05' });
    expect(pushes.map((p) => p['action'])).toEqual(['dismiss']);
  });

  it('settling still_pending and picking "set aside" pushes a dismiss to the account', async () => {
    const dir = tmpArgusDir();
    await sealedOffline(dir); // due bet, sealed at 2026-06-01 / check-by 2026-07-01
    const pushes = connectAccount([]);
    setElicitor(async () => ({ action: 'accept', content: { when: 'dismiss' } }));
    // due day, no defer_to → the picker fires; "dismiss" sets it aside.
    const r = body(await settle.handler({
      argus_dir: dir, id: 'bet', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'the feature was cut', today_override: '2026-07-02',
    }));
    expect(D(r)['status']).toBe('dismissed');
    expect(pushes.map((p) => p['action'])).toEqual(['dismiss']); // account told right away
  });

  it('argus_amend moves the account\'s check-by right away', async () => {
    const dir = tmpArgusDir();
    await sealedOffline(dir);
    const pushes = connectAccount([]);
    await amend.handler({ argus_dir: dir, id: 'bet', check_by: '2026-09-01', today_override: '2026-06-05' });
    expect(pushes).toHaveLength(1);
    expect(pushes[0]['action']).toBe('defer'); // the web's "revise": move the date in place
    expect(pushes[0]['check_by']).toBe('2026-09-01');
  });

  it('a push that fails is said out loud, not swallowed', async () => {
    const dir = tmpArgusDir();
    await sealedOffline(dir);
    await settle.handler({
      argus_dir: dir, id: 'bet', outcome: 'held', outcome_source: 'user_stated',
      what_happened: 'it did', today_override: '2026-07-02',
    });
    connectAccount([accountReceipt()], { failPush: true });
    const r = body(await sync.handler({ argus_dir: dir }));

    expect(D(r)['push_to_account_failed']).toBe(1);
    expect(String(r['surface'])).toMatch(/keep emailing|메일이 계속/);
    expect(D(r)['pushed_to_account']).toBeUndefined();
  });
});
