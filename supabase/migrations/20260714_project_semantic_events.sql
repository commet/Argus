-- DKK v6: append-only account/project semantic ledger.
--
-- `projects.decision_contract` is a legacy/read-model JSONB projection. It is
-- deliberately not the canonical event stream: local-first upserts can resolve
-- concurrent JSONB edits by last-write-wins and would silently discard a human
-- authorial act. This table preserves every admitted v3 event instead.

CREATE TABLE IF NOT EXISTS public.project_semantic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  space_id text NOT NULL,
  event_id text NOT NULL,
  idempotency_key text NOT NULL,
  event jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_semantic_events_user_space_event_uniq UNIQUE (user_id, space_id, event_id),
  CONSTRAINT project_semantic_events_user_space_idempotency_uniq UNIQUE (user_id, space_id, idempotency_key),
  CONSTRAINT project_semantic_events_event_object CHECK (jsonb_typeof(event) = 'object')
);

ALTER TABLE public.project_semantic_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own project semantic events" ON public.project_semantic_events;
CREATE POLICY "Users can read own project semantic events"
  ON public.project_semantic_events FOR SELECT
  USING ((select auth.uid()) = user_id);

-- No browser INSERT/UPDATE/DELETE policy: the command gateway authenticates the
-- user, constructs v3 events, preflights their transitions, and calls the RPC.
-- This is not secrecy theater; it prevents a mutable client projection from
-- replacing a concurrent authorial record.

CREATE INDEX IF NOT EXISTS project_semantic_events_stream_idx
  ON public.project_semantic_events (user_id, project_id, created_at, event_id);

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
      IF v_existing IS DISTINCT FROM v_event THEN
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

REVOKE ALL ON FUNCTION public.append_project_semantic_events(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_project_semantic_events(uuid, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_project_semantic_events(uuid, uuid, jsonb) TO service_role;
