import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { markdownToEmailHtml } from '@/lib/email-html';
import { buildCompanionBrief, type DueReceiptBrief, type PremiseChange } from '@/lib/companion-brief';
import { type JudgmentReceipt, summarizeReceipt } from '@/lib/review';
import {
  isMonitored,
  isDueForRecheck,
  nextRecheckDue,
  normalizePremiseText,
  dateOnly,
  type PremiseRecheck,
} from '@/lib/premises-core';
import { investigatePremise, type InvestigationResult } from '@/lib/premise-researcher';
import { webSearchEnabled } from '@/lib/web-research';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Autonomous premise watcher cron (Workstream E4). Once a day, BEFORE the
 * companion-brief cron: for each sealed receipt with a monitored + auto_watch
 * premise that is due for a re-check, it researches the recent web (searchRecent
 * → LLM verdict, recency-gated), records what it found into the receipt's premise
 * (source='url', auto=true), and — only on a MATERIAL change with a real recent
 * source — emails a proactive "this looks changed" alert. Everything else stays
 * silent. The email dedup shares `companion_notified_at` so a user never gets two
 * mails for one thing.
 *
 * COST: Brave is metered with no spending cap, so this is guarded hard —
 * (1) PREMISE_WATCH_ENABLED kill-switch, (2) per-run investigation cap,
 * (3) dedup identical premise text across users, (4) only due+auto_watch+monitored
 * premises (cadence throttles), (5) results are never stored raw (only the fact +
 * URL). A monthly budget counter is a fast-follow.
 */

const RENUDGE_DAYS = 7;
const MAX_PER_RUN = Number(process.env.PREMISE_WATCH_MAX_PER_RUN || 200);

function safeCompare(a: string, b: string): boolean {
  const lengthMismatch = a.length !== b.length ? 1 : 0;
  const target = lengthMismatch ? a : b;
  let mismatch = lengthMismatch;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ target.charCodeAt(i);
  return mismatch === 0;
}

function enabled(): boolean {
  const v = (process.env.PREMISE_WATCH_ENABLED || '').toLowerCase();
  return v === 'true' || v === '1';
}

function addDaysYMD(ymd: string, n: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(t)) return ymd;
  return new Date(t + n * 86_400_000).toISOString().slice(0, 10);
}

/** Mirror of review-sync's next_check_by lift (pure; kept inline to avoid pulling
 *  the browser db layer into the cron). Earliest of a sealed prediction's check-by
 *  and any monitored premise's next re-check due. */
function computeNextCheckBy(receipt: JudgmentReceipt, today: string): string | null {
  const dues: string[] = [];
  const base = summarizeReceipt(receipt, today).next_check_by;
  if (base) dues.push(base);
  for (const p of receipt.tracked_premises || []) {
    if (isMonitored(p)) dues.push(nextRecheckDue(p) ?? today);
  }
  return dues.length ? dues.reduce((a, b) => (a < b ? a : b)) : null;
}

