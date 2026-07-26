-- Fable5 foundations, Phase 0.
--
-- The web contract remains one jsonb column during the frozen compatibility
-- period. This constraint validates every new foundation-shaped write without
-- rejecting historic contracts that predate the kind/settlement model.

-- kind_evidence.recorded_at is derived from the command recording clock. An
-- exact retry receives a fresh clock and must remain a duplicate, not an
-- idempotency conflict. Keep this fingerprint aligned with the v3 reducer and
-- dogfood Supabase emulator.
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
            - 'authority'
            - 'kind_evidence')
       || jsonb_build_object(
            'time', jsonb_build_object('temporal_mode', e #> '{time,temporal_mode}'),
            'authority', coalesce(e -> 'authority', '{}'::jsonb) - 'recorded_by'
          )
       || CASE
            WHEN jsonb_typeof(e -> 'kind_evidence') = 'object'
              THEN jsonb_build_object('kind_evidence', (e -> 'kind_evidence') - 'recorded_at')
            ELSE '{}'::jsonb
          END;
$$;

REVOKE ALL ON FUNCTION public._argus_semantic_idem_fingerprint(jsonb) FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'projects_decision_contract_foundation_shape'
       AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_decision_contract_foundation_shape
      CHECK (
        decision_contract IS NULL
        OR NOT (decision_contract ? 'kind')
        OR (
          decision_contract->>'kind' IN ('prediction', 'commitment', 'declaration', 'witness')
          AND jsonb_typeof(decision_contract->'kind_evidence') = 'object'
          AND jsonb_typeof(decision_contract->'origin_utterance') = 'string'
          AND decision_contract->>'review_condition_status' IN ('answered', 'skipped', 'not_asked')
          AND (
            NOT (decision_contract ? 'review_condition')
            OR jsonb_typeof(decision_contract->'review_condition') = 'string'
          )
          AND (
            NOT (decision_contract ? 'return_event')
            OR jsonb_typeof(decision_contract->'return_event') = 'string'
          )
          AND (
            NOT (decision_contract ? 'adoption_lineage')
            OR jsonb_typeof(decision_contract->'adoption_lineage') = 'array'
          )
          AND (
            NOT (decision_contract ? 'settlements')
            OR jsonb_typeof(decision_contract->'settlements') = 'array'
          )
          AND NOT (
            decision_contract ?| ARRAY[
              'score',
              'accuracy_score',
              'hit_rate',
              'win_rate',
              'overall_dq'
            ]
          )
          AND (
            decision_contract->>'kind' <> 'witness'
            OR (
              NOT (decision_contract ? 'check_in_at')
              AND NOT (decision_contract ? 'check_in_interval')
              AND NOT (decision_contract ? 'primary_checkpoint')
              AND NOT (decision_contract ? 'return_event')
            )
          )
        )
      ) NOT VALID;
  END IF;
END
$$;

COMMENT ON CONSTRAINT projects_decision_contract_foundation_shape ON public.projects IS
  'New foundation contracts carry explicit kind/evidence/original/review status, never a human-judgment score; witness records carry no return.';
