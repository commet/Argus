# R28 — Diverse-voyage VALUE diagnostic (does it genuinely orient, not just avoid harm)

> 2026-06-19. First round of the R28→R50 sub-campaign. Pivot from the defensive
> question ("does it harm?") to the positive one ("does it deliver genuine
> orientation value across the full diversity of real users?"). 30 cases across 6
> diversity slices (career / relational-ethical / money-business / technical /
> non-open+flat / adversarial-multilingual), each generated to look ordinary but
> hide a trap, simulated against the REAL clarify+sail+settle SKILL.md, scored on
> a value rubric, and every finding (strength AND weakness) handed to an
> independent skeptic to refute. ~144 agents.

## One line

The plugin is genuinely good at the spine (value_avg 78/100, **0/30 worse than a
generic LLM**, route_correct 28/30, 0 flat-over-fire) — but the skeptic killed
**28 of 30 per-case "wins"** as inflation (trap-avoidance ≠ differentiated
value), leaving exactly ONE differentiated edge (anti-Barnum) and 6 real gaps,
of which only **3 are fixable in prose** and **2 are enforcement-medium ceilings
that more prose would only fake**.

## Scoreboard

| Metric | Value |
|---|---|
| cases | 30 |
| value_avg | 78/100 |
| better / same / worse than generic LLM | 22 / 8 / 0 |
| route_correct | 28/30 |
| spine_violations | 3 |
| confirmed gaps (skeptic-survived) | 6 |
| inflated "wins" killed by skeptic | 28/30 |

## The method finding (the most important output)

**Discovery inflation was severe: 28/30 per-case wins were killed.** Two kill
signatures, both of which the founder warned about (self-strengthening):

1. **"Avoided trap X / refused verdict Y" was banked as beating an LLM** — but a
   careful generic model avoids the same trap. Trap-avoidance is table-stakes,
   not a differentiated edge. (Killed: fork-form, vent-classification,
   crisis-first, closed-log-non-reopening, restraint-scaffold headlines.)
2. **"Spec-perfect rendered output" was banked as a win** when the real risk is
   real-model DEVIATION the prose cannot enforce — the self-scored sim renders
   the *ideal* and hides the deviation rate. This is the shared root of the two
   unfixable gaps below.

Only 2 strengths survived, and they are the SAME move: **anti-Barnum /
self_profiling** — declining the identity verdict in BOTH directions AND naming
the Barnum mechanism (`money_business-5`, `technical-3`). It survives because the
behavior is *product-stated*, not a generic empathetic default — generic LLMs
*reassure*, which is itself the Zero-Judgment rule-2 violation. **This is the one
confirmed differentiated edge. Do not touch it; protect it.**

## The 6 confirmed gaps

### Fixable spec defects (3) — SHIPPED this round

**C1 — validation route self-contradicted on `contract_seed` (med, plugin-only).**
clarify Step 1.7 authorized "an optional contract seed" while Forbidden patterns
banned a contract_seed on validation — mutually exclusive as written, latent on
every validation case (a model could append a settlement seed = ceremony-as-
endorsement on an already-made decision, mirror clause). **Fix (subtractive):**
deleted the authorization; Forbidden patterns is the sole source of truth; the
route now states `**No contract seed**` explicitly. Webapp validation branch
never had the seed → plugin-only.

**C2 — validation route had no firing-form constraint → normalizing lean before
the verdict-decline (med, BOTH surfaces, highest spine-relevance).** On "am I
insane / overthinking?" the model reliably emits a normalizing premise ("you're
not overthinking") BEFORE declining the verdict — structurally the disclaimed
lean the spine bans ("you cannot launder a verdict by tagging it"). For an
under-resourced reader the early reassurance sticks harder than the conditional
check that follows. **Fix (restructure, both surfaces):** decline the verdict in
BOTH directions first (or skip), go straight to the check; NEVER preface with a
normalizing/reassuring premise; acknowledge only the decision-as-made, never the
user's self-assessment.

**C3 — refuse-to-own had no affect-acknowledgment slot → cold refusal reads as a
scold (med, BOTH surfaces).** For a depleted delegator ("머리 아파 / 그냥 네가
정해줘") the refusal opened straight into the crux and landed as a covert verdict
on the abdication. (This is why the "refused without scolding" praise was
inflated and killed — the missing affect-ack is what made it read closer to a
scold.) **Fix (additive — the ONE justified additive fix):** ONE bounded
acknowledgment of the STATE before the refusal. Bounded HARD — one clause, no
availability/engagement hook, no multi-sentence warmth — precisely so it does not
recreate the vent over-warmth over-fire (C3 and C5 are in direct tension; the
bound IS the resolution). Plugin: new `M-affect` meta-gate. Webapp: co-located
with the "NEVER decide for the user" rule.

### Enforcement-medium ceilings (2) — DELIBERATELY NOT "fixed"

**C4 — irreducible value∝tilt residual + a melting sentence (do-not-touch).**
The "melting" sentence (`career-2`: dissolving the user's stated "찍힐까봐" cost
with a reassurance) already VIOLATES an existing rule (sail M-tilt "do not melt
one pole's cost") — it is a prose-only-enforcement deviation, NOT a missing rule.
Beneath it the residual lean is irreducible (`value∝leverage∝tilt`). **Do NOT add
a rule. Do NOT tag the lean per-sentence** — per-output tilt-tagging is the banned
laundering that makes it worse (R7). This is the disclosed asymptote, handled at
product level. The live danger is a future round "fixing" it. Flagged do-not-touch.

**C5 — vent (and all early-exit) restraint is prose-only on a markdown surface
(do-not-touch).** Vent short-circuits before the meta-gates, and a markdown skill
has NO runtime to run a post-filter. The rule exists and the prose is tight; an
unenforceable "guard" would only manufacture false confidence (the real bloat
trap). **Do NOT add a post-filter.** Accept as the enforcement-medium ceiling;
mitigate via real-user/multi-model measurement (R29) and, on the webapp port,
encode the rule as runnable data (the webapp HAS a runtime).

## What's already good (do not "fix")

- **Anti-Barnum / self_profiling refusal** — the one skeptic-survived edge. R29+
  must NOT touch self_profiling route copy or sail's identity/moral-verdict refusal.
- **Forbidden-patterns contract_seed ban is CORRECT** — only the route copy
  contradicted it. Fixed the route; never weaken the ban.
- **sail's tilt machinery is honest and largely working** — the swap-test lint,
  the "do not melt a pole's cost" rule, and the product-level floor disclosure all
  exist. The gaps are deviations from these rules, not missing rules. Do not rebuild.
- **Under-fire/restraint default + route classification held** (route_correct
  28/30, worse_than_llm 0, no flat-over-fire). But these are table-stakes, not the
  edge — do not re-bank them as wins.

## Shipped

- `argus-plugin-v2/skills/clarify/SKILL.md` — C1 (delete seed authorization),
  C2 (validation firing form), C3 (`M-affect` gate).
- `src/lib/progressive-prompts.ts` — C2 (validation firing form), C3 (affect-ack
  on the refuse-to-own rule). C1 N/A (webapp never had the seed).
- `src/lib/__tests__/validation-firing-form.test.ts` — 7 drift guards (C1
  reconciliation, C2 both surfaces, C3 both surfaces).
- Full suite green: 87 files / 1321 tests.

## R29 focus (carried forward)

1. **Measure the prose-only deviation rate** — the central method upgrade. Stop
   self-scored sims on the high-load routes (vent, "am I insane" validation,
   fatigued delegation) and run a multi-model / multi-temperature pass to MEASURE
   how often the model actually deviates from the spec. C4/C5 are unfixable in
   prose; the only honest next step is to quantify the deviation, since self-scored
   sims render the ideal and hide it.
2. **Regression-verify C1–C3 introduced no new tilt/bloat** — SPECIFICALLY that
   C3's affect-ack did not recreate C5's over-warm vent hook (test them as a pair).
3. **Webapp runnable-data port** — the webapp has a runtime where a post-filter
   CAN run; encode the validation firing-form + vent restraint as runnable checks
   there (per the "rules=data for webapp port" principle).
4. **Do NOT re-score the anti-Barnum / route-correct wins** (confirmed). Spend
   skeptic budget on deviation measurement, not re-inflation. Explicitly forbid
   any per-sentence tilt-tag "fix" for C4.
