# Argus — TARGET-STATE VISION (Design Half of PLAN.md)

> *"실행 비용이 0에 가까워질수록, 실행 이전의 판단의 가치는 올라간다."*

This is the **should-be**, not the diagnosis. The two diagnostic workflows find what is wrong; this document defines the single coherent product those fixes converge toward. Every proposal below is read-only design-on-paper, buildable on the current stack (Next.js 16 / TS / Tailwind v4 / Zustand / Supabase), and faithful to the voyage DNA. Nothing here reinvents — it extends what already ships.

---

## 1. North-star

When this is done, Argus feels like **one continuous voyage that you can see thinking with you** — not five screens, but four ceremonially-separated legs of a single journey wrapped in the light of a dawn harbour. A brand-new strategist lands not on a blank box but on a *live reframe being performed in front of them* — they watch the harness turn "분석해줘" into "이게 진짜 풀어야 할 문제였구나" before they touch a key, then step into their own first run while that same light still glows. Through every leg, the product proves the one thing ChatGPT cannot: it visibly **carries your judgment forward** — the hidden assumption you flagged in 항로 재설정 reappears, by name, as a key assumption in 선원 배치, gets attacked in 리허설, and is resolved in 항로 수정, each link drawn as a quiet gold thread you can follow. At 이타카, the four outputs are not throwaway markdown but a **ship's log where every line traces back to the voyage moment that produced it** — a document worth keeping. And after enough voyages, the Logbook quietly reflects your own changing eye back at you ("첫 항해 땐 AI 답의 67%를 받아들였는데, 이제 절반을 다시 잡습니다"). The throughline is a single sentence made literal across all five surfaces: **Argus shows its reasoning genealogy, and yours.** That genealogy — the typed context chain made visible as warm serif marginalia and gold threads — is simultaneously the onboarding's proof, the core flow's calm, the output's differentiation, and the retention moat. Same data, same gold thread, same dawn light, everywhere.

---

## 2. The five surfaces, integrated

### Onboarding — Live Reframe Walkthrough, wrapped in Departure light · effort **M**
A first-time user (`projects.length === 0`, no `?q=`/`?demo=`, no `argus.has_onboarded`) auto-sees the **already-shipping `InteractiveDemo`** — the scripted typing→team→analysis→reframe walkthrough — instead of the bare `HeroFlow` idle screen, wrapped in the §6 dawn-harbour canvas (concert-hall + warm-vignette gradients, Graticule at 0.08, a top-center gold radial glow). One net-new beat — a **side-by-side "입력한 문제 → 팀이 다시 정의한 문제" contrast card** — manufactures Moment #1 without a keystroke, with the contradicting assumption pulsing gold once. The gate lives in `WorkspaceContent`'s `if (!currentProjectId)` branch (`workspace/page.tsx:690`), not inside HeroFlow's timed state machine.
- **Single most important move:** Reuse `InteractiveDemo.tsx` + `demo-data.ts` as the first-run experience (do **not** build a new `FirstVoyageWalkthrough.tsx`) — ~80% already ships, including the `onStartReal` handoff that pre-fills + focuses the real textarea (`page.tsx:272-286`).
- **Reinforces:** It is the first appearance of the gold context thread (§2.2 moat) and the dawn-harbour design tokens — onboarding *is* a guided tour of the design system and the core-flow ceremony, so the user already recognizes both when they reach their own voyage.

### Core flow — Focused-Linear re-skin of ProgressiveFlow · effort **L**
The voyage becomes four calm centered legs (`max-w-2xl`, one guiding question at center, per §3.1), each bracketed by a step-exit **`AnchoringMoment`** modal (the §3.2 transition copy + a one-line carry-forward summary) and step-entry context narration. Critically this is an **incremental re-skin** of the existing 2,670-line `ProgressiveFlow.tsx` via additive `LegCanvas` / `AnchoringMoment` / `VoyageGuide` / `ConvergenceRose` presentational components reusing the existing `phaseIdx()` logic — **not** a from-scratch carousel rewrite that would regress lateral-jump and break the 1004-test baseline. The Logbook rail is re-framed as the persistent **VoyageGuide** (original problem + current leg purpose + collapsed prior-leg summaries).
- **Single most important move:** Make the §2.2 moat visible three cheap ways on existing primitives — inline provenance tags ("← 항로 재설정에서"), a toggleable **gold dashed ancestry thread inside the existing declarative `BranchMap`** (reusing `edgePath()` + `getActivePath` lineage, ~15 lines, no new renderer, no `branch_id`), and assumption verification as a first-class ✓/미검증 toggle in the Logbook drill-down.
- **Reinforces:** The AnchoringMoment ritual reuses the same serif/gold/spring language the onboarding established; the assumption-verification toggle is the data source the retention surface reflects back; the convergence compass and ship's-log waypoints feed directly into the 이타카 outputs.

