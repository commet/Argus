# ADR — P7 Telegram and plugin convergence

Date: 2026-07-14
Status: Accepted

## Telegram

For a project that has `semantic_judgment_id`, a Telegram callback or reply is
direct-command evidence. The webhook records its update/message/callback id as
the authorization reference and writes through the same web ledger gateway.

An outcome tap creates an atomic `observation_recorded` +
`resolution_asserted` batch. It does **not** close the judgment. The bot sends a
second close button; that button is its own human-authorized `judgment_closed`
event. `pending` creates `return_deferred`; mute changes notification delivery
only and does not settle the judgment. Legacy non-v3 contracts retain their
existing behavior as an explicit compatibility projection.

## Plugin

Imported v2 plugin decisions are never silently converted. The account import
surface presents an explicit **reforge** action. It preserves the legacy record
as import provenance, records the current user confirmation as authority, and
creates a retrospective v3 seal + return contract in a plugin-specific space.

Plugin `semantic_v3` outbox rows are delivered verbatim by `/argus:pull` or
`/argus:sync` into `.argus/ledger/semantic-v3.jsonl`. That local semantic file
is the plugin space's canonical ledger; the account `plugin_events` table is
its ordered delivery outbox/replica, not a competing mutable state machine.

## Consequences

- No surface may treat `happened`, `avoided`, or `partial` as a terminal v3
  outcome enum.
- A stale v2 record stays readable and can be left unreforged.
- Local pull never rewrites semantic event content; invalid batches are skipped
  with a visible error instead of being coerced into v2 ledger events.
