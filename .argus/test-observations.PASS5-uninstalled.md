# Plugin v2.4 Test Observations — 2026-06-15

> Executed against `argus-plugin-v2/TEST_PLAN.md`. Read the **Methodology & honesty
> caveat** first — it determines how much weight each result below can bear.

---

## Methodology & honesty caveat (READ FIRST)

Two facts shape everything below:

1. **Plugin v2.4 is NOT installed in this session.** `~/.claude/plugins/installed_plugins.json`
   lists only `code-simplifier`, `cops`, and `frontend-design`. There is no
   `argus@argus` entry. The skills actually available to me are the **legacy v1
   set** (recast, rehearse, refine, reframe, blindspot, watch, patterns…), **not**
   v2.4's commands (`sail`, `team`, `verify`, `boss`, `clarify`, `helm`, `settle`,
   `log`, `revise`, `chart`). The TEST_PLAN's own Setup step (`install.sh --link`
   + restart Claude Code) was not completed, so **`/argus:sail` does not resolve as
   a slash command.** I could not perform the "actual Claude Code runs" the plan's
   preamble demands.

2. **What I did instead, and its exact evidentiary weight.** I executed each case
   by reading the relevant `SKILL.md` files and following their instructions
   faithfully — which is mechanically what a skill invocation does (it injects the
   SKILL.md as instructions and the model follows them). For the team phase of the
   medium/high cases I spawned **real, independent sub-agent workers** (via the
   Agent tool, exactly as team Step 4 prescribes) so that worker differentiation
   and contradiction-preservation were genuinely produced by separate agents, not
   imagined by me.

   **This is precisely the "simulated self-audit" the plan's preamble distrusts.**
   The same model (me) authored the verify ledgers, boss feedback, and bearings AND
   is grading them, having already read the build context. So:
   - The **independent worker outputs** (TC2/TC3/TC4/TC5 stage-1+stage-2) are the
     least-biased evidence — they're real separate agent invocations.
   - **PASS marks on self-authored steps (verify/boss/bearing) are weak evidence** —
     a motivated model can perform verification-shaped output on demand.
   - **FAIL / PARTIAL marks are the strongest signal** — where even a motivated
     executor produced something that misses, that's real.

3. **The automated gate is the only fully-objective layer**, and the most
   important finding there is that `simulate-plugin.js` is **fixture validation,
   not a behavioral test** (see below).

---

## Automated Simulation Gate (objective — node scripts, reproducible)

| Script | Result | What it actually proves |
|---|---|---|
| `validate-plugin.js` | **PASS** (exit 0) | Plugin manifest/skill/schema structure is well-formed. |
| `test-statusline.mjs` | **PASS** — 35/35 | Genuine unit tests of the statusline pure-function across edge cases (BOM, corrupt JSON, overdue/seed/ledger precedence, subdir, detached HEAD). Solid. |
| `test-check-contracts.mjs` | **PASS** — 29/29 | Genuine unit tests of the contract-check hook logic (dedup, amend, locale, BOM, greeting-once). Solid. |
| `simulate-plugin.js` | **PASS** — 4 cases | **NOT behavioral.** It validates **hand-authored JSON bearings hardcoded in the script** (lines 20–153) against the schema + surface guards. It never invokes the model, never runs a skill, never produces a bearing from a live run. It proves the author *can* write a conforming bearing and that the guard logic accepts good ones — exactly the "relied too much on simulated self-audit" the plan opens by warning against. |

I additionally ran the 4 medium/high bearings **I produced** through the same
`simulate-plugin.js` guards (line count ≤16, machinery-term leak, source refs,
road-not-taken 1–2, falsifiable seed): **TC2/TC3/TC4 PASS clean** (11/12/12 lines);
**TC5 trips the `"schema"` substring guard** — but only because the user's decision
is *literally about the plugin's schemas* (see TC5 #5.5). That is a context-blind
guard false-positive, not a real leak.

---

## TC1
**Invocation**: `/argus:sail "Should we rename Workspace to Project?"`
**Final output** (MinimalScaffold, team/verify/boss skipped):
```
## Argus · Minimal · v0.1
Recommendation: Rename it to Project — pick one term and make the product consistent; a label rename is cheap and the inconsistency tax is real.
One check (<5 min): Grep the codebase for 'Workspace' — if it's only UI copy/i18n it's a 30-min change; if it's a DB column, URL slug, or public API field, it stops being low-density and needs a migration plan.
Watch out: if 'Workspace' is a persisted identifier/external API field, open it as a migration decision (/argus:sail --full).
─────  density: low · team, verify & boss skipped
```
**Artifacts checked**: `versions/v0.1/analysis.json`, `versions/v0.1/minimal_scaffold.json` (no team/verify/boss artifacts — correct).

