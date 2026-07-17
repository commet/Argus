-- JCR J4: server-side epistemic authority, command receipts, use receipts,
-- artifact descriptors, and projection outbox.
--
-- All writes are service-role RPC writes. Authenticated clients can read their
-- own rows through RLS but cannot append authority events directly.

CREATE TABLE IF NOT EXISTS public.epistemic_account_policies (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  erasure_epoch bigint NOT NULL DEFAULT 0 CHECK (erasure_epoch >= 0),
  retention_policy text NOT NULL DEFAULT 'account_default'
    CHECK (retention_policy IN ('local_default', 'account_default', 'custom')),
  sync_origins jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sync_origins) = 'array'),
  blocked_origins jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocked_origins) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.epistemic_authority_events (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aggregate_type text NOT NULL DEFAULT 'claim' CHECK (aggregate_type = 'claim'),
  aggregate_id text NOT NULL CHECK (aggregate_id <> ''),
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  authority_epoch bigint NOT NULL CHECK (authority_epoch >= 0),
  event_id text NOT NULL CHECK (event_id <> ''),
  event_type text NOT NULL CHECK (event_type <> ''),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  command_id text NOT NULL CHECK (command_id <> ''),
  idempotency_key text NOT NULL CHECK (idempotency_key <> ''),
  semantic_fingerprint text NOT NULL CHECK (semantic_fingerprint <> ''),
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'migration', 'imported_unverified')),
  origin_id text NOT NULL CHECK (origin_id <> ''),
  origin_sequence bigint NULL CHECK (origin_sequence IS NULL OR origin_sequence >= 0),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  payload_ref text NULL,
  event jsonb NOT NULL CHECK (jsonb_typeof(event) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epistemic_authority_events_stream_version_uniq
    UNIQUE (user_id, aggregate_type, aggregate_id, aggregate_version),
  CONSTRAINT epistemic_authority_events_event_id_uniq UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS epistemic_authority_events_stream_idx
  ON public.epistemic_authority_events (user_id, aggregate_id, aggregate_version);
CREATE INDEX IF NOT EXISTS epistemic_authority_events_command_idx
  ON public.epistemic_authority_events (user_id, origin_id, idempotency_key);

CREATE TABLE IF NOT EXISTS public.epistemic_command_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_id text NOT NULL,
  idempotency_key text NOT NULL,
  command_id text NOT NULL,
  claim_id text NOT NULL,
  semantic_fingerprint text NOT NULL,
  aggregate_version bigint NOT NULL,
  authority_epoch bigint NOT NULL,
  event_ids jsonb NOT NULL CHECK (jsonb_typeof(event_ids) = 'array'),
  state_checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, origin_id, idempotency_key),
  CONSTRAINT epistemic_command_receipts_command_uniq UNIQUE (user_id, command_id)
);

CREATE TABLE IF NOT EXISTS public.epistemic_use_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_id text NOT NULL,
  claim_id text NOT NULL,
  grant_id text NOT NULL,
  authority_epoch bigint NOT NULL CHECK (authority_epoch >= 0),
  grant_revision bigint NOT NULL CHECK (grant_revision > 0),
  call_id text NOT NULL,
  use_slot text NOT NULL,
  effect text NOT NULL CHECK (effect IN ('retrieve_only', 'ask_once', 'adapt_generation')),
  surface text NOT NULL CHECK (surface IN ('web', 'mcp', 'plugin')),
  scope_hash text NOT NULL,
  capsule_hash text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  dispatch_state text NOT NULL DEFAULT 'reserved'
    CHECK (dispatch_state IN ('reserved', 'dispatched', 'provider_failed')),
  PRIMARY KEY (user_id, receipt_id),
  CONSTRAINT epistemic_use_receipts_slot_uniq UNIQUE (user_id, use_slot),
  CONSTRAINT epistemic_use_receipts_call_grant_uniq UNIQUE (user_id, call_id, grant_id)
);

CREATE TABLE IF NOT EXISTS public.epistemic_artifact_descriptors (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artifact_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('source_slice', 'legacy_snapshot', 'context_capsule', 'review_source')),
  state text NOT NULL CHECK (state IN ('staged', 'verified', 'ready', 'quarantined', 'deleted')),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  media_type text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  sensitivity text NOT NULL CHECK (sensitivity IN ('standard', 'sensitive', 'highly_sensitive')),
  owner_scope text NOT NULL,
  source_event_ref text NULL,
  model_lineage jsonb NULL,
  retention_class text NOT NULL CHECK (retention_class IN ('ephemeral', 'bounded', 'durable')),
  object_locator text NOT NULL,
  staging_locator text NULL,
  verified_sha256 text NULL,
  verified_byte_length bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artifact_id),
  CONSTRAINT epistemic_artifact_ready_verified CHECK (
    state <> 'ready' OR (
      verified_sha256 = sha256 AND verified_byte_length = byte_length
    )
  )
);

