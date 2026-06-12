# Changelog

All notable changes to the Argus plugin. Versioning follows
[semver](https://semver.org); users receive an update only when the
`version` in `.claude-plugin/plugin.json` is bumped.

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
