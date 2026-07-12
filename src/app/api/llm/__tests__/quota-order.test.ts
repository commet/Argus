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
});
