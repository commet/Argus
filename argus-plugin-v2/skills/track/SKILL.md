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

Design: `internal design notes`.
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
- `recheck` — a premise was re-checked against reality: `{event:"recheck", id,
  last_value, at}` (updates the drift baseline + last-checked time).
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

Edit: /argus:track edit P1 · Alert: /argus:track alert P1 off · Re-check: /argus:track check
Open question: /argus:track open "…" · Reconsider: /argus:track reconsider Q1
```
Show at most ~12 items; note if more.

### Step 2b — Extraction feedback (tool-calibration, NOT a user verdict)
The edit history is the strongest signal Argus gets, but it is about the TOOL's
extraction quality for this user — NOT the user's judgment. Surface it ONLY as
tool-calibration, and ONLY when it is strong: replay the edits and count AI-sourced
items (`source:"ai"`) vs how many the user overturned (an `edit` with action
`refine`/`replace`/`reject`). If there are **≥4 AI items AND the user overturned
≥half**, print ONE neutral line (locale), never more:
> AI가 뽑은 전제를 {{overturned}}/{{ai}} 고쳤어요 — 추출이 과하게 해석하는 것 같으면
> 한마디 남겨줘요, 그쪽을 손볼게요. [피드백] [괜찮아요]

This calibrates the *extraction*, not the person. It is NOT a principle (principles
draw only from settled reality — `/argus:principles` §Reality is the source) and
NOT a statement about who the user is. Below the threshold: say nothing.

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

### Step 5 — Re-check monitored premises (`/argus:track check`)
The living-premises alert: re-check whether a premise's fact still holds, and pull
the user back in ONLY when it actually changed. This is on-demand (no infra) — the
firing threshold is high, so silence is the common result.

1. **Select** premises to re-check: `type == premise` AND `external == true` AND
   `alert.mode == on_change` AND fewer than 2 `dismiss` events (not backed off) AND
   due (no `recheck` yet, or the last `recheck` is >7 days old). Cap at 3 per run
   (oldest-checked first). If none: print `재확인할 전제가 없어요.` and stop.
2. For each, **WebSearch** the premise's fact and write ONE short, factual,
   comparable line for its CURRENT state (e.g. premise "금리가 올해 동결된다" →
   current "한국은행 기준금리 3.50%, 이번 달 0.25%p 인상"). Keep it literal.
3. **Decide drift** (mechanical, mirrors `src/lib/premise-drift.ts` — do NOT
   free-judge): numeric facts drift when they move ≥10% or the sign flips; text
   facts drift when the summary changed. First-ever check = baseline only (never
   alerts). Append `{event:"recheck", id, last_value:"<current line>", at}` either
   way (updates the baseline + last-checked).
4. **If drifted → fire ONE alert** (literal, a fact + a question, never a verdict):
   > 전제가 된 사실이 바뀜: "{{premise}}" → {{what changed}}.
   > 이 결정 다시 볼래요?  [전제 수정] [이 알림 끄기] [넘어가기]
   - `전제 수정` → `edit` event (`replace`, user's wording).
   - `이 알림 끄기` → `alert` event (`off`).
   - `넘어가기` → `dismiss` event (2 of these auto-quiet the alert — restraint
     learned from behavior).
   **If not drifted → stay silent** for that premise (the `recheck` event is still
   written; do not report "no change" as noise).

### Step 6 — Open questions: add + reconsider (`open` / `reconsider`)
Open questions are things the user EXPLICITLY left undecided. Argus NEVER invents
one from a sealed decision — re-opening a closed call is a mirror-clause violation.
The only source is the user:

- `/argus:track open "<text>"` → append `{"event":"add","id":"item_{decision}_q{n}",
  "decision_id":"{decision}","type":"open_question","text":"<text>","source":"user","at":"{ISO}"}`.
- `/argus:track reconsider <ref>` for an `open_question` item:
  1. Present the question verbatim.
  2. Offer **2 short, balanced example leans (A / B)** — concrete starting points to
     think against, each naming a real cost. These are OPTIONS, never a recommendation.
  3. `AskUserQuestion` — "지금 다시 본다면?" → `[A로 기운다] [B로 기운다] [아직 미정]
     [내 말로 정리]`.
  4. On a lean, append an `edit` (`refine`) whose text is the USER's decision (their
     words on "내 말로", else the chosen lean) → the item becomes theirs (authored:user).
     `아직 미정` leaves it open to resurface later. NEVER record Argus's example as the
     answer, and never nudge toward A or B.

---

## Meta-check gates

- **Editing is the default posture** — present items as drafts to fix, not as verdicts.
- **Edits are append-only** — never rewrite a prior line; the edit history IS the signal.
- **User wording wins** — refine/replace text is the user's, verbatim, never re-summarized.
- **No verdict about the user** — a high overturn rate is TOOL-calibration (Step 2b:
  "is the extraction too aggressive?"), never a user principle (override is a
  self-report, not settled reality — routing it to `/argus:principles` would break
  that skill's reality-source invariant) and never "you are an X thinker"
  (Zero-Judgment gate).

## Forbidden patterns

- Rewriting or deleting existing `.argus/items.jsonl` lines.
- Summarizing/rephrasing the user's edit text instead of taking it verbatim.
- Declaring who the user is from their edit pattern.
- Turning an alert on for everything — respect the opt-out default (most items off).
