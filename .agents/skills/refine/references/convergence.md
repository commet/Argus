# Convergence Guide

## What convergence means

The plan is "good enough" — not perfect. Additional rounds of feedback would change details but not direction.

## Quantitative signals

| Signal | Converging | Not converging |
|--------|-----------|---------------|
| Critical issues | 0 remaining | 1+ remaining |
| Total issue count | Decreasing each round | Flat or increasing |
| New issues per change | < 0.5 per change made | > 1 per change (fixes create new problems) |
| Approval conditions | Key ones met | Key ones still open |

## When to stop iterating

**Round 1** usually handles the big stuff — structural flaws, missing steps, wrong actors.

**Round 2** handles second-order effects — "your fix for X broke Y."

**Round 3** is diminishing returns. If you're here, either:
- The plan has a fundamental flaw (go back to `/reframe`)
- Stakeholders have irreconcilable differences (user must decide)
- Changes keep cascading (accept current state + document known issues)

## When NOT converged after 3 rounds

Don't force it. Instead:
1. Document remaining issues as "known constraints"
2. Identify which issues are truly blocking vs. merely concerning
3. Ask the user to make a judgment call: proceed with known risks, or rethink the approach?

The point is not perfection. The point is that you KNOW what the risks are before you proceed.
