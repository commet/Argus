-- Built-in agents use the same stable semantic IDs on every account
-- ("hayoon", "research_director", ...). The original global agents(id)
-- primary key made the second account's insert conflict with the first
-- account's invisible RLS row, producing a 403 and silently losing XP,
-- observations, and chat history sync.
--
-- agent_chains was created correctly with PRIMARY KEY (id, user_id).
-- Bring agents to the same user-scoped identity model. Existing rows remain
-- unique because the old primary key was stricter than the new one.

BEGIN;

ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_pkey;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_pkey PRIMARY KEY (id, user_id);

-- A temporary compatibility constraint may exist when production is migrated
-- in two phases (new client first, primary-key relaxation second). The primary
-- key now enforces the same uniqueness, so remove the duplicate index.
ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_user_scoped_identity_compat;

COMMIT;
