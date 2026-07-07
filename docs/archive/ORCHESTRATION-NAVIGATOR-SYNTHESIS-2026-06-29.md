# Orchestration fix — neutral navigator synthesizer + spine-bound synthesis

**Date:** 2026-06-29
**Trigger:** A launch-timing/strategy decision rendered a synthesis card authored by
the **UX lead (지은/Maya)** that exposed internal machinery ("두 에이전트 모두…"),
manufactured an amber "미해결 쟁점" warning, and issued a verdict. Founder flagged it
as both wrong content and a spine violation.

## Root cause (two layers, verified in code)

1. **Brittle lead-pick signal.** `orchestrator-classify.ts` ranks 12 domains by raw
   keyword **count**. "사용자/user" is a UX keyword and appears in almost any product
   text, so a strategy decision ranked `ux` first → `domains[0]='ux'`. The textbook
   keyword false-positive ("I implemented a policy at work" → code agent).
2. **Wrong synthesizer seat + wrong contract.** `lead-agent.ts selectLeadAgent` mapped
   `domains[0]` → a **domain specialist** (ux→지은) as the lead that **synthesizes and
   speaks to the user**. The synthesis prompt ordered *"make a judgment call"* and
   *"State your recommendation direction clearly"* and emitted `recommendation_direction`
   (verdict) + `unresolved_tensions` (manufactured warnings) + agent-referential prose.
   All three are rendered to the user (`ProgressiveFlow.tsx LeadSynthesisCard`) **and**
   fed into the final deliverable (`progressive-prompts.ts buildMixPrompt`).

Note: **worker** routing (`orchestrator-select.ts`, a 3-layer capability scorer with
lens diversity) and the stakes-gated `agentCount` restraint are **sound** — the keyword
counter only drives stakes/agentCount and the single `domains[0]` value.

## What the references say (benchmark, 2026-06-29)

- **Anthropic (Building Effective Agents / multi-agent research):** the lead is a
  **generalist** (Opus lead over Sonnet workers); deterministic routing is sanctioned
  *only* "where classification can be handled accurately"; synthesis combines findings
  into one answer; a judging-LLM is gated to evaluator-optimizer with clear criteria,
  not a per-run default.
- **Mixture-of-Agents (ICLR'25):** a strong **domain proposer is often a poor
  aggregator** — aggregation is its own skill; the aggregator *refines*, never adjudicates.
- **revfactory/harness:** router accuracy is THE single point of failure; "explain the
  principle, don't hardcode narrow rules"; on conflict **"병기, 삭제하지 않음"** (attribute
  and present both, never resolve to a verdict); **hide internal machinery from the user
  surface.**
- **Production frameworks (OpenAI Agents SDK / LangGraph / CrewAI / AutoGen / semantic
  routers):** keyword routing is the weakest tier; LLM/semantic selection over capability
  descriptions is the norm; exposed inter-agent disagreement is leakage to suppress.

Adversarial pass corrected the synthesis's overclaims: keyword routing is a reasonable
cheap default whose *only* real defect is ambient-term over-weighting; the keystone is the
synthesis **contract**, not the routing mechanism. No embeddings needed.

## Decision (preserve strengths, fix the narrow defects)

1. **Synthesizer = neutral navigator (항해장) always.** The `navigator` persona already
   existed (lens `conductor`, "종합 검토자") but was never selected. `selectLeadAgent` now
   seats it unconditionally; `domains[0]` is carried **only as a focus lens** for the
   synthesis directive. Domain depth stays in the workers (unchanged). This also decouples
   the user-facing voice from the brittle keyword signal.
2. **Spine-bound synthesis contract.** `LeadSynthesisResult` drops `recommendation_direction`
   + `unresolved_tensions`; replaced by a single gated `open_question` (at most one neutral
   crux, `''` when flat — fire-or-not gate). Prompt forbids verdicts, disclaimed leans,
   manufactured tensions, and any reference to the team/process.
3. **De-machinery the render + deliverable.** Card drops the amber warning block and the
   verdict blockquote; shows a neutral "남은 질문 하나" only when non-empty. Mix prompt drops
   "preserve the lead's recommendations / you format, they strategize" and the
   tension-derived risk framing; risks come from actual evidence; one continuous editorial
   voice with no process references.
4. **Ambient-keyword de-weight.** `extractDomains` weights `사용자/user/데이터/data/현황` at
   0.3 so they no longer hijack `domains[0]`.

**Untouched (strengths kept):** worker capability scorer, lens diversity, stakes-gated
agentCount, lead activation gate (stakes≥important AND agentCount≥2), determinism.

## Files
`orchestrator-classify.ts` (de-weight) · `lead-agent.ts` (navigator seat + contract) ·
`stores/types.ts` (`open_question`) · `progressive-engine.ts` (parse) ·
`ProgressiveFlow.tsx` (render) · `progressive-prompts.ts` (mix) ·
`useProgressiveStore.ts` (call site).

Verified: `tsc --noEmit` clean; vitest 1551/1551. Old stored sessions degrade gracefully
(missing `open_question` → not rendered).
