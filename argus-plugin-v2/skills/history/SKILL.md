---
name: history
description: The decision record in one command — a neutral cross-session chronology, one decision's version tree, recurring principles the user may ratify in their own words, and recovery of decision candidates from past Claude Code chats. Use when the user asks "내가 뭘 결정했지", wants to revisit earlier thinking, asks "지금 어디까지 왔지" (version tree), or wants to scan past conversations for missed decisions. Never aggregate outcomes into a score or performance claim. Invoked as `/argus:history`.
argument-hint: "[비워두면 결정 일지 | versions [args] | principles [args] | scan [args]]"
---

# /argus:history — the decision record

Route by the argument, then invoke the matching internal skill via the Skill
tool and let it do the work — do NOT re-implement its logic here:

| Input | Invoke |
|---|---|
| (none) or `--insights` | `journal` — the one-screen chronology across ALL sessions, including original sentences and later answers (`--insights` passes through, but must not score or rank the user). |
| `versions` (+ args) | `versions` — the current decision's version tree: active draft, verification state, next route; checkout/promote flags pass through. |
| `principles` (+ args) | `principles` — surface a recurring structure from the user's settled decisions and let the USER ratify it in their own words (authored:user, never a machine verdict). |
| `scan` (+ args) | `scan` — recover decision candidates from past Claude Code conversations in this project (writes candidate events only; never seals). |

Legacy names that still work if typed directly: `/argus:journal`,
`/argus:versions`, `/argus:principles`, `/argus:scan` (menu-hidden but
functional).

All views are read-only except scan's candidate events and a principles entry
the user authors themselves.
