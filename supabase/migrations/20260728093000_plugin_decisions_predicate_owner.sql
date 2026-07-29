-- Honest provenance across the MCP↔web bridge (BLUEPRINT §5).
--
-- The plugin has always known whether a sealed line was the user's own words or
-- an Argus draft the user never confirmed (`predicate_owner` on argus_seal). The
-- ingest bridge dropped that field: `PluginDecision` had no column for it, so an
-- `ai_surfaced` draft landed in the webapp looking exactly like a prediction the
-- user dictated. That is the authorship invariant (CLAUDE.md, zero-judgment
-- spine rule 1) failing silently at a surface boundary.
--
-- NULL is meaningful and must stay: ledgers written before the seal event
-- carried this field are genuinely unknown, and readers must render them as
-- unknown rather than defaulting them to 'user'. No default, no backfill.

ALTER TABLE public.plugin_decisions
  ADD COLUMN IF NOT EXISTS predicate_owner text;

ALTER TABLE public.plugin_decisions
  DROP CONSTRAINT IF EXISTS plugin_decisions_predicate_owner_check;

ALTER TABLE public.plugin_decisions
  ADD CONSTRAINT plugin_decisions_predicate_owner_check
  CHECK (predicate_owner IS NULL OR predicate_owner IN ('user', 'ai_surfaced'));

COMMENT ON COLUMN public.plugin_decisions.predicate_owner IS
  'Provenance of the sealed predicate from the plugin ledger seal event: user | ai_surfaced. NULL = unknown (pre-2026-07 ledger); never render NULL as user-authored.';
