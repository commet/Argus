-- Retry idempotency fix (2026-07-15).
--
-- `append_project_semantic_events` compared the stored event against the retried
-- event with a raw `IS DISTINCT FROM`. But an honest retry of ONE command
-- (same idempotency_key) re-stamps fresh `time.recorded_at`/`authorized_at`, and
-- for a contemporaneous command `time.occurred_at == recorded_at` is re-stamped
-- too. So a genuine retry read as IDEMPOTENCY_CONFLICT instead of returning the
-- duplicate receipt. (Found in the dogfood production run; the fuzz `retry_exact`
-- case missed it because it replays the stored bytes verbatim rather than
-- re-preflighting with a fresh clock.)
--
-- Fix: compare an idempotency FINGERPRINT that strips the volatile bookkeeping
-- fields — the same fingerprint the v3 reducer (argus-mcp/src/v3/reducer.ts) and
-- the dogfood supabase-emulator use. The idempotency_key already scopes a
-- fingerprint to one command, so timestamp drift within a key is retry
-- bookkeeping, never a new intent. `time.temporal_mode` is KEPT — it is the
-- semantic contemporaneous-vs-retrospective distinction and is stable across
-- retries. An altered payload (different predicate/statement/date) still changes
-- the fingerprint and still conflicts.
--
-- Keep this stripping set in lockstep across the three mirrors:
--   strip: event_id, idempotency_key, causal_parent_ids, atomic_batch_id,
--          time.occurred_at, time.recorded_at, time.authorized_at,
--          authority.recorded_by
--   keep : event kind + all other payload keys, time.temporal_mode,
--          authority.{originated_by, authorized_by, authorization_mode, authorization_ref}

