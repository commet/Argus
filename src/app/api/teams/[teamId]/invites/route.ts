import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { validateContentLength, validateContentType, validateOrigin } from '@/lib/api-security';
import { recordAndCheckShare } from '@/lib/share-guard';
import {
  authenticateTeamRequest,
  canManageTeam,
  getTeamAccess,
  normalizeEmail,
  userDisplayName,
  UUID_RE,
} from '@/lib/team-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ teamId: string }> };

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest, { params }: Params) {
  const contentTypeError = validateContentType(req);
  if (contentTypeError) return contentTypeError;
  const contentLengthError = validateContentLength(req);
  if (contentLengthError) return contentLengthError;
  const originError = validateOrigin(req);
  if (originError) return originError;
  const auth = await authenticateTeamRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { teamId } = await params;
  if (!UUID_RE.test(teamId)) return NextResponse.json({ error: 'Invalid team.' }, { status: 400 });
  const access = await getTeamAccess(auth.admin, teamId, auth.user.id);
  if (!canManageTeam(access)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const email = normalizeEmail(body.email);
  const role = body.role === 'admin' ? 'admin' : 'member';
  const locale = body.locale === 'ko' ? 'ko' : 'en';
  if (!email) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (email === auth.user.email?.toLowerCase()) return NextResponse.json({ error: 'You are already on this team.' }, { status: 409 });

  const [{ data: team }, { data: existing }] = await Promise.all([
    auth.admin.from('teams').select('id, name').eq('id', teamId).maybeSingle(),
    auth.admin.from('team_invites').select('*').eq('team_id', teamId).eq('email', email).eq('status', 'pending').maybeSingle(),
  ]);
  if (!team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  let invite = existing;
  if (!invite) {
    const { data, error } = await auth.admin
      .from('team_invites')
      .insert({ team_id: teamId, email, role, invited_by: auth.user.id, status: 'pending' })
      .select()
      .single();
    if (error || !data) return NextResponse.json({ error: 'Could not create the invitation.' }, { status: 500 });
    invite = data;
  }

  const inviteUrl = new URL(`/${locale}/teams`, req.nextUrl.origin).toString();
  let delivery: 'email' | 'link' = 'link';
  let deliveryWarning: string | null = null;

  if (process.env.RESEND_API_KEY) {
    const allowed = await recordAndCheckShare(auth.user.id, 'team_invite_email', {
      target: email,
      context: teamId,
    });
    if (allowed.ok) {
      const ko = locale === 'ko';
      const sender = userDisplayName(auth.user) || auth.user.email?.split('@')[0] || 'Argus user';
      const title = ko ? `${sender}님이 ${team.name} 팀에 초대했어요` : `${sender} invited you to ${team.name}`;
      const action = ko ? '초대 확인하기' : 'View invitation';
      const note = ko
        ? '로그인한 이메일이 초대받은 주소와 같아야 초대를 수락할 수 있어요.'
        : 'Sign in with the invited email address to accept.';
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#2b2722">
          <p style="font-size:13px;font-weight:700;color:#9b742e;margin:0 0 22px">Argus</p>
          <h1 style="font-size:22px;line-height:1.35;margin:0 0 12px">${escapeHtml(title)}</h1>
          <p style="font-size:14px;line-height:1.65;color:#635d54;margin:0 0 24px">${escapeHtml(note)}</p>
          <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#2f2a24;color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:650">${action}</a>
        </div>`;
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const domain = process.env.EMAIL_FROM_DOMAIN || 'argus.voyage';
        const { error: emailError } = await resend.emails.send({
          from: `Argus <hello@${domain}>`,
          to: email,
          subject: title,
          html,
          replyTo: process.env.EMAIL_REPLY_TO || `hello@${domain}`,
        });
        if (emailError) throw emailError;
        delivery = 'email';
      } catch (error) {
        console.error('[teams/invites] email delivery failed:', error);
        deliveryWarning = 'Invitation saved, but the email could not be delivered.';
      }
    } else {
      deliveryWarning = allowed.error || 'Invitation saved, but email delivery is temporarily unavailable.';
    }
  }

  return NextResponse.json({ invite, delivery, inviteUrl, warning: deliveryWarning }, { status: existing ? 200 : 201 });
}
