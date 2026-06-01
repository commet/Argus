---
name: refine
description: "Auto-fix issues found in rehearsal. Revises the plan, re-tests with same personas, checks if issues are actually resolved. Use after /rehearse."
argument-hint: "[plan with rehearsal feedback to refine]"
allowed-tools: Read, Write, Agent, AskUserQuestion
---

## When to use

- ✓ After /rehearse — critical issues need fixing
- ✓ Received real feedback and want to iterate systematically
- ✗ Before /rehearse (need feedback first)
- ✗ Plan needs a complete rethink (go back to /reframe)

**Always respond in the same language the user uses.**

## If no rehearsal data

> /rehearse 결과가 필요합니다. /rehearse를 먼저 실행하거나, 받은 피드백을 붙여넣어 주세요.

## Context extraction

Read `.argus/rehearse.md`, `.argus/recast.md`, `.argus/reframe.md` for contracts.

**Immutable constraints (from /recast):**
- `governing_idea` → revised plan MUST still serve this. If contradicted, flag.
- `ai_limitations` → PERMANENT. Never reassign to AI.
- `design_rationale` → understand WHY the plan was designed this way before changing it.
- `critical_path` → changes to critical path steps have highest blast radius.

**Root question (from /reframe):**
- `reframed_question` → after each round, verify plan still answers this.
- `framing_confidence` → if low, fixes should prioritize validation over execution.

**Feedback (from /rehearse):**
- `risks_critical` → must fix
- `risks_unspoken` → should fix (core value)
- `devils_advocate` → should fix
- `risks_manageable` → can fix (add mitigation)
- `persona_reviews` → reproduce EXACTLY for re-test. No softening.
- `synthesis.priority_actions` → fix ordering guide
- `synthesis.key_conflicts` → 충돌 해소 or 사용자 판단 요청
- `translated_approvals` → 어떤 단계를 고쳐야 승인 조건을 만족시키는지

## How it works

1. Extract issues from /rehearse → auto-prioritize by severity
2. **🔴 critical items = auto-selected for fix.** 🟡 important = suggest. ⚪ minor = optional.
3. Show the list. Use AskUserQuestion to confirm which to apply: "전부 반영 / critical만 / 직접 선택"
4. Revise — surgically, not wholesale. Apply selected fixes only.
5. Re-test with same personas
6. Check convergence. Repeat if needed (max 3 rounds decide, 1 round build).

## Step 1: Issue Prioritization

Present issues with clear tracking:

---

**Argus · Refine** — 수정 대상

| # | 이슈 | 출처 | 심각도 | 대상 단계 | 수정 방향 |
|---|------|------|--------|----------|----------|
| 1 | [issue] | [persona name] | 🔴 | Step [N] | [fix] |
| 2 | [issue] | [persona name] | 🔴 | 가정 [X] | [fix] |
| 3 | [issue] | Devil's Advocate | 🟡 | Step [M] | [fix] |
| 4 | [issue] | [persona name] | ⚪ | | [fix] |

🔴 자동 선택: #1, #2
🟡 권장: #3
⚪ 선택적: #4

---

AskUserQuestion:
- question: "어떤 이슈를 반영할까요?"
- header: "수정 범위"
- options:
  - label: "전부 반영", description: "모든 이슈를 한번에 수정"
  - label: "🔴 critical만", description: "가장 심각한 것만 먼저"
  - label: "직접 선택", description: "번호로 선택 (예: 1,2,3)"

## Step 2: Revise

- Keep original structure. Change only what's broken.
- For each change: track what, why, and which feedback it addresses.
- Output COMPLETE revised plan.
- Refinement = plan CHANGES, not language softens.
- Never "we'll monitor this" as resolution.

### Change tracking format:

Each change is recorded as:
```yaml
- what: "[old] → [new]"
  why: "[reason]"
  addresses: "[persona name] — [concern text]"
```

### Revision rules:
- Changes to critical_path steps: flag with ⚠️, verify dependencies still hold
- Changes that affect governing_idea: HALT and warn user
- `translated_approvals` from /rehearse tell you WHERE to make changes
- If a fix creates a new issue, note it explicitly — don't hide cascades

## Step 3: Re-test

Same personas from /rehearse — exact reproduction, no deviations, no softening.
Run through revised plan with same context.

