-- The 3 tables the sync layer (createItemStore TableName) upserts to but that
-- never existed on remote → reframe/recast/synthesize were silently
-- localStorage-only (2026-06-18 finish-line audit). Columns mirror the TS
-- interfaces (ReframeItem/RecastItem/SynthesizeItem) exactly so sanitizeItem's
-- `...rest` upsert is never rejected (PGRST204). RLS + trigger replicate the
-- projects/personas convention. Applied to remote 2026-06-18; committed here so
-- fresh provisions, CI, and `supabase db reset` get the tables.

-- ── reframe_items ──
CREATE TABLE IF NOT EXISTS public.reframe_items (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text,
  loop_id text,
  iteration_number integer,
  input_text text,
  analysis jsonb,
  selected_question text,
  final_decomposition jsonb,
  status text,
  user_edited_question boolean,
  reanalysis_count integer,
  interview_signals jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reframe_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own reframe_items" ON public.reframe_items;
CREATE POLICY "Users can CRUD own reframe_items" ON public.reframe_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS reframe_items_updated_at ON public.reframe_items;
CREATE TRIGGER reframe_items_updated_at BEFORE UPDATE ON public.reframe_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS reframe_items_user_id_idx ON public.reframe_items(user_id);

-- ── recast_items ──
CREATE TABLE IF NOT EXISTS public.recast_items (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text,
  loop_id text,
  iteration_number integer,
  input_text text,
  analysis jsonb,
  steps jsonb,
  status text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recast_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own recast_items" ON public.recast_items;
CREATE POLICY "Users can CRUD own recast_items" ON public.recast_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS recast_items_updated_at ON public.recast_items;
CREATE TRIGGER recast_items_updated_at BEFORE UPDATE ON public.recast_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS recast_items_user_id_idx ON public.recast_items(user_id);

-- ── synthesize_items ──
CREATE TABLE IF NOT EXISTS public.synthesize_items (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text,
  loop_id text,
  iteration_number integer,
  raw_input text,
  sources jsonb,
  analysis jsonb,
  final_synthesis text,
  status text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.synthesize_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own synthesize_items" ON public.synthesize_items;
CREATE POLICY "Users can CRUD own synthesize_items" ON public.synthesize_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS synthesize_items_updated_at ON public.synthesize_items;
CREATE TRIGGER synthesize_items_updated_at BEFORE UPDATE ON public.synthesize_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS synthesize_items_user_id_idx ON public.synthesize_items(user_id);
