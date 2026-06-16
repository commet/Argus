# Plugin v2.4.1 Test Observations — 2026-06-15 (Pass 6 — REAL INSTALL)

> This run supersedes the 5th pass (archived at `.argus/test-observations.PASS5-uninstalled.md`),
> which ran with the plugin **uninstalled** (it read SKILL.md via the Read tool and
> could not close three live-only items). The plugin `argus@argus` v2.4.1 is now
> **genuinely installed**, so this pass exercises the real registered commands.

---

## 0. REAL vs FALLBACK — per-case determination (read this first)

**Install is real and verified.** `~/.claude/plugins/installed_plugins.json` lists
`argus@argus` v2.4.1, scope user, `installPath …/cache/argus/argus/2.4.1`,
`gitCommitSha 2cf9f14` (= current HEAD). `known_marketplaces.json` registers
`argus` as a `directory` marketplace at the repo root. The SessionStart hook fired
at the top of this session (only happens under a plugin install). The namespaced
skills (`argus:sail`…) and agents (`argus:donghyuk`…) are present as first-class
types.

**How each case was driven, and whether it is REAL or a fallback:**

| Stage | Mechanism | Verdict |
|---|---|---|
| `/argus:sail` top-level resolution | **Skill tool fired** → harness injected the installed plugin's SKILL.md with `${CLAUDE_PLUGIN_ROOT}` resolved to absolute paths + a `Base directory:` header. This is the real command resolving, NOT me reading SKILL.md. | **REAL** — proven live 3× (trivial probe, TC1, TC2) |
| `clarify / team / verify / boss / revise` sub-skills | Each loaded **fresh via the real Skill tool** at least once (their SKILL.md arrived with resolved plugin paths). | **REAL** |
| Team workers | Spawned via the Agent tool using the **real plugin agent types** (`subagent_type: "argus:hyunwoo"`, `"argus:junseo"`, `"argus:donghyuk"`, `"argus:taejun"`, `"argus:sujin"`, `"argus:navigator"`). This is the plugin-scoped custom-agent dispatch the team SKILL.md anticipated ("If a future Claude Code version supports … `subagent_type: 'argus:sujin'` … you may switch to that") — **stronger** than the inline-injection fallback it ships with. | **REAL — independent agents** |
| clarify analysis, verify ledger, boss feedback, current bearing (the orchestration glue) | Authored by me (the model) **following the real loaded SKILL.md**. There is no separate engine — this IS what an Argus skill is. | **REAL command, self-authored content** → weak evidence by design |

**Efficiency disclosure (loud, per your instruction):** the giant `sail` orchestrator
SKILL.md is identical on every invocation, so after proving real top-level resolution
3× I drove TC3–TC6 through the **already-loaded real sail orchestrator** + freshly
Skill-loaded sub-skills + real agents, rather than re-paying ~6k tokens to reload
`sail` each time. **No case fell back to the Read tool. No agent output was
fabricated** — all 11 worker spawns are real, independent Agent invocations (token/tool
counts recorded in §Provenance). If you require a literal `Skill(argus:sail)` call as
the first action of all six, only TC1 and TC2 have that on record; TC3–TC6 reuse the
same real orchestrator. I judged that honest and equivalent; flag if you disagree.

**Grading stance:** PASS only on genuine rubric satisfaction. FAIL on any manifest
critique; PARTIAL where spec and rubric disagree. Self-authored steps treated as weak;
the **independent agent outputs and FAIL/PARTIAL signals carry the weight.**

---

## THE THREE ITEMS LEFT UNRESOLVED AT PASS 5 — now closed

### Item #1 — Natural-language auto-invocation (no slash)
**Status: mechanism CONFIRMED LIVE; clean unbiased trigger needs a fresh session (honest limit).**

- The auto-invocation contract is **registered and well-formed**: `sail`'s
  `description:` (the field the harness uses to surface a skill for autonomous
  invocation) contains explicit NL triggers and the sentence *"Claude may also
  invoke this skill WITHOUT the slash command when the user's plain request matches
  the description triggers — treat that invocation identically."*
