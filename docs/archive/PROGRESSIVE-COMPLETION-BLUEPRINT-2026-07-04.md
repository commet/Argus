# Progressive Flow — Completion Blueprint (2026-07-04)

> Built from a **6-agent parallel audit** (dead-ends/robustness · spine · data-wiring · info-architecture · voice/i18n · UX/a11y), every item grounded in `file:line`. This is both the findings register and the execution plan. Items are grouped into execution **slices** (coherent commits), ordered highest-value/lowest-risk first.
>
> Verification gate for every slice: `tsc --noEmit` + `eslint` + affected `vitest` green; live-verify the ones that change flow behavior. Items marked **⚠verify-first** may be partly covered by this session's earlier fixes — confirm against current code before editing.

Severity: **P0** = founder's stated top pain or hard crash · **P1** = real defect (money/spine/degraded) · **P2** = polish/a11y.

Audit correction (important): the previously-planned "wiring B (self_scope→mix)" and "wiring C (persist decision chip)" are **NOT real gaps** — the data-wiring audit verified the human's self-worker judgment and decision-chip already reach mix via `result` (`submitHumanInput` → `human_input === result` → `mixableWorkerResults`). Dropped. The real dead-wiring is `decision_line` + `next_three_days` (Slice 4).

---

## Slice 1 — Info-architecture de-duplication (founder's #1 pain: "매번 수학적으로 길다 / 안 읽힌다")

**I1 [P0] `insight` rendered twice inside AnalysisCard.** `shared/AnalysisCard.tsx` — the collapsed peek uses `snapshot.insight` as the summary line (~:66/:86) AND the expanded state shows the same sentence again as the "핵심 / Key Insight" pull-quote (~:178). Same sentence twice in one card.
- Fix: when `insight` was used as the collapsed `summaryLine`, drop the duplicate 핵심 block in the expanded body (or vice-versa). Never both.
- Verify: render test / live — expand card, confirm insight appears once. Risk: low (dedupe).

**I2 [P0] Triple restatement of the course at the `shouldMix` gate.** `ProgressiveFlow.tsx:~2927` (VoyagePrepSummary shows `insight || real_question`) stacked with `:~2983` (AnalysisCard) + AnsweredPills — all paraphrase the same direction before the single CTA.
- Fix: at `shouldMix`, VoyagePrepSummary is the decision surface — suppress the separate collapsed AnalysisCard there (it already lives above the question during Q&A); keep VoyagePrepSummary + answered pills behind the record toggle.
- Verify: live at the draft gate — course stated once. Risk: medium (confirm course still reachable via VoyagePrepSummary + record toggle).

**I7 [P2] AnalysisCard renders unbounded skeleton (N-step plan) + all assumptions when expanded.** `shared/AnalysisCard.tsx:~200-285`.
- Fix: cap visible skeleton at ~5 with "+N more"; plan detail belongs to the draft, not the analysis peek. Risk: low.

**I6 [P2] CrewAtWork expanded theater maps all workers' stream tail + full report unbounded.** `CrewAtWork.tsx:~131-225`.
- Fix: cap the expanded list / reuse the one-at-a-time stepper pattern. Risk: low. (Defer if time-boxed.)

---

## Slice 2 — Spine

**S1 [P1] Navigator `verdict`/`overall` schema fields are surfaced to the user as a proceed/no-proceed lean.** `progressive-prompts.ts:1016,1019` (schema says `verdict: "One-line conclusion on whether to proceed as-is"`) rendered verbatim at `MixPreview.tsx:115,126`. Contradicts the prompt's own rule (line ~1002) and spine rules 2 & 4. No runtime guard scrubs it.
- Fix: rename schema fields to non-directional — `overall` → "one-line read of what the team's work does/doesn't yet establish"; replace `verdict` with `open_question` (neutral crux, mirror the already-fixed `lead-agent.ts` / LeadSynthesisCard). Update `NavigatorReview` interface (`progressive-engine.ts:~1401-1406`) + MixPreview render.
- Verify: unit/type + live — the "통합 검토" block shows a crux question, no proceed/no-proceed. Risk: low.

**S2 [P2] `ux` synthesis directive says "Ensure recommendations are feasible".** `lead-agent.ts:65` — "recommendations" is advice-shaped, feeds user-rendered `integrated_analysis`.
- Fix: reword to analysis language ("name what's feasible vs blocked, without prescribing which to do"); give `marketing` directive the same light touch. Risk: very low (prompt wording).

---

## Slice 3 — Voice: the actual "매번 수학적으로 간다" root (web)

**V1 [P2→treat as P1] `strategic_fork` prompt biases every decision toward quantitative one-liners.** `progressive-prompts.ts:1083-1101` — all GOOD exemplars numeric + rule "The pattern: VERB + concrete numbers/timeline + outcome." Manufactures percentages/week-counts even for qualitative decisions. This is the *content* root of the founder's complaint (Slice 1 only hid the wall).
- Fix: add a qualitative exemplar per locale; soften the pattern to "VERB + a concrete commitment (numbers/timeline when quantitative; a specific milestone/criterion when not)."
- Verify: live — run a qualitative decision (e.g. a wording/positioning call), confirm the fork options aren't forced numeric. Risk: low (prompt-only).

