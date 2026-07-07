# Plan — Aligning Argus with the 3-Phase Voyage (2026-06-23)

> Grounded in: `docs/MYTH-SIRENS-design-grounding-2026-06-23.md` (the frame), a 7-agent
> code+DB audit (current state, all file:line real on branch
> `design/ds-sync-and-contrast-pass`), live DB data, and a 6-agent design panel (BIND design
> + Tier-0 fix list, two adversarial critics). This plan is the synthesis.

---

## 1. Diagnosis (what the evidence says)

**Live DB (overture-db, 2026-06-23):** 47 projects · 13 users · **0 projects with ANY
`decision_contract` · 0 sealed · 0 settled · 0 plugin_decisions.** The moat is empty.

**The decisive fact:** logged-in users created 47 projects but sealed **zero** — so this is
NOT merely the anonymous login gate. The **seal is buried at the END** of a long pipeline
(analyze → Q&A → workers → mix → DM-feedback → overreach → falsification → final → *then*
SealMoment), so almost nobody reaches it.

**Mapped to the frame:** the two valuable phases — **Bind (묶기)** and **Land (닿기)** — are
buried behind a bloated **Listen (듣기)**. The BIND is *inverted*: on every surface the user
hears the AI before tying any rope (webapp `workspace/page.tsx`: submit ~295 → `runInitialAnalysis`
319 → `createSession` 353; the only user-authored lean, `real_bet`, is captured at phase
'testing' *after* all generation). Legibility of the 3 phases to the user = **2/5** everywhere.

**Corrections to stale memory (verified):** the manufactured-meaning bug is **FIXED** in the
webapp (`Falsification.tsx` tags `real_bet_authored` `user`/`ai_surfaced`, scored separately);
email signup is fixed. New residuals found (see Tier 0/2).

