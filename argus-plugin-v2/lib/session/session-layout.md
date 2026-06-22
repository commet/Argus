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

## Write Discipline (Atomic)

The read side (clarify Error modes — the canonical corrupt/partial-read guard)
quarantines a half-written file *after the fact*. This is its write-side
counterpart: stop the half-written file from being produced in the first place.
"write-once" above is a *concurrency* property (don't duplicate write-many
artifacts into one blob); atomicity is a *separate* property and is mandatory:

- **Temp + rename, never in place.** Write the complete content to
  `<name>.json.tmp` in the same directory, then atomically `rename` it over
  `<name>.json` (a same-directory rename is atomic on every target filesystem). A
  reader therefore always observes either the complete previous file or the
  complete new file — never a truncation. **Never write in place over a good
  file:** a process killed mid-write would destroy the only copy, leaving the
  corrupt-read guard with nothing to fall back to.
- **A leftover `*.json.tmp` is the signature of a crashed write.** The canonical
  `<name>.json` beside it is still intact (old or new content). Readers IGNORE
  `*.tmp` / `*.stream.partial` entirely — never parse one as the artifact and never
  quarantine it as if it were (it is not a corrupt artifact, it is a discarded
  write attempt). The next writer overwrites it.
- **Write a set-valued artifact once, when the set is complete.** `workers.json`
  (and any file holding a planned *set*) is written a single time after the full
  set is assembled — never appended entry-by-entry. Atomic single-file writes
  prevent byte-level truncation; writing the set in one shot prevents the *other*
  partial — a syntactically valid file holding fewer items than planned, which
  would read as a falsely complete smaller set. (A genuinely interrupted *run* —
  team killed before assembling the set — leaves no `workers.json` at all, which
  reads correctly as "team did not finish"; verify/sail then re-run team rather
  than trusting a partial.)
