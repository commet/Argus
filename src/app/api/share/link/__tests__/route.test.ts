import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Creating a public share link is gated by (a) origin/content-type validation,
 * (b) a Bearer token that resolves to a user, and (c) a per-user share-rate
 * guard. These tests assert the gate order and that a blocked guard never
 * inserts a row. The auth client and share-guard are stubbed.
 */

let tokenUser: { id: string } | null = { id: 'user-1' };
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: tokenUser }, error: tokenUser ? null : { message: 'bad' } }) },
  }),
}));

let guardResult: { ok: boolean; error?: string; status?: number } = { ok: true };
const insertSpy = vi.fn(() => Promise.resolve({ error: null }));
vi.mock('@/lib/share-guard', () => ({
  recordAndCheckShare: () => Promise.resolve(guardResult),
  adminClient: () => ({ from: () => ({ insert: (...a: unknown[]) => insertSpy(...a) }) }),
}));

import { POST } from '../route';

function req(body: unknown, opts: { token?: string; origin?: boolean } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
  if (opts.origin !== false) { headers['origin'] = 'https://argus.voyage'; headers['host'] = 'argus.voyage'; }
  return new Request('https://argus.voyage/api/share/link', {
    method: 'POST', headers, body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  tokenUser = { id: 'user-1' };
  guardResult = { ok: true };
  insertSpy.mockClear();
});

describe('POST /api/share/link — auth + share guard', () => {
  it('415s when content-type is not JSON', async () => {
    const res = await POST(new Request('https://argus.voyage/api/share/link', {
      method: 'POST', headers: { 'content-type': 'text/plain', origin: 'https://argus.voyage', host: 'argus.voyage' }, body: '{}',
    }) as never);
    expect(res.status).toBe(415);
  });

  it('403s when the Origin does not match the host (CSRF)', async () => {
    const res = await POST(new Request('https://argus.voyage/api/share/link', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.com', host: 'argus.voyage', authorization: 'Bearer good' }, body: '{}',
    }) as never);
    expect(res.status).toBe(403);
  });

  it('401s without a Bearer token', async () => {
    const res = await POST(req({ content: 'x' }, { origin: true }));
    expect(res.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('401s when the token does not resolve to a user', async () => {
    tokenUser = null;
    const res = await POST(req({ content: 'x' }, { token: 'bogus' }));
    expect(res.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('400s when content is missing', async () => {
    const res = await POST(req({ title: 'no body' }, { token: 'good' }));
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('400s malformed JSON instead of throwing a route-level 500', async () => {
    const res = await POST(new Request('https://argus.voyage/api/share/link', {
      method: 'POST',
      headers: {
        'content-type': 'application/json', authorization: 'Bearer good',
        origin: 'https://argus.voyage', host: 'argus.voyage',
      },
      body: '{',
    }) as never);
    expect(res.status).toBe(400);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('429s (and does NOT insert) when the share guard blocks', async () => {
    guardResult = { ok: false, error: 'rate limited', status: 429 };
    const res = await POST(req({ content: 'hello world' }, { token: 'good' }));
    expect(res.status).toBe(429);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('creates a link and returns a token on the happy path', async () => {
    const res = await POST(req({ title: 'My Doc', content: 'hello world' }, { token: 'good' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(typeof json.token).toBe('string');
    expect(json.path).toBe(`/d/${json.token}`);
    expect(insertSpy).toHaveBeenCalledOnce();
  });

  it('stores review receipt context only after explicit authenticated share', async () => {
    const res = await POST(req({ title: 'Receipt', content: '# Judgment Receipt', context: 'review_receipt' }, { token: 'good' }));
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      title: 'Receipt',
      content: '# Judgment Receipt',
      context: 'review_receipt',
    }));
  });
});
