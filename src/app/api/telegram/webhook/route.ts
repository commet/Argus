import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';
import {
  applyTelegramSettlement,
  escapeTelegramHtml,
  parseSettlementIntent,
  type TelegramSettlementIntent,
} from '@/lib/telegram-settlement';
import type { DecisionContract } from '@/stores/types';

/**
 * Telegram bot webhook. Telegram POSTs updates here; the operator registers it
 * with the secret_token so we can authenticate inbound calls via the
 * X-Telegram-Bot-Api-Secret-Token header (== TELEGRAM_WEBHOOK_SECRET).
 *
 * The only update we act on is `/start <code>` (from the connect deep link):
 * resolve the pending code → user, persist their chat_id, and confirm. We always
 * return 200 so Telegram doesn't retry-storm on our own errors.
 */
async function sendBotMessage(
  chatId: number | string,
  text: string,
  opts: { replyMarkup?: unknown } = {},
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: opts.replyMarkup }),
    });
  } catch (err) {
    console.error('[telegram/webhook] confirm send failed:', err);
  }
}

async function answerCallbackQuery(callbackId: string, text?: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text }),
    });
  } catch (err) {
    console.error('[telegram/webhook] callback answer failed:', err);
  }
}

async function handleSettlement(
  chatId: number | string,
  intent: TelegramSettlementIntent,
): Promise<void> {
  const admin = adminClient();
  const { data: conn } = await admin
    .from('telegram_connections')
    .select('user_id')
    .eq('chat_id', String(chatId))
    .limit(1)
    .maybeSingle();

  if (!conn?.user_id) {
    await sendBotMessage(chatId, 'This Telegram chat is not connected to Argus yet. Open Argus settings and connect Telegram first.');
    return;
  }

  const { data: project, error } = await admin
    .from('projects')
    .select('id, user_id, name, decision_contract')
    .eq('id', intent.projectId)
    .eq('user_id', conn.user_id)
    .is('deleted_at', null)
    .single();

  if (error || !project?.decision_contract) {
    await sendBotMessage(chatId, 'I could not find an open Argus check-in for that reply.');
    return;
  }

  const contract = project.decision_contract as DecisionContract;
  if (intent.contractId && contract.id !== intent.contractId) {
    await sendBotMessage(chatId, 'That check-in is stale. Open Argus or wait for the latest reminder.');
    return;
  }

  const result = applyTelegramSettlement(contract, intent, Date.now());
  const { error: updateError } = await admin
    .from('projects')
    .update({ decision_contract: result.contract })
    .eq('id', project.id)
    .eq('user_id', conn.user_id);

  if (updateError) {
    console.error('[telegram/webhook] settlement update failed:', updateError.message);
    await sendBotMessage(chatId, 'I could not save that settlement. Please try once more in Argus.');
    return;
  }

  const name = escapeTelegramHtml(typeof project.name === 'string' ? project.name : 'Argus');
  if (result.deferred) {
    await sendBotMessage(chatId, `<b>Still pending recorded.</b>\n${name} will resurface again in about a week.`);
    return;
  }

  if (result.alreadySettled) {
    await sendBotMessage(chatId, `<b>Already settled.</b>\n${name} had no open checks left.`);
    return;
  }

  await sendBotMessage(
    chatId,
    `<b>Settlement saved.</b>\n${name}: ${result.graded} open check(s) marked ${escapeTelegramHtml(result.outcome)}.`,
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: true }); // unconfigured → no-op

  const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
  if (headerSecret !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const callback = update.callback_query as
    | { id?: string; data?: string; message?: { chat?: { id: number | string } } }
    | undefined;

  const callbackIntent = parseSettlementIntent({ callbackData: callback?.data });
  const callbackChatId = callback?.message?.chat?.id;
  if (callbackIntent && callbackChatId) {
    if (callback?.id) await answerCallbackQuery(callback.id, 'Saving settlement...');
    await handleSettlement(callbackChatId, callbackIntent);
    return NextResponse.json({ ok: true });
  }

  const message = (update.message ?? update.edited_message) as
    | { text?: string; chat?: { id: number; title?: string; first_name?: string; type?: string }; reply_to_message?: { text?: string } }
    | undefined;
  const text = message?.text?.trim() ?? '';
  const chat = message?.chat;

  const replyIntent = parseSettlementIntent({ text, replyText: message?.reply_to_message?.text });
  if (replyIntent && chat) {
    await handleSettlement(chat.id, replyIntent);
    return NextResponse.json({ ok: true });
  }

  const m = /^\/start(?:\s+(\S+))?/.exec(text);
  if (!m || !chat) {
    return NextResponse.json({ ok: true });
  }
  const code = m[1];
  if (!code) {
    await sendBotMessage(chat.id, 'Argus에 연결하려면 웹앱 설정에서 “Telegram 연결”을 눌러 주세요.');
    return NextResponse.json({ ok: true });
  }

  const admin = adminClient();
  const { data: pending } = await admin
    .from('telegram_connect_codes')
    .select('user_id, created_at')
    .eq('code', code)
    .single();

  // Expire codes older than 15 minutes.
  const fresh = pending && Date.now() - new Date(pending.created_at).getTime() < 15 * 60 * 1000;
  if (!pending || !fresh) {
    await admin.from('telegram_connect_codes').delete().eq('code', code);
    await sendBotMessage(chat.id, '연결 코드가 만료됐어요. 웹앱에서 다시 “Telegram 연결”을 눌러 주세요.');
    return NextResponse.json({ ok: true });
  }

  const { error: upErr } = await admin.from('telegram_connections').upsert({
    user_id: pending.user_id,
    chat_id: String(chat.id),
    chat_title: chat.title || chat.first_name || null,
    chat_type: chat.type || null,
    bot_username: process.env.TELEGRAM_BOT_USERNAME || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,chat_id' });

  await admin.from('telegram_connect_codes').delete().eq('code', code);

  if (upErr) {
    console.error('[telegram/webhook] connection upsert failed:', upErr.message);
    await sendBotMessage(chat.id, '연결 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    return NextResponse.json({ ok: true });
  }

  await sendBotMessage(chat.id, '<b>Argus에 연결됐어요.</b>\n이제 결정 결과를 이 채팅으로 바로 보낼 수 있어요.');
  return NextResponse.json({ ok: true });
}
