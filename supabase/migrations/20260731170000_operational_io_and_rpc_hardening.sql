-- Operational follow-up after the Disk IO budget warning.
--
-- 1. The owner report filters by created_at. Without a leading time index,
--    Postgres scans the growing event heap every morning.
-- 2. Cover live foreign keys reported by Supabase's Performance Advisor.
-- 3. Restore the least-privilege RPC grants already intended by the application
--    routes. These RPCs are called through service_role server clients; stale
--    PUBLIC/anon grants exposed SECURITY DEFINER entry points unnecessarily.
-- 4. Pin helper-function search paths reported by Security Advisor.

CREATE INDEX IF NOT EXISTS idx_user_events_created_at
  ON public.user_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_created_at
  ON public.projects (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_progressive_sessions_created_at
  ON public.progressive_sessions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_progressive_sessions_project_id
  ON public.progressive_sessions (project_id);

CREATE INDEX IF NOT EXISTS idx_anon_transfer_tickets_target_user
  ON public.anonymous_account_transfer_tickets (target_user_id);

CREATE INDEX IF NOT EXISTS idx_mcp_account_authorizations_user
  ON public.mcp_account_authorizations (user_id);

CREATE INDEX IF NOT EXISTS idx_plugin_events_decision
  ON public.plugin_events (plugin_decision_id);

CREATE INDEX IF NOT EXISTS idx_plugin_tokens_user
  ON public.plugin_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_project_semantic_events_project
  ON public.project_semantic_events (project_id);

CREATE INDEX IF NOT EXISTS idx_telegram_connect_codes_user
  ON public.telegram_connect_codes (user_id);

CREATE INDEX IF NOT EXISTS idx_telegram_sessions_user
  ON public.telegram_sessions (user_id);

REVOKE ALL ON FUNCTION public.can_access_project(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.check_anon_rate_limit(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_anon_rate_limit(text, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.create_team_with_owner(text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_with_owner(text, text, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.is_team_member(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid)
  TO authenticated, service_role;

ALTER FUNCTION public._argus_semantic_idem_fingerprint(jsonb)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public._argus_foundation_integrity_v2_valid(jsonb)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public._argus_jsonb_array_is_prefix(jsonb, jsonb)
  SET search_path = pg_catalog, public;
