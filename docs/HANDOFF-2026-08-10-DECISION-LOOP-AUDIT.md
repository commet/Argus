# Argus Decision Loop Audit and Continuation Handoff

Date: 2026-08-10

Status: **Current diagnostic authority for the next implementation session**

Baseline: `main` at `f2666baf` (`제품 재정의: 결정을 현실까지 잇는 루프 (#365)`)

Scope: web app, local/remote MCP, Agent Plugin, semantic v3/v4, domain model, and cross-surface UX

Companion evidence: [Impeccable critique snapshot](../.impeccable/critique/2026-08-10T00-34-55Z__src-app-locale-workspace-page-tsx.md)

> This is a diagnostic handoff, not an accepted ADR. It separates observed facts, inferences, and
> proposals. Record hard-to-reverse choices in a new ADR when they are actually selected.

## 0. Executive verdict

The user's concern is valid. Argus is no longer merely a premise collector: it preserves judgment
statements, authorship, predicates, return conditions, observations, and append-only settlements. The
first-return protocol is genuinely stronger than the old premise-only experience.

However, the product is not yet decision-centric at its canonical seam. The most accurate description is:

> **A premise-aware judgment/prediction-and-return ledger presented through a decision-loop UX.**

The product promise is:

> **Decision → adopted Next Move → Reality → user-approved Lesson → better next judgment.**

The implemented durable spine is closer to:

> **Statement/predicate → premises → check date → observation/outcome.**

The landing now states the intended product better than the production model and active workflow can
consistently deliver it. The next breakthrough is a shared first-class representation for the user's
adopted decision state and Next Move—not more premise extraction, agents, documents, or visual polish.

## 1. Authorities and evidence discipline

Read these in order:

1. [`CONTEXT.md`](../CONTEXT.md) — canonical domain vocabulary; no implementation details belong there.
2. [`PRODUCT.md`](../PRODUCT.md) — product promise, constraints, evidence status, and surface roles.
3. [`DESIGN.md`](../DESIGN.md) — visual language and interaction commitments.
4. This handoff — observed gaps, affected seams, execution order, and completion criteria.
5. The Impeccable snapshot — full UI heuristic and detector evidence.
6. Existing DKK ADRs — historical constraints and rollout state.

Labels below:

- **Observed** — verified in source or a fresh browser run.
- **Inferred** — conclusion supported by multiple observed facts.
- **Proposed** — recommendation, not yet an architecture decision.
- **Unvalidated** — not supported by real-user evidence.

Do not silently turn an inference or proposal into a product claim.

## 2. Canonical domain contract

The root glossary already contains the right ubiquitous language:

- **Decision Case** — one user-owned decision and its complete append-only history.
- **Decision Loop** — the closed path through action, reality, and an earned next rule.
- **Baseline** — the user's own position before Argus contributes.
- **Next Move** — the action or intentional non-action the user explicitly adopts.
- **Decision Record** — user-adopted chronology with visible provenance.
- **Return Contract** — the approved event, signal, or date that makes return useful.
- **Observation** — what the user or a cited source reports happened.
- **Return** — reopening a Decision Case when reality can answer.
- **Lesson** — a revocable, user-approved rule carried into a future decision.
- **Active Portfolio** — moving, waiting, and due Decision Cases.
- **Surface** — web, MCP, or plugin projection of the same Decision Loop.

`Project`, `Session`, `Voyage`, `Document`, `Frame`, and `Dashboard` may describe implementation or
secondary artifacts. They must not replace the durable objects above in primary UX.

### Required invariants

1. An AI proposal never becomes a user decision before its exact wording is visible and explicitly adopted
   or edited.
2. A case may honestly end in `decide`, `test`, `research`, `defer`, `reframe`, or `stop`.
3. A Next Move is not an AI recommendation or generic task list; it is adopted action or intentional
   non-action.
4. First return records Observation before revealing or interpreting the old record.
5. Earlier statements never change; revisions, observations, resolutions, and Lessons append.
6. AI wording, user wording, system receipts, and sourced observations keep separate provenance.
7. No surface scores the person, invents a win rate, or presents a model verdict as reality.
8. Surface capability may differ; case meaning may not.
9. Local-only, disconnected, shadow, and unsynced states must be named honestly.
10. Structural conformance does not prove value. P5 remains HOLD until real evidence exists.

