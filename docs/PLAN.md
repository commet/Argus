# ARGUS Improvement Plan — "천천히 꼼꼼히"

> Working spec to take Argus from "barely working / messy" to a genuinely usable, polished product.
> Principle: every step small, test-gated, no building on sand. Bias toward the smallest safe step first.
> Status of ground truth: 1004 tests pass, tsc clean, next build OK, eslint 0 errors / 144 warnings.
> Verified live during audit: ProgressiveFlow.tsx = 2670 lines, useProgressiveStore.ts = 1786 lines, llm.ts = 789 lines,
> `lib/context-chain.ts` exists (transient builders) but **no `useContextChainStore.ts`** (Phase 0 unpersisted),
> llm.ts has backoff `setTimeout` (lines 195, 210) but **no AbortController request timeout** (P0 spinner risk confirmed).

---

## 1. Honest State of the Product

### What is actually solid
- **LLM chokepoint (`src/lib/llm.ts`, 789 lines)** is genuinely well-built: categorized `LLMError` with retryable flags, per-provider circuit breaker, exponential backoff, multi-strategy `parseJSON` (code fences → outermost object → array). This is the strongest part of the codebase.
- **Error *visibility*** is fine. Errors render in `ProgressiveFlow.tsx` (~2452, ~2634) with retry/dismiss. The problem is *recovery quality*, not whether errors are shown.
- **Phase 1 (adaptive decompose) & Phase 2 (multi-lens recast)** are fully implemented and strong, with working eval engines and strategy selection (`getBestStrategy` exists and is wired).
- **Visual design tokens** are sophisticated: warm ivory/navy/gold palette, 3-category risk colors, `--ease-spring: cubic-bezier(0.16,1,0.3,1)`, blueprint/graticule utilities. The *vocabulary* of the "dawn harbor" aesthetic exists.
- **Demo system** (`InteractiveDemo.tsx`, 12-phase choreography) and landing voyage metaphor are excellent.
- **Test net** (1004 passing) is a real safety asset for refactoring.

### What is actually broken or weak (no sugarcoating)
- **P0 — infinite spinner.** `callLLMStream` has no request-level timeout. A zombie server (connected, no final chunk) hangs the UI forever; only recovery is page reload. Confirmed: only `setTimeout` uses in llm.ts are backoff delays.
- **P1 crashes — 3 confirmed null derefs** that break core flows: `eval-engine.ts:183` (`item.analysis.steps.length` — guards `!item.analysis` but not `.steps`), `project-brief.ts:130` (`latest.analysis.steps`, no optional chaining — crashes brief export), and the convergence calc uses a hardcoded `0.5` placeholder (`progressive-convergence.ts:98`) that can mask real oscillation. (`decision-quality.ts:146` is actually guarded with `|| []`; downgrade that one to "verify".)
- **Architecture debt is the central blocker.** `ProgressiveFlow.tsx` (2670 lines) and `useProgressiveStore.ts` (1786 lines) conflate state orchestration, worker coordination, draft/version management, scroll/navigation, and presentation. This makes *every* feature and polish task risky and is the prerequisite for almost all other tracks.
- **Phase 0 is unfinished.** Context flows as markdown strings + transient handoff objects; `context-chain.ts` builders return throwaway objects with no persistence and no `_source` provenance. `useHandoffStore.ts` (767 B) is nearly empty. This blocks Phases 3/4/5 (learning, output provenance) from having clean data to operate on.
- **Output artifacts are orphaned.** All 5 artifact generators read `localStorage` only, emit static markdown, and have zero persistence/versioning/feedback. The "traceable decision ancestry" promise dies the moment an artifact leaves the preview pane.
- **Learning loop is one-way.** Signals/evals are *collected* but never *acted on*: no PersonaBehaviorModel, no outcome recording UI, no prompt mutation. Self-improvement is aspirational.
- **Onboarding is reactive-only.** No `is_new_user`/`journey_stage` flag, no phase-transition bridge messages, no context-carryover UI, quota errors surface *after* submission. The strong voyage metaphor barely reaches the workspace.
- **Design implementation drifts from intent.** Tech-blue `#3b6dcc` in `WorkflowGraph` (explicitly forbidden), cool-pink dark-mode risk colors, `EASE` constant likely not the spring curve, serif display font unused in workspace, cramped spacing vs. "generous whitespace."
- **Reliability gaps beyond the P0:** silent localStorage hydration on schema mismatch, fire-and-forget Supabase writes with no sync status, merge logic that can resurrect soft-deleted items, no partial-result recovery on mid-stream failure.

