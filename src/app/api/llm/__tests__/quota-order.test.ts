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
