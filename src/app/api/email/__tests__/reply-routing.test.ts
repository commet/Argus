import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resendSend: vi.fn(),
  getUser: vi.fn(),
  rateLimit: vi.fn(),
  trackReply: vi.fn(),
  shareGuard: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.resendSend };
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, key: string) => key === 'service-key'
    ? {
        rpc: mocks.rateLimit,
        from: () => ({ upsert: mocks.trackReply }),
      }
    : { auth: { getUser: mocks.getUser } },
}));

vi.mock('@/lib/share-guard', () => ({ recordAndCheckShare: mocks.shareGuard }));
vi.mock('@/lib/email-html', () => ({ markdownToEmailHtml: () => '<p>mail</p>' }));
vi.mock('@/lib/uuid', () => ({ generateId: () => 'reply-token' }));

import { POST as sendShare } from '../send/route';
import { POST as sendQuestion } from '../send-question/route';

function request(path: string, body: Record<string, unknown>) {
  return new Request(`https://argus.voyage${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer user-token',
      'content-type': 'application/json',
      origin: 'https://argus.voyage',
      host: 'argus.voyage',
    },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  vi.stubEnv('RESEND_API_KEY', 'resend-key');
  vi.stubEnv('EMAIL_FROM_DOMAIN', 'argus.voyage');
  vi.stubEnv('EMAIL_REPLY_TO', 'owner@example.com');
  vi.stubEnv('EMAIL_INBOUND_SECRET', '');
  mocks.resendSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mocks.rateLimit.mockResolvedValue({ data: true, error: null });
  mocks.trackReply.mockResolvedValue({ error: null });
  mocks.shareGuard.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('outbound email reply routing', () => {
  it('routes replies to the operator inbox for shared deliverables', async () => {
    const res = await sendShare(request('/api/email/send', {
      to: 'recipient@example.com', title: 'Decision', content: 'Body',
    }));

    expect(res.status).toBe(200);
    expect(mocks.resendSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Argus <share@argus.voyage>',
      replyTo: 'owner@example.com',
    }));
  });

  it('routes human-agent replies to the operator when inbound automation is off', async () => {
    const res = await sendQuestion(request('/api/email/send-question', {
      to: 'recipient@example.com', question: 'What would you change?',
      sessionId: 'session-1', workerId: 'worker-1', locale: 'en',
    }));

    expect(res.status).toBe(200);
    expect(mocks.resendSend).toHaveBeenCalledWith(expect.objectContaining({
      replyTo: 'owner@example.com',
    }));
    expect(mocks.resendSend.mock.calls[0][0].html).toContain('go to the Argus team');
  });

  it('keeps tokenized replies only when the inbound webhook is configured', async () => {
    vi.stubEnv('EMAIL_INBOUND_SECRET', 'webhook-secret');

    const res = await sendQuestion(request('/api/email/send-question', {
      to: 'recipient@example.com', question: 'What would you change?',
      sessionId: 'session-1', workerId: 'worker-1', locale: 'en',
    }));

    expect(res.status).toBe(200);
    expect(mocks.resendSend).toHaveBeenCalledWith(expect.objectContaining({
      replyTo: 'reply+reply-token@argus.voyage',
    }));
  });
});