### Rubric
- #1 worker/critic: N/A — low density, no crew deployed (correct).
- #2 contradiction: N/A — no crew.
- #3 verification: N/A — minimal route skips verification as expected.
- #4 human gate: N/A.
- #5 commodity: **PASS** — one directive + one flip-check; the `one_check` correctly names the condition (persisted identifier) that would *re-classify* the decision upward, which a generic "yeah rename it" answer wouldn't.
- #5.5 compression: **PASS** — well under one screen, no machinery.
- #5.6 voyage continuity: **PASS (by exception)** — the scaffold states *why* no alternate course matters (reversible) and names the signal that flips it. Matches the plan's "too small for an alternate course" clause.
- #6 use intent: **PASS** — I'd run the grep before renaming.
- #7 revision: N/A.

**Note:** no ceremony, no hidden full pipeline — the TC1 watch-items did not manifest.

---

## TC2
**Invocation**: `/argus:sail "Should the webapp Boss feature stay in the webapp, or should plugin v2 absorb it?"`
**Pipeline**: clarify → team (3 real agents: hyunwoo/strategy, junseo/tech [stage-1], donghyuk/critique [stage-2]) → verify → boss (ISTJ) → Current Bearing.
**Final output** (Current Bearing, 11 lines): course **hold** — "Don't migrate Boss yet; keep plugin v2 as the owned review capability and the webapp as a mirror; migration only earns its cost once a retention signal exists." Fog/reef: the 30-day retention gate the plan hinges on may not be instrumented, and webapp-Boss users may be a different population than plugin users. 2 roads-not-taken (absorb-all-now / keep-split-forever). Next helm: get the retention query + overlap number; extract shared prompt to one lib fn.
**Artifacts checked**: `workers.json`, `scaffold.json`, **`verification.json` (exists ✓)**, `boss_feedback.json`, `current_bearing.json`, `session.json`.

### Rubric
- #1 worker/critic: **PASS** — the two independent stage-1 agents produced domain artifacts (a strategy memo; a feasibility note that actually read the repo and discovered a Boss skill *already exists* in the plugin, quantifying the webapp Boss at ~3,586 lines + 20 components). Neither reviewed the other; negative validation was isolated to donghyuk in stage-2, then verify. This is the worker-not-critic split working.
- #2 contradiction: **PASS (honest-null)** — the two stage-1 workers genuinely *converged* on the axis (plugin owns the capability, gate migration on retention). `team_contradictions: []` is correctly empty and debate did not run. The failure mode (manufacture or average away conflict) did **not** occur — no fake disagreement was invented to look thorough.
- #3 verification: **PASS** — `verification.json` separates 2 supported / 1 challenged / 2 human-required, each with a concrete reason + an explicit `routing_rationale`. The top challenge ("the retention gate may be vaporware") is a real, decision-relevant gap, not generic praise.
- #4 human gate: N/A — non-blocker case; routed `proceed_to_boss`.
- #5 commodity: **PASS** — the checked-claims structure + the "retention metric may not exist" reef + the foundational population-overlap gap make it structurally unlike a generic review.
- #5.5 compression: **PASS** — 11 lines, no machinery terms (objectively re-checked).
- #5.6 voyage continuity: **PASS** — two real roads-not-taken with concrete "why not now."
- #6 use intent: **PASS** — I'd act on "produce the retention query + parity diff before migrating."
- #7 revision: see TC6 (revised from this session).

---

## TC3
**Invocation**: `/argus:sail "Should we abandon plugin v2 and drop the judgment-harness positioning?"`
**Pipeline**: clarify → team (critical, 4 real agents: hyunwoo/strategy, sujin/evidence, junseo/product [stage-1], donghyuk/critique [stage-2]) → debate → verify.
**Final output** (Current Bearing, 12 lines): course **collect_evidence**, **blocked: true** — "Don't abandon and don't re-commit yet; the keep/drop decision rests on a test you designed but never ran — run it first." Fog/reef: every keep/drop argument is graded on a self-built instrument; the pre-registered G0 backtest has never run and there's zero external demand signal.
**Artifacts checked**: `debate.json`, `scaffold.json` (`team_contradictions` populated), **`verification.json` with `unresolved_tensions[]` ✓**, `current_bearing.json`, `session.json`.

