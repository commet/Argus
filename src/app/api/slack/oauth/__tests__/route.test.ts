import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upsert: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ upsert: mocks.upsert }),
  }),
}));

import { GET as beginGet, POST as beginPost } from '../route';
import { GET as callbackGet } from '../../callback/route';

function beginRequest(body: unknown, token = 'secret-access-token'): Request {
  return new Request('https://argus.voyage/api/slack/oauth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      origin: 'https://argus.voyage',
      host: 'argus.voyage',
    },
    body: JSON.stringify(body),
  });
}

function anonymousBeginRequest(): Request {
  return new Request('https://argus.voyage/api/slack/oauth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://argus.voyage',
      host: 'argus.voyage',
    },
    body: '{}',
  });
}

beforeEach(() => {
  vi.stubEnv('SLACK_CLIENT_ID', 'client-id');
  vi.stubEnv('SLACK_CLIENT_SECRET', 'client-secret');
  vi.stubEnv('SLACK_SIGNING_SECRET', 'signing-secret');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  mocks.getUser.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mocks.upsert.mockReset();
  mocks.upsert.mockResolvedValue({ error: null });
  vi.restoreAllMocks();
});

describe('Slack OAuth begin + callback', () => {
  it('accepts only POST so bearer tokens cannot be supplied in a navigation URL', () => {
    const response = beginGet();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('returns 401 before revealing that Slack is unconfigured', async () => {
    vi.stubEnv('SLACK_CLIENT_ID', '');
    vi.stubEnv('SLACK_SIGNING_SECRET', '');
    const response = await beginPost(anonymousBeginRequest() as never);
    expect(response.status).toBe(401);
  });

  it('returns a Slack URL without exposing the Supabase access token', async () => {
    const response = await beginPost(beginRequest({ locale: 'ko' }) as never);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.url).toMatch(/^https:\/\/slack\.com\/oauth\/v2\/authorize/);
    expect(json.url).not.toContain('secret-access-token');
  });

  it('round-trips the signed locale to the callback redirect', async () => {
    const begin = await beginPost(beginRequest({ locale: 'ko' }) as never);
    const { url } = await begin.json();
    const state = new URL(url).searchParams.get('state');
    expect(state).toBeTruthy();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ ok: true, access_token: 'xoxb-slack', team: { id: 'T1', name: 'Test Team' } }),
    } as Response);
    const callback = await callbackGet(new Request(
      `https://argus.voyage/api/slack/callback?code=oauth-code&state=${encodeURIComponent(state!)}`,
    ) as never);

    expect(callback.status).toBe(307);
    expect(callback.headers.get('location')).toBe('https://argus.voyage/ko/settings?slack=connected');
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });
});
