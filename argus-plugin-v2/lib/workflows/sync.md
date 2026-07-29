---
name: sync
user-invocable: false
description: Two-way sync between the local Argus record and the webapp. Invoked through `/argus:settings sync`.
---

# Internal sync workflow

**What this skill does:** Runs the full bridge loop:

1. Pull webapp-originated decision events into `.argus/ledger/ledger.jsonl`.
2. Push the updated local decision record and current bearings to the webapp.

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
/argus:settings connect
```

## Semantics

- Pull first, then push. That prevents a stale local decision record from overwriting a
  webapp settlement before it has been appended locally.
- The local decision record stays the replayable source for plugin users.
- The webapp remains an active control surface for imported plugin decisions.

## Forbidden Patterns

- Do not run separate manual import instructions after a successful sync.
- Do not rewrite the decision record file to "merge" events.
- Do not settle decisions without explicit user input.
