-- JCR follow-up (advisor finding): the erased-subject guard is a TRIGGER
-- function and must not be executable via /rest/v1/rpc. Every other JCR
-- function already carries this revoke; this one was missed.
REVOKE ALL ON FUNCTION public.prevent_erased_epistemic_subject_resurrection()
  FROM PUBLIC, anon, authenticated;
