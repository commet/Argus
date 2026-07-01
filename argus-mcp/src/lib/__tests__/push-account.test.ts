import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pushToAccount } from '../push-account.js';

const ORIG = { token: process.env.ARGUS_TOKEN, url: process.env.ARGUS_API_URL };

beforeEach(() => {
  delete process.env.ARGUS_TOKEN;
  delete process.env.ARGUS_API_URL;
  vi.restoreAllMocks();
});
afterEach(() => {
  if (ORIG.token === undefined) delete process.env.ARGUS_TOKEN; else process.env.ARGUS_TOKEN = ORIG.token;
  if (ORIG.url === undefined) delete process.env.ARGUS_API_URL; else process.env.ARGUS_API_URL = ORIG.url;
});

const seal = { action: 'seal', id: 'd1', predicate: 'cutover under 5 min', check_by: '2026-08-01' } as const;

describe('pushToAccount', () => {
  it('is a silent no-op with no token (local-only default)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await pushToAccount({ ...seal });
    expect(r).toEqual({ synced: false, reason: 'no_token' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a malformed token without calling the network', async () => {
    process.env.ARGUS_TOKEN = 'not_a_pat';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await pushToAccount({ ...seal });
    expect(r.synced).toBe(false);
    expect(r.reason).toBe('bad_token_format');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs to /api/mcp/seal with the bearer token when configured', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_abc';
    process.env.ARGUS_API_URL = 'https://example.test/';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const r = await pushToAccount({ ...seal });
    expect(r.synced).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://example.test/api/mcp/seal'); // trailing slash trimmed
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer argus_pat_abc' });
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ action: 'seal', id: 'd1' });
  });

  it('degrades to local-only on an HTTP error (never throws)', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_abc';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 401 }));
    const r = await pushToAccount({ ...seal });
    expect(r).toEqual({ synced: false, reason: 'http_401' });
  });

  it('degrades to local-only on a network throw', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_abc';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
    const r = await pushToAccount({ ...seal });
    expect(r).toEqual({ synced: false, reason: 'network' });
  });
});