### One-sentence verdict
The *engine room* (llm.ts) and the *content intelligence* (Phases 1–2) are strong; the *chassis* (ProgressiveFlow / store architecture, Phase 0 pipeline) is sand, and almost every visible weakness traces back to that sand plus the missing request-timeout and 3 null-deref crashes.

---

## 2. Tracks

Seven tracks. Each workstream lists goal, files, and acceptance criteria (AC). Effort: S/M/L/XL.

### Track F — Foundation / Architecture
**Goal:** A typed, persisted context pipeline and a decomposed state machine so all later work builds on rock, not sand.

| WS | Title | Files | AC |
|---|---|---|---|
| F1 | **Fix the 3 null-deref P1 crashes** | `lib/eval-engine.ts:183-184`, `lib/project-brief.ts:130`, `lib/progressive-convergence.ts:98` | Optional chaining + fallback on every `.analysis.steps` access; convergence uses real first-transition similarity not `0.5`. New unit tests feed `{analysis:{}}` / `{analysis:null}` and assert no throw. tsc clean, 1004+ green. |
| F2 | **`validateShape` after every `parseJSON`** | `lib/llm-validation.ts` (currently ~empty), all 81 `parseJSON<T>()` callsites (start: `progressive-engine.ts`, `worker-engine.ts`) | Schema objects defined for `AnalysisSnapshot`, `WorkerResult`, `DraftFeedback`, recast output. Malformed-LLM-output test (missing `real_question`) degrades gracefully, no crash. |
| F3 | **Replace raw `JSON.parse` with `parseJSON`** (or guarded try/catch) | 55+ callsites; keep DB-guaranteed-JSON reads but wrap in `categorizeError` | Lint rule bans bare `JSON.parse` outside `parseJSON` impl + tests. No behavior change in green suite. |
| F4 | **Decompose `ProgressiveFlow.tsx`** into orchestrator + extracted hooks: `useWorkerRuntime`, `useDraftManagement`, `useVersionControl`, `useProgressiveSession` (reducer) | `components/workspace/progressive/ProgressiveFlow.tsx` → hooks under `progressive/hooks/`; remove back-compat re-exports (`:54`) | Behavior-preserving: 1004 tests stay green at each extraction. Final `ProgressiveFlow.tsx` ≤ ~1200 lines (target ~400 as orchestrator); each extracted hook ≤ 500 lines. No new feature in this WS. |
| F5 | **Split `useProgressiveStore.ts`** into `useProgressiveSessionStore`, `useDraftStore`, `useWorkerRuntimeStore`; keep `useProgressiveStore` as composition layer | `stores/useProgressiveStore.ts` + 3 new stores | Each sub-store single-domain; high-level actions (`runSession`, `advancePhase`) delegate. Tests green. Depends on F4 (consumers must exist first). |
| F6 | **Phase 0: persisted typed `ContextChain` with `_source` provenance** | `stores/types.ts` (add `ContextChain`), new `stores/useContextChainStore.ts`, `lib/context-chain.ts` (return ContextChain + inject `_source`), Supabase `context_chains` table, `traceProvenance(field)` | Hidden assumption → recast key_assumption is traceable via `traceProvenance`. Persists across refresh. 5–10 unit tests for propagation (`context-chain.test.ts` template exists). |
| F7 | **Consolidate FEEDBACK_SYSTEM prompt** to a single `lib/prompts/feedback-system.ts` (**verify first** — grep found no `FEEDBACK_SYSTEM` symbol; it may already be renamed/consolidated) | persona-feedback + refinement loop callsites | Single exported builder; consistency test asserts identical prompt for identical inputs. Lint/pre-commit guard against duplicate prompt strings. |
| F8 | **Defensive-access lint + audit** | new lint rule; audit top 20 store consumers | TS strict on; lint warns on non-optional access of store/localStorage/Supabase data. |

### Track R — Reliability / Resilience
**Goal:** No hang, no silent data loss, graceful degradation on every LLM/network failure.

