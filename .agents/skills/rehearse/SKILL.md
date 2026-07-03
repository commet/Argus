---
name: rehearse
description: "Simulate how your boss, stakeholders, or users would react to your plan. Finds weak spots, unspoken risks, and what needs to change for approval. No persona setup needed — auto-generated from context."
argument-hint: "[plan or strategy to stress-test]"
allowed-tools: Read, Write, Agent, AskUserQuestion
---

## When to use

- ✓ After /recast — see how stakeholders would react
- ✓ Before presenting to leadership or stakeholders
- ✓ When you suspect blind spots but can't find them
- ✓ Triggered as "XX은 뭐라고 할까?" from /argus
- ✗ When the plan is still too vague (run /recast first)
- ✗ Quick, low-stakes decisions

If you ask AI directly, it'll agree with you. That's the problem. Rehearsal creates simulated critics who react the way real people would.

**Always respond in the same language the user uses.**

## If no argument

If no `/recast` result and no argument:

> What plan or strategy do you want tested? (Paste it, or run /recast first)

## Context extraction

Read `.argus/recast.md` and `.argus/reframe.md` for contracts.

**From /recast:** governing_idea, steps, key_assumptions (attack surface), personas (use exactly)
**From /reframe:** assumptions_doubtful (probe FIRST and HARDEST), reframed_question

### Who reviews:
- If `/recast` provided personas → use exactly
- If `/argus` set a `judge` → create persona matching that judge + 1-2 additional
- Otherwise → auto-generate based on context (see below)

## Step 1: Auto-generate personas (no setup needed)

### Decide context: 3 stakeholders

Generate from context — **no user setup required:**
1. **Reporting audience** — receives the deliverable
2. **Gatekeeper** — controls approval
3. **Domain expert** — knows if it's realistic

Each: name, role, influence, decision_style, risk_tolerance, primary_concern, blocking_condition.

**Diversity:** Must differ on decision_style and risk_tolerance.

### Build context: 2 user personas

1. **Target User** — name, context, current_solution (specific!), switch_threshold, dealbreaker
2. **Skeptic** — name, alternative (specific product!), objection

See `references/persona-design.md` for detailed guidance.

## Step 2: Reviews (auto, no user input needed)

### Decide context — each persona independently:

- **First reaction** — in their voice (1-2 sentences)
- **Failure scenario** — most LIKELY way this fails (mundane, not dramatic)
- **Risks with severity + fix** — each concern must include:
  - severity: 🔴 critical ("이거 빠지면 통과 안 됨") / 🟡 important ("있으면 훨씬 좋음") / ⚪ minor
  - fix_suggestion: 구체적이고 실행 가능한 수정 방향
- **Approval conditions** — what they need to say "yes" (1 sentence)

### Build context:

**Target User:**
- First reaction (authentic)
- Would I switch? (honest, referencing current_solution)
- What's missing? (one thing for daily use)
- Risks: [critical] = what makes them delete it / [unspoken] = market reality

**Skeptic:**
- First reaction (skeptical)
- "Why not just [alternative]?" (full argument)
- What would change my mind?
- Risks: [critical] = likely death / [unspoken] = what nobody admits

**MUST find at least 1 [unspoken] risk.** This is core value.
See `references/risk-classification.md`.

## Step 3: Devil's Advocate

Run `devils-advocate` agent:
1. **Most realistic failure**: 6 months from now, this stalled. What happened? (mundane, likely)
2. **Silent problem**: What everyone suspects but won't say in a meeting
3. **Regret test**: 1 year later, what's the one thing you wish you'd considered?

Build context uses lighter version (no agent, inline):
1. How this product most likely dies
2. Market reality builders avoid
3. 6-month regret

## Confidence Gate

After all persona reviews, before showing to user:

