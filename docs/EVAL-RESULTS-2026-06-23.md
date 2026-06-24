# Argus behavioral-eval results (2026-06-23)

First live run of the expanded 50-case corpus + the per-tier sweep. Gen = the real
clarify+sail SKILL.md; judge = LLM tilt judge. Reproduce: `npm run eval` (full 50),
`EVAL_KINDS=flat,low_stakes npm run eval:sweep` (tier sweep). Over-fire/tilt are
single-run (no EVAL_REPEAT), so read them as directional, not 3-decimal precise.

## Full 50-case run (gen=sonnet-4-6, judge=opus-4-8)

| metric | value | floor | verdict |
|---|---|---|---|
| crisis off-ramp rate | **1.00** | =1.0 | ✅ all 7 crisis inputs off-ramped, no verdict (P0 safety) |
| flat over-fire rate | **0.118** | ≤0.34 | ✅ well under the rounds-5–8 redesign floor |
| flat tilt rate | 0.294 | — | measured (judge-flagged subtle lean on flat cases) |
| low-stakes over-fire | 0.125 | — | measured |
| fork tilt rate | 0.538 | — (not gated) | the irreducible `value∝leverage∝tilt` residual, consistent across runs |
| inconclusive | 0 | — | judge retry held; no false-tilt |

The eval found real residual tilt across the larger corpus (its job). One over-detection
noted: a config-format case used the word "schema" (a machinery term) → flagged; the
forbidden-terms list is blunt in domain-legitimate contexts.

## Per-tier over-fire sweep (gen-tier varies, judge=sonnet-4-6, cached)

Single-run (flat+low, n=17 flat) was directional; the **EVAL_REPEAT=3 flat run (n=51
per tier)** is the tighter estimate — use it.

| gen tier | flat over-fire (n=17, single) | **flat over-fire (n=51, ×3)** | floor (≤0.34) |
|---|---|---|---|
| **haiku-4-5** | 0.41 | **0.412** | 🔴 BREACHES (consistent) |
| **sonnet-4-6** | 0.12 | **0.216** | ✅ holds (~0.12 margin) |
| **opus-4-8** | 0.18 | **0.235** | ✅ holds (~0.10 margin) |

**Finding (confirms R29 with hard numbers):** the under-fire default is **tier-dependent**.
Across 51 samples/tier, **haiku breaches the 0.34 floor (0.41), consistently**; sonnet
(0.22) and opus (0.24) hold, but with a thinner margin than the optimistic single run
suggested. The sweep exits non-zero on haiku — correct behavior, not a harness failure.

**Two things the repeat run sharpened:** (1) the single-run sonnet/opus numbers were
optimistically low — the real over-fire sits ~0.22–0.24, so the margin to the floor is
~0.10, not ~0.20; worth re-checking after any spine-prompt change. (2) **sonnet ≈ opus**
on over-fire (0.22 vs 0.24) — paying for opus on bearing-generation buys nothing here,
so sonnet-4-6 is the cost/quality optimum for the product (opus reserved for the eval
judge on definitive runs only).

**Recommendation:** route the plugin's bearing-generation (clarify/sail synthesis) to
**sonnet or stronger**, never haiku — exactly what dim10's model-routing guidance says
(workers on the cheap tier, planning/synthesis on the strong tier). This sweep is the
data backing that guidance. Re-run with `EVAL_REPEAT=5` for tighter intervals before
treating any single number as definitive.

## Cost note
The eval now caches the (identical, large) clarify+sail system prompt via Anthropic
prompt caching (~90% input reduction on repeated calls) and defaults the judge to
sonnet (opus available via `EVAL_JUDGE_MODEL` for a definitive run). The earlier runs
without caching + an opus judge were the main eval cost driver.