| WS | Title | Files | AC |
|---|---|---|---|
| R1 | **P0: request timeout + abort on `callLLMStream`** | `lib/llm.ts:627-757`; consumer `ProgressiveFlow.tsx:~1334` | `Promise.race([stream, timeout(60s)])` (120s for max-tokens=4000), merged AbortSignal. On timeout: error state "Request took too long", signal aborted, retry available. Test under throttling proves no infinite spinner. |
| R2 | **localStorage hydration validation + migration** | `lib/storage.ts:27-35`, `stores/useProgressiveStore.ts` | `getStorage` validates shape against versioned schema; migration adds missing fields (e.g., `checkpoints: []`). Loading v0 data with missing field does not crash; migration logged in dev. |
| R3 | **Partial-result recovery on mid-stream break** | `lib/llm.ts:765-789` (`callLLMStreamThenParse`), `lib/partial-analysis.ts` (already exists) | Checkpoint last-valid-JSON per token batch; on stream break return last checkpoint with `_partial: true`. UI renders partial card with "unfinished" badge + Retry/Use-anyway. |
| R4 | **Sync-status for worker/Supabase writes** | `lib/db.ts:188-199`, worker `onComplete`, `ProgressiveFlow` worker callbacks | Add `sync_status: pending|synced|sync_failed`. Optimistic UI then awaited persist with `withRetry`. Failed sync shows toast, not silent. |
| R5 | **Replace fire-and-forget `.catch(()=>{})`** | `lib/observation-engine.ts:47`, `lib/hit-rate.ts:69`, `ProgressiveFlow.tsx:1450,1561,1619` | At minimum `.catch(err => log.warn)`. Transaction log records attempted writes for startup retry. |
| R6 | **Merge logic: respect soft-deletes** | `lib/db.ts:57-78` (`mergeByTimestamp`) | If either side has `deleted_at`, result is deleted (or compare by newest `deleted_at`). Test: offline delete on A, B sync, item stays deleted. |
| R7 | **Worker validation timeout rollback** | `lib/worker-engine.ts:267-285` | On 30s `Promise.race` timeout, explicitly close modal state; return `{action,timestamp}` so late resolutions are discarded. Add `timed_out` action. |
| R8 | **Retry budget + jitter; provider fallback** | `lib/worker-engine.ts:199-200`, `lib/llm.ts:377-403` | `RetryPolicy{maxRetries,baseDelayMs,maxDelayMs,jitterFraction}`. On 429/503 fall back to configured OpenAI/Gemini, set `retryable=false` after fallback. |
| R9 | **Rate-limit event from all paths + quota query** | `lib/llm.ts:722` (stream-only dispatch), `components/ui/RateLimitBadge.tsx`, new `/api/quota` | Non-stream `callLLM` also dispatches `argus:ratelimit`; badge has listener error handler; mount/periodic quota query; sessionStorage cache across tabs. |
| R10 | **AbortSignal threads into Supabase fns** | `lib/db.ts` (`loadAndMerge`, `syncToSupabase`, `upsertToSupabase`) | Functions accept signal, check `aborted` in loops, return early. Unmount no longer orphans in-flight writes. |

### Track U — UI/UX Usability
**Goal:** Clear navigation, honest feedback, accessible, mobile-native.

