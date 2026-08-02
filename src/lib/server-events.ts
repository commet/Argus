/**
 * Server-side event logger → user_events (the same table the client `track()`
 * writes to), via the service-role client so it bypasses RLS. Fire-and-forget;
 * never throws. Closes the "API-route failures only hit console" blind spot:
 * server-only signals (Anthropic error detail, rate-limit denials during a spike,
 * cron/email/webhook failures) become queryable alongside client analytics.
 *
 * Server-only: relies on SUPABASE_SERVICE_ROLE_KEY — never import from client code.
 */
import { createClient } from '@supabase/supabase-js';

/** Vercel exposes this value at runtime; fail closed outside production. */
export function isServerAnalyticsEnabled(vercelEnv = process.env.VERCEL_ENV): boolean {
  return vercelEnv === 'production';
}

export function logServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
  opts: { userId?: string | null; path?: string } = {},
): void {
  void persistServerEvent(event, properties, opts);
}

/**
 * Awaitable form for request-final telemetry that must survive a serverless
 * function returning. Routine diagnostics may keep using logServerEvent();
 * delivery and other product-heartbeat events should await this function.
 */
export async function persistServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
  opts: { userId?: string | null; path?: string } = {},
): Promise<boolean> {
  try {
    if (!isServerAnalyticsEnabled()) return false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return false;
    const client = createClient(url, key);
    const { error } = await client.from('user_events').insert({
      event_name: event,
      properties: { ...properties, server: true },
      session_id: 'server',
      user_id: opts.userId ?? null,
      page_path: opts.path ?? null,
      referrer: null,
    });
    if (error) {
      console.error('[server-events] insert failed:', error.message);
      return false;
    }
    return true;
  } catch {
    /* telemetry must never break a request */
    return false;
  }
}
