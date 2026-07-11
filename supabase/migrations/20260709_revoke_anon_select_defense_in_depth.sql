-- Defense-in-depth (2026-07-09): revoke the anon (unauthenticated) role's
-- table-level SELECT on all public tables.
--
-- WHY THIS IS SAFE (zero functional change):
--   Every RLS SELECT policy in this schema gates rows by `auth.uid() = user_id`,
--   `auth.role() = 'service_role'`, or team-membership functions (is_team_member /
--   can_access_project). All of these return ZERO rows when auth.uid() is NULL —
--   i.e. for the anon role. So anon already reads nothing via PostgREST.
--   Public share pages (/d/[token]) read `shared_links` through the service-role
--   adminClient server-side, never via an anon client read.
--
-- WHAT THIS BUYS:
--   Anon is now blocked at the PRIVILEGE layer, before RLS is evaluated. If a
--   future RLS SELECT policy is ever mis-written (e.g. `USING (true)`), it can no
--   longer be exploited into a full anonymous data dump — the missing table grant
--   stops it first. This turns "one bad policy = full leak" into "= nothing".
--
-- SCOPE:
--   SELECT only. anon's INSERT/UPDATE/DELETE grants are intentionally left in
--   place (logged-out telemetry / trial write paths may use them; write policies
--   are separately gated by WITH CHECK). Grants are held explicitly per-role, so
--   `authenticated` and `service_role` keep their SELECT and no app path changes.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;

-- Durable for tables created later by the migration/owner role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;
