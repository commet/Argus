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
