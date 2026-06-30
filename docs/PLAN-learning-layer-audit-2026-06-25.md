# Learning / Scoring Layer — Audit & Plan (2026-06-25)

What Argus uses to "know the user" — patterns, DQ, vitality, signals, observations,
calibration — across **web app** and **plugin (CLI)**. Goal: decide keep / fix /
deprecate, then design a **unified user** model so one person using both surfaces has
one memory. This is a **re-design**, not reuse.

> Audit basis: read of `decision-quality.ts`, `judgment-vitality.ts`,
> `signal-recorder.ts`, `observation-engine.ts`, `decision-contract.ts`,
> `calibration-disclosure.ts`, `navigator.ts`/`user-context.ts` call sites, and the
> plugin `skills/patterns/SKILL.md`. Findings are call-site verified where stated.

---

## TL;DR — three headline findings

1. **DQ + Vitality are effectively DEAD in the web app.** `computeDecisionQuality()`
   has **no caller** (only definition + tests). It was driven by the legacy
   reframe→recast→rehearse→**refine** flow; the main flow is now the progressive
   **voyage** (`ProgressiveFlow` → `MixResult`/`decision_contract`), which never calls
   it. So `DQ_SCORES`/`VITALITY_ASSESSMENTS` localStorage is empty for everyone →
   `navigator.ts` + `user-context.ts` inject DQ/vitality trends that are *always*
   `not_enough_data`. `assessVitality()` only runs inside the uncalled DQ fn → **zero
   vitality assessments ever produced.**

2. **The learning layer is stranded on the legacy data model.** DQ, vitality, the
   plugin `/patterns` journal, and the outcome-correlation functions all read legacy
   shapes (`ReframeItem`/`RecastItem`/`FeedbackRecord`/`OutcomeRecord`). The product
   moved to `decision_contract` (seal→settle). The **only live, outcome-validated**
   record is `decision-contract.ts` (`summarizeRecord` / `calibration-disclosure`).

3. **Web and plugin learn from disjoint stores.** Plugin `/patterns` reads
   `.argus/journal.md` (CLI-written); the web never writes it. Web learns via
   `quality_signals` (prompt injection) + `decision_contract`. A user using both has
   **two separate memories** — no unified 자차표.

