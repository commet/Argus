import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Stub the admin Supabase client with a minimal chainable so the route's
 * token-resolution + review_receipts upsert can be asserted without a real DB.
 */
// seal 은 upsert 를 버리고 소유자 조건 update → miss 시 insert 로 바뀌었다
// (계정 간 행 탈취 IDOR 차단). 스파이는 "실제로 저장된 행"을 잡는다.
const upsertSpy = vi.fn(() => Promise.resolve({ error: null }));
let receiptExists = false;
const updateEqSpy = vi.fn(() => Promise.resolve({ error: null }));

function makeAdmin(tokenUserId: string | null, existingData: unknown = null) {
  return {
    from(table: string) {
      if (table === 'plugin_tokens') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: tokenUserId ? { id: 'tok1', user_id: tokenUserId } : null }) }) }),
          update: () => ({ eq: () => ({ then: (cb: (r: { error: null }) => void) => cb({ error: null }) }) }),
        };
      }
      // review_receipts
      return {
        insert: (...args: unknown[]) => { upsertSpy(...args); return Promise.resolve({ error: null }); },
        select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ single: () => Promise.resolve({ data: existingData ? { data: existingData } : null }) }) }) }) }),
        update: (...args: unknown[]) => {
          updateEqSpy(...args);
          // seal 경로: .eq('id').eq('user_id').select().maybeSingle()
          // 다른 경로(dismiss/settle): .eq().eq() 로 끝난다.
          const settle = Promise.resolve({ error: null }) as unknown as Record<string, unknown>;
          const inner = {
            eq: () => ({
              select: () => ({ maybeSingle: () => Promise.resolve({ data: receiptExists ? { id: 'r' } : null, error: null }) }),
              then: (cb: (r: { error: null }) => void) => cb({ error: null }),
            }),
            select: () => ({ maybeSingle: () => Promise.resolve({ data: receiptExists ? { id: 'r' } : null, error: null }) }),
          };
          void settle;
          return { eq: () => inner };
        },
      };
    },
  };
}

let currentAdmin = makeAdmin('user-1');
vi.mock('@/lib/share-guard', () => ({ adminClient: () => currentAdmin }));

import { POST } from '../route';

function req(body: unknown, token = 'argus_pat_test'): Request {
  return new Request('https://argus.voyage/api/mcp/seal', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  upsertSpy.mockClear();
  receiptExists = false;
  updateEqSpy.mockClear();
  currentAdmin = makeAdmin('user-1');
});

