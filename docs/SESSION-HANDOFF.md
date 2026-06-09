# Session Handoff — resume here (another device / fresh session)

> Branch: **`fix/l0-stop-the-bleeding`** · pushed to `origin` (commet/Argus).
> Everything below is committed and green. Pick up from "What's next".

## ✅ RESOLVED — Worker-stage redesign, core shipped (Option A)

**Decision (owner): Option A — differentiate.** The Logbook owns the route/map
metaphor; the agent sidebar stays a DISTINCT "live crew roster / status" surface,
NOT a second vertical route-line. We shipped the safe, high-value core of the
Voyage Register spec and deferred the route-line visuals.

**Shipped** (`42d932a`, branch `feat/worker-stage-roster-then-core`, gate green:
tsc clean / eslint 0 errors / vitest 1004):
- Shared `focusedWorkerId` + `setFocusedWorker` on `useAgentAttentionStore`
  (orthogonal to the done-only `hovered` channel).
- Body review stepper's `reviewCursor` replaced by an id-based projection of
  `focusedWorkerId` → clicking a rail row and reading a body card are ONE
  selection; re-sorting the crew can't drift the cursor.
- Sidebar rows read `focusedWorkerId` for the existing gold ring; clicking a done
  row docks the body card onto it.
- Full assigned crew shown from casting (pending filter dropped); standby rows
  quiet (opacity 0.62); removed the redundant "assembling" empty-state + "N more
  joining" footer.
- Deploy gate (`팀 투입`) and one-at-a-time review preserved.

