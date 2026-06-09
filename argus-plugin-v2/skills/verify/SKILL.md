---
name: verify
description: Verify Argus agent-team output before it is promoted. Splits worker claims into supported, challenged, unresolved, and human-required checks, then uses AskUserQuestion when the next route needs human choice. This is the plugin-native quality gate between `/argus:team` and `/argus:boss`: positive validation says what can be trusted; negative validation says what would create false confidence. Invoked as `/argus:verify`.
---

# /argus:verify

**What this skill does:** Reads the latest team output and produces a `VerificationLedger`. The ledger is not post-hoc outcome grading. It is an immediate pre-commit gate over the agent team's own output.

**Why this matters:** The old failure mode was "AI judges AI, then prints a confident answer." Argus must instead show which claims survived scrutiny, which claims were challenged, and which checks still require a human or external artifact. A scaffold is not final because it is well written; it is final only after its verification state is visible.

---

## When to run

Invoke after:
- `/argus:team` has written `versions/{label}/workers.json`, `mix.json`, and `scaffold.json`
- `/argus:sail` is chaining a medium/high density decision
- User explicitly asks "검증해줘", "verify this", "can I trust this output?", or "positive/negative validation"

Refuse when:
- No session exists
- Latest version has no `workers.json` or `scaffold.json`
- Only `minimal_scaffold.json` exists. Minimal mode already contains a one-check flip condition; it does not run team verification.

---

## Inputs

- `--session <id>` optional. Defaults to latest.
- `--strict` optional. Treat important challenged claims as routing blockers.
- `--invoked-via-sail` optional. Suppress the full report and emit only a one-line transition for sail.
- `--no-prompt` optional. Do not AskUserQuestion; write the ledger and return the computed routing decision. Use only in automated tests.

---

## Execution Steps

### Step 1 — Load State

1. Find the latest session and version label.
2. Read:
   - `versions/{label}/workers.json`
   - `versions/{label}/mix.json`
   - `versions/{label}/scaffold.json`
   - `versions/{label}/debate.json` if present
   - `versions/{label}/repo_context.json` if present
   - `.argus/config.yaml` for locale
3. Set `session.phase = "verifying"` while this skill runs.

Force a worker's output into challenged claims (do NOT hide it behind a polished mix) if ANY of:
- `status` in {`error`, `verification_failed`} — note `verification_failed` is a distinct status from `error` and must be caught.
- `verification_passed === false`.
- `verification_score < 70` — worker-result.json explicitly contracts that a sub-70 score "must be surfaced as challenged, not silently promoted." `verification_passed` may be `null` while the score is low, so check the score independently.

A worker that failed any of these may still have its claims extracted in Step 2, but they enter Step 4 (negative validation) pre-flagged and cannot become `supported_claims[]` on plausibility alone.

### Step 2 — Extract Claims

Extract 5-9 candidate claims from `mix` and `scaffold`:
- Each `mix.sections[].content` contains claims.
- `scaffold.hidden_assumptions[]` contains assumptions.
- `scaffold.next_actions[]` contains action claims.
- `team_contradictions[]` contains tension claims.

Normalize claims into this temporary shape:

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

### Step 3 — Positive Validation

For each claim, ask:

- **Evidence:** Does at least one worker cite a file path, PR artifact, data point, source, or explicit reasoning chain?
- **Specificity:** Is the claim tied to this repo/problem, or could it be pasted into any project?
- **Cross-agent support:** Did another worker independently support the same direction?
- **Framework fit:** Does the assigned framework's expected structure appear in the output?
- **Action fit:** If it proposes an action, is actor + next step clear?

A claim is `supported` only if it passes **at least 2 of the 5 checks above, AND one of them is Evidence or Cross-agent support** (plausibility/specificity alone is not enough — that is how generic prose sneaks in). A claim from a worker flagged in Step 1 cannot be `supported`. Assign `strength`: `strong` (Evidence + cross-agent), `moderate` (Evidence or cross-agent + one more), `weak` (passes the minimum but on softer checks). **`weak` claims do NOT count toward the headline `supported` count** shown on the final card — list them separately so the card never inflates confidence.

