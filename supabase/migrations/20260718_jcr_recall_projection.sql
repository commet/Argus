-- JCR J7: rebuildable RecallDocument projection. This is never an authority
-- writer and may be dropped/rebuilt from project + epistemic canonical events.

CREATE TABLE IF NOT EXISTS public.epistemic_recall_documents (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('judgment','claim','grant','observation','checkpoint')),
  project_id text,
  authority text NOT NULL CHECK (authority IN ('user','external','ai_proposal','imported','legacy')),
  lifecycle_status text NOT NULL,
  occurred_at timestamptz NOT NULL,
  projection_version integer NOT NULL CHECK (projection_version > 0),
  document jsonb NOT NULL,
  search_text text NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', search_text)
  ) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, document_id),
  CONSTRAINT epistemic_recall_document_id_matches CHECK (document_id = document->>'document_id'),
  CONSTRAINT epistemic_recall_document_version_matches CHECK (
    projection_version = (document->>'projection_version')::integer
  ),
  CONSTRAINT epistemic_recall_document_project_matches CHECK (
    coalesce(project_id, '') = coalesce(document->>'project_id', '')
  ),
  CONSTRAINT epistemic_recall_document_shape CHECK (
    jsonb_typeof(document->'canonical_refs') = 'array'
    AND jsonb_array_length(document->'canonical_refs') BETWEEN 1 AND 256
    AND length(document->>'title') <= 240
    AND length(document->>'searchable_text') BETWEEN 1 AND 20000
    AND length(search_text) BETWEEN 1 AND 100000
  )
);

CREATE INDEX IF NOT EXISTS idx_epistemic_recall_fts
  ON public.epistemic_recall_documents USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_epistemic_recall_scope
  ON public.epistemic_recall_documents(user_id, project_id, lifecycle_status, occurred_at DESC);

ALTER TABLE public.epistemic_recall_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own recall projection" ON public.epistemic_recall_documents;
CREATE POLICY "Users read own recall projection"
  ON public.epistemic_recall_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.epistemic_recall_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.epistemic_recall_documents TO authenticated;

CREATE TABLE IF NOT EXISTS public.epistemic_recall_projection_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('ready','blocked_unknown','invalid')),
  projection_version integer NOT NULL,
  source_cursor jsonb NOT NULL,
  source_checksum text NOT NULL,
  document_count integer NOT NULL CHECK (document_count >= 0),
  rebuilt_at timestamptz NOT NULL
);
ALTER TABLE public.epistemic_recall_projection_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own recall projection state" ON public.epistemic_recall_projection_state;
CREATE POLICY "Users read own recall projection state"
  ON public.epistemic_recall_projection_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.epistemic_recall_projection_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.epistemic_recall_projection_state TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_epistemic_recall_documents(
  p_user_id uuid,
  p_documents jsonb,
  p_projection_checksum text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb;
  body jsonb;
  inserted_count integer := 0;
BEGIN
  IF jsonb_typeof(p_documents) <> 'array' OR jsonb_array_length(p_documents) > 100000 THEN
    RAISE EXCEPTION 'INVALID_RECALL_BATCH';
  END IF;
  IF coalesce(p_projection_checksum, '') = '' THEN
    RAISE EXCEPTION 'INVALID_RECALL_CHECKSUM';
  END IF;
  DELETE FROM public.epistemic_recall_documents WHERE user_id = p_user_id;
  FOR d IN SELECT value FROM jsonb_array_elements(p_documents)
  LOOP
    body := d->'document';
    IF jsonb_typeof(d) <> 'object'
      OR jsonb_typeof(body) <> 'object'
      OR coalesce(body->>'document_id','') = ''
      OR jsonb_typeof(body->'canonical_refs') <> 'array'
      OR jsonb_array_length(body->'canonical_refs') = 0
      OR coalesce(body->>'searchable_text','') = ''
      OR coalesce(d->>'search_text','') = ''
    THEN
      RAISE EXCEPTION 'INVALID_RECALL_DOCUMENT';
    END IF;
    INSERT INTO public.epistemic_recall_documents (
      user_id, document_id, kind, project_id, authority, lifecycle_status,
      occurred_at, projection_version, document, search_text
    ) VALUES (
      p_user_id,
      body->>'document_id',
      body->>'kind',
      nullif(body->>'project_id',''),
      body->>'authority',
      body->>'lifecycle_status',
      (body->>'occurred_at')::timestamptz,
      (body->>'projection_version')::integer,
      body,
      d->>'search_text'
    );
    inserted_count := inserted_count + 1;
  END LOOP;
  INSERT INTO public.epistemic_recall_projection_state (
    user_id, status, projection_version, source_cursor, source_checksum, document_count, rebuilt_at
  ) VALUES (
    p_user_id, 'ready', 1, jsonb_build_object('documents', inserted_count),
    p_projection_checksum, inserted_count, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = EXCLUDED.status,
    projection_version = EXCLUDED.projection_version,
    source_cursor = EXCLUDED.source_cursor,
    source_checksum = EXCLUDED.source_checksum,
    document_count = EXCLUDED.document_count,
    rebuilt_at = EXCLUDED.rebuilt_at;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_epistemic_recall_documents(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_epistemic_recall_documents(uuid, jsonb, text) TO service_role;
