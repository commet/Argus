import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateContentType, validateContentLength, validateOrigin } from '@/lib/api-security';
import { markdownToSlackBlocks } from '@/lib/slack-blocks';

/** Fetch Slack token using user's authenticated Supabase client (respects RLS). */
async function getSlackToken(userToken: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${userToken}` } } },
  );
  const { data } = await supabase
    .from('slack_connections')
    .select('access_token')
    .limit(1)
    .single();
  return data?.access_token || null;
}

export async function POST(req: NextRequest) {
  // Security checks
  const ctError = validateContentType(req);
  if (ctError) return ctError;
  const clError = validateContentLength(req);
  if (clError) return clError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  // Verify auth
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

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { channelId, userId: slackUserId, title, content, threadTs, sessionId, workerId } = body;
  // en-first product, but default 'ko' to preserve behavior when the caller omits it.
  const lang: 'ko' | 'en' = body.locale === 'en' ? 'en' : 'ko';

  // Support DM via slackUserId OR channel via channelId
  const targetChannel = slackUserId || channelId;

  if (!targetChannel || typeof targetChannel !== 'string') {
    return NextResponse.json({ error: 'channelId or userId is required' }, { status: 400 });
  }
  if (channelId !== undefined && (typeof channelId !== 'string' || !/^[CDGU][A-Z0-9]{5,}$/i.test(channelId))) {
    return NextResponse.json({ error: 'Invalid channelId format' }, { status: 400 });
  }
  if (slackUserId !== undefined && (typeof slackUserId !== 'string' || !/^[UW][A-Z0-9]{5,}$/i.test(slackUserId))) {
    return NextResponse.json({ error: 'Invalid Slack userId format' }, { status: 400 });
  }
  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  // Length limits
  const safeTitle = title.slice(0, 200);
  const safeContent = content.slice(0, 20000);

  const slackToken = await getSlackToken(token);
  if (!slackToken) {
    return NextResponse.json({ error: 'Slack not connected' }, { status: 404 });
  }

  const blocks = markdownToSlackBlocks(safeTitle, safeContent);

  // For DM: open conversation first to get channel ID
  let resolvedChannel = targetChannel;
  if (slackUserId && !channelId) {
    const openRes = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${slackToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: slackUserId }),
    });
    const openData = await openRes.json();
    if (!openData.ok) {
      console.error('[slack/send] DM open error:', openData.error);
      return NextResponse.json({ error: 'Cannot open DM with this user' }, { status: 502 });
    }
    resolvedChannel = openData.channel.id;
  }

  const messagePayload: Record<string, unknown> = {
    channel: resolvedChannel,
    text: safeTitle,
    blocks,
  };
  // Thread support — reply to an existing message
  if (threadTs) messagePayload.thread_ts = threadTs;

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${slackToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messagePayload),
  });

  const data = await res.json();
  if (!data.ok) {
    if (data.error === 'token_revoked' || data.error === 'invalid_auth') {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      await admin.from('slack_connections').delete().eq('user_id', user.id).eq('access_token', slackToken);
      return NextResponse.json({ error: 'Slack connection expired. Please reconnect.' }, { status: 401 });
    }
    console.error('[slack/send] Slack API error:', data.error);
    return NextResponse.json({ error: lang === 'en' ? 'Failed to send the Slack message.' : 'Slack 메시지 전송에 실패했습니다.' }, { status: 502 });
  }

  // Store thread_ts for reply matching (if session/worker tracking requested)
  if (sessionId && workerId && data.ts) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await admin.from('human_agent_messages').upsert({
      user_id: user.id,
      session_id: sessionId,
      worker_id: workerId,
      channel: 'slack',
      thread_ts: data.ts,
      channel_id: resolvedChannel,
      status: 'sent',
      created_at: new Date().toISOString(),
    }, { onConflict: 'session_id,worker_id' }).then(({ error }) => {
      if (error) console.error('[slack/send] thread tracking error:', error.message);
    });
  }

  return NextResponse.json({ ok: true, ts: data.ts, channel: resolvedChannel });
}