| WS | Title | Files | AC |
|---|---|---|---|
| U1 | **Structured `ErrorResult` + recovery actions** | new `lib/error-result.ts`, `ProgressiveFlow.tsx:2452`, `HeroFlow.tsx:247` | `{code:'RATE_LIMIT'|'AUTH_REQUIRED'|'VALIDATION_ERROR'|'WORKER_FAILURE', message, recoveryAction{label,href,onClick}}`. Replaces `error.includes('한도')` substring matching. Each error renders a clear action button. |
| U2 | **Focus management + keyboard nav** | modals in `ProgressiveFlow` (use Radix Dialog for focus trap + Esc), `QuestionCard.tsx` (arrow keys between options), global `focus:ring-2 ring-[var(--accent)]` | Keyboard-only user can complete a voyage. Modals trap focus + Esc closes. Visible focus indicator on all interactive elements. |
| U3 | **Phase header card + sticky progress** | `ProgressiveFlow` (render `PHASES_KO/EN` already in code at ~129), `ProgressLine` sticky | Each phase shows 2-line guidance ("Answer 1–2 questions…"); dismissible (localStorage `hide_phase_header` after 3 reads); sticky progress bar maps internal phases → 4 voyage stages. |
| U4 | **Consistent loading skeletons** | new `LoadingSkeleton` per content type, `AnalysisCard`, worker cards | Every phase shows a skeleton, not a 2–3s blank. Streaming text fills a pre-rendered skeleton. |
| U5 | **Scroll management via IntersectionObserver** | `ProgressiveFlow.tsx:2038-2042` | Auto-scroll only when target out of viewport; no yank while user scrolls; new content not below fold. |
| U6 | **`<pre>` overflow + char counters** | `ProgressiveFlow.tsx:2554`, draft/revision modals, `QuestionCard` | `overflow-x-auto` + `break-words`; "Expand fullscreen" on mobile; live char counter + soft limit on inputs > 100 chars. |
| U7 | **Surface buried power features** | version history link in sticky nav (≥2 drafts), persona preview card, reviewer-change affordance, Q&A context drawer | Version history reachable from any phase; persona preview shows who reviews + focus; "Change reviewer" present mid-flow; Q&A breadcrumb with edit→re-run dependent phases (uses F6 ContextChain dependency graph). |
| U8 | **Mobile-first responsive layout** | `app/workspace/page.tsx:114` (calc padding), drawers, rail | Container queries for content width; rail hidden `<lg`, 320px `lg`, 360px `xl`; drawers viewport-relative; SafeArea hook. Tablet (768px) has no dead space / occlusion. |
| U9 | **Lazy-load Three.js VoyageChart + 2D fallback** | `VoyageChart.tsx` | three.js loaded only on chart open; SVG fallback on mobile; `prefers-reduced-motion` disables canvas anim. ~200KB off initial bundle. |
| U10 | **Flow disambiguation (progressive vs legacy)** | `app/workspace/page.tsx`, mode badge | Discrete "New Voyage"/"Classic" badge + tooltip; project-level `system` setting; cross-system handoff validated (depends on F6). |

### Track D — Visual / Interaction Design
**Goal:** Make the "dawn harbor editorial" mood *lived*, not just documented.

| WS | Title | Files | AC |
|---|---|---|---|
| D1 | **Fix color token drift** | `globals.css:105-118` (dark risk/accent), `WorkflowGraph.tsx:19-21` (tech-blue `#3b6dcc`) | No `#3b6dcc` / forbidden tech-blue in actor colors; dark-mode risk colors stay warm; all semantic colors derive from gold/accent/primary, not cool primaries. Visual diff approved. |
| D2 | **Verify & fix motion `EASE` constant** | `progressive/shared/constants.ts`, all `transition={{ease:EASE}}` callsites | `EASE` === spring `cubic-bezier(0.16,1,0.3,1)`; replace `active:scale[0.97]`/`hover:-translate-y[1px]` mechanical micro-interactions; durations 250–300ms for page-scale moves. |
| D3 | **Serif typography in workspace** | `globals.css:57` `--font-display`, workspace headers (replace inline `style={{fontFamily}}`) | Semantic classes `.text-display-md/.text-heading` applied to all headers ≥16px; micro-copy stays sans. No ad-hoc inline font-family in workspace. |
| D4 | **Spacing scale to 8px ladder + generous sections** | `ProgressiveFlow` feedback/stat blocks, `WorkflowGraph`, `AnalysisCard`, cards | Card padding ≥ comfortable (12–16px); 20px within phase / 32px between phases; stat labels ≥13px. Enforce via Tailwind theme; lint discourages arbitrary `gap-[..]px`. |
| D5 | **Premium card variants + graticule on status** | `Card.tsx:19-20` (`premium`/`musical` unused), phase progress, `ReviewerBadge.tsx:74` (purple → gold) | `premium` applied to FinalCard/MixPreview hero; graticule texture (low opacity) behind phase progress; reviewer badge uses `--gradient-gold-subtle`. |
| D6 | **Editorial empty/completion "moments"** | completion state `ProgressiveFlow.tsx:2383`, loading messages, `HitReactionBar` (`WorkerCard.tsx:47-63`) | Completion = serif headline + warm bg + subtle decorative element ("arrival"). HitReactionBar padding `px-3 py-1.5` (≥36px touch), warm accent colors not emerald utility. |
| D7 | **Voyage micro-copy pass** | status messages/labels in `ProgressiveFlow` + i18n | Major CTAs/transitions use voyage metaphor (narrative loading "항로를 그리고 있습니다"); neutral labels stay neutral; ko/en metaphor parity. |

