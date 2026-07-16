import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateContentType, validateOrigin } from '@/lib/api-security';
import { adminClient } from '@/lib/share-guard';
import { normalizeUserCode, sha256 } from '@/lib/mcp-account-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const contentTypeError = validateContentType(req);
  if (contentTypeError) return contentTypeError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'login_required' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const userCode = normalizeUserCode(typeof body.user_code === 'string' ? body.user_code : '');
  if (userCode.length !== 9) {
    return NextResponse.json({ error: 'invalid_user_code' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) {
    return NextResponse.json({ error: 'login_required' }, { status: 401 });
  }

  const admin = adminClient();
  const now = new Date().toISOString();
  const { data, error: updateError } = await admin
    .from('mcp_account_authorizations')
    .update({ user_id: user.id, status: 'approved' })
    .eq('flow', 'device_code')
    .eq('user_code_hash', sha256(userCode))
    .eq('status', 'pending')
    .gt('expires_at', now)
    .select('client_name')
    .maybeSingle();
  if (updateError) {
    console.error('[mcp/oauth/device/approve] grant update failed:', updateError.message);
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: 'invalid_or_expired_user_code' }, { status: 404 });

  return NextResponse.json({ ok: true, client_name: data.client_name });
}
