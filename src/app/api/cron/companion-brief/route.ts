import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { markdownToEmailHtml } from '@/lib/email-html';
import { buildCompanionBrief, companionBriefItemCount, type DueReceiptBrief, type DuePredicate, type DuePremiseNudge, type OpenQuestionNudge, type PremiseChange } from '@/lib/companion-brief';
import { notificationGateAllowsSend } from '@/lib/notification-gate';
import type { JudgmentReceipt } from '@/lib/review';
import { isMonitored, isReconsiderable, nextRecheckDue, nextReponderDue } from '@/lib/premises-core';
import { logServerEvent } from '@/lib/server-events';
import { dueReconsiderItems, applyReconsiderNudge } from '@/lib/decision-item-watch';
import type { DecisionItem } from '@/lib/decision-items';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Companion Brief cron (design doc §"귀환 트리거"). Daily: find receipts whose
 * sealed prediction has come due and hasn't been settled, and email the user the
 * exact judgment they sealed so they can settle it. Re-nudges weekly while a
 * prediction stays open (companion_notified_at gate), never daily.
 *
 * Auth: CRON_SECRET bearer (same as the other crons). `?dry=1` builds + reports
 * without sending or marking — safe for the founder to preview.
 */

const RENUDGE_DAYS = 7;

function safeCompare(a: string, b: string): boolean {
  const lengthMismatch = a.length !== b.length ? 1 : 0;
  const target = lengthMismatch ? a : b;
  let mismatch = lengthMismatch;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ target.charCodeAt(i);
  return mismatch === 0;
}

interface ReceiptRow {
  id: string;
  user_id: string;
  next_check_by: string | null;
  companion_notified_at: string | null;
  data: JudgmentReceipt;
}

/** Sealed, unsettled predicates whose check date has arrived. */
function duePredicates(receipt: JudgmentReceipt, todayYMD: string): DuePredicate[] {
  return (receipt.falsifiable_followups || [])
    .filter((f) => f.sealed_at && !f.settled_at && f.check_by && f.check_by <= todayYMD)
    .map((f) => ({
      predicate: f.predicate,
      pass_condition: f.pass_condition,
      fail_condition: f.fail_condition,
      check_by: f.check_by,
    }));
}

/** Monitored premises due for a re-check — only once the receipt is sealed
 *  (mirrors the MCP's isNudgeArmed: sealed decisions arm the nudge). An
 *  INVITATION to look at reality, never an auto-detected change. */
function duePremiseNudges(receipt: JudgmentReceipt, todayYMD: string): DuePremiseNudge[] {
  const armed = receipt.state === 'sealed'
    || (receipt.falsifiable_followups || []).some((f) => f.sealed_at && !f.settled_at);
  if (!armed) return [];
  return (receipt.tracked_premises || [])
    .filter((p) => isMonitored(p))
    .filter((p) => {
      const due = nextRecheckDue(p); // null = never checked → due now
      return due === null || due <= todayYMD;
    })
    .map((p) => ({ ordinal: p.ordinal, text: p.text, last_finding: p.last_recheck?.finding }));
}

export function dueOpenQuestions(receipt: JudgmentReceipt, todayYMD: string): OpenQuestionNudge[] {
  const armed = receipt.state === 'sealed'
    || (receipt.falsifiable_followups || []).some((f) => f.sealed_at && !f.settled_at);
  if (!armed) return [];
  return (receipt.tracked_premises || [])
    .filter((p) => isReconsiderable(p))
    .filter((p) => {
      const due = nextReponderDue(p); // null = no anchor → due now
      return due === null || due <= todayYMD;
    })
    .map((p) => ({ ordinal: p.ordinal, text: p.text }));
}

function parseSourceDetail(detail?: string): { source_url: string; source_date?: string } {
  if (!detail) return { source_url: '' };
  const m = /^(.*?)\s+\((\d{4}-\d{2}-\d{2})\)$/.exec(detail);
  if (m) return { source_url: m[1], source_date: m[2] };
  return { source_url: detail };
}

export function pendingBriefChanges(receipt: JudgmentReceipt): PremiseChange[] {
  return (receipt.tracked_premises || [])
    .filter((p) => p.last_recheck?.brief_pending)
    .map((p) => {
      const last = p.last_recheck!;
      const source = parseSourceDetail(last.source_detail);
      return {
        ordinal: p.ordinal,
        premise_id: p.premise_id,
        text: p.text,
        ...(last.baseline_finding ? { baseline: last.baseline_finding } : {}),
        ...(typeof last.baseline_numeric_value === 'number' ? { baseline_numeric_value: last.baseline_numeric_value } : {}),
        fact: last.finding,
        ...(typeof last.numeric_value === 'number' ? { current_value: last.numeric_value } : {}),
        source_url: source.source_url,
        source_date: source.source_date,
        checked_at: last.ts,
        confidence: last.confidence,
        kind: p.kind,
      };
    });
}

