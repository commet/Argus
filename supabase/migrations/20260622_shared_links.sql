-- Public read-only share pages (/d/:token). A snapshot of the deliverable at
-- share time, openable by anyone with the link (no account). Revoke = delete row
-- → the page 404s. Public reads happen server-side via the service role; the
-- owner lists/revokes their own links via RLS. Server-only table (not in db.ts
-- sync union), so it doesn't touch persistence-contract / schema-drift guards.
CREATE TABLE IF NOT EXISTS public.shared_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text,
  content     text NOT NULL,
  context     text,
  view_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own shared_links"
  ON public.shared_links FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own shared_links"
  ON public.shared_links FOR DELETE USING ((select auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS shared_links_user_idx ON public.shared_links (user_id, created_at DESC);
