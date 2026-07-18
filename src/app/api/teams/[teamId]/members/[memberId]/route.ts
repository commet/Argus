import { NextRequest, NextResponse } from 'next/server';
import { validateOrigin } from '@/lib/api-security';
import { authenticateTeamRequest, canManageTeam, getTeamAccess, UUID_RE } from '@/lib/team-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ teamId: string; memberId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const originError = validateOrigin(req);
  if (originError) return originError;
  const auth = await authenticateTeamRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { teamId, memberId } = await params;
  if (!UUID_RE.test(teamId) || !UUID_RE.test(memberId)) {
    return NextResponse.json({ error: 'Invalid member.' }, { status: 400 });
  }
  const access = await getTeamAccess(auth.admin, teamId, auth.user.id);
  if (!canManageTeam(access)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const { data: target } = await auth.admin
    .from('team_members')
    .select('id, role, user_id')
    .eq('id', memberId)
    .eq('team_id', teamId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  if (target.role === 'owner') return NextResponse.json({ error: 'The team owner cannot be removed.' }, { status: 409 });
  if (access?.role === 'admin' && target.role === 'admin') {
    return NextResponse.json({ error: 'Only the team owner can remove an administrator.' }, { status: 403 });
  }

  const { error } = await auth.admin.from('team_members').delete().eq('id', memberId).eq('team_id', teamId);
  if (error) return NextResponse.json({ error: 'Could not remove the member.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
