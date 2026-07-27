# Changelog

All notable changes to the Argus plugin. Versioning follows
[semver](https://semver.org); users receive an update only when the
`version` in `.claude-plugin/plugin.json` is bumped.

## 2.21.3 — 2026-07-28

- Wire moves to `argus-decision-mcp@1.15.2` — three live defects found by
  adversarial audit are fixed: long picker answers are no longer destroyed,
  an unreadable ledger refuses writes instead of allowing a duplicate seal,
  and the settle card is now actually executed by a gate.

## 2.21.2 — 2026-07-27

- Wire moves to `argus-decision-mcp@1.15.1` — the confirm picker carries no
  validation constraints (a blank one-tap Accept can no longer be blocked by
  the host), and a picker that closes without an answer offers the plain-text
  save instead of dropping the user's work.

## 2.21.1 — 2026-07-27

- **`/argus:doctor` stops crying wolf about npx caches.** A machine with eight
  leftover installs printed six `⚠ 낡은 배선이다` lines while the session was
  correctly on the pinned build. That warning's premise died when the pin
  became exact — a stale copy cannot be selected. With the pin present in
  cache, stale copies now collapse to one quiet line; the loud warning is
  reserved for the case that still bites (pin absent). Guarded by
  `doctor-cache-noise.test.mjs`.

- **The return loop stops hiding which wire answered.** `/argus:check` routed
  straight to a file-only ledger replay, so a session with the MCP server
  disconnected — or running a stale cached build — got the same confident
  answer as a live one, and neither `server_version` nor `picker` was
  reachable from the command a user actually types. `resolve` now prefers
  `argus_check_in` when the tools are present (same replay the server does,
  plus bearing seeds), flags a version disagreement in one line, and says
  "MCP 미연결 — 파일 기록만 읽었습니다" when it falls back. Found by founder
  dogfooding immediately after the 1.15.0 ship.

## 2.21.0 — 2026-07-27

- Wire moves to `argus-decision-mcp@1.15.0` — the settle picker becomes an
  MCP Apps CARD (five reality buttons + date control) on supporting hosts;
  everywhere else keeps the current picker unchanged.

## 2.20.1 — 2026-07-27

- Wire moves to `argus-decision-mcp@1.14.1` — the logbook's three groups get
  distinct faces (`!` / `~` / `⚓`) and anchored rows lead with the outcome word.

## 2.20.0 — 2026-07-27

- Wire moves to `argus-decision-mcp@1.14.0` — one-week default check-by when
  no horizon is named, `format:"date"` hints on picker date fields, and the
  guru-depth untouched-side probe (12/12) behind it.

## 2.19.1 — Release alignment — 2026-07-27

- The exact bundled wire moves to `argus-decision-mcp@1.13.1`, which includes
  the untouched-side hidden-assumption pass that landed immediately after the
  first foundation release.
- Plugin, marketplace, MCP package, and registry now identify the same main
  source rather than leaving post-tag main changes under an already published
  version.

## 2.19.0 — Judgment foundations — 2026-07-27

- The bundled MCP pin moves with this release to
  `argus-decision-mcp@1.13.0`.
- New records preserve four user-facing intents without exposing internal kind
  names: check against reality, check what I did, revisit my standard, or keep
  only the record.
- Sealing keeps the user's first utterance, derivation evidence, skipped review
  conditions, event plus fallback return, and AI-adoption lineage.
- Kind and wording corrections append to history; they never rewrite the first
  record.
- `/argus:resolve` shows the original first, asks one kind-appropriate question,
  records the user's answer across independent axes, and never emits a score or
  track-record aggregate.
- Ambient detection can notice a named event once, but it cannot settle a record
  or promote an AI draft without explicit user authorization.

## 2.18.0 — 2026-07-27

- **Wire moves to `argus-decision-mcp@1.12.0`** — sharper prediction
  drafting (falsifiable defined, no double-ask beside pickers), Korean
  locale detected from nested premise text, and the LOGBOOK/항해일지
  identity on the wake box.
- READMEs now show the Judgment Receipt keepsake up front.

## 2.17.0 — 2026-07-27

- **Wire moves to `argus-decision-mcp@1.11.0`** — the settlement/premises/ambient
  pickers no longer declare required fields, so hosts stop collapsing the enum
  and stop blocking an empty Accept with an in-form "This field is required"
  (the dead-end the founder hit live on 2026-07-27). Empty Accept now flows the
  same honest path as Decline; the server re-asks instead of the form blocking.

## 2.16.0 — 2026-07-26

Wire truth. The plugin launched the MCP server with a **range** spec
(`argus-decision-mcp@^1`), and npx reuses a cached install whenever the spec is a
range — so the founder's wire sat frozen on 1.2.0 from 2026-07-13 while seven
releases were published. Every gate was green because every gate looked at the
repo; nothing anywhere reported the version a live session actually launched.

- **`.mcp.json` pins an exact version** (`argus-decision-mcp@1.10.0`). Guarded by
  `argus-mcp/src/v2/one-install.test.ts`: a range spec fails, and the pin must
  equal the server's own version, so a server bump without a wire bump is red.
- **`/argus:doctor` shows the wire** — new `[10] MCP 배선 버전` section prints the
  pinned version and every `argus-decision-mcp` build sitting in the npx caches,
  flagging any that disagree with the pin. Read-only, offline-safe, never throws.
  `doctor.md` then has the model confirm it in-session against
  `argus_check_in`'s `data.server_version` (the only place the *running* build is
  visible) — the honest-gap split between what a script can know and what it can't.
