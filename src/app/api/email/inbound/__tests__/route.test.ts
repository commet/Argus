import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The inbound-email webhook is authenticated by a shared secret (header or
 * bearer) and then keys off a reply-token parsed out of the To address. These
 * tests cover the secret gate, the token-extraction/validation branches, and the
 * TTL (410) path — all without a DB. The admin client is stubbed and its return
 * value is swapped per test to drive the tracked-message lookup.
 */

const SECRET = 'inbound-secret';
let trackedRow: { session_id: string; worker_id: string; expires_at: string | null } | null = null;

function admin() {
  return {
    from() {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ single: () => Promise.resolve({ data: trackedRow }) }) }) }) }) }),
        update: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { session_id: trackedRow?.session_id } }) }) }) }) }), then: (cb: (r: { error: null }) => void) => cb({ error: null }) }),
      };
    },
    rpc: () => Promise.resolve({ error: null }),
  };
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => admin() }));

import { POST } from '../route';

function req(body: unknown, opts: { secret?: string; bearer?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.secret !== undefined) headers['x-webhook-secret'] = opts.secret;
  if (opts.bearer !== undefined) headers['authorization'] = `Bearer ${opts.bearer}`;
  return new Request('https://argus.voyage/api/email/inbound', {
    method: 'POST', headers, body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.stubEnv('EMAIL_INBOUND_SECRET', SECRET);
  trackedRow = null;
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/email/inbound — secret gate + token parsing', () => {
  it('500s when the server has no EMAIL_INBOUND_SECRET configured', async () => {
    vi.stubEnv('EMAIL_INBOUND_SECRET', '');
    const res = await POST(req({ to: 'reply+abc@argus.voyage', text: 'hi' }, { secret: 'anything' }));
    expect(res.status).toBe(500);
  });

  it('401s when neither the header secret nor the bearer matches', async () => {
    const res = await POST(req({ to: 'reply+abc@argus.voyage', text: 'hi' }, { secret: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('accepts the secret via the x-webhook-secret header', async () => {
    trackedRow = { session_id: 's1', worker_id: 'w1', expires_at: null };
    const res = await POST(req({ to: 'reply+abc@argus.voyage', text: 'my answer' }, { secret: SECRET }));
    expect(res.status).toBe(200);
  });

  it('accepts the secret via the Authorization bearer form', async () => {
    trackedRow = { session_id: 's1', worker_id: 'w1', expires_at: null };
    const res = await POST(req({ to: 'reply+abc@argus.voyage', text: 'my answer' }, { bearer: SECRET }));
    expect(res.status).toBe(200);
  });

  it('400s when the To address carries no reply token', async () => {
    const res = await POST(req({ to: 'hello@argus.voyage', text: 'hi' }, { secret: SECRET }));
    expect(res.status).toBe(400);
  });

  it('400s when the stripped reply body is empty', async () => {
    const res = await POST(req({ to: 'reply+abc@argus.voyage', text: '' }, { secret: SECRET }));
    expect(res.status).toBe(400);
  });

  it('404s when the reply token matches no tracked message', async () => {
    trackedRow = null;
    const res = await POST(req({ to: 'reply+ghost@argus.voyage', text: 'answer' }, { secret: SECRET }));
    expect(res.status).toBe(404);
  });

  it('410s when the tracked message has already expired', async () => {
    trackedRow = { session_id: 's1', worker_id: 'w1', expires_at: '2020-01-01T00:00:00Z' };
    const res = await POST(req({ to: 'reply+abc@argus.voyage', text: 'answer' }, { secret: SECRET }));
    expect(res.status).toBe(410);
  });
});
