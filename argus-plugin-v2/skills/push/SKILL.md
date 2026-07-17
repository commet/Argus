---
name: push
user-invocable: false
description: Push this project's local Argus plugin records to the Argus webapp account paired by `/argus:connect`. Sends `.argus/ledger/ledger.jsonl` and `current_bearing.json` files through the webapp plugin ingest API. Use when the user wants to open plugin results in the webapp or run "push"; prefer `/argus:sync` for two-way sync. Invoked as `/argus:push`.
---

# /argus:push

**What this skill does:** Sends local Argus artifacts to the webapp account that
was paired with `/argus:connect`.

This is explicit one-way push, not background sync. The plugin remains
local-first: nothing leaves the machine unless the user runs this command. If
the user has settled or deferred decisions in the webapp, run `/argus:sync` or
`/argus:pull` so those web events are appended locally.

---

## Inputs

- No args: push now.
- `--status`: show whether a token is configured and how many artifacts are
  ready, without sending anything.
- Optional `--url https://...`: override the saved/default webapp URL for this
  run only.
- Optional `--token argus_pat_...`: one-off token override. Prefer
  `/argus:connect` for normal use.

---

## Steps

1. Resolve `${CLAUDE_PLUGIN_ROOT}` per sail Path Resolution. The canonical script
   is `${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js`.
2. Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js" push [flags]
```

For status:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js" push --status
```

3. Relay the script's compact result:
   - number of decisions written,
   - number of current calls written,
   - any skipped artifact count,
   - webapp import URL.

If the script says no token is configured, tell the user:

```text
Run /argus:connect <argus_pat_...> first. You can issue the token in the Argus webapp Settings.
```

---

## What Gets Sent

- `.argus/ledger/ledger.jsonl`: sealed and settled decision contracts.
- `.argus/sessions/**/current_bearing.json`: current call artifacts.
- `.argus/sessions/**/current-bearing.json`: legacy spelling, if present.

The webapp stores them under the paired account as `plugin_decisions` and
`plugin_bearings`. Re-running push is idempotent: rows update in place by
ledger id or session/version key. Webapp-originated settle/defer events are
returned by `/argus:pull`.

---

## Relationship To argus-watch

`argus-watch push` was the prototype bridge. `/argus:push` is now the normal
product path. Past-chat harvesting also lives in the plugin now via
`/argus:scan` and `/argus:predict`; do not require `argus-watch` for webapp sync.

---

## Forbidden Patterns

- Claiming push is automatic or continuous.
- Pushing without an explicit user command.
- Asking users to install `argus-watch` just to sync or recover normal Argus decisions.
- Printing the raw token.
