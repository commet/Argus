# R55 — failure mid-chain: phase is derived from artifacts, not declared

R52–54 established a theme: on-disk artifacts are the truth, the small scalar/index
that points at them is a cache (corrupt-read → trust artifacts; drafts[] → trust
dirs). R55 finds the one scalar still being trusted over the artifacts:
`session.phase`, the field sail routes `--resume` on.

## The defect — phase lags the artifacts after a mid-chain crash

Each sub-step writes its artifact *then* updates `session.phase`. A crash, kill, or
sail sub-step that dies **between those two writes** leaves the phase behind:

```
team writes workers.json / mix.json / scaffold.json   ✅
team Step 10 updates session.phase = "verifying"      ❌ killed here
```

Now `session.phase` still reads `conversing` (or `team_deploying`) while team is in
fact complete. sail Step 3 routes off the "Current phase" column — keyed on
`session.phase` — so `--resume` sends the user back to `/argus:clarify --continue`
or re-runs team, instead of forward to `/argus:verify`. The finished work is on
disk, fully readable, and ignored.

The irony: sail Step 2 *already* re-derives phase from artifacts — but only for a
**corrupt** `session.json` ("re-derive phase from the artifacts present, not from
the unreadable record"). The far more common crash shape is a `session.json` that
parses perfectly and simply has a **stale phase**, and that case trusted the scalar.

## The fix — make the artifact ladder the authoritative phase

`session-layout.md` already documents "Files Written By Phase" — that table *is* the
artifact ladder. Added a canonical section, **"Phase Is Derived From Artifacts, Not
Declared"**: derive the effective phase from the furthest-along complete artifact in
the active version dir (current_bearing → boss_feedback → verification → team set →
team_plan-only → analysis-ready → analysis-only → nothing). **Artifacts always win
over `session.phase`:**

- derived phase *ahead* of `session.phase` → crash between artifact-write and
  phase-write → advance to the artifacts.
- `session.phase` *ahead* of artifacts (says `verifying`, no `verification.json`) →
  the step didn't actually finish → route to produce it.
- `session.phase` consulted only to break ties the artifacts leave ambiguous.

sail Step 3 now derives phase from artifacts before reading its routing table, and
reads the "Current phase" column as the *derived* phase. This generalizes the
Step-2 corrupt-session recovery from "won't parse" to "parses but stale" — the same
artifact-trust, applied to the common case.

## Why this is a spine note

Routing a user backward over work that is finished-and-on-disk is the tool
contradicting the user's own record — telling them to redo what they already did
because a scalar didn't get its final write. Same family as R54's lost draft:
durability that looks fine on screen while quietly discounting completed work. The
honest rule is that what is *on disk* defines where the voyage is, every time.

## Verification

`node scripts/validate-plugin.js` → passed.

## Next

R56: idempotent re-run. R55 routes a crashed chain back to the right step — now
confirm re-running that step is safe: does a second `/argus:verify` on an
already-verified draft append a duplicate, bump a counter, or cleanly overwrite its
write-once artifact? Audit each sub-step for re-entry safety (overwrite vs append vs
double-count), since R55 makes re-entry the normal recovery path.
