import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildSemanticWebCommand,
  semanticWebCommandFromRequest,
} from '@/lib/semantic-web';
import { appendProjectSemanticEvents, readProjectSemanticEvents } from '@/lib/semantic-ledger-gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ projectId: string }> };

function serviceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null;
}

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const config = serviceConfig();
  if (!authHeader?.startsWith('Bearer ') || !config) return null;
  const auth = createClient(config.url, config.anonKey);
  const { data: { user }, error } = await auth.auth.getUser(authHeader.slice(7));
  return error || !user ? null : { user, admin: createClient(config.url, config.serviceKey) };
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { projectId } = await params;
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: 'Bad project id.' }, { status: 400 });

  const events = await readProjectSemanticEvents(auth.admin, auth.user.id, projectId);
  if (!events) return NextResponse.json({ error: 'Could not read semantic ledger.' }, { status: 500 });
  return NextResponse.json({ ok: true, events });
}

/**
 * The only web write gateway for v3 events. The route authenticates the actor,
 * translates a named UI command, validates the canonical reducer transition,
 * then asks Postgres to append the whole batch under a per-project lock.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await authenticate(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const { projectId } = await params;
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: 'Bad project id.' }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const input = semanticWebCommandFromRequest(projectId, body);
  if (!input) return NextResponse.json({ error: 'Bad semantic command.' }, { status: 400 });
  const built = buildSemanticWebCommand(input);
  if (!built.ok) return NextResponse.json({ error: built.code }, { status: 400 });

  const appended = await appendProjectSemanticEvents(auth.admin, auth.user.id, projectId, built.events);
  if (!appended.ok) {
    const code = appended.code;
    const status = code === 'FORBIDDEN' ? 403 : code === 'APPEND_FAILED' ? 500 : 409;
    return NextResponse.json({ error: code }, { status });
  }

  return NextResponse.json({ ok: true, events: appended.events, receipt: appended.receipt });
}