**Strategic conclusion (founder's priority inversion, now data-backed):** build for **Phase 1
(Bind)** and **Phase 3 (Land)**; do not fancy-up Phase 2. The first-order move is *create a
dated rope at project-OPEN that survives mid-pipeline abandonment* — that is the only thing
that fills the 0-contract void.

---

## 2. The BIND design (validated by the design panel)

Two adversarial critics ranked 3 designs (A minimal-line, B recognition-tap, C half-bind).
They split on the label but **converged on the same synthesis** — a strong signal. The
"fix" for B (drop the two-pole fork) and the "fix" for C (write the contract early) both
**converge onto A's form**, so A is the correct base, executed on B's timing with C's wiring.

**THE BIND — "Tie the rope" (묶기):**

1. **Timing (from B) — overlap, ~0 wall-clock.** On submit, fire `runInitialAnalysis` IN
   PARALLEL and buffer/occlude its stream (`setStreamingText` suppressed while
   `phase==='binding'`). Render the bind during the existing ~2s "assembling" beat
   (`page.tsx` ~311). **Auto-advance-as-skip** the instant analysis is ready — auto-advance
   NEVER fabricates a lean. Net: the 30s / no-login / first-read promise survives.
2. **Form (from A) — spine-clean, no fork.** One **optional** neutral single line
   ("지금 마음은 어디로? — 안 적어도 됩니다", `maxLength~140`, neutral placeholder NEVER
   submitted as content) + check-in window chips (1주 / 2주 / 1달, **none preselected**) +
   a **dominant, unconditional skip** ("아직 잘 모르겠어요 →", Enter = skip). **NO two-pole
   fork, no directional statement, no score** — this is exactly what keeps B's
   mirror-clause / authorship-creep trap out.
3. **Moat (from A) — early write.** On any **explicit** commit (typed lean OR tapped date),
   mint the project early and write `decision_contract` at OPEN:
   - lean typed → `predicates:[{ source:'user_lean', provenance:'user', text:lean }]`
   - date only → `predicates:[]` + `check_in_interval/check_in_at` (date-only is a valid rope
     — "bind the commitment, ears open")
   - **full skip / auto-advance → write ZERO rows** (honest-empty invariant; byte-identical
     to today's behavior — bounds the downside).
4. **Seal becomes AUGMENT, not CREATE (fix the verified clobber).** `SealMoment.tsx:132`
   currently OVERWRITES `decision_contract`. Change to **MERGE**: keep `id`/`created_at`/the
   `user_lean` predicate/`check_in`, **append** engine-extracted predicates, de-dupe by
   stable id. Re-confront the user's own earlier line as a **bare neutral question**
   ("출항 때 당신의 한 줄: \"<X>\" — 항해가 끝난 지금도 그런가요?"), NEVER a disclaimed lean
   ("<X>였는데 맞았나?" = spine violation). This is the myth's *"bind tighter at peak
   temptation"*: the pre-AI line becomes the anchor the seductive output is checked against,
   never silently overwritten (deaf rowers).
5. **Restraint (from C) — wire the dead gate.** Import `shouldSealContract`
   (`decision-contract.ts:579`, currently unwired) into the augment-seal so
   routine+reversible+confident → `single_check`, empty → null. Kills the mirror-clause
   over-fire (full ceremony on trivial decisions).
6. **Retroactive suppression (from B).** Once `runInitialAnalysis` returns
   `request_type`/`crisis`, if crisis/info/vent/flat → mark the rope **non-binding** and do
   NOT surface the seal comparison. The bind fires *before* classification, so this is the
   safety net against firing on a flat/crisis input.
7. **Provenance plumbing.** Add `'user_lean'` to `PredicateSource` and a `provenance` field
   to `Predicate` via the **full add-a-field checklist** (CLAUDE.md) + the schema-drift
   guard. No migration (`decision_contract` is an embedded JSON column).
8. **Plugin mirror.** Step-0 lean pre-prompt in `clarify`/`reframe` before any generation
   ("Before I run — one line, your current lean? (Enter to skip) · Check back when? 1w/2w/1m");
   typed lean → ledger early-bearing tagged `author:user`; skip writes nothing; the `seal`
   skill becomes AUGMENT (append + re-confront) instead of create. Ports as rules=data.

**Instrument from day one:** `first_read` rate AND `contracts_created_at_open` AND
`settled_count` — the three numbers this whole change trades between. A/B bind-on vs bind-off.

**Hard spine invariants for this work (never violate):** skip stays unconditional forever
(no "require a lean to continue"); the lean field is never prefilled from model text; the
committed lean is never passed to the agents as a directive (ears open); full-skip writes no
contract and no faked predicate.

---

## 3. Work breakdown (tiered by risk / reversibility)

> Tiering is itself the Scylla lesson: accept bounded scope, don't chase everything at once.
> Collision note: **none** of Tier 0/1/2 touch the session-B files
> (`LandingHeader`/`Header`/`Sidebar`/`InteractiveDemo`/`RehearseStep`/`PersonaPoolModal`/`VoyageChart`).
> (`RecastStep.tsx` ≠ `RehearseStep.tsx` — distinct.)

### TIER 0 — Truth & legibility fixes (safe, mechanical, no flow change) — DO NOW
| # | Change | File:line | Risk | Effort |
|---|---|---|---|---|
| T0.1 | Tag AI `key_assumptions` as `ai_surfaced` when sealed as governing bets (so AI assumptions don't inflate the user's skill-wins) | `decision-contract.ts:249` | low | S |
| T0.2 | Landing Act2 "Current Heading" headline: directional verdict ("한 분기 연기 권고") → neutral crux question | `Act2DecisionVoyage.tsx:432` | low | S |
| T0.3 | Thread real `source` (`'import'` vs `'push'`) through plugin ingest core (dead field; PAT push mislabeled 'import') | `plugin-ingest-core.ts:28,81,102` + 2 callers | low | S |
| T0.4 | Shade Recast `governing_idea` headline as AI-drafted (display-only caption, no forced edit) | `RecastStep.tsx:695-700` | low | S |
| T0.5 | Count plugin-sealed bets in the admin Sealed/moat funnel (additive migration, never edit shipped) | new migration + `admin/page.tsx` | low | M |

### TIER 1 — The BIND (the core change) — the §2 design
| # | Change | Where | Risk |
|---|---|---|---|
| T1.1 | Add `Predicate.provenance` + `PredicateSource 'user_lean'` via full add-a-field checklist + drift guard | `types.ts`, creators, prompts that render `source`, `schema-drift.test.ts` | med |
| T1.2 | `BindCard` component (functional, minimal-skin — design session polishes) + overlap state machine | new `progressive/BindCard.tsx`, `workspace/page.tsx` (~291-361, mind 316-318 unmount hazard) | high |
| T1.3 | `buildEarlyContract` — write `decision_contract` at OPEN on explicit commit; honest-empty on skip | `decision-contract.ts`, `page.tsx` | med |
| T1.4 | `SealMoment` CREATE→AUGMENT (fix :132 clobber → MERGE; re-confront as bare neutral question) | `SealMoment.tsx`, `decision-contract.ts` | high |
| T1.5 | Wire `shouldSealContract` into the augment-seal (`single_check` path) | `SealMoment.tsx`, `decision-contract.ts:579` | high |
| T1.6 | Retroactive suppression: crisis/info/vent/flat → non-binding rope | `page.tsx`, `decision-contract.ts` | med |
| T1.7 | Plugin mirror: step-0 lean pre-prompt + ledger `author:user` + seal→augment | `clarify`/`reframe`/`settle` SKILL.md, `argus-watch` | med |
| T1.8 | Instrument `contracts_created_at_open` / keep `decision_sealed` / `settled_count`; A/B flag | `page.tsx`, analytics | low |

### TIER 2 — Provenance hardening + LAND durability (sequence after T1)
| # | Change | Risk |
|---|---|---|
| T2.1 | `WorkerCard` "Keep draft" submits AI text as user input untagged → tag `ai_surfaced` + keep escapes | med |
| T2.2 | Plugin `contract_seed`/seal provenance tag (after T1.1 as reference shape; keep ledger schemas in sync) | med |
| T2.3 | LAND durability — anon→server persistence + return channel (the "no notifications" philosophy is a deliberate design call; decide explicitly, likely a gentle opt-in) | high/design |
| T2.4 | Bridge two-way / settle-a-plugin-decision-from-webapp; unify plugin_decisions into the spine funnel | high |

### TIER 3 — Narrative & design (HANDED OFF — do not duplicate)
Hero 3-phase narrative + workspace phase-legibility system, animated, in code. Owned by the
**parallel design session** (handoff prompt already written). This session owns the *logic*;
that session owns the *presentation*. Land T1 logic first so the design session skins a real
`BindCard`, not a stub. Shared file to coordinate: `workspace/page.tsx`.

---

## 4. Execution order & validation

1. **Tier 0** now — independent edits, fan out, validate (`tsc` filtered to touched files +
   targeted `vitest` for `decision-contract`), commit/push. Lowest risk, immediate value.
2. **Tier 1** in dependency order: T1.1 (types/checklist) → T1.3 (`buildEarlyContract`) →
   T1.2 (BindCard + overlap) → T1.4/T1.5 (seal augment + restraint) → T1.6 (suppression) →
   T1.8 (instrument) → T1.7 (plugin mirror, parallelizable). Validate after each; commit per
   coherent sub-step so interruptions are safe.
3. **Tier 2** as budget allows, sequenced after T1 (T2.2 depends on T1.1 shape).
4. **Validation strategy in a shared tree:** session B has uncommitted edits; a full
   `next build` may fail on their half-finished files. Rely on **`tsc --noEmit` filtered to
   files this work touches** + **targeted `vitest`** for changed libs + scoped lint. Commit
   only this work's files (surgical `git add`), never `git add -A`.

## 5. Open decisions (made, with rationale — flagged for the founder)
- **Bind ON for `?q=` deep-links** (don't weaken the rope where new users are); rely on the
  overlap to make it ~free. Revisit only if instrumentation shows a real `first_read` dip.
- **Date-only counts as a rope** (the appointment is the truest commitment). An *untapped*
  default date never counts as authorship.
- **LAND return channel** (T2.3): the product deliberately says "no emails, no notifications."
  Keeping that is a real philosophy call; recommend a *gentle opt-in* reminder rather than
  silence or push. Deferred to Tier 2 / founder.
