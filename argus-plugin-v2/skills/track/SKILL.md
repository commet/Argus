---
name: track
description: View and correct the tracked items of a decision — its premises, phenomena, conclusions, and open questions — and turn per-item change alerts on or off. AI extracts these items; you fix the ones that are wrong (over-interpreted, wrong starting point), and every correction is recorded as signal. Use when the user says "전제 고칠래", "이 전제 알림 꺼줘", "결정 항목 보여줘", "the AI got this premise wrong", or after a decision is sealed and its items should be reviewed. Invoked as `/argus:track`.
---

# /argus:track

**What this skill does:** Shows a decision broken into tracked items and lets the
user **correct** any item and **toggle its change-alert**. Editing is the expected
action, not an exception — AI-extracted items are drafts the user fixes.

**Why this matters:** A decision's premises and phenomena are where AI most often
over-interprets or starts from the wrong point. If those are wrong and uncorrected,
everything downstream (the settle grade, the premise alerts) is built on a bad base.
Correcting them is also the strongest signal Argus gets — overturning the AI tells
us the extraction was wrong for this user. So this surface makes editing central and
records every edit.

Design: `docs/DESIGN-decision-items-living-premises-2026-07-01.md`.
Copy rule: **literal, direct language — no metaphorical verbs.**

**Default behavior:** read-only until the user edits or toggles. Locale from
`.argus/config.yaml` (`config.locale`).

---

## Storage — `.argus/items.jsonl` (append-only, replay by id)

One JSON per line. Nothing is ever rewritten — an edit is the signal and must never
be lost (mirrors the ledger's amend principle).

Events:
- `extract` — an AI-extracted item is created: `{event, id, decision_id, type,
  text, external, load_bearing, ai_original, at}` (type ∈ premise | phenomenon |
  conclusion | open_question | prediction).
- `add` — the user adds an item: same fields, `source:"user"`, no `ai_original`.
- `edit` — the user changes an item: `{event:"edit", id, action, from, to, at}`
  (action ∈ accept | refine | replace | reject).
- `alert` — the user sets an item's alert mode: `{event:"alert", id, mode, at}`
  (mode ∈ off | on_change | weekly | monthly).
- `dismiss` — the user dismissed an item's alert: `{event:"dismiss", id, at}`.

State = replay by id. `reject` retires an item (keep it, mark retired). Two
`dismiss` events auto-quiet the alert (adaptive back-off). Defaults on `extract`:
a load-bearing external **premise** starts at `on_change`; everything else `off`.

---

## Inputs

- `--decision <id>`: which decision. Defaults to the latest session's decision.
- `--session <id>`: defaults to latest.
- `--no-prompt`: don't `AskUserQuestion` (list only; for tests).

If `.argus/items.jsonl` is missing or has no items for the decision: print one line —
`No tracked items yet for this decision. They are created when you clarify/seal a
decision.` — and stop.

---

## Steps

### Step 1 — Load and replay
Read `.argus/items.jsonl` (defensive-parse; skip unparsable lines). Replay by id to
current state. Filter to the target decision. Group by type.

### Step 2 — Show (one screen)
```text
## Argus - Tracked items ({{decision, clipped 48}})

AI extracted these. Fix anything that is wrong.

Premises
  [P1] {{text}}   {{alert: 🔔 on / 🔕 off}}{{if edited}} (edited){{endif}}
  ...
Phenomena
  [H1] {{text}}
Open questions
  [Q1] {{text}}

Edit: /argus:track edit P1 · Alert: /argus:track alert P1 off
```
Show at most ~12 items; note if more.

### Step 3 — Edit (on request)
For `edit <ref>`, one `AskUserQuestion`:
- Title: `Fix this item` (ko: `항목 수정`)
- Show the current text, then:
  - `맞아요, 그대로 둘게요` → action `accept`
  - `조금 다듬을게요` → action `refine`, take the user's new text verbatim
  - `틀렸어요, 다시 쓸게요` → action `replace`, take the user's new text verbatim
  - `이건 빼주세요` → action `reject`
Append the matching `edit` event. Never rewrite prior lines.

**On `refine`/`replace`, the new text is the USER's wording verbatim** — do not
re-summarize it. This is the authorship transfer; the item becomes `ai_edited_by_user`.

### Step 4 — Alert toggle (on request)
For `alert <ref> <mode>`, append `{event:"alert", id, mode, at}`. Confirm in one line:
`{{ref}} 알림: {{mode}}.` For an external premise, `on_change` means "re-check the
fact periodically and tell you only if it actually changed."

---

## Meta-check gates

- **Editing is the default posture** — present items as drafts to fix, not as verdicts.
- **Edits are append-only** — never rewrite a prior line; the edit history IS the signal.
- **User wording wins** — refine/replace text is the user's, verbatim, never re-summarized.
- **No verdict about the user** — you may note "you overturned 6 of 8" as a ratifiable
  question (→ `/argus:principles`), never "you are an X thinker" (Zero-Judgment gate).

## Forbidden patterns

- Rewriting or deleting existing `.argus/items.jsonl` lines.
- Summarizing/rephrasing the user's edit text instead of taking it verbatim.
- Declaring who the user is from their edit pattern.
- Turning an alert on for everything — respect the opt-out default (most items off).
