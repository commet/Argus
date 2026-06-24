import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';
import { reframeSystemPrompt, deeperSuffix, coerceReframe, reframeToMarkdown, REFRAME_TOOL_SCHEMA } from '@/lib/reframe-core';
import { sealSystemPrompt, coerceSealDraft, sealPreviewMarkdown, formatCheckBy, SEAL_TOOL_NAME, SEAL_TOOL_SCHEMA } from '@/lib/seal-core';
import { callAnthropicJson } from '@/lib/llm-server';
import { markdownToTelegramHtml, markdownToTelegramLight as lightHtml } from '@/lib/telegram-format';
import { tgSendMessage as sendMessage, tgSendChatAction, tgAnswerCallback as answerCallback } from '@/lib/telegram-api';

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
 * Processing is synchronous (we await the LLM before returning 200): the fast
 * model keeps it to a few seconds, inside Telegram's webhook timeout. We had to
 * drop next/server after() — it ran for message updates but NOT callback_query
 * updates on this deployment, silently dropping button taps.
 */
export const maxDuration = 60;

const BOT_DAILY_LIMIT = 20;
const INPUT_MAX = 4000;
const FIFTEEN_MIN = 15 * 60 * 1000;

// ── Telegram send/ack helpers are shared in lib/telegram-api (webhook + cron). ──
function sendTyping(chatId: number | string): Promise<void> {
  return tgSendChatAction(chatId, 'typing');
}

function reframeKeyboard(locale: 'ko' | 'en') {
  return {
    inline_keyboard: [
      [
        { text: locale === 'ko' ? '🔍 더 깊이' : '🔍 Deeper', callback_data: 'rf:deep' },
        { text: locale === 'ko' ? '♻️ 다시' : '♻️ Again', callback_data: 'rf:redo' },
      ],
      [{ text: locale === 'ko' ? '🔒 이 결정 봉인' : '🔒 Seal this decision', callback_data: 'rf:seal' }],
    ],
  };
}

function sealKeyboard(locale: 'ko' | 'en') {
  return {
    inline_keyboard: [
      [{ text: locale === 'ko' ? '✅ 봉인' : '✅ Seal', callback_data: 'sl:ok' }],
      [
        { text: locale === 'ko' ? '📅 1주 뒤' : '📅 in 1w', callback_data: 'sl:1w' },
        { text: locale === 'ko' ? '📅 1달 뒤' : '📅 in 1m', callback_data: 'sl:1m' },
      ],
      [{ text: locale === 'ko' ? '❌ 취소' : '❌ Cancel', callback_data: 'sl:x' }],
    ],
  };
}

/** "today + days" as a YYYY-MM-DD string in KST (matches the reminder cron's
 *  notion of "today"). */