Claims passing become `supported_claims[]`:

```json
{
  "claim": "...",
  "support": "Why this claim is safe enough to use",
  "strength": "strong|moderate|weak",
  "evidence_refs": [{"source": "w-2", "detail": "cited src/lib/foo.ts:42"}]
}
```

### Step 4 — Negative Validation

For each claim, ask:

- **Unsupported:** Does it make a factual claim without evidence?
- **Generic:** Could it be generic consulting prose?
- **Contradicted:** Does another agent imply the opposite?
- **False-positive risk:** Would acting on this claim prematurely block a viable path?
- **Human-only:** Does it require customer, legal, finance, owner, or stakeholder confirmation?
- **Code-native failure:** In `repo_scan` or `explicit_target` mode, did relevant workers fail to cite files/lines?

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

Use severity this way:
- `critical`: would make final signoff unsafe.
- `important`: should be fixed or shown prominently before boss/user signoff.
- `minor`: note it; do not block.

### Step 5 — Preserve Unresolved Tensions

Convert `debate.json` and `scaffold.team_contradictions[]` into `unresolved_tensions[]`.

Do not resolve a real conflict in this skill. Verification's job is to expose the unresolved axis and, when derivable, name the tie-breaking condition. `tie_breaking_condition` is carried by `debate.json` but is optional for tensions sourced from `scaffold.team_contradictions[]` (which doesn't store one) — set it when you can infer it, otherwise omit rather than invent.

### Step 6 — Human-Required Checks

Create `human_required_checks[]` from:
- Existing `scaffold.human_required_checkpoints[]`
- Challenged claims with `human-only` cause
- Boss-independent external checks: legal counsel, customer interview, budget owner, production telemetry, deploy access, sales/customer data

Each check must say why AI cannot verify it from the current repo/session:

```json
{
  "check": "Ask EU counsel whether 70% GDPR readiness can ship",
  "why_ai_cannot_verify": "Requires licensed legal judgment and current internal readiness data",
  "blocks": "final_signoff",
  "estimated_effort": "30-60 min"
}
```

### Step 7 — Routing Decision

`routing_decision` is computed as an **ordered if / else-if — first match wins** (these conditions overlap, so precedence is mandatory; flat "defaults" let two routes both claim the same input):

