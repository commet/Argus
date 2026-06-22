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

export function logServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
  opts: { userId?: string | null; path?: string } = {},
): void {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const client = createClient(url, key);
    void client.from('user_events').insert({
      event_name: event,
      properties: { ...properties, server: true },
      session_id: 'server',
      user_id: opts.userId ?? null,
      page_path: opts.path ?? null,
      referrer: null,
    }).then(({ error }) => {
      if (error) console.error('[server-events] insert failed:', error.message);
    });
  } catch {
    /* telemetry must never break a request */
  }
}
