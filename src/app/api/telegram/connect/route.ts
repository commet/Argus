import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { validateContentType, validateOrigin } from '@/lib/api-security';
import { adminClient } from '@/lib/share-guard';

/**
 * Begin the Telegram connect flow. Issues a short pending code and returns a
 * deep link `t.me/<bot>?start=<code>`. When the user taps it and the bot
 * receives `/start <code>`, /api/telegram/webhook resolves the code → user and
 * stores their chat_id. (Telegram's ?start= is capped at 64 chars, so the code
 * is short and the user↔code map lives in telegram_connect_codes.)
 */
export async function POST(req: NextRequest) {
  const ctError = validateContentType(req);
  if (ctError) return ctError;
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

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unconfigured' }, { status: 503 });
  }

  const code = randomBytes(6).toString('hex'); // 12 chars, well under the 64 limit
  const admin = adminClient();

  // One pending code per user — clear any stale ones first.
  await admin.from('telegram_connect_codes').delete().eq('user_id', user.id);
  const { error: insErr } = await admin
    .from('telegram_connect_codes')
    .insert({ code, user_id: user.id });
  if (insErr) {
    console.error('[telegram/connect] code insert failed:', insErr.message);
    return NextResponse.json({ error: 'Could not start connect flow' }, { status: 500 });
  }

  return NextResponse.json({
    link: `https://t.me/${botUsername}?start=${code}`,
    botUsername,
  });
}
