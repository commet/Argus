# §UX Live-Path Triage

> Separates the v4 §UX findings into what a real user actually sees (the **default voyage**) vs **secondary** surfaces vs **dead** code, so we don't spend effort fixing screens nobody reaches.
> Every routing fact below was read from source on 2026-06-04 (per VERIFICATION-PROTOCOL).

---

## 1. Verified routing / reachability map

**Entry:** the landing CTA and primary nav both go to `/workspace` — `[VERIFIED: LandingHeader.tsx:111 href="/workspace"; Act3OnDeck.tsx:87 href="/workspace"; Header.tsx:18 {href:'/workspace', primary:true}]`.

**The default voyage (PRIMARY-LIVE)** — what every user sees:
`/workspace` → `HeroFlow` (idle→assembling→analyzing) → `ProgressiveLayout` → **`ProgressiveFlow`** (Q&A "conversing" → workers → mix → **`FinalCard`**). `[VERIFIED: workspace/page.tsx:116 <ProgressiveFlow/>, :749 <ProgressiveLayout/>; :683 comment "Use legacy mode if ?step= is explicitly set"]`.

**Legacy 4-step mode (SECONDARY)** — only via the `?step=` query param or the `/tools/*` pages:
`ReframeStep` / `RecastStep` / `RehearseStep` `[VERIFIED: workspace/page.tsx:870-872 rendered only under activeStep, reached when ?step= is set (:683); also imported by tools/reframe, tools/recast, tools/rehearse]`. The default voyage does NOT render these inline — it hands off to them via `PipelineExitOptions` `[VERIFIED: ProgressiveFlow.tsx:883 PipelineExitOptions(onReframe,onRehearse); :2295-2300 exportProgressiveAsRecast → useRecastStore.addItem → linkToRecast]`. So they are reachable "deeper tools", not the main path.

**Saved-project output view (SECONDARY)** — `/project` page only:
`OutputSelector` (the 5-format 총보/파트보/… picker) `[VERIFIED: only usage is app/project/page.tsx:679 <OutputSelector/>; Header.tsx:19 {href:'/project', requiresAuth:true}]`. **The main voyage's output is `FinalCard`, not `OutputSelector`** — this is why the orchestra labels are rarely seen.

**Dead code:** `RefinementLoopStep` `[VERIFIED: zero references in src — fresh `grep -rln RefinementLoopStep src` returns nothing]`. Deletion candidate. `BranchMap`/`FinalCard` show "no page" only because they render INSIDE ProgressiveFlow (both LIVE).

**Component → status quick table** (verified by parent/route):
| Component | Status | Why |
|---|---|---|
| ProgressiveFlow, FinalCard, ConvergenceStatus, Logbook, BranchMap, WorkerPanel, AgentSidebar, AgentVisuals, ShareBar, CopyButton(via ShareBar), AvatarRow | **PRIMARY-LIVE** | default voyage |
| HeroFlow (workspace entry), InteractiveDemo, Landing (Act1/2/3), Header | **PRIMARY-LIVE** | entry / global |
| ReframeStep, RecastStep, RehearseStep, FeedbackResult, LoadingSteps, StepIntro, SynthesizeStep | **SECONDARY** | `?step=` / `/tools/*` handoff |
| OutputSelector | **SECONDARY** | `/project` only |
| RefinementLoopStep | **DEAD** | 0 refs |

---

## 2. §UX findings, classified

