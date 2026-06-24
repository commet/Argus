/**
 * Shared Telegram Bot API helpers — used by BOTH the webhook and the reminder
 * cron, so the hard-won robustness (Telegram DROPS messages with malformed HTML
 * → retry as plain text) lives in ONE place and can't drift between surfaces.
 */
function tgUrl(method: string): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

export async function tgCall(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string } | null> {
  try {
    const res = await fetch(tgUrl(method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data && data.ok === false) console.error(`[telegram-api] ${method} rejected:`, data.description);
    return data;
  } catch (err) {
    console.error(`[telegram-api] ${method} failed:`, err);
    return null;
  }
}

/**
 * Send an HTML message; if Telegram rejects the HTML (e.g. an unbalanced <b>
 * from model markdown → "can't parse entities"), retry as plain text with tags
 * stripped so the user ALWAYS gets the content.
 */
export async function tgSendMessage(
  chatId: number | string,
  html: string,
  keyboard?: unknown,
): Promise<void> {
  const base = { chat_id: chatId, disable_web_page_preview: true, ...(keyboard ? { reply_markup: keyboard } : {}) };
  const res = await tgCall('sendMessage', { ...base, text: html, parse_mode: 'HTML' });
  if (!res || res.ok === false) {
    const plain = html.replace(/<\/?[^>]+>/g, '');
    await tgCall('sendMessage', { ...base, text: plain });
  }
}

export async function tgSendChatAction(chatId: number | string, action = 'typing'): Promise<void> {
  await tgCall('sendChatAction', { chat_id: chatId, action });
}

export async function tgAnswerCallback(id: string, text?: string): Promise<void> {
  await tgCall('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) });
}
