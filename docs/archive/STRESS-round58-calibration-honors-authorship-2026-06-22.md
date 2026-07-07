# R58 — calibration honors the authorship tag (R57 made inert otherwise)

R57 tagged the flinch bet's authorship (`real_bet_authored: user | ai_surfaced`)
but nothing consumed it — the tag was honest at rest yet the track record still
counted a machine-surfaced bet as the user's judgment. A tag nothing reads is the
exact "looks fixed, isn't" failure the campaign keeps finding. R58 makes the
calibration actually honor it.

## The principle (R17, extended)

R17 established: *a held bet on luck is not a held bet on judgment* — so
`summarizeGrades` separates `goodOutcomesOnLuck` from skill-wins. The identical
logic applies one step earlier: *a held bet the user never made is not the user's
judgment either.* If the no-friction skip stood the machine-surfaced belief in as
the bet (`authored === 'ai_surfaced'`), its holding says nothing about the user's
calibration — counting it as a skill-win inflates the moat with a prediction that
was never theirs.

## The change (thread the tag, segregate the win)

- `Predicate.authored?: 'user' | 'ai_surfaced'` (stores/types) — carried on the
  governing-bet predicate.
- `extractPredicatesFromSession`: the flinch bet predicate inherits
  `falsification.real_bet_authored` (only tags `ai_surfaced`; typed/adopted/legacy
  stay the user's own).
- `GradeSummary.betsHeldAiSurfaced` + `summarizeGrades`: a held governing bet with
  `authored === 'ai_surfaced'` increments this segregation counter — exactly
  parallel to `goodOutcomesOnLuck`. It still counts in `betsHeld` (it did hold) but
  is pulled out of "the user's judgment held," so the UI/track record can show it
  honestly rather than as a clean skill-win.

`predicate-basis.test.ts`: +2 cases (machine-surfaced segregated from user/legacy;
luck AND ai_surfaced land in both buckets). 18/18 pass with contract-hardening.

## Why this matters to the core

Two of the four core invariants are **retained ownership** and **compounding
calibration** — and they are the same surface here: the track record is only a moat
if it reflects *the user's* judgment improving. A machine-surfaced bet silently
counted as theirs corrupts both at once. R57 stopped the lie in the stored data;
R58 stops it from compounding into the record. Together they close the authorship
hole end to end.

## Next

- **R59 — over-fire gate upstream:** audit found the flat/DO-FIRE gate is
  render-suppression, not pre-manufacture — the engine still builds the fork then
  hides it, so any render-path change re-exposes it. Pull the gate before the
  manufacture.
- **R60 — product-level lean disclosure (P1-2):** the one honest "we surface the
  one question; a faint lean may remain" — still absent; fake neutrality is a trust
  break.
- **(surfacing R58 in the UI):** `betsHeldAiSurfaced` now exists in the summary but
  no surface renders it yet — a small follow-on so the user actually sees the
  honest split, not just the data carrying it.
