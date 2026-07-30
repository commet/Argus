import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyTurnstile: vi.fn(async () => true),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/turnstile', () => ({
  TURNSTILE_HEADER: 'x-turnstile-token',
  verifyTurnstile: mocks.verifyTurnstile,
}));
vi.mock('@/lib/server-events', () => ({ logServerEvent: vi.fn() }));

import { POST } from '../route';
import { logServerEvent } from '@/lib/server-events';

function request(body: string): Request {
  return new Request('https://argus.test/api/llm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

describe('POST /api/llm quota ordering', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key');
    mocks.createClient.mockClear();
    mocks.verifyTurnstile.mockClear();
  });

  it('rejects malformed JSON before auth, captcha, or quota work', async () => {
    const response = await POST(request('{') as never);

    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
  });

  it('rejects invalid messages before auth, captcha, or quota work', async () => {
    const response = await POST(request(JSON.stringify({ messages: [] })) as never);

    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
  });

  // 2026-07-30 incident lesson: an RPC permission error must never be relayed
  // as "quota used up". Error and honest-false are different answers.
  it('per-IP RPC ERROR → 503 temporary-check message, never the quota message', async () => {
    vi.mocked(logServerEvent).mockClear();
    mocks.createClient.mockImplementation(() => ({
      rpc: async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }),
    }));

    const response = await POST(
      request(JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })) as never,
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain('temporary');
    expect(body.error).not.toContain('quota exhausted');
    expect(body.needsLogin).toBeUndefined();
    expect(vi.mocked(logServerEvent)).toHaveBeenCalledWith(
      'server_rate_limit_rpc_error',
      expect.objectContaining({ fn: 'check_anon_rate_limit', code: '42501' }),
      expect.anything(),
    );
  });

  it('honest quota false keeps the existing 429 quota message', async () => {
    mocks.createClient.mockImplementation(() => ({
      rpc: async () => ({ data: false, error: null }),
    }));

    const response = await POST(
      request(JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })) as never,
    );

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toContain('quota exhausted');
    expect(body.needsLogin).toBe(true);
  });

  it('global-counter RPC ERROR → 503 temporary-check message, not the capacity message', async () => {
    const GLOBAL_SENTINEL = '00000000000000000000000000000001';
    vi.mocked(logServerEvent).mockClear();
    mocks.createClient.mockImplementation(() => ({
      rpc: async (_name: string, params: { p_ip_hash: string }) =>
        params.p_ip_hash === GLOBAL_SENTINEL
          ? { data: null, error: { code: 'PGRST301', message: 'jwt expired' } }
          : { data: true, error: null },
    }));

    const response = await POST(
      request(JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })) as never,
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain('temporary');
    expect(body.error).not.toContain('capacity');
    expect(vi.mocked(logServerEvent)).toHaveBeenCalledWith(
      'server_rate_limit_rpc_error',
      expect.objectContaining({ code: 'PGRST301', secondary: 'global_daily' }),
      expect.anything(),
    );
  });

  it('trips the global circuit breaker after the per-IP check and never reaches the model', async () => {
    const GLOBAL_SENTINEL = '00000000000000000000000000000001';
    const rpcKeys: string[] = [];
    mocks.createClient.mockImplementation(() => ({
      rpc: async (_name: string, params: { p_ip_hash: string }) => {
        rpcKeys.push(params.p_ip_hash);
        // Per-IP quota says yes; the shared daily counter says no.
        return { data: params.p_ip_hash !== GLOBAL_SENTINEL, error: null };
      },
    }));

    const response = await POST(
      request(JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })) as never,
    );

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain('capacity');
    // Ordering: the shared counter is consulted last, so it only counts
    // requests that would otherwise reach the model.
    expect(rpcKeys.length).toBe(2);
    expect(rpcKeys[0]).not.toBe(GLOBAL_SENTINEL);
    expect(rpcKeys[1]).toBe(GLOBAL_SENTINEL);
  });
});