**Deferred (route-line metaphor / polish — NOT part of Option A's core):** rail
re-skin as a gold spine, the `FocusThread` one-shot SVG, the `CastOff` deploy
ceremony, and the `scout_angle` pre-scout LLM pass. The spec
(`docs/WORKER-STAGE-REDESIGN.md`) still documents these, but note its §3/§4/§7
"single vertical gold spine" is the very metaphor Option A rejected — if revived,
recast it as roster styling, not a route-line. **Current thread moved on to the
PLAN's core (F4 — decompose `ProgressiveFlow.tsx`).**

---

## ⚡ PRIOR ACTIVE THREAD (archived) — Worker-stage redesign

**Where we stopped:** designing the worker (agent) stage — how the right-rail agent status and the in-body one-at-a-time review connect.

**Ground truth established (verified in code):** the right-rail `AgentSidebar` and the in-body review stepper ALREADY read the same `session.workers` — they're connected in data, but the connection is INVISIBLE in the UI (no shared focus; `reviewCursor` is local to ProgressiveFlow; pending/assigned agents are hidden at `AgentSidebar.tsx:433`). Agents are ASSIGNED during Q&A (`initWorkers`) but only DO their work AFTER the "팀 투입" deploy gate (`runAllAIWorkers`).

**Agreed design decisions (owner):** Q1 add a LIGHT pre-scout during Q&A (full work after deploy); Q2 KEEP the deploy gate (the "set sail" moment); Q3 sidebar carries rich status + show the sidebar↔body connection professionally; Q4 keep the one-at-a-time finding-first review (already in place — verified).

**A design workflow ran → spec at `docs/WORKER-STAGE-REDESIGN.md`** (chosen direction "Voyage Register": a `focusedWorkerId` channel syncs sidebar↔stepper bidirectionally; a gold spine + one-shot SVG thread shows the link; pre-scout uses a NEW `scout_angle` field — NOT `ai_preliminary`, which is occupied; deploy CTA stays "팀 투입"). Critique verdict: **SHIP_WITH_FIXES** (5 small fixes listed in the result JSON / critique).

**🚨 OPEN DECISION — the blocker to resolve FIRST (the spec MISSED this):**
The right rail already stacks **`<Logbook/>` (top) above `<AgentSidebar/>`** (`workspace/page.tsx:120-126`). **Logbook is ALREADY a vertical route/map** — a dashed course-line of decision waypoints + the "전체 해도 / full chart" (VoyageChart) modal + branch controls. The chosen redesign makes the agent sidebar ALSO a vertical gold route-line → **two route/map metaphors stacked = visual clash/redundancy.** The spec only handled the *technical* stacking (can a connecting line cross containers), NOT this metaphor clash. The owner caught this.
- **Option A (RECOMMENDED): differentiate.** Logbook keeps "the route/map" (it owns it); make the agent sidebar a DISTINCT "live crew roster / status" visual — NOT a second route-line. Keep the connection mechanic (click agent → jump + visual link), pre-scout, and show-all-assigned-agents. (The roster/console concepts scored 4.17–4.50; with this constraint they likely beat the route winner.)
- **Option B: integrate** the agents onto Logbook's single route ("this decision point, this crew working") — more ambitious, touches Logbook.
- **Option C: re-run a short design pass** with the hard constraint "Logbook owns the route metaphor."

**Next session, START by:** owner picks A/B/C (lean A). Then: fold the critique's 5 fixes into the spec → build incrementally (each tsc+lint+1004 green): (1) add `focusedWorkerId`+`setFocusedWorker` to `useAgentAttentionStore` (~6 lines), (2) remove the pending filter at `AgentSidebar.tsx:433` (show all assigned crew — safe alone), (3) bidirectional focus sync. Keep the deploy gate + one-at-a-time review throughout.

Files: `docs/WORKER-STAGE-REDESIGN.md` (full spec), `docs/argus-worker-redesign-result.json` (all 5 concepts + judgments + critique), `scripts/argus-worker-stage-redesign-workflow.js` (the workflow).

---

## Resume on another device
```bash
git fetch origin
git checkout fix/l0-stop-the-bleeding
npm install            # if node_modules is stale
npx vitest run         # confirm 1004/1004 green
npx tsc --noEmit       # confirm clean
```
Local-only files NOT pushed (intentional): `package-lock.json` had a stray pre-existing diff (not our work); `docs/PLAN.md` is the superseded old plan. Ignore both.

## Read these first (the plan + the rules)
1. **`docs/MASTER-DIRECTION-v4.md`** — the verified master plan. HYBRID direction; §0 Decision-Contract closed-loop kick; sequenced L0→L5 + §UX track. Every load-bearing claim tagged `[VERIFIED]`/`[INTENT]`/`[ASSUMPTION]`.
2. **`docs/UX-LIVE-TRIAGE.md`** — which surfaces are LIVE vs legacy vs dead. **Only fix LIVE-path surfaces.** Default voyage = `/workspace` → `ProgressiveFlow` → `FinalCard`. Legacy (`?step=` / `/tools/*` / `OutputSelector` on `/project`) is deferred.
3. **`docs/VERIFICATION-PROTOCOL.md`** — claim discipline (error classes E1–E7, claim tags). Born from 26 precision errors. **Obey it:** quote the exact source you read; fresh-grep every count; prove producer+consumer for any "reuse"; never trust a plan claim without re-checking against current code (some plan citations pointed at legacy/dead code).

## Working agreement (keep doing this)
- Smallest safe step → **tsc clean + `eslint` 0 errors + `vitest run` 1004 green** → commit per unit.
- Only touch LIVE-path surfaces (per UX-LIVE-TRIAGE).
- A concurrent session previously edited this repo; if you see unexpected `M` files you didn't write, treat them as someone else's work — don't clobber, ask.

## What's DONE this session (commits on the branch)
- **L0 stop-the-bleeding** (`9ec4954`): stream inactivity watchdog (llm.ts), 2nd empty-result guard (workspace), 2 null-deref guards (project-brief/eval-engine), storage-quota toast, observable sync-write failures (sync-health.ts), worker silent-auto-accept removed.
- **L1 convergence gauge** (`a29d154`): ProgressiveFlow ConvergenceStatus now shows trend + rounds-left + 75% "ready" marker.
- **Analyze cancel/timer** (`eec43d4`): elapsed counter + Cancel on the first-run analyze screen.
- **Landing value-prop + CTA** + **workspace entry orientation** (`5005667`): plain-language line + real "Start free" CTA on the hero; headline + 3-step preview above the input.
- **Safety** (`fc7972a`): CopyButton failure state, ErrorBoundary "Back to workspace" escape, language-toggle confirm while a voyage is in flight.
- **FinalCard decision-log** (`98875d7`): promoted from a tiny checkbox to a labeled differentiator with a value line.
- **Docs/cleanup**: plan + protocol (`eff518e`), UX live/legacy triage (`03d57fa`), concurrent-session legacy `?step=` nav removal preserved (`9823f4e`).

## Session 2 (continued) — DONE (branch `fix/l0-stop-the-bleeding`, all 1004 green, tsc+eslint clean)
Line numbers in the worklist had drifted; everything below was re-verified against current source before editing (per VERIFICATION-PROTOCOL).
- **`83fb242` Worker tickers honesty (#1a)** — `AgentSidebar` AgentRow no longer rotates fabricated per-persona activity ("analyzing competitor cases") when there's no real stream; falls back to the genuine assigned task + neutral "working" lines. (The fake tickers live in `progressive/shared/AgentVisuals.tsx`, used live only via `AgentSidebar:105`; `InteractiveDemo` is a labeled demo, left as-is.)
- **`b81c80b` FinalCard XP/Lv gating (#2a)** — extracted `AgentGrowthFooter`; the XP/Lv chips are now a muted one-liner with the detail behind a tap-to-reveal disclosure, so gamification doesn't cheapen the final document.
- **`aaebc29` Logbook empty-state (#3a)** — `Logbook.tsx` renders a dashed placeholder ("your decision trail collects here") instead of `return null` when a voyage exists but has no waypoints yet. Mobile `LogbookDrawer` intentionally still null-on-empty.
- **`571136d` Branch-delete confirm (#4b)** — two-step inline confirm before `deleteBranch` in both Logbook chips and the VoyageChart course list (no native confirm).
- **`23e8796` Fork-cap toast (#4a)** — `forkBranch` at `MAX_BRANCHES` now dispatches `argus:fork-blocked` (window CustomEvent, SSR-guarded); new global `ForkLimitToast` (mounted in Header) explains the cap + recovery.
- **`75c90cc` BranchMap legend (#4c)** — compact visual legend under the VoyageChart (filled=logged point, hollow=checkpoint, ring=current, ⚑=anchored, dimmed=abandoned-when-present).
- **`f9b1f7e` Review-nit polish** — from an adversarial diff review: disarm stale delete-confirm on active-switch/remove/lock; FinalCard disclosure `aria-controls`; memoize VoyageChart `branches`.

## Session 3 (continued, this device) — DONE (all 1004 green, tsc+eslint clean, pushed)
- **`143897f` Team-theater honesty (P2)** — the "assembling" screen said "Team assembled. Analyzing the situation" while animating 4 persona avatars, but the initial pass is a single LLM call (the crew does individual work later, at the worker stage). Reframed to "Your crew is here — first, reading the situation to find the real question" (blindspot S3).
- **`81d3df5` Quota narrative disambiguation (P2)** — the non-LOGIN_REQUIRED quota error always said "Free trial limit reached", but it also fires for a signed-in user who hit their daily allowance. Now branches on `user`: signed-in users see "today's free allowance (N/day)", anon keeps the trial framing.

## NEEDS YOUR DECISION (deferred — not a safe overnight change)
1. **Two competing "team" surfaces (#1b).** The live worker stage shows BOTH the right-rail `AgentSidebar` (ambient "Analysis Team" status) AND the in-column `ProgressiveFlow.tsx:2082` "에이전트 검토 / Review agents" one-at-a-time review stepper. They sit in different screen regions and play different roles (status vs sequential approve/reject) and are already labeled distinctly — the original finding predates the current code (line numbers had drifted heavily). Collapsing to "one do-this-now surface" is an information-architecture decision with real UX trade-offs; it needs you + a visual pass, not an unattended rewrite of a 2,400-line file. **Recommendation:** decide whether the sidebar should be demoted to pure ambient status (e.g. hide its "Summary/Reflected below" roll-up during the review phase) or kept. Low risk once decided.
2. **Surface the Navigator/reflection layer in the default flow (#3b).** `NavigatorStrip` renders only on the legacy `?step=` path (`workspace/page.tsx:905`), not in `ProgressiveLayout`. Wiring it into the default voyage is genuine **net-new** work (NavigatorStrip doesn't yet read `getUserPatterns`/`getPersonaAccuracySummary`), and **MASTER-DIRECTION-v4 §SEQ-3 explicitly DEMOTED the reflection tab to a "run-3+ payoff, not the run-1 first win"** (it's tier-2-gated, near-empty on runs 1–2). So deferring is plan-aligned, not a punt — build it only when you choose to invest in run-3+ retention.

## Remaining LIVE worklist (when you pick back up)
- The two **NEEDS YOUR DECISION** items above — these are the main open thread now.
- Only marginal §UX P3 left: a code-comment note that the signal read-path is local-only (internal, not user-facing — low value). The user-facing P2 items (quota narrative, team-theater) are now done.

## Deferred (do NOT spend time here until decided)
- Legacy 4-step tools (ReframeStep/RecastStep/RehearseStep, `/tools/*`), `OutputSelector` (`/project`), `RefinementLoopStep` (dead — deletion candidate).
- **Artifact persistence (L1)** — needs a Supabase migration; sessions already persist, so this is the narrow "versioned/editable exported artifact" gap, gated behind §4 kill-test.
- The "vs ChatGPT" reframe before/after contrast is on the SECONDARY reframe tool, NOT the live voyage — building it into ProgressiveFlow is genuine new work.
