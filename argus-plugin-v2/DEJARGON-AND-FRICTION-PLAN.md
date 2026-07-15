# Plain-language + friction plan (proposal for sign-off) — 2026-07-14

Three founder directives from the user-value review, turned into a concrete,
reviewable plan. **The words are your brand decision** — this proposes specific
replacements so you can approve/tweak in one pass; deciding the words IS the hard
part. Once the map is locked, applying it across the 20 skills is mechanical.

Applying a holistic rename half-way makes the mixing WORSE (the exact thing you
flagged), so nothing is renamed until the map below is signed off.

---

## 1. De-jargon — align the PLUGIN to the MCP's already-plain vocabulary

The real problem is not "the plugin needs prettier words." It is **one product
speaking two languages**: the MCP already unified on a plain canon
(`decision, prediction, predict, check-by, resolve, outcome, receipt, premise,
assumption, crux` — zero nautical terms), while the plugin still talks
`sail / seal / settle / bearing / fog / reef / anchor / voyage`. A user who
reads the MCP and then the plugin (or vice versa) is needlessly confused. So the
target vocabulary is **NOT invented — it is the MCP's existing canon.** Reuse it.

Pervasiveness (how many of ~20 plugin skills use the term) shows the blast radius:

| Plugin term | Uses | → MCP canonical word (already in use) | Note |
|---|---:|---|---|
| **bearing** | 17 | **crux** (the one neutral question) + "the read" | MCP surfaces a `crux`, never a verdict — same concept. |
| chart | 10 | **version history** | MCP has no chart; plainest word. |
| voyage | 9 | **decision** | MCP's word (21 uses). |
| Current Heading | 8 | **current call** | |
| fog | 8 | **assumption / unknown** | MCP uses `assumption`. |
| reef | 8 | **risk** | |
| anchor | 6 | **resolved / done** | MCP's terminal state is `resolved`. |
| crew | 5 | **reviewers** | |
| helm | 5 | **pre-approval scan** | |
| deaf rowers | 2 | drop → "the reviewers don't judge you" | |
| road not taken | 1 | **the other option** | |
| Sirens | 1 | drop → "pressure to change your mind" | |

Also align the CONCEPT verbs to the MCP so the same action has ONE name:
- plugin **seal** → **predict** (MCP: `argus_predict` = save a falsifiable prediction)
- plugin **settle** → **resolve** (MCP: `argus_resolve` = record what reality did)
- plugin **track / premises** → **premise** (MCP's word)

**Command names (`/argus:sail` etc.):** the strongest "don't confuse people" fix
is to rename the commands to match the MCP verbs too (`/argus:seal`→`/argus:predict`,
`/argus:settle`→`/argus:resolve`), so a user never meets two names for one action.
That is more disruptive (muscle memory, docs, installs). **Your call:** (a) align
commands to the MCP too (fullest consistency), or (b) keep command names, align only
copy + internal code + concept words. Recommendation: (a) — the whole point is one
vocabulary.

Internal code identifiers mirror the same MCP words, so the plugin code and the
MCP code read as one system.

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
