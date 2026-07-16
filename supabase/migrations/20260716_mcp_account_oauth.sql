-- Short-lived OAuth grants for familiar MCP account connection.
--
-- The durable credential remains the existing hashed plugin_tokens PAT. This
-- table holds only one-time authorization/device codes (hashed), PKCE metadata,
-- and approval state. Service-role API routes are the only callers; no client
-- RLS policy is intentionally granted.

CREATE TABLE IF NOT EXISTS public.mcp_account_authorizations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow             text NOT NULL CHECK (flow IN ('authorization_code', 'device_code')),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash        text NOT NULL UNIQUE,
  user_code_hash   text UNIQUE,
  code_challenge   text,
  redirect_uri     text,
  client_name      text NOT NULL DEFAULT 'Argus MCP',
  scope            text NOT NULL DEFAULT 'records:sync',
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'consumed', 'denied')),
  interval_seconds smallint NOT NULL DEFAULT 5 CHECK (interval_seconds BETWEEN 1 AND 30),
  last_polled_at   timestamptz,
  expires_at       timestamptz NOT NULL,
  consumed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (flow = 'authorization_code' AND user_id IS NOT NULL AND code_challenge IS NOT NULL AND redirect_uri IS NOT NULL)
    OR
    (flow = 'device_code' AND user_code_hash IS NOT NULL)
  )
);

ALTER TABLE public.mcp_account_authorizations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS mcp_account_authorizations_expiry_idx
  ON public.mcp_account_authorizations (expires_at);

CREATE INDEX IF NOT EXISTS mcp_account_authorizations_user_code_idx
  ON public.mcp_account_authorizations (user_code_hash)
  WHERE status = 'pending';
