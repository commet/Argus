-- Carry the canonical judgment ledger across the anonymous → account transfer.
--
-- `claim_anonymous_account_transfer` moved 17 tables but not
-- `project_semantic_events`, and that is the one table with NO localStorage
-- mirror: every other transferred artifact is re-synced from the browser after
-- signup, so the RPC's real job is precisely the server-only rows. A logged-out
-- visitor CAN seal (the seal route authenticates any Supabase user, anonymous
-- included), so the sequence "review a document → seal a judgment → create an
-- account" moved the project and left its sealed judgment behind, unreachable.
--
-- DELIBERATE EXCLUSIONS (declared, not forgotten — see
-- src/lib/__tests__/anonymous-account-transfer-contract.test.ts):
--   * agents / agent_chains — keyed (id, user_id) with STABLE semantic ids
--     ('hayoon', 'research'). Moving them collides whenever the target account
--     already has its own default set, and a unique violation would roll back the
--     WHOLE transfer, losing everything else. They are re-seeded from defaults.
--   * plugin_* / telegram_* / team_* / slack_connections — require an account-bound
--     token or membership; an anonymous browser session can never own a row.
--   * epistemic_artifact_descriptors — its object bytes live under a `${user_id}/`
--     storage prefix. Moving the descriptor without moving the object would break
--     the locator/owner invariant that account deletion relies on.
--   * user_events / rate_limits / *_usage — infrastructure counters, not the
--     user's work.

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

  -- The canonical judgment ledger. This is the ONE artifact that lives only on
  -- the server: `decision_contract` is mirrored in localStorage and survives a
  -- signup by itself, but `project_semantic_events` has no local copy, and its
  -- reads are `.eq('user_id', …)`. So an anonymous user who sealed a judgment kept
  -- the project (it transfers) and lost the sealed record inside it — at the exact
  -- moment they created an account. Must run AFTER projects, whose FK it depends
  -- on. (2026-07-29)
  UPDATE public.project_semantic_events SET user_id = p_target_user_id WHERE user_id = v_ticket.source_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('project_semantic_events', v_count);

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
