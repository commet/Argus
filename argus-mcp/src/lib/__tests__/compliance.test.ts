import { describe, it, expect, afterEach } from 'vitest';
import { pushToAccount } from '../push-account.js';

/**
 * MCP compliance audit (2026-07-05) regression guards.
 *
 * F2 — the account Bearer token must never travel in cleartext. A non-https
 * ARGUS_API_URL override must make the sync refuse to send (no network call),
 * not leak the token over http.
 */
describe('F2: https enforcement on the account sync channel', () => {
  const saved = { token: process.env.ARGUS_TOKEN, url: process.env.ARGUS_API_URL };
  afterEach(() => {
    if (saved.token === undefined) delete process.env.ARGUS_TOKEN; else process.env.ARGUS_TOKEN = saved.token;
    if (saved.url === undefined) delete process.env.ARGUS_API_URL; else process.env.ARGUS_API_URL = saved.url;
  });

  const payload = { kind: 'seal', id: 'x', predicate: 'p', check_by: '2099-01-01' } as unknown as Parameters<typeof pushToAccount>[0];

  it('refuses to send over a plain http override (no token leak)', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_test';
    process.env.ARGUS_API_URL = 'http://evil.example.com';
    const r = await pushToAccount(payload);
    expect(r.synced).toBe(false);
    expect(r.reason).toBe('insecure_api_url');
  });

  it('allows http only for localhost (local dev)', async () => {
    process.env.ARGUS_TOKEN = 'argus_pat_test';
    process.env.ARGUS_API_URL = 'http://localhost:3000';
    // localhost passes the https gate → it proceeds to fetch, which fails with a
    // network reason (nothing listening), NOT the insecure gate.
    const r = await pushToAccount(payload);
    expect(r.reason).not.toBe('insecure_api_url');
  });

  it('no token ⇒ local-only, never reaches the url gate', async () => {
    delete process.env.ARGUS_TOKEN;
    process.env.ARGUS_API_URL = 'http://evil.example.com';
    const r = await pushToAccount(payload);
    expect(r).toEqual({ synced: false, reason: 'no_token' });
  });
});
