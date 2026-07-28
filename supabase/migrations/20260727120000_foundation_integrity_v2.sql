-- Foundation persistence hardening.
--
-- Historic jsonb contracts remain readable. Contracts sealed by the current
-- writer carry integrity_version=2, which lets the database reject two forms
-- of silent provenance loss even if a caller bypasses the application:
--   1. AI-authored material without an exact adoption receipt.
--   2. A settlement without the user's verbatim present-standard response.
--   3. A settlement without the authorizing user-action receipt.

CREATE OR REPLACE FUNCTION public._argus_foundation_integrity_v2_valid(contract jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  item jsonb;
  matched boolean;
  settlement_baseline integer;
BEGIN
  IF contract->>'integrity_version' IS DISTINCT FROM '2' THEN
    RETURN true;
  END IF;

  IF jsonb_typeof(contract->'integrity_baseline') IS DISTINCT FROM 'object'
     OR jsonb_typeof(contract #> '{integrity_baseline,settlement_count}') IS DISTINCT FROM 'number'
     OR contract #>> '{integrity_baseline,settlement_count}' !~ '^[0-9]+$'
     OR nullif(btrim(contract->>'origin_utterance'), '') IS NULL
     OR nullif(btrim(contract->>'sealed_statement'), '') IS NULL
  THEN
    RETURN false;
  END IF;
  settlement_baseline := (contract #>> '{integrity_baseline,settlement_count}')::integer;

  IF jsonb_typeof(contract->'predicates') IS DISTINCT FROM 'array' THEN
    RETURN false;
  END IF;
  IF EXISTS (
       SELECT 1
         FROM jsonb_array_elements(contract->'predicates') AS predicate
        WHERE predicate->>'authored' = 'ai_surfaced'
           OR predicate #>> '{attribution,wording_source}' = 'ai_surfaced'
     )
     AND jsonb_typeof(contract->'adoption_lineage') IS DISTINCT FROM 'array'
  THEN
    RETURN false;
  END IF;

  FOR item IN
    SELECT value FROM jsonb_array_elements(contract->'predicates')
  LOOP
    IF item->>'authored' = 'ai_surfaced'
       OR item #>> '{attribution,wording_source}' = 'ai_surfaced'
    THEN
      IF nullif(btrim(item->>'id'), '') IS NULL THEN
        RETURN false;
      END IF;
      SELECT EXISTS (
        SELECT 1
          FROM jsonb_array_elements(contract->'adoption_lineage') AS lineage
         WHERE lineage->>'source_proposal_ref' = item->>'id'
           AND lineage->>'adopted_as' IN ('basis', 'check', 'wording')
      ) INTO matched;
      IF NOT matched THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;

  IF contract ? 'open_checks' THEN
    IF jsonb_typeof(contract->'open_checks') IS DISTINCT FROM 'array'
    THEN
      RETURN false;
    END IF;
    IF jsonb_array_length(contract->'open_checks') > 0
       AND jsonb_typeof(contract->'adoption_lineage') IS DISTINCT FROM 'array'
    THEN
      RETURN false;
    END IF;
    FOR item IN
      SELECT value FROM jsonb_array_elements(contract->'open_checks')
    LOOP
      IF nullif(btrim(item->>'id'), '') IS NULL THEN
        RETURN false;
      END IF;
      SELECT EXISTS (
        SELECT 1
          FROM jsonb_array_elements(contract->'adoption_lineage') AS lineage
         WHERE lineage->>'source_proposal_ref' = item->>'id'
           AND lineage->>'adopted_as' = 'check'
      ) INTO matched;
      IF NOT matched THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;

  IF contract ? 'adoption_lineage' THEN
    IF jsonb_typeof(contract->'adoption_lineage') IS DISTINCT FROM 'array' THEN
      RETURN false;
    END IF;
    FOR item IN
      SELECT value FROM jsonb_array_elements(contract->'adoption_lineage')
    LOOP
      IF nullif(btrim(item->>'source_proposal_ref'), '') IS NULL
         OR item->>'adopted_as' NOT IN ('basis', 'check', 'wording')
      THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;

  IF contract ? 'settlements' THEN
    IF jsonb_typeof(contract->'settlements') IS DISTINCT FROM 'array' THEN
      RETURN false;
    END IF;
    IF settlement_baseline > jsonb_array_length(contract->'settlements') THEN
      RETURN false;
    END IF;
    FOR item IN
      SELECT value
        FROM jsonb_array_elements(contract->'settlements') WITH ORDINALITY AS entry(value, position)
       WHERE position > settlement_baseline
    LOOP
      IF jsonb_typeof(item->'present_standard') IS DISTINCT FROM 'object'
         OR nullif(btrim(item #>> '{present_standard,response_text}'), '') IS NULL
         OR jsonb_typeof(item->'authorization') IS DISTINCT FROM 'object'
         OR item #>> '{authorization,authorized_by}' <> 'human'
         OR item #>> '{authorization,authorization_mode}'
              NOT IN ('explicit_confirmation', 'direct_command')
         OR item #>> '{authorization,surface}'
              NOT IN ('web', 'telegram', 'plugin', 'mcp')
         OR nullif(btrim(item #>> '{authorization,authorization_ref}'), '') IS NULL
         OR nullif(btrim(item #>> '{authorization,authorized_at}'), '') IS NULL
      THEN
        RETURN false;
      END IF;
    END LOOP;
    IF EXISTS (
      SELECT 1
        FROM jsonb_array_elements(contract->'settlements') WITH ORDINALITY AS entry(value, position)
       WHERE position > settlement_baseline
       GROUP BY value #>> '{authorization,authorization_ref}'
      HAVING count(*) > 1
    ) THEN
      RETURN false;
    END IF;
  ELSIF settlement_baseline <> 0 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public._argus_foundation_integrity_v2_valid(jsonb) FROM PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'projects_decision_contract_integrity_v2'
       AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_decision_contract_integrity_v2
      CHECK (
        decision_contract IS NULL
        OR public._argus_foundation_integrity_v2_valid(decision_contract)
      ) NOT VALID;
  END IF;
END
$$;

COMMENT ON CONSTRAINT projects_decision_contract_integrity_v2 ON public.projects IS
  'Foundation v2 contracts preserve exact AI-adoption lineage and the user present-standard response.';

-- A check constraint can validate one value but cannot compare it with the
-- previous row. This helper and trigger protect the append-only parts of the
-- contract from a stale full-row upsert.
CREATE OR REPLACE FUNCTION public._argus_jsonb_array_is_prefix(earlier jsonb, later jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN earlier IS NULL THEN true
    WHEN jsonb_typeof(earlier) IS DISTINCT FROM 'array'
      OR jsonb_typeof(later) IS DISTINCT FROM 'array' THEN false
    WHEN jsonb_array_length(earlier) > jsonb_array_length(later) THEN false
    ELSE NOT EXISTS (
      SELECT 1
        FROM generate_series(0, jsonb_array_length(earlier) - 1) AS position
       WHERE earlier->position IS DISTINCT FROM later->position
    )
  END;
$$;

REVOKE ALL ON FUNCTION public._argus_jsonb_array_is_prefix(jsonb, jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._argus_guard_foundation_v2_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  key text;
  latest_correction jsonb;
  old_settlement_count integer;
BEGIN
  IF OLD.decision_contract->>'integrity_version' IS DISTINCT FROM '2' THEN
    IF NEW.decision_contract->>'integrity_version' IS DISTINCT FROM '2' THEN
      RETURN NEW;
    END IF;
    old_settlement_count := CASE
      WHEN jsonb_typeof(OLD.decision_contract->'settlements') = 'array'
        THEN jsonb_array_length(OLD.decision_contract->'settlements')
      ELSE 0
    END;
    IF NEW.decision_contract #>> '{integrity_baseline,settlement_count}'
         IS DISTINCT FROM old_settlement_count::text
    THEN
      RAISE EXCEPTION 'ARGUS_FOUNDATION_INVALID_UPGRADE_BASELINE'
        USING ERRCODE = '23514';
    END IF;
    FOREACH key IN ARRAY ARRAY[
      'adoption_lineage',
      'history',
      'kind_corrections',
      'statement_revisions',
      'settlements'
    ]
    LOOP
      IF NOT public._argus_jsonb_array_is_prefix(
        OLD.decision_contract->key,
        NEW.decision_contract->key
      ) THEN
        RAISE EXCEPTION 'ARGUS_FOUNDATION_HISTORY_REWRITTEN:%', key
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.decision_contract->>'integrity_version' IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'ARGUS_FOUNDATION_VERSION_DOWNGRADE'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.decision_contract->'integrity_baseline'
       IS DISTINCT FROM NEW.decision_contract->'integrity_baseline'
  THEN
    RAISE EXCEPTION 'ARGUS_FOUNDATION_BASELINE_CHANGED'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.decision_contract->'created_at' IS DISTINCT FROM NEW.decision_contract->'created_at'
     OR OLD.decision_contract->'origin_utterance' IS DISTINCT FROM NEW.decision_contract->'origin_utterance'
     OR OLD.decision_contract->'sealed_statement' IS DISTINCT FROM NEW.decision_contract->'sealed_statement'
     OR OLD.decision_contract #> '{judgment_receipt,human_judgment}'
          IS DISTINCT FROM NEW.decision_contract #> '{judgment_receipt,human_judgment}'
     OR OLD.decision_contract #> '{judgment_receipt,baseline_judgment}'
          IS DISTINCT FROM NEW.decision_contract #> '{judgment_receipt,baseline_judgment}'
     OR OLD.decision_contract #> '{judgment_receipt,judgment_attribution}'
          IS DISTINCT FROM NEW.decision_contract #> '{judgment_receipt,judgment_attribution}'
     OR OLD.decision_contract #> '{judgment_receipt,real_question}'
          IS DISTINCT FROM NEW.decision_contract #> '{judgment_receipt,real_question}'
     OR OLD.decision_contract #> '{judgment_receipt,unverified_assumption}'
          IS DISTINCT FROM NEW.decision_contract #> '{judgment_receipt,unverified_assumption}'
     OR OLD.decision_contract #> '{judgment_receipt,human_only}'
          IS DISTINCT FROM NEW.decision_contract #> '{judgment_receipt,human_only}'
  THEN
    RAISE EXCEPTION 'ARGUS_FOUNDATION_SEALED_SOURCE_CHANGED'
      USING ERRCODE = '23514';
  END IF;

  FOREACH key IN ARRAY ARRAY[
    'adoption_lineage',
    'history',
    'kind_corrections',
    'statement_revisions',
    'settlements'
  ]
  LOOP
    IF NOT public._argus_jsonb_array_is_prefix(
      OLD.decision_contract->key,
      NEW.decision_contract->key
    ) THEN
      RAISE EXCEPTION 'ARGUS_FOUNDATION_HISTORY_REWRITTEN:%', key
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  IF OLD.decision_contract->'kind' IS DISTINCT FROM NEW.decision_contract->'kind' THEN
    IF jsonb_typeof(NEW.decision_contract->'kind_corrections') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'ARGUS_FOUNDATION_KIND_CHANGED_WITHOUT_CORRECTION'
        USING ERRCODE = '23514';
    END IF;
    latest_correction := NEW.decision_contract->'kind_corrections'->-1;
    IF jsonb_array_length(coalesce(NEW.decision_contract->'kind_corrections', '[]'::jsonb))
         <> jsonb_array_length(coalesce(OLD.decision_contract->'kind_corrections', '[]'::jsonb)) + 1
       OR latest_correction->'from_kind' IS DISTINCT FROM OLD.decision_contract->'kind'
       OR latest_correction->'to_kind' IS DISTINCT FROM NEW.decision_contract->'kind'
    THEN
      RAISE EXCEPTION 'ARGUS_FOUNDATION_KIND_CHANGED_WITHOUT_CORRECTION'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._argus_guard_foundation_v2_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS projects_guard_foundation_v2_update ON public.projects;
CREATE TRIGGER projects_guard_foundation_v2_update
BEFORE UPDATE OF decision_contract ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public._argus_guard_foundation_v2_update();

CREATE OR REPLACE FUNCTION public._argus_guard_foundation_v2_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.decision_contract->>'integrity_version' = '2'
     AND NEW.decision_contract #>> '{integrity_baseline,settlement_count}' IS DISTINCT FROM '0'
  THEN
    RAISE EXCEPTION 'ARGUS_FOUNDATION_INVALID_INSERT_BASELINE'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._argus_guard_foundation_v2_insert() FROM PUBLIC;

DROP TRIGGER IF EXISTS projects_guard_foundation_v2_insert ON public.projects;
CREATE TRIGGER projects_guard_foundation_v2_insert
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public._argus_guard_foundation_v2_insert();