### Track P — Output Artifacts (Ithaca)
**Goal:** Turn orphaned static markdown into persisted, versioned, executable specs.

| WS | Title | Files | AC |
|---|---|---|---|
| P1 | **Persist artifacts to Supabase + versioning** | Supabase `artifact_history` table, `lib/db.ts` insert wrapper, `OutputSelector.tsx` | Each generated artifact saved with `{project_id,type,version,content,generated_at,source_*_id,checksum}`. Survives localStorage clear / device switch. Version list visible. |
| P2 | **Agent Spec 2.0 schema fields** | `stores/types.ts` `RecastStep` (+`validates_assumption?`, `abort_condition?`, `success_signal?`, `feeds_into?`), `lib/agent-spec.ts`, recast UI, Supabase migration | Generator emits the fields; recast UI links assumptions→steps. Depends on F6 (assumption IDs come from ContextChain). |
| P3 | **`validateAgentSpec` / artifact lint** | new `lib/agent-spec-validation.ts`, generator preview path | Parses YAML, verifies all `validates_assumption` refs exist, indices valid, no duplicate checkpoint IDs. Warns user before preview. Unit tests with valid/invalid fixtures. |
| P4 | **Interactive Execution Checklist (live)** | Supabase `execution_checklist` table + RLS, new `ExecutionChecklist.tsx` (replaces static md) | Checkboxes sync to Supabase realtime; per-project RLS; completing a step linked to assumption flips its validated state. Depends on P1 + P2. |
| P5 | **Prompt Chain provenance + executive brief** | `lib/prompt-chain.ts`, `lib/project-brief.ts` (`generateProjectBriefExecutive`) | Prompt constraints annotated with source (persona/recast id) as footnotes. `Brief (Executive)` ≤500 words alongside full brief in `OutputSelector`. |
| P6 | **Artifact diff view** | `/project/[id]/artifacts/[type]/diff`, diff component | Side-by-side markdown diff between versions; changed key_assumptions highlighted. Depends on P1. |

### Track L — Learning / Moat (Phases 3/4/6)
**Goal:** Close the loop — collected signals become applied improvements + cross-project persona calibration.

| WS | Title | Files | AC |
|---|---|---|---|
| L1 | **Supabase migrations for learning tables** | `context_chains`, `persona_behaviors`, `prompt_mutations`, `prompt_tests` + RLS; `db.ts` TableName | Tables exist with RLS (own data only); types match columns (store-schema-sync test). Depends on F6 types finalized. |
| L2 | **PersonaBehaviorModel (structured, per-aspect)** | `stores/types.ts`, `useAccuracyStore.ts`, `lib/eval-engine.ts` `recordRehearsalEval`, persona prompt injection | `accuracy_by_aspect`, `typical_concerns`, `blind_spots`, `cross_project_replication_count`; injected as structured JSON not markdown. Depends on F6. |
| L3 | **OutcomeRecord UI + outcome→eval feedback** | new `OutcomeForm`, `recordOutcomeEval`, `buildPersonaAccuracyContext` | Post-project 5–10 min form (hypothesis result, risks materialized, conditions met). Submission calibrates persona weighting. Closes design→execute→measure loop. Depends on L2. |
| L4 | **Prompt mutation engine (manual-trigger first)** | new `lib/mutation-engine.ts`, `prompt_mutations` table, admin review page | `generateMutationProposal(evalHistory,prompt)` → top-3 candidates from BinaryEval gaps; admin approves; later A/B 10% cohort auto-promote on pass-rate gain. Depends on L1+L2. |
| L5 | **System prompt versioning** | new `lib/prompt-versions.ts`, admin page | Prompts as `PromptVersion` records with changelog + revert; session/signal records which version was active. Depends on L4. |
| L6 | **Auto-persona fallback + quality gate** | `lib/auto-persona.ts` | On LLM fail: retry (3, backoff) → `recommendBlindSpotPersona` fallback → mark low-confidence + log `auto_persona_failure` signal. No silent empty persona list. |
| L7 | **Handoff persistence (audit/replay)** | `stores/types.ts` (`HandoffEvent`), `useHandoffStore`, `handoff_events` table | Handoffs persisted with id/session/timestamp; resume mid-session; dev "Handoff Inspector". Depends on F6. |

