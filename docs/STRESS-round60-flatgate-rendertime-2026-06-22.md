# R60 — flat-decision gate wired into the live flow (P0-quality: F8, F14, +F3)

The single highest decision-quality leverage fix from the eval
(`PRODUCT-QUALITY-EVAL-2026-06-22.md`). Over-firing on flat decisions (~60% in the
stress test) is the central judgment-atrophy harm: manufacturing a fork where every
branch lands the same trains the user to see false leverage.

## The discovery (the eval's one-liner was incomplete)

The eval said "gate on `frame_status='flat'`." But scoping found **`frame_status` was
DEAD in the webapp**: `assessFrameStatus` (judgment-gates.ts) existed and was unit-
tested, but **was never called** — no code assigned `snapshot.frame_status`, and the
LLM prompt never requested it. So there was nothing to gate on. R60 is therefore
*populate the dead field AND gate*, not just gate.

## The fix

1. **Populate `frame_status`** (`progressive-engine.ts`): `runInitialAnalysis` and
   `runDeepening` now call `assessFrameStatus({ realQuestion, surfaceQuestion:
   problemText, assumptions })` and set it on the snapshot. The function is
   **conservative by design** — `flat` only when the reframe ≈ the surface question
   AND there are no assumptions to pivot on; otherwise `load_bearing`. So a genuine
   decision (which almost always has assumptions) is never mislabeled flat → the gate
   cannot suppress real crew work. This conservatism is what makes the gate low-risk.
2. **Gate team deployment** (`ProgressiveFlow.tsx`, F8): `shouldMix` now `&&
   !frameIsFlat`. A flat decision never deploys the crew.
3. **Terminal, not dead-end:** `frameIsFlat` is folded into `suppressQuestion` (the
   same mechanism non-open routes use). That (a) suppresses the fabricated follow-up
   question and (b) triggers the existing terminal analysis card (the
   `suppressQuestion` render branch), so a flat decision ends with its one-line
   analysis as the deliverable — it does NOT hang on a blank screen.
4. **Gate the probe** (`ProgressiveFlow.tsx`, F14): both `TrialSail` render sites now
   `&& !frameIsFlat`. TrialSail self-drives `runDivergenceProbe` (the fork
   manufacturer) in its mount effect, so not rendering it = not probing. (TrialSail is
   behind `newArcEnabled`, off by default; honest limit: during `analyzing` the frame
   isn't computed yet, so the probe can start once and unmounts as soon as round-0
   lands flat.)

## Why low blast-radius

`assessFrameStatus` returns `load_bearing` on any ambiguity and whenever assumptions
exist. The flat path only fires on a near-identical reframe with zero assumptions —
a genuinely flat case. Verified both directions in tests so the gate suppresses
over-fire WITHOUT blocking real decisions.

## Verification

- New `progressive-engine-frame-status.test.ts`: flat input → `frame_status: 'flat'`;
  real decision (different reframe + assumptions) → `'load_bearing'`.
- Regression: `crisis-wiring` (R59), `judgment-gates`, `route-contract`,
  `decision-states-parity` all green (49 + 30). `tsc --noEmit`: 0 errors.

## Remaining (follow-ons, named not silently skipped)

- **F16** — a component-level behavioral test (`frame_status:'flat'` snapshot ⇒ no
  crew/probe render) to lock the gate against future refactors. The engine-population
  test is the foundation; the component test needs a render harness.
- **F5** — `assessFrameStatus` uses brittle word-overlap; a semantic signal would
  catch flats with synonym-y reframes. Using the conservative version now is strictly
  better than the dead field (it never over-suppresses); improving the signal is
  additive.
- **F3** — the plugin's mechanical flat test (synthesize two execution plans) is the
  plugin-side analogue, separate surface.

## Next (eval P0 order)

P0-honesty (F11/F12): display losses (betsBroke/risksHappened) + ai_surfaced in the
record — small, low blast-radius, finishes the R57/R58 thread. Then de-machinery
(F23/F21/F22).
