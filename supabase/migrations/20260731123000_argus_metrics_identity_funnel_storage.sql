-- Keep the operator RPC additive when adding sensors. The previous replacement
-- accidentally dropped surface_funnel and counted anonymous Auth identities as
-- signups. This version restores the funnel, separates registered/anonymous
-- identities, and exposes anonymous backup health.

CREATE OR REPLACE FUNCTION public.argus_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT coalesce((SELECT (raw_app_meta_data->>'is_operator')::boolean
                   FROM auth.users WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'users_total', (SELECT count(*) FROM auth.users WHERE NOT coalesce(is_anonymous, false)),
    'anonymous_users_total', (SELECT count(*) FROM auth.users WHERE coalesce(is_anonymous, false)),
    'users_with_projects', (
      SELECT count(DISTINCT p.user_id)
      FROM projects p
      JOIN auth.users u ON u.id = p.user_id
      WHERE p.deleted_at IS NULL AND NOT coalesce(u.is_anonymous, false)
    ),
    'anonymous_users_with_projects', (
      SELECT count(DISTINCT p.user_id)
      FROM projects p
      JOIN auth.users u ON u.id = p.user_id
      WHERE p.deleted_at IS NULL AND coalesce(u.is_anonymous, false)
    ),
    'signups_7d', (SELECT count(*) FROM auth.users WHERE NOT coalesce(is_anonymous, false) AND created_at > now() - interval '7 days'),
    'signups_30d', (SELECT count(*) FROM auth.users WHERE NOT coalesce(is_anonymous, false) AND created_at > now() - interval '30 days'),
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
      'plugin_sealed',   (SELECT count(*) FROM plugin_decisions WHERE sealed_at IS NOT NULL OR status IN ('sealed','settled')),
      'plugin_settled',  (SELECT count(*) FROM plugin_decisions WHERE settled_at IS NOT NULL OR status = 'settled'),
      'verdicts',        (SELECT coalesce(jsonb_object_agg(verdict, n), '{}'::jsonb) FROM (
                            SELECT coalesce(properties->>'verdict', '(none)') AS verdict, count(*) AS n
                            FROM user_events WHERE event_name = 'decision_graded' GROUP BY 1
                          ) v)
    ),
    'surface_funnel', jsonb_build_object(
      'web', jsonb_build_object(
        'opened',   (SELECT count(*) FROM user_events WHERE event_name IN ('workspace_problem_submit','review_completed')),
        'sealed',   (SELECT count(*) FROM user_events WHERE event_name = 'decision_sealed'),
        'returned', (SELECT count(*) FROM user_events WHERE event_name = 'return_opened'),
        'settled',  (SELECT count(*) FROM user_events WHERE event_name IN ('decision_graded','settled'))
      ),
      'mcp', jsonb_build_object(
        'opened',   (SELECT count(*) FROM review_receipts WHERE deleted_at IS NULL AND source_kind = 'mcp_file'),
        'sealed',   (SELECT count(*) FROM review_receipts WHERE deleted_at IS NULL AND source_kind = 'mcp_file' AND state IN ('sealed','settled')),
        'returned', (SELECT count(*) FROM review_receipts WHERE deleted_at IS NULL AND source_kind = 'mcp_file' AND state = 'sealed' AND next_check_by IS NOT NULL AND next_check_by <= current_date),
        'settled',  (SELECT count(*) FROM review_receipts WHERE deleted_at IS NULL AND source_kind = 'mcp_file' AND state = 'settled')
      ),
      'plugin', jsonb_build_object(
        'opened',   (SELECT count(*) FROM plugin_decisions),
        'sealed',   (SELECT count(*) FROM plugin_decisions WHERE sealed_at IS NOT NULL OR status IN ('sealed','settled')),
        'returned', (SELECT count(*) FROM plugin_decisions WHERE status IN ('sealed','settled') AND check_by ~ '^\d{4}-\d{2}-\d{2}$' AND check_by::date <= current_date),
        'settled',  (SELECT count(*) FROM plugin_decisions WHERE settled_at IS NOT NULL OR status = 'settled')
      )
    ),
    'storage_health', jsonb_build_object(
      'anonymous_projects', (
        SELECT count(*) FROM projects p JOIN auth.users u ON u.id = p.user_id
        WHERE p.deleted_at IS NULL AND coalesce(u.is_anonymous, false)
      ),
      'anonymous_sessions', (
        SELECT count(*) FROM progressive_sessions s JOIN auth.users u ON u.id = s.user_id
        WHERE coalesce(u.is_anonymous, false)
      ),
      'anonymous_projects_missing_session', (
        SELECT count(*) FROM projects p JOIN auth.users u ON u.id = p.user_id
        WHERE p.deleted_at IS NULL
          AND coalesce(u.is_anonymous, false)
          AND NOT EXISTS (SELECT 1 FROM progressive_sessions s WHERE s.project_id = p.id::text)
      ),
      'sync_failures_24h', (SELECT count(*) FROM user_events WHERE event_name = 'sync_write_failure' AND created_at > now() - interval '24 hours'),
      'sync_failures_7d',  (SELECT count(*) FROM user_events WHERE event_name = 'sync_write_failure' AND created_at > now() - interval '7 days')
    ),
    'llm', jsonb_build_object(
      'truncation_7d',   (SELECT count(*) FROM user_events WHERE event_name = 'llm_truncation' AND created_at > now() - interval '7 days'),
      'truncation_24h',  (SELECT count(*) FROM user_events WHERE event_name = 'llm_truncation' AND created_at > now() - interval '24 hours'),
      'stream_retry_7d', (SELECT count(*) FROM user_events WHERE event_name = 'llm_stream_retry' AND created_at > now() - interval '7 days'),
      'errors_7d',       (SELECT count(*) FROM user_events WHERE event_name IN ('llm_error', 'server_llm_error') AND created_at > now() - interval '7 days'),
      'calls_7d',        (SELECT count(*) FROM user_events WHERE event_name = 'llm_usage' AND created_at > now() - interval '7 days'),
      'cache_read_7d',   (SELECT coalesce(sum((properties->>'cache_read_tokens')::bigint), 0) FROM user_events WHERE event_name = 'llm_usage' AND properties ? 'cache_read_tokens' AND created_at > now() - interval '7 days'),
      'cache_write_7d',  (SELECT coalesce(sum((properties->>'cache_write_tokens')::bigint), 0) FROM user_events WHERE event_name = 'llm_usage' AND properties ? 'cache_write_tokens' AND created_at > now() - interval '7 days')
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
