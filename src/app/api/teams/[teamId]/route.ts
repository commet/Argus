import { NextRequest, NextResponse } from 'next/server';
import { authenticateTeamRequest, canManageTeam, getTeamAccess, getUsersById, userDisplayName, UUID_RE } from '@/lib/team-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ teamId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticateTeamRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { teamId } = await params;
  if (!UUID_RE.test(teamId)) return NextResponse.json({ error: 'Invalid team.' }, { status: 400 });
  const access = await getTeamAccess(auth.admin, teamId, auth.user.id);
  if (!access) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const [teamResult, membersResult, invitesResult] = await Promise.all([
    auth.admin.from('teams').select('*').eq('id', teamId).maybeSingle(),
    auth.admin.from('team_members').select('*').eq('team_id', teamId).order('created_at'),
    canManageTeam(access)
      ? auth.admin.from('team_invites').select('*').eq('team_id', teamId).eq('status', 'pending').order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (teamResult.error || membersResult.error || !teamResult.data) {
    return NextResponse.json({ error: 'Could not load team details.' }, { status: 500 });
  }

  const members = membersResult.data || [];
  const users = await getUsersById(auth.admin, members.map((member) => member.user_id));
  const enriched = members.map((member) => {
    const user = users.get(member.user_id);
    return {
      ...member,
      email: user?.email || null,
      display_name: userDisplayName(user),
    };
  });

  return NextResponse.json({
    team: { ...teamResult.data, my_role: access.role },
    members: enriched,
    invites: invitesResult.data || [],
  });
}
