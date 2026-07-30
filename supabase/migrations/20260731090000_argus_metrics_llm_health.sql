-- argus_metrics: add the `llm` health section (truncation sensor, 2026-07-31).
--
-- WHY. An LLM output cut at max_tokens is an error NOWHERE: the client's parse
-- fallback silently re-fetches, the user sees a slow-but-correct answer, and
-- every dashboard stays green. Exactly that ran at 44% of big calls for months
-- (measured 7-day window, 2026-07-30) — doubling latency on the product's first
-- impression. The server now logs `llm_truncation` (stop_reason='max_tokens')
-- and the client logs `llm_stream_retry` (the double-payment moment); this
-- section puts both on the operator dashboard so the NEXT prompt that outgrows
-- its budget turns a number red instead of waiting to be felt.
--
-- Function replace only — no table changes.

CREATE OR REPLACE FUNCTION public.argus_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
    'llm', jsonb_build_object(
      -- Cut-at-cap generations (server truth: stop_reason='max_tokens').
      -- Non-zero here means some prompt's output no longer fits its budget and
      -- users are paying the double-call recovery for it.
      'truncation_7d',   (SELECT count(*) FROM user_events WHERE event_name = 'llm_truncation'   AND created_at > now() - interval '7 days'),
      'truncation_24h',  (SELECT count(*) FROM user_events WHERE event_name = 'llm_truncation'   AND created_at > now() - interval '24 hours'),
      -- Client-side double-payment moments (any unparseable stream, not only cuts).
      'stream_retry_7d', (SELECT count(*) FROM user_events WHERE event_name = 'llm_stream_retry' AND created_at > now() - interval '7 days'),
      'errors_7d',       (SELECT count(*) FROM user_events WHERE event_name IN ('llm_error', 'server_llm_error') AND created_at > now() - interval '7 days'),
      'calls_7d',        (SELECT count(*) FROM user_events WHERE event_name = 'llm_usage'        AND created_at > now() - interval '7 days'),
      -- Cache health: reads>0 proves prompt caching fires in production.
      'cache_read_7d',   (SELECT coalesce(sum((properties->>'cache_read_tokens')::bigint), 0)  FROM user_events WHERE event_name = 'llm_usage' AND properties ? 'cache_read_tokens'  AND created_at > now() - interval '7 days'),
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
$function$;
