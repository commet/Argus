---
name: verify
description: Verify Argus reviewer output before promotion. Splits claims into supported, challenged, unresolved, and human-required checks. Not for future outcomes; those return through `/argus:check`. Runs only inside `/argus:review`.
---

# verify step — part of /argus:review (formerly /argus:verify)

**What this skill does:** Reads the latest reviewers output and produces a
`VerificationLedger`. This is immediate pre-commit verification, not future
outcome grading.

**Why this matters:** Argus must not let fluent reviewers output become a false
read. Verification names what can be trusted, what is weak, what remains in
tension, and what only a human/external source can check.

---

## When To Run

Invoke after:

- `team.md` has written `workers.json`, `mix.json`, and `scaffold.json`.
- `/argus:review` is chaining a medium/high decision.
- The user asks whether the output can be trusted.

Refuse when (always say what to do next, never a bare halt):

- no session exists → point to `/argus:review "<decision>"`.
- latest version has no `workers.json` or `scaffold.json` → point to
  `team.md` (or `/argus:review --resume <id>`).
- only `minimal_scaffold.json` exists → this is not an error; explain in one
  friendly line (user's locale):
  - en: `This was a low-density decision — the minimal scaffold already contains
    its one flip-check, so there is no reviewers output to verify. To force the full
    pipeline: /argus:review --full "<problem>".`
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
   - optional `versions/{label}/team_plan.json` — the `stages[]` map (which
     worker ran in stage-1 vs stage-2). Needed for the lineage echo check in
     Step 3 (a stage-2 critic read stage-1, so its repetition is downstream).
     Absent → treat all workers as stage-1 while still assigning zero reality
     independence to the full synthetic set.
   - `versions/{label}/perspective_set.json` for new writes. A missing file on a
     pre-J2 version is a legacy read, not permission to synthesize lineage:
     record `synthetic_independence_units: 1`, `strongest_dissent.kind:
     "none_found"` with search method `"legacy artifact lacks dissent
     provenance"`, and an unknown/reality-check item. New team writes without
     this artifact are invalid and must route to repair.
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

**`source_worker_ids` is mandatory and is what makes Step 1's flagging
enforceable.** The extraction sources must preserve worker attribution so it can
be filled: `mix.sections[]` carry the contributing worker id(s) (team Step 8
records which worker(s) fed each section); `scaffold.hidden_assumptions[]` /
`next_actions[]` / `team_contradictions[]` likewise trace to their originating
worker(s). When a candidate cannot be traced to any worker (pure synthesis), set
`source_worker_ids: ["synthesizer"]` — never leave it empty (an untraceable claim
must not silently escape the flag). A claim whose `source_worker_ids` intersects
the **Step 1 flagged-worker set** is pre-flagged: it skips Step 3 and enters Step 4
already challenged, and cannot become `supported_claims[]` on plausibility alone.
A `["synthesizer"]`-only claim (pure synthesis, no domain worker behind it) likewise
enters Step 4 **pre-flagged** — it needs real evidence to pass. The Synthesizer is the
synthesizer and never appears in the flagged-worker set, so without this rule an
untraceable synthesis claim would be structurally exempt from every flag.

Keep the list short. Verification is a gate, not a second report.

### Step 3 - Positive Validation

For each claim, ask:

- **Evidence:** Does a worker cite a file path, PR artifact, data point, source,
  or explicit reasoning chain?
- **Specificity:** Is the claim tied to this repo/problem?
- **Cross-agent consistency:** Did another worker **actively make the same or a
  compatible claim**? This is useful for detecting drift and contradiction, but
  it is a synthetic coverage check only. **It never supplies evidence, never
  satisfies the required support condition, and never raises strength or
  confidence.** Silence and non-contradiction are not even consistency signals.
  - **Lineage echo guard:** a worker that did NOT read another worker before
    writing is less contaminated for contradiction coverage, but is still not
    independent reality evidence. A **stage-2** critique
    worker (e.g. risk-reviewer) is *given* specialist results as input, so
    its matching statement is downstream restatement, not corroboration, and
    is explicitly an echo. Its *challenges* still count as negative signal in
    Step 4; its agreement adds no positive weight.
- **Framework:** Does the worker's assigned framework visibly shape the output?
- **Action clarity:** If it proposes action, are actor and next step clear?

A claim is `supported` only if it passes **Evidence plus at least one other
check**. Plausibility, specificity, framework quality, or repeated agent wording
without a cited/inspectable basis is not support. A `claim_type: fact` still
requires Evidence and cannot become true through worker agreement. A claim from
a worker flagged in Step 1 cannot be `supported`. Assign `strength` from source
quality and verification depth: `strong` requires direct evidence plus a second
independent source/reality locator; `moderate` requires direct evidence plus one
other non-count check; `weak` is bounded/indirect evidence. Worker count and
cross-agent repetition never affect strength. **`weak` claims do NOT count
toward the headline `supported` count** shown on the final card.

**Qualifier fidelity (mix-laundering guard).** Claims were extracted from the
*synthesized* `mix.sections[]`, not the worker's words. Before granting
`supported` to a load-bearing or `external` claim, trace it back to the
originating worker in `workers.json` (via the section's `contributor_worker_ids`
/ the claim's `source_worker_ids`) and compare. If the worker attached a
**material condition** the mix dropped — a qualifier whose absence changes
whether the claim holds (`"if adoption holds"`, `"assuming X"`, `"pending Y"`,
`"in the optimistic case"`) — the claim is NOT `supported` as stated. Either
re-state it WITH the condition, or route the condition itself as a challenged
claim / `hidden_assumption`. **Mere compression is fine** — shorter wording with
the same meaning passes; only a dropped *material* condition fails. (verify
already loads `workers.json` in Step 1; this is what makes that load do work.)

Claims passing become `supported_claims[]`:

```json
{
  "claim": "...",
  "support": "Why this claim is safe enough to use",
  "strength": "strong|moderate|weak",
  "evidence_refs": [{"source": "src/lib/foo.ts", "detail": "line or section"}]
}
```

### Step 3.5 - Grounding + Load-Bearing Pass (find the reality risk)

The deepest failure this gate must catch is NOT an internal wording slip — it is
a claim **only reality can confirm** that the conclusion rests on and that nobody
checked against reality. The agents all agreeing proves nothing about the world.
Two cheap, **checkable** tags per claim (no prose-inference, no graph solver):

**(a) Grounding — internal vs external.** Tag each claim:
- `internal` — the agents can confirm it: logic, arithmetic, code/in-repo
  citation, a source they can read.
- `external` — only reality confirms it: market size, a regulator's actual
  position, a customer's actual want, performance at real scale, a third party's
  behavior. **Cross-agent agreement is NOT confirmation of an `external` claim**
  (the second agent is the same model restating the first).

**(b) Load-read — STRUCTURAL anchors only.** A claim is load-bearing iff a
`scaffold.next_actions[]` entry lists it in `rests_on`, or `current_course`
rests on it. Record those anchors:

```json
"depended_on_by": ["action:eu-rollout", "action:eu-payment"]
```

**Do NOT infer claim-to-claim dependencies from prose** — the model
co-generated both claims, so "X assumes Y" is always *plausible* and never
*checkable*. Only a structural anchor (an action's `rests_on`, the course)
counts. No anchor → `depended_on_by: []`. This is what stops a fabricated edge
from silently escalating severity (the over-fire failure, mirror clause).

The risk = a claim that is **`external` AND load-bearing AND not confirmed by a
real-world source**. That intersection — not "most-depended-on claim" — is where
a real decision actually goes wrong.

### Step 4 - Negative Validation

For each claim, ask:

- Does it make a factual claim without evidence?
- Could it be generic consulting prose?
- Does another worker imply the opposite?
- Would acting on it prematurely block a viable path?
- Does it require customer, legal, finance, owner, production, or stakeholder
  confirmation?
- In repo/file/PR mode, did workers fail to cite the relevant artifact?
- In repo/file/PR mode, is the claim specific enough for a developer to act on:
  a named file/path, changed surface, failure mode, missing/decisive test, or
  concrete next patch? If not, challenge it as generic even if it sounds true.

Claims failing checks become `challenged_claims[]`:

```json
{
  "claim": "...",
  "challenge": "What is wrong or under-evidenced",
  "severity": "critical|important|minor",
  "suggested_fix": "Concrete repair",
  "owner_agent_id": "risk-reviewer"
}
```

Severity:

- `critical`: final signoff or execution would be unsafe.
- `important`: must be visible in the current call or fixed.
- `minor`: note it; do not block by itself.

**Developer-output gate.** For `repo_context.mode` in `explicit_target` or
`repo_scan`, a claim cannot be promoted to headline support unless at least one
`evidence_refs[]` item names a concrete repo artifact (file path, PR ref, test,
route, migration, API endpoint, config file, or command output). Worker prose
such as "the auth flow may regress" is not support; it must become a challenged
claim with a repair like "read `<file>` and add/check `<test>`." If the team
looked at a PR/file but the verifier cannot name the affected surface, route to
`revise_team` or `stop_for_human_check` instead of emitting a confident read.

**Grounding-driven handling — generate first, then flag, gate only when it must.**
Being `external` is NOT a reason to withhold the answer. Argus's spine is *maximum
generation*: still give the substantive read — the estimate, base rate, indirect
evidence, the likely answer — and let Step 3 support it on that basis, labeled
`external` (reality-pending). Tagging `external` marks *who can finally confirm
it*, not *whether Argus may help with it*. Then key handling off the checkable
tags, never an inferred prose edge:

- **`external` + load-bearing.** This is the one the conclusion rests on that
  only reality settles, so it does NOT route as an agent-fixable
  `challenged_claim`. It always becomes a **`human_required_checks[]` entry**, but
  whether it **GATES depends on stakes × reversibility**:
  - **high-stakes AND hard-to-reverse** (an irreversible commit, regulated
    exposure, money/legal/safety that can't be unwound) → `blocks:
    "final_signoff"` / `"execution"`, recorded as the `root_crack` (Step 9). The
    agents' agreement must never let this read as `verified`.
  - **reversible / low-stakes** → `blocks: "none"` (proceed-aware). Surface
    Argus's best read + the one cheap check; do NOT block a decision the user can
    walk back. Blocking the reversible is over-fire (mirror clause).
  - Either way the entry is **armed, not a referral**: name *who/what* confirms,
    *what a "yes" looks like*, and Argus's *best estimate meanwhile* (Step 6 /
    Step 9 fields). "Go verify GDPR" is a cop-out; "ask the DPO whether the signed
    DPA + RoPA exist; absent in 48h, treat readiness as incomplete — base rate
    says self-declared compliance is wrong ~X% of the time" is help.
- **`internal` + load-bearing** (a logic/code/math claim an action rests on):
  the agents *can* check it, so do — floor it at `important` and demand the
  Evidence check actually pass. Not a reality gate; a verify-harder item.
- **leaf claims** (no structural anchor): judged on their own merits; a weak leaf
  stays `minor`.

Asymmetric and bounded: only a *structural* anchor escalates, only an *external +
high-stakes-irreversible* anchor gates. A fabricated dependency can't manufacture
a block, a reversible call isn't walled off, and a real external premise on a
big irreversible bet can't hide as a note.

**Do not manufacture minor challenges to fill the ledger.** A genuinely clean,
reversible decision can verify with zero challenges — that is a valid `verified`
outcome, not a failure to find something. Inventing nitpick challenges so the
gate "did work" is over-fire (the mirror clause, CLAUDE.md): it manufactures
ceremony and downstream pushes a needless revise loop. **This restraint is
asymmetric and never applies upward:** a `critical` or `important` challenge is
ALWAYS surfaced — verify's reason to exist is catching the fluent-but-wrong
claim, and burying a real risk to look tidy is the opposite, under-fire failure.
Suppress only the manufactured *minor*, never a real material challenge.

### Step 5 - Preserve Tensions

Convert `debate.json` and `scaffold.team_contradictions[]` into
`unresolved_tensions[]`.

Do not resolve a real conflict in this skill. Verification's job is to expose the unresolved axis and, when derivable, name the tie-breaking condition. `tie_breaking_condition` is carried by `debate.json` but is optional for tensions sourced from `scaffold.team_contradictions[]` (which doesn't store one) — set it when you can infer it, otherwise omit rather than invent.

### Step 5.5 - Preserve dissent provenance and honest gaps

Copy and validate the perspective firewall into the ledger:

- `synthetic_independence_units` is always `1`.
- Preserve `strongest_dissent.kind`, statement, source refs, and search method.
  Never relabel an elicited counter-lens as observed dissent.
- Write `unknowns_that_block_judgment[]` and `reality_check_questions[]` on every
  ledger, even when empty after a documented search.
- Add load-bearing external gaps found in Steps 3.5/4 even when the perspective
  set missed them. Never remove a source unknown because several workers agreed.
- These fields do not add claim support and never create an E SupportUnit.

### Step 6 - Human-Required Checks

Create `human_required_checks[]` from:

- `scaffold.human_required_checkpoints[]`
- challenged claims with a human-only cause
- external checks such as legal counsel, customer interview, budget owner,
  production telemetry, deploy access, or sales data
- **named-but-not-run checks (missed-check).** A worker explicitly named a
  verification as a *precondition for relying on a claim* — "load-test before
  trusting this", "confirm with legal", "benchmark before quoting the number" —
  and no `supported_claims[]` evidence shows it was actually run. Surface it with
  `why_ai_cannot_verify: "named by the reviewers as needed but not run"`.
  **Tightly scoped (mirror clause — do not turn every 'should' into a wall):**
  only when (a) a worker framed it as a *precondition*, not a vague "might also
  consider," AND (b) it is tied to a load-bearing claim or a `next_action`. A soft
  suggestion on a leaf is NOT surfaced. **Default `blocks: "none"`** (a worth-doing
  to-do, not a gate); escalate to `final_signoff`/`execution` only when the unrun
  check sits on a load-bearing claim whose failure is unsafe or irreversible (there
  it coincides with the reality risk / a critical gate). On a routine or reversible
  decision a missed soft check stays unsurfaced.

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
`blocked` (or the read to `collect_evidence`). Most human checks are
`"none"` or `"boss_review"` — reserve the gating values for checks whose
failure genuinely invalidates the course. (The example above gates because
unsigned legal review really does.)

### Step 7 - Route

`routing_decision` is computed as an **ordered if / else-if — first match wins** (these conditions overlap, so precedence is mandatory; flat "defaults" let two routes both claim the same input):

1. **else-if** any human check has `blocks: "execution"` → `stop_for_human_check`. (Highest priority: an execution blocker must never be overridable by a "proceed" choice downstream.)
2. **else-if** any `critical` challenged claim exists → `ask_user`. (Or, under `--no-prompt` where the user can't be asked, escalate to `revise_team` if the repair is agent-owned, otherwise `stop_for_human_check` — never silently `proceed_to_boss` on a critical challenge.)
3. **else-if** `--strict` and any `important` challenged claim exists → `ask_user`.
4. **else-if** there is an agent-owned repair worth a loop — a challenged claim of severity **`important` or above** with an `owner_agent_id` and no human data needed — **AND the revise loop has not converged-out**: `session.revise_cycles < session.max_revise_cycles` (default 3) AND this claim is **not a repeat** of one already challenged in the immediately-prior verification on this lineage → `revise_team`. `minor` challenged claims NEVER trigger this route, owner or not (their own definition says they don't block; re-running the whole team over a wording nit is the loop-forever failure mode). **If the only agent-owned repair is a repeat claim, or `revise_cycles` has reached the cap → `stop_for_human_check`** and write that claim to `human_required_checks[]` with `reason: "unconverged_after_revision"` (cap reached → `reason: "max_revisions_reached"`). Re-looping the team on a claim it already failed to fix is wasted ceremony; escalation to a human is the honest exit, not another auto-pass. **When the unconverged claim was `critical`, the escalated `human_required_checks[]` entry MUST gate** — set `blocks: "final_signoff"` (or `"execution"` if acting before the check is unsafe), never `"none"`. A never-fixed critical claim must not land as a non-gating note; a `blocks: "none"` check would leave `overall_status` off `blocked` and let the read read as proceedable.
5. **else** (challenged claims all minor, no blocking human checks) → `proceed_to_boss`. Minor claims travel forward as visible caveats, not as work orders.

Overall status (also ordered, first match wins):
- `blocked`: any human/external check blocks execution or final signoff.
- `needs_revision`: any `critical` challenged claim (even if not human-required — a critical challenge must never read as merely "mixed"), or an agent-owned repair is required.
- `mixed`: usable with `important` caveats visible.
- `verified`: no challenged claims above `minor` and no blocking checks.

**Compute `confidence` (0-100), a REQUIRED ledger field — do not leave it unset** (boss and the final card read it; an absent value becomes a fabricated number). Derive it, e.g.: start at 100; subtract per challenged claim weighted by severity (critical −30, important −15, minor −5); subtract for each unresolved human-required blocker that **gates — `execution` OR `final_signoff`** (−20 each); floor at 0. **And when `overall_status == blocked`, cap `confidence` at 50** — a blocked result must never read as near-trustworthy (the bug this closes: `blocked (85/100)`, where a `final_signoff` blocker subtracted nothing). This is confidence in the verification result, not in the business decision. Record the formula inputs in `claim_tests[]` if helpful.

Agent count, model diversity, recurring synthetic concerns, seat authority, and
cross-agent agreement add exactly zero confidence points.

### Step 8 - Ask Human When Needed

If routing is `ask_user` and `--no-prompt` is not set, use one compact
`AskUserQuestion`.

English:

- Title: `Verification Route`
- Question: `Verification found material issues. How should Argus route this?`
- Options:
  - `Proceed with verified parts`: continue, but challenged claims remain visible
  - `Revise reviewers output first`: route to `revise.md`
  - `Pause for human check`: stop and show human-required checks

Korean:

- Title: `검증 경로`
- Question: `검증에서 중요한 이슈가 나왔습니다. 어떻게 이어갈까요?`
- Options:
  - `검증된 부분만 진행`
  - `검토 결과 먼저 수정`
  - `사람 확인 후 재개`

Persist the selected option to `ledger.user_choice`.

### Step 9 - Write Ledger

Write `versions/{label}/verification.json` conforming to
`${CLAUDE_PLUGIN_ROOT}/data/schemas/verification-ledger.json`. Include `generated_at`
(current ISO-8601 timestamp) — it is a required field and a downstream validator
rejects a ledger without it.

The ledger MUST include `synthetic_independence_units: 1`, `strongest_dissent`,
`unknowns_that_block_judgment[]`, and `reality_check_questions[]` from Step 5.5.

**Compute `root_crack`** — set it ONLY for the **gating** reality risk: the
load-bearing, `external`, unconfirmed claim on a **high-stakes, hard-to-reverse**
decision (Step 4). It carries *armed help*, never a bare referral:

```json
"root_crack": {
  "claim_id": "c-1",
  "claim": "GDPR readiness is already complete",
  "grounding": "external",
  "depended_on_by": ["action:eu-payment", "action:eu-rollout"],
  "why": "Payment go-live and the EU rollout rest on this; only counsel/regulator can confirm it",
  "best_read": "Self-declared 'done' with no DPA/RoPA/DPIA cited usually means a checklist was run, not production data-flows signed off — treat as likely-incomplete until shown otherwise.",
  "cheapest_check": "Ask the DPO/counsel for the signed DPA + RoPA + DPIA. A 'yes' = those three documents exist and cover payment processing. Absent within 48h, treat readiness as incomplete."
}
```

**`root_crack` is `null`** when no load-bearing external claim sits on a
high-stakes irreversible decision — a reversible call or an internal-only
decision has no gating risk (the external check still ships as a non-gating armed
note, just not here). Do NOT promote an `internal` claim, a leaf, or a reversible
external claim here (over-fire / mirror clause).

**Connection to the seal→settle loop (timing matters).** A *gating* risk does NOT
itself seed a contract — a blocked decision is not yet a commitment, so there is
nothing to seal. It surfaces as `fog_or_reef` + the gating human check (sail
Assembly Priority handles this). The seal happens on the **proceed** path: once
the risk is resolved (or when a *reversible* external load-bearing assumption is
carried on a proceeding course), that external claim is the natural
`contract_seed` predicate — sail Step 7 prefers it. Same insight (only reality
settles it), correct timing (seal when you commit, not when you are blocked).

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
Evidence checked. Any unknown, risk, or human-only check will be folded into the current read.
```

Do not print claim counts, ledger counts, routing internals, or agent names.
Sail owns the consolidated current call.

For direct invocation:

```text
## Argus - Verify - {{label}}

Status: {{overall_status}} ({{confidence}}/100)

Supported:
- {{first supported claim}} - {{support}}

Challenged:
- [{{severity}}] {{claim}}
  -> {{suggested_fix}}
{{if root_crack}}
Reality check needed (the course rests on this; only reality confirms it):
  {{root_crack.claim}} — {{root_crack.why}}
{{endif}}
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
- **current call readiness:** the ledger must identify one best unknown/risk item
  that sail can carry into `current_bearing.json`.

---

## Error Modes

Apply the plugin's defensive-read discipline (same as clarify) to every artifact
read in Step 1:

- **Missing `workers.json` / `mix.json` / `scaffold.json`:** there is nothing to
  verify. Halt with the minimal-scaffold redirect (point to `team.md` or
  `/argus:review --resume`); do not fabricate claims from an empty input.
- **Corrupt / unparseable artifact:** quarantine it to `<name>.corrupt.<ts>` and
  report the recovery path; do not crash and do not silently treat a corrupt file
  as empty (an unreadable `workers.json` is NOT "zero workers" — that would
  produce a falsely clean `verified`). If only `mix.json` is corrupt but
  `workers.json` is intact, re-derive claims from the workers directly and note
  the degraded source.
- **Partial write (process killed mid-write):** a `workers.json` short of the
  planned worker set is interrupted, not complete — defer to sail Step 3's
  interrupted-mid-team handling (re-run team) rather than verifying a partial set.
- **Empty / absent `debate.json` / `repo_context.json`:** these are optional;
  treat absent as "none," not an error.

A corrupt-read must never resolve to a higher confidence than the true state.

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
