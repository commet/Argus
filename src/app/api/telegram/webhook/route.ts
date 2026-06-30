import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/share-guard';
import { reframeSystemPrompt, deeperSuffix, coerceReframe, reframeToMarkdown, REFRAME_TOOL_SCHEMA, questionSystemPrompt, coerceQuestion, questionToMarkdown, QUESTION_TOOL_NAME, QUESTION_TOOL_SCHEMA } from '@/lib/reframe-core';
import { sealSystemPrompt, coerceSealDraft, sealPreviewMarkdown, formatCheckBy, parseCheckBy, SEAL_TOOL_NAME, SEAL_TOOL_SCHEMA } from '@/lib/seal-core';
import { rehearseSystemPrompt, buildRehearseUser, coerceRehearse, rehearseToMarkdown, REHEARSE_PRESETS, REHEARSE_TOOL_NAME, REHEARSE_TOOL_SCHEMA } from '@/lib/rehearse-core';
import { recordSummaryMarkdown } from '@/lib/record-core';
import { recastSystemPrompt, coerceRecast, recastToMarkdown, RECAST_TOOL_NAME, RECAST_TOOL_SCHEMA } from '@/lib/recast-core';
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
  const ko = locale === 'ko';
  return {
    inline_keyboard: [
      [
        { text: ko ? '🔍 더 깊이' : '🔍 Deeper', callback_data: 'rf:deep' },
        { text: ko ? '♻️ 다시' : '♻️ Again', callback_data: 'rf:redo' },
      ],
      [
        { text: ko ? '🎯 진짜 질문' : '🎯 Real question', callback_data: 'rf:question' },
        { text: ko ? '🎭 리허설' : '🎭 Rehearse', callback_data: 'rf:rehearse' },
      ],
      [
        { text: ko ? '🤝 역할 나누기' : '🤝 Split roles', callback_data: 'rf:recast' },
        { text: ko ? '🌐 웹앱에서' : '🌐 In the webapp', callback_data: 'rf:handoff' },
      ],
      [{ text: ko ? '🔒 이 결정 봉인' : '🔒 Seal this decision', callback_data: 'rf:seal' }],
    ],
  };
}

/** Keyboard shown under a tool output (question/rehearse/recast) — keeps the
 *  other tools reachable so the user can keep exploring without re-sending. */
function questionKeyboard(locale: 'ko' | 'en') {
  const ko = locale === 'ko';
  return {
    inline_keyboard: [
      [
        { text: ko ? '🎯 진짜 질문' : '🎯 Real question', callback_data: 'rf:question' },
        { text: ko ? '🎭 리허설' : '🎭 Rehearse', callback_data: 'rf:rehearse' },
      ],
      [
        { text: ko ? '🤝 역할 나누기' : '🤝 Split roles', callback_data: 'rf:recast' },
        { text: ko ? '🌐 웹앱에서' : '🌐 In the webapp', callback_data: 'rf:handoff' },
      ],
      [{ text: ko ? '🔒 이 결정 봉인' : '🔒 Seal this decision', callback_data: 'rf:seal' }],
    ],
  };
}

/** Stakeholder picker for rehearse. */
function rehearsePickerKeyboard(locale: 'ko' | 'en') {
  const lab = (k: string) => (locale === 'ko' ? REHEARSE_PRESETS[k].ko : REHEARSE_PRESETS[k].en);
  return {
    inline_keyboard: [
      [
        { text: lab('boss'), callback_data: 'rh:boss' },
        { text: lab('investor'), callback_data: 'rh:investor' },
      ],
      [
        { text: lab('customer'), callback_data: 'rh:customer' },
        { text: lab('team'), callback_data: 'rh:team' },
      ],
      [{ text: locale === 'ko' ? '✏️ 직접 지정' : '✏️ Custom', callback_data: 'rh:custom' }],
    ],
  };
}

