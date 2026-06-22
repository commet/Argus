# R34 — Verification: the R33 claim-strength fix works (no new code)

> 2026-06-20. Fix-verification round (not new exploration). Re-ran 6 histories,
> each an archetype targeting a specific R33 failure mode, x 3 model tiers, on the
> FIXED `log/SKILL.md`. ~32 agents. No code change — R34 is the verification record
> for the fix shipped in R33 (commit 47cb12c).

## Result: the fix cleared both targets, cleanly

| Metric | R33 | R34 |
|---|---|---|
| value survives skeptic | 0/6 | **5/6** (only a2; correct — see below) |
| haiku no-pattern honesty (2 noise archetypes) | 0/2 (both manufactured) | **2/2 honest, 0 manufactured** |
| respected_strength (claim ≤ what n allows) | — | **16/16 across all tiers** |
| spine_violations | (live on haiku) | **0 everywhere** |
| counterexample dropped | sonnet dropped one | **0 everywhere** |
| luck kept separate (quarantine-but-count) | — | **yes across tiers** |

Both R33 regressions cleared: haiku pattern-manufacture (gone) and the sonnet
counterexample-drop (gone). **Why it held:** the fix converted a discretionary
judgment ("scale confidence to sample size") into a deterministic
number-then-band the model only has to obey (compute `pattern_strength` in Step 1,
bind Step 3 to it) — that genuinely shrinks the discretion surface where haiku
failed.

## a2 is the floor, working as designed (accept)

`a2-dropentry-n7` is the only non-survivor. Its fix target HELD (quarantine-but-
count worked, dropped=0, strength respected, 0 spine violations) — yet the
resulting hedged claim still doesn't survive the skeptic. That is correct: a
record carrying a genuine counterexample yields an honestly-weak, contestable
claim; making it "survive" would require re-introducing the R33 over-claim. The
skeptic defeating a weak-by-construction claim is the system working. The closing
scoping line ("법칙이 아니라 참고고, 건수에 맞춰 말했어요") already discloses this.

## Honest ceiling (why the product-level disclosure stays — NOT optional)

1. **No runtime.** The plugin is markdown; "mechanical" here is still prose the
   model self-executes. n=6 with only 2 noise cases is too thin to RETIRE the R29
   prose-ceiling finding. This is a strong mitigation, **not a proof** — do not
   claim "no-pattern honesty is guaranteed at haiku." The product-level tier
   disclosure stays as a backstop.
2. **Still self-scored simulation.** True validation needs ONE real accrued ledger.
   The funnel shows 0 sealed contracts — the settlement loop has never run on real
   data. This is the method's ceiling (per `plugin-hardening-cautions`).

## Coverage note (honest)

Two cells dropped on transient API errors (a4@opus, a5@sonnet) → the tier matrix
is uneven (opus saw only 1 of 2 noise cases). Not failures; fill in a later round.

## Decision

**SHIP confirmed** (R33 fix already pushed; guard `insights-claim-strength.test.ts`
locks it). The settlement-loop engine is now in good shape. The remaining gaps are
(a) a true runtime pre-compute of `pattern_strength` (the durable R29 fix — a
bundled deterministic script, deferred: prose passed this round and the marginal
value is low until real users exist) and (b) real-data validation (blocked on 0
sealed contracts — a front-door problem, not a judgment problem).

## Next (R35) — broaden, not over-polish

Per "don't just inflate": the settlement loop is verified; further polishing a
passing surface is diminishing returns. R35 moves to the highest-leverage unprobed
VALUE question — **does the crew (team → verify → boss) actually beat a single
strong answer?** The product thesis sells "one compressed screen, not multi-agent",
so the crew is internal theater: it must measurably IMPROVE the bearing, or it is
cost without value.