1. **else-if** any human check has `blocks: "execution"` → `stop_for_human_check`. (Highest priority: an execution blocker must never be overridable by a "proceed" choice downstream.)
2. **else-if** any `critical` challenged claim exists → `ask_user`. (Or, under `--no-prompt` where the user can't be asked, escalate to `revise_team` if the repair is agent-owned, otherwise `stop_for_human_check` — never silently `proceed_to_boss` on a critical challenge.)
3. **else-if** `--strict` and any `important` challenged claim exists → `ask_user`.
4. **else-if** there is an agent-owned repair (a challenged claim with an `owner_agent_id` and no human data needed) → `revise_team`.
5. **else** (challenged claims all minor, no blocking human checks) → `proceed_to_boss`.

Overall status (also ordered, first match wins):
- `blocked`: any human/external check blocks execution or final signoff.
- `needs_revision`: any `critical` challenged claim (even if not human-required — a critical challenge must never read as merely "mixed"), or an agent-owned repair is required.
- `mixed`: usable with `important` caveats visible.
- `verified`: no challenged claims above `minor` and no blocking checks.

**Compute `confidence` (0-100), a REQUIRED ledger field — do not leave it unset** (boss and the final card read it; an absent value becomes a fabricated number). Derive it, e.g.: start at 100; subtract per challenged claim weighted by severity (critical −30, important −15, minor −5); subtract for each unresolved human-required execution blocker (−20); floor at 0. This is confidence in the verification result, not in the business decision. Record the formula inputs in `claim_tests[]` if helpful.

### Step 8 — Ask Human When Needed

If routing is `ask_user` and `--no-prompt` is not set, use AskUserQuestion. This is the terminal human-choice affordance the plugin should lean into: one compact choice, not a long chat.

**ko**
- Title: `검증 결과 선택`
- Question: `검증에서 {{critical_count}}개 critical / {{important_count}}개 important 이슈가 나왔습니다. 어떻게 처리할까요?`
- Options:
  - `검증 통과분만 진행` — proceed to boss/final card, but challenged claims stay visible
  - `팀 보완 후 다시 검증` — route to team revision; do not call boss yet
  - `사람 확인 후 재개` — stop and show human_required_checks

**en**
- Title: `Verification Route`
- Question: `Verification found {{critical_count}} critical / {{important_count}} important issue(s). How should Argus route this?`
- Options:
  - `Proceed with verified parts` — proceed to boss/final card, challenged claims remain visible
  - `Revise team output first` — route back for agent repair before boss
  - `Pause for human check` — stop and show human_required_checks

Persist the selected option to `ledger.user_choice`.

If the user chooses:
- `검증 통과분만 진행` / `Proceed with verified parts` → set `routing_decision = "proceed_to_boss"` and `overall_status = "mixed"` unless it was already `verified`
- `팀 보완 후 다시 검증` / `Revise team output first` → set `routing_decision = "revise_team"` and `overall_status = "needs_revision"`
- `사람 확인 후 재개` / `Pause for human check` → set `routing_decision = "stop_for_human_check"` and `overall_status = "blocked"`

### Step 9 — Write Ledger

Write `versions/{label}/verification.json` conforming to `~/.claude/argus-data/schemas/verification-ledger.json`.

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

Also propagate critical/important challenged claims into `human_required_checkpoints[]` when a human check is needed. This keeps the scaffold a single source of truth.

Update `session.json`:
- The ledger lives write-once at `versions/{label}/verification.json` and the verification summary is merged into `versions/{label}/scaffold.json` (both done above) — do NOT copy them into session.json (the skeleton stays thin/conflict-free; downstream reads the version dir).
- `session.phase`:
  - `dm_feedback` when routing is `proceed_to_boss`
  - `team_deploying` when routing is `revise_team`
  - `complete` or `conversing` only when no team/boss path remains
- `updated_at`

### Step 10 — Report

#### If `--invoked-via-sail`

Print one line only:

```text
✓ Verify — {{overall_status}} · {{supported_count}} supported · {{challenged_count}} challenged · {{human_check_count}} human checks
```

Sail owns the consolidated decision card.

#### Direct Invocation

Render:

```text
## Argus · Verify · {{label}}

**Status:** {{overall_status}} ({{confidence}}/100)

**Supported ({{N}}):**
- {{first supported claim}} — {{support}}

**Challenged ({{N}}):**
- [{{severity}}] {{claim}}
  → {{suggested_fix}}

**Unresolved tensions ({{N}}):**
- {{topic}} — tie-breaker: {{tie_breaking_condition}}

**Human checks ({{N}}):**
- {{check}} — {{why_ai_cannot_verify}}

**Route:** {{routing_decision}}
```

Keep this to one terminal screen. Full detail stays in `verification.json`.

---

## Meta-Check Gates

- **No fake certainty:** If a claim lacks evidence, it cannot be supported just because it sounds plausible.
- **No generic praise:** Positive validation must cite a real reason, not "good structure."
- **No buried blockers:** Critical challenged claims must appear in either `challenged_claims[]` or `human_required_checks[]`.
- **No contradiction averaging:** Unresolved tensions remain unresolved unless a concrete tie-breaking condition is met.
- **Human agency:** When routing materially changes the user's path, use AskUserQuestion unless `--no-prompt` was explicitly passed.

---

## Forbidden Patterns

- Treating verification as a stakeholder/persona review. Boss is personality feedback; verify is claim-level quality control.
- Rewriting the team's output into a nicer report instead of validating it.
- Saying "verified" when verification only means "no obvious issue found."
- Asking the user to grade a past outcome. This skill validates current evidence, not future reality.
- Allowing boss review to run on `blocked` output unless the user explicitly chose to proceed with verified parts.