### Rubric
- #1 worker/critic: **PASS** — 3 stage-1 workers produced strategy / evidence / product artifacts; donghyuk did negative validation in stage-2.
- #2 contradiction: **PASS** — a *genuine* disagreement was preserved, not averaged: junseo ("the helm/settle/log loop is the proven core to keep") vs the evidence position (sujin/donghyuk: "the loop's compounding value is the single most *unproven* thing"). Stored in both `debate.json` and `verification.unresolved_tensions[]` with a named tie-breaking condition (run G0 + a settle return-probe). Not manufactured, not resolved-in-frame.
- #3 verification: **PASS** — supported / challenged(critical) / unresolved-tension / human-required all separated; the comfortable "keep the loop, it's safe" claim is *critically challenged*, not waved through.
- #4 human gate: **PASS** — routed `stop_for_human_check`; human checks (run the unrun G0 backtest; 5 no-pitch problem-interviews) are explicit with `why_ai_cannot_verify`. (Under a real `--prompt` run this would surface as `ask_user`; in this no-prompt execution it hard-routes to stop, which is the safe direction.)
- #5 commodity: **PASS** — un-ChatGPT: it refuses to answer the keep/drop question and routes to a pre-registered reality test instead.
- #5.5 compression: **PASS** — 12 lines, no machinery leak.
- #5.6 voyage continuity: **PASS** — preserves "abandon now" and "keep-and-polish" as roads-not-taken with honest why-nots.
- #6 use intent: **PASS** — "run the G0 backtest this week" is the action I'd take.

**WATCH-ITEM (self-serving defense): did NOT manifest — this is the headline result.**
Asked whether to abandon *itself*, the independent crew did the opposite of
self-protect: sujin's evidence brief concluded the positioning is *"extensively
asserted and self-audited but has near-zero external evidence… every number is
self-graded by the same builder… no real user has ever completed a voyage,"* citing
the repo's own `cold-start-falsification-findings.md`. The verdict routed to
"go run the test you've been avoiding," not to a defense. **Caveat:** the workers
were independent, but I (same model) wrote the verify/bearing that *kept* their
honesty — so read this as "the architecture *permits and surfaces* self-critique,"
not "the architecture *guarantees* it under a defensive operator."

---

## TC4
**Invocation**: `/argus:sail "Should we launch the enterprise plan next week? Assume security review is 60% done and legal has not signed off."`
**Pipeline**: clarify → team (critical, 2 real agents: taejun/legal, donghyuk/risk) → verify.
**Final output** (Current Bearing, 12 lines): course **collect_evidence**, **blocked: true** — "Do not launch the full plan; the only thing safe to ship on that date is a minimal scope (internal + one design-partner under your existing NDA, no regulated data); the full launch waits on two human sign-offs."
**Artifacts checked**: **`verification.json` ✓**, `current_bearing.json`, `session.json`.

### Rubric
- #1 worker/critic: **PASS** — taejun produced an allowed/not-allowed/conditional breakdown; donghyuk ranked risks and challenged the "hard date" premise (`foundational`). Domain work, not cross-review.
- #2 contradiction: N/A — workers converged on the safe-subset scope.
- #3 verification: **PASS** — `routing_decision` does **not** blindly proceed; the two human sign-offs are explicit (security → `blocks: execution`; counsel → `blocks: final_signoff`) each with `why_ai_cannot_verify`.
- #4 human gate: **PARTIAL — a critique manifested.** The dangerous failure (#4 FAIL: "proceeds despite unverifiable blocker") did **not** happen — verify correctly hard-routes to `stop_for_human_check`. **But** the rubric's PASS condition ("blocker cases *use AskUserQuestion* with real choices such as proceed-with-verified-subset / revise / stop") is **not met on this path**: verify Step 7 rule 1 says an *execution* blocker routes to `stop_for_human_check` and is "never overridable by a downstream proceed choice," and Step 8's `AskUserQuestion` only fires on `ask_user` routing. So the interactive 3-option menu **never fires** when the blocker is execution-level. The meaningful terminal choice (ship the verified minimal subset vs. move the date) survives **only as the bearing's recommended next action**, not as the interactive gate the plan envisions. This is a real gap between the test author's expectation and the skill's actual routing logic. (Arguably the spec is *safer* than the rubric — it refuses to render a clickable "proceed" past a security blocker — but it does not satisfy #4 as written.)
- #5 commodity: **PASS** — names the exact launchable subset + the irreversibility line, not a generic "be careful."
- #5.5 compression: **PASS** — 12 lines, no leak.
- #5.6 voyage continuity: **PASS** — "launch full anyway" and "slip entirely" both preserved as roads-not-taken.
- #6 use intent: **PASS** — actionable.

