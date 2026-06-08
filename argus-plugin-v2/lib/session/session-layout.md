# Session Directory Layout

Every Argus session lives in `.argus/sessions/{session-id}/` relative to the repo
root.

## Layout

```text
.argus/
├── config.yaml                  # User plugin config: boss MBTI, locale
├── sessions/
│   └── {session-id}/
│       ├── session.json         # Top-level session record
│       ├── versions/
│       │   ├── v0.1/
│       │   │   ├── analysis.json       # From /argus:clarify
│       │   │   ├── questions_and_answers.json
│       │   │   ├── meta.json
│       │   │   ├── classification.json # From /argus:team
│       │   │   ├── team_plan.json
│       │   │   ├── workers.json
│       │   │   ├── debate.json         # Critical stakes only
│       │   │   ├── mix.json
│       │   │   ├── verification.json   # From /argus:verify
│       │   │   ├── boss_feedback.json  # From /argus:boss
│       │   │   └── scaffold.json       # FinalScaffold
│       │   ├── v0.2/
│       │   └── v0.1.1/
│       └── errors.log
```

## Session ID Format

`YYYY-MM-DD-{kebab-of-first-5-words-of-problem}`

Collision-safe via `-N` suffix: `-2`, `-3`, and so on.

Example:

```text
2026-04-24-design-pr-review-workflow
2026-04-24-design-pr-review-workflow-2
```

## File Naming Conventions

- JSON for machine-readable artifacts conforming to schemas in
  `~/.claude/argus-data/schemas/`.
- `.log` for append-only text logs.
- `meta.json` in each version dir for non-artifact metadata such as timestamp,
  triggering skill, and user notes.

## Session-Level vs Version-Level

Session-level fields in `session.json`:

- id, problem_text, repo_path, invoking_context, boss_agent, phase, round.
- Pointers: `active_draft_id`, `released_draft_id`, `drafts[]`.
- Current verification summary, when available.

Version-level files in `versions/{label}/*.json`:

- Artifacts produced during that version's lifecycle.
- Immutable once complete, except `meta.json` annotations.
- A version starts when `/argus:clarify`, `/argus:team`, `/argus:verify`, or
  `/argus:boss` begins a new draft chain.

## Git Commitment

The `.argus/` directory is designed to be committed to the user's repo. This is
the plugin's unique moat vs the webapp: decision history travels with the code
and is shareable via git.

Recommended `.gitignore`:

```text
.argus/errors.log
.argus/sessions/*/versions/**/*.stream.partial
```

Everything else should be committed.

## Draft Tree Semantics

- `drafts[0]` is the root with `parent_draft_id: null`.
- Each subsequent draft has `parent_draft_id` pointing to its parent.
- `active_draft_id` is the currently focused draft, defaulting to latest by
  `created_at`.
- `released_draft_id` is the draft marked as `v{major}.0` through
  `/argus:chart --promote`.

When `active_draft_id` changes through `/argus:chart --checkout`, the session's
surface view reflects the active draft's scaffold.

## Files Written By Phase

| Skill | Files written |
|---|---|
| `/argus:clarify` | `analysis.json`, `questions_and_answers.json`, `meta.json` |
| `/argus:team` | `classification.json`, `team_plan.json`, `workers.json`, optional `debate.json`, `mix.json`, candidate `scaffold.json` |
| `/argus:verify` | `verification.json`, updated `scaffold.json` verification summary, updated `session.json` verification state |
| `/argus:boss` | `boss_feedback.json`, updated `scaffold.json` with applied/rejected concerns |
| `/argus:revise` | New version dir. Copies forward unchanged artifacts and writes `revise_directive.txt` plus new `mix.json` if revised. |
