import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateContentType, validateContentLength, validateOrigin } from '@/lib/api-security';
import { markdownToTelegramHtml } from '@/lib/telegram-format';
import { recordAndCheckShare, adminClient } from '@/lib/share-guard';

/** Send an Argus deliverable to a connected Telegram chat. */
export async function POST(req: NextRequest) {
  const ctError = validateContentType(req);
  if (ctError) return ctError;
  const clError = validateContentLength(req);
  if (clError) return clError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'Telegram is not configured on this deployment.' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { chatId, title, content, context } = body;

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  // Resolve the target chat — must be one of THIS user's connections (RLS via
  // the user's own client; never trust a chatId blindly).
  const { data: conns } = await supabase
    .from('telegram_connections')
    .select('chat_id, chat_title');
  const connList = conns ?? [];
  if (connList.length === 0) {
    return NextResponse.json({ error: 'Telegram not connected' }, { status: 404 });
  }
  const target = chatId
    ? connList.find((c) => c.chat_id === String(chatId))
    : connList[0];
  if (!target) {
    return NextResponse.json({ error: 'Unknown Telegram chat' }, { status: 400 });
  }

  const safeTitle = (typeof title === 'string' && title ? title : 'Argus').slice(0, 200);

  const guard = await recordAndCheckShare(user.id, 'telegram', {
    target: target.chat_title || undefined,
    context: typeof context === 'string' ? context.slice(0, 60) : undefined,
  });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 429 });

  const message = markdownToTelegramHtml(safeTitle, content);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: target.chat_id,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();

  if (!data.ok) {
    // Bot blocked / chat deleted → drop the stale connection so the UI can re-prompt.
    if (data.error_code === 403 || data.error_code === 400) {
      await adminClient()
        .from('telegram_connections')
        .delete()
        .eq('user_id', user.id)
        .eq('chat_id', target.chat_id);
      return NextResponse.json(
        { error: 'Telegram connection is no longer valid. Please reconnect.' },
        { status: 409 },
      );
    }
    console.error('[telegram/send] API error:', data.description);
    return NextResponse.json({ error: 'Telegram 전송에 실패했습니다.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
