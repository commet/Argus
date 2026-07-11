# Agent Architecture — Foundational Assessment & Redesign

**Status:** Foundational (first-principles) review, synthesizing 5 parallel deep audits.
**Date:** 2026-07-05
**Supersedes scope of:** `internal design notes` (that doc fixed assignment+dependency; this one re-examines the whole architecture and re-frames those Layers within it).
**Method:** 5 agents each interrogated one foundation — primitive · coordination · spine coherence · judgment binding · data contracts — grounded in `file:line`, told to question whether each thing should exist at all.

---

## 0. The convergent diagnosis (all 5 agreed)

**The engine and the spine are sound. Do NOT rewrite.** Every reviewer independently concluded the core is salvageable and much of it is genuinely good (deterministic capability router, no-recommendation output contract, honest seal/flinch loop, defensive reads). The problems are **structural under-expression and one deep hole**, not brokenness.

Four structural gaps, and they cluster in ONE place:

```
  FRONT (strong)            MIDDLE (weak — every review pointed here)         BACK (strong)
  analysis → Q&A → fork  →  crew assign → parallel run → mix/synthesis     →  flinch → seal → settle
   judgment shapes it         judgment is thin / lossy / laundered              judgment binds honestly
```

The **crew→mix middle** is where all four gaps live:
1. **Primitive inverted** (review 1): "agent = fixed persona name" is upside-down — the capability-spec + skill-set is the real unit; the name is a ~3-line hat. A bounded 17-persona roster force-fits any out-of-roster decision (the Claire→도윤 miss is *designed-in*, not a bug). XP still leaks +0.10 into routing though declared cosmetic.
2. **Shape under-expressed** (review 2): one real router + one *vestigial keyword shadow* (`assignAgentToTask`) + one handoff. The 2-stage model (parallel + 1 critic) is an artificial ceiling the code openly admits; the engine already runs an arbitrary DAG but the plan can't declare one (no `depends_on` field on the emitted step). The blind-parallel crew then needs **four end-of-pipeline reconciliation passes** (lead synth + navigator + debate + mix) to glue together what should have been sequenced.
3. **Contracts untyped** (review 4): stage boundaries are hand-maintained *prose projections* (4 of them). "Generate-but-drop" is the **default behavior**, not a set of bugs — TS sees `string` out, can't flag a forgotten field. Storage is guarded (Persistence Declaration); *consumption* is not.
4. **Judgment thin in the middle** (review 5): the front (Q&A/fork) and back (flinch/seal) are load-bearing; the crew→mix synthesis is where the user's judgment goes cosmetic.

---

## 1. The single deepest root (reviews 4 AND 5 converge — fix this first)

**The user's own decisions do not reach the outcome AS THE USER'S.** This is simultaneously a correctness bug, a spine violation, and the mirror-thesis breaking at exactly the rung that matters (the outcome).

Evidence, stacked:
- `self`-worker `human_input` enters the mix as **one undifferentiated `[task]\nresult` evidence bullet** among AI worker results — not privileged, not labeled "the user's own call" (`useProgressiveStore.ts:1268`, `progressive-prompts.ts:551`).
- The first-class fields for this — `user_decision` / `user_ai_guide` (`types.ts:135-136`) — are wired **only into the legacy `WorkflowGraph`**, 0% into the progressive mix. *(This is precisely the `recast-execution-design-needs-redesign` memory — still unfixed in the go-forward path.)*
- `decision_line` (the fork commitment the user picked) reaches the mix *prose* (recent `formatSnapshot` fix) but **cannot reach the sealed `DecisionContract`** — `extractPredicatesFromSession` never receives the snapshot (`decision-contract.ts:205-219`). If it survives at all, the mix echoes it into `key_assumptions` where it is stamped **`authored: 'ai_surfaced'`** (`:269`) — **the user's own committed decision, laundered as machine-authored.** That is a direct CLAUDE.md Rule-1 (honest authorship) violation, latent in the calibration record.
- A `blocked` human-gated task (Layer-0) honestly contributes nothing, but `crewSettled` proceeds to draft and **the loss is never surfaced** to the user (`ProgressiveFlow.tsx:1444`).