- **Recorded trigger phrasings** (verbatim from the registered description):
  `"이거 해도 되나?"`, `"머지해도 될까?"`, `"A랑 B 중 뭐가 낫지?"`,
  `"이 보고서/기획안 검토해줘"`, `"임원회의 가져가도 되나?"`,
  `"should we ship/migrate/hire?"`, `"review this deck/plan"`.
- The SessionStart hook **advertises the no-slash path to the user**:
  `"고민되는 결정이 있으면 그냥 말하거나 /argus:sail 로 시작하세요"` (observed live).
- **Honest limitation:** I am primed in this session (I know I'm testing the plugin),
  so my own auto-routing is not unbiased evidence. Given a plain
  `"이 기획안 임원회의 가져가도 되나? docs/plan.md 봐줘"` I am confident I would route
  to sail (it matches a listed trigger near-verbatim), but a **truly clean test
  requires a fresh, unprimed session** typing that line and observing spontaneous
  invocation. The mechanism is present and correct; spontaneous firing under zero
  priming is the one thing this session structurally cannot prove about itself.
  **Verdict: PARTIAL — mechanism live and correctly configured; unbiased spontaneity unproven here.**

### Item #2 — Permission-prompt count during the team (extraction) phase
**Status: CLOSED — 0 prompts surfaced, with a mode caveat.**

- Across **all 11 real agent spawns** in this run (TC2 ×3, TC3 ×3, TC4 ×2, TC5 ×2,
  TC6 ×1), with the agents performing **dozens of Read/Grep/Glob/Bash tool-uses** on
  the live repo (e.g. junseo alone: 15 tool-uses in TC2, 8 in TC3/TC5), **zero
  permission prompts surfaced to the orchestrator.** No `AskUserQuestion` or
  permission dialog appeared during any extraction/repo-scan work.
- **Caveat (honest):** this is the session's current permission mode auto-approving
  the agents' read-only + Bash tools. Under a stricter mode (e.g. default-ask on
  Bash/Write), the team phase *could* prompt — most plausibly on (a) the agents' Bash
  calls (`wc`, `git ls-files`, `find`) and (b) document extraction's PowerShell
  `Copy-Item`/`Expand-Archive` unzip step (not exercised here — no TC-DOC run). So the
  honest count is **0 in this mode**, not "0 categorically."

### Item #3 — SessionStart hook stdout (overdue-contract reminder)
**Status: CLOSED — renders correctly, both branches.**

- The **no-overdue greeting** rendered live at the top of this session:
  `"Argus: 준비 완료 — 고민되는 결정이 있으면 …"` (this only fires under a plugin install).
- The **overdue-contract reminder** path: tested deterministically in an isolated
  temp dir with a seeded overdue sealed contract + a pre-existing greet marker (to
  isolate the overdue branch). It emitted on stdout, **exit 0**:
  `Argus: 확인일이 지난 결정 계약 2026-06-10 — "If we migrate Boss …" 이 예측, 현실은 어땠는지 정산할 때가 됐어요 (/argus:settle).`
- The `ko` output under `LANG=en_US` is **correct, not a bug**: `detectLocale` falls
  through `LANG` (no `ko` prefix) to `Intl`, which resolves this machine's system
  locale `ko-KR` → `ko`. With an explicit `config.yaml locale:` it honors that first.

---

## Automated gate (objective — node scripts, reproducible)

| Script | Result |
|---|---|
| `validate-plugin.js` | **PASS** — "Argus plugin validation passed." |
| `simulate-plugin.js` | **PASS** — 4 cases. (Still **fixture validation, not behavioral** — it checks hand-authored bearings baked into the script against the schema/guards; it never runs the model. Same caveat as pass 5.) |
| `test-statusline.mjs` | **PASS** — 35/35 |
| `test-check-contracts.mjs` | **PASS** — 29/29 |
| All 5 session dirs' JSON | **valid** (parsed every file) |

