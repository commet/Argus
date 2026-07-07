-- Additive: surface plugin-sealed / plugin-settled bets in the moat funnel.
--
-- WHY: argus_metrics() counted plugin_decisions only as a raw table tally
-- (tables.plugin_decisions). But a plugin user who runs `argus-watch seal` lands a
-- genuine user-authored bet (predicate + check_by) with status='sealed' and
-- sealed_at set — and settles it (status='settled', settled_at set). Those are real
-- moat events that the headline seal funnel ignored, so the moat undercounted the
-- plugin cohort. This adds plugin_sealed / plugin_settled to the return_loop block.
--
-- CREATE OR REPLACE reproduces the full body of 20260623_argus_metrics_return_loop.sql
-- (we do NOT edit the shipped file) and only adds two read-only count keys. Same
-- operator gate + SECURITY DEFINER + pinned search_path. Reversible (replace back).
CREATE OR REPLACE FUNCTION public.argus_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Operator gate hardened to the server-set app_metadata.is_operator flag —
  -- personal emails removed from source (see 20260707_argus_metrics_operator_flag.sql).
  IF NOT coalesce((SELECT (raw_app_meta_data->>'is_operator')::boolean
                   FROM auth.users WHERE id = auth.uid()), false) THEN
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
      -- NEW: plugin-cohort seal/settle from the bridge tables (argus-watch seal/settle)
      'plugin_sealed',   (SELECT count(*) FROM plugin_decisions WHERE sealed_at IS NOT NULL OR status IN ('sealed','settled')),
      'plugin_settled',  (SELECT count(*) FROM plugin_decisions WHERE settled_at IS NOT NULL OR status = 'settled'),
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
