# ADR — P6 web canonical ledger and command gateway

Date: 2026-07-14
Status: Accepted (deployment migration pending)

## Decision

For a web project, `account-project:<projects.id>` is one semantic space.
`public.project_semantic_events` is its canonical append-only event ledger.
`projects.decision_contract` remains a legacy/read-model projection and may
only carry `semantic_judgment_id` as a pointer; it is never the v3 source of
truth.

The web client writes only through
`POST /api/semantic/projects/:projectId/events`. The route authenticates the
account, translates a named web command through the built MCP v3 kernel,
preflights it with that same reducer, then uses the locked Postgres RPC
`append_project_semantic_events` to append the entire command batch.

## Consequences

- Concurrent commands are retained, not last-write-wins. A resulting illegal
  semantic transition becomes a visible reducer conflict instead of silently
  deleting a prior authorial act.
- A web seal and a Telegram answer+observation use atomic batches. Resolution
  and closure remain separate commands.
- The event table is included in account export and deletion coverage.
- Root build/dev/test first builds `argus-mcp`; the web consumes its compiled
  v3 reducer, so it cannot fork semantic behavior by copying it.
- Before release, apply migration
  `20260714_project_semantic_events.sql`. Until it is applied, the gateway
  honestly returns a storage error rather than falling back to mutable JSONB.

## Rejected alternative

Appending `semantic_events` inside `decision_contract` was rejected. Existing
local-first project upserts merge by timestamp and can silently overwrite a
concurrent JSONB change; that is incompatible with a judgment ledger.
