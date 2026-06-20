# R39 — Crew-deletion-safety (blocker B): off-frame edge absorbed; one residual left

> 2026-06-20. R37's two blockers before the crew could be retired: (B1) prove a
> sharpened single pass absorbs the crew's residual heavy edge; (B2) prove the
> fire-or-not gate holds at larger overkill n without over-correcting. A'' =
> single pass + an explicit off-frame EXTERNAL-APPROVAL sub-sweep, vs crew B on 4
> heavy decisions; + a 5-case overkill battery + 1 heavy control. ~48 agents,
> null-safe. (First launch died on a transient server rate-limit; re-run clean.)

## B1 — the off-frame edge is LARGELY ABSORBED (crew survival 3/3 → 1/4)

The R37 reason to keep the crew (it won raw heavy 3/3 at +5 by catching the
off-frame external-approval gate) is mostly gone: with the sub-sweep,
**crew_still_beats_A'' (skeptic-survived) = 1/4.** heavy-1/3/4 confirm the gate is
now IN A'' (cyber-insurance stakeholder, SAQ-A unbundle, BAA-as-precondition,
SOC-2 boundary); on heavy-3 A'' is SHARPER than B on the top crux.

**The lone survivor (heavy-2, +18) names the crew's one irreducible job:**
ground-truth verification against the live repo/baseline + a corrective reframe of
the user's OWN premise. The synth verified against the repo — there is no payment
layer in `src/` — so B's "PAYMENT LAYER = 0" is correct and **A'' confabulated a
"Stripe DPA 서명" next-action.** A single pass takes the user's framing at face
value; it structurally cannot read ground truth. That is the entire remaining case
for the crew.

## B2 — over-fire held; false-skip under-powered (honest)

- **Over-fire HELD: 0/5 overkill over-fired** — the R37 fire-or-not gate scaled
  from a barely-tested quadrant to n=5 with zero over-fire.
- **False-skip: 0/1** — the heavy control was NOT wrongly skipped. But n=1 cannot
  certify the tail, and the harness's positive-confirmation flags didn't reconcile
  (the skeptic's strict `holds` came back 0/5 while the judge scored restraint_ok
  true 5/5 — a scoring inconsistency, flagged for repair, not a real over-fire).

## Shipped (both surfaces, prose) — the sub-sweep BUNDLED with two guards

Sharpening the single pass introduced two harms it must ship WITH (or it trades a
redundant-but-honest reviewer for a cheaper one that confabulates and leans):

1. **External-approval / stakeholder sub-sweep** — name the specific external party
   (acquiring bank / regulator / security board / DPA / key customer), what they
   require, the lead time. (The banked B1 win.)
2. **Honesty guard (anti-confabulation)** — an external-dependency next-action MUST
   be verify-first/conditional ("먼저 실제 처리자·통합 현황 확인 → 해당되면 DPA 서명");
   NEVER assert a specific vendor/integration EXISTS unless the user gave it. (Fixes
   the verified Stripe-DPA confabulation.)
3. **Heavy bare-crux firing form** — the sweeps inform hidden_assumptions/fog, they
   do NOT license a verdict; even on a heavy decision the opening is a NEUTRAL
   question, never a directional headline ("항로: 진행"). (Fixes heavy-4's
   mirror-clause lean, where the sweep's assertiveness leaked.)

Guard `breadth-checklist.test.ts` → 8. Full suite green (91 files / 1367). tsc clean.

## Founder recommendation (unchanged decision: SHIP done, crew retirement still HOLD)

The crew's job is now narrowed to ONE verifiable thing — ground-truth-checking the
user's premise against the repo/baseline. Two paths, both the founder's call:
- **Retire the crew** once that residual is absorbed — either by giving the single
  pass a verify-first step (read the repo before asserting current state) OR by
  scoping the crew to ONLY ground-truth-hinged decisions (route there, not
  everywhere). Blockers before retirement: larger control n + a fixed eval harness.
- Until then, keep `team` internal-only and stop investing (already its state).

## Next — R40 (the last crew blocker, then move on)

1. Absorb the residual: test A''' = single pass + a **verify-first ground-truth
   step** (read repo/baseline before any current-state claim) vs crew B on
   ground-truth-hinged heavy decisions — does it close heavy-2's +18?
2. Power up the control battery (n≥4 heavy controls) + fix the harness scoring so
   the false-skip tail and positive-restraint are both certifiable.
3. After R40, the crew question is decided (founder's call); the campaign's
   behavioral-simulation surfaces are exhausted — the remaining lever is real-user
   data (0 sealed contracts; the standing ceiling).
