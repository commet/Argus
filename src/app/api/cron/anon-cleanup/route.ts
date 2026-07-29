import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';
import { logServerEvent } from '@/lib/server-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron: retire abandoned anonymous voyages (창업자 승인 2026-07-29).
 *
 * A logged-out visitor gets a durable anonymous auth identity so their work
 * reaches the server — that is deliberate and stays. But the session token that
 * reaches it lives only in that browser's localStorage. Clear the browser, switch
 * device, or simply never come back, and those rows become **unreachable by
 * anyone, including the person who wrote them**: kept without consent, and
 * impossible for them to erase.
 *
 * With anonymous expected to be 95%+ of early traffic, that pile grows linearly
 * with reach. So: an anonymous identity with no activity for RETENTION_DAYS is
 * erased the same way an account deletion erases — every user-scoped table, then
 * the identity itself.
 *
 * Deliberately conservative:
 *   - PERMANENT accounts are never touched (`is_anonymous = false` is excluded in
 *     SQL AND re-checked per user before any delete).
 *   - Activity is the LATEST of the auth timestamps and the newest row the user
 *     owns in the tables that hold real work — a voyage that is still being read
 *     from another tab is not "abandoned" just because sign-in is old.
 *   - DRY RUN unless ANON_CLEANUP_ENABLED is truthy: it reports what it would
 *     erase and touches nothing. The founder turns it on after reading a dry run.
 *   - Per-run cap so a first live run cannot delete thousands in one pass.
 *
 * NOTIFICATION_GATE_NO_USER_SEND: maintenance only; sends nothing to users.
 */

const RETENTION_DAYS = Number(process.env.ANON_RETENTION_DAYS || 90);
const MAX_PER_RUN = Number(process.env.ANON_CLEANUP_MAX_PER_RUN || 50);

/** Tables whose newest row counts as "this voyage is still alive". Deliberately
 *  the ones holding authored work — not counters like rate_limits/user_events,
 *  which tick without the person doing anything meaningful. */
const ACTIVITY_TABLES = ['projects', 'progressive_sessions', 'review_receipts', 'decision_items'] as const;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function enabled(): boolean {
  const v = (process.env.ANON_CLEANUP_ENABLED || '').toLowerCase();
  return v === 'true' || v === '1';
}

/** Newest authored-row timestamp across ACTIVITY_TABLES for one user. */
async function lastAuthoredAt(admin: SupabaseClient, userId: string): Promise<string | null> {
  let newest: string | null = null;
  for (const table of ACTIVITY_TABLES) {
    const { data } = await admin
      .from(table)
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);
    const ts = (data?.[0] as { updated_at?: string } | undefined)?.updated_at;
    if (ts && (!newest || ts > newest)) newest = ts;
  }
  return newest;
}

export async function GET(req: NextRequest) {
  // Fail CLOSED: an unset secret must never let `Bearer undefined` authorize a
  // service-role mass delete.
  const authHeader = req.headers.get('authorization') || '';
  if (!process.env.CRON_SECRET || !safeEqual(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });

  // `?live=1` alone is not enough — the env switch must ALSO be on. Two hands on
  // the button for the only cron in this repo that deletes user content.
  const live = enabled() && new URL(req.url).searchParams.get('live') === '1';
  const admin = createClient(url, serviceKey);
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();

  // auth.admin.listUsers is paginated; one page is plenty at this scale and the
  // per-run cap bounds the work anyway.
  const { data: page, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    console.error('[anon-cleanup] listUsers failed:', listErr.message);
    return NextResponse.json({ error: 'list failed' }, { status: 500 });
  }

  const candidates: Array<{ id: string; lastSeen: string }> = [];
  let anonTotal = 0;
  for (const u of page.users) {
    if (!u.is_anonymous) continue; // permanent accounts are never in scope
    anonTotal++;
    const authSeen = [u.last_sign_in_at, u.updated_at, u.created_at].filter(Boolean).sort().pop() as string;
    const authored = await lastAuthoredAt(admin, u.id);
    const lastSeen = authored && authored > authSeen ? authored : authSeen;
    if (lastSeen < cutoff) candidates.push({ id: u.id, lastSeen });
  }
  candidates.sort((a, b) => (a.lastSeen < b.lastSeen ? -1 : 1)); // oldest first
  const batch = candidates.slice(0, MAX_PER_RUN);

  const erased: Array<{ id: string; rows: number }> = [];
  const failed: string[] = [];

  if (live) {
    for (const c of batch) {
      // Re-read the identity immediately before deleting. Between the list call
      // and here the visitor may have signed up — that turns an anonymous id into
      // a real account, and erasing it would delete a paying user's work.
      const { data: fresh } = await admin.auth.admin.getUserById(c.id);
      if (!fresh?.user || fresh.user.is_anonymous !== true) { failed.push(c.id); continue; }

      let rows = 0;
      let hadError = false;
      for (const table of USER_DATA_TABLES) {
        const { count, error } = await admin.from(table).delete({ count: 'exact' }).eq('user_id', c.id);
        if (error) { hadError = true; console.error('[anon-cleanup]', table, error.message); break; }
        rows += count ?? 0;
      }
      // Same all-or-nothing gate as /api/account/delete: never orphan rows under a
      // deleted identity. A failure here just leaves the voyage for the next run.
      if (hadError) { failed.push(c.id); continue; }
      const { error: delErr } = await admin.auth.admin.deleteUser(c.id);
      if (delErr) { failed.push(c.id); continue; }
      erased.push({ id: c.id, rows });
    }
    logServerEvent('anon_cleanup', { erased: erased.length, failed: failed.length, retention_days: RETENTION_DAYS });
  }

  return NextResponse.json({
    ok: true,
    dry_run: !live,
    reason: live ? undefined : (enabled() ? 'pass ?live=1 to erase' : 'ANON_CLEANUP_ENABLED not set'),
    retention_days: RETENTION_DAYS,
    cutoff,
    anonymous_identities: anonTotal,
    abandoned: candidates.length,
    would_erase: batch.length,
    erased: erased.length,
    rows_erased: erased.reduce((n, e) => n + e.rows, 0),
    failed: failed.length,
    oldest_seen: batch[0]?.lastSeen ?? null,
  });
}
