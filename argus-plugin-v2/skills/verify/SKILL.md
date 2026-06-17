---
name: verify
description: Verify Argus crew output before it is promoted. Splits claims into supported, challenged, unresolved, and human-required checks, then routes to boss, revise, human check, or Current Bearing. Invoked as `/argus:verify`.
---

# /argus:verify

**What this skill does:** Reads the latest crew output and produces a
`VerificationLedger`. This is immediate pre-commit verification, not future
outcome grading.

**Why this matters:** Argus must not let fluent crew output become a false
bearing. Verification names what can be trusted, what is weak, what remains in
tension, and what only a human/external source can check.

---

## When To Run

Invoke after:

- `/argus:team` has written `workers.json`, `mix.json`, and `scaffold.json`.
- `/argus:sail` is chaining a medium/high decision.
- The user asks whether the output can be trusted.

Refuse when (always say what to do next, never a bare halt):

- no session exists → point to `/argus:sail "<decision>"`.
- latest version has no `workers.json` or `scaffold.json` → point to
  `/argus:team` (or `/argus:sail --resume <id>`).
- only `minimal_scaffold.json` exists → this is not an error; explain in one
  friendly line (user's locale):
  - en: `This was a low-density decision — the minimal scaffold already contains
    its one flip-check, so there is no crew output to verify. To force the full
    pipeline: /argus:sail --full "<problem>".`
  - ko: 같은 의미를 자연스럽게.

---

## Inputs

- `--session <id>`: defaults to latest.
- `--strict`: important challenged claims also block.
- `--invoked-via-sail`: suppress the report and print only one transition line.
- `--no-prompt`: write the ledger without `AskUserQuestion`; for tests.

**Locale:** read `config.locale` from `.argus/config.yaml` at load time. All
user-facing output in this skill — the Step 8 question, the Step 10 report, and
every refusal/transition line — renders in that locale. The templates below are
written in English; translate them naturally for `ko` (labels too: 지지됨 /
반박됨 / 미해결 긴장 / 사람 확인). JSON artifacts stay schema-English.

---

## Execution Steps

### Step 1 - Load State

1. Find the latest session and active version label.
2. Read:
   - `versions/{label}/workers.json`
   - `versions/{label}/mix.json`
   - `versions/{label}/scaffold.json`
   - optional `versions/{label}/debate.json`
   - optional `versions/{label}/repo_context.json`
   - `.argus/config.yaml`
3. Set `session.phase = "verifying"` while the skill runs.

Force a worker's output into challenged claims (do NOT hide it behind a polished mix) if ANY of:
- `status` in {`error`, `verification_failed`} — note `verification_failed` is a distinct status from `error` and must be caught.
- `verification_passed === false`.
- `verification_score < 70` — worker-result.json explicitly contracts that a sub-70 score "must be surfaced as challenged, not silently promoted." `verification_passed` may be `null` while the score is low, so check the score independently.

A worker that failed any of these may still have its claims extracted in Step 2, but they enter Step 4 (negative validation) pre-flagged and cannot become `supported_claims[]` on plausibility alone.

### Step 2 - Extract Claims

Extract 5-9 candidate claims from:

- `mix.sections[].content`
- `scaffold.hidden_assumptions[]`
- `scaffold.next_actions[]`
- `scaffold.team_contradictions[]`

Normalize each candidate:

```json
{
  "id": "c-1",
  "claim": "Short sentence",
  "claim_type": "fact|recommendation|assumption|risk|action",
  "source_worker_ids": ["w-1"],
  "source_text": "quote or paraphrase",
  "needs": ["evidence", "specificity", "cross_agent_consistency", "human_check"]
}
```

Keep the list short. Verification is a gate, not a second report.

### Step 3 - Positive Validation

For each claim, ask:

- Does a worker cite a file path, PR artifact, data point, source, or explicit
  reasoning chain?
- Is the claim tied to this repo/problem?
- Did another worker independently support the same direction?
- Does the worker's assigned framework visibly shape the output?
- If it proposes action, are actor and next step clear?

A claim is `supported` only if it passes **at least 2 of the 5 checks above, AND one of them is Evidence or Cross-agent support** (plausibility/specificity alone is not enough — that is how generic prose sneaks in). A claim from a worker flagged in Step 1 cannot be `supported`. Assign `strength`: `strong` (Evidence + cross-agent), `moderate` (Evidence or cross-agent + one more), `weak` (passes the minimum but on softer checks). **`weak` claims do NOT count toward the headline `supported` count** shown on the final card — list them separately so the card never inflates confidence.

Claims passing become `supported_claims[]`:

```json
{
  "claim": "...",
  "support": "Why this claim is safe enough to use",
  "strength": "strong|moderate|weak",
  "evidence_refs": [{"source": "src/lib/foo.ts", "detail": "line or section"}]
}
```

### Step 4 - Negative Validation

For each claim, ask:

- Does it make a factual claim without evidence?
- Could it be generic consulting prose?
- Does another worker imply the opposite?
- Would acting on it prematurely block a viable path?
- Does it require customer, legal, finance, owner, production, or stakeholder
  confirmation?
- In repo/file/PR mode, did workers fail to cite the relevant artifact?

Claims failing checks become `challenged_claims[]`:

```json
{
  "claim": "...",
  "challenge": "What is wrong or under-evidenced",
  "severity": "critical|important|minor",
  "suggested_fix": "Concrete repair",
  "owner_agent_id": "donghyuk"
}
```

Severity:

- `critical`: final signoff or execution would be unsafe.
- `important`: must be visible in the Current Bearing or fixed.
- `minor`: note it; do not block by itself.

**Do not manufacture minor challenges to fill the ledger.** A genuinely clean,
reversible decision can verify with zero challenges — that is a valid `verified`
outcome, not a failure to find something. Inventing nitpick challenges so the
gate "did work" is over-fire (the mirror clause, CLAUDE.md): it manufactures
ceremony and downstream pushes a needless revise loop. **This restraint is
asymmetric and never applies upward:** a `critical` or `important` challenge is
ALWAYS surfaced — verify's reason to exist is catching the fluent-but-wrong
claim, and burying a real reef to look tidy is the opposite, under-fire failure.
Suppress only the manufactured *minor*, never a real material challenge.

### Step 5 - Preserve Tensions

Convert `debate.json` and `scaffold.team_contradictions[]` into
`unresolved_tensions[]`.

Do not resolve a real conflict in this skill. Verification's job is to expose the unresolved axis and, when derivable, name the tie-breaking condition. `tie_breaking_condition` is carried by `debate.json` but is optional for tensions sourced from `scaffold.team_contradictions[]` (which doesn't store one) — set it when you can infer it, otherwise omit rather than invent.