## 3. Current architecture

There is not yet one canonical Decision Loop core.

```text
                         PRODUCT / CONTEXT promise
              Decision → Next Move → Reality → Lesson
                                 │
       ┌─────────────────────────┼─────────────────────────┐
       ▼                         ▼                         ▼
Web DecisionContract     MCP v2 ContractEntry      Agent Plugin skill
mutable project JSON     local JSONL/remote tools  workflow/host package
       └──────── partial adapters and terminology ────────┘
                                 │
                                 ▼
              semantic v3 facade and v4 shadow model
              provenance-rich, not sole authority
```

### 3.1 Web production model

Primary type: `src/stores/types.ts:915` (`DecisionContract`).

It captures:

- `sealed_statement`, decision `kind`, and `origin_utterance`;
- predicates, confidence, provenance, attribution, decisive flags;
- review condition/status and optional return event;
- checkpoint and check-in interval/date;
- append-only settlements;
- judgment receipt, AI adoption lineage, revisions, open checks, ambiguity, and history.

It does **not** canonically capture:

- considered/rejected/chosen options;
- case state: decide/test/research/defer/reframe/stop;
- first-class adopted Next Move;
- owner and action deadline distinct from review date;
- observable success/stop signal tied to the move;
- first-class user-approved Lesson/next rule.

`DecisionContract` is semantically rich but shallow as a decision interface. Callers infer from many optional
fields whether they stored a decision, prediction, crux, or return promise.

### 3.2 MCP production model

Public tools: `argus-mcp/src/tools/public-tools.ts`.

- `argus_capture` records neutral decision text, stakes, reversibility, status quo, `already_decided`, and
  optional premises/open questions.
- `argus_predict` seals a falsifiable predicate and `check_by` date.
- `argus_resolve` records what happened and settles or defers the entry.

Durable fold: `argus-mcp/src/lib/ledger-replay.ts:24` (`ContractEntry`), centered on `text`, `predicate`,
`check_by`, `outcome`/`what_happened`, basis, predicate owner, premises, amendments, and deferrals.

**Observed conclusion:** MCP is a robust prediction/premise/return ledger, but cannot persist the plugin's
`Next move: [one action]` as a separate semantic object.

### 3.3 Agent Plugin

Observed version: `3.0.22`. Packaging, installation, lifecycle smoke, and Agent Plugins conformance passed in
the preceding implementation session.

The portable loop skill correctly says Decision, Next move, Reality, and Return. The mismatch is below the
package layer: it can render a Next Move that MCP cannot independently retain. Package conformance therefore
does not prove semantic parity.

### 3.4 Semantic v3/v4 and the kernel facade

`src/lib/decision-kernel.ts` re-exports the MCP v3 reducer, append guards, projections, schemas, and kind
derivation. It is a useful import seam but currently a shallow module: it does not hide the policies needed
to open, adopt, act, return, learn, and project a Decision Case. Policy leaks into web flows, MCP tools,
plugin instructions, and return UI.

V3 is provenance-aware but still statement/return centered. V4 adds `decision_opened`, assertions, evidence,
observations, `judgment_sealed`, and `return_promised`, with explicit authorial authorization. V4 remains
behind exact `ARGUS_SEMANTIC_V4_SHADOW=1` opt-in and is not production authority.

V4 is epistemically stronger but still lacks a clearly separate chosen option/adopted Next Move. A broad v4
migration now would move the product gap into a more rigorous event model rather than solve it.

### 3.5 Historical rollout constraint

The DKK P5 value gate remains **HOLD**:

- structural and synthetic checks passed;
- real v6 completed cycles: 0;
- matched baseline cycles: 0;
- no claim of validated user/return value is allowed.

Later ADRs permitted structural P6/P7 readiness work without turning HOLD into GO. Treat them as permission
for conformance work, not proof that surface convergence is complete.

## 4. Flow findings

### 4.1 Landing and idle Workspace — strong

