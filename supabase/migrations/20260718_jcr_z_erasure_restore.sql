-- JCR J8: content-erasing forget receipt, stale-origin firewall, restore receipt.

CREATE TABLE IF NOT EXISTS public.epistemic_erasure_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_id text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('claim','account')),
  subject_id text NOT NULL,
  previous_aggregate_version bigint,
  previous_authority_epoch bigint,
  account_erasure_epoch bigint NOT NULL,
  removed_event_count integer NOT NULL DEFAULT 0,
  removed_use_receipt_count integer NOT NULL DEFAULT 0,
  removed_artifact_count integer NOT NULL DEFAULT 0,
  confirmation_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, receipt_id),
  UNIQUE (user_id, subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS public.epistemic_restore_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restore_id text NOT NULL,
  archive_id text NOT NULL,
  source_account_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('restored','failed','conflict')),
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restore_id)
);

ALTER TABLE public.epistemic_erasure_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epistemic_restore_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own epistemic erasure receipts" ON public.epistemic_erasure_receipts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read own epistemic restore receipts" ON public.epistemic_restore_receipts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.epistemic_erasure_receipts FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.epistemic_restore_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.epistemic_erasure_receipts, public.epistemic_restore_receipts TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_erased_epistemic_subject_resurrection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.epistemic_erasure_receipts r
    WHERE r.user_id = NEW.user_id AND r.subject_type = 'claim' AND r.subject_id = NEW.aggregate_id
  ) THEN
    RAISE EXCEPTION 'ERASED_SUBJECT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS epistemic_erased_subject_guard ON public.epistemic_authority_events;
CREATE TRIGGER epistemic_erased_subject_guard
  BEFORE INSERT ON public.epistemic_authority_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_erased_epistemic_subject_resurrection();