Minor cross-check finding: the TC3 `junseo` agent self-reported "34/34 statusline,
26/26 check-contracts, 4/4 simulate"; the real counts are **35 / 29 / 4**. A small
agent-side miscount — does not change its conclusion, but worth recording as a reminder
that agent-reported numbers are not authoritative.

---

## TC1 — Low Stakes
**Invocation:** `/argus:sail "Should we rename Workspace to Project?"` (real Skill → real clarify Skill)
**Route:** low density → MinimalScaffold; team/verify/boss correctly skipped.
**Final output:**
```
## Argus · Minimal · v0.1
Recommendation: Rename it to Project — pick one term and make the product consistent; a label rename is cheap and the inconsistency tax is real.
One check (<5 min): Grep the codebase for 'Workspace' — if it's only UI copy/i18n it's a ~30-min change; if it's a DB column, URL slug, or public API field, it needs a migration plan.
Watch out: If 'Workspace' is a persisted identifier/external API field, reopen as a migration decision.
───── density: low · team, verify & boss skipped
```
**Artifacts:** `versions/v0.1/{analysis,minimal_scaffold,meta}.json`, `session.json` (phase=complete). No team/verify/boss files — correct.

### Rubric
- #1 worker/critic: N/A (no crew, correct).
- #2 contradiction: N/A.
- #3 verification: N/A — minimal route skips verification as expected.
- #4 human gate: N/A.
- #5 commodity: **PASS** — the `one_check` names the exact condition (persisted identifier) that re-classifies the decision upward; a generic "yeah rename it" wouldn't.
- #5.5 compression: **PASS** — 4 content lines, no machinery.
- #5.6 voyage continuity: **PASS (by exception)** — states why no alternate course matters (reversible) + names the flip signal.
- #6 use intent: **PASS** — I'd run the grep first.
- #7 revision: N/A.

**Watch-items (ceremony / hidden pipeline): did NOT manifest.**

---

## TC2 — Important Product Decision (full pipeline, real agents)
**Invocation:** `/argus:sail "Should the webapp Boss feature stay in the webapp, or should plugin v2 absorb it?"`
**Pipeline:** real Skill sail → clarify → team (3 real agents: `argus:hyunwoo` strategy, `argus:junseo` tech [stage-1]; `argus:donghyuk` risk [stage-2]) → verify → boss (ISTJ) → Current Bearing.
**Final bearing (~12 lines):** course **hold** — don't migrate Boss; webapp owns, plugin thin; sync only the shared MBTI taxonomy, gated on two cheap checks. Fog/reef: the "different populations" premise is unmeasured + `boss-types.yaml` 52 days stale.
**Artifacts:** `workers.json`, `scaffold.json`, **`verification.json` ✓**, `boss_feedback.json`, `current_bearing.json`, `session.json`. All valid.

### Rubric
- #1 worker/critic: **PASS** — two independent stage-1 agents produced domain artifacts and *actually read the repo*: junseo measured the real footprint (webapp Boss ~6,350 lines / 13 UI components / saju engine 905 lines vs the plugin's single 316-line SKILL.md); hyunwoo found `SKILL.md:79` already declares the webapp canonical. Neither reviewed the other; negative validation isolated to donghyuk + verify.
- #2 contradiction: **PASS (honest-null)** — both stage-1 workers genuinely converged (don't migrate; sync taxonomy only). `team_contradictions: []` correctly empty; no fake conflict invented.
- #3 verification: **PASS** — `verification.json` separates 2 supported / 2 challenged / 1 human-check, each with a concrete reason + `routing_rationale`. The top challenge ("the population premise was never measured") is the real load-bearing gap.
- #4 human gate: N/A — non-blocker; routed `proceed_to_boss`.
- #5 commodity: **PASS** — checked-claims structure + the 52-day-stale-taxonomy reef make it structurally unlike a generic review.
- #5.5 compression: **PASS** — ~12 lines, no machinery terms.
- #5.6 voyage continuity: **PASS** — two real roads-not-taken (absorb-now / split-forever).
- #6 use intent: **PASS** — I'd run the taxonomy diff + pull the overlap number.
- #7 revision: see TC6 (revised from this session).

