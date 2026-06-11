# Changelog

All notable changes to the Argus plugin. Versioning follows
[semver](https://semver.org); users receive an update only when the
`version` in `.claude-plugin/plugin.json` is bumped.

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
