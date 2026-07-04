# Crew Orchestration Redesign — Assignment + Dependency

**Status:** Implementation-ready design
**Date:** 2026-07-04
**Scope:** Task→agent assignment router, honest `assignment_reason`, dependency ready-gating. Merge (verified good) is preserved.
**Spine gate:** every change below is checked against `CLAUDE.md` → Zero-Judgment Invariant + mirror clause. Restraint section (§8) is normative, not advisory.

---

## 0. Decision: which spine, and why

Three proposals were submitted. All three converge on the same four moves (kill the keyword fallback, hard anti-pattern eligibility, confidence-margin honest reason, DAG ready-gate) — the disagreement is only in framing and sequencing. That convergence is itself the strongest signal: the fixes are real and the current engine is sound.

**Chosen spine: Proposal A ("Capability-registry + LLM-router hybrid, layered by risk").** It is picked not because its ideas are unique but because its *ordering discipline* is correct — it is the only one that explicitly ranks the dependency gate as **Layer 0** (safest, highest payoff, spine-neutral, shippable alone) and treats the delegation rewrite as **optional, last**. That risk-ordering is the load-bearing property for a system whose one verified strength (merge) must not regress.

**Grafts taken from the other two:**

- **From Proposal B (Contract-Net auction framing):** the `outcome: 'awarded' | 'unfilled'` field and the **explicit `unfilled` surface** instead of a silent degrade. B is right that "no qualified bidder" is a *first-class outcome the captain must see*, not an internal flag. A's "weak match" tag is kept as the softer sibling of B's hard `unfilled`. Also grafted: B's precise diagnosis that the Claire/서연→도윤 miss is a **task-classification** problem, not a scorer problem, and its `agent_hint`-as-tie-breaker remedy.
- **From Proposal C (primary-evidence dissection):** the **`readyOutput(w)` helper** and the finding that `worker-engine.ts:359-364` only reads `w.result`, so an *answered* human/self step (whose answer lives in `human_input`, never `result`) is **invisible to its dependents**. This is the half of the dependency bug that A and B under-specify — C caught both halves (invisible-answered-human AND starved-AI). C's `agent-delegator` scope-contract observation is also folded into §8 (what NOT to do).

**Rejected (deliberately, per restraint):** the blackboard / opportunistic-control layer (research source 2, Layer 4) and any market/auction *utilization* objective. See §8.

---

## 1. Current-system map (verified against code)

| Concern | Where | State |
|---|---|---|
| Main router (3-layer capability scorer) | `orchestrator-select.ts:140-213` | **Good.** taskType 0.5 / domain 0.3 / output 0.2 (`agent-capabilities.ts:244-247`), anti-pattern −0.4 (`agent-capabilities.ts:231`), experience boost (`orchestrator-select.ts:172`), `agent_hint` +0.05 (`orchestrator-select.ts:176-180`). Deterministic, no LLM. |
| Lens-exhaustion relax | `orchestrator-select.ts:156-158` | Already keeps capability scoring when all lenses fill — does **not** drop to keyword. |
| Keyword fallback | `useAgentStore.ts:635-672` (`assignAgentToTask`) | **Bad.** Pure keyword count, no anti-patterns, terminal hardcoded `hayoon` (line 670). |
| Fallback wiring | `useProgressiveStore.ts:1104-1107` | Calls `assignAgentToTask` when planned agent is null. |
| Reason wiring | `useProgressiveStore.ts:1137` | `assignment_reason: agent ? pw.assignmentReason : undefined` — **undefined on the fallback path even though an agent was assigned.** |
| Reason builder | `assignment-reason.ts:53-82` | Derives label from `trace.taskClassification` — the router's *input*, the one thing that can be wrong. |
| SelectionTrace | `orchestrator-select.ts:40-48` | Has `scores[]` + `forced`; **no confidence field.** |
| Dependency ordering | `worker-engine.ts:349-353` | 2-way partition sort. Cannot express A→B→C or a diamond. Behaviorally fine for today's 2-stage shape only. |
| Crash-resume seed | `worker-engine.ts:359-364` | Seeds from `w.status==='done' && w.result` **only** — an answered human/self step (`human_input`, not `result`) is invisible. |
| Injection gate | `worker-engine.ts:395` | `if (sourceResults.size > 0)` — empty upstream → dependent AI runs on original context and **fabricates**. This is the 민서/GTM placeholder. |
| Merge | `agent-planner.ts` `aggregateResults` | **Good, do not touch.** Reads `step_results[].result` text; never reads `assignment_reason` or the DAG. |
| WorkerStatus | `types.ts:1027` | `'pending'|'running'|'done'|'error'|'waiting_input'|'ai_preparing'|'sent'|'waiting_response'|'validation_failed'` — **no `'blocked'`.** (`blocked?: boolean` at `types.ts:780` is a different interface — do not reuse it.) |
| buildStages | `orchestrator.ts:66-118` | Only ever emits stage_1 (parallel) + stage_2 (critic, `dependsOn = stage1Indices`). Human/self steps land in stage_1. |
| Delegation | `agent-delegator.ts:42-70` | `CAPABILITY_KEYWORDS` substring routing — a second, dumber dispatch brain. |

