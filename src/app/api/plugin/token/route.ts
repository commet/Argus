import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'crypto';
import { validateContentType, validateOrigin } from '@/lib/api-security';
import { adminClient } from '@/lib/share-guard';
import { pluginTokenExpiry } from '@/lib/plugin-token';

/**
 * Issue a personal access token for `argus push`. The raw token is returned
 * ONCE and never stored; we keep only its SHA-256 hash. Listing and revoking
 * happen client-side against plugin_tokens (RLS, metadata columns only).
 */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function POST(req: NextRequest) {
  const ctError = validateContentType(req);
  if (ctError) return ctError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let label = 'CLI';
  try {
    const body = await req.json();
    if (typeof body?.label === 'string' && body.label.trim()) label = body.label.trim().slice(0, 60);
  } catch { /* empty body ok */ }

  const admin = adminClient();
  // Cap tokens per user to keep the list sane.
  const { count } = await admin
    .from('plugin_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: 'Token limit reached (10). Revoke one first.' }, { status: 429 });
  }

  const raw = `argus_pat_${randomBytes(24).toString('hex')}`;
  const { error: insErr } = await admin.from('plugin_tokens').insert({
    user_id: user.id,
    token_hash: hashToken(raw),
    label,
    expires_at: pluginTokenExpiry(),
  });
  if (insErr) {
    console.error('[plugin/token] insert failed:', insErr.message);
    return NextResponse.json({ error: 'Could not issue token' }, { status: 500 });
  }

  // Returned once; the user copies it into the CLI now or never.
  return NextResponse.json({ token: raw, label });
}
