import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tgSendMessage } from '@/lib/telegram-api';
import { markdownToTelegramLight } from '@/lib/telegram-format';
import { settleQuestionMarkdown, settleKeyboard } from '@/lib/seal-core';

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
    .select('id, chat_id, decision, predicate, check_by')
    .eq('status', 'sealed')
    .is('reminded_at', null)
    .lte('check_by', today)
    .order('check_by', { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error('[cron/telegram-reminders] query failed:', error.message);
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }

  let sent = 0;
  for (const d of due ?? []) {
    const locale = detectLocale(d.decision || '');
    try {
      await tgSendMessage(
        d.chat_id,
        markdownToTelegramLight(settleQuestionMarkdown(d.decision, d.predicate, locale)),
        settleKeyboard(d.id, locale),
      );
      await admin.from('telegram_decisions')
        .update({ reminded_at: new Date().toISOString() })
        .eq('id', d.id);
      sent++;
    } catch (err) {
      console.error('[cron/telegram-reminders] send failed for', d.id, err);
    }
  }

  return NextResponse.json({ ok: true, date: today, due: due?.length ?? 0, sent });
}