### Outputs — Attributable Ithaca · effort **L**
The four outputs become a single ship's-log decision record where **every line carries a "왜?" provenance anchor** tracing decompose→recast→rehearse→refine, rendered as warm serif marginalia (gold dotted underlines, a slow-spring annotation panel) — never a cold node graph on the strategist's surface. The Brief is restructured into four acts (⚓ 출항 → ⚠ 암초 → ↻ 침로 수정 → ⚑ 이타카), built on the existing `lib/export.ts` `voyageLogToMarkdown` spine. The Agent Spec is the **one and only** sanctioned bridge down to execution tooling (CrewAI YAML + a new LangGraph JSON variant); live execution consoles, run-in-Claude buttons, and Supabase execution tables are explicitly rejected — Argus stays the judgment layer *above* execution (§7).
- **Single most important move:** Replace the fragile substring assumption-linker (`step.task.includes(a.assumption.substring(0,8))` in `agent-spec.ts:104` and `prompt-chain.ts:150-153`) with **stable assumption IDs** threaded through the typed context chain. Provenance is only trustworthy if the links are real — a wrong arrow lies to the strategist.
- **Reinforces:** This is the payoff of the core-flow's visible context chain — the same gold-thread genealogy the user watched accumulate now ships as the artifact's headline feature, and the §10 Moment #5 ("이 과정 자체가 더 가치 있었네") becomes literal. It is also the differentiator against "just ask ChatGPT," which also emits markdown but cannot show its own reasoning genealogy.

### Design system — Editorial Print "Logbook" system · effort **M**
A small **additive** token layer (8pt spacing scale, refined letter-spacing, a `--brass-shine` 1px inner-highlight, a `--logbook-texture`, a *scoped* deliberate-motion class) plus one fully-specified reference primitive — **`LogbookCard`** — that reads instantly as "a page from a captain's logbook" with zero nautical learning required. The semantic role/risk tokens (`--ai`/`--human`/`--collab`, `--risk-critical`/`manageable`/`unspoken`) are **kept and desaturated** to hairline left-borders, never deleted (they carry the §2 AI-vs-human thesis and §6.1 risk triad). The global 200ms input transition is left untouched; the slow 0.5s "deliberate" reveal is scoped to a `.logbook-reveal` class so forms stay responsive.
- **Single most important move:** Ship `LogbookCard` (mirroring the existing `Card.tsx` forwardRef + variant-map API) with a gold left-border, serif display title, Graticule texture, and the §3.2 **gold context-thread** that visually connects a `variant="note"` source card to a `variant="decision"` target card.
- **Reinforces:** This primitive is the shared atom every other surface renders into — the onboarding contrast card, the core-flow LegCanvas, the output ProvenanceNote, and the retention reflection sections all *are* LogbookCards. One component unifies the visual language so the five surfaces are physically the same product.

### Retention — 항해일지: 나의 항로 감각 · effort **M**
Promote the **already-shipping** read-only judgment layer (`navigator.ts` / `NavigatorStrip` / `judgment-vitality` / `getUserPatterns` / `getPersonaAccuracySummary`) from a generic insight strip into a calm, provenance-linked **first-mate reflection tab inside the existing Logbook aside** — not a new always-on analytics dashboard. Four sections (항로를 읽는 눈의 변화 / 자주 잡는 키 / 덜 살펴본 수평선 / 검증한 판단의 결과), each in quiet serif prose with at most one gold sparkline, each with a "어디서 나온 관찰인가요 →" disclosure that jumps back to the exact source voyage via the existing `buildProvenanceChain`. Peer leaderboards, new Supabase tables, and the emoji-chip alert grid are explicitly cut.
- **Single most important move:** Add the **post-output outcome-calibration loop** ("리허설에서 짚은 위험이 실제로 일어났나요? [일어남][피함][일부]"), persisted via the existing `useAccuracyStore.addRating` — the one missing data source that makes "직접 키를 잡았을 때 옳았던 적 78%" statistically honest rather than self-reported.
- **Reinforces:** The moat the core-flow makes *visible* (the context chain) and the outputs make *durable* (attribution), retention makes *cumulative* — your accumulating judgment, traced via the same `buildProvenanceChain` and rendered in the same `LogbookCard` language, is why you return a 5th time instead of opening ChatGPT.

