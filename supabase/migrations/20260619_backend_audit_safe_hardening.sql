-- Backend audit (2026-06-19) — safe, additive hardening batch.
-- Applied to remote 2026-06-19. Findings from the multi-agent backend audit.

-- (H3) Agent.nameEn/roleEn/expertiseEn/toneEn are on the synced Agent interface
-- but the agents table had no such columns → every built-in-agent upsert carrying
-- them was rejected whole-row (PGRST204), silently losing XP/level/observations/
-- chat_history cross-device. Add the 4 (quoted to match the camelCase JSON keys).
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "nameEn" text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "roleEn" text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "expertiseEn" text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "toneEn" text;

-- (security advisor: function_search_path_mutable) pin search_path on the 3
-- stragglers (all SECURITY INVOKER, so low risk, but match the rest of the schema).
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_worker_response(text, text, text, timestamp with time zone) SET search_path = public;

-- (perf: missing user_id index on hot .eq('user_id').order('created_at') tables)
CREATE INDEX IF NOT EXISTS idx_feedback_records_user_created ON public.feedback_records(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_accuracy_ratings_user ON public.accuracy_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_dqs_user ON public.decision_quality_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_outcome_records_user ON public.outcome_records(user_id);
CREATE INDEX IF NOT EXISTS idx_retro_answers_user ON public.retrospective_answers(user_id);

-- (perf: other unindexed foreign keys → faster joins + auth.users CASCADE deletes)
CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_invited_by ON public.team_invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_accuracy_ratings_feedback ON public.accuracy_ratings(feedback_record_id);
CREATE INDEX IF NOT EXISTS idx_ham_user ON public.human_agent_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_chains_user ON public.agent_chains(user_id);

-- (perf: drop redundant single-column indexes already covered by composites)
DROP INDEX IF EXISTS public.ix_team_members_user;   -- prefix of ix_team_members_composite(user_id,team_id)
DROP INDEX IF EXISTS public.ix_team_members_team;   -- prefix of team_members_team_id_user_id_key(team_id,user_id)
