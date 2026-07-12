import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * /api/boss/saju is UNAUTHENTICATED and runs a CPU-bound computation, so its
 * only abuse defenses are content-type/size validation and a per-IP daily cap
 * backed by an RPC. These tests drive that gate: wrong content-type, oversized
 * body, and rate-limit-exceeded must all short-circuit before interpretSaju runs.
 */

let rateAllowed = true;
const rateSpy = vi.fn(() => Promise.resolve({ data: rateAllowed, error: null }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => rateSpy(...args),
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
  rateSpy.mockClear();
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
    // The route gates on the content-length HEADER (not measured body size), so
    // build the request with a Headers object: a manually-set Content-Length on a
    // real `Request` is a forbidden header that some fetch/undici runtimes strip,
    // which would make this test runtime-dependent.
    const oversized = {
      headers: new Headers({ 'content-type': 'application/json', 'content-length': '2048' }),
      json: async () => ({ year: 1990, month: 5, gender: 'M' }),
    } as never;
    const res = await POST(oversized);
    expect(res.status).toBe(413);
    expect(interpretSpy).not.toHaveBeenCalled();
  });

  it('429s when the per-IP rate limit is exceeded', async () => {
    rateAllowed = false;
    const res = await POST(req({ year: 1990, month: 5, day: 3, gender: '남' }));
    expect(res.status).toBe(429);
    expect(interpretSpy).not.toHaveBeenCalled();
  });

  it('400s missing fields before consuming quota', async () => {
    const res = await POST(req({ year: 1990 }));
    expect(res.status).toBe(400);
    expect(interpretSpy).not.toHaveBeenCalled();
    expect(rateSpy).not.toHaveBeenCalled();
  });

  it('400s a partial date instead of inventing a day master', async () => {
    const res = await POST(req({ year: 1990, month: 5, gender: '남' }));
    expect(res.status).toBe(400);
    expect(interpretSpy).not.toHaveBeenCalled();
    expect(rateSpy).not.toHaveBeenCalled();
  });

  it('400s malformed JSON before consuming quota', async () => {
    const res = await POST(new Request('https://argus.voyage/api/boss/saju', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    }) as never);
    expect(res.status).toBe(400);
    expect(rateSpy).not.toHaveBeenCalled();
  });

  it('200s and runs interpretSaju on a valid, in-budget request', async () => {
    const res = await POST(req({ year: 1990, month: 5, day: 3, gender: '여' }));
    expect(res.status).toBe(200);
    expect(interpretSpy).toHaveBeenCalledOnce();
  });
});