**Observed.** These are the most successful reinvention surfaces. They communicate a stuck decision, one
intervention, an adopted move, waiting for reality, and returning for a better next call.

Strengths:

- one promise, one dominant input, one worked closed-loop example;
- calm, product-specific paper/ink/brass identity;
- strong hierarchy, focus, labels, loading feedback, and reduced-motion foundations;
- no framework literacy required.

The landing is not the problem. It exposes the mismatch by stating the intended product accurately.

### 4.2 Light path — explicit-adoption defect (P1)

Files:

- `src/lib/light-path/light-engine.ts:61-64`
- `src/lib/light-path/light-engine.ts:917-969`
- `src/components/workspace/light/LightFlow.tsx:210-250`

Observed sequence:

1. Model creates falsifiable `offer.sentence`.
2. Source marks it internal and not shown in the permission ask.
3. User permits Argus to ask later.
4. `acceptOffer()` creates a case via `buildLightSealContract(... edited: false)`.
5. Unseen sentence becomes `sealed_statement` with honest `ai_surfaced` attribution.
6. Exact sentence appears only after storage, where it may be edited.

Provenance is honest; authorization is semantically wrong. Reminder permission is not adoption of the exact
judgment or action. Required fix: show the proposal before persistence, label its origin, offer Adopt/Edit/Not
decided, and confirm return permission separately.

### 4.3 Heavy path — neutral crux can masquerade as the decision (P1)

Files:

- `src/lib/progressive-prompts.ts:740`
- `src/components/workspace/progressive/SealMoment.tsx:302-322`
- `src/components/workspace/progressive/SealMoment.tsx:455-529`

`decision_read` is deliberately a neutral question/condition: never imperative, pick, or verdict. That is
appropriate for a `crux`, but it pre-fills `humanJudgment` and can become the final predicate and
`sealed_statement` when untouched.

Required fix: separate `crux` and `adopted_judgment`; represent undecided cases through research/defer/reframe;
require an adopted Next Move for a moving case; keep document `next_steps` secondary until explicitly adopted.

### 4.4 First contribution — process before value (P1/P2)

Browser reproduction with `Should I schedule the team meeting for Tuesday or Wednesday?` showed:

- another baseline textarea;
- five preset dates, custom date, and Skip;
- `Progress 2/9: Initial view`;
- Frame/Writing/Check;
- document conversion and deeper-analysis actions;
- Voyage record and a right-side decision map.

The product answered a small decision with process and document production rather than a direct
decide/defer/test/stop transition.

Required fix: contribution before another question; one material intervention first; a default compact close
using Decide/Test/Research/Defer/Reframe/Stop; durable-record questions only at adoption; heavy mode only after
explicit deepen.

### 4.5 Return Protocol — strong ethics, incomplete payoff (P1)

File: `src/components/projects/FoundationSettlementModal.tsx`.

Strengths:

- first return starts at Observation;
- user states what happened before seeing the original;
- memory is optional;
- settlement appends rather than overwrites;
- source kind and authorization are retained.

Observed failure:

- the flow asks whether the user's standard changed;
- completion and record detail do not make that changed rule the payoff;
- Desk foregrounds premise/record metadata over the learned next rule;
- `Close practice and view record` returned to blank Workspace, not record detail.

Every return should end with:

```text
Original judgment → Reality observation → What changed
→ User-approved Lesson/next rule → Optional next Decision Case
```

This is the recommended first cross-surface vertical slice because it has clear inputs, append-only
invariants, strong existing behavior, and visible product value.

### 4.6 Populated Decision Desk — legacy dashboard beneath a new name (P1)

File: `src/app/[locale]/project/page.tsx`.

The empty state is strong. The populated state foregrounds `VoyageSea`, `JudgmentGraph`,
`JudgmentPatternsCard`, `ProjectAttentionList`, project summaries/exports, and legacy project/workspace terms.

Browser evidence showed conflicting totals together: `All 2`, `in progress 2`, `2 total`, and `3 decisions`.
The first viewport was dominated by the sea map while due returns, Next Moves, waiting signals, observations,
and Lessons were less prominent.

Required default IA:

