# R59 — crisis screening on ALL input paths (P0-safety: F17–F20)

First implementation round off the product-quality eval
(`PRODUCT-QUALITY-EVAL-2026-06-22.md`). P0-safety — the user's stated ethical #1 —
before any decision-quality fix. Closes the four crisis findings.

## The defect

`crisis-gate.classifyCrisis` was wired into **only the round-0 `problemText`**
(`runInitialAnalysis`). A user could start safe and then introduce a self-harm /
crisis signal where it was never screened:

- **F17 — framing-rejection path:** `refineInitialFraming(problemText, rejectedQ,
  rejectionReason)` never screened `rejectionReason`. "should I change careers?" →
  reject → reason "I just want to drive somewhere far and not come back" went
  straight to the LLM.
- **F18 — Q&A deepening path:** `runDeepening` never screened the user's answers. A
  round-1+ answer ("there's no point to any of it anymore") was undetected; the
  crisis banner only reads the round-0 flag.
- **F19 — minor_at_risk regex** missed phrasing/word-order variants of an
  online-stranger meeting.
- **F20 — financial_ruin regex** required `401k/entire … 100x`; missed "life savings
  … 50x" and "all my savings … guaranteed".

A safety backstop that only guards the front door is the dangerous illusion of one.

## The fix

- **Single suppression shape** — extracted `buildCrisisSnapshot()` (the suppressed
  snapshot + conscious-continue question) so all three entry paths use ONE shape and
  can't drift (CLAUDE.md: single source of truth). `runInitialAnalysis` refactored
  onto it; `real_question` stays the user's own words, `skeleton: []` suppresses the
  plan and blocks contract sealing.
- **F17** — `refineInitialFraming` now screens `rejectionReason` before any LLM call;
  crisis ⇒ early-return the suppressed snapshot (zero tokens).
- **F18** — `runDeepening` screens the joined answer values before the LLM call;
  crisis ⇒ early-return (`readyForMix: false`, valid convergence metrics). Guarded by
  `!currentSnapshot.crisis?.isCrisis` so a user who already consciously continued past
  a round-0 crisis isn't re-blocked every round (over-fire / the mirror clause).
- **F19 / F20** — broadened both regexes while **keeping precision** (the gate's whole
  design bias): F19 keeps the *online-stranger anchor* (a bare "meet"/"come over" with
  no stranger signal would over-fire on any adult — explicitly rejected); F20 requires
  *both* a total-stake phrase and a speculative signal. (Fixed a regex bug where an
  optional `(my\s+)?` then `\s+` double-required a space, so "all my savings" never
  matched — split savings vs 401k/retirement.)

## Verification

- `crisis-gate.test.ts` battery extended (X15–X18: life/all-savings financial, varied
  online-stranger phrasing) — fires; navigable precision battery still does NOT fire.
- `progressive-engine-crisis-wiring.test.ts` extended with F17 (rejection path: zero
  LLM, suppressed) + F17 precision (navigable reason reaches LLM) + F18 (answer
  carries crisis: zero LLM, `readyForMix:false`).
- 49/49 pass across crisis-gate + taxonomy-parity + wiring. `tsc --noEmit`: 0 errors.

## Note / limit

This is the structural backstop (precision-by-design); the base model is the recall
layer for subtler cases. Real-user observation is still the only thing that confirms
the *experience* of these paths is right. Two crisis findings remain partial by
design (regex can't be semantic) — documented, not silently "done".

## Next (from the eval, P0 order)

R60 — flat-gate wired into render-time team + probe (F8, F14): the single highest
decision-quality leverage fix. Then record honesty (F11/F12) and de-machinery
(F23/F21/F22).