### Track O — Onboarding / First-Run
**Goal:** Make the voyage *guided*, not blank; teach the mental model.

| WS | Title | Files | AC |
|---|---|---|---|
| O1 | **`is_new_user` + `journey_stage` flag** | `useSettingsStore`, localStorage + Supabase | Brand-new user ≠ returning user. `journey_stage: welcome|first_demo|first_real|active` drives downstream personalization. |
| O2 | **Quota awareness before submission** | `app/workspace/page.tsx:38,250-258`, HeroFlow | "Analyses left today: X/5" chip above input; near-limit inline nudge; quota-hit replaces input with sign-in/upgrade narrative — not a post-submit error. |
| O3 | **Demo as first-visit funnel** | `app/workspace/page.tsx:263-292`, `InteractiveDemo.tsx` | First visit (localStorage `has_seen_onboarding`) shows "See an example / Start with my problem". Post-demo "Demo Complete" card → pre-fill + "Try with my problem". Demo conversion tracked. |
| O4 | **Phase-transition bridge messages** | `ProgressiveFlow`, `useProgressiveStore.setPhase`, i18n | After each major phase: short narrative ("항로가 잡혔습니다. 이제 각자의 자리를 배정합니다") + carryover summary. Voyage vocabulary, not "reframe/recast". |
| O5 | **Context-carryover UI (provenance ribbon)** | `ProgressiveFlow`, `Logbook.tsx` | Visible flow "3 assumptions found → now verifying"; carryover badge highlights items from phase N active in N+1. Depends on F6 + O4. |
| O6 | **"What now?" Ithaca completion view** | post-`done` view, FinalCard | 4 output cards each with 1-line purpose + action (copy prompt / download YAML / share brief); optional reflection prompts. Depends on O4. |
| O7 | **Phase coachmarks + onboarding i18n** | `NavigatorInline`, HeroFlow placeholder, i18n keys | Per-phase hints in progressive flow; HeroFlow example placeholder; Philosophy terms extracted to i18n with ko/en parity. |

---

## 3. Dependency-aware Sequencing

Each phase is a small, shippable, test-green increment. Stop-the-bleeding first, then foundation, then build.

### Phase A — Stop the bleeding (P0/P1 crashes, no architecture risk)
- **F1** (3 null-deref fixes) · **R1** (stream timeout) · **R2** (hydration validation/migration)
- Quick wins: eslint `--fix` unused imports, `decision-quality.ts` verify, FEEDBACK_SYSTEM verify.
- *Why first:* these are the literal "breaks real use" items; all are S/M, none touch architecture. Ship independently.
- **Gate:** 1004+ green, tsc clean, manual throttled-network test shows no infinite spinner.

### Phase B — Validation & safety rails (still no big refactor)
- **F2** (validateShape after parseJSON) · **F3** (ban raw JSON.parse) · **F7/F8** (prompt consolidation + defensive-access lint) · **R3** (partial-result recovery) · **U1** (structured ErrorResult)
- *Why:* hardens the data boundary *before* we move code around in Phase C, so refactors can't silently corrupt shapes.
- **Gate:** malformed-LLM-output tests pass; green suite.

### Phase C — Decompose the monolith (behavior-preserving)
- **F4** (extract hooks from ProgressiveFlow) → then **F5** (split store).
- *Why before features:* every U/D/P/L/O task touches this file; doing them on a 2670-line monolith is building on sand. The 1004 tests are the regression net; extract in tiny PRs.
- **Gate:** zero behavior change, each extraction independently green; ProgressiveFlow ≤ ~1200 lines.

### Phase D — Phase 0 typed pipeline (the keystone)
- **F6** (persisted ContextChain + provenance) · **L1** (learning-table migrations) · **L7** (handoff persistence)
- *Why here:* needs the decomposed store (C) as clean consumers; unblocks P2/P4/P6 (output provenance) and L2–L5 (learning), and U7/O5 (carryover UI).
- **Gate:** `traceProvenance` test green; assumption→key_assumption traceable; survives refresh.

