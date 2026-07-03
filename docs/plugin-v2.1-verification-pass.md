# Argus Plugin v2.1 Verification Pass

Date: 2026-06-09

Branch: `feat/decision-contract-loop`

## Why This Pass Happened

The webapp direction moved toward an agent-team workflow where AI-produced
results are checked through positive and negative validation before they are
promoted. The plugin was still closer to the older `team -> boss` model, where a
stakeholder persona review could look like the quality gate.

That was the wrong center of gravity for the plugin. The plugin should not rely
on later human grading or on a boss persona to catch weak AI output. It should
make verification explicit inside the Claude Code workflow.

## Product Identity Decision

Plugin and webapp do not need identical UX.

The webapp can own richer visual flows, saved state, and guided product
surfaces. The plugin should lean into Claude Code strengths:

- working inside the actual repo,
- using subagents as domain workers,
- producing compact terminal-native output,
- using `AskUserQuestion` for real user choice gates,
- writing filesystem artifacts that can be committed with the codebase.

The resulting plugin identity is:

```text
clarify the decision -> make agents work -> verify the claims -> let boss react
```

Boss is now stakeholder review, not the verification gate.

## Main Architecture Change

The medium/high-stakes internal path changed from:

```text
clarify -> team -> boss -> final card
```

to:

```text
clarify -> team -> verify -> boss -> Current Course
```

Low-density decisions still skip the full pipeline and return a minimal scaffold.
That path now explicitly records that team, verification, boss, and debate were
skipped.

## New Verification Layer

Added `/argus:verify` as a first-class skill.

The new verification step reads the team output and writes a
`verification.json` ledger before the scaffold can look final. It separates:

- `supported_claims[]`: claims with enough local/session evidence to trust,
- `challenged_claims[]`: weak, unsupported, contradicted, or false-confidence
  claims,
- `unresolved_tensions[]`: real disagreements that should not be averaged away,
- `human_required_checks[]`: items AI cannot verify from the repo/session,
- `routing_decision`: whether to proceed, ask the user, revise team output, or
  stop for human evidence.

This is the core anti-sycophancy mechanism in plugin v2.1.

## Files And Areas Changed

Manifest and install:

- `.claude-plugin/plugin.json` now exposes `/argus:verify`, references
  `verification-ledger.json`, updates v2.1 metadata, and fixes the missing
  `concertmaster.md` agent reference to `navigator.md`.
- `install.sh` was rewritten as a clean ASCII/LF installer, with robust `--link`
  behavior and verification that all seven skills are installed.
- `.gitattributes` pins `install.sh` to LF so bash does not fail on CRLF.

Schemas:

- Added `data/schemas/verification-ledger.json`.
- Updated `final-scaffold.json` with a verification summary.
- Updated `session.json` with the `verifying` phase and session-level
  verification state.
- Updated `worker-result.json` with worker-level verification fields.
- Updated `minimal-scaffold.json` so skipped work includes verification.

Skills:

- `skills/sail/SKILL.md` now orchestrates
  `clarify -> team -> verify -> boss`, respects verification routing, and
  refuses to make medium/high team output look final without verification.
- `skills/team/SKILL.md` now produces a candidate scaffold with
  `verification.overall_status = "unverified"`.
- `skills/verify/SKILL.md` was added as the claim-level positive/negative
  validation gate.
- `skills/boss/SKILL.md` now requires verification first unless the user
  explicitly overrides.
- `skills/revise/SKILL.md` closes the repair loop by creating child drafts after
  verification, boss feedback, or user directives.
- `skills/sail/SKILL.md` now treats Current Course as the default product
  surface: one screen with current course, evidence, open risk, set-aside option,
  next step, and an optional decision-prediction to check.
- `skills/chart/SKILL.md` shows verification status and next steps.
- `skills/clarify/SKILL.md` now marks minimal routes as skipping team, verify,
  boss, and debate.

Runtime support:

- `statusline/index.js` now reads verification state and shows status, challenged
  claim count, and human check count.
- `lib/session/session-layout.md` documents `verification.json`.
- `lib/rehearsal-prompt.md` now includes a verification-before-boss gate.

Docs:

- `README.md` and `README.ko.md` were rewritten around the v2.1
  verification-first positioning.
- `TEST_PLAN.md` now tests verification reality, human choice gates, and
  self-serving plugin output.
- `BUILD_STATUS.md` records this pass and the new product decision.

## Validation Performed

Static checks:

```text
bash -n ./argus-plugin-v2/install.sh
node --check ./argus-plugin-v2/statusline/index.js
node ./argus-plugin-v2/scripts/validate-plugin.js
JSON parse for all argus-plugin-v2 JSON files
plugin manifest command/agent/reference path existence check
```

Installer check:

```text
temporary HOME + .claude directory
./argus-plugin-v2/install.sh --link
verified:
- 7 skills linked
- 17 agents linked
- verification-ledger.json installed
```

## Known Runtime Caveat

Claude Code caches skill bodies at session start. After installing or editing
the plugin, Claude Code must be restarted before `/argus:sail` reflects the new
skill behavior.

The file-system and installer checks pass. Live runtime behavior should be
confirmed in a fresh Claude Code session with the updated test plan.
