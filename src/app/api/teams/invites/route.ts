import { NextRequest, NextResponse } from 'next/server';
import { validateContentLength, validateContentType, validateOrigin } from '@/lib/api-security';
import { authenticateTeamRequest } from '@/lib/team-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await authenticateTeamRequest(req);
  if (!auth?.user.email) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { data: invites, error } = await auth.admin
    .from('team_invites')
    .select('*')
    .eq('email', auth.user.email.toLowerCase())
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load invitations.' }, { status: 500 });

  const teamIds = [...new Set((invites || []).map((invite) => invite.team_id))];
  const { data: teams } = teamIds.length
    ? await auth.admin.from('teams').select('id, name').in('id', teamIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const names = new Map((teams || []).map((team) => [team.id, team.name]));
  return NextResponse.json({ invites: (invites || []).map((invite) => ({ ...invite, team_name: names.get(invite.team_id) || null })) });
}

export async function PATCH(req: NextRequest) {
  const contentTypeError = validateContentType(req);
  if (contentTypeError) return contentTypeError;
  const contentLengthError = validateContentLength(req);
  if (contentLengthError) return contentLengthError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  const auth = await authenticateTeamRequest(req);
  if (!auth?.user.email) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const inviteId = typeof body.inviteId === 'string' ? body.inviteId : '';
  const action = body.action === 'accept' || body.action === 'decline' ? body.action : null;
  if (!inviteId || !action) return NextResponse.json({ error: 'Invalid invitation action.' }, { status: 400 });

  const { data: invite, error } = await auth.admin
    .from('team_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error || !invite || invite.email.toLowerCase() !== auth.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
  }

  if (action === 'accept') {
    const { data: existingMember, error: existingError } = await auth.admin
      .from('team_members')
      .select('id')
      .eq('team_id', invite.team_id)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: 'Could not check team membership.' }, { status: 500 });
    if (!existingMember) {
      const { error: memberError } = await auth.admin.from('team_members').insert({
        team_id: invite.team_id,
        user_id: auth.user.id,
        role: invite.role,
      });
      if (memberError) return NextResponse.json({ error: 'Could not join the team.' }, { status: 500 });
    }

    const { error: updateError } = await auth.admin
      .from('team_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId)
      .eq('status', 'pending');
    if (updateError) {
      if (!existingMember) {
        await auth.admin.from('team_members').delete().eq('team_id', invite.team_id).eq('user_id', auth.user.id);
      }
      return NextResponse.json({ error: 'Could not update the invitation.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, teamId: invite.team_id });
  }

  const { error: updateError } = await auth.admin
    .from('team_invites')
    .update({ status: 'declined' })
    .eq('id', inviteId)
    .eq('status', 'pending');
  if (updateError) {
    return NextResponse.json({ error: 'Could not update the invitation.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, teamId: invite.team_id });
}
