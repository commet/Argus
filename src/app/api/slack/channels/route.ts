import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(req: NextRequest) {
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

  const slackToken = await getSlackToken(token);
  if (!slackToken) {
    return NextResponse.json({ error: 'Slack not connected' }, { status: 404 });
  }

  // Fetch channels from Slack
  const res = await fetch('https://slack.com/api/conversations.list?' + new URLSearchParams({
    types: 'public_channel,private_channel',
    exclude_archived: 'true',
    limit: '200',
  }), {
    headers: { Authorization: `Bearer ${slackToken}` },
  });

  const data = await res.json();
  if (!data.ok) {
    if (data.error === 'token_revoked' || data.error === 'invalid_auth') {
      // Clean up revoked connection
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      await admin.from('slack_connections').delete().eq('user_id', user.id).eq('access_token', slackToken);
      return NextResponse.json({ error: 'Slack connection expired. Please reconnect.' }, { status: 401 });
    }
    console.error('[slack/channels] Slack API error:', data.error);
    return NextResponse.json({ error: 'Failed to fetch the Slack channel list.' }, { status: 502 });
  }

  const channels = (data.channels || []).map((ch: { id: string; name: string; is_private: boolean }) => ({
    id: ch.id,
    name: ch.name,
    is_private: ch.is_private,
  }));

  return NextResponse.json({ channels });
}