### Step 6 - Human-Required Checks

Create `human_required_checks[]` from:

- `scaffold.human_required_checkpoints[]`
- challenged claims with a human-only cause
- external checks such as legal counsel, customer interview, budget owner,
  production telemetry, deploy access, or sales data

Each check must say why AI cannot verify it:

```json
{
  "check": "Ask EU counsel whether current GDPR readiness can ship",
  "why_ai_cannot_verify": "Requires legal judgment and internal readiness data",
  "blocks": "final_signoff",
  "estimated_effort": "30-60 min"
}
```

`blocks` takes FOUR values (per the schema): `"execution"` and
`"final_signoff"` gate; `"boss_review"` and `"none"` do NOT. A check that is
merely worth doing is `"none"` and must not flip the overall status to
`blocked` (or the bearing to `collect_evidence`). Most human checks are
`"none"` or `"boss_review"` — reserve the gating values for checks whose
failure genuinely invalidates the course. (The example above gates because
unsigned legal review really does.)

### Step 7 - Route

`routing_decision` is computed as an **ordered if / else-if — first match wins** (these conditions overlap, so precedence is mandatory; flat "defaults" let two routes both claim the same input):

1. **else-if** any human check has `blocks: "execution"` → `stop_for_human_check`. (Highest priority: an execution blocker must never be overridable by a "proceed" choice downstream.)
2. **else-if** any `critical` challenged claim exists → `ask_user`. (Or, under `--no-prompt` where the user can't be asked, escalate to `revise_team` if the repair is agent-owned, otherwise `stop_for_human_check` — never silently `proceed_to_boss` on a critical challenge.)
3. **else-if** `--strict` and any `important` challenged claim exists → `ask_user`.
4. **else-if** there is an agent-owned repair worth a loop — a challenged claim of severity **`important` or above** with an `owner_agent_id` and no human data needed → `revise_team`. `minor` challenged claims NEVER trigger this route, owner or not (their own definition says they don't block; re-running the whole team over a wording nit is the loop-forever failure mode).
5. **else** (challenged claims all minor, no blocking human checks) → `proceed_to_boss`. Minor claims travel forward as visible caveats, not as work orders.

Overall status (also ordered, first match wins):
- `blocked`: any human/external check blocks execution or final signoff.
- `needs_revision`: any `critical` challenged claim (even if not human-required — a critical challenge must never read as merely "mixed"), or an agent-owned repair is required.
- `mixed`: usable with `important` caveats visible.
- `verified`: no challenged claims above `minor` and no blocking checks.

**Compute `confidence` (0-100), a REQUIRED ledger field — do not leave it unset** (boss and the final card read it; an absent value becomes a fabricated number). Derive it, e.g.: start at 100; subtract per challenged claim weighted by severity (critical −30, important −15, minor −5); subtract for each unresolved human-required execution blocker (−20); floor at 0. This is confidence in the verification result, not in the business decision. Record the formula inputs in `claim_tests[]` if helpful.

### Step 8 - Ask Human When Needed

If routing is `ask_user` and `--no-prompt` is not set, use one compact
`AskUserQuestion`.

English:

- Title: `Verification Route`
- Question: `Verification found material issues. How should Argus route this?`
- Options:
  - `Proceed with verified parts`: continue, but challenged claims remain visible
  - `Revise crew output first`: route to `/argus:revise`
  - `Pause for human check`: stop and show human-required checks

Korean:

- Title: `검증 경로`
- Question: `검증에서 중요한 이슈가 나왔습니다. 어떻게 이어갈까요?`
- Options:
  - `검증된 부분만 진행`
  - `먼저 crew output 수정`
  - `사람 확인 후 재개`

Persist the selected option to `ledger.user_choice`.

### Step 9 - Write Ledger

Write `versions/{label}/verification.json` conforming to
`${CLAUDE_PLUGIN_ROOT}/data/schemas/verification-ledger.json`. Include `generated_at`
(current ISO-8601 timestamp) — it is a required field and a downstream validator
rejects a ledger without it.

Update `versions/{label}/scaffold.json`:

```json
"verification": {
  "overall_status": "mixed",
  "supported_count": 4,
  "challenged_count": 2,
  "human_check_count": 1,
  "routing_decision": "proceed_to_boss",
  "top_challenge": "GDPR readiness claim has no cited evidence"
}
```

Also propagate human-only blockers into `human_required_checkpoints[]`. This
keeps the scaffold a single source of truth.

Update `session.json`:

- The ledger lives write-once at `versions/{label}/verification.json` and the verification summary is merged into `versions/{label}/scaffold.json` (both done above) — do NOT copy them into session.json (the skeleton stays thin/conflict-free; downstream reads the version dir).
- `session.phase`:
  - `dm_feedback` when routing is `proceed_to_boss`
  - `team_deploying` when routing is `revise_team`
  - `complete` or `conversing` only when no team/boss path remains
- `updated_at`

### Step 10 - Report

If `--invoked-via-sail`, print one line only:

```text
Evidence checked. Any fog, reef, or human-only check will be folded into the current bearing.
```

Do not print claim counts, ledger counts, routing internals, or agent names.
Sail owns the consolidated Current Bearing.

For direct invocation:

```text
## Argus - Verify - {{label}}

Status: {{overall_status}} ({{confidence}}/100)

Supported:
- {{first supported claim}} - {{support}}

Challenged:
- [{{severity}}] {{claim}}
  -> {{suggested_fix}}

Unresolved tensions:
- {{topic}} - tie-breaker: {{tie_breaking_condition}}

Human checks:
- {{check}} - {{why_ai_cannot_verify}}

Route: {{routing_decision}}
```

Keep this to one terminal screen. Full detail stays in `verification.json`.

---

## Meta-Check Gates

- **No fake certainty:** unsupported claims cannot become supported because they
  sound plausible.
- **No generic praise:** positive validation must cite a concrete reason.
- **No buried blockers:** critical challenged claims must appear in
  `challenged_claims[]` or `human_required_checks[]`.
- **No contradiction averaging:** unresolved tensions remain visible.
- **Human agency:** material routing changes use `AskUserQuestion` unless
  `--no-prompt` was explicitly passed.
- **Current Bearing readiness:** the ledger must identify one best fog/reef item
  that sail can carry into `current_bearing.json`.

---

## Forbidden Patterns

- Treating verification as stakeholder/persona review.
- Rewriting the team's output into a nicer report instead of validating it.
- Saying `verified` when the result only means "no obvious issue found."
- Manufacturing minor challenges so the gate looks like it did work, on a clean
  reversible decision (over-fire — the mirror clause). Zero challenges is a valid
  `verified`. (This never licenses suppressing a critical/important challenge —
  that is the opposite, under-fire failure.)
- Asking the user to grade a past outcome. This skill validates current
  evidence, not future reality.
- Allowing boss review to run on blocked output unless the user explicitly chose
  to proceed with verified parts.