**Why this is THE root:** Argus's whole thesis is *mirror, not oracle — grow the user's judgment, never decide for them, never lie about authorship.* The architecture honors this at the front and back, then at the synthesis step treats the user's own calls as just more AI-generated material. The moat rung — "the outcome is bound to the human's judgment, provably" — is the one that's broken.

---

## 2. What is already sound — PRESERVE (union of all 5 reviews)

- **No-recommendation output contract** across lead/mix/navigator; no `recommendation`/`verdict` field anywhere. The spine's structural anchor.
- **SealMoment as a pure mirror** — no evaluation; user's own `human_judgment` preferred; AI fallback honestly `ai_surfaced`-labeled; flat-decision restraint gate.
- **flinch → `real_bet` → sealed predicate** with honest `user`/`ai_surfaced` provenance and the "not counted as my bet" skip. Exemplary.
- **strategic_fork precedence over LLM reinterpretation** — the user's pick genuinely wins the snapshot.
- **Deterministic, LLM-free capability router** (`selectAgents`) + anti-pattern hard-penalty + one-lens-per-lens diversity + hit-rate calibration.
- **The skill sets** (`agent-skills-data.ts`) — frameworks/checkpoints — the real analytical product value.
- **Layer-0 dependency ready-gate** (this session) — refusing to run on missing human input rather than fabricating.
- **`aggregateResults` / mix merge** — verified good live (규민's numbers survive intact).
- **STEP-0 classifier** (CRISIS/VENT/VALIDATION/FLAT gates) — the best embodiment of the don't-over-fire mirror clause.
- **`self_scope` injection into the worker prompt + `setGroupTrack` ai_scope-clearing** (this session) — the ownership split is real to the AI at the point of work.
- **Compile-time completeness guards + defensive reads.**

---

## 3. Foundational redesign (ship order; folds in the old Layers)

Priority is by **root-depth × spine-weight × safety**, not by which is flashiest.

### F1 — Bind the user's own judgment to the outcome (THE root; §1). Highest priority.
- Wire `self`-worker `human_input` + `user_decision`/`user_ai_guide` + `decision_line` into `buildMixPrompt` as a **distinct, authoritative block** — *"The user's own calls — bind the document to these; never override or bury,"* not a peer evidence bullet.
- Make the snapshot (a typed `UserAuthoredJudgment { decision_line, next_three_days, weakest_assumption }`, each `authored:'user'`) a first-class input to `extractPredicatesFromSession`; prepend `decision_line` as a `source:'user_lean' / authored:'user'` predicate so it lands in the sealed contract **as the user's**, never `ai_surfaced`.
- Surface a `blocked` human-gated task at mix ("drafting without X's input — section provisional"), don't silently absorb.
- **Spine + correctness in one. Mostly additive (prompt block + one input wire + one predicate). Verify: a fork-decision run seals with `authored:'user'`.**

### F2 — Contract integrity: type the verbs, not just the nouns (§ review 4).
- Replace the 4 hand-maintained prose projections with a typed context-assembly per boundary + a **consumption guard**: a test reflecting over the producer type's keys asserting each is either consumed or in an explicit `INTENTIONALLY_DROPPED` set (mirror `persistence-contract.test.ts`, applied to consumption). Generalize the reactive `snapshot-wiring.test.ts` into it.
- **This is what stops "generate-but-drop" from recurring — the structural guarantee. Enables F1 to stay wired.**

### F3 — Collapse to one routing authority + fix the inverted primitive (§ reviews 1+2). = old Layers 1+2, reframed.
- Make `selectAgents` **total** (always return a best agent + honest confidence) → the keyword shadow `assignAgentToTask` becomes dead code → delete it (old Layer 1).
- Honest `assignment_reason` from the **winner's own capability profile**, near-tie disclosed (old Layer 2).
- **Reframe (from review 1):** treat the capability-spec as the primitive and the persona as its rendering; add a **low-confidence escape hatch** — when the top capability score is below a floor, generate a per-decision role-spec instead of force-fitting (closes the out-of-roster silent-collapse). **Sever XP from routing** (delete the `+0.10` level boost at `orchestrator-select.ts:59-60` and the dead `activities` branch).

### F4 — Let the plan express a DAG (§ review 2). = the shape ceiling.
- Add `depends_on: number[]` to the emitted `execution_plan` step (the LLM that knows the dependency should declare it). Let `buildStages` emit an N-stage DAG via topological layering — **`runPipeline` already executes it** (Layer-0 rides on top). Add `sequential` to the pattern enum the code already reserved. Reject cycles as an invalid plan.
- **Removes most of the reason the four end-of-pipeline reconciliation passes exist** (sequenced lenses read each other's real output instead of the mix reconciling blind-parallel contradictions).
- **Raise the crew-deploy bar** (review 2/5): default routine/simple decisions to the `single` strong-reasoner path; reserve parallel crews for 3+ independent lenses or critical/irreversible.

### F5 — Spine polish (§ review 3).
- **LeadSynthesisCard**: demote `규민` from *author of a synthesis* to a quiet coverage signal (or drop) — match the "surface work, not a character" rule the team already wrote in `MixPreview.tsx:120`. (CrewAtWork's named avatars = honest multi-lens coverage; keep.)
- **Render the asymptote disclosure** CLAUDE.md:67-68 mandates ("we surface the one question, and name the faint lean as a known limit") — currently obeyed in prompts but stated on no user surface.
- **Watch/re-scope `strategic_fork`**: it is the one place the *form* is a directional-commitment fork (with a plan-reshaping `snapshotPatch`) rather than a neutral crux. Consider defaulting the first typed question to a single neutral `open_question`.

### F6 — Approval semantics honesty (§ review 5).
- Inclusion-by-default (`approved: null` → included) is invisible in the outcome. Either rename honestly ("unreviewed — included as-is") or a single lightweight "include all / let me trim" gate before mix.

---

## 4. What NOT to do (restraint — mirror clause; from reviews 2, 3, 5)

1. **No full dynamic replanning** — fights the spine's restraint default (manufactures forks/ceremony). Dependency-ordered execution (F4) gives most of the benefit without over-firing.
2. **No blackboard / opportunistic-control layer, no auction *utilization* objective** — mirror-clause over-fire risk; the DAG gate is enough.
3. **Don't delete the personas** — demote them from *primitive* to *presentation* (F3) and from *author* to *coverage signal* (F5). The named crew is the retention/moat "face"; only the byline-as-author reads as machinery.
4. **Don't surface raw confidence numbers** — internal-routing-only; the user reads words.
5. **Don't over-build the crew** — raise the deploy bar (F4), don't lower it. A single strong reasoner is the right default for the median decision.
6. **Don't touch `aggregateResults` / SealMoment / the flinch loop / STEP-0 classifier** — verified-good, spine-anchoring.

---

## 5. Ship order (smallest-safe-first, root-deepest-first)

| # | What | Root | Risk | Old-Layer map |
|---|---|---|---|---|
| **F1** | User judgment → outcome (mix block + contract predicate + blocked-surface) | THE root (§1) | low (additive) | new |
| **F2** | Consumption guard + typed context assembly | contract integrity | low-med | new |
| **F3** | One router + honest reason + capability-primitive + escape hatch + XP-out | assignment | med | = old L1+L2 (+ primitive) |
| **F4** | `depends_on` on plan step → N-stage DAG + raise crew bar | shape ceiling | med | extends old L0 |
| **F5** | LeadSynthesisCard byline · asymptote disclosure · fork re-scope | spine polish | low | new |
| **F6** | Approval semantics honesty | judgment surfacing | low | new |

**F1 first** — it's the deepest root, it's a spine violation, it's mostly additive, and it's the mirror-thesis rung that's currently broken. F2 second (it protects F1 from silently un-wiring). Then F3/F4 (the assignment+shape work, which the old redesign doc already specced). F5/F6 are polish.

**Done already this session:** Layer-0 dependency ready-gate (`a77d3d6`) — folds under F4 as the anti-fabrication foundation the DAG rides on.
