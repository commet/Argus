---
name: settle
description: Settle decision contracts whose check-by date has arrived — compare each sealed prediction against what actually happened and record the outcome in the ledger. This is the back half of the decision-contract loop (seal → reality → settle) and what builds the user's calibration history over time. Use when the session-start reminder fires, when /argus:chart or /argus:log shows overdue contracts, or when the user says "정산" / "settle". Invoked as `/argus:settle`.
---

# /argus:settle

**What this skill does:** Finds decision contracts past (or at) their check-by
date, asks the user what reality did, and appends the outcome to
`.argus/ledger/ledger.jsonl`. Argus never grades the user — reality does. The
skill only records.

**Why this matters:** A prediction that is never checked is just a vibe with a
date on it. Settling is what turns `.argus/` from session storage into a track
record — the thing that compounds and that no fresh tool can replicate.

---

## When to run

- The SessionStart reminder printed an overdue-contract line.
- `/argus:chart` / `/argus:log` shows contracts past check-by.
- The user says "정산하자" / "settle the contracts" / "how did that bet go?".

Locale: read `config.locale` from `.argus/config.yaml`; all user-facing text
uses it (English shown below; translate naturally for ko).

---

## Step 1 — Collect due contracts (mechanical, no LLM judgment)

Two sources, merged and deduped by id:

1. **Ledger:** parse `.argus/ledger/ledger.jsonl` line by line (skip unparsable
   lines). Replay events by `id`: `seal` opens/updates a contract
   (`predicate`, `falsified_if`, `check_by`), `amend` updates fields,
   `settle`/`dismiss` closes it. Keep contracts still open whose `check_by`
   (ISO date) ≤ today.
2. **Bearing seeds:** every `.argus/sessions/*/versions/*/current_bearing.json`
   with a `contract_seed` whose `check_by` contains an ISO date ≤ today.
   Synthesize a stable id: `bearing:<session-id>:<label>`. Skip seeds whose id
   already appears in the ledger (they were settled or already imported) — or
   whose verbatim predicate was already sealed under another id (e.g., sealed
   manually via argus-watch); the reminder hook and statusline dedup the same
   two ways, and settle must agree with them.
   Prose check-by values ("30 days after release") are not mechanically due —
   list them at the end as "date unclear; settle explicitly if it has passed."

If nothing is due: print one line and exit —
`No contracts due. Next check-by: {{date or "none sealed yet"}}.`

## Step 2 — Settle each (max 3 per run; oldest first)

For each due contract, one `AskUserQuestion` (this is a measurement, not a
quiz — neutral tone):

- Title: `Contract check` (ko: `계약 정산`)
- Question: `You predicted: "{{predicate}}" (check by {{check_by}}). What did
  reality do?`
- Options:
  - `Held — it happened as predicted` → outcome `happened`
  - `Did not hold — reality went the other way` → outcome `avoided`
  - `Partially — mixed result` → outcome `partial`
  - `Can't tell yet — push the date` → `pending`
  - `Skip this one` → no event written

If more than 3 are due, settle the 3 oldest and say how many remain.

## Step 3 — Record (append-only; never rewrite existing lines)

- For a **bearing seed not yet in the ledger**, first import it as two events,
  then settle — so the ledger stays the single replayable source:

```json
{"event":"harvest","id":"bearing:<session-id>:<label>","project":"<repo dir name>","session":"<session-id>","decided_at":"<bearing generated_at>","quote":"<predicate>","decision":"<current_course.summary>","type":"adopt","stakes":"high","at":"<now ISO>"}
{"event":"seal","id":"<same id>","predicate":"<predicate>","falsified_if":"<fail_condition or 'opposite observed'>","check_by":"<ISO date>","at":"<now ISO>"}
```

- Outcome events:

```json
{"event":"settle","id":"<id>","outcome":"happened|avoided|partial","note":"<one user sentence if offered>","at":"<now ISO>"}
```

- `pending` → extend instead (history preserved, no settle):

```json
{"event":"amend","id":"<id>","check_by":"<today + 14d, or user-given date>","at":"<now ISO>"}
```

Create `.argus/ledger/` if missing. Ensure `.argus/.gitignore` exists per sail
Step 0 **and contains a `ledger/` line** — older gitignores predate the
settlement loop and only cover `sessions/`; append the line if missing so the
ledger (verbatim predicates and outcomes) stays local by default.

## Step 4 — Report (one screen)

```text
## Argus - Settle

✓ "{{predicate clipped 70}}" → {{outcome}}
{{...per settled contract}}
{{if pending}}→ "{{predicate}}" pushed to {{new check_by}}{{endif}}

Track record: {{S}} sealed · {{T}} settled — held {{h}} · missed {{a}} · partial {{p}}
{{if remaining due}}{{N}} more due — run /argus:settle again.{{endif}}
{{if T >= 3}}Patterns across your voyages: /argus:log{{endif}}
```

The track-record line is computed mechanically from the full ledger replay.
No praise, no scolding — counts only.

---

## Meta-check gates

- **Append-only:** never modify or delete existing ledger lines; corrupt lines
  are skipped, not repaired.
- **No self-grading:** the user states the outcome; the skill never infers
  `happened`/`avoided` from git state or argument.
- **No nagging:** one pass per invocation; skipping is one tap and is never
  questioned.
- **Id stability:** the same bearing seed must always produce the same id, or
  it will be double-settled.

## Forbidden patterns

- Judging the outcome ("that was a bad call").
- Settling without an explicit user answer.
- Rewriting `check_by` on a contract the user didn't choose to push.
- Producing a long retrospective — that is `/argus:log --insights` territory.