1. **Move now** — adopted move not completed.
2. **Waiting for reality** — signal/date not due.
3. **Return now** — due or materially changed.
4. **What reality taught** — completed loops and adopted Lessons.

Map/graph/export may remain secondary. One projection must power every count and filter.

## 5. Is Argus just collecting premises?

No, but premise machinery dominates the semantic center.

| Capability | Current strength | Verdict |
|---|---:|---|
| Original utterance | Strong | Real |
| User/AI authorship separation | Strong | Real |
| Premises/open checks | Very strong | Dominant |
| Prediction/commitment/declaration/witness kind | Strong | Real |
| Check/return date | Strong | Real |
| Observation before reveal | Strong | Differentiating |
| Append-only settlement | Strong | Differentiating |
| Explicit chosen option | Weak/implicit | Gap |
| Adopted Next Move | Weak/prose-only | Critical gap |
| Decide/test/research/defer/reframe/stop | Not canonical | Critical gap |
| Owner/action deadline/signal | Missing or conflated | Gap |
| Durable user-approved Lesson | Asked in places, not payoff | Critical gap |
| Same semantic case across surfaces | Partial | Architecture gap |

Premises should become the evidence layer under a Decision Case, not the object every surface must pretend is
the decision.

## 6. UX/design audit

Two independent assessments converged. Assessment A reviewed without detector results. Assessment B ran the
detector exactly once and used a fresh browser tab.

### 6.1 Design Health Score

| Nielsen heuristic | Score | Main reason |
|---|---:|---|
| Visibility | 3/4 | Good loading/progress; conflicting Desk totals. |
| Real-world match | 2/4 | Decision language gives way to Project/Voyage/document concepts. |
| User control | 2/4 | Cancel/skip exist; return destination and reversibility are uneven. |
| Consistency | 2/4 | Landing, idle, heavy, and populated Desk express different products. |
| Error prevention | 3/4 | Preservation, provenance, and append-only return are thoughtful. |
| Recognition | 2/4 | Stage/branch/map machinery must be understood. |
| Efficiency | 2/4 | A trivial decision can enter nine visible steps. |
| Minimalism | 2/4 | Excellent landing; excess process chrome in active surfaces. |
| Recovery | 2/4 | Good retry; `View record` can go elsewhere. |
| Help | 3/4 | Guidance exists; map/route semantics are underexplained. |
| **Total** | **23/40** | **Acceptable; authored shell, unresolved loop coherence.** |

The visual system is highly specific: paper, ink, brass, editorial type, ledger proof, and the companion form
a memorable quiet decision desk. Behavior remains split with a legacy AI strategy consultant that gathers
premises and produces a memo.

### 6.2 Detector and accessibility

One exact static run across six TSX files found 263 primary issues, 0 advisory:

- `design-system-font-size`: 257
- `design-system-color`: 6

| File | Findings |
|---|---:|
| `src/app/[locale]/workspace/page.tsx` | 85 |
| `src/app/[locale]/project/page.tsx` | 46 |
| `src/components/landing/SirenHero.tsx` | 11 |
| `src/components/projects/FoundationSettlementModal.tsx` | 35 |
| `src/components/workspace/light/LightFlow.tsx` | 29 |
| `src/components/workspace/progressive/ProgressiveFlow.tsx` | 57 |

Some 12–16px hits are configuration noise because DESIGN.md prose permits ranges its machine frontmatter
does not declare. Genuine drift remains: 8px metadata, half-pixel sizes, small map labels, arbitrary values,
and six direct/undocumented colors. Align configuration first; do not mechanically rewrite 263 findings.

Accessibility foundations are good: skip links, headings, labels, focus, `aria-live`, dialogs, focus restore,
reduced motion, and mobile return sheet. Risks: 8px/dense metadata, map-dependent orientation, tiny labels,
landing chips under the 44px commitment, and decision content compressed by the decorative right rail.

## 7. Prioritized issue register

No P0 was observed; primary flows remained completable.