**How they lock together:** the typed context chain (ROADMAP Phase 0) is the single spine. Onboarding *previews* it, the core flow *accumulates and reveals* it, outputs *attribute against* it, retention *reflects* it — and `LogbookCard` + the dawn-harbour tokens render all four in one visual language.

---

## 3. Design system spine (shared by all surfaces)

All five surfaces draw from one token set already in `globals.css`, extended additively. No surface introduces a private palette, font, or motion curve.

**Color** (existing, never tech-blue / purple-chrome / red-status):
| Token | Light | Role |
|---|---|---|
| `--bg` | `#f8f7f5` warm ivory | page (first-run surface deepens to dawn gradients) |
| `--surface` | `#ffffff` | card / LogbookCard ground |
| `--text-primary` | `#1a1a1a` deep charcoal | body + reframe leg accent |
| `--accent` / `--accent-light` | `#96782e` / `#b8963e` gold | the one emphatic affordance: thread, provenance "왜?", primary CTA, sparkline |
| `--brass-shine` (NEW) | `#c4a862` | 1px inner-highlight only, never a fill |
| risk triad | `#E24B4A` / `#EF9F27` / `#7F77DD` | 🔴/🟡/🟣 — inside rehearse chips only, never chrome |
| `--ai`/`--human`/`--collab` | kept, desaturated to `--edge-*` hairline borders | the AI-vs-human thesis |

**Type** (existing `--font-display: 'Noto Serif KR'`): serif for leg titles / act headings / `LogbookCard` titles (the "logbook" feel); readable sans body at `line-height 1.7`, `--measure-normal: 65ch`; **mono for all numbers** (DQ %, convergence score, counts). Labels: uppercase `--letter-space-label: 0.08em`.

**Spacing** (NEW 8pt scale shared everywhere): `--space-xs 4 / sm 8 / md 16 / lg 24 / xl 32 / 2xl 40 / 3xl 48`. No orphaned px margins. Radii from existing `--radius-md: 12px` (not legacy `rounded-2xl`). Default `--shadow-sm`; `--shadow-md` reserved for primary-CTA hover.

**Motion** — reconcile the **one real inconsistency in the codebase** so every surface matches:
- CSS reveals/keyframes use `--ease-spring: cubic-bezier(0.16, 1, 0.3, 1)` (the §6 doc value) — used for `.logbook-reveal`, sparkline grow, AnchoringMoment fade.
- **JS/Framer-Motion** must import `EASE`/`SPRING` from `progressive/shared/constants.ts` — the real shipped value is **`EASE = [0.32, 0.72, 0, 1]`** (= `--ease-wave`), **not** the bezier cited in the philosophy doc. All four recommendation specs initially hardcoded the wrong curve; every surface's Framer code imports the constant instead.
- All new motion routes through the existing `@media (prefers-reduced-motion: reduce)` block. The global 200ms `button/a/input/textarea` transition is never touched.

**Texture:** `VoyageElements` `Graticule` at 0.02–0.03 on idle/workspace, 0.08 on the first-run onboarding surface only. Nautical glyphs ⚓↻⚠⚑ (the existing `WP_META` set) are the only decorative marks; actor emoji 🤖/🧠/🤝 are replaced by serif "AI · 사람 · 협업" in gold small-caps.

---

## 4. Build mapping (respects foundation dependencies)

Two foundation items from the diagnostic/improvement plan gate this vision; the order below slots into them rather than competing.

**Foundation A — ROADMAP Phase 0 (typed context pipeline / `ContextChain._source`).** Clean source for provenance tags, attribution, and the stable assumption IDs. Until it lands, surfaces fall back to leg-name labels — not blocked, but improved when it ships.
**Foundation B — ProgressiveFlow decomposition (the 2,670-line monolith).** Gates anything that adds surface area inside that file (visible context chip, StepNav swap, cross-card thread, outcome-prompt hook).

