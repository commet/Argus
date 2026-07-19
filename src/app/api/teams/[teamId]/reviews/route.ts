import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateContentLength, validateContentType, validateOrigin } from '@/lib/api-security';
import { authenticateTeamRequest, canManageTeam, getTeamAccess, getUsersById, userDisplayName, UUID_RE } from '@/lib/team-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ teamId: string }> };
const INPUT_TYPES = new Set(['rating', 'concern', 'endorsement', 'alternative']);

async function projectBelongsToTeam(admin: SupabaseClient, projectId: string, teamId: string) {
  const { data } = await admin.from('projects').select('id').eq('id', projectId).eq('team_id', teamId).maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticateTeamRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { teamId } = await params;
  const projectId = req.nextUrl.searchParams.get('projectId') || '';
  if (!UUID_RE.test(teamId) || !UUID_RE.test(projectId)) return NextResponse.json({ error: 'Invalid review target.' }, { status: 400 });
  const access = await getTeamAccess(auth.admin, teamId, auth.user.id);
  if (!access || !await projectBelongsToTeam(auth.admin, projectId, teamId)) {
    return NextResponse.json({ error: 'Shared project not found.' }, { status: 404 });
  }

  const { data, error } = await auth.admin
    .from('team_review_inputs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at');
  if (error) return NextResponse.json({ error: 'Could not load team feedback.' }, { status: 500 });
  const allRows = data || [];
  const rows = allRows.filter((row) => row.visible || row.user_id === auth.user.id);
  const users = await getUsersById(auth.admin, rows.map((row) => row.user_id));
  return NextResponse.json({
    hiddenCount: canManageTeam(access) ? allRows.filter((row) => !row.visible).length : rows.filter((row) => !row.visible).length,
    inputs: rows.map((row) => {
      const user = users.get(row.user_id);
      return { ...row, user_name: userDisplayName(user) || user?.email?.split('@')[0] || null };
    }),
  });
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
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  if (!UUID_RE.test(teamId) || !UUID_RE.test(projectId)) return NextResponse.json({ error: 'Invalid review target.' }, { status: 400 });
  const access = await getTeamAccess(auth.admin, teamId, auth.user.id);
  if (!access || !await projectBelongsToTeam(auth.admin, projectId, teamId)) {
    return NextResponse.json({ error: 'Shared project not found.' }, { status: 404 });
  }
  const inputType = typeof body.inputType === 'string' && INPUT_TYPES.has(body.inputType) ? body.inputType : 'concern';
  const rating = typeof body.rating === 'number' && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) : '';
  if (!rating && !comment) return NextResponse.json({ error: 'Add a rating or a comment.' }, { status: 400 });

  const { data, error } = await auth.admin.from('team_review_inputs').insert({
    project_id: projectId,
    user_id: auth.user.id,
    phase: 'rehearse',
    target_type: 'general',
    target_id: null,
    input_type: inputType,
    rating,
    comment: comment || null,
    visible: false,
  }).select().single();
  if (error || !data) return NextResponse.json({ error: 'Could not save team feedback.' }, { status: 500 });
  return NextResponse.json({ input: { ...data, user_name: userDisplayName(auth.user) || auth.user.email?.split('@')[0] || null } }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const contentTypeError = validateContentType(req);
  if (contentTypeError) return contentTypeError;
  const contentLengthError = validateContentLength(req);
  if (contentLengthError) return contentLengthError;
  const originError = validateOrigin(req);
  if (originError) return originError;
  const auth = await authenticateTeamRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { teamId } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  if (!UUID_RE.test(teamId) || !UUID_RE.test(projectId)) return NextResponse.json({ error: 'Invalid review target.' }, { status: 400 });
  const access = await getTeamAccess(auth.admin, teamId, auth.user.id);
  if (!canManageTeam(access) || !await projectBelongsToTeam(auth.admin, projectId, teamId)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const { error } = await auth.admin
    .from('team_review_inputs')
    .update({ visible: true })
    .eq('project_id', projectId)
    .eq('phase', 'rehearse');
  if (error) return NextResponse.json({ error: 'Could not publish team feedback.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
