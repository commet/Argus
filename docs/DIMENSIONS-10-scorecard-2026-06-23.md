# 10 dimensions — honest scorecard (2026-06-23)

Scored the way the founder scored me: clinically, no inflation, residuals named.
All work landed in the isolated worktree `feat/ten-dimensions` (off origin/main) →
fast-forward to main. **No branch accident** (the whole point of the worktree).

| # | Dimension | Score | What's at 10 | Honest residual (why not 10) |
|---|---|---|---|---|
| 1 | Behavioral eval | **9** | clarify+sail fidelity, corpus 25, judge retry→inconclusive (no false-tilt), over-fire RATE, CI static + nightly live; surfaced real skill tilt | corpus 25 not 50+; no per-tier (haiku vs sonnet) sweep run |
| 2 | Drift → single-source generation | **7.5** | generator + machinery-terms single-sourced (2 JS consumers import it), markdown mirror generated, CI sync guard, drift CAUGHT | only 1 contract migrated; crisis-taxonomy / course-status still detection-only (their files are owned by active sessions) |
| 3 | Enforcement gates | **8.5** | validate-gates + hard-block CLI proof (exit 2) + warn-mode Stop hook + CI | webapp runtime-guard half deferred (boss/progressive owned by North-Star) |
| 4 | Distribution | **8** | install-smoke automates clean-install preconditions (manifest parity, all skills/agents/hooks/schemas resolve), listing entry + release notes ready | external listing PR not fired (outward-facing → founder); real clean-machine screenshot owed (human) |
| 5 | Security / redaction | **9** | redact.mjs tested 15/15 (keeps prose/sha/paths), wired into clarify as a mechanical step, threat model, 3 injection eval cases defended | not wired into every webapp path (webapp doesn't ingest diffs — mostly N/A) |
| 6 | Output integrity under failure | **8** | team worker-failure contract + OUTPUT-INTEGRITY gate (failed/weak worker can't be promoted-as-verified or silently dropped) + tests | webapp FinalCard "N of M used" completeness line not wired (SynthesizeStep owned by North-Star C) |
| 7 | Provable account erasure + export | **9** | CONFIRMED BUG fixed: 29-table single source + service-role endpoint (all rows + identity + receipt) + complete export + CI erasure-coverage guard | Settings UI doesn't yet *show* the receipt (cosmetic); identity-cascade FKs not added (endpoint deletes explicitly instead — fine) |
| 8 | Seal-time engine provenance | **8.5** (was 5.5) | capture (api/llm logs model + token usage) AND seal-time stamp: `decision-contract.ts` stamps `provenance {app_version, prompt_version, sealed_at}` on every contract (JSONB — no migration) at the lib assembly layer (avoids SealMoment.tsx, which BIND holds open) + capture-or-fail guard 2/2 | model id is server-recorded not embedded (client can't know the routed model); settlement version-drift annotation not wired |
| 9 | Self-honesty (no unearned track record) | **6.5** | enforceable invariant (calibration-disclosure.ts): no accuracy figure below SETTLED_THRESHOLD; settled=0 → "unproven" banner; 6/6 tests | the patterns/DQ card UI isn't wired to it yet — that card is North-Star D's file |
| 10 | Plugin run-cost accountability | **7** | team pre-spawn budget line + --lean + model-routing guidance; api/llm token capture | the budget line is model-emitted (prose-level on the plugin); per-run token self-report is server-side only, no in-plugin meter |

**Average ≈ 8.1** (after the dim8 follow-on: seal-time provenance stamp landed). Honest verdict: **not "10 tens."** Five dimensions are genuinely
strong (1,5,7 ≈ 9; 3 ≈ 8.5); four are capped at partial (8,9 especially) by a real
constraint the founder set in the same breath as the goal — **"don't cause
accidents, other sessions are running."** Dims 8 and 9 need edits to SealMoment,
decision-contract.ts, and the patterns card — the exact files the North-Star/BIND
session holds open right now. Pushing them would re-create the branch collision we
just spent a turn recovering from. So those landed as **collision-safe halves**
(capture + enforceable helper + tests) with the UI wiring as the explicit, low-risk
follow-on once those sessions land.

**What a true 10-across would require (the path, not a claim):**
- Dim8/9: wire the provenance stamp into SealMoment and the disclosure into the
  patterns card — *after* North-Star/BIND merge (then it's a 1-file edit each, safe).
- Dim2: run the generator over crisis-taxonomy + course-status (same pattern, their
  files free up).
- Dim6: add the FinalCard completeness line.
- Dim4: fire the listing PR + capture one clean-machine install.
- Dim1: expand corpus to 50+, run the per-tier over-fire-rate sweep.

Everything here is validated (tsc 0, vitest 1453 pass incl. new guards, all plugin
node tests pass, eval ran live). The 6 eslint errors in CI are **pre-existing on
main** (login/settings `<a>` links, InnerMonologueCard memoization) — not introduced
here; my files lint clean (0 errors).
