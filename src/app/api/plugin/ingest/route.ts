import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';
import { ingestPluginFiles, type FileInput } from '@/lib/plugin-ingest-core';
import { authenticatePluginToken, SCOPE_FULL } from '@/lib/plugin-token-auth';

/**
 * Automatic plugin push target. The `argus push` CLI command POSTs the local
 * ledger + bearing files here, authenticated with a personal access token
 * (Authorization: Bearer argus_pat_…). We resolve the token → user via its hash
 * and land the rows through the same ingest core the manual /import page uses.
 *
 * This is a server-to-server endpoint (no browser Origin); auth is the PAT, not
 * a session, so we deliberately don't run the CSRF Origin check.
 */
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

  // 계정 전체 범위. 원격 커넥터가 동의로 받아 가는 `argus.decisions` 토큰으로는
  // 남의 계정에 파일을 적재할 수 없다 — 그 동의는 적재를 말한 적이 없다.
  const auth = await authenticatePluginToken(req.headers.get('authorization'), SCOPE_FULL);
  if (!auth.ok) {
    if (auth.reason === 'insufficient_scope') {
      return NextResponse.json({ error: 'This token is not scoped for ingest' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Missing, invalid, revoked, or expired token. Re-issue with /argus:settings connect.' },
      { status: 401 },
    );
  }

  const admin = adminClient();
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

  const summary = await ingestPluginFiles(admin, auth.userId, clean, 'push');

  // last_used 스탬프는 authenticatePluginToken 이 이미 찍었다 (한 곳에서만).
  if (summary.error && summary.decisions.written === 0 && summary.bearings.written === 0) {
    return NextResponse.json({ error: summary.error, summary }, { status: 502 });
  }
  return NextResponse.json({ ok: true, summary });
}
