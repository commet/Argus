# Changelog

All notable changes to the Argus plugin. Versioning follows
[semver](https://semver.org); users receive an update only when the
`version` in `.claude-plugin/plugin.json` is bumped.

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