| ID | Priority | Issue | Proof of completion |
|---|---|---|---|
| DLP-1 | P1 | No canonical case state/Next Move | Same case round-trips web/MCP/plugin with state and move intact. |
| DLP-2 | P1 | Light stores unseen AI sentence | Exact text visible and adopted/edited before persistence. |
| DLP-3 | P1 | Heavy seals neutral crux as decision | Crux and adopted judgment separate; undecided stays undecided. |
| DLP-4 | P1 | Small decision enters nine-step flow | Flat case closes in ≤2 asks after first contribution; heavy is explicit. |
| DLP-5 | P1 | Return omits Lesson and CTA misroutes | Receipt shows full chain and links to exact record. |
| DLP-6 | P1 | Desk is map/project-first; totals conflict | One projection powers Move/Wait/Return/Learned and all counts. |
| DLP-7 | P2 | Baseline/date before contribution | First useful contribution precedes record setup. |
| DLP-8 | P2 | Typography/color drift | Scale config aligned; genuine 8px/direct-color issues removed. |
| DLP-9 | P2 | Legacy vocabulary in daily IA | Primary chrome uses Decide, Decisions, Record, Move, Return, Lesson. |
| DLP-10 | P2 | Active content compressed by chrome | Current decision/action retain width; map/log/history are disclosed. |

## 8. Proposed target architecture

This is a proposal, not an accepted ADR.

### 8.1 Deep module: `DecisionLoopCore`

Create one deep module whose small interface expresses product transitions and hides event construction,
legacy compatibility, provenance, validation, and projections.

Illustrative domain shape:

```ts
type DecisionState = 'decide' | 'test' | 'research' | 'defer' | 'reframe' | 'stop';

interface DecisionCase {
  id: string;
  question: string;
  baseline?: AuthoredText;
  crux?: AuthoredText;
  options: DecisionOption[];
  state?: DecisionState;
  adoptedJudgment?: AdoptedText;
  nextMove?: {
    action: string;
    owner?: string;
    actBy?: string;
    intentionalNonAction?: boolean;
  };
  returnContract?: {
    signal?: string;
    fallbackAt?: string;
    reviewQuestion: string;
    resolutionCriterion?: string;
  };
  observations: Observation[];
  lesson?: AdoptedText;
  chronology: DecisionEvent[];
}
```

Do not expose this whole shape as the write interface. Prefer a few deep transitions:

```ts
openCase(input, authority): Result
adoptState(caseId, adoption, authority): Result
promiseReturn(caseId, promise, authority): Result
recordObservation(caseId, observation, authority): Result
adoptLesson(caseId, lesson, authority): Result
projectPortfolio(asOf): PortfolioProjection
```

The implementation owns authorization/provenance, legal ordering, append-only batches, legacy translation,
observation-before-reveal, due/active projections, errors, and conformance fixtures.

Deletion test: removing `DecisionLoopCore` should cause meaningful policy to reappear across web, MCP,
plugin, and tests. If it only re-exports v3 reducers, it remains shallow.

### 8.2 Adapters and migration

- **Web adapter:** Light/Heavy adoption actions to core transitions and projections.
- **MCP adapter:** tool arguments and confirmation evidence to the same transitions.
- **Plugin adapter:** same state choices and portable record.
- **Legacy adapters:** read DecisionContract, MCP v2 JSONL, and v3 without rewriting history.
- **Persistence adapters:** local, Supabase, JSONL may differ physically; chronology/authority may not.

`method-harness` should test this interface as a conformance harness, never become a second runtime authority.

Do not big-bang rewrite v4. Characterize existing behavior, implement one vertical slice, dual-read/shadow-write
where needed, compare projections, move one caller at a time, preserve legacy records, and delete old paths
only after replacement tests pass.

## 9. Recommended execution sequence

### Stage A — Product-truth patches

1. Route `View record` to the exact Decision Record.
2. Unify Desk totals through one existing projection/source.
3. Show Light proposal before persistence; split adoption and reminder permission.
4. Add regression tests for all three.

### Stage B — Return Protocol vertical slice

1. Input: return contract, adopted judgment/move, new Observation.
2. Policy: observation before reveal, authority validation, append-only chronology.
3. Output: receipt with Observation, change, optional adopted Lesson.
4. Projection: exact record and Active Portfolio group.
5. Adapters: web first, MCP return/resolve, plugin wording.

