# Plain-language + friction plan (proposal for sign-off) — 2026-07-14

Three founder directives from the user-value review, turned into a concrete,
reviewable plan. **The words are your brand decision** — this proposes specific
replacements so you can approve/tweak in one pass; deciding the words IS the hard
part. Once the map is locked, applying it across the 20 skills is mechanical.

Applying a holistic rename half-way makes the mixing WORSE (the exact thing you
flagged), so nothing is renamed until the map below is signed off.

---

## 1. De-jargon — the term map

**Recommended scope: user-facing copy + internal code identifiers. KEEP the
command names** (`/argus:sail` etc.) — renaming commands breaks muscle memory,
docs, install scripts, and settings, for less readability gain than fixing the
copy. (If you want command renames too, say so and I'll add them.)

Pervasiveness (how many of ~20 skills use the term today) shows the blast radius:

| Nautical term | Uses | Proposed plain replacement | Note |
|---|---:|---|---|
| **bearing** | 17 | **the read** (or "the takeaway") | The one-line output. NOT a verdict/recommendation — keep it neutral. |
| chart | 10 | **version history** | |
| voyage | 9 | **decision** (or "review") | one run over one decision |
| Current Heading | 8 | **your current call** / "where you're leaning" | |
| fog | 8 | **unknowns** / "what's unclear" | |
| reef | 8 | **risks** / "hazards" | |
| anchor | 6 | **done** / "final" | the closed/settled state |
| crew | 5 | **reviewers** | the parallel agents |
| helm | 5 | **pre-approval scan** | (also the `/argus:helm` command — keep name, gloss it) |
| deaf rowers | 2 | drop the term → "the reviewers don't judge you" | |
| road not taken | 1 | **the other option** / "alternative" | |
| Sirens | 1 | drop the term → "pressure to change your mind" | |

Command names stay, each gets a plain one-line gloss in `help`:
`sail`=start a decision review · `scan`=find past decisions in your chats ·
`seal`=lock a prediction to check later · `settle`=record what reality did ·
`clarify`=sharpen the question · `verify`=split claims (supported/challenged/
human-required) · `team`=run reviewers in parallel · `revise`=apply feedback into
a new draft · `chart`=version history · `log`=your decision journal ·
`boss`=stakeholder pressure-check · `helm`=silent pre-approval scan ·
`track`=manage a decision's premises · `principles`=turn your patterns into rules.

Internal code identifiers (variables/functions using the metaphor) mirror the
same plain words, so reading the code stops requiring a decoder.

## 2. Cap the questions at 2 (friction fix)

Today `clarify` has 7 `AskUserQuestion` points and `sail` has 6; a medium/high run
fires ~4-5. Target: **at most 2 per run.**

Proposed rule (for sign-off):
- **Keep (max 2):** (a) the ONE load-bearing crux/weakness question when the gate
  fires; (b) the stakes/check-back question ONLY when `stakes_confidence < 75`.
- **Cut / make silent-default:** the BIND lean pre-ask, the second fork probe, and
  the Wake re-ask become optional/inferred — surfaced in the output, not asked.
- Disambiguation ("which PR/branch?") only when genuinely ambiguous, and it counts
  toward the 2.

## 3. Over-fire gate (make the restraint enforceable)

Today the anti-tilt / anti-fog / no-manufactured-fork rules are prompt prose with
no loud failure. Plan: extend `argus-plugin-v2/evals/` static-gate so a produced
`bearing`/`read` is checked deterministically and FAILS CI when it:
- states a directional verdict or a disclaimed lean ("leans toward X but…"),
- emits a two-pole fork on a flat/reversible case,
- manufactures fog (names an "unknown" with no basis in the input).
The regex tells already exist in the MCP's `surface-lint.ts` (shared brain) —
reuse them so the plugin and MCP can't drift.

---

## Suggested order (once the map is signed off)
1. Lock the term map (your word choices).
2. Question-cap (bounded, immediate friction win).
3. Over-fire gate (enforce restraint).
4. Apply the term map across all 20 skills + internal code in one sweep.

Given the term map is a one-time brand decision and step 4 is a large consistent
sweep, steps 1 + 4 are best done as a focused pass so the result is uniform.
