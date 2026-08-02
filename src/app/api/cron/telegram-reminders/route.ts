import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tgSendMessage } from '@/lib/telegram-api';
import { markdownToTelegramLight } from '@/lib/telegram-format';
import { settleQuestionMarkdown, settleKeyboard } from '@/lib/seal-core';
import {
  foundationSettlementReplyMarkup,
  settlementReminderText,
} from '@/lib/telegram-settlement';
import { notificationGateAllowsSend } from '@/lib/notification-gate';
import type { DecisionContract } from '@/stores/types';
import { logServerEvent } from '@/lib/server-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Telegram check-in reminders — the back half of the seal/settle loop, and the
 * Telegram-native core of Argus's promise: on a decision's check_by date, the
 * bot returns FIRST and asks "그래서, 어떻게 됐어요?" with settle buttons.
 *
 * Runs daily (vercel.json). Picks sealed decisions whose date has arrived and
 * that haven't been reminded yet, DMs each, and stamps reminded_at so a decision
 * is asked exactly once when it comes due.
 */
function safeCompare(a: string, b: string): boolean {
  const lengthMismatch = a.length !== b.length ? 1 : 0;
  const target = lengthMismatch ? a : b;
  let mismatch = lengthMismatch;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ target.charCodeAt(i);
  return mismatch === 0;
}

function detectLocale(text: string): 'ko' | 'en' {
  return /[가-힣]/.test(text) ? 'ko' : 'en';
}

const MAX_PER_RUN = 200;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ ok: true, skipped: 'telegram not configured' });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // "today" in KST — matches how check_by dates are computed at seal time.
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const { data: due, error } = await admin
    .from('telegram_decisions')
    .select('id, user_id, chat_id, decision, predicate, check_by, source')
    .eq('status', 'sealed')
    .is('reminded_at', null)
    .lte('check_by', today)
    .order('check_by', { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error('[cron/telegram-reminders] query failed:', error.message);
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  const webIds = (due ?? [])
    .filter((decision) => decision.source === 'web')
    .map((decision) => decision.id);
  const { data: webProjects } = webIds.length
    ? await admin.from('projects').select('id, user_id, name, decision_contract').in('id', webIds)
    : { data: [] };
  const webProjectById = new Map(
    (webProjects ?? []).map((project) => [project.id, project] as const),
  );

  let sent = 0;
  for (const d of due ?? []) {
    const locale = detectLocale(d.decision || '');
    try {
      const candidateProject = d.source === 'web' ? webProjectById.get(d.id) : undefined;
      // Service-role reads bypass RLS. Pair the mirrored row with its owner
      // before exposing project wording to Telegram, even if an id was planted
      // or corrupted outside the normal sync route.
      const webProject = candidateProject?.user_id === d.user_id ? candidateProject : undefined;
      if (d.source === 'web' && !webProject) {
        await admin.from('telegram_decisions')
          .update({ status: 'orphaned', outcome: null, reminded_at: null, settled_at: null })
          .eq('id', d.id)
          .eq('user_id', d.user_id)
          .eq('source', 'web');
        continue;
      }
      const contract = (webProject?.decision_contract ?? null) as DecisionContract | null;
      if (contract?.kind === 'witness') {
        // Defensive repair for mirrors created before witness disabling was
        // wired to the edit surface. Do not let stale due rows consume the
        // bounded cron window or turn "never ask" into one last reminder.
        await admin.from('telegram_decisions')
          .update({ status: 'witness', outcome: null, reminded_at: null, settled_at: null })
          .eq('id', d.id)
          .eq('user_id', d.user_id)
          .eq('source', 'web');
        continue;
      }
      if (!notificationGateAllowsSend({
        type: 'T1_RETURN',
        channel: 'telegram',
        userId: String(d.chat_id),
        targetId: d.id,
        reminderCount: 0,
        contentCount: 1,
      })) continue;
      let delivered: boolean;
      if (contract?.kind) {
        const foundationLocale = detectLocale(
          `${webProject?.name ?? d.decision ?? ''} ${contract.predicates?.[0]?.text ?? ''}`,
        );
        delivered = await tgSendMessage(
          d.chat_id,
          settlementReminderText({
            projectName: webProject?.name || d.decision,
            projectId: d.id,
            contractId: contract.id,
            predicate: contract.predicates?.[0]?.text || d.predicate,
            locale: foundationLocale,
            kind: contract.kind,
          }),
          foundationSettlementReplyMarkup(d.id, contract.id, contract.kind, foundationLocale),
        );
      } else {
        delivered = await tgSendMessage(
          d.chat_id,
          markdownToTelegramLight(settleQuestionMarkdown(d.decision, d.predicate, locale)),
          settleKeyboard(d.id, locale),
        );
      }
      if (!delivered) throw new Error('Telegram rejected both HTML and plain-text delivery');

      await admin.from('telegram_decisions')
        .update({ reminded_at: new Date().toISOString() })
        .eq('id', d.id);
      sent++;
    } catch (err) {
      console.error('[cron/telegram-reminders] send failed for', d.id, err);
    }
  }

  // 계기 (2026-07-29): 텔레그램 귀환 알림도 같은 이유로 흔적을 남긴다.
  logServerEvent('cron_telegram_reminders', { due: due?.length ?? 0, sent }, { path: '/api/cron/telegram-reminders' });
  return NextResponse.json({ ok: true, date: today, due: due?.length ?? 0, sent });
}
