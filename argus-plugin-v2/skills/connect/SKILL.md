---
name: connect
user-invocable: false
description: Connect this local Argus plugin project to the Argus webapp with one approve tap in the browser — no token to copy-paste. Use when the user wants plugin results to appear in the webapp, or asks how to sync/push Argus plugin records. Runs a PKCE browser-approve flow (device-code fallback), stores the resulting credential locally under .argus/ledger/push.json, and makes sure it is git-ignored. Invoked as `/argus:connect`.
argument-hint: "(no argument — a browser approve tab opens; --token <argus_pat_...> for CI)"
---

# /argus:connect

**What this skill does:** Pairs this local `.argus/` project with the user's
webapp account for explicit sync. It does not log into Claude Code. It runs a
one-tap browser approve flow (PKCE, device-code fallback) and stores the
resulting credential locally, then `/argus:push` can send
`ledger.jsonl` and `current_bearing.json` artifacts to the webapp account, while
`/argus:pull` can bring webapp settle/defer events back into the local decision record.

Use the bundled script. Do not ask the user to install `argus-watch`.

---

## Inputs

- **No argument needed** — a browser approve tab opens (PKCE). The user clicks
  "approve" once; the credential comes back over a localhost loopback (never
  pasted). That single approve click IS the sync opt-in.
- `--headless` for environments with no browser: prints a short user-code + URL
  to enter (OAuth device flow), then polls until approved.
- Optional `--url https://...` for staging/dev webapp deployments.
- Advanced/CI only: `--token argus_pat_...` still works (skips the browser).

Do NOT ask the user to issue or paste a token in the normal flow — just run the
script; the approve tab does the rest.

---

## Steps

1. Resolve `${CLAUDE_PLUGIN_ROOT}` per sail Path Resolution. The canonical script
   is `${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js`.
2. Run (no token — the browser approve tab opens):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js" connect [--headless] [--url "<url>"]
```

3. Relay the script's short result. Never print the credential back to the user.

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
