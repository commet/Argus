---
name: argus-help
description: "Show available Argus skills and how to use them. Use when the user asks about Argus, asks for help, or seems unsure which skill to use."
allowed-tools: Read
---

**Always respond in the same language the user uses.**

---

**Argus — Structured thinking for when you're out of your depth**

Input a problem, get an instant skeleton in 30 seconds.
Answer a few questions, it gets sharper. Simulate your boss's reaction.
Walk away with a send-ready document.

---

## Not sure what to do?

| Situation | Recommendation | Why |
|-----------|---------------|-----|
| Need to write a plan/proposal and feel stuck | `/argus` | 30-sec skeleton → 2-3 questions → full draft |
| Have a plan but roles are unclear | `/recast` | AI/human role redesign specialist |
| Have a plan but worried about weak spots | `/rehearse` | Stakeholder simulation + risk discovery |
| AI keeps giving predictable answers | `/reframe` | Reframe the question itself |
| Got /rehearse feedback to apply | `/refine` | Auto-fix + convergence tracking |

---

## Quick Start

```
/argus "I'm a dev but my boss asked me to write a business plan"
```

→ **30 sec:** Situation + real question + plan skeleton + hidden assumptions
→ **2-3 min:** Answer 2-3 questions, draft evolves with each answer
→ **4 min:** "What would the boss say?" — concerns + OK condition
→ **5 min:** Feedback auto-applied → **final deliverable**

Send-ready document + Sharpened Prompt + Thinking Summary + DQ Score.

---

## All Skills

### Core — Decision Pipeline

| Skill | One-liner | Time |
|-------|-----------|------|
| **`/argus`** | **Full pipeline** — input→draft→deepening→simulation→final | ~5 min |
| `/reframe` | Problem reframing — find hidden assumptions, discover the real question | ~2 min |
| `/recast` | Role redesign — clearly separate AI vs human roles in your plan | ~3 min |
| `/rehearse` | Stress test — stakeholder reaction simulation + Devil's Advocate | ~3 min |
| `/refine` | Apply fixes — incorporate /rehearse feedback, track convergence | ~2 min |

### Utility — Settings & Analysis

| Skill | Description |
|-------|------------|
| `/argus:setup` | Installation check — verify skills/agents/data |
| `/argus:doctor` | Diagnostics — 7 checks, recovery guidance |
| `/argus:configure` | Settings — language, presets (Quick/Standard/Learning), journal |
| `/argus:patterns` | Thinking pattern analysis — strengths/blind spots after 3+ runs |

---

## Skill Chain: Using them together

`/argus` runs the full pipeline at once, but you can also chain individual skills:

```
/reframe → .argus/reframe.md (saves)
    ↓ auto-reads
/recast  → .argus/recast.md (saves)
    ↓
/rehearse → .argus/rehearse.md (saves)
    ↓
/refine   → .argus/refine.md (saves)
```

Each skill automatically reads previous results and continues from there.
"Found previous results. Continue with these?" — it asks.

### What flows between skills:

| From | To | What passes |
|------|----|-------------|
| /reframe | /recast | Real question, evaluated assumptions (doubtful/uncertain/confirmed), framing confidence, interview signals, AI limitations |
| /recast | /rehearse | Governing idea, storyline, steps with roles, key assumptions, critical path, auto-generated personas |
| /rehearse | /refine | Persona reviews with severity+fix, approval conditions with plan mapping, synthesis, Devil's Advocate |
| /reframe | /refine | Root question (to verify plan still answers it) |

---

## Agent Team

`/argus` deploys a team of specialized agents in parallel for complex problems:

| Agent | Name | What they do |
|-------|------|-------------|
| `researcher` | 수진 | Market research, competitive analysis, data gathering |
| `strategist` | 현우 | Strategic analysis, option evaluation, trade-offs |
| `writer` | 서연 | Document drafting, narrative structure |
| `numbers` | 민재 | Financial modeling, metrics, scenario analysis |
| `user-voice` | 지영 | User perspective, adoption barriers |
| `devils-advocate` | — | Weakness finding, blind spots |
| `lead-synthesizer` | — | Integrates all agent outputs into unified analysis |

When your problem needs 2+ AI tasks, agents run **simultaneously** and their results get synthesized into your final document. You can see each agent's individual work.

---

## Key Features (v0.5)

- **Framing confidence** (0-100): Self-assessment of how well the question captures the real problem
- **Evaluation-based assumptions**: Each assumption tagged as confirmed/uncertain/doubtful with axis labels
- **Expanded interview signals**: Nature, goal, stakes, trigger, history — shapes downstream behavior
- **Storyline (S/C/R)**: Situation/Complication/Resolution structure for plans
- **Expanded actor types**: 🤖 🧑 ⚡ 🧑→🤖 🤖→🧑 — nuanced human-AI collaboration
- **Critical path + time estimation**: Identifies bottleneck steps and estimates
- **Structured synthesis**: Cross-persona agreements, conflicts, untested assumptions
- **Translated approvals**: Maps "what they need" to "which plan step fixes it"
- **Convergence tracking**: Measures whether the plan is stabilizing across rounds
- **Decision Quality Score**: 6-element framework (Framing/Alternatives/Information/Perspectives/Reasoning/Actionability)
- **Framing refinement loop**: When you reject the AI's reframing, it re-analyzes from scratch

---

## Outputs

| Building (Build) | Deciding (Decide) |
|---|---|
| Implementation Prompt | Sharpened Prompt |
| Product Brief (MVP spec) | Thinking Summary (3000 chars, shareable) |
| Scope cuts | Decision Quality Score (0-100) |

---

## Learn more

- `/argus:setup` — Check installation status
- `/argus:doctor` — When something's wrong
- `/argus:configure` — Language/preset settings
- `.argus/journal.md` — Run history (auto-saved)
- `.argus/last-run.md` — Last run result
