# R57 — campaign re-anchored to the core; close the real_bet authorship wash

## Course correction (why this round exists)

R52–56 drifted: they hardened file durability (atomic writes, concurrency, crash
recovery) — real work, kept, but NOT what the stress-test campaign is *for*. The
campaign exists to keep the decision **engine** on its spine (`max generation, zero
judgment`) — over-fire, tilt, judging the user, manufactured meaning. R57 returns
to that, and grounds the next rounds in a re-derived statement of who uses Argus and
what they need.

### The core (re-derived from the user base, not assumed)

Across every user type — solo founder, senior IC, PM, the over-thinker, the person
in an irreversible spot — the common, load-bearing need is the same:

> Argus hands a **tired decision-maker their own judgment, sharper**: it *recognizes*
> what they are actually deciding, surfaces the one load-bearing assumption they
> can't see **as a question** (not a verdict), **keeps authorship theirs**, and
> **remembers** so the next decision beats the last.

Four invariants fall out: **recognition · the one true question · retained ownership
· compounding calibration.** Every churn mode the founder named maps to violating
one: too-hard/long → not actable / not compressed; too-easy/short → restraint
flipped to abandonment; too-artificial → Barnum / fake neutrality → recognition and
trust break at once.

## Round A — code-truth audit (the worklist, falsifiable not self-play)

Verified the R1–8 synthesis prescriptions + R10's 6 confirmed bugs against current
`src/`. Result, sorted by **core impact**:

| Gap | Core invariant violated | Status |
|---|---|---|
| `real_bet` washing (Falsification.tsx skip path) | **ownership + compounding calibration** | NOT-DONE → **fixed this round** |
| over-fire gate is render-suppress, not pre-manufacture (probe/progressive) | restraint only skin-deep; engine still manufactures the fork | PARTIAL |
| no product-level disclosure of residual lean (P1-2) | honesty / no fake neutrality | NOT-DONE |
| leverage-ranking of *assumptions* + mirrored-poles guard (P1-1) | the one true question (selection) | PARTIAL |
| boomerang scan on rejected identity verdict (P1-3) | don't judge the user | PARTIAL (rejection present, scan absent) |
| regression fixtures: leverage⊥prior, closed-buried, delegation (P2) | regression safety | MISSING |
| standalone age/vulnerability gate (R10 bug 6) | crisis honesty | PARTIAL (folded into crisis gate) |

DONE and confirmed: crux_question firing form (P0-2b), no tilt-tagging (P0-2c), 5/6
R10 bugs fixed (current-bearing multi-state, deleteAllUserData, CrossProjectRecord
loss fields, §0 gates, crisis classifier). Scoring is independent (not self-play).

## The fix this round — honest authorship on the friction skip

`decision-contract.ts` treats `real_bet` as the **top** source of the sealed
prediction, and `ledger-schema.ts` defines it as *"the user's restated bet."* So the
no-friction skip writing `real_bet: surfaced` meant a **machine-surfaced assumption
the user never authored was sealed into their calibration record** — the moat itself,
polluted. That is the most direct violation of two core invariants (ownership +
compounding calibration), and the synthesis flagged it as a LIVE defect.

Per CLAUDE.md A1 the fix is **honest provenance, not a forced-typing gate** — keep
every friction escape:

- New optional `Falsification.real_bet_authored: 'user' | 'ai_surfaced'` (legacy
  absent = 'user').
- `Falsification.tsx`: the typed/locked path (incl. "use as-is" → lock-in, an
  affirmative adoption) tags `'user'`; the silent "just give me the document" skip
  tags `'ai_surfaced'`. The skip button stays — only the lie is removed.
- The tag travels automatically (`store.setFalsification(f)` persists the whole
  object → session.falsification → ledger projection).
- Tests lock both directions: skip → `ai_surfaced`, typed/use-as-is → `user`.

`falsification-render.test.tsx`: 9/9 pass.

## Next (core-ordered, not list-ordered)

- **R58 — calibration honesty (settle side):** now that provenance is tagged, make
  the ledger/settle separate an `ai_surfaced` bet from the user's own judgment —
  exactly the luck-vs-judgment separation (R17). An ai-surfaced bet that "held" must
  not compound into the track record as the *user's* skill. This finishes what R57
  started (tag → actually honor the tag in calibration).
- **R59 — pull the over-fire gate upstream:** make the flat/DO-FIRE gate prevent
  manufacture, not just suppress render (audit PARTIAL), so a render-path change
  can't re-expose the manufactured fork.
- **R60 — product-level lean disclosure (P1-2):** the one-time honest "we surface
  the one question; a faint lean may remain" — fake neutrality is a trust break.
