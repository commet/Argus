-- Complete the human-team collaboration surface.
--
-- The web UI and Zustand store referenced these four tables for months, but
-- their schema was never checked into migrations and projects.team_id was not
-- connected to readable project/session data for teammates. This migration is
-- intentionally additive for existing deployments and complete for fresh ones.

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  slug text UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_review_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'rehearse' CHECK (phase IN ('reframe', 'recast', 'rehearse')),
  target_type text NOT NULL DEFAULT 'general' CHECK (target_type IN ('assumption', 'step', 'risk', 'direction', 'general')),
  target_id text,
  input_type text NOT NULL CHECK (input_type IN ('rating', 'concern', 'endorsement', 'alternative')),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 2000),
  visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS team_id text;

CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_team ON public.team_members(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_role ON public.team_members(team_id, role);
CREATE INDEX IF NOT EXISTS idx_team_invites_email_status ON public.team_invites(lower(email), status);
CREATE INDEX IF NOT EXISTS idx_team_invites_team_status ON public.team_invites(team_id, status);
WITH duplicate_pending AS (
  SELECT id, row_number() OVER (
    PARTITION BY team_id, lower(email)
    ORDER BY created_at DESC, id DESC
  ) AS duplicate_rank
  FROM public.team_invites
  WHERE status = 'pending'
)
UPDATE public.team_invites
SET status = 'declined'
WHERE id IN (SELECT id FROM duplicate_pending WHERE duplicate_rank > 1);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invites_one_pending
  ON public.team_invites(team_id, lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_review_project_visible ON public.team_review_inputs(project_id, visible, created_at);
CREATE INDEX IF NOT EXISTS idx_projects_team_updated ON public.projects(team_id, updated_at DESC) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_progressive_sessions_project ON public.progressive_sessions(project_id, updated_at DESC);

-- Helper functions avoid recursive team_members RLS checks.
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_team(p_team_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_text_team(p_team_id text, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id::text = p_team_id
      AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_text_team_member(p_team_id text, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id::text = p_team_id AND user_id = p_user_id
  );
$$;

-- Team + owner membership is one transaction. The API calls this with the
-- service role so a membership failure can never leave an ownerless team.
CREATE OR REPLACE FUNCTION public.create_team_with_owner(
  p_name text,
  p_slug text,
  p_owner_id uuid
)
RETURNS SETOF public.teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_team public.teams%ROWTYPE;
BEGIN
  INSERT INTO public.teams (name, slug, owner_id)
  VALUES (p_name, p_slug, p_owner_id)
  RETURNING * INTO created_team;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (created_team.id, p_owner_id, 'owner');

  RETURN NEXT created_team;
END;
$$;

REVOKE ALL ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_team(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_text_team(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_text_team_member(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_team_with_owner(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_team(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_text_team(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_text_team_member(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_team_with_owner(text, text, uuid) TO service_role;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_review_inputs ENABLE ROW LEVEL SECURITY;

-- These tables are owned only by the team feature. Replace any dashboard-era
-- permissive policies with one audited policy set. The projects/session tables
-- keep their existing own-user policies and receive an additional team read.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('teams', 'team_members', 'team_invites', 'team_review_inputs')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY team_select_member ON public.teams
  FOR SELECT TO authenticated
  USING (public.is_team_member(id));
CREATE POLICY team_insert_owner ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY team_update_owner ON public.teams
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY team_delete_owner ON public.teams
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY team_members_select_member ON public.team_members
  FOR SELECT TO authenticated
  USING (public.is_team_member(team_id));
CREATE POLICY team_members_insert_manager_or_invitee ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_team(team_id)
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.team_invites i
        WHERE i.team_id = team_members.team_id
          AND lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          AND i.status = 'pending'
      )
    )
    OR (
      user_id = auth.uid()
      AND role = 'owner'
      AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.owner_id = auth.uid())
    )
  );
CREATE POLICY team_members_delete_manager ON public.team_members
  FOR DELETE TO authenticated
  USING (public.can_manage_team(team_id) AND role <> 'owner');

CREATE POLICY team_invites_select_manager_or_target ON public.team_invites
  FOR SELECT TO authenticated
  USING (public.can_manage_team(team_id) OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
CREATE POLICY team_invites_insert_manager ON public.team_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team(team_id) AND invited_by = auth.uid());
CREATE POLICY team_invites_update_manager_or_target ON public.team_invites
  FOR UPDATE TO authenticated
  USING (public.can_manage_team(team_id) OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (public.can_manage_team(team_id) OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY team_reviews_select_allowed ON public.team_review_inputs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = team_review_inputs.project_id
        AND p.team_id IS NOT NULL
        AND public.is_text_team_member(p.team_id)
    )
    AND (user_id = auth.uid() OR visible)
  );
CREATE POLICY team_reviews_insert_member ON public.team_review_inputs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = team_review_inputs.project_id
        AND p.team_id IS NOT NULL
        AND public.is_text_team_member(p.team_id)
    )
  );
CREATE POLICY team_reviews_update_owner_or_manager ON public.team_review_inputs
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND NOT visible)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = team_review_inputs.project_id
        AND p.team_id IS NOT NULL
        AND public.can_manage_text_team(p.team_id)
    )
  );

DROP POLICY IF EXISTS team_shared_projects_select ON public.projects;
CREATE POLICY team_shared_projects_select ON public.projects
  FOR SELECT TO authenticated
  USING (team_id IS NOT NULL AND public.is_text_team_member(team_id));

DROP POLICY IF EXISTS team_shared_sessions_select ON public.progressive_sessions;
CREATE POLICY team_shared_sessions_select ON public.progressive_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = progressive_sessions.project_id
        AND p.team_id IS NOT NULL
        AND public.is_text_team_member(p.team_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.team_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.team_review_inputs TO authenticated;
