import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * /api/email/team-invite — the invite email is composed ENTIRELY server-side
 * from RLS-verified rows. These tests pin the three load-bearing properties:
 * (1) no pending invite visible to the caller → 404, nothing sent;
 * (2) happy path sends to the DB row's email with the DB team name;
 * (3) request-body free text can never reach the outgoing mail.
 */
const mocks = vi.hoisted(() => ({
  resendSend: vi.fn(),
  getUser: vi.fn(),
  shareGuard: vi.fn(),
  inviteRow: vi.fn(),
  teamRow: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.resendSend };
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      const result = () => (table === 'team_invites' ? mocks.inviteRow() : mocks.teamRow());
      const builder: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order', 'limit']) {
        builder[m] = () => builder;
      }
      builder.maybeSingle = () => Promise.resolve({ data: result(), error: null });
      return builder;
    },
  }),
}));

vi.mock('@/lib/share-guard', () => ({ recordAndCheckShare: mocks.shareGuard }));

import { POST as sendTeamInvite } from '../team-invite/route';

function request(body: Record<string, unknown>) {
  return new Request('https://argus.voyage/api/email/team-invite', {
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
  vi.stubEnv('RESEND_API_KEY', 'resend-key');
  vi.stubEnv('EMAIL_FROM_DOMAIN', 'argus.voyage');
  mocks.resendSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'inviter@example.com', user_metadata: { full_name: '창업자' } } },
    error: null,
  });
  mocks.shareGuard.mockResolvedValue({ ok: true });
  mocks.inviteRow.mockReturnValue({ id: 'invite-1', role: 'member', status: 'pending' });
  mocks.teamRow.mockReturnValue({ name: '전략기획팀' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('team-invite email', () => {
  it('sends a server-composed invite to the pending invite address', async () => {
    const res = await sendTeamInvite(request({ teamId: 'team-1', email: 'Invitee@Example.com', locale: 'ko' }));

    expect(res.status).toBe(200);
    expect(mocks.resendSend).toHaveBeenCalledTimes(1);
    const sent = mocks.resendSend.mock.calls[0][0];
    expect(sent.to).toBe('invitee@example.com');
    expect(sent.subject).toContain('전략기획팀');
    expect(sent.subject).toContain('창업자');
  });

  it('returns 404 and sends nothing when no pending invite is visible to the caller', async () => {
    mocks.inviteRow.mockReturnValue(null);

    const res = await sendTeamInvite(request({ teamId: 'team-1', email: 'invitee@example.com', locale: 'ko' }));

    expect(res.status).toBe(404);
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });

  it('ignores free-text fields in the request body — mail content comes from DB rows only', async () => {
    const res = await sendTeamInvite(request({
      teamId: 'team-1',
      email: 'invitee@example.com',
      locale: 'ko',
      message: 'CLICK THIS PHISHING LINK',
      title: 'fake title',
    }));

    expect(res.status).toBe(200);
    const sent = mocks.resendSend.mock.calls[0][0];
    expect(sent.subject).not.toContain('fake title');
    expect(String(sent.html)).not.toContain('PHISHING');
  });

  it('returns 503 when email is not configured, so the client can fall back honestly', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    const res = await sendTeamInvite(request({ teamId: 'team-1', email: 'invitee@example.com', locale: 'ko' }));

    expect(res.status).toBe(503);
    expect(mocks.resendSend).not.toHaveBeenCalled();
  });
});