Plus: **DQ is a weak proxy even when alive** — it scores *structural completeness*
(did reframe differ? #assumptions, #personas, #checkpoints…), not decision quality.
The code already knows this (the `low_gamma_high_dq` "gaming" signal exists). The
user's instinct ("DQ 신뢰할만한지 검토 필요") is correct.

---

## The two-generation split (root cause)

```
LEGACY (4-step)                         CURRENT (voyage)
reframe→recast→rehearse→refine          clarify→team→verify→boss→heading
  ReframeItem/RecastItem                  MixResult / DMFeedback / Falsification
  FeedbackRecord / JudgmentRecord         decision_contract (predicates)
  OutcomeRecord                           seal → check_in (ETA) → settle (ATA)
        │                                         │
        ├── decision-quality.ts (DQ)              ├── summarizeRecord (track record)  ✅ live
        ├── judgment-vitality.ts (γ/tier)         └── calibration-disclosure (gate)   ✅ live
        ├── plugin /patterns (.argus/journal.md)
        └── correlate/validate/calibration fns
              ⛔ inputs no longer produced in the main flow
```

The learning layer (left) was built for a flow that is no longer primary. It wasn't
deprecated when the voyage flow took over.

---

## Inventory — keep / fix / deprecate

| Component | Does | Data source | Surfaced where | Verdict |
|---|---|---|---|---|
| `decision-contract.ts` (`summarizeRecord`, `contractStatus`) | seal→settle, cross-project record (자차표 seed), ETA | `decision_contract` (live) | /project strip, SettlementModal, ETA badge | **KEEP** — the real spine |
| `calibration-disclosure.ts` | sample-size gate (SETTLED_THRESHOLD=3) | counts | all stat surfaces | **KEEP** — correct, tested |
| `signal-recorder.ts` + injection (`context-builder`, `navigator` demo seeds) | implicit behavior → prompt personalization | `quality_signals` (live, now wired to voyage) | invisible (prompt) | **KEEP** |
| `observation-engine.ts` | per-agent prefs/communication tuning | agent activities, boss chat | invisible (prompt) | **KEEP** — but it's "agent learns user", not "your decision patterns" |
| `decision-quality.ts` (`computeDecisionQuality`, DQ score) | structural rubric → 0-100 | legacy reframe/recast/feedback | **nowhere (uncalled)** | **DEPRECATE or REBUILD** — dead + weak proxy |
| `judgment-vitality.ts` (γ, rigidity, tier) | novelty + rigidity nudges | legacy + DQ (uncalled) | navigator coaching (never fires — no data) | **DEPRECATE or INTERNALIZE** — dead + spine-flagged + confusing tiers |
| `correlateDQWithOutcomes` / `validateEvalCriteria` / `analyzeConfidenceCalibration` | DQ↔outcome research | DQ scores + `OutcomeRecord` (legacy) | research/admin | **REBUILD on settlement** — good design, wrong (dead) inputs |
| plugin `/patterns` SKILL | rich narrative patterns | `.argus/journal.md` (CLI only) | CLI output | **FIX** — repoint source + spine reconcile; empty for web-only users |
| `navigator.ts` / `user-context.ts` DQ+vitality reads | inject "your trend" into prompts | DQ/vitality stores (empty) | invisible (prompt) | **FIX** — remove dead reads or repoint to live data |

---

## DQ deep-dive (the flagged one)

**Two independent problems:**
1. **Dead**: not called in the web app at all (verified — no call site). Any DQ shown
   anywhere web is from an empty store.
2. **Weak even if revived**: it counts *output structure*, not quality. More
   assumptions / more personas / more checkpoints → higher DQ, independent of whether
   the thinking was sound. Gameable; the codebase's own `low_gamma_high_dq` signal is
   an admission of this.

**Decision needed:** retire the user-facing DQ score entirely, OR rebuild it as a
**process-honesty indicator** (clearly labeled "process completeness, not decision
quality") validated against `decision_contract` settlement — never shown as a verdict.

## Vitality deep-dive

- **Dead** (no assessments produced — see TL;DR #1).
- **Spine-flagged**: CLAUDE.md §Zero-Judgment rule 2 names "Judgment Vitality `gamma`"
  as exactly the kind of uncalibrated tier NOT to surface; tier-4 coaching ("이 도구를
  잘 쓰는 게 목표가 아니다") is a verdict on the user's process.
- **Confusing tiers**: `alive > coasting > performing > dead` — "performing" reads
  positive but ranks 2nd-worst.
- The *idea* (detect when thinking has gone rote) is good and on-thesis — but only if
  rebuilt on voyage data and reduced to a non-judgmental nudge.

---

## Web ↔ plugin + unified user

- **Problem**: plugin `/patterns` ← `.argus/journal.md`; web ← `decision_contract` +
  `quality_signals`. Disjoint. A user on both has two memories.
- **Direction**: one canonical record in Supabase (the share hub already exists —
  [[share-hub-architecture]]). Both surfaces read/write the same
  `decision_contract`/settlement record keyed to the user. The plugin's `.argus/`
  ledger syncs up; the web reads it down. The 자차표 is one table, not two.
- `account-migration.ts` (localStorage→Supabase) is the migration precedent to follow.

---

## Spine reconciliation

CLAUDE.md §Zero-Judgment rule 2: meaning-language to the user comes **only** from
"`patterns`' sample-size-scaled frequency statements" — NOT uncalibrated scores/tiers
or who-you-are verdicts.

- Keep patterns to **frequency statements** ("6번 중 5번 예상보다 늦게 도착") with
  `calibration-disclosure` gating.
- DQ number + "thinking profile" (currently in plugin `/patterns`): demote to internal
  or relabel as descriptive process stats with the honest banner. No tier verdict.

---

## Sequenced plan

- **P0 — stop the bleeding (cheap, do first):** delete/▸gate the dead DQ+vitality reads
  in `navigator.ts`/`user-context.ts` so they stop pretending to inject a "trend" from
  empty stores. Decide DQ/vitality fate (retire vs rebuild) — recommend **retire the
  user-facing surfaces now**, keep code archived behind a flag.
- **P1 — unify the record:** make `decision_contract` settlement the single source for
  the track record across web + plugin (Supabase-canonical). Reframe ETA/ATA +
  punctuality on it ([[eta-ata-voyage-arrival]]).
- **P2 — rebuild patterns on live data:** "버릇 알아채기" = frequency statements over
  settled contracts (held/broke, on-time/late, risk-avoided/hit), sample-gated. One
  surface, both web (new view) and plugin (repoint `/patterns`).
- **P3 — (optional) revive a *validated* quality signal:** only if it predicts
  settlement outcomes (`validateEvalCriteria` design, rebuilt on contracts). Until it
  earns it, no quality number to the user.

---

## Open decisions (need the user)

1. **DQ score**: retire entirely, or rebuild as clearly-labeled process indicator?
2. **Vitality**: drop, or keep the rigidity-nudge idea rebuilt + de-judged?
3. **Unify now or later**: build the Supabase-canonical record before P2, or let web
   and plugin stay separate for now?
4. **Plugin `/patterns`**: leave as-is (CLI journal) until P2, or repoint sooner?

Related: [[learning-layer-reckoning]], [[eta-ata-voyage-arrival]],
[[uiux-product-audit-roadmap]], [[share-hub-architecture]].