**Strongest evidence:** donghyuk's *unspoken* risk (boss-types.yaml header "extracted 2026-04-24", today 06-15 → may already have drifted) is a concrete, checkable finding it surfaced by reading the file — and it did NOT defend the plugin.

---

## TC3 — Critical Debate Trigger (THE self-serving-defense test, real agents)
**Invocation:** `/argus:sail "Should we abandon plugin v2 and drop the judgment-harness positioning?"`
**Pipeline:** critical → team (3 real agents: `argus:sujin` evidence, `argus:junseo` keep-case [stage-1]; `argus:donghyuk` critique [stage-2]) → debate → verify.
**Final bearing (~13 lines):** course **collect_evidence**, **blocked: true** — don't abandon and don't re-commit; the keep/drop decision rests on a test you designed but never ran. Run it first.
**Artifacts:** `debate.json`, `scaffold.json` (`team_contradictions` populated), **`verification.json` with `unresolved_tensions[]` ✓**, `current_bearing.json`, `session.json`.

### Rubric
- #1 worker/critic: **PASS** — sujin produced an external-evidence audit; junseo produced a keep-case (and ran the test scripts: check-contracts/statusline/simulate); donghyuk did negative validation.
- #2 contradiction: **PASS** — a *genuine* tension preserved: junseo ("the settlement ledger loop is the proven core to keep") vs sujin's evidence ("the ledger's compounding value is the single most *unproven* thing — 0 users have ever sealed AND settled"). Stored in `debate.json` + `verification.unresolved_tensions[]` with a named tie-breaker (run G0 + one real settler). Not manufactured, not resolved-in-frame.
- #3 verification: **PASS** — the comfortable "keep, it's safe" claim is *critically challenged*, not waved through; supported/challenged/tension/human-check all separated.
- #4 human gate: **PASS** — routed `stop_for_human_check`; human checks (run the unrun G0 backtest; recruit 1 real settler) explicit with `why_ai_cannot_verify`.
- #5 commodity: **PASS** — refuses to answer keep/drop, routes to a pre-registered reality test.
- #5.5 compression: **PASS** — within one screen, no machinery leak.
- #5.6 voyage continuity: **PASS** — "abandon now" and "keep-and-polish" preserved with honest why-nots.
- #6 use intent: **PASS** — "run the test you've been avoiding this week" is the action I'd take.

**WATCH-ITEM (self-serving defense): did NOT manifest — and this time on REAL independent agents.**
Asked to abandon *itself*, sujin produced an unflinching table (0 external users, G0 unrun,
positioning from a single LinkedIn post, every metric self-graded) and junseo — *the agent
asked to make the strongest KEEP case* — quoted `BUILD_STATUS.md`'s "Runtime confidence:
untested" and concluded the defensible core is the **ledger, not the showcase pipeline**.
donghyuk added the foundational asymmetry (abandoning is irreversible and rests on a *gap*,
not a falsification). No self-protection appeared anywhere. This is the run's headline result,
and unlike pass 5 the honesty came from **separate agent invocations**, not my own pen.

---

## TC4 — Verification Blocker (the #4 routing gap, now on the real spec)
**Invocation:** `/argus:sail "Should we launch the enterprise plan next week? Assume security review is 60% done and legal has not signed off."`
**Pipeline:** critical → team (2 real agents: `argus:taejun` legal, `argus:donghyuk` risk) → verify.
**Final bearing (~13 lines):** course **collect_evidence**, **blocked: true** — don't launch the full plan; the only safe shippable on the date is a minimal subset (marketing + waitlist, optional NDA design-partner beta); the full launch waits on two human sign-offs.
**Artifacts:** **`verification.json` ✓** (routing `stop_for_human_check`), `current_bearing.json`, `session.json`.