### PRIMARY-LIVE — do these (the user actually sees them)
- **[DONE] L0 first-run analyze Cancel + elapsed** — workspace/page.tsx (committed `eec43d4`).
- **[DONE] L0 silent worker auto-accept** — worker-engine.ts (committed `9ec4954`).
- **[DONE] L0 storage-quota toast** — storage.ts (committed `9ec4954`).
- **[DONE] L1 convergence gauge** — ProgressiveFlow.tsx ConvergenceStatus (committed `a29d154`).
- **L0 Copy/Download silent failure** — `CopyButton.tsx:27-29` catch has no UI; **LIVE via ShareBar→CopyButton in FinalCard**. Show "복사 실패 — 다시 시도" + flip download to "저장됨 ✓".
- **L0 Human-send silent bail** — `ProgressiveFlow.tsx:1247-1248` returns silently if no auth token → set `status:'error'`.
- **L0 Global ErrorBoundary "Try again" loops** — `ErrorBoundary.tsx:31-33` only clears state; add "새 프로젝트로 → /workspace".
- **L0 Language toggle hard-reloads mid-voyage** — `useLocaleSwitch.ts:18-22` unconditional `window.location.reload()`; disable/confirm during analyzing/mixing/worker-running.
- **L1 Landing: no plain value prop above the fold** — `Act1Voyage.tsx:67-98` (100% metaphor). Add a deck line.
- **L1 Landing: hero has no real CTA** — `Act1Voyage.tsx:120-135` (only an 11.5px scroll anchor). Add a primary "무료로 시작 → /workspace".
- **L1 Workspace entry: no headline/tagline + "팀" referenced before it exists** — `workspace/page.tsx:348-354`. Add an editorial headline + 3-step preview chips.
- **L1 Worker stage: two competing "team" surfaces** — sidebar vs stepper (`ProgressiveFlow.tsx:2076`). Pick one do-this-now surface.
- **L1 Worker fake activity tickers** — `AgentVisuals.tsx:9-36` (LIVE via AgentSidebar/WorkerPanel). Show specific lines only when a real stream snippet exists.
- **L1 No first-run onboarding** — auto-demo is UNBUILT (HeroFlow `setDemoScenario`); entry copy is the stopgap.
- **L1 Default flow hides the Navigator/reflection layer** — `ProgressiveLayout` renders only `<Logbook/>`; NavigatorStrip is legacy-branch-only.
- **L1 Logbook null on empty** — `Logbook.tsx:92 return null`. Render a placeholder.
- **L4 FinalCard: decision log is a tiny grey checkbox** — `FinalCard.tsx:76-84` (the differentiator). Promote with a value line.
- **L4 FinalCard: XP/Lv gamification at the triumphant end** — `FinalCard.tsx:122-148`. Gate behind a tooltip.
- **L4 FinalCard footer band "도착 — N 산출물 + 산출물 보기 →"** — the FinalCard side is LIVE (the link target OutputSelector is secondary).
- **L4 BranchMap/VoyageChart legend; branch delete confirm; fork cap toast** — `useProgressiveStore.ts:1480` cap. LIVE.

### SECONDARY — fix only if/when we invest in the legacy tools or /project
- Outputs "what to do next" per format — `OutputSelector.tsx:167` (/project).
- Output card metaphor labels / "이타카" header / dark code preview — `OutputSelector.tsx` (/project).
- LoadingSteps freezes on last step — `LoadingSteps.tsx` (legacy step tools only).
- Reframe metaphor-first title / before-after AFTER confirm / 2-step roadmap — `ReframeStep.tsx` (legacy). **Note:** the plan prized the reframe before/after as "the vs-ChatGPT moment" — but it lives on the SECONDARY reframe tool, **not in the default voyage**. If that moment matters, it must be built INTO ProgressiveFlow (new work), not just moved within ReframeStep.
- Rehearse "(simulated)" subtitle / native `alert()` / read-only concerns — `RehearseStep.tsx`, `FeedbackResult.tsx` (legacy).
- Tool-name single-sourcing across i18n/workspace/RehearseStep — spans legacy + live; do the live labels first.

### DEAD — skip / delete
- `RefinementLoopStep` (0 refs). Candidate for clean removal (CLAUDE.md still references it as a FEEDBACK_SYSTEM home — stale).

---

## 3. Notable findings from the triage
1. **The "vs just ask ChatGPT" reframe-contrast moment is NOT in the default voyage** — it lives on the secondary `ReframeStep` tool. The live voyage shows the reframed question inside ProgressiveFlow's Q&A, but not the explicit before/after side-by-side. Building that contrast into the live flow is genuine new work, not a UX tweak.
2. **OutputSelector (총보/파트보/총보/셋리스트) is `/project`-only** — the main output is `FinalCard` ("완성된 기획안" + Copy/Share). Most §UX-L4 output items target the secondary surface.
3. **Sessions DO persist** — `useProgressiveStore.persist()` → `setStorage(PROGRESSIVE_SESSIONS)` + Supabase `loadAndMerge`/`upsert`. The "artifact persistence" gap is narrow (no standalone versioned/editable exported artifact), NOT "work disappears".
4. **`RefinementLoopStep` is dead** — and CLAUDE.md's "single-source the FEEDBACK_SYSTEM prompt" guidance references it; that note is stale.

---

## 4. Recommended order (PRIMARY-LIVE only)
Already shipped: analyze Cancel, worker auto-accept, storage toast, convergence gauge.
Next, in the live voyage: **Landing value-prop + CTA → Workspace entry headline/preview → Copy/Download + ErrorBoundary + language-toggle safety → Worker-stage clarity → FinalCard decision-log/footer.** Secondary/legacy surfaces deferred until we decide the legacy tools' fate.