The three verified live failures map exactly onto this table:
- **Assignment weak / reason wrong** → keyword fallback + reason-from-classification + no confidence.
- **Dependency ungated** → `worker-engine.ts:395` boolean + `359-364` result-only seed.
- **Merge good** → `aggregateResults` is downstream of everything above and untouched.

---

## 2. Layered redesign (ship order = safest first)

Four layers. Layers 0–2 fix the three verified failures. Layer 3 is optional cleanup. Each is independently shippable and independently testable.

```
Layer 0  Dependency ready-gate          (deterministic, spine-neutral, highest payoff)   ── ships alone
Layer 1  Single dispatch authority      (delete keyword fallback, route fallback via scorer)
Layer 2  Honest + accurate reason        (confidence margin, winner-profile, unfilled surface)
Layer 3  Delegation unification          (optional, last, orthogonal)
```

---

## 3. Layer 0 — Dependency ready-gate

**The one non-negotiable fix.** It caused the live 민서/GTM placeholder and it is spine-neutral (correctness + honesty only).

### 3.1 Data-structure changes

- `types.ts:1027` — add `'blocked'` to `WorkerStatus`:
  ```ts
  export type WorkerStatus =
    | 'pending' | 'running' | 'done' | 'error' | 'waiting_input'
    | 'ai_preparing' | 'sent' | 'waiting_response' | 'validation_failed'
    | 'blocked';
  ```
- `types.ts` `WorkerTask` (near line 1096) — add `blocked_on?: string[]` (the upstream worker ids the gate is waiting on; drives the honest surface).
- Do **not** touch `blocked?: boolean` at `types.ts:780` — different interface; reusing it creates two competing "blocked" notions (risk flagged by all three proposals).

### 3.2 The `readyOutput` helper (grafted from Proposal C)

A producer's output lives in a **different field depending on its type**. This is the invisible-answered-human half of the bug.

```ts
// worker-engine.ts
function readyOutput(w: WorkerTask): string | null {
  const t = w.agent_type ?? resolveAgentType(w);   // types.ts:1127
  if (t === 'human' || t === 'self') return w.human_input?.trim() || null;
  return w.result?.trim() || null;                 // ai
}
```

### 3.3 Ready-gate (replaces `worker-engine.ts:395`)

Per stage-2 worker `sw`, resolve each declared `depends_on` id to one of three states, then decide:

```ts
// three-state resolution
for (const depId of sw.depends_on ?? []) {
  const up = workers.find(w => w.id === depId);
  const out = up ? readyOutput(up) : null;
  if (out)                                    // SATISFIED  → inject as today
  else if (isHuman(up))                       // MISSING_HUMAN → gate (block)
  else                                        // MISSING_AI    → inject honest marker, run
}

// gate decision
if (anyMissingHuman) {
  sw.status = 'blocked';
  sw.blocked_on = missingHumanNames;
  // skip runAllAIWorkers for sw this pass; record localized reason:
  //   "입력 대기: {names}" / "Waiting on {names}"
  continue;
} else {
  // for each MISSING_AI, inject into peerResults:
  //   "[MISSING: {name} produced no output — 추정 금지]" / "[MISSING: {name} produced no output — do not fabricate]"
  // then run normally
}
```

**Why the human/AI asymmetry is correct (unified from A + CLAUDE.md):**
- A **human void must hard-block** — running a GTM step on absent customer conversations *fabricates authorship* (spine rule 1: never lie about authorship) and produces the exact placeholder we saw.
- An **AI failure must not deadlock** the whole run — inject an honest `[MISSING: …]` marker so the model degrades honestly (spine: no silent fabrication) rather than stalling other steps.

### 3.4 Wire the human dependency edge (grafted from Proposal B)

