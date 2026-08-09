---
name: check
description: Check what is due, record what actually happened, save a candidate for later checking, or inspect a decision's premises. Use for "지금 확인할 것 있어?", "정산하자", "how did that bet go?", a candidate id, or `premises`. Invoked as `/argus:check`.
argument-hint: "[due | <candidate-id> | premises [args]]"
---

# /argus:check — the return loop

One door for save → reality → answer. Route by the argument, read the matching
bundled workflow, and follow it exactly. These files are implementation details,
not additional user commands:

| Input | Read |
|---|---|
| (none), `due`, or a natural "what should I check?" | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/resolve.md` |
| a candidate/seed id (or `--list`, `--latest-seed`) | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/predict.md` |
| `premises` (+ remaining args) | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/premises.md` |
| `preapprove` (+ plan text), or "이 계획 미리 봉인해줘" | `${CLAUDE_PLUGIN_ROOT}/lib/workflows/preapprove.md` |

Spine: settlement is the user's answer against reality — never grade, never
auto-settle, never invent an outcome. If nothing is due and no argument was
given, say so in one line and stop — no ceremony, no re-engagement push.
