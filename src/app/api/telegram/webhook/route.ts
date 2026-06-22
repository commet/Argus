import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';

/**
 * Telegram bot webhook. Telegram POSTs updates here; the operator registers it
 * with the secret_token so we can authenticate inbound calls via the
 * X-Telegram-Bot-Api-Secret-Token header (== TELEGRAM_WEBHOOK_SECRET).
 *
 * The only update we act on is `/start <code>` (from the connect deep link):
 * resolve the pending code → user, persist their chat_id, and confirm. We always
 * return 200 so Telegram doesn't retry-storm on our own errors.
 */
async function sendBotMessage(chatId: number | string, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[telegram/webhook] confirm send failed:', err);
  }
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

  const message = (update.message ?? update.edited_message) as
    | { text?: string; chat?: { id: number; title?: string; first_name?: string; type?: string } }
    | undefined;
  const text = message?.text?.trim() ?? '';
  const chat = message?.chat;

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
