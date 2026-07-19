import { NextRequest, NextResponse } from 'next/server';
import { validateContentLength, validateContentType, validateOrigin } from '@/lib/api-security';
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

  const { data: projects, error } = await auth.admin
    .from('projects')
    .select('id, user_id, name, description, refs, meta_reflection, confidence_at_completion, outcome, decision_contract, team_id, created_at, updated_at')
    .eq('team_id', teamId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load shared projects.' }, { status: 500 });

  const projectIds = (projects || []).map((project) => project.id);
  const { data: sessionRows, error: sessionError } = projectIds.length
    ? await auth.admin
      .from('progressive_sessions')
      .select('project_id, data, updated_at')
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false })
    : { data: [], error: null };
  if (sessionError) return NextResponse.json({ error: 'Could not load shared project details.' }, { status: 500 });

  const sessionByProject = new Map<string, unknown>();
  for (const row of sessionRows || []) {
    if (!sessionByProject.has(row.project_id)) sessionByProject.set(row.project_id, row.data);
  }
  const owners = await getUsersById(auth.admin, (projects || []).map((project) => project.user_id));
  return NextResponse.json({
    projects: (projects || []).map((project) => {
      const owner = owners.get(project.user_id);
      return {
        ...project,
        owner_email: owner?.email || null,
        owner_name: userDisplayName(owner),
        session: sessionByProject.get(project.id) || null,
      };
    }),
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  return changeShare(req, params, true);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return changeShare(req, params, false);
}

async function changeShare(req: NextRequest, paramsPromise: Params['params'], sharing: boolean) {
  const contentTypeError = validateContentType(req);
  if (contentTypeError) return contentTypeError;
  const contentLengthError = validateContentLength(req);
  if (contentLengthError) return contentLengthError;
  const originError = validateOrigin(req);
  if (originError) return originError;
  const auth = await authenticateTeamRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { teamId } = await paramsPromise;
  if (!UUID_RE.test(teamId)) return NextResponse.json({ error: 'Invalid team.' }, { status: 400 });
  const access = await getTeamAccess(auth.admin, teamId, auth.user.id);
  if (!access) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: 'Invalid project.' }, { status: 400 });

  const { data: project, error: projectError } = await auth.admin
    .from('projects')
    .select('id, user_id, team_id')
    .eq('id', projectId)
    .maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: 'Project not found in cloud sync.' }, { status: 404 });
  const ownsProject = project.user_id === auth.user.id;
  if (!ownsProject && !(canManageTeam(access) && project.team_id === teamId)) {
    return NextResponse.json({ error: 'Only the project owner can share this project.' }, { status: 403 });
  }

  const { data: updated, error } = await auth.admin
    .from('projects')
    .update({ team_id: sharing ? teamId : null, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .select('id')
    .maybeSingle();
  if (error || !updated) return NextResponse.json({ error: 'Could not update project sharing.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
