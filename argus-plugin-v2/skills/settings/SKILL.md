---
name: settings
description: Configure Argus, connect the webapp through browser approval, sync records, or inspect pairing state. Never ask for or print a token in normal use. Invoked as `/argus:settings`.
argument-hint: "[configure | connect | sync | push | pull | statusline | doctor]"
---

# /argus:settings — setup & sync

Route by the argument, read the matching bundled workflow, and follow it
exactly. These files are implementation details, not additional user commands:

| Input | Read |
|---|---|
| (none) | No skill — render a one-screen read-only summary: `.argus/config.yaml` (locale, boss persona) if present, webapp pairing state (does `.argus/ledger/push.json` exist — say paired/not-paired, never print the token), and the verbs below. Create nothing. |
| `configure` (+ args) | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/configure.md` |
| `connect` | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/connect.md` — run browser approval; do not request a pasted token. |
| `push` | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/push.md` |
| `pull` | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/pull.md` |
| `sync` | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/sync.md` |
| `statusline` (+ `on`/`off`/`--replace`) | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/statusline.md` — write the `statusLine` key into the user's own settings; a plugin cannot ship it. |
| `doctor` | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/doctor.md` — read-only install/wiring self-diagnosis. |
