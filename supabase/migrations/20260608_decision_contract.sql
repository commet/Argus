-- Decision Contract (§0 KICK) — the falsifiable closed loop.
--
-- A finished voyage is sealed into 3–6 falsifiable predictions, each with a
-- stable id; the user picks a check-in date and later grades each one. Stored
-- embedded on the project so it rides existing project sync and deletes
-- cleanly. Additive + nullable → safe on existing rows.
--
-- Applied to remote on 2026-06-08; committed here so fresh provisions, CI, and
-- `supabase db reset` get the column (otherwise projects upserts fail silently
-- with "column does not exist").

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS decision_contract jsonb;
