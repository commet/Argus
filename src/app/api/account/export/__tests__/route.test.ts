import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The export endpoint returns EVERY user-scoped row as a portable JSON, so its
 * auth gate must be airtight: a request without a valid Bearer token that
 * resolves to a user must never reach the admin client. We stub both clients and
 * assert the gate, plus that a valid caller only ever queries `.eq('user_id', …)`
 * for their own id.
 */

let tokenUser: { id: string; email: string; created_at: string } | null = {
  id: 'user-1', email: 'a@b.co', created_at: '2026-01-01T00:00:00Z',
};
const selectedFor: string[] = [];

function authClient() {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: tokenUser }, error: tokenUser ? null : { message: 'bad' } }) },
  };
}
function adminClient() {
  return {
    from() {
      return { select: () => ({ eq: (_col: string, val: string) => { selectedFor.push(val); return Promise.resolve({ data: [], error: null }); } }) };
    },
  };
}
vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, key: string) => (key === 'svc-key' ? adminClient() : authClient()),
}));

import { GET } from '../route';

function req(token?: string) {
  return new Request('https://argus.voyage/api/account/export', {
    method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as never;
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'svc-key');
  tokenUser = { id: 'user-1', email: 'a@b.co', created_at: '2026-01-01T00:00:00Z' };
  selectedFor.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/account/export — auth gate', () => {
  it('401s with no Authorization header', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(selectedFor).toHaveLength(0);
  });

  it('401s when the token does not resolve to a user', async () => {
    tokenUser = null;
    const res = await GET(req('bogus'));
    expect(res.status).toBe(401);
    expect(selectedFor).toHaveLength(0);
  });

  it('503s when the service role key is missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const res = await GET(req('good'));
    expect(res.status).toBe(503);
  });

  it('exports as a downloadable attachment scoped to the caller only', async () => {
    const res = await GET(req('good'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    // Every table query filtered by the authenticated user's own id.
    expect(selectedFor.length).toBeGreaterThan(0);
    expect(new Set(selectedFor)).toEqual(new Set(['user-1']));
    const json = JSON.parse(await res.text());
    expect(json.user.id).toBe('user-1');
  });
});
