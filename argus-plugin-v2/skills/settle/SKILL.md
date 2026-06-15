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
2. **Bearing seeds:** every `current_bearing.json` (or legacy hyphen
   spelling) with a `contract_seed` whose `check_by` contains an ISO date ≤
   today — scan the same three levels the statusline and reminder hook scan,
   so no surface can alert on a seed settle can't reach:
   `.argus/sessions/*/versions/*/` (id `bearing:<session-id>:<label>`),
   `.argus/sessions/*/` (id `bearing:<session-id>:<bearing.label or "v0">`),
   and `.argus/` root (id `bearing:root:<bearing.label or "v0">`).
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
{"event":"harvest","id":"bearing:<session-id>:<label>","project":"<name of the directory containing .argus>","session":"<session-id>","decided_at":"<bearing generated_at>","quote":"<predicate>","decision":"<current_course.summary>","type":"adopt","stakes":"<from the session's classification.json if readable; omit the field otherwise — never fabricate>","at":"<now ISO>"}
{"event":"seal","id":"<same id>","predicate":"<predicate>","falsified_if":"<fail_condition or 'opposite observed'>","check_by":"<ISO date>","at":"<now ISO>"}
```

Omit `note` from the settle event when the user offered no sentence.

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
{{if contract came from a bearing seed AND that bearing has fog_or_reef}}
  당시 짚었던 안개: "{{fog_or_reef.issue clipped 60}}" — 현실의 답: {{outcome}}
{{endif}}
{{...per settled contract}}
{{if pending}}→ "{{predicate}}" pushed to {{new check_by}}{{endif}}

Track record: {{S}} sealed · {{T}} settled — held {{h}} · missed {{a}} · partial {{p}}{{if T < 3}} (인사이트까지 {{3-T}}건){{endif}}
{{if remaining due}}{{N}} more due — run /argus:settle again.{{endif}}
{{if T >= 3}}Patterns across your voyages: /argus:log{{endif}}
{{if a settled outcome was missed/partial AND its fog_or_reef names an open question}}열린 질문이 하나 남았네요 — 잡아보려면: /argus:sail{{endif}}
```

**Recovering `fog_or_reef` for the 안개 line:** parse the contract id back
into a path — `bearing:<session-id>:<label>` →
`.argus/sessions/<session-id>/versions/<label>/current_bearing.json` (try the
hyphen spelling too; `bearing:root:<label>` → the root bearing). This works
for ledger-origin contracts settled in a later run, where the id is the only
link back to the source bearing. If the bearing is gone, skip the line —
never reconstruct the fog from memory.

The track-record line is computed mechanically from the full ledger replay.
No praise, no scolding — counts only. The "당시 짚었던 안개" line is the one
deliberate exception to counts-only: a user's first settle must show that the
harness saw a real risk at decision time, or there is no reason to come back
for settle #2 — it quotes, it never editorializes.

---

## Meta-check gates

- **Append-only:** never modify or delete existing ledger lines; corrupt lines
  are skipped, not repaired.
- **Write verification:** after appending, re-read the line(s) you just wrote
  and JSON-parse each one. Every reader in the system silently skips
  unparsable lines, so a malformed seal isn't an error — it's a prediction
  that ceases to exist. If a line fails to parse, append a corrected line
  immediately (never edit in place).
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
