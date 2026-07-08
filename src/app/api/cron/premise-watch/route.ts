import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { markdownToEmailHtml } from '@/lib/email-html';
import { buildPremiseDriftEmail, type CompanionBriefEmail, type PremiseChange } from '@/lib/companion-brief';
import { gateNotification, notificationGateAllowsSend, type NotificationCandidate, type NotificationGateResult, type PremiseDriftMateriality } from '@/lib/notification-gate';
import { type JudgmentReceipt, summarizeReceipt } from '@/lib/review';
import {
  isMonitored,
  isDueForRecheck,
  isDueForReconsider,
  isReconsiderable,
  nextRecheckDue,
  nextReponderDue,
  normalizePremiseText,
  dateOnly,
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
 * URL), (6) a MONTHLY investigation cap (premise_watch_usage table) auto-stops the
 * cron before the founder's Brave/LLM bill runs away — fail-open if the table is
 * absent, so the per-run cap + kill-switch remain the hard floors.
 */

const RENUDGE_DAYS = 7;
const MAX_PER_RUN = Number(process.env.PREMISE_WATCH_MAX_PER_RUN || 200);
/** Hard monthly ceiling on investigations (= Brave calls = LLM calls). Founder's
 *  automatic spend brake; each investigation is ~1 Brave + ~1 Claude call. */
const MONTHLY_CAP = Number(process.env.PREMISE_WATCH_MONTHLY_CAP || 3000);

// premise_watch_usage is added by its own migration and isn't in the generated DB
// types, so these helpers take a loosely-typed client to access it dynamically.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/** This month's investigation count (0 if the row/table is absent — fail-open). */
async function monthlyCount(supabase: Supa, monthKey: string): Promise<number> {
  try {
    const { data } = await supabase.from('premise_watch_usage').select('count').eq('month', monthKey).single();
    const c = (data as { count?: number } | null)?.count;
    return typeof c === 'number' ? c : 0;
  } catch { return 0; }
}

/** Add `n` investigations to this month's counter (best-effort; never throws). */
async function bumpMonthly(supabase: Supa, monthKey: string, startCount: number, n: number): Promise<void> {
  if (n <= 0) return;
  try {
    await supabase.from('premise_watch_usage').upsert(
      { month: monthKey, count: startCount + n, updated_at: new Date().toISOString() },
      { onConflict: 'month' },
    );
  } catch { /* table not migrated yet → per-run cap + kill-switch still bound cost */ }
}

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
    else if (isReconsiderable(p)) dues.push(nextReponderDue(p) ?? today);
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

export interface PremiseWatchAlertInput {
  userId: string;
  receiptId: string;
  receipt: JudgmentReceipt;
  premise: NonNullable<JudgmentReceipt['tracked_premises']>[number];
  result: InvestigationResult;
  checkedAt: string;
  baseUrl?: string;
  standaloneSentThisWeek?: number;
}

export interface PremiseWatchAlertDecision {
  materiality: PremiseDriftMateriality;
  gate: NotificationGateResult;
  change?: PremiseChange;
  email?: CompanionBriefEmail;
}

function resultMateriality(result: InvestigationResult): PremiseDriftMateriality {
  if (result.verdict === 'material') return 'material';
  if (result.verdict === 'quiet' && result.materiality && result.materiality !== 'material') return 'minor';
  return 'none';
}

/**
 * Record the watcher's finding onto the premise — the EXACT mutation the cron
 * persists, extracted pure so the drift-journey fixture exercises the same wire
 * the premise screen later renders (consumption contract: produced field =
 * consumed field). material/quiet verdicts record the fact + source + confidence
 * (and the T5 brief_pending flag when the gate demoted the alert); anything else
 * records an honest "no recent news" line. Always advances the cadence clocks.
 */