function sealKeyboard(locale: 'ko' | 'en') {
  const ko = locale === 'ko';
  return {
    inline_keyboard: [
      [
        { text: ko ? '3일' : '3d', callback_data: 'sl:3d' },
        { text: ko ? '1주' : '1w', callback_data: 'sl:1w' },
        { text: ko ? '2주' : '2w', callback_data: 'sl:2w' },
      ],
      [
        { text: ko ? '1달' : '1m', callback_data: 'sl:1m' },
        { text: ko ? '3달' : '3m', callback_data: 'sl:3m' },
        { text: ko ? '✏️ 직접' : '✏️ Custom', callback_data: 'sl:date' },
      ],
      [
        { text: ko ? '✅ 봉인' : '✅ Seal', callback_data: 'sl:ok' },
        { text: ko ? '❌ 취소' : '❌ Cancel', callback_data: 'sl:x' },
      ],
    ],
  };
}

const PRESET_DAYS: Record<string, number> = { '3d': 3, '1w': 7, '2w': 14, '1m': 30, '3m': 90 };

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

// ── Cross-surface bearing — the bot has the user's identity but used it only to
//    gate/write; it never READ the user's decisions on other surfaces. A connected
//    user decides on web, plugin, AND here, yet each surface saw one silo. This is
//    the passive bridge: pure cross-table COUNTS (telegram_decisions now also holds
//    web-mirrored seals; plugin_decisions holds plugin pushes). Spine-safe — a
//    frequency statement, never an inference or a "related decision?" nudge (those
//    must stay behind an explicit user tap per the zero-judgment gate).
async function crossSurfaceBearing(userId: string): Promise<{ open: number; dueThisWeek: number }> {
  const admin = adminClient();
  const weekEnd = kstDatePlus(7); // YYYY-MM-DD, one week out (overdue counts as due)
  const [tg, pg] = await Promise.all([
    admin.from('telegram_decisions').select('check_by').eq('user_id', userId).eq('status', 'sealed'),
    admin.from('plugin_decisions').select('check_by').eq('user_id', userId).eq('status', 'sealed'),
  ]);
  const rows = [...(tg.data ?? []), ...(pg.data ?? [])];
  return {
    open: rows.length,
    dueThisWeek: rows.filter((r) => typeof r.check_by === 'string' && !!r.check_by && r.check_by <= weekEnd).length,
  };
}