export function clearPendingBriefChanges(receipt: JudgmentReceipt): JudgmentReceipt {
  return {
    ...receipt,
    tracked_premises: (receipt.tracked_premises || []).map((p) => {
      if (!p.last_recheck?.brief_pending) return p;
      const { brief_pending: _pending, brief_kind: _kind, ...last } = p.last_recheck;
      void _pending; void _kind;
      return { ...p, last_recheck: last };
    }),
  };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get('dry') === '1';
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const today = new Date().toISOString().slice(0, 10);
  const renudgeCutoff = new Date(Date.now() - RENUDGE_DAYS * 86_400_000).toISOString();

  // Rows with due return content or pending T5 merge content. The final content
  // filter below keeps empty briefs silent.
  const { data: rows, error } = await supabase
    .from('review_receipts')
    .select('id, user_id, next_check_by, companion_notified_at, data')
    .is('deleted_at', null)
    .eq('state', 'sealed')
    .or(`next_check_by.lte.${today},companion_notified_at.is.null,companion_notified_at.lt.${renudgeCutoff}`)
    .limit(2000);

  if (error) {
    console.error('[companion-brief] query error:', error.message);
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  // Group due predicates by user.
  const byUser = new Map<string, { rowIds: string[]; briefs: DueReceiptBrief[]; clearRows: Array<{ id: string; data: JudgmentReceipt }> }>();
  for (const row of (rows || []) as ReceiptRow[]) {
    if (row.companion_notified_at && row.companion_notified_at >= renudgeCutoff) continue;
    const preds = duePredicates(row.data, today);
    const nudges = duePremiseNudges(row.data, today);
    const openQuestions = dueOpenQuestions(row.data, today);
    const changes = pendingBriefChanges(row.data);
    if (preds.length === 0 && nudges.length === 0 && openQuestions.length === 0 && changes.length === 0) continue;
    const bucket = byUser.get(row.user_id) || { rowIds: [], briefs: [], clearRows: [] };
    bucket.rowIds.push(row.id);
    bucket.briefs.push({
      source_title: row.data.source_title || '제목 없는 문서',
      core_question: row.data.core_question || '',
      // mcp_ rows were sealed in the terminal — the brief names the terminal
      // way home for them (§9.4 귀환 봉합).
      origin: row.id.startsWith('mcp_') ? 'mcp' : 'web',
      predicates: preds,
      premise_nudges: nudges.length ? nudges : undefined,
      open_questions: openQuestions.length ? openQuestions : undefined,
      changes: changes.length ? changes : undefined,
      // Delta: if this receipt was itself a re-review, surface what changed.
      delta: (row.data.version && row.data.version > 1 && row.data.drift_note) ? row.data.drift_note : undefined,
    });
    if (changes.length) bucket.clearRows.push({ id: row.id, data: clearPendingBriefChanges(row.data) });
    byUser.set(row.user_id, bucket);
  }

  // ── 두 번째 소스: 본선 미결 질문 (decision_items, 2026-07-30) ─────────────
  // T3(미결 질문)는 단독 메일 금지·브리프 전용이 기계 규칙(t3_brief_only)이다.
  // 그런데 이 브리프도 그동안 review_receipts 만 읽어서, 본선이 봉인 때 저장한
  // 미결 질문은 21일 되새김이 영영 안 갔다 — 두 저장소가 같은 일을 하는데
  // 소비자가 한쪽만 읽는 결함의 네 번째 표본. 저장소 이주는 하지 않는다;
  // 소비자가 둘 다 읽는다. due 판정은 UI 배지와 같은 함수(dueReconsiderItems →
  // isItemDueForReconsider), 실어 나르는 것은 질문 원문뿐(선택지·기울기 금지).
  let itemQuestionCount = 0;
  const itemNudgeUpdates = new Map<string, DecisionItem[]>();
  {
    const { data: qRows, error: qErr } = await supabase
      .from('decision_items')
      .select('*')
      .eq('status', 'active')
      .eq('type', 'open_question')
      .limit(2000);
    if (qErr) {
      console.error('[companion-brief] decision_items query error:', qErr.message);
    } else {
      const due = dueReconsiderItems((qRows || []) as DecisionItem[], Date.now());
      const byDecision = new Map<string, DecisionItem[]>();
      for (const it of due) {
        const list = byDecision.get(it.decision_id) ?? [];
        list.push(it);
        byDecision.set(it.decision_id, list);
      }
      const nameById = new Map<string, string>();
      const decisionIds = [...byDecision.keys()];
      if (decisionIds.length > 0) {
        const { data: projRows } = await supabase.from('projects').select('id, name').in('id', decisionIds);
        for (const pr of projRows || []) nameById.set(pr.id, typeof pr.name === 'string' ? pr.name : '');
      }
      const nowISO = new Date().toISOString();
      for (const [decisionId, items] of byDecision) {
        const userId = (items[0] as DecisionItem & { user_id?: string }).user_id;
        if (!userId) continue;
        const bucket = byUser.get(userId) || { rowIds: [], briefs: [], clearRows: [] };
        bucket.briefs.push({
          source_title: nameById.get(decisionId) || '결정',
          core_question: '',
          origin: 'web',
          predicates: [],
          open_questions: items.map((it, i): OpenQuestionNudge => ({ ordinal: i + 1, text: it.text })),
        });
        byUser.set(userId, bucket);
        const arr = itemNudgeUpdates.get(userId) ?? [];
        arr.push(...items.map((it) => applyReconsiderNudge(it, nowISO)));
        itemNudgeUpdates.set(userId, arr);
        itemQuestionCount += items.length;
      }
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey && !dryRun) {
    return NextResponse.json({ error: 'Email is not configured on this deployment.' }, { status: 503 });
  }
  const resend = resendKey ? new Resend(resendKey) : null;
  const fromDomain = process.env.EMAIL_FROM_DOMAIN || 'argus.voyage';
  // No personal inbox hard-coded in a public repo — default to a role address on
  // the sending domain; set COMPANION_REPLY_TO in the host env to override.
  const replyTo = process.env.COMPANION_REPLY_TO || `hello@${fromDomain}`;

  let sent = 0;
  const skipped: string[] = [];
  for (const [userId, bucket] of byUser) {
    const { data: userRes } = await supabase.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (!email) {
      skipped.push(userId);
      continue;
    }
    const brief = buildCompanionBrief(bucket.briefs, `https://${fromDomain}`);
    if (!notificationGateAllowsSend({
      type: 'T5_WEEKLY_BRIEF',
      channel: 'email',
      userId,
      contentCount: companionBriefItemCount(bucket.briefs),
      isStandalone: false,
    })) {
      skipped.push(userId);
      continue;
    }

    if (!dryRun && resend) {
      try {
        await resend.emails.send({
          from: `Argus <hello@${fromDomain}>`,
          replyTo,
          to: email,
          subject: brief.subject,
          html: markdownToEmailHtml(brief.subject, brief.markdown),
        });
      } catch (err) {
        console.error('[companion-brief] send error:', err);
        skipped.push(userId);
        continue;
      }
      // Mark this batch so we don't re-nudge before RENUDGE_DAYS.
      await supabase
        .from('review_receipts')
        .update({ companion_notified_at: new Date().toISOString() })
        .in('id', bucket.rowIds);
      for (const row of bucket.clearRows) {
        await supabase
          .from('review_receipts')
          .update({ data: row.data, updated_at: new Date().toISOString() })
          .eq('id', row.id);
      }
      // 본선 미결 질문의 되새김 시계 — 발송이 성사된 사용자 것만 찍는다
      // (실패하면 안 찍고 내일 다시 실린다).
      for (const it of itemNudgeUpdates.get(userId) ?? []) {
        const { error: itemErr } = await supabase
          .from('decision_items')
          .update({ alert: it.alert, updated_at: it.updated_at })
          .eq('id', it.id);
        if (itemErr) console.error('[companion-brief] item nudge stamp error:', it.id, itemErr.message);
      }
    }
    sent++;
  }

  // 계기 (2026-07-29): 이 크론이 돌았는지·누구에게 갔는지 데이터로 답할 수 있게.
  logServerEvent('cron_companion_brief', {
    dry_run: dryRun, due_users: byUser.size, emailed: sent, skipped: skipped.length,
    // 본선 미결 질문(두 번째 소스)의 흔적 — 없으면 "본선 질문도 되새긴다"는
    // 말을 데이터로 증명도 반박도 못 한다.
    item_questions: itemQuestionCount, item_question_users: itemNudgeUpdates.size,
  }, { path: '/api/cron/companion-brief' });
  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    due_users: byUser.size,
    emailed: sent,
    skipped: skipped.length,
    item_questions: itemQuestionCount,
    item_question_users: itemNudgeUpdates.size,
    date: today,
  });
}