### Stage C — Explicit state and Next Move

1. Separate crux, adopted judgment, and Next Move.
2. Add decide/test/research/defer/reframe/stop.
3. Add owner/action deadline/signal only when meaningful.
4. Preserve intentional non-action.
5. Translate legacy data without pretending unknown fields were known.

### Stage D — First-session simplification

1. One intervention before another question.
2. Compact close for flat cases.
3. Heavy mode only after explicit deepen.
4. Baseline/date at adoption time.
5. Decision state, not memo/export, as default reward.

### Stage E — Active Portfolio

1. Move/Wait/Return/Learned default groups.
2. Current decision, Next Move, and due return above history/maps.
3. One core projection for all counts.
4. Learned rule visible on returned cards.
5. Map/graph/export remain secondary.

### Stage F — MCP/plugin parity

1. Record state and Next Move independently in MCP.
2. Require same visible confirmation evidence as web.
3. Promise plugin semantics only after MCP preserves them.
4. Round-trip portable fixtures through every surface.
5. Keep host-specific extensions outside the core.

### Stage G — Semantic convergence

1. Decide v3 evolution vs v4 promotion in a new ADR after trade-off review.
2. Migrate one vertical slice at a time.
3. Deepen or replace `src/lib/decision-kernel.ts`.
4. Remove duplicate authorities only after replacement tests.
5. Re-run P5 only with matched real cycles.

### Stage H — Design-system convergence

1. Align DESIGN.md prose and machine typography scale.
2. Re-run detector once on narrowed surfaces.
3. Remove genuine 8px/half-pixel/direct-color violations.
4. Verify 44px targets and mobile hierarchy.
5. Repeat browser assessment after behavior/IA changes.

## 10. Acceptance/conformance suite

### Authorship and adoption

- Unseen AI text cannot become adopted state.
- `Accept reminder` cannot satisfy `Adopt judgment`.
- AI proposal, user edit, direct wording, and legacy import stay distinguishable.
- Missing legacy provenance remains unknown.

### Decision state

- Every explicit state round-trips without coercion.
- Neutral crux cannot project as chosen option without adoption.
- Intentional non-action is valid.
- Flat decision closes without heavy mode.

### Return

- First return observes before reveal.
- Later returns append.
- `Not yet` defers rather than settles.
- Receipt shows original → observation → change → Lesson.
- `View record` reaches the exact record.

### Portfolio

- Move/Wait/Return/Learned totals share one projection.
- Totals agree with mixed open, due, deferred, and settled cases.
- Mobile shows active/due work before map/history.
- Lesson is visible without opening premise details.

### Cross-surface parity

Replay one fixture per scenario through web, remote MCP, local JSONL, plugin record, and semantic projection.
Compare semantic output, preserving case identity, provenance, state, move, return trigger, chronology,
Observation, Lesson, and sync/disconnected state.

### Legacy safety

- Existing DecisionContract and MCP v2 records remain readable.
- Migration never fabricates options, moves, authority, or Lessons.
- Legacy records may remain unconverted.
- Shadow failure never breaks legacy success.

## 11. Real-user validation still required

Do not infer success from tests, plugin installation, landing polish, synthetic cases, internal dogfood without
a matched baseline, or the mere existence of return UI.

Minimum useful evidence:

- time to first material contribution;
- questions before adoption;
- states users actually choose;
- cases with explicit Next Move and observable signal;
- natural due-return completion;
- whether a return changes a later call;
- confirmation burden/abandonment;
- blinded reconstruction quality.

Keep P5 honest. Never enter guessed zeros for missing observations.

## 12. Open decisions

1. Preferred first contribution: reframe, trade-off, conditional recommendation, or smallest test?
2. Is Decision Case internal-only or partly user-facing?
3. Primary founder wedge state: decide, test, or research?
4. Are owner/action deadline required, optional, or commitment-only?
5. Is a Lesson requested after every return or only when the standard changed?
6. Evolve v3 or redesign/promote v4?
7. Which plugin functions remain Claude-specific?
8. When does the sea map earn default visibility?

Do not block Stage A on these questions. Resolve each when its slice reaches the seam.

## 13. Files to open first next session