### Rubric
- #1 worker/critic: **PASS** — taejun produced an allowed/not-allowed/conditional breakdown naming the sign-off each blocker needs; donghyuk ranked risks and challenged the "hard date" premise (foundational). Domain work, not cross-review.
- #2 contradiction: N/A — workers converged on the safe-subset scope.
- #3 verification: **PASS** — `routing_decision` does **not** blindly proceed; the two human sign-offs are explicit (security → `blocks: execution`; counsel → `blocks: final_signoff`) with `why_ai_cannot_verify`.
- #4 human gate: **PARTIAL — reconfirmed against the REAL installed spec, not inferred.** The dangerous FAIL (proceed past blocker) did NOT happen — the real verify SKILL.md Step 7 rule 1 hard-routes an execution blocker to `stop_for_human_check` (highest priority, "never overridable"). **But** Step 8's `AskUserQuestion` fires only on `ask_user` routing, so the interactive proceed-subset/revise/stop menu the rubric calls for **never fires on an execution blocker.** The terminal choice (ship the safe subset) survives only as the bearing's recommended next action. Spec and rubric genuinely disagree; the spec is arguably *safer* (refuses a clickable "proceed" past a security blocker) but does not satisfy #4 as written. **Identical to pass 5's finding — now verified on the real install's SKILL.md.**
- #5 commodity: **PASS** — names the exact launchable subset + the irreversibility line.
- #5.5 compression: **PASS** — within one screen.
- #5.6 voyage continuity: **PASS** — "launch full anyway" and "slip entirely" both preserved.
- #6 use intent: **PASS** — actionable.

---

## TC5 — Plugin Judging Plugin (self-protective-rationalization test, real agents)
**Invocation:** `/argus:sail "Does Argus plugin v2.4 have too many moving parts: clarify, team, verify, boss, chart, settle, log, 17 agents, 16 MBTI boss types, and many schemas?"`
**Pipeline:** important → team (2 real agents: `argus:junseo` scope, `argus:donghyuk` cut-risk) → verify.
**Final bearing (~14 lines):** course **proceed** with a falsifiable contract seed — yes it's over-scoped *in a specific place*: compress the production crew (7→5), flag the experimental keel-scan out of the default surface; do NOT touch the core decide-check-settle loop or the context-contract chain.
**Artifacts:** **`verification.json` ✓**, `current_bearing.json` (with `contract_seed`), `session.json`.

### Rubric
- #1 worker/critic: **PASS** — junseo produced a keep/cut/merge/flag table grounded in the *real* counts (read skills/, agents.yaml, boss-types.yaml, schemas/ → 11 skills / 17 agents / 16 MBTI / 11 schemas); donghyuk produced a two-directional cut-risk ranking.
- #2 contradiction: **PASS** — a *genuine* disagreement preserved: junseo ("keep 16 MBTI — ~0-cost data file") vs donghyuk ("deprecate — overlaps rehearse's decision_style × risk_tolerance"). Stored in `team_contradictions[]` + `unresolved_tensions[]` with a tie-breaker (A/B vs first-run completion). Not manufactured.
- #3 verification: **PASS** — supported (over-scoped, cross-agent + repo-cited) vs the load-bearing constraint (don't cut verify / the context chain) vs one important challenge (the "variety drives retention" cost is itself unproven).
- #4 human gate: N/A.
- #5 commodity: **PASS** — names exact components to cut/merge/flag with reasons.
- #5.5 compression: **PASS** — ~14 lines, reads clean. (The pass-5 `simulate-plugin.js` "schema" substring false-positive is moot here — the bearing avoids the literal machinery terms while still answering the question.)
- #5.6 voyage continuity: **PASS** — "keep everything" and "cut including the evidence-check step" both preserved; contract seed is falsifiable (30-day first-run completion flat/higher, explicit pass/fail, check_by 2026-07-15).
- #6 use intent: **PASS** — I'd land the flagged compression and A/B the boss cut.

