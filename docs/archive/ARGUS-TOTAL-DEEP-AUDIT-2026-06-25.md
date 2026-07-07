# Argus Total Deep Audit

Date: 2026-06-25  
Scope: web app, plugin v2, legacy agent skills, integrations, product strategy, UX/design, quality gates  
Method: repository inspection, docs/code cross-check, static gates, unit tests, build, lint

## Executive Verdict

Argus is not just a prompt wrapper. The strongest product idea is a judgment navigation system: it turns a vague human problem into a Current Bearing, seals a Decision Contract, and later asks whether reality matched the bet. That loop is rare, valuable, and much more defensible than another "AI writes a document" product.

The weakest part is also clear: the product still has too many parallel surfaces that describe the same promise differently. The web app, plugin v2, old `.agents/skills`, and integrations all contain useful pieces, but they are not yet one canonical operating system. Argus already has strong concepts; the next level is to remove ceremony, persist the right state, and make the return loop unavoidable.

My recommendation: treat `CurrentBearing -> DecisionContract -> Settlement` as the spine. Everything else either feeds that spine, displays it, or should be cut/demoted.

## Verified Reality

These are facts verified from the repository, not assumptions.

- The old criticism that LLM output was effectively capped at 4096 tokens is now outdated. `src/lib/llm-validation.ts` exposes a 64K output ceiling, `src/app/api/llm/route.ts` forwards stop/finish reason, and `src/lib/llm.ts` has timeout/retry/watchdog behavior.
- The web app already has a real return loop: `src/components/projects/DecisionContractCard.tsx`, `src/components/projects/SettlementModal.tsx`, `src/app/api/cron/checkin-due/route.ts`, project due sorting, and workspace due strips.
- `CurrentBearing` is derived through `src/lib/current-bearing.ts`; it is not yet a persisted canonical ledger.
- `DecisionContract` is stronger than a normal saved result. `src/lib/decision-contract.ts` separates early contract, augmented contract, authorship, luck, and draft basis.
- Plugin v2 is strategically cleaner than the older skill surface. `.claude-plugin/plugin.json`, `skills/sail/SKILL.md`, `skills/settle/SKILL.md`, and `data/schemas/current-bearing.json` describe a compact command-native workflow.
- Legacy `.agents/skills/*` still exists beside plugin v2 and can drift in behavior, wording, journal model, and product promise.
- Integrations are broader than a normal app: email inbound, Slack events, Telegram connect/share, plugin ingest tokens, calendar reminders, and check-in cron exist.
- Quality gates now pass after small drift fixes:
- `npm test`: 104 files, 1470 tests passed
  - `npm run build`: successful Next.js production build
  - `npm run eval:static`: 12/12 passed
  - `npm run gates:test`: 10/10 passed
  - `npm run lint`: 0 errors, 148 warnings

## What Is Genuinely Recommendable

### 1. Current Bearing

This is the sharpest product primitive. A user does not need another long AI report; they need to know:

- what question they are really deciding,
- what is assumed,
- what would change the answer,
- what to do next,
- when to come back.

Argus has this shape. If shown and persisted correctly, it becomes a decision instrument rather than a chat transcript.

### 2. Decision Contract And Settlement

The most valuable loop is not generation; it is accountability. Argus asks: "What did we believe, what did we choose, what happened, and what did we learn?"

That is a business-grade differentiator. Most AI tools optimize for output polish. Argus can optimize for judgment calibration over time.

### 3. Authorship-Aware AI

The code distinguishes AI-surfaced text from user-authored commitments. That is subtle and important. It prevents a fake sense of human commitment when the user merely accepted machine wording.

This should become a brand-level principle: Argus does not launder AI guesses into human conviction.

### 4. Plugin v2 Is Closer To The Real Product Than The App Copy

The plugin v2 language is compact: sail, settle, current heading, sealed decisions, ledger. It avoids over-selling agent machinery. This is the right direction.

For developers and operators, a command-native decision journal is a high-value surface. It fits the way serious work already happens.

### 5. Local-First With Async Sync

