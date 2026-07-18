---
name: settings
description: Set up and connect Argus in one command — language and boss-persona preferences, webapp pairing with a push token, push/pull/two-way sync of plugin records, plus a pointer to the read-only /argus:doctor wiring self-diagnosis. Use when the user wants to configure Argus, change its language, connect the webapp, sync records, or asks "how do I change Argus settings". Invoked as `/argus:settings`.
argument-hint: "[비워두면 현재 설정 요약 | configure | connect <token> | push | pull | sync]"
---

# /argus:settings — setup & sync

Route by the argument, then invoke the matching internal skill via the Skill
tool and let it do the work — do NOT re-implement its logic here:

| Input | Invoke |
|---|---|
| (none) | No skill — render a one-screen read-only summary: `.argus/config.yaml` (locale, boss persona) if present, webapp pairing state (does `.argus/ledger/push.json` exist — say paired/not-paired, never print the token), and the verbs below. Create nothing. |
| `configure` (+ args) | `configure` — language, boss/stakeholder persona, session-commit preference (interactive, writes `.argus/config.yaml`). |
| `connect <token>` | `connect` with the token — pair this project with the user's webapp account (stores the token locally, git-ignored). |
| `push` | `push` — send local plugin records to the paired webapp account. |
| `pull` | `pull` — bring webapp-originated settle/defer events back into the local decision record. |
| `sync` | `sync` — pull, then push (the two-way default; prefer this over bare push/pull). |
| `doctor` | Point the user to `/argus:doctor` — the read-only install/wiring self-diagnosis is its own command. |

Legacy names that still work if typed directly: `/argus:configure`,
`/argus:connect`, `/argus:push`, `/argus:pull`, `/argus:sync` (menu-hidden but
functional).
