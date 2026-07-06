import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { adminClient } from '@/lib/share-guard';
import { ingestPluginFiles, type FileInput } from '@/lib/plugin-ingest-core';
import { isTokenExpired } from '@/lib/plugin-token';

/**
 * Automatic plugin push target. The `argus push` CLI command POSTs the local
 * ledger + bearing files here, authenticated with a personal access token
 * (Authorization: Bearer argus_pat_…). We resolve the token → user via its hash
 * and land the rows through the same ingest core the manual /import page uses.
 *
 * This is a server-to-server endpoint (no browser Origin); auth is the PAT, not
 * a session, so we deliberately don't run the CSRF Origin check.
 */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

const MAX_BODY_BYTES = 16 * 1024 * 1024; // 16 MB — core caps content at 15 MB

export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }
  const cl = req.headers.get('content-length');
  if (cl && parseInt(cl, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing token. Run: argus push --token <pat>' }, { status: 401 });
  }
  const raw = authHeader.slice(7).trim();
  if (!raw.startsWith('argus_pat_')) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
  }

  const admin = adminClient();
  const { data: tokenRow } = await admin
    .from('plugin_tokens')
    .select('id, user_id, expires_at')
    .eq('token_hash', hashToken(raw))
    .single();
  if (!tokenRow || isTokenExpired(tokenRow.expires_at)) {
    return NextResponse.json({ error: 'Unknown, revoked, or expired token. Re-issue with /argus:connect.' }, { status: 401 });
  }

  let body: { files?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const files = body.files;
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'files[] is required' }, { status: 400 });
  }
  const clean: FileInput[] = [];
  for (const f of files) {
    if (f && typeof f.name === 'string' && typeof f.content === 'string') {
      clean.push({ name: f.name.slice(0, 200), content: f.content });
    }
  }
  if (clean.length === 0) {
    return NextResponse.json({ error: 'No valid files' }, { status: 400 });
  }

  const summary = await ingestPluginFiles(admin, tokenRow.user_id, clean, 'push');

  // Best-effort: stamp last-used so the user can see the token is live.
  admin.from('plugin_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)
    .then(({ error }) => { if (error) console.error('[plugin/ingest] last_used stamp:', error.message); });

  if (summary.error && summary.decisions.written === 0 && summary.bearings.written === 0) {
    return NextResponse.json({ error: summary.error, summary }, { status: 502 });
  }
  return NextResponse.json({ ok: true, summary });
}