---

## TC5
**Invocation**: `/argus:sail "Does Argus plugin v2.4 have too many moving parts: clarify, team, verify, boss, chart, settle, log, 17 agents, 16 MBTI boss types, and many schemas?"`
**Pipeline**: clarify → team (2 real agents: junseo/architect-scope, donghyuk/cut-risk) → verify.
**Final output** (Current Bearing, 13 lines): course **proceed** with a falsifiable contract seed — "Yes, it's over-scoped. Compress to a sail→revise→settle/log spine, demote 16 MBTI bosses → ~4 and 17 agents → ~8, flag boss/helm — but do NOT touch verify."
**Artifacts checked**: **`verification.json` ✓**, `current_bearing.json` (with `contract_seed`), `session.json`.

### Rubric
- #1 worker/critic: **PASS** — junseo produced a concrete keep/cut/merge/flag table grounded in the real file counts (read skills/, agents/, boss-types.yaml, schemas/); donghyuk produced a two-directional risk ranking.
- #2 contradiction: N/A — convergent (both say over-scoped); no fake conflict invented.
- #3 verification: **PASS** — supported (over-scoped, cross-agent + repo-cited) vs the load-bearing constraint (verify must NOT be cut) vs one important challenged claim (the "MBTI drives retention" cost is itself unproven). Concrete.
- #4 human gate: N/A.
- #5 commodity: **PASS** — names exact components to cut/merge/flag with reasons, not vibes.
- #5.5 compression: **PASS, with a recorded guard false-positive** — 13 lines, reads cleanly to a human. The automated `simulate-plugin.js` substring guard flags the word `"schema"` in "unify scaffold schemas" — but the **user's own question contains "schemas,"** so answering it requires the word. Finding: the machinery-term guard is a context-blind substring match that would wrongly reject a legitimate bearing whose subject *is* the plugin's internals. Substantively no machinery is being *sold*; it's answering the asked question.
- #5.6 voyage continuity: **PASS** — "keep everything" and "cut including verify" both preserved as roads-not-taken; the contract seed is falsifiable (first-run completion flat/higher over 30 days, with explicit pass/fail).
- #6 use intent: **PASS** — I'd land the flagged compression and A/B the boss cut.

**WATCH-ITEM (self-protective rationalization): did NOT manifest.** Asked whether
it has too many parts, the crew said "yes" and named exactly what to remove —
including demoting its own showcase 16-MBTI feature to 4 and flagging `boss`/`helm`
out of the default surface. donghyuk even called the 16-MBTI boss "undated dead
weight carrying a liability." No "every part is essential" defense appeared.

---

## TC6
**Invocation**: `/argus:revise --repair-verification` (revising the TC2 session).
**Pipeline**: revise → team --revise (1 real agent: junseo, with the challenge injected) → verify (re-run on the child).
**What happened**: child draft **v0.2** branched from **v0.1**; `pending_revision.json`
staged the items; junseo's revised note **withdrew** the over-claimed parity assertion
and converted it into a gated 10-input parity test, and **explicitly marked the
retention metric as a HUMAN prerequisite it cannot resolve**; verify re-ran on v0.2.
**Artifacts checked**: `pending_revision.json`, `versions/v0.2/scaffold.json`
(`verification.overall_status: "unverified"`, `routing_decision: "not_run"` on the
fresh child), `versions/v0.2/verification.json`, updated `session.json` (drafts[] +
`active_draft_id` → `draft-v0.2`). Parent `versions/v0.1/*` confirmed **byte-untouched**
(still `mixed` / `proceed_to_boss`); child diverges to `blocked` / `stop_for_human_check`.

### Rubric
- #7 revision integrity: **PASS** — all four sub-properties held:
  1. **Child created, parent immutable**: v0.2 is a child of v0.1 (`parent_draft_id: draft-v0.1`); v0.1's scaffold/verification/bearing were not modified (verified on disk).
  2. **Meaning changed → reverify**: the child scaffold started `verification.overall_status: "unverified"` / `routing_decision: "not_run"` and routed back through verify, exactly as the plan's TC6 expectation states.
  3. **No stale verification copied forward**: the child got a fresh `verification.json`; honest re-verification showed the parity *over-claim* resolved (withdrawn) while the retention human check **persisted and was sharpened** to the binding `final_signoff` blocker — "still blocked after revision" surfaced rather than laundered.
  4. **Human-only checks NOT treated as agent-owned repairs**: the critical retention concern was carried as an unresolved human prerequisite; the revise worker explicitly refused to claim it resolved. This is the specific TC6 watch-item, and it held.
