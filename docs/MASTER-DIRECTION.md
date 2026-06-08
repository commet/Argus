# ARGUS — THE MASTER DIRECTION

> Single source of truth. **Supersedes `docs/PLAN.md`.**
> Synthesizes four prior workflows: A (DEEP-PLAN / diagnosis), B (BLINDSPOT / seams), C (TARGET-STATE / incremental forward design), D (RADICAL-RETHINK / radical alternatives + red-team).
> **Rev 2 (2026-06-04):** §0 added — the web-native **closed-loop kick** (Decision Contract → return-to-grade → compounding outcome data), elevated from "one graft" to the retention spine after a web-app-vs-plugin feasibility pass. All §3 layers re-anchored to it; risk discipline unchanged (heavy schema migration stays gated behind §4 kill-test).
> Every load-bearing claim below was re-verified against source on 2026-06-04; the fabricated/stale claims A and B flagged are explicitly refused (§7).
> Principle inherited from PLAN.md and confirmed by all four sources: **smallest safe step first, test-gated, never build on sand. 1004 tests stay green at every layer.**

---

## 0. THE KICK — The Web-Native Closed Loop

The single differentiating move, and the spine the whole forward plan now hangs on. It is the **Decision Contract closed loop**, delivered in the form the web app can actually own.

**The loop has two halves; the web app owns one fully and earns the other.**

