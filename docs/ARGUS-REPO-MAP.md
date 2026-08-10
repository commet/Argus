# Argus — Repository Map (for reviewer model)

> **2026-08-10 notice:** this is a historical snapshot. Start with
> [`HANDOFF-2026-08-10-DECISION-LOOP-AUDIT.md`](./HANDOFF-2026-08-10-DECISION-LOOP-AUDIT.md)
> for the current product/domain/architecture diagnosis. Do not infer current web/MCP/plugin semantic
> convergence or package versions from the descriptions below.
>
> Snapshot of the `main` branch. Purpose: let a reviewer go straight to judgment
> without exploring the repo. Paths are relative to the repo root.
> Note: the active branch `feat/decision-contract-loop` (merging to main soon) renames
> the webapp's landing "Arrival card" → "Current Bearing" and adds `src/lib/current-bearing.ts`.

## 0. The one relationship to understand first: PLUGIN vs WEB APP

The repo is a **dual-track product** sharing one body of intellectual capital
(17 agents, 16 MBTI boss types, classification vocabulary, version-tree model):

| | **Plugin v2** (`argus-plugin-v2/`) | **Web app** (`src/`) |
|---|---|---|
| Entry | `/argus:sail "question"` (Claude Code CLI) | https://argus.voyage (browser) |
| Version | 2.0.0 | 0.1.0 |
| Output | `FinalScaffold` (JSON) + version tree | 4 formats: Brief / Prompt Chain / Agent Spec / Checklist |
| Audience | devs / CLI users, git-native | everyone, web-first |
| Persistence | `.argus/sessions/` (git-committable JSON) | Supabase (shareable link) |
| Recent investment | BUILD_STATUS 92%, awaiting real users | Playwright QA + voyage 3D demo |

**They are NOT a wrapper of each other.** They share *concepts and data*, then diverge
architecturally post-MVP. Plugin = "decision scaffold" harness; web app = "progressive
flow" visual interface. Evidence: `argus-plugin-v2/BUILD_STATUS.md` (2026-04-24, "Alignment
with webapp"), `plugin.json` v2.0.0, web `package.json` v0.1.0.

## 1. Top-level layout
- `argus-plugin-v2/` — Claude Code plugin: 5 skills + 17 agents + judgment data. **Canonical product focus.**
- `src/` — Next.js 16 web app (React 19 + Zustand 5 + Supabase). Progressive decision UI.
- `docs/` — ~50 strategy/philosophy/research docs (theses, competitive analysis, landing plans).
- `.argus/` — Argus's own working memory (sessions, critiques) — dogfooding.
- `supabase/` — 5 migrations (progressive sessions, RPC idempotency, boss locale+zodiac, rate limits).
- `scripts/` — validation/probe tools (validate-progressive.ts, probe-boss-store.ts).
- `argus-plugin/` — legacy v1, superseded, kept for history.

## 2. Philosophy / positioning docs
- `ROADMAP.md` — Argus as judgment-engine, NOT prompt wrapper; 3 moats: context chain, judgment loop, execution bridge.
- Positioning, naming, and strategy rationale are kept in internal design notes (not in the public repo).

## 3. Plugin (argus-plugin-v2/)
Skills (`skills/*/SKILL.md`):
- `sail` — orchestrator; routes by decision_density + stakes_confidence → minimal/quick/full/paused.
- `clarify` — analysis + Q&A loop → `AnalysisSnapshot` (stakes, framing confidence, decision density).
- `team` — spawn parallel worker agents on real code/PRs; debate detection (7 axes) → `FinalScaffold`.
- `boss` — MBTI stakeholder review; consumes FinalScaffold → approval + concerns + next actions.
- `chart` — version-tree visualization of `.argus/sessions/{id}/versions/`.

Data (`data/`):
- `agents.yaml` — 17 agents (capabilities, frameworks, worker-mode example dialogue, voice markers).
- `boss-types.yaml` — 16 MBTI archetypes + example_dialogue.
- `classification.yaml` — task types / domains / output types / stakes rules (runtime LLM classification).
- `schemas/*.json` (9) — final-scaffold, minimal-scaffold, analysis-snapshot, worker-result, mix-result, dm-feedback, draft, session, config.

