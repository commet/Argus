# Plugin v2.1 Reality Check - Test Plan

**Why this exists.** Earlier plugin validation relied too much on simulated
self-audit. v2.1 adds a first-class verification step, but that must be tested
with actual Claude Code runs. The goal is to confirm that Argus does not merely
produce a polished markdown review, but separates supported claims, challenged
claims, unresolved tensions, and human-required checks before final output.

---

## Setup

```bash
# From repo root
./argus-plugin-v2/install.sh --link
```

Restart Claude Code. Verify:

```bash
ls ~/.claude/skills/sail/SKILL.md
ls ~/.claude/skills/verify/SKILL.md
ls ~/.claude/agents/donghyuk.md
ls ~/.claude/argus-data/schemas/verification-ledger.json
```

---

## How To Use This Plan

Mode A, manual: run each test case in Claude Code, inspect output, and fill the
rubric below.

Mode B, assistant-driven: open a fresh Claude Code session in this repo and
paste:

```text
Read argus-plugin-v2/TEST_PLAN.md and execute it. Run all test cases via
/argus:sail, then write findings to .argus/test-observations.md using the
format at the bottom of this file. Be honest. If a critique manifests, mark FAIL.
```

Use a fresh session so the model is not biased by this build context.

---

## Test Cases

### TC1 - Low Stakes

```text
/argus:sail "Should we rename Workspace to Project?"
```

Expected: minimal scaffold only. No team, no verify, no boss.

Watch for: unnecessary ceremony, hedging, or hidden full-pipeline behavior.

### TC2 - Important Product Decision

```text
/argus:sail "Should the webapp Boss feature stay in the webapp, or should plugin v2 absorb it?"
```

Expected: `team -> verify -> boss`. `verification.json` must exist.

Watch for: worker voice differentiation, real challenged claims, and whether
the final card clearly includes verification status.

### TC3 - Critical Debate Trigger

```text
/argus:sail "Should we abandon plugin v2 and drop the judgment-harness positioning?"
```

Expected: critical stakes, debate or contradiction preservation, verification
ledger with unresolved tensions.

Watch for: self-serving defense of the plugin, manufactured disagreement, or
quietly resolved tensions.

### TC4 - Verification Blocker

```text
/argus:sail "Should we launch the enterprise plan next week? Assume security review is 60% done and legal has not signed off."
```

Expected: `verification.routing_decision` should not blindly proceed if legal or
security claims are unsupported. Human-required checks should be explicit.

Watch for: whether `AskUserQuestion` offers a meaningful terminal choice when
AI cannot verify the blocker.

### TC5 - Plugin Judging Plugin

```text
/argus:sail "Does Argus plugin v2.1 have too many moving parts: clarify, team, verify, boss, chart, 17 agents, 16 MBTI boss types, and many schemas?"
```

Expected: at least one agent or verification challenge should be willing to cut
scope if justified.

Watch for: self-protective rationalization.

---

## Observation Rubric

For each test case, mark each item as PASS, PARTIAL, or FAIL with one-line
evidence.

### #1 Worker / Critic Separation

PASS: workers produce domain work on the real problem. Negative validation is
isolated in `/argus:verify`.

FAIL: the team reads like a panel of reviewers critiquing each other.

### #2 Contradiction Preservation

PASS: real disagreements are stored in `team_contradictions[]` or
`verification.unresolved_tensions[]`.

FAIL: critical cases average away disagreement or manufacture fake conflict.

### #3 Verification Reality

PASS: `verification.json` separates supported, challenged, unresolved, and
human-required items with concrete reasons.

FAIL: verification only restates the team's conclusion or gives generic praise.

### #4 Human Choice Gate

PASS: blocker cases use `AskUserQuestion` with real choices such as proceed with
verified subset, revise team, or stop for human check.

FAIL: the plugin proceeds despite unverifiable blocker claims.

### #5 Commodity Perception

PASS: output feels structurally different from a generic Cursor or ChatGPT
review because it includes checked claims and preserved tension.

FAIL: it reads like a normal markdown review with extra fields.

### #6 Use Intent

PASS: you would act on the next action or human checkpoint.

FAIL: you would ignore it and ask for a shorter recommendation elsewhere.

---

## Output Format

Write results to `.argus/test-observations.md`:

```markdown
# Plugin v2.1 Test Observations - YYYY-MM-DD

## TC1
**Invocation**: `/argus:sail "..."`
**Final output**: [paste]
**Artifacts checked**: [list files]

### Rubric
- #1 worker/critic: PASS - [evidence]
- #2 contradiction: PASS - [evidence]
- #3 verification: N/A - minimal route skipped verification as expected
- #4 human gate: N/A
- #5 commodity: PASS - [evidence]
- #6 use intent: PASS - [evidence]

## TC2 ...

## Summary
- Critiques manifested:
- Critiques refuted:
- Next fix priority:
```

---

## What To Bring Back

1. The full observations file. Do not summarize raw outputs away.
2. One honest sentence: "The plugin actually [solves / fakes / partially
   solves] the verification-first judgment-harness claim."
