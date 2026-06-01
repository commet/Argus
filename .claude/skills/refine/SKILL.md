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

**Root question (from /reframe):**
- `reframed_question` → after each round, verify plan still answers this.

**Feedback (from /rehearse):**
- `risks_critical` → must fix
- `risks_unspoken` → should fix (core value)
- `devils_advocate` → should fix
- `risks_manageable` → can fix (add mitigation)
- `approval_conditions` → convergence targets
- `persona_profiles` → reproduce EXACTLY for re-test. No softening.

## How it works

1. Extract issues from /rehearse → auto-prioritize by severity
2. **🔴 critical items = auto-selected for fix.** 🟡 important = suggest. ⚪ minor = optional.
3. Show the list. Use AskUserQuestion to confirm which to apply: "전부 반영 / critical만 / 직접 선택"
4. Revise — surgically, not wholesale. Apply selected fixes only.
5. Re-test with same personas
6. Check convergence. Repeat if needed (max 3 rounds decide, 1 round build).

## Step 1: Revise

- Keep original structure. Change only what's broken.
- For each change: what, why, which feedback it addresses.
- Output COMPLETE revised plan.
- Refinement = plan CHANGES, not language softens.
- Never "we'll monitor this" as resolution.

## Step 2: Re-test

Same personas from /rehearse — exact reproduction, no deviations, no softening.
Run through revised plan with same context.

After re-test: does plan still answer `reframed_question`? If drift, flag it.

## Step 3: Convergence check

| Metric | Converged | Not yet |
|--------|-----------|---------|
| Critical issues | 0 (or all deferred) | 1+ remaining |
| Total issues | Decreased | Same or increased |
| Approval conditions | Key ones met | Key ones unmet |

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

Recommendations, not blockers.

## Output

---

**Argus · Refine** — 수정 반영 · Round [N]

**변경 사항**

| # | 변경 | 이유 |
|---|------|------|
| 1 | [old → new] | [feedback] |
| 2 | [old → new] | [feedback] |

**미해결:** [issue] — [why]

---

**재검증**

```diff
- [Name] · [prev] → [new verdict]
+ [Name] · [prev] → [new verdict]
```

> **[Name]:** "[reaction]"
> **[Name]:** "[reaction]"

---

**수렴 확인**

```diff
- ✗ Critical: [N] → [M]
+ ✓ Conditions: [N] → [M]
```

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
- Tables for changes.

## Auto-save

Save to `.argus/refine.md`:
- Top: changes, results, final plan
- Bottom: Context Contract (converged, rounds, critical_remaining, key_changes)

## Journal

```
## [date] /refine — [topic, ≤5 words]
- Rounds: [N] | Converged: [yes/no]
- Critical: [N] → [M]
- Key change: [biggest revision]
- Sharpest critique resolved: "[original]" → [how]
- Pipeline: reframe ✓ → recast ✓ → rehearse ✓ → refine ✓
```
