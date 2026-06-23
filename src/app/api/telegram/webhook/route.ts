import { NextRequest, NextResponse, after } from 'next/server';
import { adminClient } from '@/lib/share-guard';
import { reframeSystemPrompt, deeperSuffix, parseReframe, reframeToMarkdown } from '@/lib/reframe-core';
import { callAnthropicText } from '@/lib/llm-server';
import { markdownToTelegramHtml } from '@/lib/telegram-format';

/**
 * Telegram bot webhook. Authenticated via the X-Telegram-Bot-Api-Secret-Token
 * header (== TELEGRAM_WEBHOOK_SECRET). Handles three things:
 *   - /start <code>     → account connect (deep-link flow)
 *   - a plain message   → reframe the user's decision (Stage-1 assumptions)
 *   - a button tap       → re-run deeper / again on the last input
 *
 * The reframe brain is the SHARED lib (reframe-core) the webapp uses, so the bot
 * and the web UI can't drift. Abuse/cost is gated: only chats connected to an
 * account may run the LLM, and each account has a daily bot cap.
 *
 * Telegram needs a fast 200, but an LLM call takes seconds — so we ack
 * immediately and do the work in after(). maxDuration covers the LLM time.
 */
export const maxDuration = 30;

const BOT_DAILY_LIMIT = 20;
const INPUT_MAX = 4000;
const FIFTEEN_MIN = 15 * 60 * 1000;

