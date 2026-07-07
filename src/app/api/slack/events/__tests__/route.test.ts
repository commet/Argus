import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

/**
 * The Slack Events endpoint is a trust boundary: every non-challenge request
 * must pass HMAC-SHA256 signature verification (with replay protection) before
 * it can touch the DB. These tests exercise that gate directly — the admin
 * Supabase client is stubbed so no network is hit, and the signature is signed
 * with the same secret the route reads so we can assert accept vs reject.
 */

const fromSpy = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromSpy, rpc: vi.fn(() => Promise.resolve({ error: null })) }),
}));

import { POST } from '../route';

const SECRET = 'test-signing-secret';

function sign(rawBody: string, timestamp: number): string {
  const base = `v0:${timestamp}:${rawBody}`;
  return 'v0=' + crypto.createHmac('sha256', SECRET).update(base).digest('hex');
}

function req(body: unknown, opts: { sign?: boolean; timestamp?: number; signature?: string } = {}) {
  const rawBody = JSON.stringify(body);
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.signature) {
    headers['x-slack-request-timestamp'] = String(timestamp);
    headers['x-slack-signature'] = opts.signature;
  } else if (opts.sign) {
    headers['x-slack-request-timestamp'] = String(timestamp);
    headers['x-slack-signature'] = sign(rawBody, timestamp);
  }
  return new Request('https://argus.voyage/api/slack/events', {
    method: 'POST', headers, body: rawBody,
  }) as never;
}

beforeEach(() => {
  vi.stubEnv('SLACK_SIGNING_SECRET', SECRET);
  fromSpy.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/slack/events — signature gate', () => {
  it('answers the url_verification challenge WITHOUT requiring a signature', async () => {
    const res = await POST(req({ type: 'url_verification', challenge: 'abc123' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ challenge: 'abc123' });
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('400s on a body that is not valid JSON', async () => {
    const res = await POST(new Request('https://argus.voyage/api/slack/events', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not-json',
    }) as never);
    expect(res.status).toBe(400);
  });

  it('401s an event_callback with NO signature headers', async () => {
    const res = await POST(req({ type: 'event_callback', event: { type: 'message' } }));
    expect(res.status).toBe(401);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('401s an event_callback with a WRONG (but same-length) signature', async () => {
    const res = await POST(req({ type: 'event_callback', event: { type: 'message' } }, {
      signature: 'v0=' + '0'.repeat(64),
    }));
    expect(res.status).toBe(401);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('401s a request whose timestamp is older than 5 minutes (replay protection)', async () => {
    const stale = Math.floor(Date.now() / 1000) - 600; // 10 min ago
    const body = { type: 'event_callback', event: { type: 'message' } };
    // Sign correctly but with the stale timestamp so only replay-age fails.
    const res = await POST(req(body, { signature: sign(JSON.stringify(body), stale), timestamp: stale }));
    expect(res.status).toBe(401);
  });

  it('401s when SLACK_SIGNING_SECRET is not configured', async () => {
    vi.stubEnv('SLACK_SIGNING_SECRET', '');
    const res = await POST(req({ type: 'event_callback', event: { type: 'message' } }, { sign: true }));
    expect(res.status).toBe(401);
  });

  it('accepts a correctly-signed event and returns 200', async () => {
    // Non-message event → passes the gate but does no DB work.
    const res = await POST(req({ type: 'event_callback', event: { type: 'app_mention' } }, { sign: true }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
  });

  it('a signed thread reply looks up the tracked thread (DB reached only after the gate)', async () => {
    fromSpy.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) }) }),
    });
    const body = { type: 'event_callback', event: { type: 'message', thread_ts: '123.45', text: 'hi' } };
    const res = await POST(req(body, { sign: true }));
    expect(res.status).toBe(200);
    expect(fromSpy).toHaveBeenCalledWith('human_agent_messages');
  });
});
