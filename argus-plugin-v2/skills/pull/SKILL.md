---
name: pull
description: Pull webapp-originated plugin events back into the local Argus ledger. Use after settling or deferring plugin decisions in the webapp, or whenever the user asks to sync webapp changes back to Claude Code. Invoked as `/argus:pull`.
---

# /argus:pull

**What this skill does:** Fetches webapp-originated decision events for the
paired account and appends them to `.argus/ledger/ledger.jsonl`.

This is the return path of the bridge:

- `/argus:push` sends local ledger/bearing records to the webapp.
- The webapp can settle or defer imported plugin decisions.
- `/argus:pull` brings those webapp actions back into the local ledger.

## Run

Resolve the plugin root from `${CLAUDE_PLUGIN_ROOT}`. If it is missing, stop and
say this command requires the packaged Argus plugin install.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js" pull
```

If the script says no token is configured, tell the user to create a token in
the webapp settings and run:

```bash
/argus:connect <argus_pat_...>
```

## Behavior

- Append only. Never edit or rewrite existing ledger lines.
- Deduplicate by `event_id`; repeated pulls must be safe.
- Webapp events keep their original `at` timestamp and are marked with
  `origin:"webapp"`.
- This command only pulls web events. It does not push local artifacts; use
  `/argus:sync` for both directions.

## Forbidden Patterns

- Do not infer settlement outcomes.
- Do not ask the user to manually copy JSON into the ledger.
- Do not mutate `.argus/sessions/`.
