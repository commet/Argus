import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * /api/boss/saju is UNAUTHENTICATED and runs a CPU-bound computation, so its
 * only abuse defenses are content-type/size validation and a per-IP daily cap
 * backed by an RPC. These tests drive that gate: wrong content-type, oversized
 * body, and rate-limit-exceeded must all short-circuit before interpretSaju runs.
 */

let rateAllowed = true;
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: () => Promise.resolve({ data: rateAllowed, error: null }),
  }),
}));

const interpretSpy = vi.fn(() => Promise.resolve({ profile: 'ok' }));
vi.mock('@/lib/boss/saju-interpreter', () => ({ interpretSaju: (...a: unknown[]) => interpretSpy(...a) }));

import { POST } from '../route';

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://argus.voyage/api/boss/saju', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  rateAllowed = true;
  interpretSpy.mockClear();
});

describe('POST /api/boss/saju — abuse gate', () => {
  it('415s when content-type is not application/json', async () => {
    const res = await POST(new Request('https://argus.voyage/api/boss/saju', {
      method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}',
    }) as never);
    expect(res.status).toBe(415);
    expect(interpretSpy).not.toHaveBeenCalled();
  });

  it('413s when the declared content-length exceeds the 1KB cap', async () => {
    const res = await POST(req({ year: 1990, month: 5, gender: 'M' }, { 'content-length': '2048' }));
    expect(res.status).toBe(413);
    expect(interpretSpy).not.toHaveBeenCalled();
  });

  it('429s when the per-IP rate limit is exceeded', async () => {
    rateAllowed = false;
    const res = await POST(req({ year: 1990, month: 5, gender: 'M' }));
    expect(res.status).toBe(429);
    expect(interpretSpy).not.toHaveBeenCalled();
  });

  it('400s when required fields are missing (after passing the gate)', async () => {
    const res = await POST(req({ year: 1990 }));
    expect(res.status).toBe(400);
    expect(interpretSpy).not.toHaveBeenCalled();
  });

  it('200s and runs interpretSaju on a valid, in-budget request', async () => {
    const res = await POST(req({ year: 1990, month: 5, day: 3, gender: 'F' }));
    expect(res.status).toBe(200);
    expect(interpretSpy).toHaveBeenCalledOnce();
  });
});