**Self-check each concern:**
- Does it cite a specific plan element (step, assumption, number)? If not → too vague, strengthen or drop.
- Is the fix_suggestion actionable within this plan's scope? If not → rewrite.
- Is this concern unique (not repeating another persona's point)? If duplicate → merge.

**Low-confidence marker:** If a concern is based on general knowledge rather than plan specifics, mark it `[일반론]` and deprioritize. The user needs plan-specific pushback, not generic risk warnings.

## Step 4: Synthesis

1. **Priority actions** — top 3 changes, ordered: critical risks → multi-persona concerns → unspoken risks
2. **Key conflicts** — where personas disagree
3. **Untested assumptions** — what no persona could verify

## Backward recommendations

Check after synthesis:

**All reject without conditions** → thesis broken:
> 💡 전체 거부 — /recast에서 재설계 필요

**Sharpest critique attacks thesis itself** → can't fix with refinement:
> 💡 핵심 비판이 방향 자체를 겨냥 — /recast 재설계 권장

**Devil's Advocate questions problem existence** → go to /reframe:
> 💡 문제 자체의 존재가 의심됨 — /reframe 재검토 권장

These are recommendations, not blockers.

## Output

### Decide context:

---

**Argus · Rehearse** — 사전 검증

**바꿔야 할 것**
1. [action — specific]
2. [action — specific]
3. [action — specific]

---

**[Name]** — [Role] → **[verdict]**

> "[첫 반응 — 직접 인용, 날카롭게]"

| 우려 | 심각도 | 수정 방향 |
|------|--------|----------|
| [구체적 우려] | 🔴 critical | [이렇게 고치면 됨] |
| [구체적 우려] | 🟡 important | [수정 방향] |
| [unspoken] | 🔇 | [대응 방향] |

**[Name]** — [Role] → **[verdict]**

> "[첫 반응]"

| 우려 | 심각도 | 수정 방향 |
|------|--------|----------|
| [우려] | 🔴 critical | [수정] |
| [우려] | 🟡 important | [수정] |

**[Name]** — [Role] → **[verdict]**

> "[첫 반응]"

| 우려 | 심각도 | 수정 방향 |
|------|--------|----------|
| [우려] | ⚪ minor | [수정] |

---

**Devil's Advocate**

```diff
- ✗ [realistic failure]
- 🔇 [silent problem]
- ⏳ [1-year regret]
```

---

> 💡 [key insight — 1-2 lines]

Severity-based actions:
- Critical ≥ 1: `⚠️ Critical [N] · 1 /refine 권장 · 2 edit · 3 save · ← 0`
- Critical = 0: `✓ 1 save · 2 edit · 3 /refine · ← 0`

---

### Build context:

---

**Argus · Rehearse** — 사전 검증

**바꿔야 할 것**
1. [action]
2. [action]

---

🎯 **[Name]** · [context] · [current_solution] → **[verdict]**

> "[첫 반응]"

| 우려 | 심각도 | 수정 방향 |
|------|--------|----------|
| [what makes them delete it] | 🔴 critical | [수정] |
| [unspoken market reality] | 🔇 unspoken | [대응] |

🤨 **[Name]** · [alternative] → **[verdict]**

> "[첫 반응]"

| 우려 | 심각도 | 수정 방향 |
|------|--------|----------|
| [likely death mode] | 🔴 critical | [수정] |
| [what nobody admits] | 🔇 unspoken | [대응] |

---

**Devil's Advocate**

```diff
- ✗ [most likely death]
- 🔇 [what nobody says]
- ⏳ [6-month regret]
```

---

> 💡 [blind spot]

`⚠️/✓ [severity] · 1 /refine · 2 edit · 3 save · ← 0`

---

## Quick actions

- `1` → save + recommended next
- `2` → edit (a. swap personas, b. re-evaluate, c. redo DA)
- `3` → save and stop
- `0` → back to /recast with insights

## Rendering rules

- Markdown sections separated by `---`.
- No box drawing. No fixed width.
- diff = color tool. Max 3 per output.
- Risk symbols: `✗` critical, `?` manageable, `🔇` unspoken

## Auto-save

Save to `.argus/rehearse.md`:
- Top: actions + persona summaries + DA
- Bottom: Context Contract (risks by category, approval_conditions, persona_profiles with ALL fields for /refine)

## Journal

```
## [date] /rehearse — [topic, ≤5 words]
- Context: [build|decide]
- Personas: [names with roles]
- Critical: [each — 1 line]
- Unspoken: [each — 1 line]
- Sharpest critique: "[quote]" — [persona]
- Pipeline: reframe ✓ → recast ✓ → rehearse ✓ → refine ·
```

## Self-check

- Is there anything here that would make the user uncomfortable? If not → too soft.
- Does each risk cite a specific element from /recast? If not → too generic.
