-- Durable anonymous work must survive both:
--   1. creating a new permanent account, and
--   2. signing in to an existing permanent account.
--
-- The browser first exchanges its anonymous JWT for a random, HttpOnly transfer
-- ticket. After permanent authentication, the service-role-only function below
-- atomically moves every durable voyage row from the anonymous auth user to the
-- permanent user. A failed transaction moves nothing and leaves the ticket
-- retryable.

CREATE TABLE IF NOT EXISTS public.anonymous_account_transfer_tickets (
  token_hash text PRIMARY KEY,
  source_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  consumed_at timestamptz
);

ALTER TABLE public.anonymous_account_transfer_tickets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.anonymous_account_transfer_tickets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.anonymous_account_transfer_tickets TO service_role;

CREATE INDEX IF NOT EXISTS anonymous_account_transfer_source_idx
  ON public.anonymous_account_transfer_tickets (source_user_id, expires_at DESC);

CREATE OR REPLACE FUNCTION public.claim_anonymous_account_transfer(
  p_token_hash text,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket public.anonymous_account_transfer_tickets%ROWTYPE;
  v_source_is_anonymous boolean;
  v_target_is_anonymous boolean;
  v_count integer;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  IF p_token_hash IS NULL OR length(p_token_hash) <> 64 OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'TRANSFER_INVALID_ARGUMENT';
  END IF;

  SELECT *
    INTO v_ticket
    FROM public.anonymous_account_transfer_tickets
   WHERE token_hash = p_token_hash
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFER_TICKET_NOT_FOUND';
  END IF;

  IF v_ticket.consumed_at IS NOT NULL THEN
    IF v_ticket.target_user_id = p_target_user_id THEN
      RETURN jsonb_build_object('ok', true, 'already_consumed', true, 'counts', '{}'::jsonb);
    END IF;
    RAISE EXCEPTION 'TRANSFER_TICKET_ALREADY_CONSUMED';
  END IF;

  IF v_ticket.expires_at <= now() THEN
    RAISE EXCEPTION 'TRANSFER_TICKET_EXPIRED';
  END IF;

  IF v_ticket.target_user_id IS NOT NULL AND v_ticket.target_user_id <> p_target_user_id THEN
    RAISE EXCEPTION 'TRANSFER_TARGET_MISMATCH';
  END IF;

  SELECT is_anonymous
    INTO v_source_is_anonymous
    FROM auth.users
   WHERE id = v_ticket.source_user_id;

  SELECT is_anonymous
    INTO v_target_is_anonymous
    FROM auth.users
   WHERE id = p_target_user_id;

  IF v_source_is_anonymous IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'TRANSFER_SOURCE_NOT_ANONYMOUS';
  END IF;
  IF v_target_is_anonymous IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'TRANSFER_TARGET_NOT_PERMANENT';
  END IF;
  IF v_ticket.source_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'TRANSFER_IDENTICAL_USERS';
  END IF;

  -- Bind the ticket to its first verified permanent account before touching
  -- user data. The row lock makes concurrent claims deterministic.
  UPDATE public.anonymous_account_transfer_tickets
     SET target_user_id = p_target_user_id,
         claimed_at = COALESCE(claimed_at, now())
   WHERE token_hash = p_token_hash;

  -- These are the durable artifacts reachable from the logged-out voyage.
  -- IDs are globally unique per artifact, so changing user_id preserves every
  -- project/session relationship without cloning or re-keying records.
  UPDATE public.projects SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('projects', v_count);

  UPDATE public.progressive_sessions SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('progressive_sessions', v_count);

  UPDATE public.human_agent_messages SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('human_agent_messages', v_count);

  UPDATE public.personas SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('personas', v_count);

  UPDATE public.reframe_items SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('reframe_items', v_count);

  UPDATE public.recast_items SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('recast_items', v_count);

  UPDATE public.synthesize_items SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('synthesize_items', v_count);

  UPDATE public.feedback_records SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('feedback_records', v_count);

  UPDATE public.judgment_records SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('judgment_records', v_count);

  UPDATE public.accuracy_ratings SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('accuracy_ratings', v_count);

  UPDATE public.quality_signals SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('quality_signals', v_count);

  UPDATE public.outcome_records SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('outcome_records', v_count);

  UPDATE public.retrospective_answers SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('retrospective_answers', v_count);

  UPDATE public.decision_quality_scores SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('decision_quality_scores', v_count);

  UPDATE public.decision_items SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('decision_items', v_count);

  UPDATE public.review_receipts SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('review_receipts', v_count);

  UPDATE public.agent_activities SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('agent_activities', v_count);

  UPDATE public.anonymous_account_transfer_tickets
     SET consumed_at = now()
   WHERE token_hash = p_token_hash;

  RETURN jsonb_build_object('ok', true, 'already_consumed', false, 'counts', v_counts);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_anonymous_account_transfer(text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_account_transfer(text, uuid)
  TO service_role;
