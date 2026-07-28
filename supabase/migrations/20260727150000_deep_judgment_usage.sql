-- One platform-funded deep-judgment loop per rolling 24 hours.
-- BYOK runs never call this reservation path: the user pays their provider.

CREATE TABLE IF NOT EXISTS public.deep_judgment_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL CHECK (char_length(session_id) BETWEEN 1 AND 128),
  reserved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anon_deep_judgment_usage (
  principal_hash text PRIMARY KEY CHECK (char_length(principal_hash) = 64),
  session_id text NOT NULL CHECK (char_length(session_id) BETWEEN 1 AND 128),
  reserved_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deep_judgment_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anon_deep_judgment_usage ENABLE ROW LEVEL SECURITY;

-- No browser policy: only the server-side service role may reserve/read this
-- abuse-control state. Account export/deletion uses that same trusted role.
REVOKE ALL ON public.deep_judgment_usage FROM anon, authenticated;
REVOKE ALL ON public.anon_deep_judgment_usage FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_deep_judgment(
  p_user_id uuid,
  p_principal_hash text,
  p_session_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.deep_judgment_usage%ROWTYPE;
  v_anon public.anon_deep_judgment_usage%ROWTYPE;
BEGIN
  IF p_session_id IS NULL OR char_length(p_session_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'INVALID_SESSION_ID';
  END IF;
  IF p_principal_hash IS NULL OR char_length(p_principal_hash) <> 64 THEN
    RAISE EXCEPTION 'INVALID_PRINCIPAL_HASH';
  END IF;

  -- Serialize every reservation sharing this account or network identity. The
  -- row locks alone cannot protect a first insert when no row exists yet.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    coalesce(p_user_id::text, '') || ':' || p_principal_hash,
    0
  ));

  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_user
      FROM public.deep_judgment_usage
      WHERE user_id = p_user_id
      FOR UPDATE;
    IF FOUND AND v_user.session_id = p_session_id THEN
      RETURN 'resumed';
    END IF;
    IF FOUND AND v_user.reserved_at > now() - interval '24 hours' THEN
      RETURN 'daily_used';
    END IF;
  END IF;

  SELECT * INTO v_anon
    FROM public.anon_deep_judgment_usage
    WHERE principal_hash = p_principal_hash
    FOR UPDATE;
  IF FOUND AND v_anon.session_id = p_session_id THEN
    -- If the same anonymous session signed in, attach the account row too.
    IF p_user_id IS NOT NULL THEN
      INSERT INTO public.deep_judgment_usage(user_id, session_id, reserved_at)
      VALUES (p_user_id, p_session_id, v_anon.reserved_at)
      ON CONFLICT (user_id) DO UPDATE
        SET session_id = EXCLUDED.session_id, reserved_at = EXCLUDED.reserved_at;
    END IF;
    RETURN 'resumed';
  END IF;
  IF FOUND AND v_anon.reserved_at > now() - interval '24 hours' THEN
    RETURN 'daily_used';
  END IF;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.deep_judgment_usage(user_id, session_id, reserved_at)
    VALUES (p_user_id, p_session_id, now())
    ON CONFLICT (user_id) DO UPDATE
      SET session_id = EXCLUDED.session_id, reserved_at = EXCLUDED.reserved_at;
  END IF;

  INSERT INTO public.anon_deep_judgment_usage(principal_hash, session_id, reserved_at)
  VALUES (p_principal_hash, p_session_id, now())
  ON CONFLICT (principal_hash) DO UPDATE
    SET session_id = EXCLUDED.session_id, reserved_at = EXCLUDED.reserved_at;

  RETURN 'granted';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_deep_judgment(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_deep_judgment(uuid, text, text) TO service_role;

