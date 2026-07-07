# R32 — Non-open routes are now terminal in the webapp (no fabricated follow-up)

> 2026-06-20. The second half of R31's runtime enforcement. R31 blanked the
> manufactured PLAN on a non-open route; R32 closes the other half R31 deferred —
> the fabricated FOLLOW-UP QUESTION. Hand-implemented; verified-safe by mirroring
> the shipped `crisisBlocking` pattern (an Explore pass mapped every render path
> first). The monthly spend cap had lifted by this round, but no measurement
> workflow was needed.

## The gap

`runInitialAnalysis` always returns a `question` object — a fallback even when the
model returns `next_question: null`. So on a non-open route (vent / validation /
info / flat / self_profiling / resistance) the webapp still rendered a probing
follow-up question and continued the flow — a mirror-clause over-fire (the inline
answer should be the terminal deliverable). The plugin states this contract in
prose; the webapp has a runtime that can enforce it.

## The safety property (why this is not risky)

`shouldMix` — which deploys the crew — fires only on `!curQ`. The crisis backstop
already proved the safe pattern: keep the question OBJECT alive (so `curQ` stays
truthy and `shouldMix` can never fire) but RENDER-suppress the QuestionCard. R32
mirrors it exactly for non-open routes, so suppressing the question can never
deploy the crew on a vent. Render-suppression only — no flow-state mutation.

## What shipped (webapp only)

1. **Wired a dead field.** `AnalysisSnapshot.request_type` existed but was
   never set or read ("ported from plugin v2.6; webapp wiring is a follow-on").
   R32 aligns its enum to the model's STEP-0 output
   (`open|flat|vent|validation|info|resistance|self_profiling|crisis`) and sets it
   in `runInitialAnalysis` from the LLM result (carried forward in
   `runDeepening`). Confirmed nothing else read it before wiring (grep: the only
   `.request_type` consumer was R31's guard).
2. **`ProgressiveFlow` makes a non-open route terminal.** Derives
   `suppressQuestion` (mirror of `crisisBlocking`): true when any snapshot's
   `request_type` is non-open. Added `&& !suppressQuestion` to BOTH QuestionCard
   gates (the onboarding banner + the main card), and `|| suppressQuestion` to the
   AnalysisCard gate so the inline answer (insight) still shows in focus mode (the
   record toggle no longer hides it). The question object persists → no crew.

## Why webapp-only (intentional asymmetry, not drift)

The markdown plugin has no runtime; it keeps the prose gate + product-level tier
disclosure. The webapp gets runtime enforcement the plugin structurally cannot —
same asymmetry as the wired `classifyCrisis` backstop and R31's route-contract
guard. The plugin's prose already states the same contract, so the two surfaces
agree on JUDGMENT; only the ENFORCEMENT medium differs.

## Guard

`route-contract.test.ts` extended to 13: `runInitialAnalysis` pins
`request_type` on the snapshot AND R31's guard blanks a non-open plan (tested
together); an `open` classification keeps its plan. tsc clean; full suite green
(88 files / 1349 tests).

## Honest scope / still open

- The directive-in-`insight` on a flat decision ("just go with Tuesday") remains
  free prose a runtime can't blank without fragile text-scrubbing — product-level
  disclosure + the prose gate, as before.
- No "dig deeper anyway" affordance on a non-open terminal yet (the plugin offers
  a re-open line). A non-open answer is terminal; the user can start a new query.
  A small escalate link is a future polish, not shipped (restraint default).

## Next (R33+) — pivot to measurement-driven broadening (cap lifted)

The over-fire axis (R28–R32) is now well-worked on both surfaces. With the spend
cap lifted, resume the validated multi-agent measurement method on surfaces the
campaign has NOT probed for VALUE delivery: the settlement loop (does settle/log
deliver the n=1 moat?), multi-session continuity (resume/revise/track-record),
the crew (does team→verify→boss beat one good answer?), the bridge experience.
