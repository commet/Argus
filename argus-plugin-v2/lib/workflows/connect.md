---
name: connect
user-invocable: false
description: Connect this project to the Argus webapp with one browser approval — no token to copy-paste. Invoked through `/argus:settings connect`.
argument-hint: "(no argument; --headless when a browser is unavailable)"
---

# Internal connect workflow

**What this skill does:** Pairs this local `.argus/` project with the user's
webapp account for explicit sync. It does not log into Claude Code. It runs a
one-tap browser approve flow (PKCE, device-code fallback) and stores the
resulting credential locally, then `/argus:settings push` can send
`ledger.jsonl` and `current_bearing.json` artifacts to the webapp account, while
`/argus:settings pull` can bring webapp settle/defer events back into the local decision record.

After connecting, each seal auto-syncs to the webapp (the approve click was the
opt-in). The user can turn that off with `/argus:settings push --auto off`, and
back on with `--auto on`; an explicit push always works regardless.

Use the bundled script. Do not ask the user to install `argus-watch`.

---

## Inputs

- **No argument needed** — a browser approve tab opens (PKCE). The user clicks
  "approve" once; the credential comes back over a localhost loopback (never
  pasted). That single approve click IS the sync opt-in.
- `--headless` for environments with no browser: prints a short user-code + URL
  to enter (OAuth device flow), then polls until approved.
- Optional `--url https://...` for staging/dev webapp deployments.
- CI may provide `ARGUS_PUSH_TOKEN` as an environment secret.

Do NOT ask the user to issue or paste a token in the normal flow — just run the
script; the approve tab does the rest.

---

## Steps

1. Resolve `${CLAUDE_PLUGIN_ROOT}`. The canonical script
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
normal product path has been absorbed into `/argus:history scan`,
`/argus:check`, and `/argus:settings`. Normal users do not need the separate
`argus-watch` CLI.

---

## Forbidden Patterns

- Asking the user to paste the token into a committed file.
- Saving the token outside `.argus/ledger/push.json`.
- Telling the user they are "logged in" to the plugin. This is token pairing,
  not an interactive login session.
