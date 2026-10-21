---
name: history
description: Read the decision record, inspect one decision's versions, keep a user-authored principle, recover candidates from past chats, or sign a rule agents in this repository will keep (`rules`). Never score or rank outcomes. Invoked as `/argus:history`.
argument-hint: "[versions | principles | scan | rules]"
---

# /argus:history — the decision record

Route by the argument, read the matching bundled workflow, and follow it
exactly. These files are implementation details, not additional user commands:

| Input | Read |
|---|---|
| (none) or `--insights` | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/journal.md` |
| `versions` (+ args) | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/versions.md` |
| `principles` (+ args) | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/principles.md` |
| `scan` (+ args) | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/scan.md` |
| `rules` (+ args), or "이거 법으로 / 서명 / 앞으로 이렇게 하자" | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/rules.md` |

All views are read-only except scan's candidate events, a principles entry
the user authors themselves, and a rule the user explicitly signs (`rules`).
