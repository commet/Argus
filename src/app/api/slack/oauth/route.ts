import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { validateContentLength, validateContentType, validateOrigin } from '@/lib/api-security';
import { isLocale, type AppLocale } from '@/lib/locale-path';

function signState(userId: string, locale: AppLocale): string {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) throw new Error('SLACK_SIGNING_SECRET is not set');
  const payload = JSON.stringify({ userId, locale, ts: Date.now() });
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url');
}

export async function POST(req: NextRequest) {
  const requestError = validateContentType(req) || validateContentLength(req) || validateOrigin(req);
  if (requestError) return requestError;

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const accessToken = authHeader.slice(7);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!clientId || !signingSecret) {
    return NextResponse.json({ error: 'unconfigured' }, { status: 503 });
  }

  let locale: AppLocale = 'en';
  try {
    const body = await req.json();
    if (isLocale(body?.locale)) locale = body.locale;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/slack/callback`;
  const slackUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackUrl.searchParams.set('client_id', clientId);
  slackUrl.searchParams.set('scope', 'chat:write,channels:read,groups:read');
  slackUrl.searchParams.set('redirect_uri', redirectUri);
  slackUrl.searchParams.set('state', signState(user.id, locale));

  return NextResponse.json({ url: slackUrl.toString() });
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
}
