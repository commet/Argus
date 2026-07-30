-- Incident 2026-07-30 21:40 UTC: 20260731170000_operational_io_and_rpc_hardening
-- revoked EXECUTE on the rate-limit RPCs from the roles that actually call them.
-- /api/llm, /api/search and /api/boss/saju invoke these through ANON-key
-- clients (role anon, or authenticated when the user JWT is forwarded) — NOT
-- service_role. The revoke made every call fail with permission denied, and the
-- fail-closed error handler returned 429 quota exhausted to every user.
-- The in-function guard stays the real defense: check_and_increment_rate_limit
-- rejects when auth.uid() is null or differs from p_user_id.

GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid, integer)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.check_anon_rate_limit(text, integer)
  TO anon, authenticated;
