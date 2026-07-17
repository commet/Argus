-- JCR J5: lock-and-revalidate influence use reservation.
-- The compiler never inserts epistemic_use_receipts directly.

CREATE TABLE IF NOT EXISTS public.epistemic_context_traces (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trace_id text NOT NULL,
  call_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('audit', 'dispatch')),
  surface text NOT NULL CHECK (surface IN ('web', 'mcp', 'plugin')),
  purpose text NOT NULL CHECK (purpose IN ('explicit_recall', 'ordinary_generation')),
  renderer_version integer NOT NULL,
  tokenizer_name text NOT NULL,
  requested_tokens integer NOT NULL CHECK (requested_tokens >= 0),
  used_tokens integer NOT NULL CHECK (used_tokens >= 0),
  capsule_artifact_id text NULL,
  capsule_hash text NULL,
  trace jsonb NOT NULL CHECK (jsonb_typeof(trace) = 'object'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trace_id)
);

CREATE INDEX IF NOT EXISTS epistemic_context_traces_expiry_idx
  ON public.epistemic_context_traces (user_id, expires_at);

ALTER TABLE public.epistemic_context_traces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own epistemic_context_traces"
  ON public.epistemic_context_traces;
CREATE POLICY "Users can read own epistemic_context_traces"
  ON public.epistemic_context_traces FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.reserve_epistemic_influence_use(
  p_user_id uuid,
  p_erasure_epoch bigint,
  p_receipt_id text,
  p_claim_id text,
  p_grant_id text,
  p_authority_epoch bigint,
  p_grant_revision bigint,
  p_call_id text,
  p_effect text,
  p_surface text,
  p_scope jsonb,
  p_scope_hash text,
  p_capsule_hash text,
  p_reserved_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy_epoch bigint;
  v_current_epoch bigint;
  v_lifecycle text;
  v_grant_event jsonb;
  v_grant_version bigint;
  v_revision bigint;
  v_use_slot text;
  v_now timestamptz := clock_timestamp();
  v_existing public.epistemic_use_receipts%ROWTYPE;
BEGIN
  IF coalesce(p_receipt_id, '') = '' OR coalesce(p_claim_id, '') = ''
    OR coalesce(p_grant_id, '') = '' OR coalesce(p_call_id, '') = ''
    OR p_effect NOT IN ('ask_once', 'adapt_generation')
    OR p_surface NOT IN ('web', 'mcp', 'plugin')
    OR jsonb_typeof(p_scope) <> 'object'
    OR coalesce(p_scope_hash, '') = '' OR coalesce(p_capsule_hash, '') = ''
    OR p_reserved_at IS NULL
    OR abs(extract(epoch FROM (v_now - p_reserved_at))) > 300 THEN
    RAISE EXCEPTION 'INVALID_USE_RESERVATION' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':claim:' || p_claim_id, 0));

  SELECT erasure_epoch INTO v_policy_epoch
  FROM public.epistemic_account_policies
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF v_policy_epoch IS NULL OR v_policy_epoch <> p_erasure_epoch THEN
    RAISE EXCEPTION 'STALE_ERASURE_EPOCH' USING ERRCODE = 'P0001';
  END IF;

  SELECT authority_epoch INTO v_current_epoch
  FROM public.epistemic_authority_events
  WHERE user_id = p_user_id AND aggregate_type = 'claim' AND aggregate_id = p_claim_id
  ORDER BY aggregate_version DESC
  LIMIT 1;
  IF v_current_epoch IS NULL OR v_current_epoch <> p_authority_epoch THEN
    RAISE EXCEPTION 'STALE_AUTHORITY_EPOCH' USING ERRCODE = '40001';
  END IF;

  SELECT CASE
    WHEN event_type = 'claim_forgotten' THEN 'forgotten'
    WHEN event_type = 'claim_contested' THEN 'contested'
    WHEN event_type = 'counterexample_added' AND event #>> '{payload,material}' = 'true' THEN 'contested'
    WHEN event_type = 'claim_retired' THEN 'retired'
    WHEN event_type = 'claim_reopened' THEN 'candidate'
    WHEN event_type = 'claim_endorsed' THEN 'endorsed'
    WHEN event_type = 'claim_proposed' THEN 'candidate'
    ELSE NULL
  END INTO v_lifecycle
  FROM public.epistemic_authority_events
  WHERE user_id = p_user_id AND aggregate_type = 'claim' AND aggregate_id = p_claim_id
    AND (
      event_type IN ('claim_forgotten', 'claim_contested', 'claim_retired', 'claim_reopened', 'claim_endorsed', 'claim_proposed')
      OR (event_type = 'counterexample_added' AND event #>> '{payload,material}' = 'true')
    )
  ORDER BY aggregate_version DESC
  LIMIT 1;
  IF v_lifecycle <> 'endorsed' THEN
    RAISE EXCEPTION 'CLAIM_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT event, aggregate_version INTO v_grant_event, v_grant_version
  FROM public.epistemic_authority_events
  WHERE user_id = p_user_id AND aggregate_type = 'claim' AND aggregate_id = p_claim_id
    AND event_type = 'influence_granted'
    AND event #>> '{payload,grant_id}' = p_grant_id
  ORDER BY aggregate_version DESC
  LIMIT 1;
  IF v_grant_event IS NULL THEN
    RAISE EXCEPTION 'GRANT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.epistemic_authority_events
    WHERE user_id = p_user_id AND aggregate_type = 'claim' AND aggregate_id = p_claim_id
      AND aggregate_version > v_grant_version
      AND (
        event_type = 'claim_grants_invalidated'
        OR (event_type = 'influence_revoked' AND event #>> '{payload,grant_id}' = p_grant_id)
      )
  ) THEN
    RAISE EXCEPTION 'GRANT_INACTIVE' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(max((event #>> '{payload,revision}')::bigint),
    (v_grant_event #>> '{payload,revision}')::bigint)
  INTO v_revision
  FROM public.epistemic_authority_events
  WHERE user_id = p_user_id AND aggregate_type = 'claim' AND aggregate_id = p_claim_id
    AND event_type = 'ask_once_rearmed'
    AND event #>> '{payload,grant_id}' = p_grant_id
    AND aggregate_version > v_grant_version;

  IF v_revision <> p_grant_revision
    OR v_grant_event #>> '{payload,effect}' <> p_effect
    OR NOT ((v_grant_event #> '{payload,surfaces}') ? p_surface)
    OR (v_grant_event->>'authority_epoch')::bigint <> p_authority_epoch
    OR (v_grant_event #>> '{payload,starts_at}')::timestamptz > v_now
    OR (
      v_grant_event #>> '{payload,expires_at}' IS NOT NULL
      AND (v_grant_event #>> '{payload,expires_at}')::timestamptz < v_now
    )
    OR (
      v_grant_event #>> '{payload,scope,value,domain}' IS NOT NULL
      AND v_grant_event #>> '{payload,scope,value,domain}' <> p_scope->>'domain'
    )
    OR (
      v_grant_event #>> '{payload,scope,value,project_id}' IS NOT NULL
      AND v_grant_event #>> '{payload,scope,value,project_id}' <> p_scope->>'project_id'
    )
    OR (
      v_grant_event #>> '{payload,scope,value,session_id}' IS NOT NULL
      AND v_grant_event #>> '{payload,scope,value,session_id}' <> p_scope->>'session_id'
    ) THEN
    RAISE EXCEPTION 'GRANT_SCOPE_OR_REVISION_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  v_use_slot := CASE WHEN p_effect = 'ask_once'
    THEN 'once:' || p_grant_id || ':' || p_authority_epoch::text || ':' || p_grant_revision::text
    ELSE 'call:' || p_call_id || ':' || p_grant_id
  END;

  SELECT * INTO v_existing
  FROM public.epistemic_use_receipts
  WHERE user_id = p_user_id AND receipt_id = p_receipt_id;
  IF FOUND THEN
    IF v_existing.claim_id = p_claim_id AND v_existing.grant_id = p_grant_id
      AND v_existing.authority_epoch = p_authority_epoch
      AND v_existing.grant_revision = p_grant_revision
      AND v_existing.call_id = p_call_id AND v_existing.effect = p_effect
      AND v_existing.surface = p_surface AND v_existing.scope_hash = p_scope_hash
      AND v_existing.capsule_hash = p_capsule_hash THEN
      RETURN to_jsonb(v_existing) || jsonb_build_object('status', 'exact_retry');
    END IF;
    RAISE EXCEPTION 'USE_RECEIPT_CONFLICT' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.epistemic_use_receipts (
      user_id, receipt_id, claim_id, grant_id, authority_epoch, grant_revision,
      call_id, use_slot, effect, surface, scope_hash, capsule_hash, reserved_at
    ) VALUES (
      p_user_id, p_receipt_id, p_claim_id, p_grant_id, p_authority_epoch,
      p_grant_revision, p_call_id, v_use_slot, p_effect, p_surface,
      p_scope_hash, p_capsule_hash, v_now
    ) RETURNING * INTO v_existing;
  EXCEPTION WHEN unique_violation THEN
    IF p_effect = 'ask_once' THEN
      RAISE EXCEPTION 'ASK_ONCE_ALREADY_USED' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'USE_RECEIPT_CONFLICT' USING ERRCODE = 'P0001';
  END;

  RETURN to_jsonb(v_existing) || jsonb_build_object('status', 'reserved');
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_epistemic_use_dispatch(
  p_user_id uuid,
  p_receipt_id text,
  p_state text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_state NOT IN ('dispatched', 'provider_failed') THEN
    RAISE EXCEPTION 'INVALID_DISPATCH_STATE' USING ERRCODE = '22023';
  END IF;
  UPDATE public.epistemic_use_receipts
  SET dispatch_state = p_state
  WHERE user_id = p_user_id AND receipt_id = p_receipt_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_epistemic_influence_use(
  uuid, bigint, text, text, text, bigint, bigint, text, text, text, jsonb, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_epistemic_influence_use(
  uuid, bigint, text, text, text, bigint, bigint, text, text, text, jsonb, text, text, timestamptz
) TO service_role;

REVOKE ALL ON FUNCTION public.mark_epistemic_use_dispatch(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_epistemic_use_dispatch(uuid, text, text)
  TO service_role;
