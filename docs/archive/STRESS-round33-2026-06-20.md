# R33 — The settlement loop (the n=1 moat): value is real, but over-sold

> 2026-06-20. First VALUE probe of Argus's settlement loop — the moat ("own your
> n=1 decision history"). We ran `/argus:log --insights` on 6 diverse accrued
> ledger histories across 3 model tiers (haiku/sonnet/opus), judged value
> (grounded-in-entries / beats-generic / Barnum-free / no-pattern honesty /
> tier-gradient), and skeptic-refuted every value claim. ~32 agents. (Cap lifted;
> measurement method resumed.)

## Headline

**The moat is REAL and robust — but the insight is OVER-SOLD, and on weak tiers
it MANUFACTURES patterns from noise.** Two distinct findings:

1. **The n=1 value is genuine, not ceremony** — 6/6 beats-generic, 6/6 grounded,
   6/6 Barnum-free, surviving even haiku. The most differentiated observations
   depend *exactly* on the user's own tags (a luck-tag turning a correlation into
   a confirmed read; "you bet despite seeing the gate"; "swinging never once
   worked as a mechanism") — things a generic LLM without this history cannot say.
   Value comes from the accrued record, not model cleverness.
2. **BUT `value_survived_skeptic = 0/6`.** The skeptic broke every headline claim.
   The failure is not the moat — it is the claim-CALIBRATION layer on top: a
   small-n (~4-7) correlation stated one notch too strong as a rule / mechanism /
   "the only variable", and (worse) **silently dropping a counterexample or a
   luck-tagged win to make a cleaner rule** (sonnet dropped an entry; counted a
   lucky win as a skill win). The moat is not hollow — it is over-sold.

## The product-defining failure: manufactured patterns on noise, tier-split

2 of the 6 histories were deliberately NOISE (no real cross-voyage pattern — the
honest read is "not a signal yet"). Handling them is the test the product exists
to pass (anti-Barnum). It split cleanly by tier:

- **opus**: both honest ("n=4 across different domains — a weak clue", "n=3, a hint
  not a signal"). This is the target behavior.
- **sonnet**: one borderline (hedged but didn't state the small-n conclusion).
- **haiku**: BOTH manufactured — a false through-line ("all four were about others'
  readiness" — false for 3 of 4) plus a fact error (a `mixed` basis relabeled as
  `luck`); and an "underestimate pattern" invented from n=1.

The manufactured-meaning trap — the exact spine violation — is **live on the
cheapest tier, on the cases that define the product.** Since the plugin runs on
the user's own model and sonnet is also borderline, **no-pattern honesty cannot be
left to prompt discretion — it must be mechanical.**

## What shipped (plugin `log/SKILL.md` — PLUGIN-ONLY)

The webapp surfaces only **mechanical contract counts** (no LLM cross-voyage
insight), so it is structurally immune to this over-claim class. The risk lives
only in the plugin's LLM-generated `--insights`. Fixes:

1. **`pattern_strength` is computed mechanically in Step 1, before any LLM call**
   (gate-before-form): `none` (<3) / `counts_only` (3-5) / `tendency` (6-10) /
   `rule` (11+), **downgraded one level on scatter** (entries across many
   unrelated domains = a thin record, not a pattern). The NUMBER, not the LLM,
   decides how strong a claim Step 3 may make.
2. **Step 3 binds claim strength to that band** — `counts_only` permits frequency
   counts + single-entry observations ONLY (no causal language, no direction, no
   "the only variable", no mechanism, no "rule"); `tendency` is a hedged tendency
   scoped to the record; `rule` may state a pattern. Each scoped to the user's own log.
3. **Quarantine-but-count, never drop** — a luck-tagged win or a counterexample
   stays on the record but is quarantined from the skill claim (the opus behavior);
   silently dropping it to make a clean rule is the exact over-claim the skeptic broke.
4. **Ledger tags injected VERBATIM, no relabel** — weak tiers relabel a `luck`/
   `mixed` basis as a skill-win or a `fog` as a `reef`; the ledger tag is ground
   truth, quoted, not re-inferred.
5. **No-pattern honesty is mechanical** (gated on `pattern_strength: none` / scatter)
   + one quiet scoping disclosure line (the irreducible small-n residual, disclosed).

## Guard

`src/lib/__tests__/insights-claim-strength.test.ts` (6) locks the Step-1
mechanical band, the count-bound strength, the over-claim vocabulary ban,
quarantine-but-count, verbatim tags, and mechanical no-pattern honesty.

## What's already good (do not "fix")

- The n=1 moat is real and robust (6/6 beats-generic/grounded/Barnum-free,
  surviving haiku). The value is in the accrued tags, not the model.
- **opus is already the target behavior** — the job was making it tier-independent.
- restraint held in form (no "don't do X" verdicts; suggestions stayed reference).
- The webapp's mechanical-counts approach is inherently disciplined — a validation
  of "rules=data / mechanical where possible."

## Next (R34) — fix-verification, not new exploration

1. Re-run the SAME 6 histories after the fix; score only `survives-skeptic`
   (claim strength ≤ what n allows) and `no-pattern honesty AT HAIKU` (does the
   mechanical band make haiku == opus on the 2 noise cases?).
2. Add adversarial low-n histories (n=3 all-different-domains; a dramatic n=1 miss;
   an all-`luck` "lucky streak" — does the loop credit it as skill?).
3. Directly test the dropped-entry failure (does it quarantine-but-count, or drop
   like sonnet did?).
4. Honest: R33 is still self-scored simulation — final validation is ONE real
   user's accrued ledger.
