# R37 — Crew falsification: redundant as default (+ a founder-level recommendation)

> 2026-06-20. The decisive crew test. Now that A' = single pass WITH the R36
> breadth checklist exists, re-ran the head-to-head A' vs crew B at larger n,
> across three buckets (heavy / breadth_resistant / overkill), plus the untested
> overkill quadrant. ~43 agents, null-safe aggregation (R35 was network-lossy).

## Result

| Axis | Finding |
|---|---|
| crew beats A' (skeptic-survived) | **0/5** — the crew added ZERO survivable value over the checklist single pass |
| value gap | a wash — A' 82 vs B 81 (+0.2) |
| heavy bucket (raw judge) | B wins 3/3 (+5) — real off-frame items A' still lacked |
| breadth_resistant (people/ethics) | **A' wins 2/2 (+8)** — and the crew committed SPINE VIOLATIONS here |
| overkill quadrant | 1/2 over-fired (the mirror-clause routing risk materialized) |

**Crew redundancy: CONFIRMED AS DEFAULT.** R35's crown-jewel win (a self-build vs
vault fork) was independently surfaced by the checklist → falsified. ~80% of the
crew's heavy edge is already in the checklist; the residual (3 off-frame external-
approval gates) is absorbable by a sharper checklist sub-sweep, not a property
that needs multiple agents.

**On people/ethics the crew is actively HARMFUL.** The forced fake numbers
($30-50k, "79% runway"), a disclaimed-lean disclosure ("the crew leaned toward
'speak honestly'" = a laundered verdict), and ceremony all came from the CREW (B),
not the checklist. A' stayed qualitative, returned the handle, reached the
third-form-of-honesty with no life verdict. The checklist degrades gracefully (it
did NOT force a number); the crew violates the spine.

## Founder-level recommendation — SPLIT the call

This touches a major subsystem (`team`/crew) and is hard to reverse, so it is the
founder's call. The evidence supports a split:

- **SHIP (safe, reversible): make the checklist single pass the DEFAULT analysis
  path; STOP investing in `team` as a runtime surface; keep the crew demoted to
  internal-only/non-default (already its state).** Evidence: MODERATE-STRONG —
  0/5 crew skeptic-survival, value wash, A' wins people/ethics, crew commits the
  spine violations the single pass avoids.
- **HOLD (do NOT delete the crew yet).** Evidence for permanent deletion is WEAK:
  n=5 (heavy n=3), n=2 overkill, all self-scored simulation in one model family,
  no real-user run, and the crew still wins the RAW heavy judge 3/3 (+5) on genuine
  off-frame items. Prove the checklist absorbs that residual edge first.

Two blockers before any deletion (R38): (1) over-fire holds ~0 at larger overkill
n; (2) heavy crew-survival stays 0 AND a sharpened checklist closes the residual
heavy +5 — ideally confirmed by one real / cross-model run.

## Shipped this round (the safe, reversible fix)

**Fire-or-not gate reinforcement at the breadth sweep site, both surfaces.** The
overkill over-fire was a classification mis-fire that routed an already-closed
logging decision INTO the OPEN sweep. The architecture already gates the sweep to
OPEN-only; the fix reinforces the invariant at the violation site: *run the sweep
ONLY on an OPEN request — NEVER on a VALIDATION/CLOSED, FLAT, or already-logged
decision; reopening a closed decision to "add breadth" is the mirror-clause
violation* (`progressive-prompts.ts` BREADTH block + `clarify/SKILL.md` rule 1c).
Guard `breadth-checklist.test.ts` extended to 6 (locks the fire-or-not clause on
both surfaces). Full suite green (90 files / 1361). tsc clean.

> Process note: an R37 measurement-workflow agent applied this one-line fix to both
> source files on its own initiative (the synth flagged it as "shipped"). The edit
> was independently reviewed (diff: exactly 2 lines, parity-symmetric, spine-aligned,
> nothing else touched) and kept because it is correct and minimal. Future
> measurement rounds will instruct agents "report only, do not edit."

## Next — R38 (close the two deletion blockers)

1. **Over-fire / under-fire:** expand the flat/closed quadrant to n≥6 (already-
   closed, pure-logging, flat-reversible, vent, resistance); confirm the fire-or-not
   reinforcement holds over-fire ~0 AND that the tightened gate does NOT now
   FALSE-SKIP a genuinely heavy decision (the opposite tail).
2. **Heavy absorption:** push heavy n up (recover the R35 network-dead cases + new
   multi-domain); test A'' = checklist + an explicit off-frame external-approval/
   stakeholder sub-sweep — does it close the residual heavy +5 (which would make
   the crew safe to delete)?
3. **Honest ceiling:** still self-scored simulation, one model family; the crew
   verdict is provisional until cross-model / one real run. Never let "crew caught
   an internal error" count as value.
