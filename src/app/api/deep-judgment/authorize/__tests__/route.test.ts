import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient }));

import { POST } from '../route';

function request(sessionId = 'session_123', headers: Record<string, string> = {}) {
  return new Request('https://argus.test/api/deep-judgment/authorize', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7', ...headers },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

describe('POST /api/deep-judgment/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
  });

  it('grants an anonymous session through the atomic reservation RPC', async () => {
    const rpc = vi.fn(async () => ({ data: 'granted', error: null }));
    createClient.mockReturnValue({ rpc });

    const response = await POST(request() as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ allowed: true, status: 'granted', window_hours: 24 });
    expect(rpc).toHaveBeenCalledWith('reserve_deep_judgment', expect.objectContaining({
      p_user_id: null,
      p_session_id: 'session_123',
      p_principal_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it('returns 429 when a different session already used the rolling window', async () => {
    createClient.mockReturnValue({ rpc: vi.fn(async () => ({ data: 'daily_used', error: null })) });

    const response = await POST(request() as never);

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ allowed: false, status: 'daily_used' });
  });

  it('binds a verified account id without trusting a body user id', async () => {
    const getUser = vi.fn(async () => ({ data: { user: { id: 'user-1' } } }));
    const rpc = vi.fn(async () => ({ data: 'resumed', error: null }));
    createClient
      .mockReturnValueOnce({ auth: { getUser } })
      .mockReturnValueOnce({ rpc });

    const response = await POST(request('session_123', { authorization: 'Bearer real-token' }) as never);

    expect(response.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith('real-token');
    expect(rpc).toHaveBeenCalledWith('reserve_deep_judgment', expect.objectContaining({ p_user_id: 'user-1' }));
  });

  it('rejects malformed session ids before touching Supabase', async () => {
    const response = await POST(request('../escape') as never);
    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });
});
