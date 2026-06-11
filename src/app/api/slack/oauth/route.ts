import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

function signState(userId: string): string {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) throw new Error('SLACK_SIGNING_SECRET is not set');
  const payload = JSON.stringify({ userId, ts: Date.now() });
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url');
}

export async function GET(req: NextRequest) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!clientId || !signingSecret) {
    // The settings Connect button navigates the whole window here — a raw JSON
    // 503 would strand the user. Send them back with a friendly explanation.
    return NextResponse.redirect(new URL('/settings?slack=unconfigured', req.url));
  }

  // Get userId from query param (passed by client-side JS)
  const url = new URL(req.url);
  const accessToken = url.searchParams.get('token');

  if (!accessToken) {
    return NextResponse.redirect(new URL('/login?redirect=/settings', req.url));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return NextResponse.redirect(new URL('/login?redirect=/settings', req.url));
  }

  const state = signState(user.id);
  const redirectUri = `${url.origin}/api/slack/callback`;

  const slackUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackUrl.searchParams.set('client_id', clientId);
  slackUrl.searchParams.set('scope', 'chat:write,channels:read,groups:read');
  slackUrl.searchParams.set('redirect_uri', redirectUri);
  slackUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(slackUrl.toString());
  // Prevent the access token in our URL from leaking via Referrer to Slack
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