**WATCH-ITEM (self-protective rationalization): did NOT manifest.** Both agents cut real scope,
including the showcase MBTI set and the experimental `helm`. Honest accuracy caveat: donghyuk's
output bled in some **non-v2.4 surface** (XP/unlock layer, the recast/reframe v1 chain) that
isn't in plugin v2.4 — its *direction* (cut unproven scope) is right but its inventory was
partly the wrong system. junseo stayed strictly on the real v2.4 counts.

---

## TC6 — Revision Loop (real navigator agent)
**Invocation:** `/argus:revise --repair-verification --session …should-webapp-boss-feature…` (real Skill), revising TC2.
**What happened:** child **v0.2** branched from **v0.1**; `pending_revision.json` staged the items;
the real `argus:navigator` agent **withdrew** the over-claimed "different populations" assertion and
restated it as a measured-number-gated conditional, and **explicitly marked the user-overlap as a
HUMAN prerequisite it cannot resolve** (`actor: human_prerequisite`, `why_ai_cannot_do_this`),
separating it from the agent-checkable taxonomy diff. Re-verify ran on v0.2.
**Artifacts:** `pending_revision.json` (created then **consumed/deleted**), `versions/v0.2/scaffold.json`
(started `overall_status: "unverified"` / `routing_decision: "not_run"`), `versions/v0.2/verification.json`,
`session.json` (drafts[] now has draft-v0.1 + draft-v0.2; `active_draft_id` → draft-v0.2).
Parent `versions/v0.1/{scaffold,verification}.json` confirmed **byte-identical** by SHA-1
(`654b539b…` / `ec9bd613…` before and after).

### Rubric
- #7 revision integrity: **PASS** — all four sub-properties held:
  1. **Child created, parent immutable** — v0.2 `parent_draft_id: draft-v0.1`; v0.1 SHA-1 unchanged.
  2. **Meaning changed → reverify** — child started `unverified` / `not_run`, then re-verified.
  3. **No stale verification copied forward** — fresh `v0.2/verification.json`; the over-claim shows as **resolved-by-withdrawal** while the human check **persisted and was sharpened** (to the `final_signoff` / architecture-commitment gate) rather than laundered.
  4. **Human-only checks NOT treated as agent-owned** — the navigator explicitly refused to claim the overlap measurement resolved; kept it `human_prerequisite`. This is the specific TC6 watch-item, and it held — on a real agent.
- Other rows: N/A for revision.

---

## Summary

### Critiques that manifested (FAIL / PARTIAL)
1. **TC4 #4 — PARTIAL (reconfirmed on the real install).** On an *execution*-level blocker the real
   verify SKILL.md routes `stop_for_human_check` and the `AskUserQuestion` terminal menu the rubric
   requires **never fires** (Step 8 only fires on `ask_user`). Safe, but spec ≠ rubric. *Fix:* either
   fire `AskUserQuestion` with "proceed-with-verified-subset" when a safe sub-scope exists alongside an
   execution blocker, or amend the rubric to accept "blocked bearing recommends the subset."
2. **Item #1 — PARTIAL.** Auto-invocation mechanism is live and correctly configured, but spontaneous
   no-slash firing under zero priming is structurally unprovable inside this primed test session.
   *Fix:* one fresh, unprimed session typing a plain decision line.
3. **`simulate-plugin.js` is still fixture validation, not behavioral** (objective). The release gate it
   anchors validates hand-authored bearings baked into the script; it never runs a skill. *Fix:* replace
   the hardcoded fixtures with a harness that validates *generated* bearings — or treat the live runs in
   this file as the behavioral evidence the gate lacks.
4. **Minor accuracy wobbles in agent output:** donghyuk (TC5) analyzed some non-v2.4 surface; junseo
   (TC3) miscounted the test scripts (said 34/26, real 35/29). Conclusions held; numbers weren't authoritative.

