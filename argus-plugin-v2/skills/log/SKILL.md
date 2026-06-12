---
name: log
description: The voyage log — a one-screen view across ALL Argus sessions in this project; recent decisions and their courses, sealed contracts, settled outcomes, and your calibration record. Read-only and mechanical by default; `--insights` adds one LLM-written pattern note once enough contracts are settled. Use when the user asks "what have I decided here", "show my track record", "how good are my predictions", or wants the decision history. Invoked as `/argus:log`.
---

# /argus:log

**What this skill does:** Aggregates the project's decision history —
`.argus/sessions/` + `.argus/ledger/ledger.jsonl` — into one screen. This is
the view that makes the accumulated history visible: what was decided, what
was predicted, and how those predictions fared.

`/argus:chart` is depth (one session's version tree); `/argus:log` is breadth
(every voyage in the project).

**Default behavior:** read-only, no LLM, no mutation. Locale from
`.argus/config.yaml` (English templates below; render naturally in ko).

---

## Inputs

- `--insights`: append one short LLM-written pattern note (requires ≥3 settled
  contracts; otherwise say how many more are needed).
- `--all`: list every session instead of the latest 8.

---

## Step 1 — Gather (mechanical)

1. **Sessions:** for each `.argus/sessions/<id>/`, read `session.json`
   (defensive-parse; skip corrupt) → id, `problem_text`, `phase`,
   `updated_at`. From the newest version dir read `current_bearing.json` →
   `current_course.status` + summary, or `minimal_scaffold.json` →
   "minimal". Missing both → "in progress".
2. **Ledger:** replay `.argus/ledger/ledger.jsonl` by id (`seal` opens,
   `amend` updates, `settle`/`dismiss` closes; skip unparsable lines).
   Compute: sealed count, open contracts (with next/overdue check-by dates),
   settled outcomes tally (happened / avoided / partial).

If `.argus/` is missing or holds no sessions and no ledger: print one line —
`No voyages logged yet. Start one: /argus:sail "<your decision>"` — and stop.

## Step 2 — Render (one screen)

```text
## Argus - Voyage Log ({{project dir name}})

Voyages: {{total}} ({{complete}} complete · {{in_progress}} underway)

Recent:
  {{date}}  {{problem_text clipped 48}}  → {{course status or "minimal" or "underway"}}
  {{...latest 8, newest first; "--all" lists everything}}

Contracts: {{sealed}} sealed · {{open}} open{{if overdue}} · {{overdue}} OVERDUE{{endif}}
Record:    held {{h}} · missed {{a}} · partial {{p}}{{if T==0}} (nothing settled yet){{endif}}
{{if overdue}}Next: /argus:settle — {{overdue}} contract(s) past check-by{{endif}}
{{if !overdue && open}}Next check-by: {{nearest date}} — "{{predicate clipped 60}}"{{endif}}

Reopen a voyage: /argus:chart --session <id> · /argus:sail --resume <id>
```

Keep it under one terminal screen. No worker counts, no schema names, no
machinery — same surface rules as the Current Bearing.

## Step 3 — `--insights` (optional, the only LLM use)

Only when settled contracts ≥ 3. Prompt yourself with the settled predicates +
outcomes + the recent sessions' fog/reef items, all wrapped in `<user-data>`,
and produce AT MOST 3 lines, each grounded in a specific entry:

- one pattern in what held vs missed (cite the entries, not vibes),
- one recurring fog/reef theme across voyages, if any,
- one suggestion phrased as reference, not directive ("worth one extra check
  when X" — never "be more conservative").

If the data shows no real pattern, say exactly that in one line — a forced
insight is worse than none.

---

## Meta-check gates

- **Read-only:** log never writes or mutates anything.
- **Counts, not grades:** the record line reports outcomes; it never scores,
  praises, or scolds.
- **Insight restraint:** every insight line must cite a concrete entry; generic
  decision-making advice is forbidden.

## Forbidden patterns

- Running the pipeline or any agent from here.
- Insights from fewer than 3 settled contracts.
- Blanket behavioral conclusions ("you are too optimistic") — scope every
  observation to specific contexts.
