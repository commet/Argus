# R51 — chart routing: single source of truth + corrupt≠missing on read

Teed up by R50's "Next." The chart's **Next Command Logic** is what tells the user
where to sail next; if two gates can both claim the same draft state, the
implementer picks one arbitrarily and the routing becomes nondeterministic.

## The defect

Two distinct holes, both in chart's read/route path:

1. **Gate field ambiguity.** "Next Command Logic" was already an ordered
   first-match list, but it never said *which field* the verification gates read.
   An implementer could read `overall_status`, or a hand-rolled set of boolean
   flags, or `routing_decision` — and these disagree (e.g. `overall_status:
   needs_revision` overlaps both `revise_team` and `ask_user`). Reading more than
   one signal is exactly what lets two gates fire on one state.
2. **Corrupt read collapsed into "not run."** Step 2's read rule treated *any*
   unreadable per-version file as "missing → not run." A `verification.json` that
   exists but fails to parse would then render as "not verified" and route the user
   straight past a verification that actually ran — possibly one that *blocked*.
   Missing and corrupt are different facts and must route differently.

## The fix

- **One field for routing.** Next Command Logic now states the verification gates
  read **only `verification.json.routing_decision`** — the single enum verify Step 7
  already computes as its own ordered-first-match (`revise_team` /
  `stop_for_human_check` / `ask_user` / `proceed_to_boss`, exactly one). The list is
  pinned as an ordered if/else-if, first match wins. Reading `overall_status` or
  boolean flags for routing is explicitly forbidden — that's what reintroduces
  collisions.
- **Missing vs corrupt split on read.** Step 2 now treats a *missing* file as "not
  run" (render the dash, route to the producing skill) and a file that *exists but
  fails to parse* as **corrupt, not absent**: render `⚠ <name> unreadable (recover:
  rerun /argus:<skill>)` and quarantine to `<name>.corrupt.<ts>`. A corrupt
  `verification.json` never silently becomes "not run."

## Why this is a spine note, not just a bug

Routing the user past a verification that ran (and may have blocked) is the engine
deciding *for* the user that there's nothing to check — a quiet over-fire of the
mirror clause. Surfacing "this ran but I can't read it" hands the decision back.

## Verification

`node scripts/validate-plugin.js` → passed.

## Next

R52: continue the read-path sweep — `boss_feedback.json` / `current_bearing.json`
corrupt handling parity, and confirm the quarantine `<name>.corrupt.<ts>` convention
is honored by every reader (chart, sail --resume, revise Step 1.5), not just chart.
