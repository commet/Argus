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

**DECIDED: align everything, including command names** ("다 맞춰야 돼", 2026-07-14).
Proposed command renames (approve/tweak in one pass — several have no exact MCP
twin, so these are recommendations):

| Plugin command | → New | Basis |
|---|---|---|
| `/argus:seal` | **`/argus:predict`** | MCP `argus_predict` — same action |
| `/argus:settle` | **`/argus:resolve`** | MCP `argus_resolve` — same action |
| `/argus:track` | **`/argus:premises`** | MCP concept `premise` |
| `/argus:chart` | **`/argus:versions`** | "chart" is jargon; plain |
| `/argus:log` | **`/argus:journal`** | plain |
| `/argus:helm` | **`/argus:preapprove`** | "helm" is jargon; plain |
| `/argus:sail` | **`/argus:review`** (or keep as flagship) | MCP has `argus_review`; sail is broader — FOUNDER CALL |
| `/argus:scan` | keep | already plain enough |
| `/argus:clarify` | keep (or `/argus:reframe` to match the web) | plain; web uses "reframe" — FOUNDER CALL |
| `/argus:verify` `/argus:team` `/argus:revise` `/argus:boss` `/argus:principles` `/argus:connect` `/argus:push` `/argus:pull` `/argus:sync` `/argus:help` `/argus:configure` | keep | already plain |

Internal code identifiers mirror the same MCP words, so the plugin code and the
MCP code read as one system.

## Every place a rename must touch (so nothing is left half-mixed)

In-plugin reference counts (today): sail 29 · settle 24 · boss 24 · verify 21 ·
chart 18 · team 17 · revise 17 · clarify 14 · seal 11 · scan 10 · log 10 ·
helm 8 · track 6. Each command also has: its skill directory, frontmatter
`name:`/`Invoked as`, `argument-hint`, cross-references in OTHER skills, the
`help` command list, `_generated/`, and the validator.

**Out-of-plugin references (must change in the SAME sweep):**
- `README.md`, `README.ko.md`
- web app: `src/app/[locale]/import/page.tsx`, `src/lib/ledger-schema.ts`
- MCP: `argus-mcp/src/v2/brief.ts`
- docs: `docs/ARGUS-REPO-MAP.md`, `docs/ARGUS-MCP-V2-SPEC.md`,
  `docs/ARGUS-MCP-V2-DESIGN-HISTORY.md`

## Execution + verification (one focused sweep)
1. Lock the command/term map above (founder approves the FOUNDER-CALL rows).
2. Rename skill directories + update every reference (in-plugin + out-of-plugin).
3. Apply the term map (copy + internal identifiers).
4. Verify: `node argus-plugin-v2/scripts/validate-plugin.js`, the web build
   (`npm run build`), the MCP build/tests, and a final
   `grep -ri "sail\|bearing\|voyage\|fog\|reef\|anchor\|seal\|settle\|helm\|chart"`
   sweep for stragglers. Zero half-renamed references before commit.

Because references span three code areas (plugin, web app, MCP) plus docs, this
is best run as ONE dedicated pass so the result is uniform — a partial rename is
worse than none.

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