### Phase E — Reliability completion
- **R4** sync status · **R5** no fire-and-forget · **R6** soft-delete merge · **R7** validation rollback · **R8** retry budget/fallback · **R9** rate-limit events · **R10** abort threading
- *Why:* persistence correctness now matters because Phase D made data first-class.
- **Gate:** offline-delete test; provider-fallback test; green suite.

### Phase F — Onboarding & usability (parallel-friendly)
- **O1–O7**, **U2–U10** (U7 depends on D; U10 depends on D).
- *Why:* now that the chassis is stable and typed, guided UX changes are safe and meaningful.
- **Gate:** keyboard-only voyage completes; mobile tablet has no dead space; first-run funnel works.

### Phase G — Design polish pass
- **D1–D7** across the now-decomposed components.
- *Why last among the visible work:* polishing components is cheap and safe only after they're small (C) and stable.
- **Gate:** no forbidden tech-blue; spring easing everywhere; visual review approved.

### Phase H — Output revolution & moat
- **P1→P2→P3→P4→P5→P6** (5a/5b/5c sequencing) then **L2→L3→L4→L5**, **L6**.
- *Why last:* highest-leverage but depends on D (ContextChain), E (reliable persistence), and Supabase tables (L1).
- **Gate:** artifacts persist+version; live checklist syncs; outcome loop records; mutation candidates generated.

---

## 4. Severity-ranked Backlog (top ~25)

| id | track | title | sev | effort | depends_on |
|---|---|---|---|---|---|
| R1 | R | Stream request timeout (fix infinite spinner) | P0 | M | none |
| F1 | F | Fix 3 null-deref crashes (eval/brief/convergence) | P1 | S | none |
| R2 | R | localStorage hydration validation + migration | P1 | M | none |
| F4 | F | Decompose ProgressiveFlow (2670→~400) into hooks | P1 | L | none |
| F6 | F | Phase 0 persisted ContextChain + provenance | P1 | L | F4,F5 |
| F5 | F | Split useProgressiveStore into 3 sub-stores | P1 | M | F4 |
| F2 | F | validateShape after every parseJSON | P1 | M | none |
| R4 | R | Worker/Supabase write sync_status (no silent loss) | P1 | L | none |
| F7 | F | Consolidate FEEDBACK_SYSTEM prompt (verify first) | P1 | S | none |
| P1 | P | Persist artifacts to Supabase + versioning | P1 | M | L1 |
| P2 | P | Agent Spec 2.0 schema fields on RecastStep | P1 | M | F6 |
| U1 | U | Structured ErrorResult + recovery actions | P1 | M | none |
| O1 | O | is_new_user + journey_stage flag | P1 | M | none |
| O4 | O | Phase-transition bridge messages | P1 | M | none |
| D1 | D | Fix color drift (tech-blue, dark risk colors) | P1 | M | none |
| L2 | L | PersonaBehaviorModel (structured per-aspect) | P1 | M | F6 |
| L3 | L | OutcomeRecord UI + outcome→eval feedback | P1 | L | L2 |
| R3 | R | Partial-result recovery on mid-stream break | P2 | M | none |
| R6 | R | Merge logic respect soft-deletes | P2 | M | none |
| R8 | R | Retry budget + jitter + provider fallback | P2 | M | none |
| F3 | F | Ban raw JSON.parse → parseJSON | P2 | S | none |
| U2 | U | Focus management + keyboard nav | P2 | M | none |
| U8 | U | Mobile-first responsive layout | P2 | M | none |
| P4 | P | Live Execution Checklist (Supabase-synced) | P2 | M | P1,P2 |
| L1 | L | Supabase migrations for learning tables | P2 | S | F6 |
| D2 | D | Verify/fix motion EASE = spring curve | P2 | M | none |
| O2 | O | Quota awareness before submission | P2 | M | none |

(Lower-priority P2/P3 items — U5/U6/U9, D3–D7, P3/P5/P6, L4/L5/L6/L7, O3/O5/O6/O7, R5/R7/R9/R10, F8 — tracked in §2 tables.)

---

## 5. Quick Wins (high-leverage, low-effort — do alongside foundation)