CREATE OR REPLACE FUNCTION public.forget_epistemic_claim(
  p_user_id uuid,
  p_claim_id text,
  p_expected_authority_epoch bigint,
  p_expected_erasure_epoch bigint,
  p_receipt_id text,
  p_confirmation_fingerprint text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy public.epistemic_account_policies%ROWTYPE;
  v_version bigint;
  v_epoch bigint;
  v_events integer;
  v_uses integer;
  v_artifacts integer;
  v_event_ids text[];
  v_capsule_ids text[];
  v_existing public.epistemic_erasure_receipts%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':account-erasure', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':claim:' || p_claim_id, 0));
  SELECT * INTO v_existing FROM public.epistemic_erasure_receipts
  WHERE user_id = p_user_id AND subject_type = 'claim' AND subject_id = p_claim_id;
  IF FOUND THEN
    IF v_existing.receipt_id <> p_receipt_id
      OR v_existing.confirmation_fingerprint <> p_confirmation_fingerprint THEN
      RAISE EXCEPTION 'CLAIM_ALREADY_ERASED';
    END IF;
    RETURN jsonb_build_object(
      'receipt_id', v_existing.receipt_id, 'claim_id', v_existing.subject_id,
      'previous_aggregate_version', v_existing.previous_aggregate_version,
      'previous_authority_epoch', v_existing.previous_authority_epoch,
      'account_erasure_epoch', v_existing.account_erasure_epoch,
      'removed_event_count', v_existing.removed_event_count,
      'removed_use_receipt_count', v_existing.removed_use_receipt_count,
      'removed_artifact_count', v_existing.removed_artifact_count,
      'status', 'exact_retry'
    );
  END IF;
  SELECT * INTO v_policy FROM public.epistemic_account_policies WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_POLICY_NOT_FOUND'; END IF;
  IF v_policy.erasure_epoch <> p_expected_erasure_epoch THEN RAISE EXCEPTION 'STALE_ERASURE_EPOCH'; END IF;
  SELECT max(aggregate_version), max(authority_epoch), array_agg(event_id)
    INTO v_version, v_epoch, v_event_ids
  FROM public.epistemic_authority_events
  WHERE user_id = p_user_id AND aggregate_id = p_claim_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'CLAIM_NOT_FOUND'; END IF;
  IF v_epoch <> p_expected_authority_epoch THEN RAISE EXCEPTION 'STALE_AUTHORITY_EPOCH'; END IF;
  IF coalesce(p_confirmation_fingerprint, '') = '' THEN RAISE EXCEPTION 'CONFIRMATION_REQUIRED'; END IF;

  SELECT array_agg(capsule_artifact_id) INTO v_capsule_ids
  FROM public.epistemic_context_traces t
  WHERE t.user_id = p_user_id AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(t.trace->'candidates', '[]'::jsonb)) c
    WHERE c->>'claim_id' = p_claim_id
  );

  DELETE FROM public.epistemic_context_traces t
  WHERE t.user_id = p_user_id AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(t.trace->'candidates', '[]'::jsonb)) c
    WHERE c->>'claim_id' = p_claim_id
  );
  DELETE FROM public.epistemic_use_receipts WHERE user_id = p_user_id AND claim_id = p_claim_id;
  GET DIAGNOSTICS v_uses = ROW_COUNT;
  DELETE FROM public.epistemic_artifact_descriptors
  WHERE user_id = p_user_id AND (
    source_event_ref = ANY(coalesce(v_event_ids, ARRAY[]::text[]))
    OR artifact_id = ANY(coalesce(v_capsule_ids, ARRAY[]::text[]))
  );
  GET DIAGNOSTICS v_artifacts = ROW_COUNT;
  DELETE FROM public.epistemic_command_receipts WHERE user_id = p_user_id AND claim_id = p_claim_id;
  DELETE FROM public.epistemic_projection_outbox WHERE user_id = p_user_id AND aggregate_id = p_claim_id;
  DELETE FROM public.epistemic_recall_documents WHERE user_id = p_user_id AND document_id = 'claim:' || p_claim_id;
  DELETE FROM public.epistemic_authority_events WHERE user_id = p_user_id AND aggregate_id = p_claim_id;
  GET DIAGNOSTICS v_events = ROW_COUNT;

  UPDATE public.epistemic_account_policies
  SET erasure_epoch = erasure_epoch + 1, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_policy;
  UPDATE public.epistemic_recall_projection_state
  SET status = 'invalid', document_count = greatest(document_count - 1, 0), rebuilt_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.epistemic_erasure_receipts (
    user_id, receipt_id, subject_type, subject_id, previous_aggregate_version,
    previous_authority_epoch, account_erasure_epoch, removed_event_count,
    removed_use_receipt_count, removed_artifact_count, confirmation_fingerprint
  ) VALUES (
    p_user_id, p_receipt_id, 'claim', p_claim_id, v_version, v_epoch,
    v_policy.erasure_epoch, v_events, v_uses, v_artifacts, p_confirmation_fingerprint
  );
  RETURN jsonb_build_object(
    'receipt_id', p_receipt_id, 'claim_id', p_claim_id,
    'previous_aggregate_version', v_version, 'previous_authority_epoch', v_epoch,
    'account_erasure_epoch', v_policy.erasure_epoch,
    'removed_event_count', v_events, 'removed_use_receipt_count', v_uses,
    'removed_artifact_count', v_artifacts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.forget_epistemic_claim(uuid, text, bigint, bigint, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.forget_epistemic_claim(uuid, text, bigint, bigint, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.restore_epistemic_use_receipts(
  p_user_id uuid,
  p_archive_id text,
  p_receipts jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  restored integer := 0;
  inserted integer;
  v_existing public.epistemic_use_receipts%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_receipts) <> 'array' OR jsonb_array_length(p_receipts) > 100000
    OR coalesce(p_archive_id, '') = '' THEN RAISE EXCEPTION 'INVALID_RESTORE_RECEIPTS'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':archive-restore', 0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_receipts)
  LOOP
    IF coalesce(item->>'receipt_id','') = '' OR coalesce(item->>'claim_id','') = ''
      OR coalesce(item->>'grant_id','') = '' OR NOT EXISTS (
        SELECT 1 FROM public.epistemic_authority_events e
        WHERE e.user_id = p_user_id AND e.aggregate_id = item->>'claim_id'
          AND e.event_type = 'influence_granted' AND e.event->'payload'->>'grant_id' = item->>'grant_id'
      ) THEN RAISE EXCEPTION 'INVALID_RESTORE_RECEIPT'; END IF;
    SELECT * INTO v_existing FROM public.epistemic_use_receipts
    WHERE user_id = p_user_id AND receipt_id = item->>'receipt_id';
    IF FOUND THEN
      IF v_existing.claim_id IS DISTINCT FROM item->>'claim_id'
        OR v_existing.grant_id IS DISTINCT FROM item->>'grant_id'
        OR v_existing.authority_epoch IS DISTINCT FROM (item->>'authority_epoch')::bigint
        OR v_existing.grant_revision IS DISTINCT FROM (item->>'grant_revision')::bigint
        OR v_existing.call_id IS DISTINCT FROM item->>'call_id'
        OR v_existing.use_slot IS DISTINCT FROM item->>'use_slot'
        OR v_existing.effect IS DISTINCT FROM item->>'effect'
        OR v_existing.surface IS DISTINCT FROM item->>'surface'
        OR v_existing.scope_hash IS DISTINCT FROM item->>'scope_hash'
        OR v_existing.capsule_hash IS DISTINCT FROM item->>'capsule_hash'
        OR v_existing.dispatch_state IS DISTINCT FROM item->>'dispatch_state' THEN
        RAISE EXCEPTION 'RESTORE_RECEIPT_CONFLICT';
      END IF;
      CONTINUE;
    END IF;
    INSERT INTO public.epistemic_use_receipts (
      user_id, receipt_id, claim_id, grant_id, authority_epoch, grant_revision,
      call_id, use_slot, effect, surface, scope_hash, capsule_hash, reserved_at, dispatch_state
    ) VALUES (
      p_user_id, item->>'receipt_id', item->>'claim_id', item->>'grant_id',
      (item->>'authority_epoch')::bigint, (item->>'grant_revision')::bigint,
      item->>'call_id', item->>'use_slot', item->>'effect', item->>'surface',
      item->>'scope_hash', item->>'capsule_hash', (item->>'reserved_at')::timestamptz,
      item->>'dispatch_state'
    ) ON CONFLICT (user_id, receipt_id) DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;
    restored := restored + inserted;
  END LOOP;
  RETURN restored;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_epistemic_use_receipts(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_epistemic_use_receipts(uuid, text, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.restore_epistemic_account_policy(
  p_user_id uuid,
  p_archive_id text,
  p_retention_policy text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(p_archive_id, '') = ''
    OR p_retention_policy NOT IN ('local_default','account_default','custom') THEN
    RAISE EXCEPTION 'INVALID_RESTORE_POLICY';
  END IF;
  -- Account erasure epoch and device origin bindings are target-side security
  -- state. Only the portable retention choice crosses account boundaries.
  INSERT INTO public.epistemic_account_policies (user_id, retention_policy)
  VALUES (p_user_id, p_retention_policy)
  ON CONFLICT (user_id) DO UPDATE SET
    retention_policy = EXCLUDED.retention_policy,
    updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.restore_epistemic_account_policy(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_epistemic_account_policy(uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_epistemic_context(
  p_user_id uuid,
  p_now timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trace_ids text[];
  v_artifact_ids text[];
  v_traces integer := 0;
  v_artifacts integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':context-retention', 0));
  SELECT array_agg(trace_id), array_agg(capsule_artifact_id) FILTER (WHERE capsule_artifact_id IS NOT NULL)
    INTO v_trace_ids, v_artifact_ids
  FROM public.epistemic_context_traces
  WHERE user_id = p_user_id AND expires_at <= p_now;
  DELETE FROM public.epistemic_context_traces
  WHERE user_id = p_user_id AND trace_id = ANY(coalesce(v_trace_ids, ARRAY[]::text[]));
  GET DIAGNOSTICS v_traces = ROW_COUNT;
  DELETE FROM public.epistemic_artifact_descriptors d
  WHERE d.user_id = p_user_id
    AND d.artifact_id = ANY(coalesce(v_artifact_ids, ARRAY[]::text[]))
    AND NOT EXISTS (
      SELECT 1 FROM public.epistemic_context_traces t
      WHERE t.user_id = p_user_id AND t.capsule_artifact_id = d.artifact_id
    );
  GET DIAGNOSTICS v_artifacts = ROW_COUNT;
  RETURN jsonb_build_object('traces_removed', v_traces, 'artifacts_removed', v_artifacts);
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_epistemic_context(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_epistemic_context(uuid, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.record_epistemic_restore_receipt(
  p_user_id uuid,
  p_restore_id text,
  p_archive_id text,
  p_source_account_id text,
  p_status text,
  p_receipt jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('restored','failed','conflict') OR jsonb_typeof(p_receipt) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_RESTORE_RECEIPT';
  END IF;
  INSERT INTO public.epistemic_restore_receipts (
    user_id, restore_id, archive_id, source_account_id, status, receipt
  ) VALUES (p_user_id, p_restore_id, p_archive_id, p_source_account_id, p_status, p_receipt)
  ON CONFLICT (user_id, restore_id) DO UPDATE SET
    status = EXCLUDED.status, receipt = EXCLUDED.receipt;
END;
$$;
REVOKE ALL ON FUNCTION public.record_epistemic_restore_receipt(uuid, text, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_epistemic_restore_receipt(uuid, text, text, text, text, jsonb)
  TO service_role;
