import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Stub the admin Supabase client with a minimal chainable so the route's
 * token-resolution + review_receipts upsert can be asserted without a real DB.
 */
const upsertSpy = vi.fn(() => Promise.resolve({ error: null }));
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
        upsert: (...args: unknown[]) => { upsertSpy(...args); return Promise.resolve({ error: null }); },
        select: () => ({ eq: () => ({ eq: () => ({ is: () => ({ single: () => Promise.resolve({ data: existingData ? { data: existingData } : null }) }) }) }) }),
        update: (...args: unknown[]) => { updateEqSpy(...args); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }; },
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
    const data = row.data as { falsifiable_followups: { predicate: string; sealed_at?: string }[] };
    expect(data.falsifiable_followups[0].predicate).toBe('cutover under 5 min');
    expect(data.falsifiable_followups[0].sealed_at).toBeTruthy();
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
});
