-- Backend audit: user_events INSERT policy was WITH CHECK (true) → any anon caller
-- could POST events attributed to an ARBITRARY user_id (attribution forgery /
-- write amplification). Scope it: anon may only insert user_id IS NULL; an
-- authenticated caller only their own uid. This matches exactly how analytics.ts
-- writes (shared session client → auth.uid()=own id when logged in, null when anon),
-- so legitimate analytics is unaffected. Verified: forged user_id → 401, anon null → 201.
-- Applied to remote 2026-06-19.
DROP POLICY IF EXISTS "Anyone can insert events" ON public.user_events;
CREATE POLICY "Insert own or anon events" ON public.user_events
  FOR INSERT TO public
  WITH CHECK (user_id IS NULL OR user_id = (select auth.uid()));