/** One spine-safe line; null when there's nothing open (no noise for fresh users). */
function bearingLine(open: number, dueThisWeek: number, locale: 'ko' | 'en'): string | null {
  if (open <= 0) return null;
  if (locale === 'ko') {
    return `🧭 웹·플러그인·텔레그램 통틀어 열린 결정 **${open}**건${dueThisWeek > 0 ? `, 이번 주 안에 정산할 게 **${dueThisWeek}**건 있어요` : ''}.`;
  }
  return `🧭 **${open}** open decision(s) across web · plugin · Telegram${dueThisWeek > 0 ? `, **${dueThisWeek}** due this week` : ''}.`;
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
    await sendMessage(chatId, locale === 'ko'
      ? '잠깐 막혔어요. 잠시 후 다시 보내 주세요.'
      : 'Hit a snag. Please try again in a moment.');
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

// ── Stage 2: question reframe + neutral crux (shared brain) ──
async function handleQuestion(chatId: number | string, userId: string): Promise<void> {
  const admin = adminClient();
  const { data: sess } = await admin
    .from('telegram_sessions').select('last_input').eq('chat_id', String(chatId)).single();
  if (!sess?.last_input) {
    await sendMessage(chatId, '다시 볼 내용이 없어요. 고민을 새로 보내 주세요.');
    return;
  }
  if (!(await allowBotCall(userId))) {
    await sendMessage(chatId, `오늘 봇 분석 한도(${BOT_DAILY_LIMIT}회)를 다 썼어요. 내일 다시 시도해 주세요.`);
    return;
  }
  const locale = detectLocale(sess.last_input);
  await sendTyping(chatId);
  let q = null;
  try {
    const raw = await callAnthropicJson({
      system: questionSystemPrompt(locale), user: sess.last_input.slice(0, INPUT_MAX),
      toolName: QUESTION_TOOL_NAME, schema: QUESTION_TOOL_SCHEMA, model: 'fast', maxTokens: 900,
    });
    q = coerceQuestion(raw);
  } catch (err) {
    console.error('[telegram/webhook] question reframe failed:', err);
  }
  if (!q) {
    await sendMessage(chatId, locale === 'ko'
      ? '진짜 질문을 뽑아내기 어려웠어요. 잠시 후 다시 시도해 주세요.'
      : "Couldn't pull out the real question. Try again in a moment.");
    return;
  }
  const title = locale === 'ko' ? '질문 다시 세우기' : 'Reframing the question';
  await sendMessage(chatId, markdownToTelegramHtml(title, questionToMarkdown(q, locale)), questionKeyboard(locale));
}

// ── Track record (자차표) — the visible payoff of the seal/settle loop ──
async function showRecord(chatId: number | string, userId: string): Promise<void> {
  const { data } = await adminClient()
    .from('telegram_decisions').select('status, outcome').eq('user_id', userId);
  const rows = data ?? [];
  const counts = {
    open: rows.filter((r) => r.status === 'sealed').length,
    settled: rows.filter((r) => r.status === 'settled').length,
    happened: rows.filter((r) => r.outcome === 'happened').length,
    avoided: rows.filter((r) => r.outcome === 'avoided').length,
    partial: rows.filter((r) => r.outcome === 'partial').length,
  };
  // Cross-surface bearing on top: surfaces decisions sealed on web/plugin that the
  // telegram-only record below would otherwise miss (explicitly labeled "across …"
  // so the wider count never reads as a contradiction of the telegram record).
  const bearing = await crossSurfaceBearing(userId);
  const line = bearingLine(bearing.open, bearing.dueThisWeek, 'ko');
  const body = recordSummaryMarkdown(counts, 'ko');
  await sendMessage(chatId, lightHtml(line ? `${line}\n\n${body}` : body));
}

function recordButton(locale: 'ko' | 'en') {
  return { inline_keyboard: [[{ text: locale === 'ko' ? '📊 내 기록' : '📊 My record', callback_data: 'rc:show' }]] };
}

// ── Rehearse: simulate a stakeholder's reaction ──
async function lastInputFor(chatId: number | string): Promise<string | null> {
  const { data } = await adminClient()
    .from('telegram_sessions').select('last_input').eq('chat_id', String(chatId)).single();
  return data?.last_input ?? null;
}

async function handleRehearsePicker(chatId: number | string): Promise<void> {
  const decision = await lastInputFor(chatId);
  if (!decision) {
    await sendMessage(chatId, '리허설할 계획이 없어요. 먼저 결정이나 계획을 메시지로 보내 주세요.');
    return;
  }
  const locale = detectLocale(decision);
  await sendMessage(chatId, locale === 'ko'
    ? '누구 앞에서 리허설할까요?'
    : 'Whom should we rehearse against?', rehearsePickerKeyboard(locale));
}

async function handleRehearse(chatId: number | string, userId: string, who: string, whoLabel: string, decisionArg?: string): Promise<void> {
  const decision = decisionArg ?? (await lastInputFor(chatId));
  if (!decision) {
    await sendMessage(chatId, '리허설할 계획이 없어요. 먼저 결정을 보내 주세요.');
    return;
  }
  if (!(await allowBotCall(userId))) {
    await sendMessage(chatId, `오늘 봇 분석 한도(${BOT_DAILY_LIMIT}회)를 다 썼어요. 내일 다시 시도해 주세요.`);
    return;
  }
  const locale = detectLocale(decision);
  await sendTyping(chatId);
  let r = null;
  try {
    const raw = await callAnthropicJson({
      system: rehearseSystemPrompt(locale), user: buildRehearseUser(decision.slice(0, INPUT_MAX), who, locale),
      toolName: REHEARSE_TOOL_NAME, schema: REHEARSE_TOOL_SCHEMA, model: 'fast', maxTokens: 1100,
    });
    r = coerceRehearse(raw);
  } catch (err) {
    console.error('[telegram/webhook] rehearse failed:', err);
  }
  if (!r) {
    await sendMessage(chatId, locale === 'ko'
      ? '리허설을 만들기 어려웠어요. 잠시 후 다시 시도해 주세요.'
      : "Couldn't run the rehearsal. Try again in a moment.");
    return;
  }
  const title = locale === 'ko' ? '리허설' : 'Rehearsal';
  await sendMessage(chatId, markdownToTelegramHtml(title, rehearseToMarkdown(r, whoLabel, locale)), questionKeyboard(locale));
}

// ── Recast: split into AI / human-judgment / both (the judgment ladder) ──
async function handleRecast(chatId: number | string, userId: string): Promise<void> {
  const decision = await lastInputFor(chatId);
  if (!decision) {
    await sendMessage(chatId, '역할을 나눌 계획이 없어요. 먼저 결정이나 계획을 보내 주세요.');
    return;
  }
  if (!(await allowBotCall(userId))) {
    await sendMessage(chatId, `오늘 봇 분석 한도(${BOT_DAILY_LIMIT}회)를 다 썼어요. 내일 다시 시도해 주세요.`);
    return;
  }
  const locale = detectLocale(decision);
  await sendTyping(chatId);
  let steps = null;
  try {
    const raw = await callAnthropicJson({
      system: recastSystemPrompt(locale), user: decision.slice(0, INPUT_MAX),
      toolName: RECAST_TOOL_NAME, schema: RECAST_TOOL_SCHEMA, model: 'fast', maxTokens: 1200,
    });
    steps = coerceRecast(raw);
  } catch (err) {
    console.error('[telegram/webhook] recast failed:', err);
  }
  if (!steps) {
    await sendMessage(chatId, locale === 'ko'
      ? '역할 분담을 만들기 어려웠어요. 잠시 후 다시 시도해 주세요.'
      : "Couldn't split the roles. Try again in a moment.");
    return;
  }
  const title = locale === 'ko' ? '역할 나누기' : 'Role split';
  await sendMessage(chatId, markdownToTelegramHtml(title, recastToMarkdown(steps, locale)), questionKeyboard(locale));
}

// ── Handoff: open the decision in the webapp for the heavy multi-expert flow ──
async function handleHandoff(chatId: number | string): Promise<void> {
  const decision = await lastInputFor(chatId);
  if (!decision) {
    await sendMessage(chatId, '웹앱으로 넘길 내용이 없어요. 먼저 결정을 보내 주세요.');
    return;
  }
  const locale = detectLocale(decision);
  // /workspace reads ?q= to pre-fill (the same contract the landing input uses).
  const url = `https://argus.voyage/workspace?q=${encodeURIComponent(decision.slice(0, 500))}`;
  await sendMessage(chatId, locale === 'ko'
    ? '여러 전문가가 함께 보는 깊은 분석(팀·검증·최종 문서)은 웹앱에서 — 이 결정을 미리 담아 열어요.'
    : 'For the full multi-expert analysis (team · verify · final doc), open it in the webapp — this decision pre-loaded.',
    { inline_keyboard: [[{ text: locale === 'ko' ? '🌐 웹앱에서 열기' : '🌐 Open in the webapp', url }]] });
}

// ── Seal flow (decision → falsifiable, later-checkable form) ──
interface RehearsePending {
  kind: 'rehearse';
  awaiting: 'who';
  decision: string;
  locale: 'ko' | 'en';
}

interface SealPending {
  kind: 'seal';
  decision: string;
  predicate: string;
  falsified_if: string;
  check_by: string;
  quote: string;
  locale: 'ko' | 'en';
  /** Set when waiting for the user to TYPE a custom check-in date. */
  awaiting?: 'date';
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
  try {
    const raw = await callAnthropicJson({
      system: sealSystemPrompt(locale), user: sess.last_input.slice(0, INPUT_MAX),
      toolName: SEAL_TOOL_NAME, schema: SEAL_TOOL_SCHEMA, model: 'fast', maxTokens: 900,
    });
    draft = coerceSealDraft(raw);
  } catch (err) {
    console.error('[telegram/webhook] seal draft failed:', err);
  }
  if (!draft) {
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
  // Date preset (3d/1w/2w/1m/3m) → update check_by, re-show preview.
  if (action in PRESET_DAYS) {
    const checkBy = kstDatePlus(PRESET_DAYS[action]);
    await admin.from('telegram_sessions').update({ pending: { ...p, check_by: checkBy, awaiting: undefined } }).eq('chat_id', String(chatId));
    await sendMessage(chatId, lightHtml(sealPreviewMarkdown(
      { decision: p.decision, predicate: p.predicate, falsified_if: p.falsified_if, check_by_days: 0 },
      dateLabel(checkBy, locale), locale,
    )), sealKeyboard(locale));
    return;
  }
  // Custom date → prompt the user to type one (consumed in the message branch).
  if (action === 'date') {
    await admin.from('telegram_sessions').update({ pending: { ...p, awaiting: 'date' } }).eq('chat_id', String(chatId));
    await sendMessage(chatId, locale === 'ko'
      ? '확인일을 입력해 주세요. 예: 2026-09-01 · 9월 1일 · 45일 뒤 · 3주 뒤'
      : 'Type a check-in date. e.g. 2026-09-01 · 9/1 · in 45 days · 3 weeks');
    return;
  }
  if (action !== 'ok') return; // unknown action → ignore

  // Write the sealed decision.
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
  await sendMessage(chatId, lightHtml(msg), recordButton(locale));
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
  // If they already have decisions in flight elsewhere, name it once — a connect
  // is the moment cross-surface continuity becomes real (spine-safe: counts only).
  try {
    const bearing = await crossSurfaceBearing(pending.user_id);
    const line = bearingLine(bearing.open, bearing.dueThisWeek, 'ko');
    if (line) await sendMessage(chat.id, lightHtml(line));
  } catch (err) {
    console.error('[telegram/webhook] bearing on connect failed:', err);
  }
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
      } else if (data === 'rf:question') {
        await handleQuestion(chatId, userId);
      } else if (data === 'rf:rehearse') {
        await handleRehearsePicker(chatId);
      } else if (data.startsWith('rh:')) {
        const role = data.slice(3);
        const decision = await lastInputFor(chatId);
        const locale = decision ? detectLocale(decision) : 'ko';
        if (!decision) {
          await sendMessage(chatId, '리허설할 계획이 없어요. 먼저 결정을 보내 주세요.');
        } else if (role === 'custom') {
          const pending: RehearsePending = { kind: 'rehearse', awaiting: 'who', decision, locale };
          await adminClient().from('telegram_sessions').update({ pending }).eq('chat_id', String(chatId));
          await sendMessage(chatId, locale === 'ko'
            ? '누구 앞에서 리허설할까요? 한 줄로 적어 보내 주세요. (예: CFO · 까다로운 고객 · 팀장)'
            : 'Whom? Type one line. (e.g. CFO · a tough customer · team lead)');
        } else if (REHEARSE_PRESETS[role]) {
          const p = REHEARSE_PRESETS[role];
          await handleRehearse(chatId, userId, locale === 'ko' ? p.whoKo : p.whoEn, locale === 'ko' ? p.ko : p.en, decision);
        }
      } else if (data === 'rf:recast') {
        await handleRecast(chatId, userId);
      } else if (data === 'rf:handoff') {
        await handleHandoff(chatId);
      } else if (data === 'rf:seal') {
        await handleSealDraft(chatId, userId);
      } else if (data.startsWith('sl:')) {
        await handleSealConfirm(chatId, userId, data.slice(3));
      } else if (data.startsWith('st:')) {
        await handleSettle(chatId, userId, data.slice(3));
      } else if (data === 'rc:show') {
        await showRecord(chatId, userId);
      }
    } catch (err) {
      console.error('[telegram/webhook] callback failed:', err);
      await sendMessage(chatId, '버튼 처리 중 잠깐 막혔어요. 잠시 후 다시 시도해 주세요.');
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
  if (text === '/record' || text === '/stats') {
    const userId = await userForChat(chat.id);
    if (userId) await showRecord(chat.id, userId);
    else await sendMessage(chat.id, '먼저 웹앱 설정에서 Telegram을 연결해 주세요.');
    return NextResponse.json({ ok: true });
  }
  if (text === '/help') {
    await sendMessage(chat.id, lightHtml([
      '🧭 **Argus 봇 쓰는 법**',
      '',
      '고민이나 결정을 **그냥 메시지로** 보내면 숨은 전제를 짚어 드려요.',
      '결과 아래 버튼으로:',
      '• 🔍 더 깊이 / 🎯 진짜 질문 / 🎭 리허설',
      '• 🔒 봉인 — 정한 날 "어떻게 됐어요?" 하고 돌아와 물어봐요',
      '',
      '/record — 내 결정 기록 보기',
    ].join('\n')));
    return NextResponse.json({ ok: true });
  }
  // Ignore other slash-commands quietly.
  if (text.startsWith('/')) return NextResponse.json({ ok: true });

  // Plain message → either a typed check-in date (if a seal awaits one) or a new
  // reframe (gated). Synchronous (see callback note above).
  try {
    const userId = await userForChat(chat.id);
    if (!userId) {
      await sendMessage(chat.id, '먼저 웹앱 설정에서 Telegram을 연결해 주세요. 연결하면 여기서 바로 고민을 리프레임해 드려요.');
      return NextResponse.json({ ok: true });
    }

    // A pending flow may be waiting for typed input (rehearse target / seal date).
    const { data: sess } = await adminClient()
      .from('telegram_sessions').select('pending').eq('chat_id', String(chat.id)).single();
    const pend = (sess?.pending ?? null) as SealPending | RehearsePending | null;
    if (pend?.kind === 'rehearse' && pend.awaiting === 'who') {
      const who = text.slice(0, 100);
      await adminClient().from('telegram_sessions').update({ pending: null }).eq('chat_id', String(chat.id));
      await handleRehearse(chat.id, userId, who, who, pend.decision);
      return NextResponse.json({ ok: true });
    }
    if (pend?.kind === 'seal' && pend.awaiting === 'date') {
      const parsed = parseCheckBy(text, kstDatePlus(0));
      if (!parsed) {
        await sendMessage(chat.id, pend.locale === 'en'
          ? "Couldn't read that as a date. e.g. 2026-09-01 · 9/1 · in 45 days"
          : '날짜로 못 읽었어요. 예: 2026-09-01 · 9월 1일 · 45일 뒤');
        return NextResponse.json({ ok: true });
      }
      await adminClient().from('telegram_sessions')
        .update({ pending: { ...pend, check_by: parsed, awaiting: undefined } })
        .eq('chat_id', String(chat.id));
      await sendMessage(chat.id, lightHtml(sealPreviewMarkdown(
        { decision: pend.decision, predicate: pend.predicate, falsified_if: pend.falsified_if, check_by_days: 0 },
        dateLabel(parsed, pend.locale), pend.locale,
      )), sealKeyboard(pend.locale));
      return NextResponse.json({ ok: true });
    }

    // Otherwise → new reframe. Clear any stale pending seal.
    if (!(await allowBotCall(userId))) {
      await sendMessage(chat.id, `오늘 봇 분석 한도(${BOT_DAILY_LIMIT}회)를 다 썼어요. 내일 다시 시도해 주세요.`);
      return NextResponse.json({ ok: true });
    }
    await adminClient().from('telegram_sessions').upsert({
      chat_id: String(chat.id),
      user_id: userId,
      last_input: text.slice(0, INPUT_MAX),
      pending: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chat_id' });
    await runReframe(chat.id, text, false);
  } catch (err) {
    console.error('[telegram/webhook] message failed:', err);
    await sendMessage(chat.id, '잠깐 막혔어요. 잠시 후 다시 보내 주세요.');
  }
  return NextResponse.json({ ok: true });
}
