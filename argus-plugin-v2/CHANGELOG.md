# Changelog

All notable changes to the Argus plugin. Versioning follows
[semver](https://semver.org); users receive an update only when the
`version` in `.claude-plugin/plugin.json` is bumped.

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
  unconditionally. After settling, both surfaces pointed at `/argus:settle`
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
- README ko/en document `/argus:log --insights` and `--all`; marketplace
  listing text updated from the pre-Current-Bearing "decision scaffold"
  wording to the voyage/settlement loop.
- install.sh warns that the legacy copy install does not ship the
  contract-reminder hook (plugin install is the supported path for it).

## 2.3.0 — 2026-06-12

The settlement loop is now complete, and the accumulated history is finally
visible and useful.

### Added
- **`/argus:settle`** — settle contracts past their check-by date: one neutral
  question per contract (held / missed / partial / push the date), outcome
  appended to the append-only ledger. Bearing seeds are imported into the
  ledger on first settle so it stays the single replayable source. This was
  the missing back half of the loop — the 2.2.0 reminder hook pointed at a
  command that couldn't act.
- **`/argus:log`** — the voyage log: one screen across ALL sessions (recent
  decisions and their courses, sealed/open/overdue contracts, the running
  held/missed/partial record). `--insights` adds at most 3 pattern lines once
  ≥3 contracts are settled, each grounded in a concrete entry.
- **Track-record context in clarify** — once ≥2 contracts are settled, new
  voyages inject ONE reference-only line (counts + the most recently missed
  prediction) into the initial analysis. Scoped, never directive, never
  fewer-than-2 anecdotes.
- **First-voyage hint** — after the project's first-ever bearing, one line
  pointing to `/argus:chart` and `/argus:help`. Never repeats.

### Changed
- Reminder hook, statusline overdue line, and chart's next-command logic all
  route to `/argus:settle` (previously dead-ended at `/argus:chart` or the
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
- `/argus:helm` (experimental) documented in both READMEs.
- `CHANGELOG.md` (this file).
- `validate-plugin.js` rewritten for the auto-discovery structure: forbids
  regressed manifest fields, checks 9 skills + frontmatter, 17 agents, schema
  inventory, and hardcoded-path regressions.

## 2.1.0 — 2026-06-09

- Verification-first pass: `/argus:verify` positive/negative validation with
  routing (`proceed_to_boss` / `revise_team` / `stop_for_human_check` /
  `ask_user`); `/argus:revise` iteration loop with child drafts;
  `/argus:chart` version tree with checkout/promote.
- Current Bearing as the default surface (machinery hidden by default).
- Trial-sail probe (clarify Step 3.5) with mechanical post-filters.

## 2.0.0 — 2026-04-24

- Full redesign from the v1 (0.5.x) persona-reviewer plugin to the
  decision-voyage harness: clarify → team (workers, not critics) → verify →
  boss → revise pipeline, session artifacts under `.argus/sessions/`,
  17-agent crew roster, 16 MBTI boss personas, minimal-scaffold routing for
  low-density decisions.
