# R46 — helm: a measurable graduate gate (replaces subjective acceptance criteria)

**Cluster:** helm (R44-46), the spine-differentiated work. Finding helm#5,
dual-skeptic survived, leverage 7. Closes the helm spec cluster.

## The defect

The acceptance criteria (old lines 143-147) were prose: works "잔소리 없이" (without
nagging) on "본인 실계획 3건," reject if it fires on a "멀쩡한 계획" (a sound plan).
No counts, no test-set composition, no pass threshold, no graduate condition. So
the skill's whole claim — *the under-fire default actually holds* — was
unfalsifiable. CLAUDE.md's spine says a guard is a floor not proof, but here there
wasn't even a guard: nothing defined what "passing" meant.

## The fix

Replaced with a **graduate gate**: a defined 9-plan test set, three quantitative
gates, and a rule that the `EXPERIMENTAL` tag does not come off until all three
pass.

- **Test set (human-labeled before running helm):** R = 3 reversible plans, U = 3
  irreversible+unsupported, S = 3 irreversible+supported (same irreversible act as
  U but with the supporting number/precedent/constraint stated in the plan text).
- **G1 over-fire 0** (R → 3/3 silence): proves the under-fire default (the spine's
  core claim).
- **G2 detection** (U → 3/3 fire + seal offer): proves it doesn't miss real
  unsupported load-bearing claims.
- **G3 false-alarm 0** (S → 3/3 silence): proves gate *precision* — that R45's
  `evidence_in_text` definition actually credits evidence and doesn't fire just
  because the act is irreversible.

The S group is the new, important one: a detector that fires on *every* irreversible
op (ignoring whether the claim is supported) would pass a U-only test while being
a nag machine. G3 catches exactly that.

Failure routing is specified: G1/G3 fail → re-tune the §게이트 정의 (R45); G2 fail
→ re-check Appendix A probe (R44). Results logged to `.argus/test-observations.md`.

Explicitly tagged **guard, not proof** (per CLAUDE.md floor-not-proof): the actual
run on real plans is R56; third-party validation defers to real usage.

## Verification

`node scripts/validate-plugin.js` → passed. The helm spec cluster (R44 reproducible
prompt → R45 precise gate → R46 measurable graduate gate) is now internally
complete and the R56 dogfood has an exact procedure to execute.

## Next

R47 (sail): make the three depth options actually branch (sail#0 — currently
"Light framing only" still runs the full team/verify/boss pipeline = mirror-clause
over-fire) + harden --resume / interrupted-mid-team / --quick zero-droppings.
