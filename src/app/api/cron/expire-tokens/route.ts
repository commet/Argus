import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

/** Constant-time string compare (avoids leaking the secret via timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Cron: expire stale human agent message tokens.
 *
 * Runs daily. Sets status='expired' for messages past their expires_at.
 * Also updates progressive_sessions.has_pending_humans accordingly.
 *
 * Schedule: daily (e.g., via Vercel Cron or Supabase pg_cron)
 * Auth: CRON_SECRET header
 */

export async function GET(req: NextRequest) {
  // Fail CLOSED: if CRON_SECRET is unset, an `Authorization: Bearer undefined`
  // would otherwise authorize a service-role mass-update. Mirror daily-report.
  const authHeader = req.headers.get('authorization') || '';
  if (!process.env.CRON_SECRET || !safeEqual(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Find and expire stale messages
  const { data: expired, error } = await admin
    .from('human_agent_messages')
    .update({ status: 'expired' })
    .eq('status', 'sent')
    .lt('expires_at', new Date().toISOString())
    .select('session_id, worker_id');

  if (error) {
    console.error('[cron/expire-tokens] Error:', error.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  // Update has_pending_humans for affected sessions
  const sessionIds = [...new Set((expired || []).map(e => e.session_id))];
  for (const sid of sessionIds) {
    // Per-iteration guard: a single failure must not abort the rest (leaving
    // later sessions' has_pending_humans stale).
    try {
      const { data: remaining } = await admin
        .from('human_agent_messages')
        .select('id')
        .eq('session_id', sid)
        .eq('status', 'sent')
        .limit(1);

      await admin
        .from('progressive_sessions')
        .update({ has_pending_humans: (remaining?.length ?? 0) > 0, updated_at: new Date().toISOString() })
        .eq('id', sid);
    } catch (e) {
      console.error('[cron/expire-tokens] session update failed:', sid, e);
    }
  }

  return NextResponse.json({ ok: true, expired: expired?.length ?? 0, sessions: sessionIds.length });
}
