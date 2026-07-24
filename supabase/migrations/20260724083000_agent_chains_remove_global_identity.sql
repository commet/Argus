-- agent_chains already has PRIMARY KEY (id, user_id), but production retained
-- a later UNIQUE (id) constraint named agent_chains_id_unique. Because built-in
-- chains intentionally reuse semantic IDs ("research", "strategy") for every
-- account, that redundant global constraint made the second user's valid
-- insert fail with 409 even when PostgREST used on_conflict=id,user_id.
--
-- The composite primary key continues to enforce uniqueness within each user.

ALTER TABLE public.agent_chains
  DROP CONSTRAINT IF EXISTS agent_chains_id_unique;
