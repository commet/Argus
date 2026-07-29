---
name: history
description: Read the decision record, inspect one decision's versions, keep a user-authored principle, or recover candidates from past chats. Never score or rank outcomes. Invoked as `/argus:history`.
argument-hint: "[versions | principles | scan]"
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

All views are read-only except scan's candidate events and a principles entry
the user authors themselves.
