---
name: journal
user-invocable: false
description: The decision log — a one-screen view across ALL Argus sessions in this project; recent decisions and their courses, sealed contracts, settled outcomes, and your calibration record. Read-only and mechanical by default; `--insights` adds one LLM-written pattern note once enough contracts are settled. Use when the user asks "what have I decided here", "show my track record", "how good are my predictions", or wants the decision history. Invoked as `/argus:journal`.
---

# /argus:journal

**What this skill does:** Aggregates the project's decision history —
`.argus/sessions/` + `.argus/ledger/ledger.jsonl` — into one screen. This is
the view that makes the accumulated history visible: what was decided, what
was predicted, and how those predictions fared.

`/argus:versions` is depth (one session's version tree); `/argus:journal` is breadth
(every decision in the project).

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
   "minimal". Missing both → "in progress". **A session dir with a read
   but no readable `session.json`** (webapp emission, partial sync) still
   counts as a decision — render it degraded from the read
   (`current_course.summary` in place of `problem_text`, date from
   `generated_at`); never show "Decisions: 0" next to "Contracts: 1 sealed".
2. **Ledger:** replay `.argus/ledger/ledger.jsonl` by id (`seal` opens,
   `amend` updates, `settle`/`dismiss` closes; skip unparsable lines).
   Compute: sealed count, open contracts (with next/overdue check-by dates),
   settled outcomes tally (happened / avoided / partial).
3. **Pattern-eligibility (mechanical — compute HERE, gate Step 3 BEFORE any LLM
   call; R33).** From the settled contracts compute `T` = settled count and
   `domains` = number of distinct decision domains they span. Set `pattern_strength`:
   - `T < 3` → `none` (the ≥3 gate; --insights refuses).
   - `3 ≤ T ≤ 5` → `counts_only`.
   - `6 ≤ T ≤ 10` → `tendency`.
   - `T ≥ 11` → `rule`.
   Then **downgrade one level (never above `counts_only`) when the entries are
   scattered** — `domains` high relative to `T` (e.g. T=4 across 4 unrelated
   areas): scattered settles are a thin record, not a pattern. This number, not
   the LLM's judgment, decides how strong a claim Step 3 may make — a small-n
   correlation stated as a "rule"/"mechanism"/"the only variable" is the over-claim
   a skeptic breaks every time (R33: 0/6 headline claims survived), and on a
   noisy record it is a manufactured-meaning spine violation (gate before form,
   rounds 5-8).

If `.argus/` is missing or holds no sessions and no ledger: print one line —
`No decisions logged yet. Start one: /argus:sail "<your decision>"` — and stop.

## Step 2 — Render (one screen)

```text
## Argus - Decision Log ({{project dir name}})

Decisions: {{total}} ({{complete}} complete · {{in_progress}} underway)

Recent:
  {{date}}  {{problem_text clipped 48}}  → {{course status or "minimal" or "underway"}}
  {{...latest 8, newest first; "--all" lists everything}}

Contracts: {{sealed}} sealed · {{open}} open{{if overdue}} · {{overdue}} OVERDUE{{endif}}
Record:    held {{h}} · missed {{a}} · partial {{p}}{{if T==0}} (nothing settled yet){{endif}}
{{if overdue}}Next: /argus:resolve — {{overdue}} contract(s) past check-by{{endif}}
{{if !overdue && open}}Next check-by: {{nearest date}} — "{{predicate clipped 60}}"{{endif}}

Reopen a decision: /argus:versions --session <id> · /argus:sail --resume <id>
```

Keep it under one terminal screen. No worker counts, no schema names, no
machinery — same surface rules as the current call.

## Step 3 — `--insights` (optional, the only LLM use)

Only when `pattern_strength != none` (Step 1). **Claim STRENGTH is bound to the
sample size — this is the load-bearing rule (R33).** The n=1 value is real, but
the moat is *over-sold* the moment a 4-7-entry correlation is stated as a rule:

- `counts_only` (3-5 settled): **frequency counts + single-entry observations
  ONLY.** e.g. "X를 먼저 확인한 3건 중 2건이 held." NO causal language, NO
  direction ("과대/과소 추정한다"), NO "유일한 변수", NO mechanism, NO "패턴/규칙".
  Say plainly it is too few for a pattern: "아직 패턴이라기엔 적어요 (정산 {{T}}건)."
- `tendency` (6-10): a hedged tendency, scoped to the record ("이 기록에선 ~한
  경향") — never a law.
- `rule` (11+): may be stated as a pattern, still scoped to the user's own log.

Prompt yourself with the settled predicates + outcomes + recent unknown/risk items
**plus the `basis` (reasoned/luck/external) and unknown/risk tags VERBATIM** — do NOT
re-infer or relabel a tag the user/engine already set (R33: weak models relabel a
`luck`/`mixed` win as a skill-win, or a `unknown` as a `risk`; the ledger tag is
ground truth — quote it). Wrap all in `<user-data>`. Produce AT MOST 3 lines,
each grounded in a SPECIFIC entry, at the strength `pattern_strength` allows:

- one observation in held-vs-missed (cite entries, not vibes);
- one unknown/risk theme **only if it genuinely recurs** (a single occurrence is not
  a theme — stay silent rather than inflate one entry);
- one suggestion as reference, not directive ("worth one extra check when X" —
  never "be more conservative").

**Quarantine-but-count, never drop (R33).** Do NOT omit a counterexample or a
`luck`-tagged win to make a cleaner claim. A lucky win is NOT a skill win — keep
it on the record but quarantine it from the skill claim ("held 3건 중 1건은 본인이
운으로 표시"). Silently dropping the inconvenient entry to state a clean pattern is
the exact over-claim a skeptic breaks.

**Authorship quarantine (R57/R58 — parity with the webapp `betsHeldAiSurfaced`).**
A held seal carrying `author:"user"` (the Phase-1 BIND lean from clarify Step 3.4) IS
the user's own prediction — count it as a skill claim. A held seal WITHOUT `author`
(the AI-surfaced seed from sail Step 7) is the engine's belief, not the user's bet —
quarantine it from the skill claim exactly like a luck win ("held 3건 중 1건은 AI가
세운 가설"). Never let a machine-surfaced seed inflate the user's calibration.

**No-pattern honesty is mechanical, not discretionary.** If `pattern_strength` is
`none`, or Step 1 downgraded for scatter, say EXACTLY that in one line — "아직
패턴이라기엔 신호가 약해요 (정산 {{T}}건 · {{domains}} 영역) — 더 쌓이면 같이
봐요." — and stop. A forced insight on a thin/noisy record is a manufactured-meaning
spine violation, not thoroughness.

Close with ONE quiet scoping line (the irreducible small-n residual, disclosed not
hidden): "당신 자신의 (아직 적은) 기록에 대한 관찰이에요 — 법칙이 아니라 참고고,
건수에 맞춰 말했어요."

If an observation genuinely recurs and the user might want to keep it, add ONE
optional pointer (not a nudge, no verb-in-Argus's-voice): "이 중 하나를 당신
원칙으로 남기고 싶으면 → /argus:principles." Omit it entirely when `pattern_strength`
is `counts_only` or nothing recurred — there is nothing worth codifying yet.

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