export function applyWatchRecheck(
  p: NonNullable<JudgmentReceipt['tracked_premises']>[number],
  result: InvestigationResult,
  opts: { now: string; queueForBrief?: boolean },
): void {
  const isOpenQ = p.kind === 'open_question';
  if (result.verdict === 'material' || result.verdict === 'quiet') {
    const previous = p.last_recheck;
    p.last_recheck = {
      finding: result.fact || '(확인함)',
      ...(typeof result.current_value === 'number'
        ? { numeric_value: result.current_value }
        : typeof previous?.numeric_value === 'number'
          ? { numeric_value: previous.numeric_value }
          : {}),
      ...(previous?.finding ? { baseline_finding: previous.finding } : {}),
      ...(typeof previous?.numeric_value === 'number' ? { baseline_numeric_value: previous.numeric_value } : {}),
      drifted: result.verdict === 'material',
      baseline_only: !previous,
      source: 'url',
      ...(result.source_url ? { source_detail: `${result.source_url}${result.source_date ? ` (${result.source_date})` : ''}` } : {}),
      confidence: result.confidence,
      ...(opts.queueForBrief
        ? {
            brief_pending: true,
            brief_kind: isOpenQ
              ? 'open_question_new_info'
              : (result.verdict === 'material' ? 'standalone_overflow' : 'premise_minor_drift'),
          }
        : {}),
      ts: opts.now,
      auto: true,
    };
  } else {
    // no recent source → advance the clock, preserve the numeric baseline, be honest.
    p.last_recheck = {
      finding: '최근 확인 — 새 소식 없음',
      ...(typeof p.last_recheck?.numeric_value === 'number' ? { numeric_value: p.last_recheck.numeric_value } : {}),
      drifted: false,
      baseline_only: !p.last_recheck,
      source: 'host_reported',
      ts: opts.now,
      auto: true,
    };
  }
  if (isOpenQ) p.last_reconsidered = opts.now; // advance the reconsider clock
  p.recheck_count = (p.recheck_count || 0) + 1;
}