// ── Telegram API helpers ──
function tgUrl(method: string): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}
async function tgCall(method: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(tgUrl(method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[telegram/webhook] ${method} failed:`, err);
  }
}
function sendMessage(chatId: number | string, html: string, keyboard?: unknown): Promise<void> {
  return tgCall('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}
function sendTyping(chatId: number | string): Promise<void> {
  return tgCall('sendChatAction', { chat_id: chatId, action: 'typing' });
}
function answerCallback(id: string, text?: string): Promise<void> {
  return tgCall('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) });
}

function reframeKeyboard(locale: 'ko' | 'en') {
  return {
    inline_keyboard: [[
      { text: locale === 'ko' ? '🔍 더 깊이' : '🔍 Deeper', callback_data: 'rf:deep' },
      { text: locale === 'ko' ? '♻️ 다시' : '♻️ Again', callback_data: 'rf:redo' },
    ]],
  };
}

function detectLocale(text: string): 'ko' | 'en' {
  return /[가-힣]/.test(text) ? 'ko' : 'en';
}

// ── Gate + rate limit ──
async function userForChat(chatId: number | string): Promise<string | null> {
  const { data } = await adminClient()
    .from('telegram_connections')
    .select('user_id')
    .eq('chat_id', String(chatId))
    .limit(1)
    .single();
  return data?.user_id ?? null;
}

/** Per-account daily cap on bot LLM calls (cost guard). Logs to share_log. */
async function allowBotCall(userId: string): Promise<boolean> {
  const admin = adminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('share_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('channel', 'telegram_bot')
    .gte('created_at', since);
  if ((count ?? 0) >= BOT_DAILY_LIMIT) return false;
  await admin.from('share_log').insert({ user_id: userId, channel: 'telegram_bot' });
  return true;
}

// ── Reframe run (shared brain) ──
async function runReframe(chatId: number | string, input: string, deep: boolean): Promise<void> {
  const locale = detectLocale(input);
  await sendTyping(chatId);
  let result;
  try {
    const system = reframeSystemPrompt(locale) + (deep ? deeperSuffix(locale) : '');
    // Use the same model the webapp's reframe uses (default = Sonnet) — the
    // 'fast'/Haiku path is unexercised in this deployment, so default is the
    // proven one. (Optimize back to fast later once verified.)
    const text = await callAnthropicText({ system, user: input.slice(0, INPUT_MAX), model: 'default', maxTokens: 1200 });
    result = parseReframe(text);
  } catch (err) {
    console.error('[telegram/webhook] reframe failed:', err);
    // TEMP diagnostic: surface a short error reason while stabilizing the bot.
    const reason = String((err as { status?: number; message?: string })?.message || err)
      .slice(0, 200).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await sendMessage(chatId, (locale === 'ko'
      ? '잠깐 막혔어요. 잠시 후 다시 보내 주세요.'
      : 'Hit a snag. Please try again in a moment.') + `\n\n<code>${reason}</code>`);
    return;
  }
  if (!result.surface_task && result.hidden_assumptions.length === 0) {
    await sendMessage(chatId, locale === 'ko'
      ? '이건 분석할 결정/과제로 읽기 어려웠어요. 한 줄로 “무엇을 정하려는지” 적어 보내 주세요.'
      : "Couldn't read this as a decision to analyze. Send one line describing what you're trying to decide.");
    return;
  }
  const md = reframeToMarkdown(result, locale);
  const title = locale === 'ko' ? '리프레임 — 숨은 전제 점검' : 'Reframe — hidden-assumption check';
  await sendMessage(chatId, markdownToTelegramHtml(title, md), reframeKeyboard(locale));
}

// ── /start connect flow ──
async function handleStart(chat: { id: number; title?: string; first_name?: string; type?: string }, code: string | undefined): Promise<void> {
  if (!code) {
    await sendMessage(chat.id, 'Argus에 연결하려면 웹앱 설정에서 “Telegram 연결”을 눌러 주세요.\n연결 후에는 고민을 그냥 보내면 바로 리프레임해 드려요.');
    return;
  }
  const admin = adminClient();
  const { data: pending } = await admin
    .from('telegram_connect_codes')
    .select('user_id, created_at')
    .eq('code', code)
    .single();
  const fresh = pending && Date.now() - new Date(pending.created_at).getTime() < FIFTEEN_MIN;
  if (!pending || !fresh) {
    await admin.from('telegram_connect_codes').delete().eq('code', code);
    await sendMessage(chat.id, '연결 코드가 만료됐어요. 웹앱에서 다시 “Telegram 연결”을 눌러 주세요.');
    return;
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
    await sendMessage(chat.id, '연결 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    return;
  }
  await sendMessage(chat.id, '<b>Argus에 연결됐어요.</b>\n이제 결정·고민을 그냥 메시지로 보내면, 숨은 전제를 짚어 드려요. 결과 화면에서 “보내기 → Telegram”으로 받을 수도 있어요.');
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: true }); // unconfigured → no-op
  if (req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // ── Button taps: re-run on the last input ──
  const cb = update.callback_query as
    | { id: string; data?: string; message?: { chat?: { id: number } } }
    | undefined;
  if (cb?.message?.chat) {
    const chatId = cb.message.chat.id;
    const deep = cb.data === 'rf:deep';
    after(async () => {
      await answerCallback(cb.id);
      const userId = await userForChat(chatId);
      if (!userId) { await sendMessage(chatId, '먼저 웹앱 설정에서 Telegram을 연결해 주세요.'); return; }
      const { data: sess } = await adminClient()
        .from('telegram_sessions').select('last_input').eq('chat_id', String(chatId)).single();
      if (!sess?.last_input) { await sendMessage(chatId, '다시 분석할 내용이 없어요. 고민을 새로 보내 주세요.'); return; }
      if (!(await allowBotCall(userId))) {
        await sendMessage(chatId, `오늘 봇 분석 한도(${BOT_DAILY_LIMIT}회)를 다 썼어요. 내일 다시 시도해 주세요.`);
        return;
      }
      await runReframe(chatId, sess.last_input, deep);
    });
    return NextResponse.json({ ok: true });
  }

  // ── Messages ──
  const message = (update.message ?? update.edited_message) as
    | { text?: string; chat?: { id: number; title?: string; first_name?: string; type?: string } }
    | undefined;
  const text = message?.text?.trim() ?? '';
  const chat = message?.chat;
  if (!chat || !text) return NextResponse.json({ ok: true });

  const startMatch = /^\/start(?:\s+(\S+))?/.exec(text);
  if (startMatch) {
    after(() => handleStart(chat, startMatch[1]));
    return NextResponse.json({ ok: true });
  }
  // Ignore other slash-commands quietly.
  if (text.startsWith('/')) return NextResponse.json({ ok: true });

  // Plain message → reframe (gated).
  after(async () => {
    const userId = await userForChat(chat.id);
    if (!userId) {
      await sendMessage(chat.id, '먼저 웹앱 설정에서 Telegram을 연결해 주세요. 연결하면 여기서 바로 고민을 리프레임해 드려요.');
      return;
    }
    if (!(await allowBotCall(userId))) {
      await sendMessage(chat.id, `오늘 봇 분석 한도(${BOT_DAILY_LIMIT}회)를 다 썼어요. 내일 다시 시도해 주세요.`);
      return;
    }
    await adminClient().from('telegram_sessions').upsert({
      chat_id: String(chat.id),
      user_id: userId,
      last_input: text.slice(0, INPUT_MAX),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chat_id' });
    await runReframe(chat.id, text, false);
  });
  return NextResponse.json({ ok: true });
}
