/**
 * Shared rules for plugin Personal Access Tokens (`argus_pat_…`).
 *
 * SINGLE SOURCE OF TRUTH for the expiry rule. Every PAT-authed route
 * (plugin/ingest, plugin/events, mcp/seal, mcp/receipts) resolves its token by
 * hash and MUST gate on `isTokenExpired(row.expires_at)` so the rule can't drift
 * across the four routes. Issuance (plugin/token) stamps `pluginTokenExpiry()`.
 *
 * Backward compatibility: `expires_at IS NULL` = a legacy token issued before
 * expiry existed → treated as valid. The migration backfills existing rows with
 * a grace window so nothing is locked out on deploy; only NEW tokens rotate on
 * the 90-day schedule from issuance.
 */

/** Days a newly-issued PAT stays valid before it must be re-issued. */
export const PLUGIN_TOKEN_TTL_DAYS = 90;

/** ISO timestamp for a fresh token's expiry (now + TTL). Used at issuance. */
export function pluginTokenExpiry(now: number = Date.now()): string {
  return new Date(now + PLUGIN_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * True when a token is past its expiry. `null`/`undefined` (legacy tokens with
 * no expiry) are NOT expired — they remain valid for backward compatibility.
 */
export function isTokenExpired(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false; // unparseable → don't lock out; fail open on this signal only
  return t < now;
}