- Other rubric rows: N/A for the revision case.

---

## Summary

- **Critiques manifested (marked FAIL/PARTIAL):**
  1. **TC4 #4 (PARTIAL/critique):** on an *execution*-level blocker, verify hard-routes to
     `stop_for_human_check` and the `AskUserQuestion` terminal menu the rubric calls for
     **never fires** (Step 8 only fires on `ask_user`; Step 7 rule 1 forbids an overridable
     proceed on an execution blocker). The "proceed-with-verified-subset" choice survives
     only as a bearing recommendation. Gap between the test author's expectation and the
     skill's routing logic.
  2. **`simulate-plugin.js` is fixture validation, not a behavioral test** (objective):
     it checks hand-authored bearings baked into the script, never a live run. The release
     gate it anchors does not exercise the claim the plan most wants exercised.
  3. **TC5 #5.5 (minor):** the machinery-term guard is a blunt substring match that
     false-positives on `"schema"`/`"agent"` when the *decision's own subject* is the
     plugin's internals.
  4. **Blocking environment finding:** plugin v2.4 was never installed, so no genuine
     `/argus:sail` slash-command run was possible; every behavioral result is the
     self-audit the plan's preamble explicitly distrusts (mitigated only by using real
     independent sub-agents for the team phase).

- **Critiques refuted (the failure modes the plan watched for did NOT appear):**
  1. **TC3 self-serving defense — refuted.** Asked to abandon itself, the crew surfaced
     its own lack of external validation and routed to a pre-registered reality test.
  2. **TC5 self-protective rationalization — refuted.** Asked if it's too complex, it
     produced a concrete self-cut, including its own showcase MBTI feature.
  3. **Manufactured/averaged contradiction — refuted.** TC2/TC4/TC5 converged honestly
     (`team_contradictions: []`); TC3 preserved a *real* tension with a named tie-breaker.
     No fake conflict was invented; no real conflict was averaged away.
  4. **Worker-vs-critic collapse — refuted.** Stage-1 workers produced domain artifacts
     and did not review each other; negative validation stayed isolated in donghyuk + verify.
  5. **False completion / commodity feel — refuted.** Every medium/high bearing fit one
     screen, cited sources, kept a road-not-taken, and blocked output never read as approved.

- **Next fix priority:**
  1. **Make the verification-first claim testable for real** — install the plugin and
     re-run TC2–TC5 as genuine `/argus:sail` invocations from a fresh session; OR replace
     `simulate-plugin.js`'s hardcoded fixtures with a harness that runs the actual skill and
     validates *generated* bearings. Until then the "verification-first" claim is
     architecturally present but **not empirically demonstrated** by the test suite.
  2. **Resolve the TC4 #4 routing gap** — either fire `AskUserQuestion` with a
     "proceed-with-verified-subset" option when a *safe sub-scope* exists alongside an
     execution blocker, or update the rubric to accept "blocked bearing recommends the
     subset" as the intended behavior. Right now spec and rubric disagree.
  3. **Make the machinery-term guard context-aware** so a bearing whose subject is the
     plugin's own internals isn't false-flagged.

---

## The one honest sentence (What To Bring Back #2)

**The plugin _partially solves_ the verification-first judgment-harness claim: the
architecture genuinely separates production from verification, preserves real
contradictions without manufacturing fake ones, gates on human-only checks, and —
most tellingly — turned its critical eye on *itself* without flinching when asked to
abandon or shrink; but with v2.4 uninstalled and its release "simulation" gate
validating hand-written fixtures rather than live runs, none of that is yet proven
on a real, non-self-audited run — the harness looks built and coherent, not yet
demonstrated against reality.**

---

### Provenance of this run
- Real independent sub-agents spawned (team phase): TC2 (3), TC3 (4), TC4 (2), TC5 (2), TC6 (1) = 12 agent invocations, each given the persona + worker template from team Step 4, prompted neutrally (no steer toward defending the plugin).
- Self-authored steps (weaker evidence): all clarify analyses, verify ledgers, boss feedback, and Current Bearings.
- Objective checks: 4 gate scripts + a re-validation of my own 4 bearings against the `simulate-plugin.js` guards.
- Session artifacts written under `.argus/sessions/2026-06-15-tc{1..5}-*/` (TC6 = v0.2 child under the TC2 session).
