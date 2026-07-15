---
name: resolve
description: Settle decision contracts whose check-by date has arrived — compare each sealed prediction against what actually happened and record the outcome in the ledger. This is the back half of the decision-contract loop (seal → reality → settle) and what builds the user's calibration history over time. Use when the session-start reminder fires, when /argus:versions or /argus:journal shows overdue contracts, or when the user says "정산" / "settle". Invoked as `/argus:resolve`.
---

# /argus:resolve

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
- `/argus:versions` / `/argus:journal` shows contracts past check-by.
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

**The recorded outcome IS the user's tapped option, verbatim (R41 — the foundation
rule, at the point of action, not just in the meta-gates).** NEVER narrate a
verdict by mapping reality to the sealed pass/fail YOURSELF (e.g. "결과: 실패" /
"that maps to missed") — that makes the MODEL the judge, which is the one integrity
break the n=1 record cannot survive (a record of model-graded outcomes is
worthless). You surface the sealed predicate + pass/fail and the question; the user
states what reality did. **Discrepancy case:** when the user's prose disagrees with
the sealed conditions ("basically held" when the fail_condition was met), do NOT
resolve it with a stated verdict — re-surface the sealed pass/fail VERBATIM and let
them settle it against that ("당신이 봉인한 기준은 이거예요 — 현실을 여기에 대보세요;
답은 당신이 정합니다"). This matters most on the weakest model tier (R41: a weak
tier self-graded the verdict — it landed correct only because the fixture's facts
were unambiguous; a real settlement 30 days later, fed by self-serving memory, will
not be).

## Step 3 — Record (append-only; never rewrite existing lines)

**Concurrency (true append, not read-modify-write).** Append each event as a
single line in append mode (`O_APPEND`) — never read the whole `ledger.jsonl`,
add a line in memory, and rewrite the file. Two concurrent writers (a seal from
one session, a settle from another, or helm sealing while settle runs) each
appending one line both land; a read-rewrite-whole-file would lose one. Append-only
is exactly what lets concurrent in-process writers AND git merges both converge —
this rule applies to every ledger writer (settle, helm, watch), not just here.


- For a **bearing seed not yet in the ledger**, first import it as two events,
  then settle — so the ledger stays the single replayable source:

```json
{"event":"harvest","id":"bearing:<session-id>:<label>","project":"<name of the directory containing .argus>","session":"<session-id>","decided_at":"<bearing generated_at>","quote":"<predicate>","decision":"<current_course.summary>","type":"adopt","stakes":"<from the session's classification.json if readable; omit the field otherwise — never fabricate>","at":"<now ISO>"}
{"event":"seal","id":"<same id>","predicate":"<predicate>","falsified_if":"<fail_condition or 'opposite observed'>","check_by":"<ISO date>","at":"<now ISO>"}
```

Omit `note` from the settle event when the user offered no sentence.

- Outcome events. **A held bet on luck is NOT a held bet on judgment** (R17:
  the one settle failure was a reckless, no-prep gamble that got lucky being
  logged as a clean "held", cementing winging-it as a validated win). So when
  recording, optionally capture the user's OWN read of WHY it went that way —
  reasoning, or luck / external factors outside it. This is the user's
  self-report, NOT Argus grading them (reality is still the only judge); it just
  keeps a lucky outcome from compounding into the record as a skill-win, and
  lets the track record separate judgment from luck. Offer it as a light second
  tap, never a quiz; omit `basis` if the user doesn't answer.

```json
{"event":"settle","id":"<id>","outcome":"happened|avoided|partial","basis":"reasoned|luck|external|mixed — user's own read, optional","note":"<one user sentence if offered>","at":"<now ISO>"}
```

**Authorship (mirror of the webapp `authored` field, R57/R58).** A seal carrying
`author:"user"` is the user's OWN prediction (the Phase-1 BIND lean from clarify Step
3.4) — re-confront it verbatim and, in `log`'s calibration, count a held one as the
user's judgment. A seal WITHOUT `author` (the AI-surfaced seed from sail Step 7) is a
machine-surfaced belief, not the user's bet — a held one is NOT the user's skill-win
(same principle as luck-vs-judgment basis). Never silently relabel one as the other.

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
  당시 짚었던 위험: "{{fog_or_reef.issue clipped 60}}" — 현실의 답: {{outcome}}
{{endif}}
{{...per settled contract}}
{{if pending}}→ "{{predicate}}" pushed to {{new check_by}}{{endif}}

Track record: {{S}} sealed · {{T}} settled — held {{h}} · missed {{a}} · partial {{p}}{{if T < 3}} (인사이트까지 {{3-T}}건){{endif}}
{{if remaining due}}{{N}} more due — run /argus:resolve again.{{endif}}
{{if T >= 3}}Patterns across your voyages: /argus:journal{{endif}}
```

**Settlement is reality-only — do NOT auto-offer `/argus:sail` on a missed or
partial outcome.** A missed bet does not mean the decision should be re-opened;
the user just learned what reality did and may simply be recording it.
Re-deciding is the user's explicit move, not an engine nudge — pushing
re-engagement here is over-fire (the mirror clause, CLAUDE.md), the same reason
the request-type gate (clarify Step 1.7) refuses to fork a vent. The 안개-line
above already surfaces "what you flagged vs what reality did" honestly; let that
stand on its own. If the user wants to re-decide, they will say so.

**Recovering `fog_or_reef` for the 안개 line:** parse the contract id back
into a path — `bearing:<session-id>:<label>` →
`.argus/sessions/<session-id>/versions/<label>/current_bearing.json` (try the
hyphen spelling too; `bearing:root:<label>` → the root bearing). This works
for ledger-origin contracts settled in a later run, where the id is the only
link back to the source bearing. If the bearing is gone, skip the line —
never reconstruct the fog from memory.

The track-record line is computed mechanically from the full ledger replay.
No praise, no scolding — counts only. The "당시 짚었던 위험" line is the one
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
- **Reopening a settled decision** — auto-offering `/argus:sail` / re-engagement
  on a missed or partial outcome (over-fire, the mirror clause). Settlement
  records reality; re-deciding is the user's explicit move.
- Settling without an explicit user answer.
- Rewriting `check_by` on a contract the user didn't choose to push.
- Producing a long retrospective — that is `/argus:journal --insights` territory.