- **The every-turn hook tells "stale" from "disconnected."** `sense-signal.js`'s
  broken-wire guard used to report both as "MCP not connected", which sends the
  user to `/mcp` when the actual fix is clearing the npx cache. It now keys on the
  legacy tool names (`argus_seal` / `argus_settle` / `argus_open_decision`) being
  present while the current ones are absent, and prescribes accordingly.

> Housekeeping note: this file has no entries for 2.13–2.15 (those shipped with
> their work recorded in commits and in `evals/detection/EVOLUTION-LOG.md`). The
> gap is left visible rather than back-filled from memory.

## 2.12.1 — 2026-07-21

Ports the MCP 1.6.1 detection sharpening into the plugin's own UserPromptSubmit
hook so Claude Code users get the same improvement.

- **Load-bearing assumption sense aimed at the unstated premise.**
  `sense-signal.js` sense #3 now targets the specific fact the decision reverses
  on if false — not the surface reason the user already stated. Same spine
  invariants. Frozen-bench plugin extraction 2/6 → 12/14 (judge validated 1.0).
- **Prefilter recall gap fixed.** `돌리자 / 되돌리자` (revert-to decisions) added
  to the proposal cues, so office-return-type decisions are no longer skipped by
  the deterministic pre-filter.

## 2.12.0 — 2026-07-21

Long sessions stop starving; the mirror gets measured. Driven by the overnight
self-evolution loop (real-API synthetic eval + adversarial judges; round log in
`evals/detection/EVOLUTION-LOG.md`).

- **Sense caps reworked for long sessions.** The every-turn diagnosis budget
  moves from a hard 3-per-session to a sliding window: up to 3 injections per
  2-hour window, session ceiling 12. Outcome-only re-injection cap 4 → 8
  (settlement is bookkeeping). State file migrates old formats conservatively.
- **Offers are per-decision, not per-session.** Offer at most once per distinct
  decision — a skip is final for that decision; never two replies in a row, and
  two skips in a session means silence for the rest of it.
- **Restraint sharpened against measured over-fire.** Task requests, logistics/
  scheduling, and small talk are named as non-decisions in the injected
  diagnosis (measured: over-fire down 52% → 30% on dense synthetic sessions
  with recall unchanged).
- **Eval: mirror quality enters the objective.** New spine judge (does a fired
  capture read as a verdict/fork/lean?) and a role-played busy-user judge
  (would they tap Keep? are they annoyed?) — acceptance/annoyance are now
  measured alongside recall, so the loop cannot optimize firing at the spine's
  expense.

## 2.11.0 — 2026-07-20

Detection, from scratch: the sense hook now delegates DETECTION to the model's
meaning-judgment and keeps rules only as a cheap prefilter + an unshakable floor.
A rule can flag a marked "as long as / ~니까" premise (the easy 10%); it can never
extract the UNSTATED assumption a decision rests on (the valuable 90%) — that is
generative work only the model can do. So the trigger stays code (a deterministic
every-turn hook), but the detection moves to the model.

- **`sense-signal.js` rewritten.** On every turn the hook injects a three-sense
  diagnosis instruction (a checkable prediction · an outcome, pronoun references
  included · the single load-bearing, often unstated, assumption) and hands the
  model only what it cannot see itself: the ledger's open predictions and the
  verbatim rule-candidate spans (a floor, not the detector).
- **Scan window covers both sides.** The hook now reads the previous assistant
  turn from `transcript_path` alongside the user message — premises and
  predictions surface in the answer as much as in the ask.
- **`prefilterTurn()`** — a high-recall disjunction gate that decides only whether
  a turn is worth a diagnosis injection (a cost gate, not the detector). Firing
  policy: diagnosis at most 3×/session; outcome-only re-injection is separate
  (the old single once-per-session gate silently blocked settlements too).
  User-facing restraint is enforced by the instruction (offer once, a skip is
  final, silence on a flat/reversible/closed call, never two asks in one reply).