Domain/product/evidence:

- `CONTEXT.md`
- `PRODUCT.md`
- `DESIGN.md`
- this handoff
- `.impeccable/critique/2026-08-10T00-34-55Z__src-app-locale-workspace-page-tsx.md`

Web:

- `src/stores/types.ts`
- `src/lib/light-path/light-engine.ts`
- `src/components/workspace/light/LightFlow.tsx`
- `src/lib/progressive-prompts.ts`
- `src/components/workspace/progressive/SealMoment.tsx`
- `src/components/projects/FoundationSettlementModal.tsx`
- `src/app/[locale]/workspace/page.tsx`
- `src/app/[locale]/project/page.tsx`

Core/MCP/plugin:

- `argus-mcp/src/tools/public-tools.ts`
- `argus-mcp/src/lib/ledger-replay.ts`
- `argus-mcp/src/v3/types.ts`
- `argus-mcp/src/v3/reducer.ts`
- `argus-mcp/src/v4/types.ts`
- `argus-mcp/src/v4/shadow.ts`
- `src/lib/decision-kernel.ts`
- `src/lib/semantic-web.ts`
- `argus-plugin-v2/skills/loop/SKILL.md`
- `method-harness/`

Constraints:

- `docs/DESIGN-decision-knowledge-kernel-v6-final-2026-07-14.md`
- `docs/ADR-2026-07-14-dkk-v6-p5-value-gate.md`
- `docs/ADR-2026-07-14-dkk-v6-continuation-after-p5-hold.md`
- `docs/ADR-2026-07-14-dkk-v6-p7-surface-convergence.md`

## 14. Continuation checklist

1. Pull `main`; confirm this handoff exists.
2. Read the five current authorities in section 1.
3. Inspect worktree; preserve unrelated user files.
4. Reproduce only the P1 being fixed; do not rerun full detector for a domain change.
5. Add characterization test before changing a legacy path.
6. Implement through a vertical slice/adapter, not parallel surface logic.
7. Verify wording, persistence, and provenance together.
8. Run narrow tests, then broader build/conformance proportional to risk.
9. Browser-check every web-visible change on desktop and mobile.
10. Update/supersede this handoff when recommendations become facts.

Suggested first task:

> Fix DLP-2 (Light explicit adoption) and DLP-5's record-route defect with characterization tests while
> defining the minimum `adoptState` seam needed for the Return Protocol slice. Do not add a second state
> machine or silently migrate legacy records.

## 15. Do not do these things

- Do not rename more Project strings while leaving the persisted model unchanged.
- Do not add optional fields independently to every surface without a shared transition interface.
- Do not big-bang migrate v2/v3/v4 before one slice proves the seam.
- Do not confuse `ai_surfaced` provenance with user adoption.
- Do not treat untouched `decision_read` as a decision.
- Do not make documents, exports, maps, agents, or premise reports the default reward.
- Do not infer and persist a Lesson without adoption.
- Do not turn `method-harness` into runtime authority.
- Do not claim semantic parity from package/install conformance.
- Do not claim P5 GO without matched real cycles.

## 16. Audit run record

Source review covered web contracts, Light/Heavy seal paths, return modal, populated Desk, MCP public tools,
local fold, plugin loop, v3 facade, v4 shadow, DKK ADRs, and root product/domain/design context.

Browser review covered `/en`, `/en/workspace?new=1`, a fresh small decision through progressive routing,
`/en/project`, settled detail/later-return, and `/ko/project`. The available record already had a settlement,
so first-return behavior was verified through source and the independent rehearsal. No account sign-in or
external user data was used. The critique-only server was stopped. No product code changed during the audit.

## 17. Final handoff verdict

Argus has the right concept and distinctive visual language. Preserve the landing, idle workspace,
provenance model, and observation-before-reveal protocol.

The durable semantic unit now needs to match the promise:

> **A user-owned Decision Case with an explicitly adopted state and Next Move, an honest Return Contract,
> reality recorded before reinterpretation, and a user-approved Lesson that improves the next call.**

Until web, MCP, and plugin share that unit, Argus will remain excellent at the front door and fragmented in
sustained use.
