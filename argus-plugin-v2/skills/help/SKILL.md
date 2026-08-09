---
name: help
description: Explain Argus and route the user to the right command. Use when the user asks what Argus is, what commands exist, how to start, which command fits their situation, or where session files live. Read-only, no LLM pipeline, no session mutation. Invoked as `/argus:help`.
---

# /argus:help

**What this skill does:** Orient the user in Argus itself — one screen, in
`config.locale` (if `.argus/config.yaml` doesn't exist yet, detect the
conversation language but do NOT create any files — help must stay read-only).

Render this (translate naturally for ko; keep the command names verbatim):

```text
## Argus — decision loop

Argus helps you make a decision, save what would prove it right or wrong later,
and come back later to compare it with reality.

The default is quiet: just talk about your decision as usual. Argus can capture
it, offer to save a testable check, and remind you when the check-by date
arrives. Nothing heavy runs on its own.

Commands (6):
  /argus:loop      turn one stuck decision into a next move, a signal to watch,
                   and a return condition. The default decision-to-reality loop.
  /argus:review    deep pressure-test of a decision or artifact (PR, file,
                   branch, document) by the full reviewer pipeline.
                   Explicit opt-in only — it never fires by itself.
  /argus:check     what is due now · settle past predictions against reality ·
                   seal a candidate for later (/argus:check <id>) ·
                   re-check premises (/argus:check premises)
  /argus:history   decision log across sessions · one decision's version tree
                   (/argus:history versions) · your record chronology · ratify a
                   recurring principle · scan past chats (/argus:history scan)
  /argus:settings  language & boss persona · webapp connect/push/pull/sync
  /argus:help      this screen

Emergency hatch: /argus:settings doctor — read-only install/wiring self-diagnosis

Where things live:
  .argus/config.yaml      locale + boss persona (auto-created, edit freely)
  .argus/sessions/<id>/   the full decision (git-ignored by default)
  .argus/ledger/          prediction ledger + webapp push token (git-ignored)

Background:
  Argus may show one local reminder when something is ready to check.
  It does not judge, resolve, or sync automatically.
```

**Situational routing** — if the user described a situation instead of asking
for the list, answer with the ONE command that fits, plus one sentence why:

- wants to get unstuck, choose a next move, or design a small test → `/argus:loop "<decision>"`
- wants a decision/PR/plan pressure-tested by the reviewer team → `/argus:review "<it>"`
- a reminder fired / "how did that bet go?" / "what should I check now?" → `/argus:check`
- wants to seal one candidate or seed for later → `/argus:check <id>`
- "is that fact still true?" / premises may have shifted → `/argus:check premises`
- asks "what have I decided here" / "show my past records" → `/argus:history`
- lost mid-decision / wants the version tree / resume → `/argus:history versions`
- wants to keep a repeated lesson as their own rule → `/argus:history principles`
- wants to recover decisions from past chats → `/argus:history scan`
- webapp pairing / sync / language / boss persona → `/argus:settings`
- suspects install or wiring is broken → `/argus:settings doctor`

## Forbidden patterns

- Creating or mutating any file (including `.argus/config.yaml`).
- Printing more than ~35 lines or re-explaining the internal pipeline
  (workers, ledgers, schemas) — orientation, not machinery.
- Teaching retired command names.