1. **`eslint --fix`** the ~45 unused imports (S) — clears noise so real warnings stand out.
2. **F1 null-deref fixes** (S) — three one-line guards remove three real crashes.
3. **Convergence `0.5` placeholder → real first-transition** (S, part of F1).
4. **Verify `decision-quality.ts:146`** — already `|| []` guarded; downgrade/close (S).
5. **Verify FEEDBACK_SYSTEM** — grep found no symbol; may already be consolidated. Confirm before scheduling F7 (S).
6. **U6 char counters / `<pre>` overflow** (S) — cheap mobile-layout and input-validation wins.
7. **D6 HitReactionBar padding/colors** (S) — small touch-target + warmth fix.
8. **R9 dispatch rate-limit from non-stream path** (S) — fixes stale quota badge.
9. **F3 ban raw `JSON.parse`** (S) — lint rule + mechanical replace, hardens parsing.
10. **U9 lazy-load Three.js** (M-but-isolated) — ~200KB off initial bundle, no coupling.

---

## 6. Risks & Guardrails

**What could go wrong**
- **Refactor regressions (F4/F5).** Decomposing a 2670-line component that owns scroll, worker orchestration, and version control can silently break interactions tests don't cover.
- **Phase 0 over-reach (F6).** Trying to do persistence + provenance + downstream auto-propagation in one PR repeats the "build on sand" mistake.
- **Supabase migration coupling (P1/P4/L1).** Schema changes that don't match TS types cause runtime merge crashes (exactly the class of bug F2/F8 target).
- **Design pass before decomposition.** Polishing inside the monolith means every visual tweak risks the state machine.
- **Scope creep into Phase 4 (mutation engine)** before evals are trustworthy → self-improvement amplifies bad signals.

**Guardrails**
- **The 1004-test net is the contract.** Every PR must keep it green + tsc clean + `next build` OK. No PR merges red.
- **Behavior-preservation rule for F4/F5/F3:** no feature change in the same PR as a refactor. Extract one hook per PR; if tests can't prove equivalence, write the missing test *first*.
- **Add the e2e voyage simulation test** (`e2e-voyage-simulation.test.ts`, ~200 lines) early — reframe→recast→rehearse→refine with mocked Supabase/localStorage — as the integration safety net for C/D/E.
- **Phase 0 in slices (F6):** (a) define type + store, (b) persist, (c) `_source` injection, (d) `traceProvenance`, (e) downstream propagation — each independently green.
- **Migrations gated by store-schema-sync test:** assert every store type matches Supabase columns before merge.
- **Mutation engine starts manual-trigger + admin approval** (L4); A/B auto-promote only after evals proven (depends on L2/L3).
- **Verify-before-fix** for any audit claim where live grep disagreed (FEEDBACK_SYSTEM symbol absent; decision-quality already guarded).

---

## 7. Recommended First 3 Steps (start exactly here)

1. **F1 — Fix the three null-deref crashes (today, one small PR).**
   - `lib/eval-engine.ts:183-184`: `if (!item.analysis?.steps) return false;` before `.length`.
   - `lib/project-brief.ts:130`: `const steps = latest.steps.length > 0 ? latest.steps : (latest.analysis?.steps || []);`
   - `lib/progressive-convergence.ts:98`: replace hardcoded `0.5` with the real first-transition `wordOverlap` (fallback `0.5` only when `<2` snapshots).
   - Add unit tests feeding `{analysis:null}` / `{analysis:{}}`; assert no throw. Keep 1004+ green.

2. **R1 — Add a 60s (120s for max-tokens) request timeout to `callLLMStream` (`lib/llm.ts:627-757`).**
   - Wrap the stream in `Promise.race([stream, timeout])` with a merged AbortSignal; on timeout set an `ErrorResult`-shaped error and abort. Manually verify with network throttling that the spinner now resolves to a retryable error instead of hanging.

3. **R2 — Versioned localStorage validation + migration in `lib/storage.ts:27-35`.**
   - `getStorage` validates loaded shape against a versioned schema; a migration function backfills missing fields (e.g., `checkpoints: []`) so old/corrupt data can't crash hydration. Log migrations in dev. Test loading a v0 `ProgressiveSession` missing `checkpoints`.

These three are all **S/M, dependency-free, and directly remove "breaks real use" failure modes** — the safe ground from which Phase B (validation rails) and Phase C (decomposition) can proceed.