describe('POST /api/mcp/seal', () => {
  it('401s without a bearer token', async () => {
    const res = await POST(new Request('https://argus.voyage/api/mcp/seal', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }) as never);
    expect(res.status).toBe(401);
  });

  it('401s on an unknown token', async () => {
    currentAdmin = makeAdmin(null);
    const res = await POST(req({ action: 'seal', id: 'd1', predicate: 'x under 5', check_by: '2026-08-01' }) as never);
    expect(res.status).toBe(401);
  });

  it('seals: upserts a review_receipts row with next_check_by lifted for the cron', async () => {
    const res = await POST(req({ action: 'seal', id: 'd1', predicate: 'cutover under 5 min', check_by: '2026-08-01' }) as never);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, synced: true, id: 'mcp_d1' });
    const [row] = upsertSpy.mock.calls[0] as [Record<string, unknown>];
    expect(row.id).toBe('mcp_d1');
    expect(row.user_id).toBe('user-1');
    expect(row.state).toBe('sealed');
    expect(row.next_check_by).toBe('2026-08-01');
    // whole receipt in the jsonb blob, one sealed follow-up
    const data = row.data as {
      kind?: string;
      root_mode?: string;
      profile?: unknown;
      reviewability?: unknown;
      routing?: unknown;
      judgment_obligations: { owner: string }[];
      falsifiable_followups: { predicate: string; sealed_at?: string }[];
    };
    expect(data.kind).toBe('judgment');
    expect(data.root_mode).toBe('judgment');
    expect(data.profile).toBeUndefined();
    expect(data.reviewability).toBeUndefined();
    expect(data.routing).toBeUndefined();
    expect(data.falsifiable_followups[0].predicate).toBe('cutover under 5 min');
    expect(data.falsifiable_followups[0].sealed_at).toBeTruthy();
  });

  it('seals: keeps a human judgment as a user-owned judgment mirror field', async () => {
    const res = await POST(req({
      action: 'seal',
      id: 'd2',
      predicate: 'beta conversion beats 4%',
      check_by: '2026-08-10',
      human_judgment: 'Ship the beta to the finance cohort first',
    }) as never);
    expect(res.status).toBe(200);
    const [row] = upsertSpy.mock.calls[0] as [Record<string, unknown>];
    const data = row.data as { judgment_obligations: { statement: string; owner: string }[] };
    expect(data.judgment_obligations[0]).toMatchObject({
      statement: 'Ship the beta to the finance cohort first',
      owner: 'user',
    });
  });

  it('rejects a seal with no future date', async () => {
    const res = await POST(req({ action: 'seal', id: 'd1', predicate: 'x under 5', check_by: 'soon' }) as never);
    expect(res.status).toBe(400);
  });

  it('settle: no-op when the id was never synced', async () => {
    currentAdmin = makeAdmin('user-1', null);
    const res = await POST(req({ action: 'settle', id: 'd1', outcome: 'held', what_happened: 'clean' }) as never);
    const json = await res.json();
    expect(json).toEqual({ ok: true, updated: false, reason: 'not_synced' });
  });

  it('settle: patches a synced row to settled', async () => {
    currentAdmin = makeAdmin('user-1', {
      receipt_id: 'mcp_d1', state: 'sealed',
      falsifiable_followups: [{ followup_id: 'f_d1', predicate: 'p', check_by: '2026-08-01', sealed_at: '2026-07-01T00:00:00Z' }],
    });
    const res = await POST(req({ action: 'settle', id: 'd1', outcome: 'held', what_happened: 'clean cutover' }) as never);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, updated: true, state: 'settled' });
    const [patch] = updateEqSpy.mock.calls[0] as [Record<string, unknown>];
    expect(patch.state).toBe('settled');
    expect(patch.next_check_by).toBeNull();
  });

  it('settle: preserves missed instead of falling back to unclear', async () => {
    currentAdmin = makeAdmin('user-1', {
      receipt_id: 'mcp_d1', state: 'sealed',
      falsifiable_followups: [{ followup_id: 'f_d1', predicate: 'p', check_by: '2026-08-01', sealed_at: '2026-07-01T00:00:00Z' }],
    });
    const res = await POST(req({ action: 'settle', id: 'd1', outcome: 'missed', what_happened: 'my read was wrong' }) as never);
    expect(res.status).toBe(200);
    const [patch] = updateEqSpy.mock.calls[0] as [Record<string, unknown>];
    const data = patch.data as { falsifiable_followups: Array<{ outcome?: string; what_happened?: string }> };
    expect(data.falsifiable_followups[0].outcome).toBe('missed');
    expect(data.falsifiable_followups[0].outcome).not.toBe('unclear');
  });

  // ── The bridge's other three verbs. argus-mcp's pushToAccount() sends exactly
  //    these bodies (SettlePush | DeferPush | DismissPush in push-account.ts).
  //    Until now the MCP mocked `fetch` and the route was never asked to honour
  //    defer or dismiss at all — so a settle that failed, or a decision the user
  //    killed, left the account nudging forever.

  const synced = () => makeAdmin('user-1', {
    receipt_id: 'mcp_d1', state: 'sealed',
    falsifiable_followups: [{ followup_id: 'f_d1', predicate: 'p', check_by: '2026-08-01', sealed_at: '2026-07-01T00:00:00Z' }],
  });
  const patch = () => updateEqSpy.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
  const followup = () => (patch()!.data as { falsifiable_followups: Array<Record<string, unknown>> }).falsifiable_followups[0];

  it('settle: a still_pending is REFUSED — reality answering nothing is not a settlement', async () => {
    currentAdmin = synced();
    const res = await POST(req({ action: 'settle', id: 'd1', outcome: 'still_pending', what_happened: 'too early' }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ updated: false, reason: 'not_a_settlement' });
    expect(updateEqSpy).not.toHaveBeenCalled(); // the row was NOT closed
  });

  it('settle: an unknown or prototype outcome is a 400, never a silent "unclear" close', async () => {
    for (const outcome of ['sortof', 'constructor', '__proto__', 'toString']) {
      updateEqSpy.mockClear();
      currentAdmin = synced();
      const res = await POST(req({ action: 'settle', id: 'd1', outcome, what_happened: 'x' }) as never);
      expect(res.status, outcome).toBe(400);
      expect(updateEqSpy, outcome).not.toHaveBeenCalled();
    }
  });

  it('defer: moves the check-by in place and keeps the row alive and nudged', async () => {
    currentAdmin = synced();
    const res = await POST(req({ action: 'defer', id: 'd1', check_by: '2026-09-01', what_happened: 'data lands in September' }) as never);
    expect(res.status).toBe(200);
    expect(patch()!.state).toBe('sealed');            // still selected by the Brief cron
    expect(patch()!.next_check_by).toBe('2026-09-01');
    expect(followup().check_by).toBe('2026-09-01');
    expect(followup().settled_at).toBeUndefined();    // nothing was settled
    expect(followup().outcome).toBeUndefined();
    expect(followup().revise_count).toBe(1);
    expect(followup().first_check_by).toBe('2026-08-01'); // the original date, kept as a fact
    expect(followup().defer_reason).toBe('data lands in September');
  });

  it('defer: a missing date is refused rather than guessed', async () => {
    currentAdmin = synced();
    const res = await POST(req({ action: 'defer', id: 'd1' }) as never);
    expect(res.status).toBe(400);
    expect(updateEqSpy).not.toHaveBeenCalled();
  });

  it('dismiss: archives the row so the Brief stops, and never claims a settlement', async () => {
    currentAdmin = synced();
    const res = await POST(req({ action: 'dismiss', id: 'd1' }) as never);
    expect(res.status).toBe(200);
    expect(patch()!.state).toBe('archived');           // NOT 'settled' — reality said nothing
    expect(patch()!.next_check_by).toBeNull();
    expect(followup().settled_at).toBeUndefined();
    expect(followup().outcome).toBeUndefined();
  });

  it('defer/dismiss: an honest no-op when the id was never synced', async () => {
    for (const body of [{ action: 'defer', id: 'd1', check_by: '2026-09-01' }, { action: 'dismiss', id: 'd1' }]) {
      currentAdmin = makeAdmin('user-1', null);
      const res = await POST(req(body) as never);
      expect(await res.json()).toMatchObject({ ok: true, updated: false, reason: 'not_synced' });
    }
  });
});
