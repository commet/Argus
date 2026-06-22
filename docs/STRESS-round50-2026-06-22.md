# R50 — revise loop safety: bounded convergence + --max-revisions escape hatch

Findings revise#1 (leverage 5) + revise#0. The revise skill's own description
promises "a converging decision," but *converging* was never defined and the loop
had no terminal condition.

## The defect

The loop is clarify → team → verify → boss → **revise** → verify → … with an
explicit ellipsis. In automated mode (`--no-prompt`, or sail routing
`revise_team`), verify Step 7 routes `revise_team` whenever an agent-owned
`important+` challenge exists → team --revise → verify → `revise_team` → … with
**no bound**. A claim the team cannot actually fix re-loops forever. No
`--max-revisions`, no `session.max_revise_cycles`, no convergence definition.

## The fix — bound the loop at the chokepoint, define the exit

The two revise paths (`/argus:revise` and sail's `revise_team` → `team --revise`)
both cross **`team --revise`**, so the cycle counter lives there:

- **team --revise** increments `session.revise_cycles` at the start of each run; if
  it exceeds `session.max_revise_cycles` (default 3), it does NOT rework — it writes
  the still-open challenges to `human_required_checkpoints[]` (`reason:
  "max_revisions_reached"`) and stops. This caps the loop even when sail bypasses
  the revise skill.
- **verify Step 7 rule 4** now routes `revise_team` only if `revise_cycles < max`
  AND the claim is not a repeat of one challenged in the immediately-prior
  verification. Cap reached or same claim survived → `stop_for_human_check` +
  `human_required_checks[]` (`reason: "unconverged_after_revision"`). **Escalation
  to a human is the exit**, not another auto-pass.
- **revise** gained `--max-revisions <N>` (writes `session.max_revise_cycles`) and a
  convergence check in Step 5: a still-challenged repeat, or cap reached, becomes a
  human check rather than an invitation to loop. The report distinguishes
  "converging — one more pass may help (n/max)" from "⛔ Not converging — escalated."

### Schema sync (CLAUDE.md gate)

Added `revise_cycles` (int ≥0) and `max_revise_cycles` (int ≥1, default 3) to
`session.json` so the new coordination state is declared, not implicit.

## Why convergence = escalation (spine note)

The honest terminal state of an unconvergeable claim is "a human must judge this,"
not "keep re-running the crew." Re-looping the team on a claim it already failed to
resolve is wasted ceremony — a quiet cousin of over-fire. The exit surfaces the
claim to the user instead of burning cycles.

## Verification

`session.json` re-parses; `node scripts/validate-plugin.js` → passed.

## Next

R51 (chart): define `verification.json`'s status shape + gate precedence so chart's
"next command" gates can't collide; distinguish corrupt from missing on read.