- **Measurement first.** `evals/detection/` adds a 31-case labeled corpus (ko/en,
  four labels + negatives) with a CI hard-gate: the prefilter must never skip a
  labeled positive (a skipped positive is a silent blind spot). Plus a live
  detection eval, an MCP-firing simulation, and a real-transcript recall harness.

## 2.10.0 — 2026-07-17

Boss review, seat-first (공정 O3 방3): the stakeholder pressure-check now draws
its substance from the SEAT — role, what it owns, its goals and authority — and
personality is demoted to an optional voice skin. Grounded in R42's head-to-head
(all surviving value came from the seat; 0/5 from the MBTI type) and the product
evaluation's "personality-test theater" warning.

- **Config**: `boss` block is seat-first — `role` / `owns` / `goals` /
  `authority` (+ `name`, `gender`). `tone` is an optional 16-preset voice skin;
  legacy `mbti_code` still works as a tone alias, so existing configs keep
  their voice. Nothing requires a type anymore.
- **Prompt**: the seat block leads ("You own …", "Your authority … — speak only
  within it"); the tone skin is injected only as voice, with the type code kept
  out of the prompt entirely so it can never leak.
- **Mechanical anchor**: every concern must carry `seat_basis` (schema-required)
  — the old M2 catch-phrase mimicry gate is retired as theater; the new
  deterministic check is "no seat, no concern". Report header no longer shows a
  type label (fixes R42's own "never surface it" rule).
- **Over-fire fix**: `dm-feedback.json` no longer forces `minItems: 1` concerns
  — on a clean, verified, reversible scaffold, `concerns: []` plus one approval
  condition is the honest output (the schema was contradicting the skill's own
  R42 restraint rule).
- **Configure**: gathers the seat in one compact turn; the two-question MBTI
  quiz mapper is retired. `seat-not-type.test.ts` pins the structure (no
  required type, seat fields present, no type label in the report, no concern
  manufacturing).

## 2.9.0 — 2026-07-17

Commands 20 → 5 (공정 O3 방2): one quiet product, five doors, and a structural
guarantee that the deep review never fires on its own.

- **5-axis surface**: `/argus:review` (deep pressure-test — the full pipeline),
  `/argus:check` (due · settle · seal `<id>` · `premises`), `/argus:history`
  (journal · `versions` · principles · `scan`), `/argus:settings` (configure ·
  `connect <token>` · push/pull/`sync`), `/argus:help`. Kept aliases:
  `/argus:sail` (= review), `/argus:resolve`. Old command names still work when
  typed (menu-hidden via `user-invocable: false`) — printed hints and webapp
  copy now teach the axis names.
- **Auto deep review = 0, structurally**: `review` and `sail` carry
  `disable-model-invocation: true` — the model cannot auto-open the reviewer
  pipeline from natural conversation (its description never enters ambient
  context). The former step skills (clarify, team, verify, boss, revise) moved
  INSIDE `skills/review/` as supporting files, so no auto-invocable skill
  carries fan-out vocabulary. `activation-contract.test.ts` pins all of it
  (menu inventory, door flags, fan-out closure, no-resurrection, help scope).
- **One due announcer**: `check-contracts.js` now folds BOTH storage planes
  (project v1 UNION durable home, statusline-parity incl. v:2 events) and is
  the sole SessionStart due voice; the absorbed `session-start.js` hook no
  longer counts dues (it keeps stale-LOGBOOK repair pointers, first-run
  welcome, harvest queue).
- Natural language stays quiet by design: talking about a decision routes to
  capture/seal via the bundled MCP, never to the reviewer fan-out.

## 2.8.0 — 2026-07-17

One install (공정 O3 방1): the separate `argus-driver` plugin is absorbed — the
marketplace now lists exactly one plugin, and installing it is the whole setup.

- **MCP wired by install**: bundled `.mcp.json` registers `argus-decision-mcp`
  (npx, major-pinned `@^1`) — no separate driver plugin, no init command.
- **Driver hooks absorbed**: the quiet SessionStart check (due decisions +
  stale-LOGBOOK regeneration pointer) and the ambient one-question trigger
  (session-once + 4h cooldown, silence default, `ambient.opt_out` respected)
  now ship here, unchanged.
- **`/argus:doctor` absorbed**: read-only install/wiring self-diagnosis.
- **`argus-driver` retired**: directory and marketplace entry removed; its
  statusline was a byte-copy of this plugin's (the canonical one) all along.
  Existing driver installs keep working but stop receiving updates — uninstall
  `argus-driver` and keep `argus`. Uninstalling never deletes decision records.
- Structural guard moved with the merge: `one-install.test.ts` pins "exactly one
  marketplace entry, bundle complete, README teaches one install command".
  SessionStart now announces due items from both ledger planes (v1 contracts via
  check-contracts.js, v2 LOGBOOK via session-start.js); single-owner
  deduplication is deferred to the command-consolidation room (O3 방2).

## 2.7.0 — 2026-06-24

Quality, measurement, and trust infrastructure — turning "we wrote the rules" into
"we measure that the rules actually fire", plus the cross-surface single-source the
two-bodies architecture needed. (Benchmarked against the substantial Claude Code
plugins/skills/MCP; gaps closed across 10 dimensions — `internal design notes-2026-06-23`.)

- **Behavioral eval harness** (`evals/`): generates bearings from the real clarify+sail
  skills and scores them — static gate (deterministic, in CI) + LLM judge + a per-tier
  sweep. Live finding: over-fire is tier-dependent — **haiku breaches the spine floor
  (~0.41); sonnet/opus hold (~0.22)** → route bearing-generation to sonnet+. Prompt
  caching keeps re-runs cheap. (`internal design notes-2026-06-23`.)
- **Enforcement gates** (`scripts/validate-gates.mjs` + a `Stop` hook): the verify /
  route-contract / flat / output-integrity gates are checked mechanically against
  session artifacts (warn-mode hook + CI hard-block) — prose rules are a floor, not
  enforcement.
- **Single-source generator** (`scripts/generate-contracts.mjs`): machinery-terms,
  crisis-taxonomy, and course-status are single-sourced in `data/contracts/`, with
  parity assertions across the webapp ↔ plugin seam and a CI sync guard (drift caught).
- **Output integrity**: a failed/empty/weak worker can no longer be silently dropped or
  promoted as "verified" (team failure contract + gate).
- **Secret redaction** (`scripts/redact.mjs`): the "redact before use" rule is now a
  tested mechanical step (clarify pipes diffs through it), not just prose.
- **Run-cost accountability**: `team` warns before a large fan-out and offers `--lean`,
  with model-routing guidance (workers cheap, synthesis strong) — fan-out bills the
  user's own metered plan.
- **Untrusted-content / toxic-flow rule** in `clarify`: loaded PR/doc/repo content is
  data, never instructions.

## 2.6.0 — 2026-06-17

Under-fire default: the dial that decides *whether to intervene* is now pinned to
restraint across the whole pipeline. This is the plugin's answer to the validated
spine-level finding that the engine over-fires by architecture.

Context: the 4-round engine stress test (`internal design notes`,
~98 cases / ~400 agents) reached verdict **(b)** — a find-the-leverage engine
*manufactures divergence when none exists*: over-fire on **60%** of flat
negative-controls, and `asymmetric_steer` (an engine-weighted pole) was the
**modal** harm. The spine's mirror clause ("zero judgment" also means don't judge
*whether to intervene* in the user's stead) is not rule-patchable — it's a dial,
and the founder's fixed choice is **under-fire default + cheap user-pulled depth**
(CLAUDE.md rule 4, added this cycle). `/argus:preapprove` already embodied this (P0.B
silence-default weight-gate); 2.6.0 generalizes that discipline to the surfaces
that lacked it.

**Honesty note (read before trusting this):** the plugin is prompt-based with no
executable LLM in CI, so the new guards (`validate-plugin.js` string/schema
checks, `simulate-plugin.js` over-fire-shape lint) are a **regression floor, not
a safety proof** — the stress test proved tilt can live *below* structural
resolution. The real verdict needs the manual Round-5 protocol now written in
`TEST_PLAN.md` (strict 5-vote blind panel + the 10 R4 negative-controls). A
changeset that called string-presence "verified" would repeat the Round-3 mistake
(its 4.2% was an artifact of an incomplete battery).

### Added
- **clarify Step 2 — the under-fire dial (`frame_status`).** Before reframing,
  the load-bearing test is applied to clarify's *own* reframe: would flipping to
  the reframed question actually change the answer? If no, `frame_status: "flat"`
  — the surface question IS the real question; do not manufacture a different one,
  and Step 3.5 (the probe — a fork *generator*) is skipped. If yes,
  `load_bearing` and the pipeline runs. Default `load_bearing` only when genuinely
  unsure (a missed real fork is worse than one honest flat answer). New M-flat
  meta-check + forbidden pattern. Declared on the AnalysisSnapshot schema.
- **sail Step 6·0.5 — flatness gate.** A `frame_status: "flat"` decision does NOT
  deploy team/verify/boss; sail renders a restraint **FLAT course** directly (one
  assumption + a done-handle). This catches the gap `decision_density: low` and
  the v2.5 request-type gate miss: a *medium/high-stakes but flat* decision (all
  axes aligned, any branch lands the same). Ports helm's silence-default, not its
  irreversible-only trigger.
- **negative-control regression fixtures** — three R4 flat over-fire cases
  (folder-rename, satisfied-incumbent, working-Express-stack) baked into
  `simulate-plugin.js` as expected restraint bearings (empty `road_not_taken`,
  null `fog_or_reef`, proceed/anchor), plus an over-fire-shape lint (no
  manufactured fork on flat; gross pole-asymmetry floor). Manual Round-5 protocol
  added to `TEST_PLAN.md`.

### Changed
- **sail Current Heading is no longer a forced-fork generator.** The mandates
  "Always include 1-2 road-not-taken items" and "if none exists, create one from
  the rejected obvious alternative" are removed — `road_not_taken` is now
  load-bearing-gated (empty on a flat decision), and `fog_or_reef` no longer
  falls back to "the strongest remaining assumption" (a clean decision has no
  reef). The `current-bearing.json` schema relaxes `road_not_taken.minItems`
  1→0, and the `validate-plugin.js` guard that *enforced* the over-fire is
  flipped to match.
- **No engine-weighted pole.** When two poles are shown (`fork` status or two
  roads), they render at parity (comparable depth/word-count, no caveat stacked
  on one side, no "melting" one pole's cost, no verdict tone) + the crux; a
  swap-test self-check flattens tilt. A tilting bearing is a disguised verdict.
- **Refuse identity/moral verdicts as contracts + boomerang scan.** A
  `contract_seed` is a falsifiable claim about the world, never a verdict about
  the user; closing lines are scanned for soft re-issuance of a refused verdict
  (the R4 absolution-boomerang).
- **boss** no longer manufactures concerns on a clean reversible scaffold
  (`concerns: []` + one approval condition is valid) and only pushes
  `/argus:revise` when something is actually worth applying.
- **verify** must not manufacture minor challenges to look busy — zero challenges
  is a valid `verified`. (Asymmetric: a critical/important challenge is ALWAYS
  surfaced; this never licenses burying a real reef.)
- **settle** is reality-only — a missed/partial outcome no longer auto-offers
  `/argus:sail` (reopen-on-settle was over-fire); re-deciding is the user's move.
- The mirror clause (over-fire = spine violation) is now in the Forbidden
  Patterns / meta-checks of sail, clarify, verify, boss, and settle, so future
  skills inherit the under-fire default.

### Deliberately NOT done
- **No `ai_surfaced` provenance tagging added as "the fix."** R4 proved honest
  provenance is *necessary but not sufficient* — a tagged fork still tilts. Adding
  tagging and calling it the over-fire fix would repeat the exact error the
  synthesis warns against; it is deferred and, if ever added, is honesty-only.
- **No port of the webapp P0/P1 plan verbatim.** Those target `src/lib/*` files;
  the plugin's over-fire lived in different surfaces (sail render contract,
  current-bearing schema, verify/boss/settle). The byte-locked
  `data/prompts/probe-prompts.md` was left untouched (parity with the web engine).

## 2.5.0 — 2026-06-17

Step-0 gate: Argus now decides *whether* to run the engine before deciding
*what* to analyze. Closes the two-thirds of the C5 finding the harness lacked.

Context: the stress tests (`internal design notes`) found
the engine's most damaging failures came from running the full reframe→fork
machine on inputs that were not open decisions — re-opening a decision the user
had already closed, forking an emotional vent into options nobody asked for, and
(the subtle one) handing a *stuck* user more forks to hide behind when the real
bottleneck was avoidance, not analysis. The plugin already had the STAKES axis
(`decision_density: "low"`); it had neither of the other two step-0 axes. This
release adds them as a prompt-level front gate — not the unvalidated round-2
multi-pass architecture, which stays in `docs/` until reality contact. The
durable principle, not the literal pipeline.

### Added
- **clarify Step 1.7 — request-type & readiness gate.** Before any reframe,
  clarify classifies the raw input on two axes:
  - `request_type`: `open_decision` (the only type that flows the full
    pipeline) · `validation` (already decided — pressure-check, never re-open) ·
    `vent` (emotional processing — reflect and invite, never fork) · `info`
    (plain question — just answer). Default `open_decision` whenever unsure: a
    false non-open ejects a real decision, the more harmful error.
  - `readiness`: `resistance` (open_decision only, set ONLY on explicit textual
    signals of long-pending + no-new-info + back-and-forth) surfaces the
    avoidance as the live issue and routes to the smallest real-world test
    (settle loop) instead of spinning up more options. Else `ready`.
  - **Spine guard:** every non-open branch is a recognition the user can cheaply
    correct (honest provenance), keeps a one-line escape back to the full engine,
    and conditions on observables — never a verdict about who the user is. The
    Zero-Judgment gate (CLAUDE.md) is preserved: this makes Argus do *less* when
    less is right, never judge the user's decision in their stead.
- `request_type` + `readiness` declared on the AnalysisSnapshot schema (a silent
  field would never reach sail's router); both absent → `open_decision`/`ready`
  for back-compat with pre-2.5 snapshots.
- **sail Step 6·0 — request-type gate.** sail reads `request_type` and refuses to
  escalate `validation`/`vent`/`info` (and `open_decision` + `resistance`) into
  team/verify/boss. Only an open, ready decision flows the crew.
- validate-plugin.js guards: the Step 1.7 section and its four types, the two new
  schema enums, and sail's request_type routing — so the gate can't silently
  regress (verified non-vacuous).

### Changed
- clarify Step 2's reframe mandate ("real_question MUST NOT be the surface
  question") is now scoped to `open_decision`. A `validation` request is answered
  against the decision the user already made and is never re-opened. M5
  (analysis primacy) gains the matching exception; new M-request-type meta-check
  guards gate integrity.

## 2.4.1 — 2026-06-12

Post-release devil's-advocate pass + the plugin's first two end-to-end
simulated runs (PM pptx voyage, full settlement loop). Both survived; one
real bug and eleven spec gaps fell out.

### Fixed (from the simulated runs)
- **Windows BOM bug (the big one):** a bearing/ledger ever touched by PS 5.1
  `Out-File -Encoding utf8` carries a UTF-8 BOM; `JSON.parse` threw, the file
  silently vanished from the reminder hook AND the statusline (no overdue
  alert, ever — the calibration flywheel never starts), and the miss burned
  the once-per-machine greeting at the wrong moment. Both readers now strip
  BOM; regression fixtures added.
- **verify routing loop-trap:** rule 4 sent ANY owner-tagged challenged claim
  — even `minor`, whose own definition says don't block — into `revise_team`,
  re-running the whole team over a wording nit. Now requires severity ≥
  important; minors travel as caveats.
- **verify over-blocking:** prose examples only ever showed gating `blocks`
  values; a model following them flips the bearing to `collect_evidence` on
  merely-worth-doing checks. The four-value semantics (`none`/`boss_review`
  don't gate) are now stated.
- **team self-escalation trap:** the critic mandate could append a critique
  step → overflow the budget → trigger the stakes auto-upgrade to critical
  (4 agents + debate), nearly doubling cost on a classification coin-flip.
  Only plan-native critique steps count now.
- **No session ever reached `complete`:** boss leaves `refining` and nothing
  closed it; `--resume` misrouted finished voyages into revise. sail Step 7
  now sets `complete` after rendering the bearing.
- **Probe was structurally silent on document runs:** "the brief" was
  undefined for document targets — anchors quoted a 6-word problem text and
  every fork failed the post-filters. Brief = problem_text + extracted
  target contents, now stated.
- **Extraction scratch dir** pinned to OS temp (extracting into cwd would
  break zero-droppings); hook now scans root/session-level bearings (parity
  with the statusline — a seed can no longer alert on one surface while
  settle can't reach it); settle Step 1 scans the same three levels.
- settle Step 4's 안개-line data path specified (parse the contract id back
  into the bearing path); seed-import no longer fabricates `stakes:"high"`;
  log renders bearing-only voyages instead of "Voyages: 0 / Contracts: 1";
  boss demands embedded in `first_reaction` route like any other demand;
  time previews and README cost table updated to measured numbers (~4–8 min
  standard); track-record line shows "(인사이트까지 N건)" before T=3.

### Fixed
- **xlsx demoted to honest fallback.** Cell values in xlsx are index
  references into sharedStrings.xml — the pinned tag-strip recipe would
  produce sheets of bare integers that pass the sanity gate and feed a
  confident analysis of noise. Argus now asks for a CSV/PDF export instead
  ("a correct *I can't read this well* beats a deterministic husk").
- **pptx extraction recipe live-verified on Windows** (fake deck, Korean
  text, end-to-end): PS 5.1 Expand-Archive ALWAYS refuses non-.zip
  extensions, so the copy-to-.zip step is now mandatory wording, not a
  fallback; slide files must be numerically sorted (slide10 < slide2
  lexicographically).
- **Zero-droppings rule for auto-invocation** (sail Step 0 + clarify Step 1):
  a natural-language trigger must not create `.argus/` until the decision is
  confirmed non-trivial; a mistaken auto-trigger leaves the repo
  byte-identical. Explicit `/argus:sail` writes as before.
- **README secret-redaction claim downgraded to the truth** (ko+en): it is a
  prompt-rule mitigation, not a mechanical guarantee — inspect session files
  before committing them in secrets-heavy repos.

### Added
- **Extraction provenance line** — after any document intake, one line states
  what was actually read ("읽음: 슬라이드 14장 · 3,200자") so the user can
  catch a husk the sanity gate missed.
- **Ledger write verification** (settle + helm): after appending, re-read and
  JSON-parse the new line — every reader silently skips corrupt lines, so a
  malformed seal is a prediction that silently ceases to exist; now it gets
  corrected at write time.
- **Settle #1 payoff**: when a settled contract came from a bearing seed, the
  report quotes the bearing's fog/reef next to the outcome ("당시 짚었던
  안개: … — 현실의 답: …") — the earliest visible proof that the harness saw
  a real risk, and the only moment cheap enough to buy settle #2.

## 2.4.0 — 2026-06-12

Intake aligned with Claude Code convention: say it, don't syntax it.

### Changed
- **Natural-language targets are now the primary intake path.** "PR 12 머지해도
  되나?" / "Is docs/strategy.md right?" — clarify detects a PR, issue, file,
  branch, or document named in prose, verifies it resolves (the PR exists, the
  path exists), and expands it exactly like the old reference forms. This is
  how Claude Code's own skills (`/review`, `/pr-summary`) locate their target;
  the invented `@PR#N` / `@doc:<path>` micro-syntax demanded the user learn
  what the model could simply interpret. The `@` forms remain as precision
  overrides for ambiguous prose.
- **Ambiguity asks, never guesses:** when prose plausibly names an artifact
  but mechanical resolution fails, clarify asks ONE question ("어느 자료를 보고
  판단할까요?") with the detected candidates instead of silently degrading to
  repo-scan mode or analyzing the wrong thing.
- **Native @-mention respected:** files attached via Claude Code's own `@`
  file picker are already injected by the harness — clarify records the
  injected content as `target_context` instead of re-reading.
- `argument-hint` frontmatter added to sail and clarify so autocomplete shows
  what the argument can be; validate-plugin.js guards it.
- READMEs (ko/en), `/argus:help`, and team's M1 gate rewritten around the
  prose-first contract.

### Added
- **Office-document extraction, deterministic and dependency-free** (clarify
  §Document Extraction): pptx/docx/xlsx/hwpx are zip+XML — the skill pins ONE
  recipe (built-in unzip → strip tags → keep slide/sheet boundaries) and
  forbids improvising parsers or installing packages, so a PPT report gets
  the same intake quality on every machine. Legacy binaries (.ppt/.doc/.hwp)
  get an honest "export to PDF or paste" line, never a guess; an image-heavy
  deck that yields almost no text triggers the same fallback instead of a
  husk analysis.
- **Natural-language auto-invocation** — sail's description now carries
  concrete trigger phrases ("이거 해도 되나?", "이 보고서 검토해줘", "should we
  ship?", "review this deck") so Claude invokes Argus from a plain request,
  no slash command needed. Scoped with an explicit NOT-for clause (trivial
  reversible choices, pure execution tasks) to avoid over-triggering.
- Quotes documented as optional: `/argus:sail PR 12 머지해도 되나` works as-is.
- **First-session orientation line** — a marketplace install drops the user
  back at the prompt with zero guidance (Claude Code has no post-install
  welcome mechanism). The SessionStart hook now prints ONE line on the very
  first session after install — "just ask, or /argus:sail; full map:
  /argus:help" — gated by a once-per-machine marker
  (`<config dir>/argus-greeted`) written BEFORE printing, so it can never
  repeat. An overdue-contract line takes priority and also burns the marker
  (a user with contracts to settle needs no introduction). Locale follows
  config → LANG → system locale.

## 2.3.1 — 2026-06-12

Settlement-loop hardening: the two mechanical surfaces (SessionStart hook,
statusline) now follow the same ledger contract as the skills.

### Fixed
- **Hook ignored `amend` and `dismiss`** — `check-contracts.js` replayed only
  `seal`/`settle`, so a contract whose date was pushed (settle's "push the
  date" writes `amend`) kept firing the session-start reminder with the stale
  date for the whole extension, and a dismissed contract nagged forever. The
  hook now replays the full event set per `ledger.mjs` (the contract).
- **Settled bearing seeds flashed OVERDUE forever** — settle imports a seed
  into the ledger (id `bearing:<session>:<label>`) and never mutates the
  bearing file, but the hook and the statusline both counted `contract_seed`
  unconditionally. After settling, both surfaces pointed at `/argus:resolve`
  while settle itself correctly said "no contracts due." Both now skip seeds
  whose id — or verbatim predicate, for root-level bearings — already appears
  in the ledger.
- **Ledger was not actually gitignored** — settle claimed "the ledger inherits
  the privacy default," but sail Step 0's `.argus/.gitignore` only covered
  `sessions/` and `errors.log`; verbatim predictions were committed by
  default. sail now writes a `ledger/` line, and settle/helm append it to
  older gitignores that predate the settlement loop.
- Hook now reads the legacy `current-bearing.json` spelling too (parity with
  the statusline).

### Added
- `scripts/test-check-contracts.mjs` — 21 fixture tests for the hook (replay
  semantics, seed dedup, locale, prose dates, corrupt input).
- Statusline regression tests for imported/settled/pushed seeds.
- validate-plugin.js: install.sh guard now covers all 11 commands; checks
  `data/prompts/probe-prompts.md` (clarify hard-depends on it) and the
  `ledger/` gitignore line in sail Step 0.

### Changed
- README ko/en document `/argus:journal --insights` and `--all`; marketplace
  listing text updated from the pre-Current-Bearing "decision scaffold"
  wording to the voyage/settlement loop.
- install.sh warns that the legacy copy install does not ship the
  contract-reminder hook (plugin install is the supported path for it).

## 2.3.0 — 2026-06-12

The settlement loop is now complete, and the accumulated history is finally
visible and useful.

### Added
- **`/argus:resolve`** — settle contracts past their check-by date: one neutral
  question per contract (held / missed / partial / push the date), outcome
  appended to the append-only ledger. Bearing seeds are imported into the
  ledger on first settle so it stays the single replayable source. This was
  the missing back half of the loop — the 2.2.0 reminder hook pointed at a
  command that couldn't act.
- **`/argus:journal`** — the voyage log: one screen across ALL sessions (recent
  decisions and their courses, sealed/open/overdue contracts, the running
  held/missed/partial record). `--insights` adds at most 3 pattern lines once
  ≥3 contracts are settled, each grounded in a concrete entry.
- **Track-record context in clarify** — once ≥2 contracts are settled, new
  voyages inject ONE reference-only line (counts + the most recently missed
  prediction) into the initial analysis. Scoped, never directive, never
  fewer-than-2 anecdotes.
- **First-voyage hint** — after the project's first-ever bearing, one line
  pointing to `/argus:versions` and `/argus:help`. Never repeats.

### Changed
- Reminder hook, statusline overdue line, and chart's next-command logic all
  route to `/argus:resolve` (previously dead-ended at `/argus:versions` or the
  dogfood-only `/watch`).
- chart Open Checks shows a contract past check-by as a first-class row.

## 2.2.0 — 2026-06-12

Plugin-spec alignment + first-run friction removal.

### Changed
- **Manifest reduced to the official plugin.json shape.** Removed the invented
  `commands` / `agents` / `references` / `statusline` fields — skills and
  agents auto-discover from `skills/` and `agents/`; the `/argus:*` namespace
  comes from the plugin name.
- **Marketplace install is now truly zero-setup.** All bundled data/lib files
  are resolved via `${CLAUDE_PLUGIN_ROOT}` (plugin install dir) with documented
  fallbacks (legacy `install.sh` copy dirs → repo-local). Previously every
  skill pointed at `~/.claude/argus-data/`, which only existed after running
  the copy installer — the documented marketplace path broke on first run.
- `contract_seed` is now a full four-part falsifiable contract
  (predicate / check_by / pass_condition / fail_condition), matching the
  schema and the simulation gate.
- Error messages are bilingual (ko/en) and point to plugin reinstall instead
  of `install.sh`; `/argus:verify` gained a locale rule and a friendly
  redirect when run after a low-density (minimal) decision; `/argus:boss`
  generic-stakeholder fallback is now fully specified (`mbti_type: null`).
- Orphan session phases (`team_working`, `mixing`) removed from the schema and
  the sail routing table; interrupted-mid-team sessions now resume cleanly.
- Statusline reads both `current_bearing.json` (v2 skills) and the legacy
  `current-bearing.json` spelling.

### Added
- **`/argus:help`** — in-product orientation: command map, flags, situational
  routing. Read-only.
- **Overdue-contract reminder hook** (`hooks/hooks.json` + 
  `scripts/check-contracts.js`): on session start, prints exactly one line if
  a sealed decision contract is past its check-by date — silent otherwise.
  The settlement loop is the point of a decision contract; this closes it.
- `/argus:preapprove` (experimental) documented in both READMEs.
- `CHANGELOG.md` (this file).
- `validate-plugin.js` rewritten for the auto-discovery structure: forbids
  regressed manifest fields, checks 9 skills + frontmatter, 17 agents, schema
  inventory, and hardcoded-path regressions.

## 2.1.0 — 2026-06-09

- Verification-first pass: `/argus:verify` positive/negative validation with
  routing (`proceed_to_boss` / `revise_team` / `stop_for_human_check` /
  `ask_user`); `/argus:revise` iteration loop with child drafts;
  `/argus:versions` version tree with checkout/promote.
- Current Heading as the default surface (machinery hidden by default).
- Trial-sail probe (clarify Step 3.5) with mechanical post-filters.

## 2.0.0 — 2026-04-24

- Full redesign from the v1 (0.5.x) persona-reviewer plugin to the
  decision-voyage harness: clarify → team (workers, not critics) → verify →
  boss → revise pipeline, session artifacts under `.argus/sessions/`,
  17-agent crew roster, 16 MBTI boss personas, minimal-scaffold routing for
  low-density decisions.