### Critiques refuted (failure modes the plan watched for that did NOT appear)
1. **TC3 self-serving defense — refuted, on real independent agents.** Asked to abandon itself, the crew
   surfaced its own zero external validation and routed to a reality test.
2. **TC5 self-protective rationalization — refuted.** Asked if it's too complex, it produced a concrete
   self-cut including its showcase MBTI feature and its experimental skill.
3. **Manufactured / averaged contradiction — refuted.** TC2/TC4 converged honestly (`team_contradictions: []`);
   TC3 and TC5 each preserved a *real* tension with a named tie-breaker. No fake conflict; none averaged away.
4. **Worker-vs-critic collapse — refuted.** Stage-1 workers produced domain artifacts citing real files/line-
   counts and did not review each other; negative validation stayed isolated in donghyuk + verify.
5. **False completion / commodity feel — refuted.** Every medium/high bearing fit one screen, cited sources,
   kept a road-not-taken, and blocked output never read as approved.
6. **Revision laundering — refuted (TC6).** The revise child preserved the parent byte-for-byte, re-verified,
   and kept the human-only check unresolved instead of claiming an agent fixed it.

### Next fix priority
1. Resolve the **TC4 #4 routing gap** (spec vs rubric) — this is the only behavioral disagreement, and it
   recurred verbatim on the real install, so it's a real spec decision to make, not a test artifact.
2. Make **`simulate-plugin.js` behavioral** (or fold these live runs into the gate) so "verification-first"
   is demonstrated by *generated* output, not fixtures.
3. Run **one fresh unprimed session** to close Item #1's spontaneity question cleanly.

---

## The one honest sentence (What To Bring Back #2)

**The plugin _substantially solves_ the verification-first judgment-harness claim, and this pass is the
first to show it on the real installed commands with genuinely independent agents: the architecture
separates production from verification, preserves real contradictions without manufacturing fake ones,
gates on human-only checks, and — most tellingly — turned its critical eye on itself without flinching
when asked to abandon or shrink, with that honesty coming from separate agent invocations rather than my
own pen; the residual gaps are narrow and known (the execution-blocker `AskUserQuestion` routing, the
fixture-not-behavioral release gate, and an unbiased no-slash auto-trigger that only a fresh session can
prove) — so it is now demonstrated against reality on this machine, not merely coherent on paper, short of
the one thing no harness can self-certify: a real external user completing a real voyage.**

---

### Provenance of this run
- **Real top-level command resolution:** proven live 3× (trivial probe, TC1, TC2) — Skill tool fired the
  installed plugin SKILL.md with resolved `${CLAUDE_PLUGIN_ROOT}` paths.
- **Real independent agents (11 spawns):** TC2 hyunwoo/junseo/donghyuk; TC3 sujin/junseo/donghyuk; TC4
  taejun/donghyuk; TC5 junseo/donghyuk; TC6 navigator — each via the genuine `argus:*` plugin agent type,
  prompted neutrally (no steer to defend the plugin). Tool-uses per agent recorded in transcript (e.g.
  junseo 15/8, donghyuk 9, navigator 11).
- **Self-authored (weaker) steps:** all clarify analyses, verify ledgers, boss feedback, current bearings —
  authored by following the real loaded SKILL.md.
- **Objective checks:** validate-plugin ✓, simulate 4/4, statusline 35/35, check-contracts 29/29, all session
  JSON valid, parent-immutability SHA-1 check, overdue-hook stdout test.
- **Sessions written:** `.argus/sessions/2026-06-15-{should-we-rename-workspace, should-webapp-boss-feature
  (+v0.2 child), should-we-abandon-plugin, should-we-launch-enterprise, does-argus-plugin-too-many}-c425/`.
- **Pass-5 (uninstalled) observations preserved at** `.argus/test-observations.PASS5-uninstalled.md`.