- **Universal, no drift list.** Every skill that writes any stored session or
  version `.json` owns this discipline — clarify, team, verify, boss, chart, sail,
  revise, settle. Same rule as the read side: if a skill writes a stored `.json`,
  it writes it atomically. Do not maintain a hand-picked list of who must comply.

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
.argus/sessions/*/versions/**/*.json.tmp
```

(`*.json.tmp` is the atomic-write scratch file from the Write Discipline above —
a crashed write may leave one behind; it is never the artifact, so it must never
travel in a shared session.)

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

### Concurrency: the version dirs are authoritative; `drafts[]` is a derived index

The atomic Write Discipline above prevents a *truncated* file; it does **not**
prevent a **lost update** — atomicity is not isolation. Two writers (two
`team --revise` runs, or two sessions on one repo — this project hit exactly this)
each read `session.json` at v1, each append a draft, each atomically write v2: both
writes are individually intact, but the second silently erases the first's draft
pointer. The fix is to never treat the in-memory snapshot as still-current at write
time:

- **The authoritative draft set is the version directories on disk**, not
  `session.drafts[]`. Each `versions/{label}/` dir is created **write-once under a
  unique label** (`nextChildLabel`), so two concurrent writers never collide on the
  dirs themselves — only on the single `drafts[]` index that points at them.
  `drafts[]` is therefore a *cache* of that truth, not the truth.
- **Every `session.json` write re-reads immediately before writing and merges**,
  never blind-overwrites: rebuild `drafts[]` as the union of (what is in the file
  *now*, re-read just before write) ∪ (your new draft), deduplicated by
  `version_label`, then reconciled against the version dirs actually present (a dir
  on disk with no `drafts[]` entry → add it; the dirs win). This makes `drafts[]`
  convergent regardless of write order — no append can drop a sibling.
- **Scalar pointers** (`active_draft_id`, `phase`, `updated_at`) are inherently
  last-writer-wins ("whoever acted most recently") and that is acceptable — but the
  same re-read-merge must run so that updating a pointer never clobbers `drafts[]`
  membership in the process.
- **Optimistic guard (optional but cheap):** compare the `updated_at` you read at
  load against the one on disk just before writing; if it changed, another writer
  intervened — re-read and re-merge rather than overwrite.

A reader (e.g. chart) that finds `drafts[]` out of step with the dirs trusts the
**dirs** and reconciles, for the same reason: the dirs are write-once truth, the
index can lag a concurrent write.

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

## Phase Is Derived From Artifacts, Not Declared

`session.phase` is a **hint, not the source of truth** — for the same reason the
version dirs (not `drafts[]`) are authoritative and the artifacts (not a corrupt
`session.json`) drive recovery. A sub-step writes its artifact *then* updates
`session.phase`; a crash, kill, or sail sub-step that dies **between those two
writes** leaves `phase` lagging the artifacts (e.g. team wrote
`workers.json`/`mix.json`/`scaffold.json` but died before its Step 10 phase update,
so `phase` still reads `conversing` while team is in fact complete). Routing off the
stale scalar would re-run a finished step or skip an unfinished one.

So **derive the effective phase from the artifacts present in the active version
dir** (the "Files Written By Phase" table above is the ladder), highest rung that is
actually complete wins:

| Artifact present & complete (active version dir) | Derived phase / next |
|---|---|
| `current_bearing.json` | bearing rendered → `complete` (chart) |
| `boss_feedback.json` | boss done → `refining`/`complete` per routing |
| `verification.json` | verify done → `dm_feedback` (boss next) or per `routing_decision` |
| `scaffold.json` + `mix.json` + `workers.json` (full set per `team_plan.json`) | team done → `verifying` (verify next) |
| `team_plan.json` present but `workers.json` absent/partial/unparseable | interrupted mid-team → re-run `/argus:team` |
| `analysis.json` with `execution_plan.steps ≥ 2` | framing ready → `conversing` (team next) |
| `analysis.json` only (`execution_plan < 2`) | `analyzing`/`conversing` → clarify `--continue` |
| nothing | `new` → clarify |

**The artifacts always win over `session.phase`.** If the derived phase is *ahead*
of `session.phase`, a crash happened between artifact-write and phase-write — advance
to the artifacts. If `session.phase` is *ahead* of the artifacts (says `verifying`
but no `verification.json`), the step did not actually complete — route to produce
it. `session.phase` is consulted only to break ties the artifacts leave genuinely
ambiguous. This is the same artifact-trust the corrupt-session recovery path already
uses (sail Step 2) — generalized from "session.json won't parse" to the far more
common "session.json parses fine but its phase is stale."

## Re-entry Is Idempotent

Phase-derivation (above) makes **re-running a sub-step the normal recovery path** —
a crashed chain routes back to whichever step its artifacts say is incomplete. So
re-running any sub-step on the same inputs MUST converge to the same state, never
accumulate. A sub-step's output is a **pure function of its upstream artifacts**:
run it twice, get the same result.

- **File-writing steps overwrite and recompute, never append.** Re-running
  `/argus:verify` overwrites `verification.json` (a fresh ledger), it does not add a
  second one. Re-running `/argus:team` on a crashed run reuses the same version dir
  (the `workers.json` marker — absent/partial → reuse the label and overwrite; a
  *complete* set means team already finished, so phase-derivation routes onward, not
  back into team). Mutations into a shared file (e.g. boss folding concerns into
  `scaffold.json`) must be computed by **set/replace keyed by a stable id**, never by
  appending — appending is what turns a second run into duplicated actions/checks.
- **Event-sourced writes achieve the same by replay-collapse, not overwrite.** The
  ledger is append-only, yet settle is idempotent because Step 1 replays events by
  `id` and a closed contract is not re-surfaced as due — so a second settle never
  appends a duplicate `settle` for the same id. Append-only + replay-by-id = the
  event-log equivalent of overwrite.
- **The test:** for every sub-step ask "if this runs twice on the same inputs, is
  the on-disk state identical?" If not — if it appends, bumps a counter, or
  re-applies an already-applied change — it is a re-entry bug, because R55 guarantees
  it *will* sometimes run twice.
