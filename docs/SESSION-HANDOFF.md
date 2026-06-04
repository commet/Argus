# Session Handoff — resume here (another device / fresh session)

> Branch: **`fix/l0-stop-the-bleeding`** · pushed to `origin` (commet/Argus).
> Everything below is committed and green. Pick up from "What's next".

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

## NEEDS YOUR DECISION (deferred — not a safe overnight change)
1. **Two competing "team" surfaces (#1b).** The live worker stage shows BOTH the right-rail `AgentSidebar` (ambient "Analysis Team" status) AND the in-column `ProgressiveFlow.tsx:2082` "에이전트 검토 / Review agents" one-at-a-time review stepper. They sit in different screen regions and play different roles (status vs sequential approve/reject) and are already labeled distinctly — the original finding predates the current code (line numbers had drifted heavily). Collapsing to "one do-this-now surface" is an information-architecture decision with real UX trade-offs; it needs you + a visual pass, not an unattended rewrite of a 2,400-line file. **Recommendation:** decide whether the sidebar should be demoted to pure ambient status (e.g. hide its "Summary/Reflected below" roll-up during the review phase) or kept. Low risk once decided.
2. **Surface the Navigator/reflection layer in the default flow (#3b).** `NavigatorStrip` renders only on the legacy `?step=` path (`workspace/page.tsx:905`), not in `ProgressiveLayout`. Wiring it into the default voyage is genuine **net-new** work (NavigatorStrip doesn't yet read `getUserPatterns`/`getPersonaAccuracySummary`), and **MASTER-DIRECTION-v4 §SEQ-3 explicitly DEMOTED the reflection tab to a "run-3+ payoff, not the run-1 first win"** (it's tier-2-gated, near-empty on runs 1–2). So deferring is plan-aligned, not a punt — build it only when you choose to invest in run-3+ retention.

## Remaining LIVE worklist (when you pick back up)
- §UX P2/P3 LIVE items not yet touched (see UX-LIVE-TRIAGE §2 "PRIMARY-LIVE"): anon→auth quota narrative disambiguation, team-theater honesty copy (HeroFlow "assembling" vs single LLM call), signal read-path local-only note.
- The two decisions above, once you've made them.

## Deferred (do NOT spend time here until decided)
- Legacy 4-step tools (ReframeStep/RecastStep/RehearseStep, `/tools/*`), `OutputSelector` (`/project`), `RefinementLoopStep` (dead — deletion candidate).
- **Artifact persistence (L1)** — needs a Supabase migration; sessions already persist, so this is the narrow "versioned/editable exported artifact" gap, gated behind §4 kill-test.
- The "vs ChatGPT" reframe before/after contrast is on the SECONDARY reframe tool, NOT the live voyage — building it into ProgressiveFlow is genuine new work.
