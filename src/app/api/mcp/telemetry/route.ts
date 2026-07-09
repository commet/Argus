import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';

/**
 * Anonymous, opt-in MCP telemetry sink. The argus-decision-mcp server POSTs here
 * ONLY when the user set `ARGUS_TELEMETRY=1` (off by default). The payload is
 * intentionally content-free: a random install id, which of our tools ran, and
 * coarse version/platform — never a token, never decision content. So this
 * endpoint takes NO auth (there is no user to authenticate) and stores no PII.
 *
 * Server-only table (`mcp_telemetry`, no `user_id`) written with the service
 * role — it is NOT a user-scoped table, so it is deliberately absent from the
 * erasure/export registries (there is no identity to erase).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4 * 1024;
const EVENTS = new Set(['server_start', 'tool_call']);

/** Allow-list of OUR tool names — anything else is dropped, never stored raw. */
const TOOLS = new Set([
  'argus_amend',
  'argus_check_in',
  'argus_config',
  'argus_dismiss',
  'argus_init',
  'argus_open_decision',
  'argus_premises',
  'argus_recall',
  'argus_recheck',
  'argus_review',
  'argus_seal',
  'argus_settle',
  'argus_sync',
  'argus_watch',
]);

const PLATFORMS = new Set(['darwin', 'linux', 'win32', 'freebsd', 'openbsd', 'aix', 'sunos']);

function boundedStr(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;
}

export async function POST(req: NextRequest) {
  const cl = req.headers.get('content-length');
  if (cl && parseInt(cl, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const install_id = boundedStr(body.install_id, 64);
  const event = boundedStr(body.event, 32);
  if (!install_id || !event || !EVENTS.has(event)) {
    return NextResponse.json({ error: 'invalid event' }, { status: 400 });
  }

  const toolRaw = boundedStr(body.tool, 64);
  const platform = boundedStr(body.platform, 16);
  const row = {
    install_id,
    event,
    // Only store a tool name for tool_call events, and only if it's one of ours.
    tool: event === 'tool_call' && toolRaw && TOOLS.has(toolRaw) ? toolRaw : null,
    ok: typeof body.ok === 'boolean' ? body.ok : null,
    version: boundedStr(body.version, 32),
    platform: platform && PLATFORMS.has(platform) ? platform : null,
    node_major: Number.isInteger(body.node_major) ? (body.node_major as number) : null,
  };

  const admin = adminClient();
  const { error } = await admin.from('mcp_telemetry').insert(row);
  if (error) {
    // Best-effort and anonymous — never surface a failure to the client.
    console.error('[mcp/telemetry] insert failed:', error.message);
  }
  return new NextResponse(null, { status: 204 });
}