function kstDatePlus(days: number): string {
  return new Date(Date.now() + 9 * 3600 * 1000 + days * 86400 * 1000).toISOString().slice(0, 10);
}
/** A friendly month/day label from a YYYY-MM-DD string (TZ-safe: built from parts). */
function dateLabel(iso: string, locale: 'ko' | 'en'): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formatCheckBy(new Date(y, (m || 1) - 1, d || 1), locale);
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
async function runReframe(chatId: number | string, input: string, deep: boolean, model: 'fast' | 'default' = 'fast'): Promise<void> {
  const locale = detectLocale(input);
  await sendTyping(chatId);
  let result;
  try {
    const system = reframeSystemPrompt(locale) + (deep ? deeperSuffix(locale) : '');
    // Forced tool-use → always-valid JSON (a flaky fast model would otherwise
    // emit a malformed array and break text-JSON parsing). 'fast' keeps the
    // synchronous webhook quick; the chain falls back to a proven model.
    const raw = await callAnthropicJson({
      system, user: input.slice(0, INPUT_MAX),
      toolName: 'reframe_result', schema: REFRAME_TOOL_SCHEMA, model, maxTokens: 1500,
    });
    result = coerceReframe(raw);
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

// ── Seal flow (decision → falsifiable, later-checkable form) ──
interface SealPending {
  kind: 'seal';
  decision: string;
  predicate: string;
  falsified_if: string;
  check_by: string;
  quote: string;
  locale: 'ko' | 'en';
}

async function handleSealDraft(chatId: number | string, userId: string): Promise<void> {
  const admin = adminClient();
  const { data: sess } = await admin
    .from('telegram_sessions').select('last_input').eq('chat_id', String(chatId)).single();
  if (!sess?.last_input) {
    await sendMessage(chatId, '봉인할 결정이 없어요. 먼저 고민이나 결정을 메시지로 보내 주세요.');
    return;
  }
  if (!(await allowBotCall(userId))) {
    await sendMessage(chatId, `오늘 봇 분석 한도(${BOT_DAILY_LIMIT}회)를 다 썼어요. 내일 다시 시도해 주세요.`);
    return;
  }
  const locale = detectLocale(sess.last_input);
  await sendTyping(chatId);
  let draft = null;
  let errReason = '';
  try {
    const raw = await callAnthropicJson({
      system: sealSystemPrompt(locale), user: sess.last_input.slice(0, INPUT_MAX),
      toolName: SEAL_TOOL_NAME, schema: SEAL_TOOL_SCHEMA, model: 'fast', maxTokens: 900,
    });
    draft = coerceSealDraft(raw);
    if (!draft) errReason = 'coerce_null:' + JSON.stringify(raw).slice(0, 180);
  } catch (err) {
    errReason = String((err as { message?: string })?.message || err).slice(0, 200);
    console.error('[telegram/webhook] seal draft failed:', err);
  }
  if (!draft) {
    // TEMP self-diagnostic: stash the reason so it can be read via SQL.
    await admin.from('telegram_sessions').update({ pending: { kind: 'sealerr', reason: errReason } }).eq('chat_id', String(chatId));
    await sendMessage(chatId, locale === 'ko'
      ? '이건 봉인할 결정으로 정리하기 어려웠어요. "무엇을 하기로 했는지" 한 줄로 적어 보내 주세요.'
      : "Couldn't shape this into a sealable decision. Send one line on what you decided.");
    return;
  }
  const checkBy = kstDatePlus(draft.check_by_days);
  const pending: SealPending = {
    kind: 'seal', decision: draft.decision, predicate: draft.predicate,
    falsified_if: draft.falsified_if, check_by: checkBy, quote: sess.last_input.slice(0, INPUT_MAX), locale,
  };
  await admin.from('telegram_sessions').update({ pending }).eq('chat_id', String(chatId));
  await sendMessage(chatId, lightHtml(sealPreviewMarkdown(draft, dateLabel(checkBy, locale), locale)), sealKeyboard(locale));
}

async function handleSealConfirm(chatId: number | string, userId: string, action: string): Promise<void> {
  const admin = adminClient();
  const { data: sess } = await admin
    .from('telegram_sessions').select('pending').eq('chat_id', String(chatId)).single();
  const p = (sess?.pending ?? null) as SealPending | null;
  if (!p || p.kind !== 'seal') {
    await sendMessage(chatId, '진행 중인 봉인이 없어요. 결과 화면의 "🔒 이 결정 봉인"을 다시 눌러 주세요.');
    return;
  }
  const locale = p.locale || 'ko';

  if (action === 'x') {
    await admin.from('telegram_sessions').update({ pending: null }).eq('chat_id', String(chatId));
    await sendMessage(chatId, locale === 'ko' ? '봉인하지 않았어요.' : 'Not sealed.');
    return;
  }
  if (action === '1w' || action === '1m') {
    const checkBy = kstDatePlus(action === '1w' ? 7 : 30);
    await admin.from('telegram_sessions').update({ pending: { ...p, check_by: checkBy } }).eq('chat_id', String(chatId));
    await sendMessage(chatId, lightHtml(sealPreviewMarkdown(
      { decision: p.decision, predicate: p.predicate, falsified_if: p.falsified_if, check_by_days: 0 },
      dateLabel(checkBy, locale), locale,
    )), sealKeyboard(locale));
    return;
  }
  // action === 'ok' → write the sealed decision
  const { error } = await admin.from('telegram_decisions').insert({
    user_id: userId, chat_id: String(chatId),
    decision: p.decision, quote: p.quote || null,
    predicate: p.predicate, falsified_if: p.falsified_if || null,
    check_by: p.check_by, status: 'sealed',
  });
  await admin.from('telegram_sessions').update({ pending: null }).eq('chat_id', String(chatId));
  if (error) {
    console.error('[telegram/webhook] seal insert failed:', error.message);
    await sendMessage(chatId, '봉인 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    return;
  }
  await sendMessage(chatId, lightHtml(locale === 'ko'
    ? `🔒 봉인했어요. **${dateLabel(p.check_by, locale)}**에 "그래서, 어떻게 됐어요?" 하고 먼저 물어볼게요.`
    : `🔒 Sealed. On **${dateLabel(p.check_by, locale)}** I’ll come back first and ask, “So — how did it go?”`));
}

// ── Settle flow (the check-in answer: 잘 됐어요/안 됐어요/반반/아직) ──
async function handleSettle(chatId: number | string, userId: string, payload: string): Promise<void> {
  const [id, outcome] = payload.split(':');
  const admin = adminClient();
  const { data: dec } = await admin
    .from('telegram_decisions')
    .select('id, user_id, decision, check_by, status, history')
    .eq('id', id).single();
  if (!dec || dec.user_id !== userId) {
    await sendMessage(chatId, '그 결정을 찾을 수 없어요.');
    return;
  }
  const locale = detectLocale(dec.decision || '');
  if (dec.status === 'settled') {
    await sendMessage(chatId, locale === 'ko' ? '이미 정산된 결정이에요.' : 'Already settled.');
    return;
  }

  // "아직" — extend the check-in instead of settling (변침도 기록이다: push the
  // old date onto history, never overwrite; re-arm the reminder).
  if (outcome === 'later') {
    const newCheck = kstDatePlus(14);
    const history = Array.isArray(dec.history) ? dec.history : [];
    await admin.from('telegram_decisions').update({
      check_by: newCheck,
      reminded_at: null,
      history: [...history, { check_by: dec.check_by, amended_at: new Date().toISOString() }],
    }).eq('id', id);
    await sendMessage(chatId, lightHtml(locale === 'ko'
      ? `알겠어요. **${dateLabel(newCheck, locale)}**에 다시 물어볼게요.`
      : `Got it. I’ll ask again on **${dateLabel(newCheck, locale)}**.`));
    return;
  }

  if (!['happened', 'avoided', 'partial'].includes(outcome)) {
    await sendMessage(chatId, '알 수 없는 응답이에요.');
    return;
  }
  await admin.from('telegram_decisions').update({
    status: 'settled', outcome, settled_at: new Date().toISOString(),
  }).eq('id', id);

  const { count } = await admin
    .from('telegram_decisions').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('status', 'settled');
  const settled = count ?? 0;
  const label = locale === 'ko'
    ? (outcome === 'happened' ? '잘 됨' : outcome === 'avoided' ? '안 됨' : '반반')
    : outcome;
  let msg = locale === 'ko' ? `기록했어요 — **${label}**.` : `Recorded — **${label}**.`;
  if (settled >= 5) {
    msg += locale === 'ko'
      ? `\n정산 ${settled}건째 — 이제 당신의 판단 기록이 쌓이고 있어요.`
      : `\n${settled} settled — your track record is building.`;
  }
  await sendMessage(chatId, lightHtml(msg));
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
    const data = cb.data || '';
    // Synchronous — after() does NOT run for callback_query updates on this
    // deployment (it does for messages). With the fast model the whole thing is
    // a few seconds, well inside Telegram's webhook timeout.
    await answerCallback(cb.id); // clear the button spinner
    try {
      const userId = await userForChat(chatId);
      if (!userId) { await sendMessage(chatId, '먼저 웹앱 설정에서 Telegram을 연결해 주세요.'); return NextResponse.json({ ok: true }); }

      if (data === 'rf:deep' || data === 'rf:redo') {
        const { data: sess } = await adminClient()
          .from('telegram_sessions').select('last_input').eq('chat_id', String(chatId)).single();
        if (!sess?.last_input) { await sendMessage(chatId, '다시 분석할 내용이 없어요. 고민을 새로 보내 주세요.'); return NextResponse.json({ ok: true }); }
        if (!(await allowBotCall(userId))) {
          await sendMessage(chatId, `오늘 봇 분석 한도(${BOT_DAILY_LIMIT}회)를 다 썼어요. 내일 다시 시도해 주세요.`);
          return NextResponse.json({ ok: true });
        }
        await runReframe(chatId, sess.last_input, data === 'rf:deep');
      } else if (data === 'rf:seal') {
        await handleSealDraft(chatId, userId);
      } else if (data.startsWith('sl:')) {
        await handleSealConfirm(chatId, userId, data.slice(3));
      } else if (data.startsWith('st:')) {
        await handleSettle(chatId, userId, data.slice(3));
      }
    } catch (err) {
      console.error('[telegram/webhook] callback failed:', err);
      const reason = String((err as { message?: string })?.message || err)
        .slice(0, 200).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      await sendMessage(chatId, `버튼 처리 중 막혔어요.\n\n<code>${reason}</code>`);
    }
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
    await handleStart(chat, startMatch[1]);
    return NextResponse.json({ ok: true });
  }
  // Ignore other slash-commands quietly.
  if (text.startsWith('/')) return NextResponse.json({ ok: true });

  // Plain message → reframe (gated). Synchronous (see callback note above).
  try {
    const userId = await userForChat(chat.id);
    if (!userId) {
      await sendMessage(chat.id, '먼저 웹앱 설정에서 Telegram을 연결해 주세요. 연결하면 여기서 바로 고민을 리프레임해 드려요.');
      return NextResponse.json({ ok: true });
    }
    if (!(await allowBotCall(userId))) {
      await sendMessage(chat.id, `오늘 봇 분석 한도(${BOT_DAILY_LIMIT}회)를 다 썼어요. 내일 다시 시도해 주세요.`);
      return NextResponse.json({ ok: true });
    }
    await adminClient().from('telegram_sessions').upsert({
      chat_id: String(chat.id),
      user_id: userId,
      last_input: text.slice(0, INPUT_MAX),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chat_id' });
    await runReframe(chat.id, text, false);
  } catch (err) {
    console.error('[telegram/webhook] message failed:', err);
    const reason = String((err as { message?: string })?.message || err)
      .slice(0, 200).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await sendMessage(chat.id, `잠깐 막혔어요.\n\n<code>${reason}</code>`);
  }
  return NextResponse.json({ ok: true });
}