The architecture choice is good. Zustand/localStorage first means the user can think without waiting on cloud state. Supabase sync adds continuity without owning the core interaction.

This is especially appropriate for a thinking product, where losing a draft or waiting on auth is poisonous.

### 6. LLM Boundary Hardening

The repo has better-than-average LLM defensive work: schema validation, output caps, streaming timeouts, retry paths, stop reason forwarding, and tests around malformed output.

This is one of the places where the code does not feel like naive vibe coding. It shows awareness that LLM calls fail in boring, partial, and expensive ways.

### 7. Cross-Channel Ambition

Email, Slack, Telegram, plugin, and web can be powerful if they converge on settlement. The right version is not "Argus is everywhere"; it is "wherever the decision comes back, Argus can close the loop."

## What Still Feels Weak

### 1. The Spine Is Derived, Not Canonical

`CurrentBearing` is currently derived from session state. That works for display, but the product wants a canonical ledger.

Problem: the user can see a bearing, seal a decision, later settle it, and then start a new problem, but the underlying model still treats key orientation as reconstructed output rather than first-class decision state.

Consequence: the most important concept is easier to lose, harder to diff, harder to replay, and harder to learn from.

Required move: persist `BearingLedger` entries. A bearing should have version, source snapshot, assumptions, falsifiers, recommendation, check-in, authored fields, and settlement linkage.

### 2. Web UI Still Exposes Too Much Machinery

The app still contains user-facing agent/team/navigator language in places. Some of it is charming, but too much makes the product feel like an AI demo instead of a serious instrument.

The plugin v2 gets this more right: it sells the outcome, not the internal cast.

Rule: users should see decision orientation, contradiction, commitment, and return. They should rarely see "agents are working" unless it creates trust or control.

### 3. Too Many Product Surfaces Can Drift

There are at least four product surfaces:

- web app progressive workspace,
- plugin v2,
- old `.agents/skills`,
- legacy plugin/docs/scripts.

This creates strategic drag. Each surface can carry different terminology, different schemas, different promises, and different safety behavior.

The biggest danger is not code duplication; it is product duplication. A user should not get a different Argus philosophy depending on which entry point they use.

### 4. The Return Loop Is Present But Not Yet Dominant

Settlement exists, but it still feels like a feature after the main experience rather than the center of the product.

Argus should be judged by:

- how often users seal a decision,
- how often they return,
- whether they settle honestly,
- whether future recommendations improve from past calibration.

If those metrics are secondary, Argus becomes another polished drafting app.

### 5. Telegram Is Under-Claimed Or Under-Built

Telegram currently appears more like connect/share plumbing than a full settlement channel. That is fine if positioned honestly, but weak if advertised as a core surface.

High-value version: a reminder arrives, user replies with outcome, Argus parses settlement, updates the ledger, and feeds calibrated learning into future sessions.

Until then, Telegram should be presented as optional notification/share infrastructure, not a full Argus interface.

### 6. The Type Model Is Too Large

`src/stores/types.ts` is carrying too much conceptual mass. Richness is not bad, but the current shape makes field additions risky and spreads sync concerns across stores, prompts, UI, and Supabase.

The existing `AGENTS.md` checklist is correct: type, store creator, defaults, migration, prompts, UI, handoff functions. But needing that checklist so often is itself a smell.

Required move: promote only the decision spine into canonical shared schema, and demote secondary display/ceremony fields.

### 7. Design Has Taste, But Also Gimmick Risk

The product has a distinctive visual and conceptual identity. That is good.

The risk is that boss cards, personality overlays, saju/MBTI-style flavor, and gamified labels can cheapen the core promise if they compete with decision quality.

Design principle: serious by default, expressive at the edges. The main workspace should feel like a high-grade cockpit, not a novelty AI experience.

### 8. Lint Warnings Are Still Too High

Lint now exits with 0 errors, but 148 warnings remain. Some warnings may be harmless, but as a system grows around LLM outputs, stale dependencies and unused code become real quality debt.

