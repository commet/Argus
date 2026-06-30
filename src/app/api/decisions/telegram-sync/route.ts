import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bridge a WEB-sealed decision into telegram_decisions so the existing daily
 * reminder cron (api/cron/telegram-reminders) returns on the user's date via the
 * one push channel that actually works.
 *
 * Why this exists: channel coverage used to be per-TABLE, not per-USER. A web
 * seal writes projects.decision_contract; the cron only reads telegram_decisions
 * (written exclusively by the bot). So a Telegram-connected user who did their
 * deciding in the web voyage got NO return push on their date — the product's
 * defining promise ("on your day, I return") silently never fired for the most
 * engaged cohort (audit 2026-06-30, finding #1). This route closes that gap by
 * reusing the channel that already works, with no new outbound infrastructure.
 *
 * No-op (200, synced:false) when the user has no Telegram connection — the common
 * case — so the client can fire-and-forget without branching on connection state.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The check_by column is a DATE; match the cron's KST "today" semantics. */
function kstDate(iso: string): string | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // Verify the caller owns the account they're syncing for (bearer token).
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const authClient = createClient(url, anonKey);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const b = (body ?? {}) as Record<string, unknown>;
  const projectId = typeof b.projectId === 'string' ? b.projectId : '';
  const decision = typeof b.decision === 'string' ? b.decision.slice(0, 500) : '';
  const predicate = typeof b.predicate === 'string' ? b.predicate.slice(0, 1000) : '';
  const falsifiedIf = typeof b.falsifiedIf === 'string' ? b.falsifiedIf.slice(0, 1000) : null;
  const checkInAt = typeof b.checkInAt === 'string' ? b.checkInAt : '';
  if (!UUID_RE.test(projectId) || !predicate || !checkInAt) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const checkBy = kstDate(checkInAt);
  if (!checkBy) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const admin = createClient(url, serviceKey);

  // Only mirror for users who connected Telegram (the channel that can push).
  // Most users have no row → 200 synced:false, the client need not care.
  const { data: conn } = await admin
    .from('telegram_connections')
    .select('chat_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!conn?.chat_id) {
    return NextResponse.json({ ok: true, synced: false, reason: 'no_telegram' });
  }

  // Upsert keyed on the web project id (a uuid) so re-sealing the same decision
  // updates the row in place and RE-ARMS the reminder (reminded_at=null) for the
  // new date — rather than stacking a duplicate reminder per re-seal.
  const { error } = await admin.from('telegram_decisions').upsert({
    id: projectId,
    user_id: user.id,
    chat_id: conn.chat_id,
    source: 'web',
    decision: decision || '(decision)',
    predicate,
    falsified_if: falsifiedIf,
    check_by: checkBy,
    status: 'sealed',
    reminded_at: null,
    settled_at: null,
  }, { onConflict: 'id' });

  if (error) {
    console.error('[decisions/telegram-sync] upsert failed:', error.message);
    return NextResponse.json({ error: 'Sync failed.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, synced: true });
}