export function buildPremiseWatchAlert(input: PremiseWatchAlertInput): PremiseWatchAlertDecision {
  const materiality = resultMateriality(input.result);
  const hasPayload = Boolean(input.result.fact && input.result.source_url && materiality !== 'none');
  const candidateBase: Omit<NotificationCandidate, 'type'> = {
    channel: 'email',
    userId: input.userId,
    targetId: input.premise.premise_id,
    contentCount: hasPayload ? 1 : 0,
    materiality,
    isStandalone: true,
    standaloneSentThisWeek: input.standaloneSentThisWeek,
  };
  const candidate: NotificationCandidate = input.premise.kind === 'open_question'
    ? { ...candidateBase, type: 'T3_OPEN_QUESTION' }
    : { ...candidateBase, type: 'T2_PREMISE_DRIFT' };
  const gate = gateNotification(candidate);

  if (!hasPayload) return { materiality, gate };

  const prior = input.premise.last_recheck;
  const change: PremiseChange = {
    ordinal: input.premise.ordinal,
    premise_id: input.premise.premise_id,
    text: input.premise.text,
    ...(prior?.finding ? { baseline: prior.finding } : {}),
    ...(typeof prior?.numeric_value === 'number' ? { baseline_numeric_value: prior.numeric_value } : {}),
    fact: input.result.fact || '',
    ...(typeof input.result.current_value === 'number' ? { current_value: input.result.current_value } : {}),
    source_url: input.result.source_url || '',
    source_date: input.result.source_date,
    checked_at: input.checkedAt,
    confidence: input.result.confidence,
    kind: input.premise.kind,
  };

  return {
    materiality,
    gate,
    change,
    email: notificationGateAllowsSend(candidate)
      ? buildPremiseDriftEmail({
          decision_title: input.receipt.source_title || input.receipt.core_question || '제목 없는 문서',
          receipt_id: input.receiptId,
          baseUrl: input.baseUrl,
          change,
        })
      : undefined,
  };
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

  // Monthly spend brake: stop before this month's investigations exceed the cap.
  const monthKey = today.slice(0, 7); // YYYY-MM
  const monthStart = await monthlyCount(supabase, monthKey);
  if (monthStart >= MONTHLY_CAP) {
    return NextResponse.json({ ok: true, budget_exhausted: true, month: monthKey, count: monthStart, cap: MONTHLY_CAP });
  }
  let budgetLeft = MONTHLY_CAP - monthStart; // additional guard: never exceed the monthly cap mid-run

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
  const byUser = new Map<string, { rowIds: string[]; emails: CompanionBriefEmail[] }>();
  const rowUpdates: Array<{ id: string; data: JudgmentReceipt; next_check_by: string | null }> = [];
  let mergedIntoBrief = 0;

  for (const row of (rows || []) as Row[]) {
    const receipt = row.data;
    const premises = receipt.tracked_premises || [];
    let mutated = false;

    for (const p of premises) {
      if (p.status !== 'active' || !p.auto_watch) continue;
      // premise → recheck cadence (isMonitored); open_question → reconsider cadence.
      const isOpenQ = p.kind === 'open_question';
      const due = isOpenQ ? isDueForReconsider(p, today) : isDueForRecheck(p, today);
      if (!due) continue;

      const key = normalizePremiseText(p.text);
      let result = investigated.get(key);
      if (!result) {
        if (budget <= 0 || budgetLeft <= 0) { dropped++; continue; } // per-run + monthly cost cap
        budget--;
        budgetLeft--;
        researched++;
        const baselineYMD = dateOnly(isOpenQ ? (p.last_reconsidered ?? p.added_ts) : p.last_recheck?.ts) ?? dateOnly(p.added_ts) ?? addDaysYMD(today, -365);
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
        const alert = buildPremiseWatchAlert({
          userId: row.user_id,
          receiptId: row.id,
          receipt,
          premise: p,
          result,
          checkedAt: now,
          baseUrl: `https://${process.env.EMAIL_FROM_DOMAIN || 'argus.voyage'}`,
        });
        if (alert.gate.decision === 'merge_into_brief') mergedIntoBrief++;
        if (alert.email) {
          const recentlyNotified = row.companion_notified_at && row.companion_notified_at >= renudgeCutoff;
          if (!recentlyNotified) {
            const bucket = byUser.get(row.user_id) || { rowIds: [], emails: [] };
            bucket.rowIds.push(row.id);
            bucket.emails.push(alert.email);
            byUser.set(row.user_id, bucket);
          }
        }
        applyWatchRecheck(p, result, {
          now,
          queueForBrief: alert.gate.decision === 'merge_into_brief' && Boolean(alert.change),
        });
        mutated = true;
      } else {
        applyWatchRecheck(p, result, { now });
        mutated = true;
      }
    }

    if (mutated) {
      receipt.updated_at = new Date().toISOString();
      rowUpdates.push({ id: row.id, data: receipt, next_check_by: computeNextCheckBy(receipt, today) });
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
  // No personal inbox hard-coded in a public repo — default to a role address on
  // the sending domain; set COMPANION_REPLY_TO in the host env to override.
  const replyTo = process.env.COMPANION_REPLY_TO || `hello@${fromDomain}`;
  let emailed = 0;
  const skipped: string[] = [];

  for (const [userId, bucket] of byUser) {
    if (dryRun || !resend) { emailed++; continue; }
    const { data: userRes } = await supabase.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (!email) { skipped.push(userId); continue; }
    let failed = false;
    for (const emailPayload of bucket.emails) {
      try {
        await resend.emails.send({
          from: `Argus <hello@${fromDomain}>`,
          replyTo,
          to: email,
          subject: emailPayload.subject,
          html: markdownToEmailHtml(emailPayload.subject, emailPayload.markdown),
        });
      } catch (err) {
        console.error('[premise-watch] send error:', err);
        skipped.push(userId);
        failed = true;
        break;
      }
    }
    if (failed) continue;
    await supabase.from('review_receipts').update({ companion_notified_at: new Date().toISOString() }).in('id', bucket.rowIds);
    emailed++;
  }

  // Count the real API calls made this run (dry run still hits Brave+LLM, so it
  // counts too) against the monthly cap. Best-effort; never blocks the response.
  await bumpMonthly(supabase, monthKey, monthStart, researched);

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    date: today,
    researched,
    dropped_over_cap: dropped,
    month: monthKey,
    month_used: monthStart + researched,
    month_cap: MONTHLY_CAP,
    receipts_updated: rowUpdates.length,
    change_users: byUser.size,
    emailed,
    merged_into_brief: mergedIntoBrief,
    skipped: skipped.length,
  });
}