`buildStages` already sets the critic's `dependsOn = stage1Indices` (`orchestrator.ts:96-97`), and human/self steps land in stage_1 — so **a human step's index is already reachable as a critic dependency**. Verify at implementation time that when an AI step's `ai_scope`/task consumes a *specific* human step's output, that human worker's `stepIndex` is in the AI worker's `dependsOn` (not just the critic's). Minimal rule: any AI worker whose `depends_on` resolves to a `human`/`self` worker is gated on `human_input`. If the planner does not emit the edge, the gate cannot fire — so this edge is a prerequisite for §3.3 to catch the 민서/GTM case beyond the critic.

### 3.5 Re-entry (crash-resume + human-arrival)

- Extend the seed loop `worker-engine.ts:359-364` to use `readyOutput(w)` so an **answered human/self step reseeds** (today it never does — the invisible-input half).
- A `'blocked'` worker must be re-evaluated when its human upstream later receives `human_input`: the blocked→pending flip is driven by `initWorkers`/re-run recomputing readiness, not left stranded. The `'blocked'` state **is the visible handle** (spine: return the handle, don't fabricate).

### 3.6 Ordering: forward-compatible topo-sort (from A + research)

Replace the 2-way partition sort (`worker-engine.ts:349-353`) with a **Kahn topological sort** over worker-level `depends_on`. For today's 2-stage shape this is **behavior-neutral** (identical wave order: stage_1 parallel, then critic). It is a forward-compat swap, not a behavior change now. Reject dependency **cycles** as an invalid plan (mirror the existing `>4-steps` rejection in the planner). Do **not** build a general `pipeline()` executor (§8).

### 3.7 Verification step (Layer 0)

1. **Unit:** a 3-worker plan `A(human, no input) → B(ai)`; assert B ends `status:'blocked'`, `blocked_on:[A]`, and `runAllAIWorkers` was **not** called for B.
2. **Unit:** same plan with `A.human_input='...'`; assert B runs and `peerResults` contains A's `human_input` (labeled).
3. **Unit:** `A(ai, error) → B(ai)`; assert B runs with `[MISSING: A …]` marker in `peerResults` (no deadlock).
4. **Regression:** today's 2-stage review_loop yields identical execution order/timing under Kahn vs the old partition sort.
5. **Cycle:** A→B→A rejected as invalid plan, falls back (does not hang).
6. **Live:** re-run the 민서/GTM case — GTM step shows `blocked` "입력 대기: 고객 대화" instead of a fabricated placeholder.

---

## 4. Layer 1 — Single dispatch authority

Make the capability scorer the **sole** router. Delete the second, dumber brain.

### 4.1 Changes

- `useAgentStore.ts:635-672` — **delete** the keyword body of `assignAgentToTask`. Re-implement as: `scoreAgentForTask` over unlocked `task_execution` agents minus `usedIds`, `argmax > 0`; **remove the terminal hardcoded-`hayoon` fallback** (line 670); return `null` on no-qualified-bidder so the caller escalates honestly.
- `useProgressiveStore.ts:1104-1107` — fallback now calls the capability-based `assignAgentToTask`; **capture the resulting trace** so a reason is produced for fallback picks.
- Anti-pattern → **hard eligibility for sensitive task types** (from A + B + C). In `scoreAgentForTask` (`agent-capabilities.ts:231`), keep the soft `−0.4` for non-sensitive anti-patterns, but for a **sensitive set (`legal_review`)** return `-Infinity` (ineligible), so a junior can never win a legal step even on a sparse roster (CNP anti-capability gate). Guard `argmax` against an all-`-Infinity` pool → triggers the no-bidder escalation, never a crash (risk flagged by A #3).

### 4.2 No-bidder = escalate, don't degrade (grafted from Proposal B)

When `scoreAgentForTask ≤ 0` for **all** candidates: do **not** degrade to first-unused/`hayoon`. Set no agent; mark the worker `assignment_status='unfilled'` and surface it to the captain in `TeamDeployBanner` ("적합한 크루 없음 — 직접 배정하거나 작업을 쪼개세요" / "No qualified crew — assign manually or split the task"). This is CNP "no qualified bidder ESCALATES."

### 4.3 Verification step (Layer 1)

1. **Unit:** `assignAgentToTask` for a legal task over a roster where every unlocked agent anti-patterns `legal_review` → returns `null` (not `hayoon`).
2. **Unit:** a fallback-assigned worker now carries a non-null `assignment_reason` derived from its own trace.
3. **Grep gate:** `assignAgentToTask` has exactly one live caller (`useProgressiveStore.ts:1105`); confirm no test/manual-add path relies on the deleted keyword behavior.
4. **Live:** a marketing step never binds an anti-marketing intern; an unfulfillable step renders as `unfilled` in the banner, not a silent `hayoon`.

---

## 5. Layer 2 — Honest + accurate `assignment_reason`

Three coordinated root-cause fixes. Numbers stay internal (spine rule 2: no uncalibrated user-facing verdict); the user reads **words**.

### 5.1 SelectionTrace gains confidence + outcome

`orchestrator-select.ts:40-48` — add:
```ts
confidence: number;                       // scores[0].total - scores[1].total; 1.0 if single candidate
outcome: 'awarded' | 'unfilled';          // grafted from Proposal B; replaces implicit "trace exists = awarded"
```
Compute at the trace `push` (`orchestrator-select.ts:201-211`). Keep both **internal-routing-only.**

### 5.2 Root cause 1 — undefined/stale on fallback

`useProgressiveStore.ts:1137` today only sets the reason when the *planned* `agent` is truthy. Because Layer 1 routes the fallback through the scorer (its own trace), change to:
```ts
assignment_reason: fallbackAgent ? reasonFor(fallbackAgent) : undefined,
```
The reason is now always generated from the agent **actually chosen** — never a different candidate's stale/inverted ranking (the live 도윤-vs-Claire artifact).

### 5.3 Root cause 2 — reason slaved to the (fallible) classification

`buildAssignmentReason` (`assignment-reason.ts:66-70`) derives the label from `trace.taskClassification` — the router's **input**. A misclassified domain ('legal'+'strategy' co-occurrence) then prints "Best fit for legal strategy" on a marketing task.

**Fix:** derive the label from the **winner's own capability profile**, not the input classification:
```ts
const cap = getCapability(trace.selectedAgent);
const strength = cap?.taskTypes[0];   // what actually earned the seat
const domain   = cap?.domains[0];
// e.g. 규민 → "재무 수치 분석 담당" — definitionally true, cannot be
// falsified by a domain misclassification.
```
The classification still drives **selection**; it no longer drives the **sentence**. Fallback: if `getCapability(selectedAgent)` is undefined (runtime boss/custom agent outside `AGENT_CAPABILITIES`), fall back to the old classification-based line rather than throw (risk flagged by A #4).

### 5.4 Root cause 3 — loose match presented as confident

When `trace.confidence < ε` (start `ε = 0.08`, **keep internal until calibrated** — see risk below): emit an honest near-tie line — "{A}·{B} 접전 — {A} 선택" / "near-tie: A vs B, chose A" — instead of "best fit."
When `trace.outcome === 'unfilled'`: "적합한 크루 없음 — 직접 지정" / "No qualified crew — assign manually."
Keep the forced-Critic line (`assignment-reason.ts:62-63`) verbatim — already honest.

### 5.5 `agent_hint` as scoped tie-breaker (grafted from B + C)

The Claire/서연→도윤 miss is a **classification** problem: a "positioning one-pager" was classified as synthesis (도윤's turf) instead of writing (서연's). Raise the LLM `agent_hint` from a flat +0.05 (`orchestrator-select.ts:176-180`) to a **within-ε tie-breaker**: after the no-hint sort, if `agent_hint` names an *eligible* candidate within `ε` of the winner, promote it and record it in the trace so the reason says so honestly. The hint must **never** override a decisive capability gap — that would make the LLM the router (vendor-tilt risk). The `ε` bound is the guardrail; test both the flip case (도윤/서연 near-tie) and a clear case (a research step must not flip on a hint).

### 5.6 Verification step (Layer 2)

1. **Unit:** a marketing award whose classifier misfired to `legal` → reason names the winner's own top capability, never "legal strategy."
2. **Unit:** two candidates within 0.08 → reason contains the near-tie phrasing, not "best fit"; > 0.08 → clean "best fit."
3. **Unit:** `outcome:'unfilled'` → "적합한 크루 없음"; forced critic → unchanged high-stakes line.
4. **Unit:** `agent_hint` flips a within-ε tie toward 서연 for a writing step; does **not** flip a clear research step.
5. **Calibration:** run `ε` over a real step corpus (offline) before the near-tie copy is allowed to fire in production; until then the confidence field is internal-only.

---

## 6. Layer 3 — Delegation unification (OPTIONAL, LAST)

`agent-delegator.ts:findDelegateAgent` (`CAPABILITY_KEYWORDS`, line 42-70) is the last keyword-dispatch offender, but it is **orthogonal** to the three verified failures. Replace substring routing with `scoreAgentForTask` over unlocked agents (excluding delegator + used ids), `argmax > 0`, so agent→agent handoff shares the **same dispatch brain** as top-level assignment (single-source-of-truth for routing, mirroring the CLAUDE.md prompt principle). Also (from C): set explicit `ai_scope`/`self_scope` on the delegated sub-task so the scope contract survives the handoff (today `executeDelegation` spreads `originalTask` without re-scoping). **Ship behind Layers 0–2; it is not required to fix the live issues.**

---

## 7. Migration order & preservation

**Ship order (smallest safe first):**

1. **Layer 0** (dependency gate) — deterministic, spine-neutral, fixes the fabrication bug. Ship alone if desired. Verify §3.7.
2. **Layer 1** (single dispatch) — delete keyword fallback, hard legal eligibility, no-bidder escalation. Verify §4.3.
3. **Layer 2** (honest reason) — confidence margin, winner-profile reason, unfilled surface, hint tie-breaker. Verify §5.6.
4. **Layer 3** (delegation) — optional, last. Verify handoff parity + scope contract.

**Merge preservation (verified good — do not regress):** every change is **upstream of `aggregateResults`** (`agent-planner.ts`), which reads `step_results[].result` text and never reads `assignment_reason`, `confidence`, `outcome`, or the DAG. A `blocked` worker simply contributes nothing (correct); 규민's break-even numbers still flow. Add one regression assertion: the 5-worker live case reproduces 규민's figures ($1,500/mo, 10 customers, M14) intact in the final draft after all four layers.

**Type/CI guardrails:**
- Audit every `switch`/`===` on `WorkerStatus` (TeamDeployBanner, worker cards, progress UI, worker-engine completion) to handle `'blocked'` or default gracefully — old persisted sessions never carry it.
- `blocked_on` is transient status detail; `confidence`/`outcome` live on the transient `SelectionTrace`, **not** on `WorkerTask` — so `schema-drift.test.ts` / `persistence-contract.test.ts` guards stay untouched (no new synced column). Confirm this holds; if any of these ever persist to a synced table, register the key and add the migration in the same commit (CLAUDE.md Schema Sync).

---

## 8. What NOT to do (restraint — over-engineering the crew is a spine risk)

The mirror clause (`CLAUDE.md`): `zero judgment` includes *not judging whether to intervene in the user's stead*. An over-built crew is an over-fire engine. Concretely:

1. **Do NOT build a general `pipeline()` / per-item streaming executor.** `buildStages` only ever emits 2 stages. Per-item pipelining adds risk to the crash-resume reseed path (`worker-engine.ts:358`) for zero present benefit. The per-worker `depends_on` data model already leaves the door open; revisit only when a genuine 3+-stage chain exists.
2. **Do NOT add the blackboard / opportunistic-control layer** (research source 2, Layer 4). It is the most speculative pattern and manufactures activations — a mirror-clause over-fire risk on flat cases. The DAG gate already gives the correctness win.
3. **Do NOT add a market/auction `utilization` objective.** Any global objective must be answer **quality/fit**, never "keep agents busy" or engagement — that is a direct mirror-clause violation. If a CNP-style bid layer is ever added, `fit` = capability score only; declines allowed; `unfilled` is honest.
4. **Do NOT surface any raw confidence number to the user** (spine rule 2). Confidence is internal-routing-only; the user reads words. Do NOT launder a lean either — no "leans toward X but not my verdict"; the reason states the winner's own strength and, at most, a neutral near-tie.
5. **Do NOT add per-candidate LLM bids on the hot path.** The deterministic score IS the synthetic bid (research source 2). Keep `agent_hint` a scoped tie-breaker, never the router ("LLM 호출 0. 결정론적" — the code's own doctrine).
6. **Do NOT expand the sensitive-eligibility set casually.** Start with `legal_review` only. A hard `-Infinity` filter over a broad set on a sparse roster produces routine `unfilled` escalations — the escalation must be *rare*, not the norm.
7. **Do NOT touch `aggregateResults`.** The one verified-good component. Every fix is upstream of it by construction.

---

## 9. References

- Contract Net (announce/bid/award, no-bidder escalation): Smith 1980. Anti-capability as hard eligibility gate.
- DAG + Kahn topological sort, in-degree ready-gate: Kahn 1962. The dependency-gating backbone (§3.6).
- Blackboard / opportunistic control: Erman/Hayes-Roth/Lesser/Reddy 1980 — **cited to reject** (§8.2).
- Industry framing (declarative-first backbone, LLM selection as scoped fallback, `context=[…]` data-dependency primitive): LangGraph edges-as-dependencies, CrewAI `context`, AutoGen `allowed_speaker_transitions` allow-list, Semantic Kernel planner deprecation. Argus's clarify→team→verify favors a declarative supervisor that OWNS routing, not free-form peer handoffs.
