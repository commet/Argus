-- Per-chat conversation state for the Telegram reframe bot. Lets the inline
-- buttons (deeper / redo) re-run on the user's last input without re-sending it.
-- Server-only (written by the webhook via service role); no client policies.
CREATE TABLE IF NOT EXISTS public.telegram_sessions (
  chat_id     text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_input  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;
