import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Slack Events API endpoint.
 *
 * Receives:
 * - url_verification (Slack setup challenge)
 * - event_callback with message events (reply detection for human agents)
 *
 * Uses HMAC-SHA256 request signing for verification (not deprecated verification_token).
 */

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Verify Slack request signature using HMAC-SHA256 */
function verifySlackSignature(req: NextRequest, rawBody: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const timestamp = req.headers.get('x-slack-request-timestamp');
  const slackSignature = req.headers.get('x-slack-signature');
  if (!timestamp || !slackSignature) return false;

  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature));
}

export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await req.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Slack URL verification challenge (no signature check needed — Slack docs)
  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  // HMAC signature verification
  if (!verifySlackSignature(req, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Handle event callbacks
  if (body.type === 'event_callback' && body.event) {
    const event = body.event;

    // Only handle message events that are thread replies
    if (event.type === 'message' && event.thread_ts && !event.bot_id && !event.subtype) {
      const admin = getAdmin();

      // Look up tracked thread
      const { data: tracked } = await admin
        .from('human_agent_messages')
        .select('session_id, worker_id')
        .eq('thread_ts', event.thread_ts)
        .eq('channel', 'slack')
        .eq('status', 'sent')
        .limit(1)
        .single();

      if (tracked) {
        const responseText = (event.text || '').slice(0, 10000);

        // Idempotency: claim this message by atomically updating status sent→responded.
        // If another webhook already processed it, 0 rows updated → skip RPC.
        const { data: claimed } = await admin
          .from('human_agent_messages')
          .update({ status: 'responded', response_text: responseText, responded_at: new Date().toISOString() })
          .eq('session_id', tracked.session_id)
          .eq('worker_id', tracked.worker_id)
          .eq('status', 'sent')
          .select('session_id')
          .maybeSingle();

        if (claimed) {
          // First processor — execute RPC
          const { error: rpcErr } = await admin.rpc('update_worker_response', {
            p_session_id: tracked.session_id,
            p_worker_id: tracked.worker_id,
            p_response: responseText,
          });
          if (rpcErr) {
            // Reply is stored on the claimed row but not propagated — log instead
            // of dropping silently (recoverable from human_agent_messages).
            console.error('[slack/events] update_worker_response failed — reply captured but not propagated to session:', rpcErr.message);
          }
        }
      }
    }
  }

  // Always respond 200 to Slack (required within 3s)
  return NextResponse.json({ ok: true });
}
