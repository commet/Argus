/**
 * Opt-in account sync (design: "MCP도 이메일로 귀환").
 *
 * The MCP server is a short-lived stdio process — it is NOT alive at a
 * prediction's check-by date, so it cannot email you itself. To close the loop
 * it pushes the sealed prediction to the user's Argus account, where an
 * always-on server cron (the Companion Brief) emails it when it comes due and
 * the webapp dashboard shows it.
 *
 * Strictly opt-in: with no ARGUS_TOKEN the push is a silent no-op and the seal
 * stays purely local (the privacy-preserving default). Fire-safe: any failure
 * degrades to local-only and never breaks the seal that already succeeded.
 *
 *   MCP config env:
 *     ARGUS_TOKEN    argus_pat_… (issued in the webapp; same token as `argus push`)
 *     ARGUS_API_URL  optional, defaults to https://argus.voyage
 */

export interface SealPush {
  action: 'seal';
  id: string;
  predicate: string;
  check_by: string;
  sealed_at?: string;
  source_title?: string;
  real_question?: string;
  human_judgment?: string;
}

export interface SettlePush {
  action: 'settle';
  id: string;
  outcome: 'held' | 'avoided' | 'partial' | 'still_pending';
  what_happened?: string;
  settled_at?: string;
}

export interface PushResult {
  synced: boolean;
  reason?: string;
}

const TIMEOUT_MS = 5000;

export async function pushToAccount(payload: SealPush | SettlePush): Promise<PushResult> {
  const token = (process.env.ARGUS_TOKEN || '').trim();
  if (!token) return { synced: false, reason: 'no_token' }; // local-only (default)
  if (!token.startsWith('argus_pat_')) return { synced: false, reason: 'bad_token_format' };

  const base = (process.env.ARGUS_API_URL || 'https://argus.voyage').replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/mcp/seal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) return { synced: false, reason: `http_${res.status}` };
    return { synced: true };
  } catch {
    return { synced: false, reason: 'network' }; // never throws — local seal already stands
  } finally {
    clearTimeout(timer);
  }
}