**Each persona reviews the CHANGES specifically:**
- Was their concern actually addressed?
- Did the fix create new problems?
- Is their approval condition now met?

After re-test: does plan still answer `reframed_question`? If drift, flag it.

### Approval condition tracking:

| 페르소나 | 승인 조건 | 상태 | 해결 라운드 |
|---------|----------|------|-----------|
| [Name] | [condition] | ✓ met | Round 1 |
| [Name] | [condition] | ✗ unmet | |
| [Name] | [condition] | ✓ met | Round 1 |

## Step 4: Convergence check

### Quantitative metrics:

| Metric | Converged | Not yet |
|--------|-----------|---------|
| Critical issues | 0 (or all deferred) | 1+ remaining |
| Total issues | Decreased | Same or increased |
| New issues per change | < 0.5 per change made | > 1 per change (fixes create new problems) |
| Approval conditions | Key ones met | Key ones unmet |
| Root question alignment | Plan still answers it | Drifted |

### Convergence score:

```yaml
convergence:
  critical_risks: [before, after]    # e.g., [3, 0]
  total_issues: [before, after]      # e.g., [7, 2]
  conditions_met: [before, after]    # e.g., [0, 2] out of 3
```

### Deferred validation (build context)
Some criticals only resolvable by building + testing. Mark as deferred:
- Only "impossible without shipping" qualifies
- Must have specific validation plan (what to build, measure, pass/fail)
- Journal: `Converged: yes (1 deferred)`

### Round limits
- **Decide:** max 3 rounds
- **Build:** max 1 round (with deferred option)

## Backward recommendations

**Zero critical reduction after round 1** (e.g., 3→3):
> 💡 수정으로 해결 안 됨 — /recast 재설계 권장

**Fix requires thesis change:**
> 💡 이 이슈는 방향 자체를 바꿔야 해결됨 — /recast 권장

**Plan drifted from reframed_question:**
> 💡 수정 과정에서 원래 질문에서 벗어남 — 원래 방향으로 되돌리거나 /reframe 재검토

Recommendations, not blockers.

## Output

---

**Argus · Refine** — 수정 반영 · Round [N]

**변경 사항**

| # | 변경 | 이유 | 대상 |
|---|------|------|------|
| 1 | [old → new] | [feedback] | [persona — concern] |
| 2 | [old → new] | [feedback] | [persona — concern] |

**미해결:** [issue] — [why]

---

**재검증**

```diff
- [Name] · [prev verdict] → [new verdict]
+ [Name] · [prev verdict] → [new verdict]
```

> **[Name]:** "[reaction to changes — in character]"
> **[Name]:** "[reaction]"

---

**승인 조건 추적**

| 페르소나 | 조건 | 상태 |
|---------|------|------|
| [Name] | [condition] | ✓ met |
| [Name] | [condition] | ✗ unmet |

---

**수렴 확인**

```diff
- ✗ Critical: [N] → [M]
+ ✓ Conditions met: [N] → [M] of [total]
```

Root question check: [✓ 여전히 답하고 있음 / ⚠ 드리프트 감지]

---

**상태:** ✓ 수렴 / ✗ [N] critical 남음

`Next? 1 done · 2 edit · 3 another round · ← 0 /recast`

---

## Quick actions

- `1` → save and finish
- `2` → edit specific changes
- `3` → run another round
- `0` → back to /recast (or /reframe if fundamental)

## Rendering rules

- Markdown sections separated by `---`.
- No box drawing. No fixed width.
- diff = color. `+` resolved (green), `-` remaining (red).
- Tables for changes with traceability (which persona's concern was addressed).

## Auto-save

Save to `.argus/refine.md`:
- Top: changes, re-test results, approval tracking, final plan
- Bottom: Context Contract (converged, rounds, critical_remaining, changes[], approval_conditions[], convergence_metrics, root_question_check)

## Journal

```
## [date] /refine — [topic, ≤5 words]
- Rounds: [N] | Converged: [yes/no (N deferred)]
- Critical: [N] → [M]
- Conditions met: [N] of [total]
- Key change: [biggest revision — what→why]
- Sharpest critique resolved: "[original]" → [how]
- Root question check: [aligned/drifted]
- Pipeline: reframe ✓ → recast ✓ → rehearse ✓ → refine ✓
```
