---
name: premises
user-invocable: false
description: View and correct a decision's premises, conclusions, open questions, and change alerts. Invoked through `/argus:check premises`.
---

# Internal premises workflow

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

Events — **all written by the single-source CLI (`decision-ledger.js premises
<op>`), never hand-written JSON.** The CLI owns the canonical shape the reducer
(`check-contracts.js`) replays, so an emitted field can't silently drift from what
the alert layer consumes (Honest-Structure invariant). It stamps `at` and appends
in `O_APPEND`:
- `extract` — an AI-extracted item (fields: id, decision_id, type, text, external,
  load_bearing, ai_original). type ∈ premise | phenomenon | conclusion |
  open_question | prediction.
- `add` — the user adds an item: same fields, `source:user`, no ai_original.
- `edit` — the user changes an item (fields: id, action, from, to). action ∈
  accept | refine | replace | reject.
- `alert` — the user sets an item's alert mode (fields: id, mode). mode ∈ off |
  on_change | weekly | monthly.
- `recheck` — a premise re-checked against reality (fields: id, last_value) —
  updates the drift baseline + last-checked time.
- `dismiss` — the user dismissed an item's alert (fields: id).

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

Edit: /argus:check premises edit P1 · Alert: /argus:check premises alert P1 off · Re-check: /argus:check premises check
Open question: /argus:check premises open "…" · Reconsider: /argus:check premises reconsider Q1
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
draw only from settled reality — `/argus:history principles` §Reality is the source) and
NOT a statement about who the user is. Below the threshold: say nothing.

### Step 3 — Edit (on request)
For `edit <ref>`, one `AskUserQuestion`:
- Title: `Fix this item` (ko: `항목 수정`)
- Show the current text, then (labels are plain noun forms — 창업자 피드백
  2026-07-30: 과한 구어체 금지):
  - `그대로 두기` → action `accept`
  - `다듬어 쓰기` → action `refine`, take the user's new text verbatim
  - `새로 쓰기` → action `replace`, take the user's new text verbatim
  - `추적에서 빼기` → action `reject`
Write the matching `edit` through the single-source CLI (never hand-write JSON,
never rewrite prior lines):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" premises edit --id <ref> --action accept|refine|replace|reject [--to "<user's new text, verbatim>"]
```

**On `refine`/`replace`, the new text is the USER's wording verbatim** — do not
re-summarize it. This is the authorship transfer; the item becomes `ai_edited_by_user`.

### Step 4 — Alert toggle (on request)
For `alert <ref> <mode>`, write it through the CLI (single-source, never hand-written):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" premises alert --id <ref> --mode off|on_change|weekly|monthly
```
Confirm in one line: `{{ref}} 알림: {{mode}}.` For an external premise, `on_change`
means "re-check the fact periodically and tell you only if it actually changed."

### Step 5 — Re-check monitored premises (`/argus:check premises check`)
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
   alerts). Write the `recheck` through the CLI either way (updates the baseline +
   last-checked):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" premises recheck --id <id> --last-value "<current factual line>"
   ```
4. **If drifted → fire ONE alert** (literal, a fact + a question, never a verdict):
   > 전제가 된 사실이 바뀜: "{{premise}}" → {{what changed}}.
   > 이 결정 다시 볼래요?  [전제 수정] [이 알림 끄기] [넘어가기]
   Write the chosen reaction through the CLI (single-source, never hand-written):
   - `전제 수정` → `premises edit --id <id> --action replace --to "<user's wording>"`.
   - `이 알림 끄기` → `premises alert --id <id> --mode off`.
   - `넘어가기` → `premises dismiss --id <id>` (2 of these auto-quiet the alert —
     restraint learned from behavior).
   **If not drifted → stay silent** for that premise (the `recheck` event is still
   written; do not report "no change" as noise).

### Step 6 — Open questions: add + reconsider (`open` / `reconsider`)
Open questions are things the user EXPLICITLY left undecided. Argus NEVER invents
one from a sealed decision — re-opening a closed call is a mirror-clause violation.
The only source is the user:

- `/argus:check premises open "<text>"` → write through the CLI (single-source, never
  hand-written JSON; the CLI sets `source:user`):
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" premises add --id "item_{decision}_q{n}" --decision "{decision}" --type open_question --text "<text>"
  ```
- `/argus:check premises reconsider <ref>` for an `open_question` item. **Spine-critical
  form (mirrors the MCP `argus_premises` op=resolve — keep the two surfaces from
  drifting): an open question closes ONLY in the user's own words. NO options, NO
  example leans, NO A/B fork — a multiple-choice crux IS a fork, and a disclaimed
  lean ("just an option, not a recommendation") does not launder it; per-output
  tilt-tagging makes the violation worse (CLAUDE.md mirror clause, rounds 5–8).**
  1. Present the question verbatim — nothing else framing it.
  2. Ask, as free text (plain prose, NOT an `AskUserQuestion` chip fork):
     > 지금 다시 본다면, 당신의 말로 어떻게 정리돼요? (열어둔 채로 둬도 괜찮아요 — 그것도 진짜 답이에요.)
     Do NOT generate example answers, starting points, or poles to think against —
     even "balanced" ones. The question stands bare; the user fills it.
  3. On a written answer, write an `edit` (`refine`) whose text is the USER's words
     verbatim through the CLI → the item becomes theirs (`authored:user`). Never
     re-summarize it, never substitute an Argus-drafted line:
     ```bash
     node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" premises edit --id <ref> --action refine --to "<user's words, verbatim>"
     ```
  4. If the user chooses to leave it open, append NOTHING — the item stays active
     and simply resurfaces later (no `reconsider`/`still_open` event exists in this
     surface's `items.jsonl` reducer, and inventing one would be a dead wire nothing
     consumes). No verdict, no pressure; leaving a question open is a valid answer,
     and this must never read as a nudge to finally decide.

---

## Meta-check gates

- **Editing is the default posture** — present items as drafts to fix, not as verdicts.
- **Edits are append-only** — never rewrite a prior line; the edit history IS the signal.
- **User wording wins** — refine/replace text is the user's, verbatim, never re-summarized.
- **No verdict about the user** — a high overturn rate is TOOL-calibration (Step 2b:
  "is the extraction too aggressive?"), never a user principle (override is a
  self-report, not settled reality — routing it to `/argus:history principles` would break
  that skill's reality-source invariant) and never "you are an X thinker"
  (Zero-Judgment gate).

## Forbidden patterns

- Rewriting or deleting existing `.argus/items.jsonl` lines.
- Summarizing/rephrasing the user's edit text instead of taking it verbatim.
- Declaring who the user is from their edit pattern.
- Turning an alert on for everything — respect the opt-out default (most items off).
