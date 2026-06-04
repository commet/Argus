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

## What's NEXT (LIVE worklist, in order)
1. **Worker stage** — `AgentVisuals.tsx:9-36` fake activity tickers (show specific lines only when a real `streamSnippet` exists); two competing "team" surfaces (sidebar vs stepper, `ProgressiveFlow.tsx` ~stepper) → make one the single do-this-now surface.
2. **FinalCard** — gate the XP/Lv. gamification (`FinalCard.tsx:122-148`) behind a tooltip (P2); add the "arrival — N outputs" footer band + "see outputs →" CTA (the link target OutputSelector is secondary).
3. **Logbook** empty-state placeholder (`Logbook.tsx:92 return null`); surface the Navigator/reflection layer in the default flow (currently legacy-branch-only).
4. **BranchMap/VoyageChart** legend; **branch delete** confirm + fork-cap toast (`useProgressiveStore.ts:1480`).
5. Then the remaining §UX P2/P3 LIVE items.

## Deferred (do NOT spend time here until decided)
- Legacy 4-step tools (ReframeStep/RecastStep/RehearseStep, `/tools/*`), `OutputSelector` (`/project`), `RefinementLoopStep` (dead — deletion candidate).
- **Artifact persistence (L1)** — needs a Supabase migration; sessions already persist, so this is the narrow "versioned/editable exported artifact" gap, gated behind §4 kill-test.
- The "vs ChatGPT" reframe before/after contrast is on the SECONDARY reframe tool, NOT the live voyage — building it into ProgressiveFlow is genuine new work.