1. **Pre-flight (in-session wow, 100% web-native, ships on today's stack).** Every voyage ends NOT in four dead markdown files but in **3–6 specific, falsifiable predicates** — serialized from data the engine already computes (recast AI-vs-human step assignments + blindspot `classified_risks` + `governing_idea`). e.g. *"the CFO will object to cost at the pricing step,"* *"step 3 must be human-judged, not handed to AI."* This needs no execution observation — it is pure in-session value and the thing a first-time user feels immediately.

2. **Return-to-grade (the retention engine, web-native but EARNED, not automatic).** The web app structurally **cannot auto-observe** what the user did after they leave (that auto-magic version is the plugin's, §6). Instead the web app *earns the return*: the specific predicate is the hook — **"You predicted the CFO would object at pricing. Did it? [happened / avoided / partial]"** is a far stronger reason to come back than a vague journal ping. Closing is done two web-native ways, **one already half-built**:
   - **(a) user-reported outcome** — `useAccuracyStore.addRating` + `OUTCOME_RECORDS` already exist and already feed back into `context-builder.ts:61-63`. The gap: today it rates *personas*, not *predictions*, and it is buried. **Upgrade it from persona-rating → predicate-grading.** Light, reuses existing plumbing, **no schema migration.**
   - **(b) paste-back** — user pastes the AI output / final artifact; Argus grades pre-flight vs it via the existing eval engine. Buildable, not yet built.

**Why this is THE kick (not just a feature):**
- **Unforgeable moat.** Only a tool holding the *pre-flight contract* can grade the *post-flight reality* of YOUR specific decision. ChatGPT has no memory of it; a journal has no falsifiable claim to check.
- **It manufactures the outcome data every deferred bet was waiting for.** A's prompt-mutation engine, D's compounding judgment model, the whole "smarter every use" thesis were ALL deferred for one reason: *no real outcome data*. Graded predicates ARE that data, produced as a by-product of normal use. **This one kick unblocks the rest of the roadmap.**
- **It fixes the category problem** the founder's own `.argus/last-run.md` flagged ("판단 하네스를 아무도 모른다"): "the thing that predicts how your decision goes wrong, then tells you if it was right" is concrete and demonstrable; "judgment harness" is not.

**The honest risk, stated plainly (do not bury it):** the web app's moat *hinges on the user returning*, which is the **exact unproven premise** A/B/C/D all flagged. The plugin sidesteps this (daily frequency → automatic). The web app cannot — it must earn the return. Therefore the cheap, light, user-reported grading (2a) ships early **as the instrument that runs §4 Test 1**; the **heavy per-predicate schema migration (L3b) and the silent auto-grading loop (L5) stay gated** behind that kill-test. We design for the full loop, prove the return is real for ~1–2 days of cost, and only then pay for the irreversible parts. **Same engine, two strengths: the plugin gets the automatic loop; the web app gets the earn-the-return loop.**

---

## 1. North-Star

Argus is a **decision harness you run before you hand work to an AI** — "Think before you recast." Its target user is a non-developer strategist deciding *what* to have AI do, and its only real competitor is "just ask ChatGPT." That framing dictates everything: the moat cannot be "a smarter model" (ChatGPT wins that), it can only be **your accumulating, attributable, falsifiable judgment about your own past decisions** — something ChatGPT structurally cannot produce about *your* specific voyage. The genuine assets we are protecting and building on are real and verified: the `llm.ts` engine (categorized errors, circuit breaker, multi-strategy `parseJSON`, `validateShape` already wired at `llm.ts:778-781`), the typed Phase-1/2 content intelligence (`context-chain.ts:119-525` already returns typed `ReframeContext`/`RecastContext` with provenance markers), the already-on-disk `.argus/` decision ledger (`journal.md`/`recast.md`/`reframe.md` etc., verified populated), and the 1004-test net that is our working capital.

The forward direction is **HYBRID, not pure-incremental and not radical**. We extend the voyage DNA exactly as C argues — the genealogy throughline (Argus shows its reasoning genealogy, and yours) made visible across five surfaces, reusing 60-80% of shipped infrastructure — but we graft **exactly one radical mechanic from D immediately**: the **Decision Contract** (3-6 pre-committed, falsifiable, ID'd predicates), because C's own retention answer is honest self-report that C *admits* it cannot prove converts, and D's contract is the cheapest thing that turns "how'd it go?" into a checkable claim. Every chassis-demolishing radical reshape (execution-bound harness, multiplayer room, agent-native, decay-by-timer push) is **rejected as a spine** — they die on the verified "distribution scissors": the non-dev strategist executes in a chat box and by hand, exposing no instrumentable runtime, and v2's plugin manifest declares no hooks array, so no silent execution gate can fire.

But no forward surface ships on sand. A and B prove the chassis is **actively crashing and silently betraying its own thesis today**: an infinite-spinner streaming bug, two real null-deref crashes on export and judgment, a worker that *silently auto-accepts a validation-FAILED result* (the engine itself betraying "think before you recast"), and a quota write that swallows the user's lost thinking with zero UI signal. These are the floor. We lay the floor first, ship visible wins second, and gate the most expensive, least-reversible bet (the per-predicate schema migration) behind a cheap kill-test — because the retention premise that C's Mirror and D's Verdict *both* depend on is empirically unproven, and when two paths carry the same unproven risk the only rational tiebreaker is which is cheaper to falsify.

---

## 2. The Incremental-vs-Radical Verdict

**VERDICT: HYBRID.** C's incremental DNA-extension is the spine; exactly **one** radical graft is taken now; all radical chassis reshapes are rejected as the spine; the expensive radical migration is deferred behind a kill-test.

**Why (the decisive, verified logic):**
1. **Same unproven premise → cheapest-to-falsify wins.** C's Mirror retention tab and D's radical Verdict spine rest on the *identical* unvalidated bet: "does a non-dev care, weeks later, that a past prediction can be graded?" B says this is **empirically unknowable from any static read**. When the risk is shared, the tiebreaker is cost-to-falsify — unambiguously the incremental graft (D red-team `case_for_incrementalism #1`).
2. **The radical spine's gate is the least-reversible change in the repo.** Verified: `HiddenAssumption` (`types.ts:11-18`) and `KeyAssumption` (`types.ts:136-141`) have **no `id`, no `created_at`, no `status`**. Every load-bearing sentence of the living-ledger thesis ("47 days old", "contradicted by what you logged") needs all three. The migration touches the assumption type across reframe/recast/rehearse + the eval engines that emit them + JSONB atomicity (migration `20260409` already built a custom atomic RPC to dodge a read-modify-write race). Honestly 3-4 weeks on the single most migration-hostile seam — spend it only on evidence.
3. **D's own tournament de-rates every radical chassis as a replacement.** Verdict (4.33) dies on distribution scissors; Judgment Room on multiplayer cold-start; Harbormaster on trigger-unreliability (verified: no hooks array, skills fire only on explicit invocation); Sharpening (3.75, last) on commoditization. D's verbatim red-team verdict: *"You never have to delete ProgressiveFlow to ship the value."*

**Radical grafts — TAKE NOW (reversible, ride existing infra, zero migration):**
- **Decision Contract — THE KICK / retention spine (see §0), not merely a graft.** serialize 3-6 falsifiable predicates from data the engine already computes (recast AI-vs-human step assignments + blindspot `classified_risks` + `governing_idea`) into a reversible JSON sidecar surfaced as a FinalCard "Verdict" view. ~1-2 days, ProgressiveFlow untouched, reuses `context-chain.ts` typed provenance. (D must-carry #1; closes B P0#2 and de-risks C's retention assertion.) **Paired with the light return-to-grade loop:** upgrade the already-built `useAccuracyStore`/`OUTCOME_RECORDS` from persona-rating → predicate-grading (no schema migration) so the contract is checkable on return — this light loop IS the §4 Test-1 instrument. The heavy per-predicate schema migration (L3b) and silent auto-grading (L5) remain gated behind the kill-test.
- **userContext → prompt injection** (B's S1, "cheapest high-leverage fix in the repo") — `buildInitialAnalysisPrompt(problemText, locale)` (`progressive-prompts.ts:23`) takes no userContext; `user-context.ts:57-58` marks observations UI-only. Inject as scoped `참고:` reference-only per CLAUDE.md, never directive. ~1 line.
- **Anchoring / judgment-atrophy guard** — a first-class override-rate metric. Promoted to must-carry because *no other source carries it* and without it the success metric and the mission-betrayal metric (judgment atrophy) are the same green number. Non-negotiable per CLAUDE.md "patterns are reference-only, never directive."
- **`.argus/` ledger as the render spine** (D Harbormaster graft) — verified the ledger exists and persists on disk. C's expensive (L-effort) "render the gold provenance thread from Zustand/Supabase" becomes "render an artifact already on disk" (M-effort), yielding a git-blame-able genealogy ChatGPT cannot offer.

**Radical grafts — DEFER behind a kill-test:**
- **Per-predicate `id`/`created_at`/`status` schema migration** (3-4 wks, least-reversible). Green-light ONLY if **Test 1** (named-specific-predicate framing beats Mirror framing on weeks-later return) OR **Test 2** (silent prediction-accuracy shows positive slope vs voyage count) passes (§4).
- **Silent prediction-and-self-scoring loop** — net-new (verified: `useAccuracyStore` rates PERSONAS, not predictions — *not* a repoint). Build only after the Decision Contract earns Test-1/Test-2 evidence; reuses `judgment-vitality.ts` + `observation-engine.ts`.

**Radical concepts — REJECTED as spine (kept only as deferred Pro/dev lanes or future nice-to-haves):**
- Execution-bound harness / agent-native (Verdict, Harbormaster) — distribution scissors + no hooks array. Execution-observation is a **Pro/dev lane only**, never the strategist spine.
- Multiplayer room (Judgment Room) as spine — cold-start. *Preserved only* as a future one-screen "Get 2 colleagues blind read" button activating the verified-dead `useTeamStore` substrate (`submitReviewInput` forces `visible:false`, `revealInputs` owner-gated, `team_review_inputs` table exists, referenced by no component) — zero new tables, gated behind its own cold-start kill-test. **Not Wave 0.**
- Decay-by-timer push (Argus Live) — "your assumption is 47 days old" without a logged outcome is spam, not insight.
- Prompt-mutation / self-improving engine (A's Track L Phase 4) — **parked until N real sessions with outcome data exist** (A's "amplify bad signals" trap; B agrees it's roadmap-scale).

---

## 3. The Sequenced Master Plan

Dependency spine: **L0 stop-the-bleeding → L1 visible wins + L1b injection → L2 decomposition (flagged) + L3a Phase-0 persistence (parallel) → L4 forward surfaces (C + the §0 KICK: Decision Contract + light return-to-grade) → L5 deferred, kill-test-gated.** L0 gates everything. The §0 closed-loop kick is the through-line of L4 and rides L1-timing (no L2/L3 dep). L3b and L5 gate on a kill-test, not a calendar.

### L0 — Stop-the-bleeding crash & philosophy floor (all S, ZERO foundation deps, gates everything)
**Goal:** a product that does not infinite-spin, crash on export/judgment, or silently betray its own thesis. Nothing user-facing is worth shipping until this lands.
- **P0 stream hang** — `callLLMStream` (`llm.ts:627-757`) is `Promise<void>` signalling via callbacks; the `reader.read()` loop at `llm.ts:696-697` has **no inactivity watchdog and no request-level abort timeout** (only backoff `setTimeout` at 195/210). **A's original Promise.race fix is WRONG** (verified: racing a void promise cannot distinguish streaming from hung). **Correct mechanism:** wrap `reader.read()` in a per-chunk inactivity watchdog (~30s idle → abort via the existing `options.signal` at `llm.ts:679`) + a hard ~180s cap. *(A must-carry P0)*
- **P1 null-deref, brief export** — `project-brief.ts:130` reads `latest.analysis.steps` with no optional chaining → crashes export. Fix `?. / ?? []`. *(A must-carry P1, verified REAL)*
- **P1 null-deref, judgment** — `eval-engine.ts:183` guards `!item.analysis` then reads `item.analysis.steps.length` → crash. Guard `steps`. (`:184` already returns `true` safely — leave.) *(A must-carry P1, verified REAL)*
- **P1 silent auto-accept (philosophy-critical)** — `worker-engine.ts:267-269` does `new Promise<'accept'>(r => setTimeout(() => r('accept'), 30_000))` AND the no-callback branch (`:282-284`) silently accepts a validation-FAILED result. Change resolution to a blocking `'retry'`/`'timed_out'` that re-prompts, **never silent accept.** *(A's critique addition — directly betrays "think before you recast")*
- **P1 silent data loss** — `storage.ts:41-43` swallows the write failure (incl. `QuotaExceededError`) into `console.error` with **zero UI feedback**. Surface a visible toast. *(B S2 — thesis-betraying for a "don't lose your thinking" product)*
- **CLOSE, do not re-fix:** `decision-quality.ts` already guards with `|| []` (verified) — verify/close only.

**Acceptance:** a zombie-server stream aborts within ~30s with an error callback (not an infinite spinner); brief export and judgment run on an analysis with missing `steps` without throwing; a validation-failed worker result is never silently accepted (it blocks/re-prompts); a quota-exceeded write shows the user a visible message; 1004 tests green.

### L1 — Output persistence as the FIRST visible win (needs only an L1 migration, NOT full Phase 0)
**Goal:** a substrate where retention *can* exist, plus the metric canary, before betting on direction. For a near-empty product, ship a visible win before the risky refactor.
- **Artifact persistence** — outputs are copy/download-only strings today (`agent-spec.ts`, `project-brief.ts`, `OutputSelector.tsx:121`); orphaned the moment they leave the preview pane. Ship ONE Supabase artifacts table + versioning. A explicitly notes this needs only L1 migrations and should move forward; B's PV1 names this THE existential retention gap. **Do NOT inflate this into B's PostExecutionHook/outcome-table — those stay in L5.**
- **Retention reflection TAB** (C Wave 0) — promote the already-shipping read-only judgment layer (`navigator.ts`/`NavigatorStrip`/`getUserPatterns`/`getPersonaAccuracySummary`) into a reflection tab inside the existing Logbook aside. `useMemo`, **no new table.** *(C must-carry; ~60-70% ships)*

**Acceptance:** a generated brief/spec survives a reload and leaving the preview pane; the reflection tab renders past-judgment stats read-only with no new Supabase table; 1004 tests green.

### L1b — userContext → prompt injection (highest leverage/cost, no foundation dep)
**Goal:** make "smarter as you use it" partly true at near-zero cost and establish the reference-only discipline L5 must inherit.
- Wire existing observation context into `buildInitialAnalysisPrompt` (`progressive-prompts.ts:23`) via the documented `참고:` reference-only pattern (NOT directive). *(B S1; corrects D's overstated "loop fully one-way" — `buildNavigatorProfile` already consumes signals; the true narrow wound is no PREDICTION-vs-OUTCOME grading.)*

**Acceptance:** initial-analysis prompt includes a one-line `참고:` reference when observations exist, wrapped per CLAUDE.md `<user-data>`/`sanitizeForPrompt()`; never a directive; behavior unchanged when no observations exist; 1004 tests green.

### L2 — Chassis decomposition behind a feature flag (highest-risk gate; maintainability + C's deep re-skin only)
**Goal:** make the monolith safe to extend. This is a **maintainability gate, not a value gate** — D verified the Decision Contract leaves ProgressiveFlow untouched, so **L4's graft does NOT depend on this.**
- Verified sizes: `ProgressiveFlow.tsx` = 2670 lines; `useProgressiveStore.ts` = 1786 lines, importing `useAgentStore`/persona/reframe/recast/project stores. The scroll + IntersectionObserver + worker + version logic is exactly what the 1004-test net under-covers.
- Keep legacy `ProgressiveFlow` **behind a feature flag**; extract `WorkerRuntime`/`DraftManagement`/`VersionControl`/`UIState` hooks; run existing `orchestrator-journey`/`voyage-branch`/`workflow-review-integration` tests against **both** paths before flipping. *(A must-carry keystone, HIGHEST-RISK; C Foundation B)*

**Acceptance:** both flag paths pass orchestrator-journey/voyage-branch/workflow-review-integration; extracted hooks are independently unit-tested; flag flip is reversible; 1004 tests green on both paths.

### L3a — Phase-0 persistence slice (SMALL — typed builders already exist; runs PARALLEL with L2)
**Goal:** make provenance real (not cosmetic) so C's genealogy thread doesn't silently degrade to leg-name labels.
- Verified: `context-chain.ts:119-525` already returns typed contexts with provenance markers; there is **no `useContextChainStore`, no `_source`, no `traceProvenance`, no persistence.** So the genuine work is **persistence + `_source` + `traceProvenance` + a `context_chains` SQL migration — NOT a from-scratch typed pipeline.** *(A must-carry, scoped much smaller than PLAN claims; C Foundation A)*
- **Stable-ID-only slice** — add a deterministic `id` to `HiddenAssumption`/`KeyAssumption` *at generation time* (no `status`/`created_at`, no historical-blob migration). This unblocks C's "links must be real" requirement and lets the fragile substring linker be deleted: verified `agent-spec.ts:104` (`substring(0, 8)`) and `prompt-chain.ts:151-152` (`substring(0, 10)`). **grep must confirm both substring linkers are gone.**

**Acceptance:** context chain persists to `context_chains` with `_source`/`traceProvenance`; assumptions carry stable IDs at generation; `substring(0,8)`/`substring(0,10)` linkers deleted (grep-verified); legacy id-less data renders **no false provenance link**; 1004 tests green.

### L3b — Full per-predicate status migration (3-4 wks, GATED behind kill-test)
**Goal:** the addressable schema D's falsifiable-predicate loop needs. **Do NOT start until Test 1 OR Test 2 passes (§4).**
- Add `id`/`created_at`/`status: held|contradicted|pending` to the assumption type across reframe/recast/rehearse + the eval engines that emit them; handle JSONB atomicity (the `20260409` atomic-RPC history proves this seam already burned the team). **Prerequisite:** the session blob must be bounded/server-persisted first (see L0/L5 quota fix) so this status history isn't written into an already-truncating structure.

**Acceptance:** gated — not scheduled. If the kill-test fails, this layer is never built; ~1-2 days spent on the sidecar instead, tests green, ship Mirror without apology.

### L4 — Forward surfaces: C's incremental spine + the Decision Contract graft
**Goal:** ship the genealogy throughline as the differentiator vs "just ask ChatGPT."
- **Decision Contract (the §0 KICK, do at L1 timing — no L2/L3 dep)** — serialize 3-6 falsifiable predicates from recast AI-vs-human assignments + blindspot `classified_risks` + `governing_idea` into a reversible JSON sidecar, surfaced as a FinalCard "Verdict" view off the store-free `runInitialAnalysis` round-trip. *(D must-carry #1; B P0#2)*
- **Return-to-grade loop (the §0 retention engine — light, web-native, no migration)** — (1) upgrade `useAccuracyStore.addRating` + `OUTCOME_RECORDS` from persona-rating to **predicate-grading** ("did the predicted risk fire? [happened/avoided/partial]"), reusing the existing `context-builder.ts:61-63` feedback path; (2) a return prompt keyed to the *specific* predicate (not a vague "how'd it go?"); (3) optional **paste-back** grading via the eval engine. This light loop is the **§4 Test-1 instrument** — it measures whether specific-predicate framing actually earns the return BEFORE any heavy L3b spend. Graded outcomes accumulate as the data that unblocks L5/A-Track-L. *(D must-carry; C's outcome-calibration must_carry; gated escalation, not the migration itself.)*
- **Onboarding (C Wave 0, no dep)** — auto-launch the existing `InteractiveDemo.tsx` + `demo-data.ts` as first-run, gated by `projects.length===0` + `localStorage 'argus.has_onboarded'`, in the `if(!currentProjectId)` branch at `workspace/page.tsx:690` (NOT inside HeroFlow's timed state machine) + one net-new "input → reframed problem" contrast card. *(C must-carry; ~80% ships)*
- **Core-flow re-skin (C Wave 2, gated on L2)** — Focused-Linear additive presentational components (`LegCanvas`/`AnchoringMoment`/`ConvergenceRose`) reusing `phaseIdx()`; inline provenance tags; ~15-line gold ancestry overlay inside the existing `BranchMap` (reuse `edgePath()`+`getActivePath`); ✓/미검증 assumption-verification toggle. **Re-skin, not rewrite.** *(C must-carry)*
- **Attributable outputs (C Wave 1, gated on L3a)** — four-act ship's-log Brief on the existing `lib/export.ts` `voyageLogToMarkdown` spine, with a "왜?" provenance anchor per line, now using the stable `HiddenAssumption.id`. Agent Spec is the ONE sanctioned bridge to execution (CrewAI YAML + LangGraph JSON, dev tab). *(C must-carry; rides L3a)*
- **`.argus/` render spine (graft, do at L1/L3a timing)** — C's gold-thread/marginalia becomes a VIEW over the existing `.argus/*.md` + `argus-plugin/CONTEXT-CONTRACT.md` ledger (both verified on disk), not a re-derivation from stores. Wire after the stable-id slice so links resolve. *(D Harbormaster graft × C surface[2] — highest cross-source synergy)*

**Acceptance:** Verdict sidecar generates without touching ProgressiveFlow and deletes cleanly; onboarding auto-demo fires only for first-run users and hands off to a pre-filled real textarea; the gold provenance thread resolves to real `.argus`/typed-chain links (no false links on legacy data); 1004 tests green at every sub-step.

### L5 — Deferred / kill-test-gated (do NOT build pre-traction)
**Goal:** the compounding-judgment moat — ONLY if the retention premise survives falsification.
- **Silent prediction-and-self-scoring loop** — build only after the Decision Contract earns Test-1/Test-2 evidence; reuses `judgment-vitality.ts`/`observation-engine.ts`; **pair with the anchoring/atrophy guard** so the success number and the mission-betrayal number aren't identical. *(D must-carry, gated)*
- **PARKED:** B's PostExecutionHook/outcome-table; A's prompt-mutation engine (Track L Phase 4) — until N real sessions with outcome data exist.
- **P1 data-correctness (not a blocker):** `db.ts:57-78` `mergeByTimestamp` does string `remoteTime > localTime` with no clock-skew handling; soft-delete IS implemented (`db.ts` `deleted_at`) but the merge comparison is `deleted_at`-unaware. Schedule clock-skew tolerance + `deleted_at` awareness as a P1 fix. (Resolves A's R6 verify-gate: the scenario is real but lower-priority, not moot.)
- **Session-blob durability:** cap/eviction policy + server-side persistence for the uncapped `progressive_sessions` JSONB blob (only discrete caps exist: signals 500, evals 200). **Must precede L3b** or the falsifiable-predicate history is written into a silently-truncating structure. *(B S2)*

**Acceptance:** gated — the prediction loop only exists post-kill-test; the anchoring guard ships with it; merge/blob fixes land as standalone P1s; ~1-2 days sunk cost if the bet dies.

---

## 4. Cheap Validation Probes — Run BEFORE Betting Big

Run these in parallel with L0/L1 (they need little or no code). They are the only instruments that can answer the existential questions no `file:line` analysis can (B: retention is empirically unknowable from code).

1. **15-min telemetry reconciliation (HARD PRE-REQ for all other probes).** Verified: `daily-report/route.ts:329` buckets `['landing_hero_submit', 'landing_cta_click']` under one "랜딩 CTA" label; `landing_hero_submit` is emitted in **zero** app code, but `landing_cta_click` **is** live (`Act3OnDeck.tsx:88`). **Corrected framing:** the bucket is not fully dead — it's "trusted-but-partly-dead." Either emit `landing_hero_submit` at the real hero-submit site or drop the dead key, and add a canary on the fire-and-forget swallowed-error anon insert (`analytics.ts`). **Until events are trustworthy, no go/no-go decision (L3b green-light, PV1 verdict) may cite dashboard numbers.**
2. **30-day re-voyage cohort SQL (1 hour).** Query existing Supabase voyages for the actual return rate — the measured answer to B's PV1 (does anyone come back?), today only asserted.
3. **5-user moderated first-run test (half-day).** The only instrument for B's PV2 (does run-1 answer "why not just ChatGPT?") and metaphor comprehension. Watch the first 90 seconds for rage-quit.
4. **Test 1 — Wizard-of-Oz on ~15 existing voyages (the L3b kill-test).** Named-specific-predicate framing ("you predicted the CFO-cost risk fires at the pricing step — did it?") vs Mirror reflection framing; measure weeks-later click/reply AND grade-vs-bounce.
5. **Test 2 — silent prediction-accuracy slope (the L3b alternate kill-test).** Instrument the silent loop (L5) on existing voyages; positive accuracy slope vs voyage count → green-light L3b. Both fail → ship Mirror, don't migrate.

---

## 5. Design-System Spine

One additive editorial "Logbook" token layer + one reference primitive — the shared atom every surface renders into (C surface[3], won all three judge lenses as the only additive option). Verified all tokens already in `globals.css`.
- **Tokens (appended, nothing deleted):** 8pt spacing scale; `--brass-shine` 1px highlight; scoped `.logbook-reveal` slow-motion class; existing `--accent #96782e`, `--font-display Noto Serif KR`, `--radius-md 12px`.
- **Primitive:** `LogbookCard` mirroring the existing `Card.tsx` `forwardRef` + variant-map API. Onboarding contrast card, `LegCanvas`, `ProvenanceNote`, and retention sections all *are* `LogbookCard`s.
- **MOTION FIX (C's one verified self-correction — a stale-claim refusal in C's own house):** JS/Framer must **IMPORT `EASE` from `progressive/shared/constants.ts`** (real shipped value `[0.32, 0.72, 0, 1]` = `--ease-wave`), NOT hardcode `cubic-bezier(0.16, 1, 0.3, 1)`. All four C sub-specs initially hardcoded the wrong curve. Note the unreconciled divergence: the philosophy doc / CSS `--ease-spring` use the `0.16,1,0.3,1` curve — **leave `--ease-spring` as-is; do not "fix" it to match.** The rule is: animation timing imports the shipped `EASE` constant; the spring token is a separate, intentional value.

---

## 6. What We Deliberately Are NOT Doing

- **No execution layer as the spine** — no run-in-Claude console, no `useExecutionStore`, no execution tables, no hooks-array authoring. Execution-observation is a deferred Pro/dev lane only (distribution scissors). *(C §5; D distribution scissors)*
- **No multiplayer/leaderboard/peer spine, no new analytics tables in retention.** The blind-read button is a future one-screen activation of the *existing dead* `useTeamStore` substrate, not Wave 0. *(C §5; D cold-start)*
- **No decay-by-timer push notifications** ("47 days old" without a logged outcome is spam). *(D Argus Live)*
- **No prompt-mutation / self-improving engine pre-traction** (A Track L Phase 4 — "amplify bad signals" trap). *(A; B)*
- **No per-predicate schema migration (L3b) until a kill-test passes** — the least-reversible seam, gated not scheduled.
- **No deletion of ProgressiveFlow** — decomposition is behind a flag for maintainability + C's deep re-skin; D verified the value never requires deleting it.
- **No carousel rewrite, no cold node-graph on strategist surfaces, no desaturation/deletion of semantic tokens, no `useMirrorStore`/persisted patterns.** *(C §5)*
- **No re-scoping work from fabricated counts** — `validateShape` is already wired (`llm.ts:778-781`); do not rebuild F2.

---

## 7. Do-Not-Inherit List (stale / fabricated / wrong-mechanism — refused)

| Claim (from prior workflows) | Verified reality | Action |
|---|---|---|
| "81 parseJSON callsites" | Actual 8 direct + 9 `callLLMStreamThenParse` | Do not size F2 from this |
| "55+ raw JSON.parse callsites" | Actual ~23 outside tests; real surface ~12 (inflated ~2.5×) | Re-scope F3/R3 from verified surface |
| "`llm-validation.ts` is ~empty" | Complete 72-line API request-validation module | Do not rebuild |
| "context flows as markdown strings / builders return throwaway objects with no provenance" | `context-chain.ts:119-525` returns typed contexts WITH provenance markers; only persistence/`_source`/`traceProvenance` missing | Scope L3a small |
| **P0 fix = `Promise.race([stream, timeout])`** | `callLLMStream` is `Promise<void>` + callbacks (`llm.ts:627-757`) — race cannot detect a hang | Use per-read inactivity watchdog (§L0) |
| U9 "lazy-load Three.js `VoyageChart`" | `VoyageChart` is SVG, not three.js — saves nothing; real ~200KB cost is landing illustrations (`SailingShip`/`ShipCutaway`/`SeaRipples` via `@react-three/fiber`) | Re-target if pursued |
| `decision-quality.ts:146` is a live crash | Already guarded with `\|\| []` (verified) | Verify/close only — do NOT re-fix |
| B headline "7/9 metrics unmeasurable" | A dashboard exists and reads partly-dead inputs | Carry "trusted-but-partly-dead" framing (the `landing_hero_submit` key is dead but `landing_cta_click` in the same bucket is live) |
| Competitor numbers: CrewAI "450M+ workflows/month", "60% Fortune 500", BMAD capabilities | Unverified marketing/roadmap claims | Do NOT inherit as load-bearing |
| "navigator.ts never acts / learning loop fully one-way" | OVERSTATED — `buildNavigatorProfile` consumes signals; `retrospective.ts`/`context-builder.ts` feed past learnings into prompts; `hit-rate.ts` closes agent-selection calibration | True narrow wound: never grades a PREDICTION vs an OBSERVED outcome |
| Per-assumption work is "2 weeks"; `useAccuracyStore` is the write-back channel | 3-4 weeks (JSONB atomicity + type across reframe/recast/rehearse + eval engines); `useAccuracyStore` rates PERSONAS, not predictions | Prediction-scoring is NET-NEW, not a repoint |
| Motion specs hardcode `cubic-bezier(0.16,1,0.3,1)` | Real shipped `EASE` = `[0.32,0.72,0,1]` (`progressive/shared/constants.ts`) | Import `EASE`; leave `--ease-spring` as-is (§5) |
| R6 soft-delete resurrection scenario is moot | Soft-delete IS implemented (`db.ts` `deleted_at`); but `mergeByTimestamp` is `deleted_at`-unaware + no clock-skew handling | Real but lower-priority P1 (§L5), not moot |

**Standing rule:** every effort estimate derived from a fabricated count is re-scoped from verified surface; every "already one-way / never acts" narrative is replaced by the narrow verified wound (no prediction-vs-outcome grading); the retention bet shared by C-Mirror and D-Verdict is labeled **UNVALIDATED-PREMISE**, falsified by §4 Tests 1/2 **before** the 3-4-week migration, never assumed.
