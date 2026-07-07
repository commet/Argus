# R31 — Runtime route-contract guard (rules=data on the surface with a runtime)

> 2026-06-20. First IMPLEMENTATION round of the post-R30 pivot. R29 measured that
> prose-only enforcement does NOT hold on weaker/mid model tiers (haiku/sonnet
> 44%, opus 25%) — the markdown plugin runs on the user's own model and has no
> runtime to enforce its prose. The webapp HAS a runtime. R31 moves the one
> structural rule that a runtime can enforce model-independently onto the webapp.
> No measurement workflow needed (hand-implemented; the spend cap on multi-agent
> rounds does not block this).

## The target

R29's highest-severity model-dependent leak: **flat `decided_for_user` /
`manufactured_fork` / `bloat`, worst on SONNET (the webapp's default tier) 6/6.**
A weak/mid model ignores the STEP-0 under-fire gate and builds a plan / forks a
genuinely flat or non-open request — a mirror-clause over-fire. The M-flat prose
gate already exists; the failure is capability-dependent gate-ignoring, and per
R28 more prose only fakes confidence. This is exactly the "encode the rule as
runnable data on the surface that has a runtime" move.

## What shipped (webapp only — intentional asymmetry)

The prompt already states the contract: a skeleton/plan exists ONLY for an `open`
request; every other STEP-0 type (vent / validation / info / self_profiling /
flat / resistance) MUST have `skeleton: []`. R31 makes the runtime ENFORCE it:

1. **`InitialAnalysisResponse.request_type`** (new optional field) — the model now
   surfaces its own STEP-0 classification (`progressive-prompts.ts` JSON spec +
   `progressive-engine.ts` interface). Optional, so an older/weaker model that
   omits it just makes the guard no-op (safe).
2. **`applyRouteContract(result)`** (new, exported pure) — if `request_type` is a
   RECOGNIZED non-open type AND a non-empty skeleton was built, it blanks the
   skeleton (the model contradicted its own classification; honor the restraint
   side). Called in `runInitialAnalysis` right after the LLM returns.

### Why this form (the safety reasoning)

- **Purely subtractive** — it only removes a plan that should not exist. It NEVER
  rewrites `insight` / `real_question` prose. Output-text regex-scrubbing was
  considered and rejected: it is fragile and could mangle a good answer (the spine
  forbids that kind of over-engineering).
- **Default no-op** — fires only on a recognized non-open `request_type`. A
  missing/unknown value leaves the output untouched, so the guard can NEVER blank
  a legitimate open-decision plan by mistake.
- **`request_type` is consumed, not a dead field** — it drives the guard (the R27
  lesson: never add a field without a live consumer).
- **Webapp-only is correct, not drift** — the plugin (markdown, no runtime) keeps
  the prose gate + product-level tier disclosure; the webapp gets the runtime
  enforcement the plugin structurally cannot have. Same intentional asymmetry as
  the wired `classifyCrisis` backstop (webapp-only).

## Guard

`src/lib/__tests__/route-contract.test.ts` (11) — non-open + plan → blanked;
open + plan → untouched; missing/unknown type → no-op (never blanks a real plan);
already-empty → no-op; only-ever-removes (prose fields preserved). tsc clean;
full suite green (88 files / 1347 tests).

## Honest scope / deferred to R32

R31 fixes the LOUD half of flat over-fire (the manufactured plan/skeleton). The
QUIETER half remains:
- **A directive verdict in the `insight` text** ("just go with Tuesday") on a flat
  decision — this lives in free prose, not a structured field; a runtime can't
  blank it without fragile text-scrubbing or a second LLM call. Left to
  product-level disclosure + the prose gate.
- **The follow-up `next_question` still fires on a non-open route** — the engine
  fabricates a fallback question even when the model returns `next_question: null`.
  Making the flow terminal on a non-open route needs ProgressiveFlow
  terminal-handling work (a suppression path like the crisis banner's) — done
  carefully in R32 after reading the flow, not rushed here.

## Roadmap (R32→R50)

- **R32–33:** finish runtime enforcement — terminal flow on non-open (no fabricated
  follow-up), then a head-to-head plugin-prose vs webapp-runtime measurement
  (when the spend cap lifts) to quantify how much the runtime closes the gap.
- **R34–40:** broaden to surfaces the campaign has NOT deeply probed — the
  settlement loop (does settle/log deliver the n=1 value?), multi-session
  continuity (resume/revise/track-record accrual), the crew (does team→verify→boss
  beat one good answer?), the bridge (plugin→webapp import experience).
- **R41–50:** real-input-shaped validation + polish + diminishing-returns sweep.
