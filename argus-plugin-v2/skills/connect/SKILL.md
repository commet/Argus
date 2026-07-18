---
name: connect
user-invocable: false
description: Connect this local Argus plugin project to the Argus webapp using a personal push token issued in webapp Settings. Use when the user wants plugin results to appear in the webapp, says they have an argus_pat token, or asks how to sync/push Argus plugin records. Stores the token locally under .argus/ledger/push.json and makes sure it is git-ignored. Invoked as `/argus:connect`.
argument-hint: "<argus_pat_...>"
---

# /argus:connect

**What this skill does:** Pairs this local `.argus/` project with the user's
webapp account for explicit sync. It does not log into Claude Code. It stores a
webapp-issued personal push token locally, then `/argus:push` can send
`ledger.jsonl` and `current_bearing.json` artifacts to the webapp account, while
`/argus:pull` can bring webapp settle/defer events back into the local decision record.

Use the bundled script. Do not ask the user to install `argus-watch`.

---

## Inputs

- Token argument: `argus_pat_...`
- Optional URL: `--url https://...` for staging/dev webapp deployments.

If no token is present, print:

```text
Issue a plugin push token in the Argus webapp Settings, then run:
  /argus:connect <argus_pat_...>
```

Stop. Do not invent a token.

---

## Steps

1. Resolve `${CLAUDE_PLUGIN_ROOT}` per sail Path Resolution. The canonical script
   is `${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js`.
2. Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js" connect --token "<token>" [--url "<url>"]
```

3. Relay the script's short result. Do not print the full token back to the user.

The script writes `.argus/ledger/push.json` and appends `ledger/` to
`.argus/.gitignore` if needed. That is intentional: the push token and
prediction ledger are personal by default.

---

## Relationship To argus-watch

`argus-watch` was the older ambient decision harvester and webapp bridge. Its
normal product path has been absorbed into the plugin: `/argus:scan`,
`/argus:predict`, `/argus:connect`, `/argus:push`, `/argus:pull`, and
`/argus:sync`. The separate `argus-watch` CLI is legacy/advanced; normal users
should not need it.

---

## Forbidden Patterns

- Asking the user to paste the token into a committed file.
- Saving the token outside `.argus/ledger/push.json`.
- Telling the user they are "logged in" to the plugin. This is token pairing,
  not an interactive login session.