```
Wave 0 — Ship now, zero foundation dependency (additive, no monolith touch):
  • DESIGN SYSTEM: token layer + LogbookCard + one Card variant line   [M]  ← unblocks everyone
  • ONBOARDING core: gate + auto-launch InteractiveDemo + dawn wrapper + departing seam   [M]
  • RETENTION core: route-sense.ts compositor + Logbook reflection tab + provenance links   [M, read-only]
  • CORE-FLOW pure-additive pieces: AnchoringMoment + VoyageGuide rail (today's flow)   [part of L]

Wave 1 — After / alongside Phase 0 typed pipeline:
  • OUTPUTS §0 prerequisite: stable assumption IDs + delete substring linker   [own small PR]
  • OUTPUTS: IthacaContext + AttributedField generators → BriefShipLog + ProvenanceNote   [L]
  • ONBOARDING contrast beat (benefits from typed contradictsInput? index)   [fast-follow]
  • DESIGN SYSTEM: data-bound `decision` variant gauge wired to real assumption confidence
  • RETENTION: Related Voyages + assumption-precedent badge (findSimilarItems / buildProvenanceChain)

Wave 2 — After ProgressiveFlow decomposition (Foundation B):
  • CORE-FLOW: LegCanvas re-skin + ancestry thread + ConvergenceRose + Delivery Hall   [rest of L]
  • DESIGN SYSTEM: StepNav swap + cross-card gold thread (each step owns its LogbookCard)
  • CORE-FLOW: visible "Journey So Far" context chip (avoids re-touching the monolith)
  • RETENTION: outcome-calibration loop hook (lands after §3.4 reflection step settles)

Field-add discipline (per CLAUDE.md "Adding a New Field"): the new typed fields
(snapshot.assumption_verified[], HiddenAssumption.id, RecastStep.validates_assumption_ids,
ProgressiveSession.is_template) each require: type def → store creator → defaults →
Supabase migration → every prompt that reads it → UI → handoff fns.
```

The cheapest, highest-feel value (design tokens, the auto-demo, the reflection tab) lands in Wave 0 with no dependency on either foundation; the deeper structural payoff rides the same Phase 0 + decomposition work the diagnostic plan already schedules. **All 1004 tests stay green at every wave** — additive components, appended tokens, re-skin not rewrite.

---

## 5. What we are deliberately NOT doing

For a "go slowly, do it right" owner, the scope discipline is as load-bearing as the build:

- **No new onboarding component.** No `FirstVoyageWalkthrough.tsx` + `demo-worked-example.ts` — that duplicates `InteractiveDemo` + `demo-data` and violates CLAUDE.md single-source-of-truth. Reuse, don't rebuild.
- **No 5-step tutorial as the first screen.** The Guided-Interview entry gate (mandatory Q4) contradicts §3.1 "minimize distance to first action" and bleeds first-run completion. Its visible context chip is grafted *downstream* onto the real run, never as a gate.
- **No ProgressiveFlow from-scratch rewrite.** Re-skin the existing component; a carousel rewrite regresses lateral-jump + inline outputs and breaks the test suite.
- **No imperative pan/zoom voyage-chart renderer, no 3-column atlas.** The declarative `BranchMap` gets one ~15-line ancestry overlay; `branch_id` deliberately stays unstored.
- **No execution layer.** No live execution console, no run-in-Claude buttons, no `useExecutionStore`, no `execution_logs`/`checklist_states` Supabase tables, no six-tool intent sniffing, no cursor rules / curl snippets. Abort/contingency is **static readable text** inside the Agent Spec, honoring "hear but don't leap." Argus stays above execution (§7).
- **No cold node-graph on any strategist-facing surface.** The only graph-shaped output (LangGraph JSON) lives behind the Agent Spec's developer tab. Provenance is warm serif marginalia, not a DAG.
- **No deletion of semantic tokens.** `--ai`/`--human`/`--collab`/risk triad are desaturated, not removed — they are the headline §2/§6 moments.
- **No global motion regression.** The 200ms input transition is untouched; deliberate motion is scoped to `.logbook-reveal`. No hardcoded `cubic-bezier(0.16,1,0.3,1)` in JS — import `EASE` from `shared/constants`.
- **No html2canvas / PNG export in the default path** (uninstalled dep; can't rasterize `var(--…)` SVG fills). Deferred behind a flag with an SVG-serialize fallback.
- **No peer comparison, leaderboards, percentile scoreboards, shared-URI, or new analytics tables in retention.** Off-DNA SaaS-dashboard texture that inverts the introspective "*your* ledger" thesis. Team/network surfaces are explicitly deferred to Phase 6.
- **No `useMirrorStore` / `personal_patterns` / `assumption_library` tables.** All retention insight is derivable read-only from already-shipping functions in a `useMemo`; persisting it invites staleness.
- **No Smart-Defaults session-seeding** (gated on 5+ voyages — zero value on the visits that decide retention). Save-as-Template ships; the expensive reducer-seeding half is deferred.

*This is the design half of `docs/PLAN.md`. It is a living document; it updates as the product sails.*
