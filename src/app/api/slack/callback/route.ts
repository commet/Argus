import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { isLocale, type AppLocale } from '@/lib/locale-path';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

interface VerifiedState {
  userId: string;
  locale: AppLocale;
}

interface SlackTokenResponse {
  ok?: boolean;
  error?: string;
  access_token?: string;
  scope?: string;
  bot_user_id?: string;
  team?: { id?: string; name?: string };
  authed_user?: { id?: string };
  incoming_webhook?: { url?: string; channel?: string; channel_id?: string };
}

function verifyState(stateParam: string): VerifiedState | null {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return null;

  try {
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    const { payload, sig } = decoded;
    if (typeof payload !== 'string' || typeof sig !== 'string') return null;

    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    const { userId, locale, ts } = JSON.parse(payload);
    if (typeof userId !== 'string' || !isLocale(locale) || typeof ts !== 'number') return null;
    const age = Date.now() - ts;
    if (age < -60_000 || age > STATE_MAX_AGE_MS) return null;
    return { userId, locale };
  } catch {
    return null;
  }
}

function settingsRedirect(reqUrl: string, locale: AppLocale, status: 'connected' | 'error'): URL {
  return new URL(`/${locale}/settings?slack=${status}`, reqUrl);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const verified = state ? verifyState(state) : null;
  if (oauthError || !code || !verified) {
    if (verified) return NextResponse.redirect(settingsRedirect(req.url, verified.locale, 'error'));
    return NextResponse.redirect(new URL('/en/settings?slack=error', req.url));
  }
  const { userId, locale } = verified;

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientId || !clientSecret || !serviceRoleKey) {
    return NextResponse.redirect(settingsRedirect(req.url, locale, 'error'));
  }

  const redirectUri = `${url.origin}/api/slack/callback`;
  let tokenData: SlackTokenResponse;
  try {
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    tokenData = await tokenRes.json();
  } catch (error) {
    console.error('Slack OAuth exchange failed:', error);
    return NextResponse.redirect(settingsRedirect(req.url, locale, 'error'));
  }
  if (!tokenData.ok || typeof tokenData.access_token !== 'string' || typeof tokenData.team?.id !== 'string') {
    console.error('Slack OAuth error:', tokenData.error);
    return NextResponse.redirect(settingsRedirect(req.url, locale, 'error'));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );
  const { error: dbError } = await supabase
    .from('slack_connections')
    .upsert({
      user_id: userId,
      team_id: tokenData.team?.id,
      team_name: tokenData.team?.name || 'Slack Workspace',
      access_token: tokenData.access_token,
      scope: tokenData.scope || '',
      bot_user_id: tokenData.bot_user_id,
      authed_user_id: tokenData.authed_user?.id,
      incoming_webhook_url: tokenData.incoming_webhook?.url,
      incoming_webhook_channel: tokenData.incoming_webhook?.channel,
      incoming_webhook_channel_id: tokenData.incoming_webhook?.channel_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,team_id' });

  if (dbError) {
    console.error('Slack connection save error:', dbError);
    return NextResponse.redirect(settingsRedirect(req.url, locale, 'error'));
  }

  return NextResponse.redirect(settingsRedirect(req.url, locale, 'connected'));
}
