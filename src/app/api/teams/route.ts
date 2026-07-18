import { NextRequest, NextResponse } from 'next/server';
import { validateContentLength, validateContentType, validateOrigin } from '@/lib/api-security';
import { authenticateTeamRequest, normalizeTeamName, teamSlug } from '@/lib/team-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await authenticateTeamRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { data: memberships, error: membershipError } = await auth.admin
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', auth.user.id);
  if (membershipError) return NextResponse.json({ error: 'Could not load teams.' }, { status: 500 });
  const teamIds = (memberships || []).map((row) => row.team_id);
  if (teamIds.length === 0) return NextResponse.json({ teams: [] });

  const { data: teams, error } = await auth.admin
    .from('teams')
    .select('*')
    .in('id', teamIds)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load teams.' }, { status: 500 });

  const roles = new Map((memberships || []).map((row) => [row.team_id, row.role]));
  return NextResponse.json({ teams: (teams || []).map((team) => ({ ...team, my_role: roles.get(team.id) || 'member' })) });
}

export async function POST(req: NextRequest) {
  const contentTypeError = validateContentType(req);
  if (contentTypeError) return contentTypeError;
  const contentLengthError = validateContentLength(req);
  if (contentLengthError) return contentLengthError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  const auth = await authenticateTeamRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const name = normalizeTeamName(body.name);
  if (!name) return NextResponse.json({ error: 'Team name must be between 1 and 50 characters.' }, { status: 400 });

  const { data: team, error } = await auth.admin
    .rpc('create_team_with_owner', {
      p_name: name,
      p_slug: teamSlug(name),
      p_owner_id: auth.user.id,
    })
    .single();
  if (error || !team) return NextResponse.json({ error: 'Could not create the team.' }, { status: 500 });

  return NextResponse.json({ team: { ...team, my_role: 'owner' } }, { status: 201 });
}
