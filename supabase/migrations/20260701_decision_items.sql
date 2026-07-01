-- Decision Items — a decision decomposed into typed, individually-tracked objects
-- (premise / phenomenon / conclusion / open_question / prediction).
-- Design: docs/DESIGN-decision-items-living-premises-2026-07-01.md
--
-- One row per item (normalized) so per-item alerts can be queried directly.
-- Mirrors src/lib/decision-items.ts DecisionItem. `edits` and `alert` are jsonb
-- so the shared lib's shapes carry over without a second schema.
--
-- NOTE: not yet wired into the webapp sync path. When the store starts upserting
-- items, add this table's columns to src/lib/__tests__/schema-drift.test.ts
-- TABLE_COLUMNS (the guard that stops a synced field without a column from
-- silently rejecting the row).

CREATE TABLE IF NOT EXISTS public.decision_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id       text NOT NULL,                 -- stable id (type + normalized text)
  decision_id   text NOT NULL,                 -- owning project/session
  type          text NOT NULL,                 -- premise|phenomenon|conclusion|open_question|prediction
  text          text NOT NULL,
  source        text NOT NULL DEFAULT 'ai',    -- ai | user
  authored      text NOT NULL DEFAULT 'ai',    -- ai | user | ai_edited_by_user
  edits         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- append-only EditEvent[]
  external      boolean NOT NULL DEFAULT false,
  load_bearing  boolean NOT NULL DEFAULT false,
  alert         jsonb NOT NULL DEFAULT '{"mode":"off"}'::jsonb,  -- ItemAlert
  status        text NOT NULL DEFAULT 'active', -- active | resolved | retired
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, decision_id, item_id)
);

ALTER TABLE public.decision_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own decision_items"
  ON public.decision_items FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own decision_items"
  ON public.decision_items FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own decision_items"
  ON public.decision_items FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own decision_items"
  ON public.decision_items FOR DELETE USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS decision_items_decision_idx
  ON public.decision_items (user_id, decision_id);
-- Premise-monitoring scan: active premises with an alert mode set.
CREATE INDEX IF NOT EXISTS decision_items_alert_idx
  ON public.decision_items (user_id, status, type);