CREATE OR REPLACE FUNCTION public._argus_semantic_idem_fingerprint(e jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (e
            - 'event_id'
            - 'idempotency_key'
            - 'causal_parent_ids'
            - 'atomic_batch_id'
            - 'time'
            - 'authority')
       || jsonb_build_object(
            'time', jsonb_build_object('temporal_mode', e #> '{time,temporal_mode}'),
            'authority', coalesce(e -> 'authority', '{}'::jsonb) - 'recorded_by'
          );
$$;

CREATE OR REPLACE FUNCTION public.append_project_semantic_events(
  p_user_id uuid,
  p_project_id uuid,
  p_events jsonb
)
RETURNS TABLE (event jsonb, created_at timestamptz, duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event jsonb;
  v_space_id text;
  v_existing jsonb;
  v_existing_count integer;
  v_batch_count integer;
  v_seal_count integer;
  v_judgment_id text;
BEGIN
  IF jsonb_typeof(p_events) <> 'array' OR jsonb_array_length(p_events) = 0 THEN
    RAISE EXCEPTION 'INVALID_BATCH' USING ERRCODE = '22023';
  END IF;

  -- Serialize one account/project stream. The lock covers exact retry checks
  -- and the all-or-nothing insert, so concurrent surfaces append or expose a
  -- semantic conflict; neither one overwrites the other.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_project_id::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = p_project_id AND p.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND_OR_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_batch_count FROM jsonb_array_elements(p_events);
  SELECT count(DISTINCT item->>'idempotency_key') INTO v_existing_count
  FROM jsonb_array_elements(p_events) item;
  IF v_existing_count <> v_batch_count THEN
    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events)
  LOOP
    IF jsonb_typeof(v_event) <> 'object'
      OR coalesce(v_event->>'event_id', '') = ''
      OR coalesce(v_event->>'idempotency_key', '') = ''
      OR coalesce(v_event->>'space_id', '') = '' THEN
      RAISE EXCEPTION 'INVALID_EVENT' USING ERRCODE = '22023';
    END IF;

    IF v_space_id IS NULL THEN
      v_space_id := v_event->>'space_id';
    ELSIF v_space_id <> v_event->>'space_id' THEN
      RAISE EXCEPTION 'MIXED_SPACE_BATCH' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF v_space_id <> 'account-project:' || p_project_id::text THEN
    RAISE EXCEPTION 'SPACE_MISMATCH' USING ERRCODE = '22023';
  END IF;

  -- A successful first seal must also make the canonical stream discoverable
  -- from the existing project projection. Keep the pointer and append in this
  -- same transaction so a failed local-first project sync cannot orphan a
  -- valid ledger. An exact retry may repair an absent pointer, but may never
  -- replace a pointer to a different judgment.
  SELECT count(*), max(value->>'judgment_id')
    INTO v_seal_count, v_judgment_id
  FROM jsonb_array_elements(p_events)
  WHERE value->>'event' = 'judgment_sealed';

  IF v_seal_count > 1 OR (v_seal_count = 1 AND coalesce(v_judgment_id, '') = '') THEN
    RAISE EXCEPTION 'INVALID_SEAL_BATCH' USING ERRCODE = '22023';
  END IF;

  IF v_judgment_id IS NOT NULL THEN
    UPDATE public.projects
    SET decision_contract = jsonb_set(
      coalesce(decision_contract, '{}'::jsonb),
      '{semantic_judgment_id}',
      to_jsonb(v_judgment_id),
      true
    )
    WHERE id = p_project_id
      AND user_id = p_user_id
      AND (
        decision_contract->>'semantic_judgment_id' IS NULL
        OR decision_contract->>'semantic_judgment_id' = v_judgment_id
      );
    IF NOT FOUND THEN
      RAISE EXCEPTION 'SEMANTIC_JUDGMENT_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- An all-exact retry gets a duplicate receipt. A partial retry, altered
  -- payload, or event-id reuse is refused: accepting only part is an implicit
  -- and un-auditable command split.
  SELECT count(*) INTO v_existing_count
  FROM public.project_semantic_events e
  JOIN jsonb_array_elements(p_events) candidate
    ON e.user_id = p_user_id
   AND e.space_id = v_space_id
   AND e.idempotency_key = candidate->>'idempotency_key';

  IF v_existing_count > 0 THEN
    IF v_existing_count <> v_batch_count THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;

    FOR v_event IN SELECT value FROM jsonb_array_elements(p_events)
    LOOP
      SELECT e.event INTO v_existing
      FROM public.project_semantic_events e
      WHERE e.user_id = p_user_id
        AND e.space_id = v_space_id
        AND e.idempotency_key = v_event->>'idempotency_key';
      -- Compare the idempotency FINGERPRINT, not the raw event, so an honest
      -- retry (fresh time.*) is a duplicate while an altered payload conflicts.
      IF public._argus_semantic_idem_fingerprint(v_existing)
         IS DISTINCT FROM public._argus_semantic_idem_fingerprint(v_event) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;

    RETURN QUERY
      SELECT e.event, e.created_at, true
      FROM public.project_semantic_events e
      WHERE e.user_id = p_user_id
        AND e.space_id = v_space_id
        AND e.idempotency_key IN (SELECT value->>'idempotency_key' FROM jsonb_array_elements(p_events))
      ORDER BY e.created_at, e.event_id;
    RETURN;
  END IF;

  -- Check event id collisions separately so their reason is never hidden by a
  -- generic unique-index error.
  IF EXISTS (
    SELECT 1
    FROM public.project_semantic_events e
    JOIN jsonb_array_elements(p_events) candidate
      ON e.user_id = p_user_id
     AND e.space_id = v_space_id
     AND e.event_id = candidate->>'event_id'
  ) THEN
    RAISE EXCEPTION 'EVENT_ID_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.project_semantic_events (user_id, project_id, space_id, event_id, idempotency_key, event)
  SELECT
    p_user_id,
    p_project_id,
    v_space_id,
    item->>'event_id',
    item->>'idempotency_key',
    item
  FROM jsonb_array_elements(p_events) item;

  RETURN QUERY
    SELECT e.event, e.created_at, false
    FROM public.project_semantic_events e
    WHERE e.user_id = p_user_id
      AND e.space_id = v_space_id
      AND e.idempotency_key IN (SELECT value->>'idempotency_key' FROM jsonb_array_elements(p_events))
    ORDER BY e.created_at, e.event_id;
END;
$$;

REVOKE ALL ON FUNCTION public._argus_semantic_idem_fingerprint(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_project_semantic_events(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_project_semantic_events(uuid, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_project_semantic_events(uuid, uuid, jsonb) TO service_role;
