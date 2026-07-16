import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateContentType, validateOrigin } from '@/lib/api-security';
import { adminClient } from '@/lib/share-guard';
import {
  MCP_ACCOUNT_SCOPE,
  MCP_AUTH_CODE_TTL_SECONDS,
  expiresAt,
  isValidOAuthState,
  isValidPkceChallenge,
  randomOpaqueCode,
  safeClientName,
  sha256,
  validLoopbackRedirect,
} from '@/lib/mcp-account-oauth';

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

  const redirectUri = validLoopbackRedirect(body.redirect_uri);
  if (!redirectUri || !isValidOAuthState(body.state) || !isValidPkceChallenge(body.code_challenge)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (body.code_challenge_method !== 'S256') {
    return NextResponse.json({ error: 'invalid_request', error_description: 'S256 is required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) {
    return NextResponse.json({ error: 'login_required' }, { status: 401 });
  }

  const code = randomOpaqueCode('argus_code_');
  const admin = adminClient();
  const { error: insertError } = await admin.from('mcp_account_authorizations').insert({
    flow: 'authorization_code',
    user_id: user.id,
    code_hash: sha256(code),
    code_challenge: body.code_challenge,
    redirect_uri: redirectUri,
    client_name: safeClientName(body.client_name),
    scope: MCP_ACCOUNT_SCOPE,
    status: 'approved',
    expires_at: expiresAt(MCP_AUTH_CODE_TTL_SECONDS),
  });
  if (insertError) {
    console.error('[mcp/oauth/authorize] grant insert failed:', insertError.message);
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 });
  }

  const callback = new URL(redirectUri);
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', body.state);
  return NextResponse.json({ redirect_url: callback.toString() });
}
