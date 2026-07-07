# Argus — 10 product dimensions to 10/10 (2026-06-23)

> Goal: bring 10 product-capability dimensions to a genuine 10/10, score honestly,
> iterate. Dims 1–5 = the ecosystem-benchmark gaps (already shipped to main at v2.6.0,
> being hardened here). Dims 6–10 = found by a 32-agent adversarial research workflow
> (`find-5-core-dimensions`, wf_7c63b095) that filtered "core vs trivial" — only the
> essential, currently-missing, implementable-now ones survived. Work happens in an
> ISOLATED git worktree (`feat/ten-dimensions`) to eliminate the shared-tree branch
> accident class, then rebased onto origin/main and pushed.

## Dims 1–5 (harden to 10)
1. **Behavioral eval** — fidelity (feed clarify+sail, not sail alone), corpus 14→25+, judge-parse robustness, over-fire RATE via EVAL_REPEAT.
2. **Drift → single-source generation** — rules-as-data → generate both surfaces + CI sync guard (was deferred).
3. **Enforcement gates** — CI hard-block fixture proof (beyond warn-mode hook).
4. **Distribution** — automated clean-install smoke check + ready listing entry.
5. **Security** — secret-redaction utility + unit test in CI.

## Dims 6–10 (new — researched & adversarially filtered)

### 6. Output Integrity Under Failure — *no degraded result masquerades as verified/complete*
Empty/off-shape/unparseable worker or a failed write must fail loudly; an incomplete run can never render as a clean "verified/synthesized/done." Spine extension: "never lie about authorship" → "never lie about completeness."
- Failure contract in orchestrate/recast/team/synthesis SKILL.md (empty worker → `error|verification_failed`, never silently drop/backfill).
- check-contracts/validate-gates guard: a worker with `error|verification_failed` or score<70 must appear in the surfaced output, else fail.
- **10** = both surfaces show a completeness line, "verified" mechanically gated on no-failed-worker, CI blocks silent promotion, malformed-JSON → visible "could not complete" not empty defaults.

### 7. Provable account erasure + complete export — *the delete button must not lie*
`deleteAllUserData()` (db.ts) iterates ~17 hardcoded tables while the live DB has ~25–32, swallows errors (failed erasure reports success), never deletes `auth.users`. CONFIRMED BUG.
- Replace with `auth.admin.deleteUser` cascade covering every FK→auth.users table; stop swallowing errors; return a receipt.
- schema-drift erasure-coverage guard: every user-scoped table must be cascade-covered.
- Complete server-side export (all user rows → portable JSON) in Settings.
- **10** = one cascade covers 100% of user-tied tables, CI fails on an uncovered table, deletion returns a receipt, server-side full export exists.

### 8. Seal-time run/engine provenance — *stamp the instrument on every sealed decision*
Engine churns weekly (R46→R50); a contract sealed under R45 is a different instrument than R50. `modelId`/`usage` discarded at api/llm. Capture-now-or-lose-forever.
- Stop discarding modelId+usage at api/llm; one APP_PROMPT_VERSION constant.
- Stamp `provenance {model, skill_version, app_version, params, sealed_at}` on sealed contract + ledger.jsonl (JSONB — no migration).
- Capture-or-fail guard; settlement flags version drift so a miss isn't misattributed.
- **10** = every sealed contract + ledger entry carries model+prompt/skill+app version+params, guard prevents regression, settlement compares like-for-like.

### 9. Self-honesty about empirical maturity — *no unearned track record*
Distinct from the user-facing Zero-Judgment spine: this is Argus telling the truth about *itself*. 0 settled contracts = zero validated outcomes; never show an accuracy figure that implies validation.
- settled==0 → fixed "unproven, not a track record" disclosure; never an accuracy figure.
- Enforce the "3+ settlements" threshold as a guard/test (block rendering stats below it).
- Sweep copy for "proven/track record/calibration moat" asserted ahead of data.
- **10** = no accuracy figure renders below the settled threshold (CI-enforced both surfaces), every calibration surface shows runs/sealed/settled counts, AI outputs tagged unverified-until-settled.

### 10. Plugin run-cost accountability — *fan-out is the user's metered bill*
Value prop is ~17-agent fan-out on the user's OWN metered plan; 2026-06-15 Anthropic moved parallel subagents to a punitively-metered Pool 2. Zero cost signal = reckless feel; loading 11 SKILL bodies upfront degrades the host model.
- Pre-spawn budget line on high-fan-out skills ("~N parallel agents on your plan") + `--lean` flag capping width + model-routing guidance.
- Defer skill/agent bodies until invoked.
- Per-run token accounting sensor (user_events); capture api/llm `usage`.
- **10** = high-fan-out skills warn + offer --lean, bodies load on demand, every run self-reports token cost, model-routing guidance in orchestrating skills.

## Rejected (filter worked)
Graceful degradation (overlaps #1), decision-record write integrity (already mitigated), honest LLM-outage (SDK retries + localStorage), versioned local-data migration (latent, pre-launch), enterprise audit-trail (regulated red herring), context-budget (merged into #10), user-facing token meter (host-owned via /usage), latency budget (streaming ships), model-agnosticism (anti-identity for a Claude plugin).
