---
name: pull
user-invocable: false
description: Pull webapp-originated events into the local Argus record. Invoked through `/argus:settings pull`.
---

# Internal pull workflow

**What this skill does:** Fetches webapp-originated decision events for the
paired account and appends them to `.argus/ledger/ledger.jsonl`.

This is the return path of the bridge:

- `/argus:settings push` sends local decision records to the webapp.
- The webapp can settle or defer imported plugin decisions.
- `/argus:settings pull` brings those webapp actions back into the local decision record.

## Run

Resolve the plugin root from `${CLAUDE_PLUGIN_ROOT}`. If it is missing, stop and
say this command requires the packaged Argus plugin install.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js" pull
```

If the script says no credential is configured, tell the user to run:

```bash
/argus:settings connect
```

## Behavior

- Append only. Never edit or rewrite existing ledger lines.
- Deduplicate by `event_id`; repeated pulls must be safe.
- Webapp events keep their original `at` timestamp and are marked with
  `origin:"webapp"`.
- This command only pulls web events. It does not push local artifacts; use
  `/argus:settings sync` for both directions.

## Forbidden Patterns

- Do not infer settlement outcomes.
- Do not ask the user to manually copy JSON into the ledger.
- Do not mutate `.argus/sessions/`.
