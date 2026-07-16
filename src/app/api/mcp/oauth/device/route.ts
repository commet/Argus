import { NextRequest, NextResponse } from 'next/server';
import { validateContentType } from '@/lib/api-security';
import { adminClient } from '@/lib/share-guard';
import {
  MCP_ACCOUNT_SCOPE,
  MCP_DEVICE_CODE_TTL_SECONDS,
  MCP_DEVICE_POLL_INTERVAL_SECONDS,
  expiresAt,
  randomOpaqueCode,
  randomUserCode,
  safeClientName,
  sha256,
} from '@/lib/mcp-account-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const contentTypeError = validateContentType(req);
  if (contentTypeError) return contentTypeError;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const deviceCode = randomOpaqueCode('argus_device_', 40);
  const userCode = randomUserCode();
  const admin = adminClient();
  const { error } = await admin.from('mcp_account_authorizations').insert({
    flow: 'device_code',
    code_hash: sha256(deviceCode),
    user_code_hash: sha256(userCode),
    client_name: safeClientName(body.client_name),
    scope: MCP_ACCOUNT_SCOPE,
    status: 'pending',
    interval_seconds: MCP_DEVICE_POLL_INTERVAL_SECONDS,
    expires_at: expiresAt(MCP_DEVICE_CODE_TTL_SECONDS),
  });
  if (error) {
    console.error('[mcp/oauth/device] grant insert failed:', error.message);
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 });
  }

  const origin = new URL(req.url).origin;
  const verificationUri = `${origin}/en/auth/callback/mcp-device`;
  return NextResponse.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?user_code=${encodeURIComponent(userCode)}`,
    expires_in: MCP_DEVICE_CODE_TTL_SECONDS,
    interval: MCP_DEVICE_POLL_INTERVAL_SECONDS,
  });
}
