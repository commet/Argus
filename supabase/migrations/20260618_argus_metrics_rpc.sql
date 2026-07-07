-- Founder-only metrics RPC for the in-app dashboard (/admin). SECURITY DEFINER so
-- it can aggregate across all users (bypassing RLS), but gated to the founder
-- emails and returning ONLY aggregate counts (no PII / no row contents).
-- search_path pinned (addresses the function_search_path_mutable advisor class).
-- Applied to remote 2026-06-18.
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
