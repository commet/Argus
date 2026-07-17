import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseJudgmentArchive } from '@/lib/epistemic/server-judgment-archive';
import { restoreJudgmentArchive } from '@/lib/epistemic/archive-restore';
import { ServerArchiveRestoreGateway } from '@/lib/epistemic/server-archive-restore';

const MAX_BODY = 64 * 1024 * 1024;

function validProjectMapping(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value as Record<string, unknown>).every(([source, target]) =>
      source.length > 0 && source.length <= 512 && typeof target === 'string' && target.length > 0 && target.length <= 512);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  const authClient = createClient(url, anonKey);
  const { data: { user }, error: authError } = await authClient.auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (req.headers.get('x-argus-target-account') !== user.id) {
    return NextResponse.json({ error: 'Target account confirmation mismatch.' }, { status: 400 });
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY) return NextResponse.json({ error: 'Archive too large.' }, { status: 413 });
  let mapping: Record<string, string> = {};
  try {
    const encoded = req.headers.get('x-argus-project-mapping') ?? '';
    const decoded = encoded ? JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) : {};
    if (!validProjectMapping(decoded)) throw new Error('invalid mapping');
    mapping = decoded;
  } catch {
    return NextResponse.json({ error: 'Invalid project mapping.' }, { status: 400 });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > MAX_BODY) return NextResponse.json({ error: 'Archive too large.' }, { status: 413 });
  const admin = createClient(url, serviceKey);
  let archive;
  try {
    archive = await parseJudgmentArchive(bytes, {
      signing_key: process.env.ARGUS_EXPORT_SIGNING_KEY,
      require_signature: process.env.ARGUS_RESTORE_REQUIRE_SIGNATURE === 'true',
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message.split(':')[0] : 'ARCHIVE_INVALID',
    }, { status: 400 });
  }
  try {
    const dryRun = req.headers.get('x-argus-dry-run') === 'true';
    const receipt = await restoreJudgmentArchive({
      archive,
      gateway: new ServerArchiveRestoreGateway(admin, user.id),
      target_account_id: user.id,
      target_account_confirmation: user.id,
      project_mapping: mapping,
      dry_run: dryRun,
    });
    if (!dryRun) {
      const recorded = await admin.rpc('record_epistemic_restore_receipt', {
        p_user_id: user.id,
        p_restore_id: receipt.restore_id,
        p_archive_id: archive.manifest.archive_id,
        p_source_account_id: archive.manifest.source_account_id,
        p_status: receipt.status === 'dry_run' ? 'failed' : receipt.status,
        p_receipt: receipt,
      });
      if (recorded.error) {
        return NextResponse.json({
          ...receipt,
          status: 'failed',
          error_code: 'RESTORE_RECEIPT_PERSIST_FAILED',
        }, { status: 500 });
      }
    }
    const status = receipt.status === 'restored' || receipt.status === 'dry_run'
      ? 200 : receipt.status === 'conflict' ? 409 : 500;
    return NextResponse.json(receipt, { status });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(':')[0] : 'RESTORE_FAILED';
    return NextResponse.json({
      error: code,
    }, { status: code.includes('READ_FAILED') ? 503 : 500 });
  }
}
