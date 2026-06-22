-- Share hub — the channels (Slack already exists) and the plugin→webapp bridge
-- need three server-owned tables. None of these are in db.ts's localStorage-sync
-- TableName union (they're server-only, like slack_connections), so they do NOT
-- touch persistence-contract or schema-drift's synced-interface guards.
--
--   telegram_connections — one row per connected Telegram chat (mirror of
--                          slack_connections). bot token lives in env; we store
--                          only the user's chat_id + display fields.
--   share_log            — append-only outbound-share log. Powers per-user daily
--                          rate limiting across every push channel (email,
--                          telegram, …) and doubles as share analytics.
--   plugin_tokens        — hashed personal access tokens for `argus push`. The
--                          raw token is shown to the user once and never stored;
--                          we keep only a SHA-256 hash + metadata.
--
-- RLS policies use (select auth.uid()) per 20260619_rls_initplan_optimize.

-- ── telegram_connections ──
CREATE TABLE IF NOT EXISTS public.telegram_connections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id       text NOT NULL,
  chat_title    text,
  chat_type     text,                       -- 'private' | 'group' | 'channel'
  bot_username  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_id)
);
ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;
-- Owner can read/delete their connections from the client (connect/update is
-- server-side via the service role, which bypasses RLS).
CREATE POLICY "Users can read own telegram_connections"
  ON public.telegram_connections FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own telegram_connections"
  ON public.telegram_connections FOR DELETE USING ((select auth.uid()) = user_id);

-- ── share_log ──
CREATE TABLE IF NOT EXISTS public.share_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel     text NOT NULL,                -- 'email' | 'telegram' | 'slack' | …
  target      text,                         -- redacted destination hint (e.g. masked email)
  context     text,                         -- share surface (e.g. 'final_deliverable')
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.share_log ENABLE ROW LEVEL SECURITY;
-- Writes are server-side (service role). Owner may read own history.
CREATE POLICY "Users can read own share_log"
  ON public.share_log FOR SELECT USING ((select auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS share_log_user_created_idx
  ON public.share_log (user_id, created_at DESC);

-- ── plugin_tokens ──
CREATE TABLE IF NOT EXISTS public.plugin_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,        -- sha256(raw); raw is never stored
  label        text,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plugin_tokens ENABLE ROW LEVEL SECURITY;
-- Owner lists/revokes from the client. Issuance (insert) and hash lookup happen
-- server-side via the service role. The client store selects metadata columns
-- only — never token_hash.
CREATE POLICY "Users can read own plugin_tokens"
  ON public.plugin_tokens FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own plugin_tokens"
  ON public.plugin_tokens FOR DELETE USING ((select auth.uid()) = user_id);