CREATE INDEX IF NOT EXISTS epistemic_artifact_descriptors_state_idx
  ON public.epistemic_artifact_descriptors (user_id, state, created_at);

CREATE TABLE IF NOT EXISTS public.epistemic_projection_outbox (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outbox_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id text NOT NULL,
  aggregate_version bigint NOT NULL,
  authority_epoch bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'attempted', 'succeeded', 'abandoned')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epistemic_projection_outbox_version_uniq
    UNIQUE (user_id, aggregate_id, aggregate_version)
);

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'epistemic_account_policies',
    'epistemic_authority_events',
    'epistemic_command_receipts',
    'epistemic_use_receipts',
    'epistemic_artifact_descriptors',
    'epistemic_projection_outbox'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users can read own %s" ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY "Users can read own %s" ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)',
      table_name,
      table_name
    );
  END LOOP;
END $$;

-- One private bucket. Object keys are always account-scoped and are only
-- manipulated by the service-role artifact gateway.
INSERT INTO storage.buckets (id, name, public)
VALUES ('epistemic-artifacts', 'epistemic-artifacts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE OR REPLACE FUNCTION public.append_epistemic_authority_command(
  p_user_id uuid,
  p_claim_id text,
  p_expected_version bigint,
  p_expected_epoch bigint,
  p_erasure_epoch bigint,
  p_origin_id text,
  p_idempotency_key text,
  p_semantic_fingerprint text,
  p_command_id text,
  p_state_checksum text,
  p_events jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy public.epistemic_account_policies%ROWTYPE;
  v_receipt public.epistemic_command_receipts%ROWTYPE;
  v_event jsonb;
  v_current_version bigint := 0;
  v_current_epoch bigint := 0;
  v_index bigint := 0;
  v_last_version bigint;
  v_last_epoch bigint;
  v_event_ids jsonb := '[]'::jsonb;
BEGIN
  IF coalesce(p_claim_id, '') = '' OR coalesce(p_origin_id, '') = ''
    OR coalesce(p_idempotency_key, '') = '' OR coalesce(p_semantic_fingerprint, '') = ''
    OR coalesce(p_command_id, '') = '' OR coalesce(p_state_checksum, '') = ''
    OR jsonb_typeof(p_events) <> 'array' OR jsonb_array_length(p_events) = 0 THEN
    RAISE EXCEPTION 'INVALID_COMMAND_BATCH' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':claim:' || p_claim_id, 0));

  INSERT INTO public.epistemic_account_policies (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_policy
  FROM public.epistemic_account_policies
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_policy.erasure_epoch <> p_erasure_epoch THEN
    RAISE EXCEPTION 'STALE_ERASURE_EPOCH' USING ERRCODE = 'P0001';
  END IF;
  IF v_policy.blocked_origins ? p_origin_id THEN
    RAISE EXCEPTION 'BLOCKED_ORIGIN' USING ERRCODE = '42501';
  END IF;
  IF jsonb_array_length(v_policy.sync_origins) > 0 AND NOT (v_policy.sync_origins ? p_origin_id) THEN
    RAISE EXCEPTION 'BLOCKED_ORIGIN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_receipt
  FROM public.epistemic_command_receipts
  WHERE user_id = p_user_id AND origin_id = p_origin_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_receipt.semantic_fingerprint <> p_semantic_fingerprint THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'status', 'exact_retry',
      'command_id', v_receipt.command_id,
      'claim_id', v_receipt.claim_id,
      'event_ids', v_receipt.event_ids,
      'aggregate_version', v_receipt.aggregate_version,
      'authority_epoch', v_receipt.authority_epoch,
      'current_state_checksum', v_receipt.state_checksum
    );
  END IF;

  SELECT aggregate_version, authority_epoch
  INTO v_current_version, v_current_epoch
  FROM public.epistemic_authority_events
  WHERE user_id = p_user_id AND aggregate_type = 'claim' AND aggregate_id = p_claim_id
  ORDER BY aggregate_version DESC
  LIMIT 1;
  v_current_version := coalesce(v_current_version, 0);
  v_current_epoch := coalesce(v_current_epoch, 0);

  IF v_current_version <> p_expected_version THEN
    RAISE EXCEPTION 'STALE_AGGREGATE_VERSION' USING ERRCODE = '40001';
  END IF;
  IF v_current_epoch <> p_expected_epoch THEN
    RAISE EXCEPTION 'STALE_AUTHORITY_EPOCH' USING ERRCODE = '40001';
  END IF;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events)
  LOOP
    v_index := v_index + 1;
    IF jsonb_typeof(v_event) <> 'object'
      OR v_event->>'aggregate_type' <> 'claim'
      OR v_event->>'aggregate_id' <> p_claim_id
      OR (v_event->>'aggregate_version')::bigint <> p_expected_version + v_index
      OR (v_event->>'authority_epoch')::bigint < v_current_epoch
      OR (v_event->>'authority_epoch')::bigint > v_current_epoch + 1
      OR v_event->>'command_id' <> p_command_id
      OR v_event->>'origin_id' <> p_origin_id
      OR v_event->>'idempotency_key' <> p_idempotency_key
      OR v_event->>'semantic_fingerprint' <> p_semantic_fingerprint
      OR v_event->>'user_id' <> p_user_id::text
      OR coalesce(v_event->>'event_id', '') = ''
      OR coalesce(v_event->>'event_type', '') = ''
      OR coalesce((v_event->>'schema_version')::integer, 0) <> 2
      OR jsonb_typeof(v_event->'payload') <> 'object' THEN
      RAISE EXCEPTION 'INVALID_EVENT_BATCH' USING ERRCODE = '22023';
    END IF;
    v_current_epoch := (v_event->>'authority_epoch')::bigint;
    v_event_ids := v_event_ids || jsonb_build_array(v_event->>'event_id');
    IF v_event ? 'payload_ref' AND coalesce(v_event->>'payload_ref', '') <> '' AND NOT EXISTS (
      SELECT 1 FROM public.epistemic_artifact_descriptors d
      WHERE d.user_id = p_user_id
        AND d.artifact_id = v_event->>'payload_ref'
        AND d.state = 'ready'
        AND d.verified_sha256 = d.sha256
        AND d.verified_byte_length = d.byte_length
    ) THEN
      RAISE EXCEPTION 'ARTIFACT_NOT_READY' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  INSERT INTO public.epistemic_authority_events (
    user_id, aggregate_type, aggregate_id, aggregate_version, authority_epoch,
    event_id, event_type, schema_version, command_id, idempotency_key,
    semantic_fingerprint, actor_type, origin_id, origin_sequence, occurred_at,
    recorded_at, payload_ref, event
  )
  SELECT
    p_user_id, item->>'aggregate_type', item->>'aggregate_id',
    (item->>'aggregate_version')::bigint, (item->>'authority_epoch')::bigint,
    item->>'event_id', item->>'event_type', (item->>'schema_version')::integer,
    item->>'command_id', item->>'idempotency_key', item->>'semantic_fingerprint',
    item->>'actor_type', item->>'origin_id',
    CASE WHEN item ? 'origin_sequence' THEN (item->>'origin_sequence')::bigint ELSE NULL END,
    (item->>'occurred_at')::timestamptz, (item->>'recorded_at')::timestamptz,
    item->>'payload_ref', item
  FROM jsonb_array_elements(p_events) item;

  v_last_version := p_expected_version + jsonb_array_length(p_events);
  v_last_epoch := v_current_epoch;

  INSERT INTO public.epistemic_command_receipts (
    user_id, origin_id, idempotency_key, command_id, claim_id,
    semantic_fingerprint, aggregate_version, authority_epoch, event_ids, state_checksum
  ) VALUES (
    p_user_id, p_origin_id, p_idempotency_key, p_command_id, p_claim_id,
    p_semantic_fingerprint, v_last_version, v_last_epoch, v_event_ids, p_state_checksum
  );

  INSERT INTO public.epistemic_projection_outbox (
    user_id, aggregate_id, aggregate_version, authority_epoch
  ) VALUES (p_user_id, p_claim_id, v_last_version, v_last_epoch);

  RETURN jsonb_build_object(
    'status', 'applied',
    'command_id', p_command_id,
    'claim_id', p_claim_id,
    'event_ids', v_event_ids,
    'aggregate_version', v_last_version,
    'authority_epoch', v_last_epoch,
    'current_state_checksum', p_state_checksum
  );
END;
$$;

REVOKE ALL ON FUNCTION public.append_epistemic_authority_command(
  uuid, text, bigint, bigint, bigint, text, text, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_epistemic_authority_command(
  uuid, text, bigint, bigint, bigint, text, text, text, text, text, jsonb
) TO service_role;
