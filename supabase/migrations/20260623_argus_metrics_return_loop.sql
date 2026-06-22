-- 0-1 closed-loop instrument: extend argus_metrics() with a behavioral
-- seal→settle funnel computed from user_events (NOT the projects table).
--
-- WHY a second funnel: the existing projects-based funnel only sees LOGGED-IN
-- users (anon projects live in localStorage, never reach the projects table).
-- But anon users DO emit `decision_sealed` / `decision_graded` / `decision_seal_declined`
-- events via analytics.track(). This block reads those events so the founder can
-- see whether the moat loop closes for the ANON cold-start cohort the funnel
-- actually acquires — split anon vs authenticated, with the held/broke verdict
-- breakdown. This is how we observe the first real "settle" 0→1.
--
-- HONEST LIMIT (documented, not hidden): anon settle happens cross-session days
-- later in a NEW session with no stable cross-session id, so session-based
-- seal→settle *conversion* undercounts anon. We therefore surface raw counts
-- (sealed_total, settled_total) and distinct-session tallies rather than a single
-- conversion %, and let the founder read the gap directly.
--
-- Operator-gated + SECURITY DEFINER + pinned search_path, same as the base RPC.
-- Read-only aggregates only (no PII / no row contents).
CREATE OR REPLACE FUNCTION public.argus_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email text;
  result jsonb;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS NULL OR caller_email NOT IN ('time22say@gmail.com', 'yclee913@gmail.com') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'users_total', (SELECT count(*) FROM auth.users),
    'users_with_projects', (SELECT count(DISTINCT user_id) FROM projects WHERE deleted_at IS NULL),
    'signups_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'signups_30d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'projects_total', (SELECT count(*) FROM projects WHERE deleted_at IS NULL),
    'projects_sealed', (SELECT count(*) FROM projects WHERE deleted_at IS NULL AND decision_contract IS NOT NULL),
    'projects_settled', (SELECT count(*) FROM projects WHERE deleted_at IS NULL AND decision_contract->>'graded_at' IS NOT NULL),
    'projects_7d', (SELECT count(*) FROM projects WHERE deleted_at IS NULL AND created_at > now() - interval '7 days'),
    'projects_30d', (SELECT count(*) FROM projects WHERE deleted_at IS NULL AND created_at > now() - interval '30 days'),
    'latest_project', (SELECT max(created_at) FROM projects WHERE deleted_at IS NULL),
    -- NEW: behavioral seal→settle loop from user_events (anon-inclusive)
    'return_loop', jsonb_build_object(
      'sealed_total',    (SELECT count(*) FROM user_events WHERE event_name = 'decision_sealed'),
      'sealed_anon',     (SELECT count(*) FROM user_events WHERE event_name = 'decision_sealed' AND user_id IS NULL),
      'sealed_auth',     (SELECT count(*) FROM user_events WHERE event_name = 'decision_sealed' AND user_id IS NOT NULL),
      'seal_declined',   (SELECT count(*) FROM user_events WHERE event_name = 'decision_seal_declined'),
      'settled_total',   (SELECT count(*) FROM user_events WHERE event_name = 'decision_graded'),
      'settled_anon',    (SELECT count(*) FROM user_events WHERE event_name = 'decision_graded' AND user_id IS NULL),
      'settled_auth',    (SELECT count(*) FROM user_events WHERE event_name = 'decision_graded' AND user_id IS NOT NULL),
      'sessions_sealed', (SELECT count(DISTINCT session_id) FROM user_events WHERE event_name = 'decision_sealed'),
      'sessions_settled',(SELECT count(DISTINCT session_id) FROM user_events WHERE event_name = 'decision_graded'),
      'sealed_7d',       (SELECT count(*) FROM user_events WHERE event_name = 'decision_sealed' AND created_at > now() - interval '7 days'),
      'settled_7d',      (SELECT count(*) FROM user_events WHERE event_name = 'decision_graded' AND created_at > now() - interval '7 days'),
      'verdicts',        (SELECT coalesce(jsonb_object_agg(verdict, n), '{}'::jsonb) FROM (
                            SELECT coalesce(properties->>'verdict', '(none)') AS verdict, count(*) AS n
                            FROM user_events WHERE event_name = 'decision_graded' GROUP BY 1
                          ) v)
    ),
    'tables', jsonb_build_object(
      'personas', (SELECT count(*) FROM personas WHERE deleted_at IS NULL),
      'progressive_sessions', (SELECT count(*) FROM progressive_sessions),
      'judgment_records', (SELECT count(*) FROM judgment_records),
      'quality_signals', (SELECT count(*) FROM quality_signals),
      'feedback_records', (SELECT count(*) FROM feedback_records),
      'plugin_decisions', (SELECT count(*) FROM plugin_decisions),
      'plugin_bearings', (SELECT count(*) FROM plugin_bearings),
      'reframe_items', (SELECT count(*) FROM reframe_items WHERE deleted_at IS NULL),
      'recast_items', (SELECT count(*) FROM recast_items WHERE deleted_at IS NULL),
      'synthesize_items', (SELECT count(*) FROM synthesize_items WHERE deleted_at IS NULL)
    )
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.argus_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.argus_metrics() TO authenticated;