The threshold should be ratcheted down. Warnings should not stay invisible indefinitely.

## Keep, Cut, Add

## Keep

- `CurrentBearing`, but make it persisted.
- `DecisionContract` and settlement logic.
- Authorship distinction: `user`, `ai_surfaced`, fallback, skip.
- Plugin v2 command model.
- Local-first behavior.
- Streaming timeout/retry and validation tests.
- Cross-channel reminders, if tied to settlement.

## Cut Or Demote

- Default user-facing agent theater in the web app.
- Parallel legacy skills that duplicate plugin v2 behavior without a compatibility plan.
- Long report surfaces that appear before the one-screen bearing.
- Decorative identity systems that do not improve the decision.
- Any integration copy that implies a full workflow before the workflow exists.

## Add

- Persisted `BearingLedger`.
- Settlement-by-reply for Telegram/email/Slack.
- Unified schema generation or schema contract between web and plugin.
- Decision replay view: initial bearing, sealed contract, updates, settlement, lesson.
- Metrics dashboard for seal rate, return rate, settlement completion, and calibration.
- "What changed since last time" panel based on settled decisions, not generic memory.

## Remediation Plan

### P0: Make The Spine Real

1. Add persisted `BearingLedger` to session/project storage.
2. Make `SealMoment`, `DecisionContractCard`, project due lists, and plugin ingest read/write that canonical bearing.
3. Feed settled records into new sessions as reference-only pattern data, wrapped and sanitized.
4. Remove or hide default machinery language from the main workspace.
5. Decide canonical CLI/plugin surface: plugin v2 wins; legacy `.agents/skills` becomes archived, compatibility-only, or renamed experimental.
6. Add settlement-by-reply for at least one channel before claiming cross-channel loop.
7. Keep `npm run lint` at 0 errors and set a warning reduction budget.

### P1: Reduce Ceremony And Improve Control

1. Stake/flat classifier controls depth: flat decisions skip crew/debate by default.
2. Current Bearing appears before long generated documents.
3. Every AI-surfaced predicate carries authorship and confidence/provenance.
4. Plugin and web share schema definitions or generate from one source.
5. Add explicit "draft now" and "go deeper" roads everywhere, consistently.

### P2: Turn Learning Into The Moat

1. Build decision replay.
2. Compute user calibration: assumptions that often fail, decisions that improve after dissent, domains with weak follow-through.
3. Add team/workspace decision memory, with strict privacy and prompt-injection boundaries.
4. Add outcome analytics for business users: decision velocity, return discipline, avoidable reversals.

## Business Read

Best buyer wedge: founders, operators, product leaders, consultants, and senior ICs who make ambiguous decisions and later need to defend or learn from them.

Weak wedge: generic document generation. That market is crowded and price-compressed.

Positioning should not be "AI agents help you think." It should be closer to:

> Argus turns uncertain decisions into sealed bets you can revisit, settle, and improve from.

The more Argus proves that loop, the more defensible it becomes.

## Design Direction

The UI should feel like a calm instrument:

- one clear bearing,
- one next action,
- visible uncertainty,
- quiet provenance,
- strong return cue.

Avoid:

- oversized agent panels,
- long ceremonial phases,
- fantasy team language as the default,
- novelty overlays in the main decision path,
- burying the check-in date below generated prose.

## Quality Work Completed During This Audit

Small repository repairs were made while auditing:

- Updated LLM validation tests to use the configured token cap instead of stale 4096 expectations.
- Updated falsification authorship expectation so verbatim AI sentence adoption remains `ai_surfaced`.
- Scoped ESLint away from generated design/plugin artifacts so app lint measures the app.
- Replaced remaining raw internal app anchors with Next/locale-aware links in touched surfaces.
- Fixed a memo dependency warning in `InnerMonologueCard`.

## Final Standard

Argus should be able to answer these five questions in every surface:

1. What are we deciding?
2. What are we assuming?
3. What would change our mind?
4. What did we commit to?
5. What happened when reality answered?

If a feature does not strengthen one of those five, it should be questioned.
