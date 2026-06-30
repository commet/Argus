-- Plugin round-trip events: webapp-origin changes that the local plugin can pull
-- back into .argus/ledger/ledger.jsonl without overwriting the local append-only
-- record. This makes the webapp an active surface, not only a monitor.

CREATE TABLE IF NOT EXISTS public.plugin_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_decision_id uuid REFERENCES public.plugin_decisions(id) ON DELETE CASCADE,
  ledger_id text NOT NULL,
  event_id text NOT NULL,
  event text NOT NULL,                  -- amend | settle | dismiss (web-origin)
  payload jsonb NOT NULL,               -- exact ledger event to append locally
  source text NOT NULL DEFAULT 'webapp',
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plugin_events_user_event_uniq UNIQUE (user_id, event_id)
);

ALTER TABLE public.plugin_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own plugin_events" ON public.plugin_events;
CREATE POLICY "Users can CRUD own plugin_events" ON public.plugin_events
  FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS plugin_events_user_created_idx ON public.plugin_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS plugin_events_user_ledger_idx ON public.plugin_events(user_id, ledger_id);
