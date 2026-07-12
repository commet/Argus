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

function request(body: string): Request {
  return new Request('https://argus.test/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

describe('POST /api/search quota ordering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-brave-key');
    mocks.createClient.mockClear();
    mocks.verifyTurnstile.mockClear();
  });

  it.each([
    ['malformed JSON', '{'],
    ['empty query', JSON.stringify({ query: '   ' })],
    ['non-string query', JSON.stringify({ query: 42 })],
  ])('rejects %s before captcha or quota work', async (_name, body) => {
    const { POST } = await import('./route');
    const response = await POST(request(body) as never);

    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
  });

  it('still validates the request when search is disabled', async () => {
    vi.stubEnv('BRAVE_SEARCH_API_KEY', '');
    const { POST } = await import('./route');
    const response = await POST(request('{}') as never);

    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('returns 502 when Brave fails instead of disguising it as no results', async () => {
    mocks.createClient.mockReturnValue({
      rpc: () => Promise.resolve({ data: true, error: null }),
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 } as Response);
    const { POST } = await import('./route');
    const response = await POST(request(JSON.stringify({ query: 'current evidence' })) as never);

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ results: [], error: 'Search provider unavailable.' });
  });
});
