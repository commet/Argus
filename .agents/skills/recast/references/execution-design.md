# Execution Design Guide

## Actor assignment: the 4 questions

For each step, ask:

| Question | AI-friendly answer | Human-needed answer |
|----------|-------------------|---------------------|
| What information is needed? | Public data, general knowledge | Internal politics, relationships, culture |
| What kind of judgment? | Quantitative, pattern matching | Strategic interpretation, political reads |
| What if we get it wrong? | Low cost, redo-able | High cost, irreversible |
| Who's accountable? | Process/system | Specific person signs off |

**All 4 lean AI → AI does it alone.**
**Any of questions 1-4 lean human → Human or Both.**

## "Both" means clear scope boundaries

Bad: "AI and human work together on market analysis"
Good: "AI generates 3-scenario financial model. Human sets scenario assumptions and interprets which one matches our risk appetite."

The split should be: AI handles volume + computation, Human handles judgment + context.

## Checkpoint placement

A checkpoint is a mandatory human review point. Place them:
- Before any irreversible action (launch, announcement, contract)
- Before spending significant resources (budget > threshold)
- When the next step's direction depends on this step's interpretation
- Before external-facing deliverables

## Governing idea patterns

| Weak | Strong |
|------|--------|
| "Conduct market research" | "Validate SEA market fit in 90 days with a single-country experiment" |
| "Improve retention" | "Identify whether churn is a product, onboarding, or competition problem — then fix the #1 cause" |
| "Build AI features" | "Ship 1 AI feature that measurably reduces support tickets by 30% within Q2" |

The governing idea answers: "If someone has 10 seconds, what do they need to understand about what we're doing and why?"

## Storyline examples

**Enterprise expansion:**
- Situation: Product has strong SMB traction, 200+ paying customers
- Complication: Enterprise prospects need SSO, audit logs, and SLAs we don't have. Building all of them takes 6 months, but 3 enterprise deals are in pipeline NOW
- Resolution: Ship SSO in 4 weeks (the dealbreaker), promise audit logs in roadmap, negotiate SLA manually for first 3 deals

**Cost reduction:**
- Situation: Runway is 14 months at current burn
- Complication: Revenue growth is 8% MoM but expenses are growing 12% MoM. The gap widens every month
- Resolution: Cut non-revenue-generating infrastructure costs by 30% (specific areas identified) while protecting growth-driving spend

**Product build (context: build):**
- Situation: Freelancers track invoices in spreadsheets — error-prone, no reminders
- Complication: Existing tools (FreshBooks, Wave) are full accounting suites — overkill and confusing for solo freelancers who just want "send invoice, get paid"
- Resolution: Ship a single-screen invoice tool in 2 weeks — create, send, track payment status. No accounting features until 50 paying users validate the core.

## Step design patterns

Each step should be:
- **One clear deliverable** — not "research and analyze" but "produce a competitive landscape table with 5 competitors"
- **Sized for completion** — if a step takes more than 1 week, break it down
- **Sequenced by dependency** — later steps can't start until earlier dependencies are met

### Bad vs good steps

| Bad | Good |
|-----|------|
| "Do market research" | "Interview 5 target users about their current workflow (human)" |
| "Develop the feature" | "Build invoice creation screen with PDF export (AI), then manual QA of 3 edge cases (human)" |
| "Get feedback" | "Share prototype with 3 beta users, collect structured feedback on onboarding flow (human)" |

### The "expected output" test

Every step must have a concrete expected output. If you can't describe what the step produces, the step is too vague.

| Step | Expected output |
|------|----------------|
| Competitive analysis | Table: 5 competitors × 4 dimensions (price, feature gap, UX, weakness) |
| User interviews | Summary doc: 5 interviews, top 3 pain points ranked by frequency |
| MVP build | Working prototype deployed to staging, core flow testable |

## Parallel execution

Steps can run in parallel when they have **no data dependency** on each other.

Mark parallel steps with `parallel_with: [step_number]` in the output.

**Safe to parallelize:**
- Research tasks with independent scopes (competitive analysis ∥ user interviews)
- AI generation tasks that don't feed into each other
- Independent build modules

**Never parallelize:**
- Steps where output of A is input of B
- Human judgment steps that inform direction
- Steps sharing the same resource bottleneck (same person, same system)

## Time estimation

Use t-shirt sizing, not precise hours:

| Size | Meaning | Typical |
|------|---------|---------|
| Quick | < 2 hours | AI-only data gathering |
| Short | Half day to 1 day | Single analysis or build task |
| Medium | 2-5 days | Research + synthesis, feature build |
| Long | 1-2 weeks | Multi-step human process, complex build |

**Rule:** If total estimated time exceeds the user's stated timeline, flag it and suggest scope cuts.

## Critical path identification

The critical path is the longest chain of dependent steps. Mark these steps in the output.

**How to identify:**
1. Find all steps that are dependencies for other steps
2. Trace the longest chain from start to finish
3. These are critical path steps — delays here delay everything

**Critical path steps get checkpoints** — because a delay or failure here has the highest blast radius.

## AI scope vs Human scope (for "both" steps)

When a step is assigned to "both", always specify the boundary:

**Step: Competitive pricing analysis**
- **AI scope:** Collect pricing data from 10 competitor websites, generate comparison table
- **Human scope:** Interpret which pricing model fits our positioning, decide our price point
- **Handoff:** AI delivers table → Human makes decision → Decision recorded as checkpoint

The handoff point must be explicit. "AI and human collaborate" is never acceptable.
