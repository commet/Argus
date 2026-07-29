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

// 한도 숫자는 화면도 알아야 해서 순수 파일에 산다 (share-limits.ts 의 주석 참고).
import { ANON_SHARE_LIMIT, DAILY_SHARE_LIMIT } from './share-limits';

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
  opts: { target?: string; context?: string; anonymous?: boolean } = {},
): Promise<ShareGuardResult> {
  const admin = adminClient();
  const limit = opts.anonymous ? ANON_SHARE_LIMIT : DAILY_SHARE_LIMIT;
  const { data: allowed, error } = await admin.rpc('record_share_if_allowed', {
    p_user_id: userId,
    p_channel: channel,
    p_target: opts.target ?? null,
    p_context: opts.context ?? null,
    p_limit: limit,
    p_scope_channel: null,
  });

  if (error) {
    console.error('[share-guard] atomic rate-limit RPC failed:', error.message);
    return { ok: false, status: 503, error: 'Sharing is temporarily unavailable. Please try again shortly.' };
  }

  if (allowed !== true) {
    return {
      ok: false,
      status: 429,
      // 익명에게는 "로그인하면 늘어난다"를 함께 말한다 — 벽만 세우고 문을 안 알려주면
      // 그 사람은 여기서 끝난다.
      error: opts.anonymous
        ? `Daily share limit (${ANON_SHARE_LIMIT}) reached for a signed-out browser. Sign in to raise it.`
        : `Daily share limit (${DAILY_SHARE_LIMIT}) reached. Try again tomorrow.`,
    };
  }

  return { ok: true };
}
