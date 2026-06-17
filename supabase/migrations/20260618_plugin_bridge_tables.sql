-- Cross-surface bridge: hold plugin (Claude Code) saved content in Supabase so
-- the webapp can open it. Designed for BOTH ingestion paths chosen 2026-06-18:
--   source='import' (v1: webapp parses an uploaded .argus/ledger.jsonl + bearings)
--   source='push'   (v2: plugin pushes directly once paired to an account)
-- Plugin data is anonymous + local; the importing/pushing account claims it via
-- user_id. RLS + user_id→auth.users CASCADE match every other user-owned table.
-- A `raw` jsonb on each table preserves full fidelity / forward-compat, while the
-- promoted columns are what the webapp queries and renders.
-- Applied to remote 2026-06-18; committed so fresh provisions / CI / db reset match.

-- ── plugin_decisions ── (ledger.jsonl folded decision state; the bet lifecycle)
CREATE TABLE IF NOT EXISTS public.plugin_decisions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'import',          -- 'import' | 'push'
  ledger_id text NOT NULL,                         -- plugin's sha256(session|quote)[:8]
  project text,
  session text,
  decided_at timestamptz,
  harvested_at timestamptz,
  quote text,
  decision text,
  type text,
  stakes text,                                     -- high|medium|low
  status text,                                     -- candidate|sealed|settled|dismissed
  predicate text,
  falsified_if text,
  check_by text,                                   -- verbatim (YYYY-MM-DD); app parses
  sealed_at timestamptz,
  outcome text,                                    -- happened|avoided|partial|pending
  settled_at timestamptz,
  settle_note text,
  dismissed_at timestamptz,
  dismiss_reason text,
  history jsonb,                                   -- amend history []
  raw jsonb,                                       -- full folded object (fidelity)
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plugin_decisions_user_ledger_uniq UNIQUE (user_id, ledger_id)
);
ALTER TABLE public.plugin_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own plugin_decisions" ON public.plugin_decisions;
CREATE POLICY "Users can CRUD own plugin_decisions" ON public.plugin_decisions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS plugin_decisions_updated_at ON public.plugin_decisions;
CREATE TRIGGER plugin_decisions_updated_at BEFORE UPDATE ON public.plugin_decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS plugin_decisions_user_id_idx ON public.plugin_decisions(user_id);
CREATE INDEX IF NOT EXISTS plugin_decisions_status_idx ON public.plugin_decisions(user_id, status);

-- ── plugin_bearings ── (current_bearing.json; the full compressed voyage output)
CREATE TABLE IF NOT EXISTS public.plugin_bearings (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'import',          -- 'import' | 'push'
  session text,
  version_label text,
  label text,
  current_course jsonb,                            -- {status, summary}
  why_this_course jsonb,                           -- [{point, source}]
  fog_or_reef jsonb,                               -- {issue, why_it_matters, required_check} | null
  road_not_taken jsonb,                            -- [{option, why_not_now}]
  next_helm text,
  contract_seed jsonb,                             -- {predicate, check_by, pass_condition, fail_condition} | null
  blocked boolean,
  generated_at timestamptz,
  raw jsonb,                                       -- full bearing object (fidelity)
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plugin_bearings_user_session_version_uniq UNIQUE (user_id, session, version_label)
);
ALTER TABLE public.plugin_bearings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can CRUD own plugin_bearings" ON public.plugin_bearings;
CREATE POLICY "Users can CRUD own plugin_bearings" ON public.plugin_bearings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS plugin_bearings_updated_at ON public.plugin_bearings;
CREATE TRIGGER plugin_bearings_updated_at BEFORE UPDATE ON public.plugin_bearings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS plugin_bearings_user_id_idx ON public.plugin_bearings(user_id);
