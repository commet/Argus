-- Harden the argus_metrics() operator gate: replace the hard-coded email
-- allowlist with the server-controlled `app_metadata.is_operator` flag.
--
-- WHY: the previous gate compared auth.users.email against two literal personal
-- gmail addresses. In a public repo that ships those addresses in source, and it
-- couples the operator set to email strings. app_metadata is set only by the
-- service role (never by the user), so `raw_app_meta_data->>'is_operator'` is an
-- unspoofable, email-free operator claim. Set the flag on operator accounts with:
--   UPDATE auth.users
--     SET raw_app_meta_data = raw_app_meta_data || '{"is_operator": true}'::jsonb
--     WHERE email = '<operator@example.com>';
-- (run that once per operator, out of band — it is intentionally NOT in source).
--
-- CREATE OR REPLACE reproduces the full body of 20260623b_argus_metrics_plugin_sealed.sql
-- verbatim and only swaps the gate. Same SECURITY DEFINER + pinned search_path.
-- Reversible (replace back). No data change.
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
