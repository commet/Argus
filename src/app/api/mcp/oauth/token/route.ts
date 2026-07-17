import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { validateContentType } from '@/lib/api-security';
import { adminClient } from '@/lib/share-guard';
import { pluginTokenExpiry, PLUGIN_TOKEN_TTL_DAYS } from '@/lib/plugin-token';
import {
  MCP_ACCOUNT_SCOPE,
  isValidPkceVerifier,
  pkceChallenge,
  sha256,
  validLoopbackRedirect,
} from '@/lib/mcp-account-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GrantRow = {
  id: string;
  flow: 'authorization_code' | 'device_code';
  user_id: string | null;
  code_challenge: string | null;
  redirect_uri: string | null;
  client_name: string;
  status: 'pending' | 'approved' | 'consumed' | 'denied';
  interval_seconds: number;
  last_polled_at: string | null;
  expires_at: string;
};

function oauthError(error: string, status = 400, description?: string) {
  return NextResponse.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const contentTypeError = validateContentType(req);
  if (contentTypeError) return contentTypeError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return oauthError('invalid_request');
  }

  const grantType = body.grant_type;
  const isAuthCode = grantType === 'authorization_code';
  const isDevice = grantType === 'urn:ietf:params:oauth:grant-type:device_code';
  if (!isAuthCode && !isDevice) return oauthError('unsupported_grant_type');

  const rawCode = isAuthCode ? body.code : body.device_code;
  if (typeof rawCode !== 'string' || rawCode.length < 30 || rawCode.length > 200) {
    return oauthError('invalid_grant');
  }

  const admin = adminClient();
  const { data, error } = await admin
    .from('mcp_account_authorizations')
    .select('id, flow, user_id, code_challenge, redirect_uri, client_name, status, interval_seconds, last_polled_at, expires_at')
    .eq('code_hash', sha256(rawCode))
    .maybeSingle();
  const grant = data as GrantRow | null;
  if (error || !grant || grant.flow !== (isAuthCode ? 'authorization_code' : 'device_code')) {
    return oauthError('invalid_grant');
  }
  const now = Date.now();
  if (Date.parse(grant.expires_at) <= now) return oauthError('expired_token');
  if (grant.status === 'denied') return oauthError('access_denied');
  if (grant.status === 'consumed') return oauthError('invalid_grant');

  if (isAuthCode) {
    const redirectUri = validLoopbackRedirect(body.redirect_uri);
    if (!redirectUri || redirectUri !== grant.redirect_uri || !isValidPkceVerifier(body.code_verifier)) {
      return oauthError('invalid_grant');
    }
    if (pkceChallenge(body.code_verifier) !== grant.code_challenge) return oauthError('invalid_grant');
  } else {
    const lastPoll = grant.last_polled_at ? Date.parse(grant.last_polled_at) : 0;
    if (lastPoll && now - lastPoll < grant.interval_seconds * 1000) {
      return oauthError('slow_down');
    }
    await admin.from('mcp_account_authorizations').update({ last_polled_at: new Date(now).toISOString() }).eq('id', grant.id);
    if (grant.status === 'pending') return oauthError('authorization_pending');
  }

  if (grant.status !== 'approved' || !grant.user_id) return oauthError('invalid_grant');

  // Claim the grant atomically before minting a durable credential. A second
  // exchange receives no row and cannot mint another PAT from the same code.
  const { data: claimed, error: claimError } = await admin
    .from('mcp_account_authorizations')
    .update({ status: 'consumed', consumed_at: new Date(now).toISOString() })
    .eq('id', grant.id)
    .eq('status', 'approved')
    .select('id')
    .maybeSingle();
  if (claimError || !claimed) return oauthError('invalid_grant');

  const { count } = await admin
    .from('plugin_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', grant.user_id);
  if ((count ?? 0) >= 10) return oauthError('access_denied', 429, 'Token limit reached; revoke one in Settings.');

  const accessToken = `argus_pat_${randomBytes(24).toString('hex')}`;
  const expiresAt = pluginTokenExpiry(now);
  const { error: tokenError } = await admin.from('plugin_tokens').insert({
    user_id: grant.user_id,
    token_hash: sha256(accessToken),
    label: grant.client_name,
    expires_at: expiresAt,
  });
  if (tokenError) {
    console.error('[mcp/oauth/token] token insert failed:', tokenError.message);
    return oauthError('temporarily_unavailable', 503);
  }

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: PLUGIN_TOKEN_TTL_DAYS * 24 * 60 * 60,
    expires_at: expiresAt,
    scope: MCP_ACCOUNT_SCOPE,
  }, { headers: { 'cache-control': 'no-store', pragma: 'no-cache' } });
}
