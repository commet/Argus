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

Refuse when:

- no session exists,
- latest version has no `workers.json` or `scaffold.json`,
- only `minimal_scaffold.json` exists.

Minimal mode already contains a one-check flip condition; it does not need team
verification.

---

## Inputs

- `--session <id>`: defaults to latest.
- `--strict`: important challenged claims also block.
- `--invoked-via-sail`: suppress the report and print only one transition line.
- `--no-prompt`: write the ledger without `AskUserQuestion`; for tests.

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

If any worker has `status: "error"` or `verification_passed === false`, carry
that into `challenged_claims[]`. Do not hide it behind a polished mix.

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

Claims passing enough checks become `supported_claims[]`:

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

### Step 5 - Preserve Tensions

Convert `debate.json` and `scaffold.team_contradictions[]` into
`unresolved_tensions[]`.

Do not resolve a real conflict here. Verification exposes the axis and names the
tie-breaking condition.

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

### Step 7 - Route

Compute:

- Any blocking human check with `blocks: "execution"` ->
  `routing_decision = "stop_for_human_check"`.
- Any critical challenged claim -> `routing_decision = "ask_user"`.
- `--strict` plus any important challenged claim -> `routing_decision = "ask_user"`.
- Agent-owned repair with no missing human evidence -> `routing_decision = "revise_team"`.
- Only minor challenges and no blockers -> `routing_decision = "proceed_to_boss"`.

Overall status:

- `verified`: no challenged claims above minor and no blocking human checks.
- `mixed`: usable with caveats visible.
- `needs_revision`: agent-owned repair comes before stakeholder review.
- `blocked`: human/external check comes before execution or signoff.

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
`~/.claude/argus-data/schemas/verification-ledger.json`.

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

- `verification = ledger`
- `final_scaffold = updated scaffold`
- `phase = "dm_feedback"` when routing proceeds to boss
- `phase = "team_deploying"` when routing needs revision
- `phase = "complete"` or `"conversing"` when no team/boss path remains
- `updated_at = now`

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
- Asking the user to grade a past outcome. This skill validates current
  evidence, not future reality.
- Allowing boss review to run on blocked output unless the user explicitly chose
  to proceed with verified parts.
