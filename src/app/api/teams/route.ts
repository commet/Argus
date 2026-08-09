import { NextRequest, NextResponse } from 'next/server';
import { validateContentLength, validateContentType, validateOrigin } from '@/lib/api-security';
import { authenticateTeamRequest, normalizeTeamName, teamSlug } from '@/lib/team-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TeamServiceError {
  code?: string;
  message?: string;
}

function teamServiceFailure(error: TeamServiceError | null, fallback: string) {
  const code = error?.code?.toUpperCase();
  const message = error?.message?.toLowerCase() ?? '';

  if (code === 'PGRST301' || message.includes('invalid api key')) {
    console.error('[teams] Supabase service credentials were rejected.', { code });
    return NextResponse.json(
      { error: 'Team service is temporarily unavailable.', code: 'TEAM_SERVER_CONFIG' },
      { status: 503 },
    );
  }

  console.error('[teams] Team service request failed.', { code });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function teamCreationFailure(error: TeamServiceError | null) {
  const code = error?.code?.toUpperCase();
  const message = error?.message?.toLowerCase() ?? '';
  const schemaNotReady = code === 'PGRST202'
    || code === '42883'
    || message.includes('function not found')
    || message.includes('could not find the function');

  if (schemaNotReady) {
    console.error('[teams] Atomic team creation RPC is not available.', { code });
    return NextResponse.json(
      { error: 'Team creation is not available yet.', code: 'TEAM_SCHEMA_NOT_READY' },
      { status: 503 },
    );
  }

  return teamServiceFailure(error, 'Could not create the team.');
}

export async function GET(req: NextRequest) {
  const auth = await authenticateTeamRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { data: memberships, error: membershipError } = await auth.admin
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', auth.user.id);
  if (membershipError) return teamServiceFailure(membershipError, 'Could not load teams.');
  const teamIds = (memberships || []).map((row) => row.team_id);
  if (teamIds.length === 0) return NextResponse.json({ teams: [] });

  const { data: teams, error } = await auth.admin
    .from('teams')
    .select('*')
    .in('id', teamIds)
    .order('created_at', { ascending: false });
  if (error) return teamServiceFailure(error, 'Could not load teams.');

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
  if (error) return teamCreationFailure(error);
  if (!team) return teamServiceFailure(null, 'Could not create the team.');

  return NextResponse.json({ team: { ...team, my_role: 'owner' } }, { status: 201 });
}
