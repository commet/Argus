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
│       │   │   ├── meta.json            # incl. target_context (expanded PR/file/issue)
│       │   │   ├── minimal_scaffold.json # clarify, only when decision_density == low
│       │   │   ├── classification.json # From /argus:team
│       │   │   ├── team_plan.json
│       │   │   ├── repo_context.json    # M1 code-native context for workers
│       │   │   ├── workers.json
│       │   │   ├── debate.json         # Critical stakes only
│       │   │   ├── mix.json
│       │   │   ├── verification.json   # From /argus:verify
│       │   │   ├── current_bearing.json # Compressed Current Heading from /argus:sail
│       │   │   ├── boss_feedback.json  # From /argus:boss
│       │   │   └── scaffold.json       # FinalScaffold
│       │   ├── v0.2/
│       │   └── v0.1.1/
│       └── errors.log
```

## Session ID Format

`YYYY-MM-DD-{kebab-of-first-5-words-of-problem}-{author}`

`{author}` = first 4 hex chars of a hash of `git config user.email` (fallback
`user.name`, else `local`). This is the **team-safety** key: the same problem
from two teammates becomes two non-colliding directories that still both travel
via git. Collision-safe within one author via `-N` suffix: `-2`, `-3`.

Example:

```text
2026-04-24-design-pr-review-workflow-a1b2   # alice
2026-04-24-design-pr-review-workflow-9f3c   # bob (same problem, no collision)
```

## File Naming Conventions

- JSON for machine-readable artifacts conforming to schemas in
  `${CLAUDE_PLUGIN_ROOT}/data/schemas/`.
- `.log` for append-only text logs.
- `meta.json` in each version dir for non-artifact metadata such as timestamp,
  triggering skill, and user notes.

## Session-Level vs Version-Level

`session.json` is a **thin, team-safe skeleton** — only small, slow-changing
coordination state, so concurrent team commits don't collide on a monolithic
blob:

- id, problem_text, repo_path, repo_branch, invoking_context, boss_agent.
- phase, round, max_rounds, classification (routing).
- Draft-tree POINTERS: `drafts[]` (per-draft metadata + version_label, not heavy
  data), `active_draft_id`, `released_draft_id`.
- created_at, updated_at.

It does **NOT** store snapshots, workers, stages, mix, verification, dm_feedback,
or final_scaffold — those are read from the version dir (below). This is
deliberate: duplicating write-many artifacts into one file is what caused
guaranteed merge conflicts.

Version-level files in `versions/{label}/*.json` (authoritative, write-once):

- Artifacts produced during that version's lifecycle: `analysis.json`,
  `questions_and_answers.json`, `workers.json`, `mix.json`, `verification.json`,
  `boss_feedback.json`, `scaffold.json`.
- Immutable once complete, with two documented exceptions: `meta.json` annotations,
  and `scaffold.json` — which `/argus:verify` updates (verification summary) and
  `/argus:boss` updates (applied/rejected concerns + boss-issued actions). Consumers
  must treat `scaffold.json` as the authoritative latest, not assume it is frozen
  after `/argus:team`.
- A version starts when `/argus:clarify`, `/argus:team`, `/argus:verify`, or
  `/argus:boss` begins a new draft chain.

## Git Commitment

**Local by default, shareable by opt-in.** Sessions contain code diffs and
business context, and the ledger holds verbatim predictions and outcomes — so
sail Step 0 writes `.argus/.gitignore` covering `sessions/`, `ledger/`, and
`errors.log` on first create. Decision history traveling with the code is
still the plugin's moat vs the webapp; it just requires an explicit choice.

To share with a team, set `archive.commit_sessions: true` in
`.argus/config.yaml` (sail then omits the `sessions/` line) and additionally
ignore the noise:

```text
.argus/sessions/*/errors.log
.argus/sessions/*/versions/**/*.stream.partial
```

(The canonical error log is `.argus/sessions/{id}/errors.log` — sail, team, and this layout all write there. Do not write a per-version `errors.log`.)

The `ledger/` line stays even when sessions are shared — the calibration
record is personal by default; delete the line by hand to share it.

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
| `/argus:clarify` | `analysis.json`, `questions_and_answers.json`, `meta.json` (incl. `target_context` when a target was expanded), `minimal_scaffold.json` (only when `decision_density == "low"`) |
| `/argus:team` | `classification.json`, `team_plan.json`, `repo_context.json` (M1 code-native context), `workers.json`, optional `debate.json`, `mix.json`, candidate `scaffold.json`; appends a Draft to `session.drafts[]` and sets `active_draft_id` |
| `/argus:verify` | `verification.json`, updated `scaffold.json` verification summary, updated `session.json` verification state |
| `/argus:sail` Step 7 | `current_bearing.json` for medium/high paths |
| `/argus:boss` | `boss_feedback.json`, updated `scaffold.json` with applied/rejected concerns; in session.json only the active draft's `boss_reviewed: true` flag + `phase` (boss does NOT touch `reviewing_agent_id` — that marks who produced a draft, not who reviewed it) |
| `/argus:revise` | writes a transient `pending_revision.json` (session level, consumed by team), then via `/argus:team --revise` creates a new **child** version dir (full artifacts, write-once) and appends a child Draft (`directive`, `reviewing_agent_id: navigator`); then `/argus:verify` re-verifies. The parent draft is untouched. |
| `/argus:settle` | appends `harvest`/`seal` (bearing-seed import), `settle`, or `amend` events to `.argus/ledger/ledger.jsonl` — append-only, never touches session dirs |
| `/argus:log`, `/argus:help`, `/argus:chart` (default) | read-only — write nothing |