Lib (`lib/`): `session/version-numbering.md`, `session/session-layout.md`, `locale-conventions.md`, `config.example.yaml`, `rehearsal-prompt.md`.
Install: `install.sh` copies to `~/.claude/skills/argus/` + `~/.claude/agents/`. `statusline/index.js`.

## 4. Web app (src/)
Pages (`src/app/`): `workspace/` (main progressive flow, `/voyage`), `project/`, `boss/` (MBTI + ssaju daily energy), `teams/`, `agents/`, `login/` + `auth/callback/`, `guide|privacy|terms`, `admin/utm-builder/`, `tools/recast/` (legacy route).

Stores (`src/stores/`, 17 Zustand): `useProgressiveStore` (core 4-step + draft tree), `useRecastStore`, `useReframeStore`, `useBossStore` (MBTI + saju), `useTeamStore`, `useAgentStore`/`useAgentAttentionStore`, `useAccuracyStore`/`useJudgmentStore` (learning loop), `usePersonaStore`, `useWorkspaceStore`, `useProjectStore`, `useSettingsStore`, `useHandoffStore`/`useSynthesizeStore`, `useSlackStore`.

Key lib (`src/lib/`, 150+ files):
- `progressive-engine.ts` — heart of the 4-step flow state machine.
- `progressive-prompts.ts` (~56KB) — prompt library per step (hidden-assumption detection, SCR narrative, risk classification).
- `progressive-convergence.ts` — convergence scoring (0–100%) for the refine loop.
- `agent-registry.ts` / `agent-capabilities.ts` / `agent-prompt-builder.ts` — 17 agents synced from plugin's agents.yaml.
- `boss/personality-types.ts`, `boss/boss-prompt.ts`, `boss/saju-interpreter.ts` — MBTI + zodiac energy (plugin skips saju).
- `review-prompt.ts`, `signal-recorder.ts` (learning loop), `sanitize.ts`, `task-classifier.ts`, `version-numbering.ts`.

Components (`src/components/`): `workspace/ProgressiveFlow` (canvas, desktop+mobile), agent/boss cards, `PersonaFeedbackPanel` (pre-mortem + risk classification), `BranchMap` (decision-tree viz), `OutputSelector` (4 formats).
Supabase: sessions persisted to DB for team sharing; Turnstile CAPTCHA; OAuth callback.

## 5. Build / tooling
Next.js 16.2 · React 19.2 · Zustand 5 · TypeScript 5.9 (strict) · Tailwind 4 · Vitest (jsdom) · Playwright (E2E/visual) · Three.js + R3F (voyage 3D) · Framer Motion · Anthropic SDK 0.78 · Supabase JS · Resend · ssaju (Korean zodiac).
Scripts: `npm run dev|build|start`, `test|test:watch|test:coverage`, `validate:progressive`, `probe:boss`. Plugin installs via `install.sh` (not npm).

## 6. Maturity signals (evidence only, no speculation)
- Plugin `plugin.json` v2.0.0; web `package.json` v0.1.0.
- Landing live at argus.voyage; Supabase migrations dated 2026-04-27.
- `argus-plugin-v2/BUILD_STATUS.md` (2026-04-24): **"Build confidence: 92%"**, "all 10 meta-check gates pass", post-MVP backlog (4 must-do, 8 deferred). Remaining 8% = runtime-only unknowns (subagent binding, schema $ref resolution, install.sh path, AskUserQuestion behavior).
- **Real users not yet confirmed**: "Real-user verification (Phase 4) — pending", awaiting 2–3 users (dev/PM/founder) to run live test cases.
- Recent commits = L0/L1 UX polish (copy, delete confirmations, visual legend), Playwright added. → **beta polish / pre-broad-launch**, positioning locked, awaiting real user feedback.