interface Row {
  id: string;
  user_id: string;
  next_check_by: string | null;
  companion_notified_at: string | null;
  data: JudgmentReceipt;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!enabled()) return NextResponse.json({ ok: true, disabled: true, reason: 'PREMISE_WATCH_ENABLED not set' });
  if (!webSearchEnabled()) return NextResponse.json({ ok: true, disabled: true, reason: 'web search not configured' });

  const dryRun = new URL(req.url).searchParams.get('dry') === '1';
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const today = new Date().toISOString().slice(0, 10);
  const renudgeCutoff = new Date(Date.now() - RENUDGE_DAYS * 86_400_000).toISOString();

  // Sealed receipts with a due next_check_by (the lift already folds premise dues in).
  const { data: rows, error } = await supabase
    .from('review_receipts')
    .select('id, user_id, next_check_by, companion_notified_at, data')
    .is('deleted_at', null)
    .eq('state', 'sealed')
    .not('next_check_by', 'is', null)
    .lte('next_check_by', today)
    .limit(2000);
  if (error) {
    console.error('[premise-watch] query error:', error.message);
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  const investigated = new Map<string, InvestigationResult>(); // dedup by normalized text
  let budget = MAX_PER_RUN;
  let dropped = 0;
  let researched = 0;
  const byUser = new Map<string, { rowIds: string[]; briefs: DueReceiptBrief[] }>();
  const rowUpdates: Array<{ id: string; data: JudgmentReceipt; next_check_by: string | null }> = [];

  for (const row of (rows || []) as Row[]) {
    const receipt = row.data;
    const premises = receipt.tracked_premises || [];
    const changes: PremiseChange[] = [];
    let mutated = false;

    for (const p of premises) {
      if (p.status !== 'active' || !isMonitored(p) || !p.auto_watch) continue;
      if (!isDueForRecheck(p, today)) continue;

      const key = normalizePremiseText(p.text);
      let result = investigated.get(key);
      if (!result) {
        if (budget <= 0) { dropped++; continue; } // per-run cost cap
        budget--;
        researched++;
        const baselineYMD = dateOnly(p.last_recheck?.ts) ?? dateOnly(p.added_ts) ?? addDaysYMD(today, -365);
        result = await investigatePremise({
          text: p.text,
          watch_query: p.watch_query,
          kind: p.kind,
          baselineYMD,
          priorValue: p.last_recheck?.numeric_value,
          materiality_rule: p.materiality_rule,
          locale: 'ko',
        });
        investigated.set(key, result);
      }

      const now = new Date().toISOString();
      if (result.verdict === 'material' || result.verdict === 'quiet') {
        const rec: PremiseRecheck = {
          finding: result.fact || '(확인함)',
          ...(typeof result.current_value === 'number'
            ? { numeric_value: result.current_value }
            : typeof p.last_recheck?.numeric_value === 'number'
              ? { numeric_value: p.last_recheck.numeric_value }
              : {}),
          drifted: result.verdict === 'material',
          baseline_only: !p.last_recheck,
          source: 'url',
          ...(result.source_url ? { source_detail: `${result.source_url}${result.source_date ? ` (${result.source_date})` : ''}` } : {}),
          ts: now,
          auto: true,
        };
        p.last_recheck = rec;
        p.recheck_count = (p.recheck_count || 0) + 1;
        mutated = true;
        if (result.verdict === 'material') {
          changes.push({ ordinal: p.ordinal, text: p.text, fact: result.fact || '', source_url: result.source_url || '', source_date: result.source_date });
        }
      } else {
        // no recent source → advance the clock, preserve the numeric baseline, be honest.
        p.last_recheck = {
          finding: '최근 확인 — 새 소식 없음',
          ...(typeof p.last_recheck?.numeric_value === 'number' ? { numeric_value: p.last_recheck.numeric_value } : {}),
          drifted: false,
          baseline_only: !p.last_recheck,
          source: 'host_reported',
          ts: now,
          auto: true,
        };
        p.recheck_count = (p.recheck_count || 0) + 1;
        mutated = true;
      }
    }

    if (mutated) {
      receipt.updated_at = new Date().toISOString();
      rowUpdates.push({ id: row.id, data: receipt, next_check_by: computeNextCheckBy(receipt, today) });
    }
    if (changes.length) {
      const recentlyNotified = row.companion_notified_at && row.companion_notified_at >= renudgeCutoff;
      if (!recentlyNotified) {
        const bucket = byUser.get(row.user_id) || { rowIds: [], briefs: [] };
        bucket.rowIds.push(row.id);
        bucket.briefs.push({
          source_title: receipt.source_title || '제목 없는 문서',
          core_question: receipt.core_question || '',
          predicates: [],
          changes,
        });
        byUser.set(row.user_id, bucket);
      }
    }
  }

  // Persist the recorded findings (skip on dry run).
  if (!dryRun) {
    for (const u of rowUpdates) {
      const { error: upErr } = await supabase
        .from('review_receipts')
        .update({ data: u.data, next_check_by: u.next_check_by, updated_at: u.data.updated_at })
        .eq('id', u.id);
      if (upErr) console.error('[premise-watch] update error:', u.id, upErr.message);
    }
  }

  // Email the proactive alerts (shares the companion notified gate to avoid dupes).
  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new Resend(resendKey) : null;
  const fromDomain = process.env.EMAIL_FROM_DOMAIN || 'argus.voyage';
  const replyTo = process.env.COMPANION_REPLY_TO || 'sayucurator@gmail.com';
  let emailed = 0;
  const skipped: string[] = [];

  for (const [userId, bucket] of byUser) {
    if (dryRun || !resend) { emailed++; continue; }
    const { data: userRes } = await supabase.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (!email) { skipped.push(userId); continue; }
    const brief = buildCompanionBrief(bucket.briefs, `https://${fromDomain}`);
    try {
      await resend.emails.send({
        from: `Argus <hello@${fromDomain}>`,
        replyTo,
        to: email,
        subject: brief.subject,
        html: markdownToEmailHtml(brief.subject, brief.markdown),
      });
    } catch (err) {
      console.error('[premise-watch] send error:', err);
      skipped.push(userId);
      continue;
    }
    await supabase.from('review_receipts').update({ companion_notified_at: new Date().toISOString() }).in('id', bucket.rowIds);
    emailed++;
  }

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    date: today,
    researched,
    dropped_over_cap: dropped,
    receipts_updated: rowUpdates.length,
    change_users: byUser.size,
    emailed,
    skipped: skipped.length,
  });
}
