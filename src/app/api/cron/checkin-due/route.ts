import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { settlementReminderText, settlementReplyMarkup, detectSettlementLocale } from '@/lib/telegram-settlement';
import { isCheckInReminderDue, renderCheckInReminderEmail, resendEmailErrorMessage, selectOpenPredicate, REMINDER_MAX_SENDS } from '@/lib/checkin-reminder';
import type { DecisionContract } from '@/stores/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Check-in reminder cron (the LAND phase's missing outbound channel).
 *
 * Until now the seal→settle loop was 100% pull-only: a decision resurfaced only if
 * the user happened to reopen /project on the right day. This emails OPTED-IN,
 * logged-in users on/after their check-in date so the loop can actually close.
 *
 * HONEST BY DEFAULT: only contracts with `email_reminder === true` (an explicit
 * opt-in at seal time) are ever emailed — the product's "no emails unless you ask"
 * promise stays true for everyone else. Deduped via `reminder_sent_at` (re-emails at
 * most once per 7 days while a contract stays due). Guarded by CRON_SECRET.
 *
 * FOUNDER: this does NOT fire until (1) it's added to vercel.json crons and (2)
 * CRON_SECRET / RESEND_API_KEY / SUPABASE_SERVICE_ROLE_KEY are set. Verify the email
 * content + a real send before relying on it.
 */

const RESEND_DUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function safeCompare(a: string, b: string): boolean {
  const lengthMismatch = a.length !== b.length ? 1 : 0;
  const compareTarget = lengthMismatch ? a : b;
  let mismatch = lengthMismatch;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ compareTarget.charCodeAt(i);
  return mismatch === 0;
}

async function sendTelegramReminder(args: {
  botToken: string;
  chatId: string;
  text: string;
  replyMarkup: unknown;
}): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${args.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: args.chatId,
      text: args.text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: args.replyMarkup,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) console.error('[checkin-due] telegram send failed:', data?.description ?? res.statusText);
  return !!data?.ok;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const resend = new Resend(process.env.RESEND_API_KEY);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://argus.voyage';
  // Must send from the VERIFIED argus.voyage domain — Resend's sandbox sender
  // (onboarding@resend.dev) only delivers to the account owner, so real users
  // never got the reminder. Replies route to the founder's inbox.
  const fromDomain = process.env.EMAIL_FROM_DOMAIN || 'argus.voyage';
  const replyTo = process.env.EMAIL_REPLY_TO || 'sayucurator@gmail.com';
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const now = Date.now();

  // Pull candidate contracts (small scale: select the lot, filter in JS for clarity).
  const { data: rows, error } = await supabase
    .from('projects')
    .select('id, user_id, name, decision_contract')
    .not('decision_contract', 'is', null)
    .is('deleted_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (rows ?? []).filter((r: { decision_contract: DecisionContract | null }) => {
    const c = r.decision_contract;
    return isCheckInReminderDue(c, now);
  });

  let sent = 0;
  let telegramSent = 0;
  const failures: string[] = [];
  for (const r of due as { id: string; user_id: string; name: string; decision_contract: DecisionContract }[]) {
    try {
      const c = r.decision_contract;
      const name = typeof r.name === 'string' ? r.name : '';
      const stamp = new Date(now).toISOString();
      let nextContract = c;
      let changed = false;

      // Reminder ceiling (10 S3): at most REMINDER_MAX_SENDS waves per contract,
      // then the cron goes quiet — the decision keeps waiting on the web due
      // surfaces instead of nagging. "그만 물어봐 주세요" jumps the count to the cap.
      const reminderCount = typeof c.reminder_count === 'number' ? c.reminder_count : 0;
      if (reminderCount >= REMINDER_MAX_SENDS) continue;
      const isFinalWave = reminderCount + 1 >= REMINDER_MAX_SENDS;

      const emailDue =
        c.email_reminder === true &&
        (!c.reminder_sent_at || now - new Date(c.reminder_sent_at).getTime() >= RESEND_DUP_WINDOW_MS);
      if (emailDue) {
        const { data: u } = await supabase.auth.admin.getUserById(r.user_id);
        const email = u?.user?.email;
        if (email) {
          const lean = c.predicates?.find((p) => p.source === 'user_lean')?.text;
          const link = `${origin}/project`;
          const html = renderCheckInReminderEmail({ projectName: name, lean, link });
          const emailResult = await resend.emails.send({
            from: `Argus <hello@${fromDomain}>`,
            replyTo,
            to: email,
            subject: `그래서, 어떻게 됐어요? — ${name}`,
            html,
          });
          const emailError = resendEmailErrorMessage(emailResult);
          if (emailError) throw new Error(`email send failed: ${emailError}`);
          nextContract = { ...nextContract, reminder_sent_at: stamp };
          changed = true;
          sent++;
        }
      }

      let telegramDue =
        !!botToken &&
        (!c.telegram_reminder_sent_at || now - new Date(c.telegram_reminder_sent_at).getTime() >= RESEND_DUP_WINDOW_MS);
      if (telegramDue) {
        // Double-send guard (P0-2 ②): web seals with a Telegram connection are
        // mirrored into telegram_decisions (telegram-sync, row id == project id)
        // and the warm daily cron (telegram-reminders) owns THAT reminder. This
        // bridge stays only as the safety net for un-mirrored legacy contracts.
        const { count: mirrored } = await supabase
          .from('telegram_decisions')
          .select('id', { count: 'exact', head: true })
          .eq('id', r.id)
          .eq('status', 'sealed');
        if ((mirrored ?? 0) > 0) telegramDue = false;
      }
      if (telegramDue) {
        const { data: conns } = await supabase
          .from('telegram_connections')
          .select('chat_id')
          .eq('user_id', r.user_id);
        const openPredicate = selectOpenPredicate(c);
        const locale = detectSettlementLocale(name, openPredicate?.text);
        const text = settlementReminderText({
          projectName: name,
          projectId: r.id,
          contractId: c.id,
          predicate: openPredicate?.text,
          locale,
          isFinal: isFinalWave,
        });
        let delivered = 0;
        for (const conn of conns ?? []) {
          if (await sendTelegramReminder({
            botToken,
            chatId: String(conn.chat_id),
            text,
            replyMarkup: settlementReplyMarkup(r.id, c.id, locale),
          })) delivered++;
        }
        if (delivered > 0) {
          nextContract = { ...nextContract, telegram_reminder_sent_at: stamp };
          changed = true;
          telegramSent += delivered;
        }
      }

      if (changed) {
        // One wave = one count, whichever channels fired in it.
        nextContract = { ...nextContract, reminder_count: reminderCount + 1 };
        const { error: updateError } = await supabase
          .from('projects')
          .update({ decision_contract: nextContract })
          .eq('id', r.id);
        if (updateError) failures.push(`${r.id}: reminder stamp update failed: ${updateError.message}`);
      }
    } catch (e) {
      failures.push(`${r.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, candidates: due.length, sent, telegramSent, failures });
}
