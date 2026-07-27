# ADR — One user, one logical judgment dataset

Date: 2026-07-27  
Status: Accepted by founder; phased migration in progress  
Boundary: internal storage/sync foundation only. It does not open the O4-gated
recall surface or market a premium feature.

## Decision

Argus has one logical judgment dataset per user, with two legitimate physical
replicas:

- Local-first replica: `.argus/ledger/ledger.jsonl` plus an outbox. This is the
  default for MCP/plugin and remains useful with no account or network.
- Account replica: Supabase append-only events. This is the default for the web
  app and is populated from local only after an explicit account connection.

Neither replica is a second meaning of a premise or decision. They exchange the
same versioned event envelope and merge by event identity. A network failure
leaves an honest pending outbox; it never rolls back a successful local write.
Connecting an account is encouraged after the first local save, not required.
Premise text still requires the existing explicit sync/privacy grant before it
leaves the machine.

“One dataset” does not mean “one giant table.” The append-only event stream is
the source of user-authored acts. Tables optimized for screens, reminders,
search, and compatibility are projections and must not become independent
writers.

## What exists today

The earlier count of four described the most visible premise representations,
not all storage paths:

| Role | Current storage | Target role |
|---|---|---|
| MCP decision + premise events | `.argus/ledger/ledger.jsonl` | local canonical replica |
| Old plugin tracked items | `.argus/items.jsonl` | legacy import only, then retire |
| Web voyage items | `decision_items` | projection |
| Review/MCP synced premises | `review_receipts.data.tracked_premises` | receipt projection |
| Web semantic decisions | `project_semantic_events` | account canonical aggregate |
| Plugin bridge | `plugin_decisions`, `plugin_events`, `plugin_bearings` | compatibility/inbox projections |
| Mutable web workflow | `progressive_sessions`, `projects.decision_contract` | workflow/read models |
| Governed memory | `epistemic_*` | separate authority/recall plane, never a premise writer |

So the answer is: there are more than four persisted representations. The
architectural defect is not merely the number; it is that legacy and projection
stores can still act like independent sources.

## Canonical exchange envelope

Every cross-surface event must carry:

- `event_id`: globally stable id used for idempotency.
- `schema_version`: explicit parser/fold version.
- `account_id` when connected; absent locally before consent.
- `aggregate_id`: stable decision/judgment id.
- `entity_id`: stable premise/prediction/question id where applicable.
- `event_type` and a strictly validated payload.
- `origin_surface` and `origin_instance`: web, MCP, plugin, Telegram, etc.
- `occurred_at` and `recorded_at`.
- honest authority/provenance: user-stated, AI-surfaced, imported, observed.
- causal predecessor/version when an operation amends prior state.

Deletes are tombstone events. Terminal outcomes never use last-write-wins.
Concurrent incompatible events remain visible as a fold conflict.

## Premise semantics that must not be collapsed

The unified contract keeps these as separate fields:

- `load_bearing`: would the judgment materially change if this is wrong?
- `external`: can reality re-check it?
- `monitoring_enabled`: should Argus currently nudge/re-check it?
- `auto_watch`: may Argus send it to external search automatically?
- `cadence_days`: when it next becomes due.
- status, authorship, source, amendment history, and re-check provenance.

This separation is required to migrate the old plugin alert modes without
pretending that “turn alerts off” means “this premise is no longer important.”

## Write rules

1. New domain acts append once to the surface’s canonical replica.
2. Sync transports events; it does not re-interpret them.
3. Screen tables are rebuilt/projected from events.
4. Legacy stores are read by idempotent importers only; no permanent dual-write.
5. Derived memory cannot enter prompts through this dataset. JCR grants and
   InfluenceTrace remain the sole authority for that separate operation.

## Migration sequence

1. Inventory and freeze: name every writer and projection; CI fails on an
   undeclared premise/decision writer.
2. Plugin local convergence: stop new `.argus/items.jsonl` writes; import its
   events into the MCP ledger while preserving alert, cadence, authorship, and
   history.
3. Exchange/outbox: add versioned upload/download receipts and stable ids.
4. Account projection: project synced local events into web history, receipts,
   premise views, and due surfaces.
5. Web convergence: web domain writes append account events first; mutable
   tables become rebuildable projections.
6. Compatibility retirement: remove legacy writers only after round-trip,
   conflict, offline retry, export, and erasure tests pass.

## Personal agent / DB use

Users may export the same event envelope as JSONL plus a manifest and projection
snapshots. This is portable evidence for a personal agent or database, not a
behavioral verdict. It preserves authorship, provenance, corrections, validity
windows, and retirements so stale conclusions can be audited or re-verified.

## Rejected

- A forced cloud upload on first local save.
- One mutable “latest state” row per decision.
- Permanent dual-write between old and new stores.
- Treating `review_receipts`, `decision_items`, or plugin bridge tables as
  independent truth.
- Letting accumulated memory influence a new judgment without the JCR grant
  path.
