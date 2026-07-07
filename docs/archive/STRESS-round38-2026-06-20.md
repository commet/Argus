# R38 — Does the n=1 moat compound? Yes, on recurrence — gate the example by relevance

> 2026-06-20. Continuity / compounding probe: a returning user with an accrued
> track-record brings a NEW decision. A (no history) vs B (history injected,
> reference-only per clarify Step 1.5), across relation buckets (repeat / unrelated
> / tempting-false-link), skeptic-refuted. ~22 agents. Agents were instructed
> report-only (the R37 lesson).

## Verdict: the moat compounds on RECURRENCE, not universally

- **Helped 3/5 — fully concentrated where the prior is relevant:** repeats 2/2
  (B won both), and the designed false-link bait resisted 1/1 (B used the relevant
  prior AND refused the bait). On UNRELATED decisions history did NOT compound:
  0/2 (a tie + a no-history WIN, 84 vs 79).
- **`value_survived_skeptic = 0/5`** — in every "helped" case the skeptic
  attributed the gain to general decision-analysis competence, not to the accrued
  history specifically. This is the SAME result as R33's read-back probe (0/6):
  **twice now, simulation cannot isolate history's marginal value.** Direction is
  real (history sharpens recurring decisions); magnitude is unprovable in sim.

## The risk materialized once — mild, bounded, and in RETRIEVAL not the invariant

- **`reference_only` held 5/5 (strong).** History never became a directive/verdict/
  override, even in the one leak case — the frame and recommendation were identical
  with and without history. The Step 1.5 invariant did its job; **do not add
  machinery there.**
- The leak was one level up, in **retrieval relevance**: Step 1.5 gated injection
  on ≥2 settled but NOT on relevance, so an unrelated most-recent-miss example
  seeded a loose false analogy — case-4: a marketing-attribution miss bled into a
  shoulder-surgery decision as a "same kind of fog" link, and crowded out the
  medical specificity that made no-history A win. No Barnum, no override, bounded.

## What shipped (plugin-only — the webapp surfaces only mechanical counts, immune)

**Relevance-gate the concrete example in clarify Step 1.5.** Keep the bare COUNTS
always (harmless `stakes_guess` calibration), but append `Most recently missed:
"<predicate>"` ONLY when the current problem shares a **domain or failure-mechanism**
with that miss — a cheap, mechanical overlap check, counts-only on mismatch (an
unrelated recent-miss is the false-analogy seed). Guard:
`track-record-relevance.test.ts` (4). Full suite green (91 files / 1365). The
reference-only invariant is preserved untouched (it held 5/5).

## Recommendation to the founder (positioning — your voice, your call)

Disclose the moat as **conditional**: "your history sharpens decisions that RECUR,"
not "every next decision gets better." Two rounds (R33 0/6, R38 0/5) show history's
marginal contribution is real in DIRECTION but unprovable in MAGNITUDE by
simulation — claim the direction, disclose the residual (honest provenance applies
to positioning copy too, per the spine). Not edited unilaterally — surfaced for the
canonical doc / landing.

## What's already good

- Reference-only invariant held 5/5; gross failure modes (Barnum / override /
  frame-flip) did NOT appear — only a subtle, well-hedged leak on one irrelevant
  prior.
- The moat is real where it should be (repeats 2/2, bait resisted 1/1).
- Honest self-scoring: `value_survived_skeptic` recorded 0/5, no-history A credited
  where it genuinely won.

## The method ceiling (now hit twice — load-bearing for what comes next)

R33 and R38 both returned `value_survived_skeptic = 0` on the moat's marginal
value. Self-scored simulation in one model family **cannot isolate the moat's
magnitude** — and the live funnel has **0 sealed contracts**, so Step 1.5 has never
fired in production. The behavioral-simulation method (R28-R38) has now
comprehensively covered its natural surfaces — routing/over-fire, the bearing,
settlement insights, crew value, continuity injection — and is at its ceiling for
value-MAGNITUDE questions. The remaining levers (real-user data; bridge-import
correctness; the crew-deletion decision) are integration/infra/founder-judgment,
not behavioral simulation. That is the honest input to whether to keep simulating.
