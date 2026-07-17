---
name: check
description: The return loop in one command — see what is due now, settle past predictions against reality, seal a candidate or sail seed for later checking, and re-check the premises a decision rests on. Use when the user asks "지금 확인할 것 있어?", "정산하자", "how did that bet go?", wants to save/seal a decision candidate (pass its id), or wants to view/correct a decision's premises. Invoked as `/argus:check`.
argument-hint: "[비워두면 due 확인·정산 | <candidate-id> = 봉인 | premises [args]]"
---

# /argus:check — the return loop

One door for seal → reality → settle. Route by the argument, then invoke the
matching internal skill via the Skill tool and let it do the work — do NOT
re-implement its logic here:

| Input | Invoke |
|---|---|
| (none), `due`, or a natural "what should I check?" | `resolve` — list contracts whose check-by date arrived and settle them against what actually happened. |
| a candidate/seed id (or `--list`, `--latest-seed`) | `predict` with the same arguments — seal it into a later-checkable contract. |
| `premises` (+ remaining args) | `premises` with the remaining arguments — view/correct tracked premises, toggle change-alerts. |

Legacy names that still work if typed directly: `/argus:resolve` (kept as the
second alias), `/argus:predict`, `/argus:premises` (menu-hidden but functional).

Spine: settlement is the user's answer against reality — never grade, never
auto-settle, never invent an outcome. If nothing is due and no argument was
given, say so in one line and stop — no ceremony, no re-engagement push.
