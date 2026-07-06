-- Plugin Personal Access Tokens (argus_pat_…) previously never expired: a leaked
-- token stayed valid until the user manually revoked it. Add an expiry so tokens
-- rotate on a schedule and a stale/leaked token ages out on its own.
--
-- Backward compatibility: existing tokens get a 90-day GRACE window from the
-- deploy date (not created_at) so no active CLI user is locked out on rollout;
-- they simply must re-issue within 90 days. New tokens are stamped at issuance
-- (see src/lib/plugin-token.ts pluginTokenExpiry / PLUGIN_TOKEN_TTL_DAYS).
-- A NULL expires_at is treated as "valid" by isTokenExpired(), so the column is
-- nullable and safe to add to a live table.

ALTER TABLE public.plugin_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Grace window for tokens that already exist at deploy time.
UPDATE public.plugin_tokens
  SET expires_at = now() + interval '90 days'
  WHERE expires_at IS NULL;

-- Speeds up the daily expired-token sweep in cron/expire-tokens.
CREATE INDEX IF NOT EXISTS plugin_tokens_expires_at_idx
  ON public.plugin_tokens (expires_at);
