import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const createClient = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient }));

describe('E3B review API release lock', () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockReset();
    delete process.env.ARGUS_E3B_RELEASE_RECEIPT;
  });

  it('returns a non-discoverable 404 before auth when no approved O4 receipt exists', async () => {
    const { GET } = await import('../route');
    const response = await GET(new NextRequest('http://localhost/api/epistemic/review', {
      headers: { authorization: 'Bearer should-not-be-read' },
    }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'E3B_NOT_RELEASED' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('does not accept writes behind the release lock', async () => {
    const { POST } = await import('../route');
    const response = await POST(new NextRequest('http://localhost/api/epistemic/review', {
      method: 'POST',
      headers: { authorization: 'Bearer should-not-be-read', 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'endorse', action_id: 'a:1', claim_id: 'c:1' }),
    }));
    expect(response.status).toBe(404);
    expect(createClient).not.toHaveBeenCalled();
  });
});
