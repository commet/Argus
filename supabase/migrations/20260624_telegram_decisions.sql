-- Telegram = a 4th "door" of the decision ledger. Per ledger-schema.ts the
-- doors share the SHAPE (LedgerDecision), not tables — so the bot gets its own
-- storage conforming to that shape. source is implied 'telegram'.
CREATE TABLE IF NOT EXISTS public.telegram_decisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id       text NOT NULL,
  source        text NOT NULL DEFAULT 'telegram',
  decision      text NOT NULL,
  quote         text,
  predicate     text NOT NULL,
  falsified_if  text,
  check_by      date,
  status        text NOT NULL DEFAULT 'sealed',
  outcome       text,
  history       jsonb NOT NULL DEFAULT '[]'::jsonb,
  reminded_at   timestamptz,
  settled_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own telegram_decisions"
  ON public.telegram_decisions FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own telegram_decisions"
  ON public.telegram_decisions FOR DELETE USING ((select auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS telegram_decisions_due_idx
  ON public.telegram_decisions (status, check_by);
CREATE INDEX IF NOT EXISTS telegram_decisions_user_idx
  ON public.telegram_decisions (user_id, created_at DESC);

-- Pending in-progress seal draft (awaiting the user's confirm tap).
ALTER TABLE public.telegram_sessions ADD COLUMN IF NOT EXISTS pending jsonb;
