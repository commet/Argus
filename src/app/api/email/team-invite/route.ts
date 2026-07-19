import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { validateContentType, validateContentLength, validateOrigin } from '@/lib/api-security';
import { markdownToEmailHtml } from '@/lib/email-html';
import { recordAndCheckShare } from '@/lib/share-guard';

export const maxDuration = 30;

/**
 * Team-invite notification email (창업자 2026-07-19: the invite used to be a
 * silent DB row — "share this page's link with them directly" was the whole
 * delivery mechanism, so most invitees never learned they were invited).
 *
 * Design constraints:
 * - The email is composed ENTIRELY server-side from verified DB rows (team
 *   name, inviter identity). The client sends only { teamId, email, locale } —
 *   no free-text reaches the recipient, so an account can't use this route as
 *   an arbitrary-content relay.
 * - Verification runs on the CALLER's token (RLS-scoped): the pending invite
 *   row for (team, email) must be visible to them, which per team_invites RLS
 *   means they are that team's admin/owner. Only then do we look up the team
 *   name and send.
 * - Rate limited through the shared share_log guard (same 24h cap as every
 *   outbound channel).
 * - If Resend isn't configured, return 503 — the client falls back to the old
 *   "hand them the link" copy. Honest gap over silent failure.
 */
function maskEmail(addr: string): string {
  const [user, domain] = addr.split('@');
  if (!domain) return '***';
  const head = user.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export async function POST(req: NextRequest) {
  const ctError = validateContentType(req);
  if (ctError) return ctError;
  const clError = validateContentLength(req);
  if (clError) return clError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  // RLS-scoped client acting AS the caller — membership checks ride on policies.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email is not configured on this deployment.' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { teamId, email, locale } = body;
  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
  }
  if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
  }
  const lang: 'ko' | 'en' = locale === 'en' ? 'en' : 'ko';
  const to = email.toLowerCase().trim();

  // The pending invite row must exist AND be visible to the caller (RLS:
  // admin/owner of that team). This single query is both the authorization
  // check and the proof the invite is real — we never send ahead of the row.
  const { data: invite } = await supabase
    .from('team_invites')
    .select('id, role, status')
    .eq('team_id', teamId)
    .eq('email', to)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!invite) {
    return NextResponse.json({ error: 'No pending invite for this address.' }, { status: 404 });
  }

  const { data: team } = await supabase
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .maybeSingle();
  if (!team?.name) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }

  const guard = await recordAndCheckShare(user.id, 'email', {
    target: maskEmail(to),
    context: 'team-invite',
  });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 429 });

  // Inviter identity from the verified auth token — not from the request body.
  const inviterName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    user.email?.split('@')[0] ||
    'Argus user';
  const teamName = String(team.name).slice(0, 100);
  const acceptUrl = `https://argus.voyage/${lang}/login?redirect=/teams`;
  const roleLabel = invite.role === 'admin' ? 'Admin' : 'Member';

  const subject = lang === 'ko'
    ? `${inviterName}님이 Argus 팀 "${teamName}"에 초대했어요`
    : `${inviterName} invited you to the Argus team "${teamName}"`;
  // markdownToEmailHtml escapes everything first — team/inviter names are safe.
  const markdown = lang === 'ko'
    ? [
        `**${inviterName}**님이 Argus에서 **${teamName}** 팀에 ${roleLabel}로 초대했어요.`,
        '',
        `아래 주소에서 이 이메일(${to})로 로그인하면 초대가 보이고, 수락하면 팀 프로젝트를 함께 볼 수 있어요.`,
        '',
        acceptUrl,
        '',
        '초대에 응하고 싶지 않다면 이 메일은 그냥 무시하셔도 됩니다.',
      ].join('\n')
    : [
        `**${inviterName}** invited you to the team **${teamName}** on Argus as ${roleLabel}.`,
        '',
        `Sign in with this email (${to}) at the address below to see and accept the invite — then you can share the team's projects.`,
        '',
        acceptUrl,
        '',
        'Not interested? Just ignore this email.',
      ].join('\n');

  const html = markdownToEmailHtml(subject, markdown);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromDomain = process.env.EMAIL_FROM_DOMAIN || 'argus.voyage';
    const replyTo = process.env.EMAIL_REPLY_TO || `hello@${fromDomain}`;
    await resend.emails.send({
      from: `Argus <share@${fromDomain}>`,
      to,
      replyTo,
      subject,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[email/team-invite] Error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
  }
}
