# R47 — sail entry: make the depth options branch + harden resume/interrupt/quick

Findings sail#0 (spine-relevant) + sail#2 + sail#3 + sail#4, dual-skeptic
survived. All in `skills/sail/SKILL.md`. sail#0 is the load-bearing one.

## sail#0 — the depth question was theater (mirror-clause over-fire)

Step 6b asks the user how heavy the decision is, offering **"Light framing only"
/ "Current Bearing" / "Treat as high-stakes."** But the after-answer logic
persisted the stakes, set `stakes_confidence = 100`, and **continued to Step 6c
for all three** — Step 6c runs team → verify → boss → bearing unconditionally. So
a user who picks "Light framing only" (explicitly asking for restraint) still gets
the full multi-minute crew. That is the exact mirror-clause over-fire CLAUDE.md
forbids: ceremony on a user who asked for none.

**Fix:** the three options now map to three paths. "Light framing only" → behave
like `--quick`: clarify's framing is terminal, no team/verify/boss, no bearing,
mark session `complete`, exit. "Current Bearing" → `stakes = important` → Step 6c.
"Treat as high-stakes" → `stakes = critical` → Step 6c (raised agent budget +
critic mandate). The time preview prints only on the latter two. Added a Forbidden
Patterns invariant so it can't silently regress.

## The robustness siblings (same Step 2-3, table-stakes but real)

- **sail#2 (--resume on missing/corrupt session):** Step 2 had "load that session"
  with zero error spec. Now: not-found → list 3 recent sessions + one
  AskUserQuestion (or offer fresh); corrupt `session.json` → quarantine to
  `.corrupt.<ts>` and re-derive phase from the artifacts on disk (Step 3 reads the
  files directly), never silently proceed on a malformed record.
- **sail#4 (fragile interrupted-mid-team detection):** the binary test
  (`team_plan.json` exists AND `workers.json` absent) missed a `workers.json` that
  exists but is **unparseable or short of the planned worker set** — a process
  killed mid-write. That partial set could route to `/argus:verify` as if
  complete. Now any of {absent, unparseable, missing a planned worker} counts as
  interrupted → re-run team (safe; same version dir, overwrites partial output).
- **sail#3 (--quick droppings):** clarified that `--quick` on a low-density inline
  framing leaves nothing on disk (same discipline as Step 0 auto-invocation
  zero-droppings); only a `--quick` that yields a real persisted scaffold writes a
  session. `/argus:sail --quick "rename a tab?"` no longer litters a session dir.

## Verification

`node scripts/validate-plugin.js` → passed. Markdown-only.

## Next

R48 (pipeline-coherence): assign `owner_agent_id` to boss concerns so revise/team
can route them (currently a boss concern with no owner is silently lost) + retire
the dead `claim_ids` field that no skill writes or reads.
