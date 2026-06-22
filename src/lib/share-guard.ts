/**
 * Server-side share rate limiter, shared by every transmitting channel
 * (email, telegram, …). Counts a user's outbound shares in the trailing 24h
 * from `share_log`; if under the daily cap, records the share and returns ok.
 * Without this, an authenticated account is an unthrottled relay.
 *
 * Uses the service-role client (RLS-bypassing) — callers have already verified
 * the user's auth token before reaching here.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DAILY_SHARE_LIMIT = 50;

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export interface ShareGuardResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export async function recordAndCheckShare(
  userId: string,
  channel: string,
  opts: { target?: string; context?: string } = {},
): Promise<ShareGuardResult> {
  const admin = adminClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count } = await admin
    .from('share_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since24h);

  if ((count ?? 0) >= DAILY_SHARE_LIMIT) {
    return {
      ok: false,
      status: 429,
      error: `Daily share limit (${DAILY_SHARE_LIMIT}) reached. Try again tomorrow.`,
    };
  }

  await admin.from('share_log').insert({
    user_id: userId,
    channel,
    target: opts.target ?? null,
    context: opts.context ?? null,
  });

  return { ok: true };
}
