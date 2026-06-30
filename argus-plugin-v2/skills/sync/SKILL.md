---
name: sync
description: Two-way sync between the local Argus plugin ledger and the webapp. Pulls webapp-originated settle/defer events into local ledger, then pushes the updated local ledger and bearings back to the webapp. Invoked as `/argus:sync`.
---

# /argus:sync

**What this skill does:** Runs the full bridge loop:

1. Pull webapp-originated decision events into `.argus/ledger/ledger.jsonl`.
2. Push the updated local ledger and current bearings to the webapp.

Use this when the user wants the webapp and Claude Code plugin to agree, not
just one side to display the other.

## Run

Resolve the plugin root from `${CLAUDE_PLUGIN_ROOT}`. If it is missing, stop and
say this command requires the packaged Argus plugin install.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js" sync
```

If no token is configured, route the user to:

```bash
/argus:connect <argus_pat_...>
```

## Semantics

- Pull first, then push. That prevents a stale local ledger from overwriting a
  webapp settlement before it has been appended locally.
- The local ledger stays the replayable source for plugin users.
- The webapp remains an active control surface for imported plugin decisions.

## Forbidden Patterns

- Do not run separate manual import instructions after a successful sync.
- Do not rewrite the ledger to "merge" events.
- Do not settle decisions without explicit user input.