**V2 [P2] `BranchMap` aria-labels hardcoded English.** `BranchMap.tsx:67,104`. Fix: `useLocale()` + `L()`. Risk: none.

---

## Slice 4 — Data-wiring (human judgment captured then dropped)

**D1 [P1] `decision_line` (the boss-signable strategic-fork decision the user picks) is never consumed.** Set `ProgressiveFlow.tsx:1841`; not in `compact-context.ts` `formatSnapshot`, not in mix/final/contract; advertised in `buildOverreachPrompt` signature (`progressive-prompts.ts:704`) but never read in the body.
- Fix: add `decision_line` to `formatSnapshot` ("The committed direction: …") so it rides into mix; either use it in `buildOverreachPrompt` hints or remove it from that signature (stop advertising a non-consumer).
- Verify: unit — formatSnapshot output contains the line; live — final doc reflects the committed direction. Risk: low (additive).

**D2 [P1] `next_three_days` (the user's chosen Day-1/2/3 validation plan) is fully dead.** Set `ProgressiveFlow.tsx:1843`; zero reads anywhere.
- Fix: inject into `buildMixPrompt` (seed `next_steps`) — pass through `runMix` alongside `userNotes`, or add to `formatSnapshot`.
- Verify: unit — mix input carries it. Risk: low (additive).

---

## Slice 5 — Robustness (defensive, ⚠verify-first)

**R1 [P1] `validation_failed` worker freezes the CrewAtWork theater.** `CrewAtWork.tsx:~59` (`allDone = every done||error`) + `:~135` (only running/ai_preparing active) + `:~197` (retry only for `error`). A `validation_failed` worker matches no branch → static 대기 label, no retry, headline stuck. ⚠verify-first vs this session's `575a6a7` (which aligned `allDone` with `crewSettled`) — confirm whether CrewAtWork's `allDone` actually includes `validation_failed` now.
- Fix (if still open): add `validation_failed` to CrewAtWork terminal set + render it like `error` with `onRetry`. Risk: low.

**R2 [P1] Restored/remote `mix` with missing `sections` crashes MixPreview/final.** `MixPreview.tsx:21` (`mixToMarkdown` `mix.sections.flatMap`), `:94`, `progressive-engine.ts:1207` (`formatMixForReview`). `runMix` guards, but checkpoint-restore (`restoreFields`) + Supabase merge pass `mix` untouched. ⚠verify-first vs `fc186c6` (added `migrateMix` on load + remote merge) — confirm whether the checkpoint-restore path is covered; if not, guard the consumers.
- Fix (if still open): `(mix.sections || [])` etc. at the consumers or normalize in `restoreFields`. Risk: low.

**R3 [P1] No-flinch `runHighestLoad` has no empty/failure fallback in `Falsification`.** `ProgressiveFlow.tsx:2229-2236` returns `null` on throw; empty `text` → possibly empty claim. Needs reading `Falsification.tsx` null-handling.
- Fix: ensure the ladder always has a resolvable commit-anyway action even on null/empty. Risk: low-medium (read Falsification first).

**R4 [P2] `onMore` doesn't init workers when a new `execution_plan` first appears.** `ProgressiveFlow.tsx:2121-2149` vs `onAnswer` `:1802-1816`. Fix: mirror onAnswer's init block. Risk: low.

**R6 [P2] `isResumable` can't recover an all-`error` crew.** `ProgressiveFlow.tsx:1599` (only `pending`). Fix: include `error` in isResumable (Restart re-picks non-done). Risk: low.

**R5 [P2] `runMixCore` holds `session!` across many awaits — branch/session switch mid-mix writes to wrong session.** `ProgressiveFlow.tsx:1857-2038` (only lead `.then` re-checks). Mostly covered by `isBranchingLocked` for `phase==='mixing'`. Fix: re-check `store.currentSession()?.id === session.id` before terminal store writes. Risk: medium (core write path). (Defer / careful.)

**R7 [P2] Probe forks don't survive reload (flag-gated `newArcEnabled`, off by default).** `ProgressiveFlow.tsx:1611-1634`. Fix: persist probe result keyed to session, or suppress TrialSail copy when store empty on reload. Risk: low. (Defer — off by default.)

---

## Slice 6 — UX affordances (money + recovery)

**U1 [P1] Double-submit on Resume/Restart-crew button re-runs & re-bills the whole crew.** `ProgressiveFlow.tsx:2641` (no disabled) + `:1648` (`onResumeWorkers` no in-flight guard) — aborts partial run, restarts, re-bills.
- Fix: `if (workersRef.current) return;` at top of onResumeWorkers + disable button while a run is pending. Risk: low.

**U2 [P1] `StepErrorFallback` overrides ErrorBoundary's better in-place retry with reload-only (loses state).** `page.tsx:51-64` used at `:210,:1371`; `ErrorBoundary.tsx:37-38` returns the fallback prop early, so its `handleRetry` (cheap reset, no state loss) is unreachable; StepErrorFallback only `window.location.reload()`.
- Fix: drop the `fallback` prop (default is strictly better) OR thread the boundary `reset` into StepErrorFallback so its primary is in-place "다시 시도". Risk: low.

**U4 [P2] QuestionCard answer inputs lack `maxLength` (CLAUDE.md violation, highest-traffic input).** `shared/QuestionCard.tsx:120,144`; also `ProgressiveFlow.tsx:980` (reject reason), `WorkerPanel.tsx:120,187`.
- Fix: add `maxLength` (~500-1000). Risk: none.

---

## Slice 7 — A11y & polish (batch)

**U3 [P2] Error surfaces not announced.** `page.tsx:55-58` (StepErrorFallback) + `:756` (Hero error banner) — no `role="alert"`/`aria-live`; decorative icons not `aria-hidden`. Fix: add. Risk: none.

**U6 [P2] Modal/menu backdrops have no Escape handler.** Draft-preview `ProgressiveFlow.tsx:3427`, revision `:3479`, branch menu `page.tsx:168`. Attribution pins `AttributedSection.tsx:73,155` / `AgentSidebar.tsx:152` are `onTap`-only (no keyboard). Fix: Escape keydown while open (mirror `VerificationGate.tsx:39-45`); keyboard equiv for pins. Risk: low.

**I8 [P2] Cancel button < 44px on mobile + sticky band collision.** `ProgressiveFlow.tsx:359` (`min-h-[32px]`), sticky `:2430 top-16`. Fix: bump Cancel to `min-h-[44px]`; verify sticky height at 375px. Risk: low.

**U5 [P2] Focus not moved after phase transitions.** `ProgressiveFlow.tsx:1203-1216` scroll-only. Fix: autofocus current QuestionCard input on mount / move focus to phase heading ref on phase change (gate on phase change, don't steal mid-typing). Risk: low.

**U7 [P2] Deep-linked legacy `?step=` with no project silently lands on Hero; `return null` blank frame.** `page.tsx:1223,1249`. Fix: empty state "start a decision first" when `useLegacyMode && !currentProjectId`; return `<SuspenseFallback/>` instead of `null` at `:1249`. Risk: low.

**I3 [P1-scoped] `LoadingSteps` fake step-ladder (checkmarks = timer theater).** `ui/LoadingSteps.tsx:22-34,80`. Shared by legacy Reframe/Rehearse/Synthesize tools (progressive uses honest StreamSnippet). Fix: replace checkmark ladder with a content-shaped skeleton (keep real elapsed counter); scope via a `variant` so legacy callers opt in. Risk: low-medium (shared component).

**I4 [P1-partial] Complete screen FinalCard + CurrentBearingCard duplicate the summary.** `ProgressiveFlow.tsx:3257,3281`. Already mitigated (FinalCard body collapsed). Fix: ensure expanded FinalCard `executive_summary` blockquote isn't shown when the bearing card is present. Risk: low.

**I5 [P2] Competing CTAs at draft stage.** `MixPreview.tsx:159-199` + VoyagePrepSummary 3-way fork. Fix: keep gold primary; collapse "한 번 더 짚어보기" + "답한 내용 돌아보기" into one "돌아보기/수정". Risk: low (confirm founder wants revisit prominent — memory says users want to go back, so keep it reachable).

---

## Slice 8 — argus-mcp i18n (SEPARATE package / npm deploy `argus-decision-mcp`; batch on its own)

The KO/EN English-leak the dogfood log found is entirely in `argus-mcp/`, not the web app. All are "hardcoded English, no locale branch" — mechanical migration into `surfaces.ts`.
- **M1 [P0]** `open-decision.ts:35-42,62,80,93,120,133` — every surface English. → `open:` group in surfaces.ts.
- **M2 [P0]** `settle.ts:69,77,111,115` + `render-receipt.ts:21-61` (`renderReceipt` takes no locale, unlike renderSeal/renderWake). → `receipt:` group + thread locale.
- **M3 [P1]** `seal.ts:147` — top `surface` English though `seal_text` localized. → `seal.surface_line` entry.
- **M4 [P1]** `recheck.ts:64,67,101` — English errors. → `recheck:` group.
- **M5 [P1]** `settle.ts:51,57` — elicitation hardcoded bilingual, ignores locale. → branch on `surfaceLocale(dir)`.
- Note: `review/*` files are byte-drift-guarded vs webapp — do NOT move into surfaces.ts.

---

## Execution order & status
1. Slice 1 (I1, I2, I7) — info-arch dedup ⬜
2. Slice 2 (S1, S2) — spine ⬜
3. Slice 3 (V1, V2) — voice root ⬜
4. Slice 4 (D1, D2) — dead-wiring ⬜
5. Slice 5 (R1, R2, R3 …) — robustness ⬜
6. Slice 6 (U1, U2, U4) — UX money/recovery ⬜
7. Slice 7 (a11y batch + I3/I4/I5) ⬜
8. Slice 8 (argus-mcp i18n) ⬜

Each slice: independent commit, tsc/eslint/tests green, live-verify flow-behavior changes, push. Deploy web slices (1-7) via PR to main; slice 8 is the MCP package's own release.
