---
name: versions
user-invocable: false
description: Display or manage one Argus decision's version tree. Read-only by default; no new analysis. Invoked through `/argus:history versions`.
---

# Internal versions workflow

**What this skill does:** Shows the map of an Argus session. It is the user's
way to see branches, active draft, released draft, current read, blockers,
and the next useful command.

**Default behavior:** read-only. No LLM. No analysis generation.

---

## When To Run

- `/argus:history versions`
- `/argus:history versions --session <id>`
- `/argus:history versions --tree`
- `/argus:history versions --checkout <version-label>`
- `/argus:history versions --promote <version-label>`
- `/argus:history versions --delete <session-id>`
- `/argus:history versions --json`

---

## Inputs

- `--session <id>`: defaults to latest session.
- `--tree`: show all sessions' version trees.
- `--checkout <label>`: switch active draft.
- `--promote <label>`: anchor a draft as the released major version.
- `--delete <session-id>`: delete a session after confirmation.
- `--json`: emit machine-readable summary.

Flags that mutate state are mutually exclusive.

---

## Default View

### Step 0 — Load config & guard for empty state

1. Read `.argus/config.yaml` (silent-create from `${CLAUDE_PLUGIN_ROOT}/lib/config.example.yaml` if missing, same as other skills). All user-facing text in this skill uses `config.locale`.
2. **Zero-sessions guard:** if `.argus/sessions/` does not exist or contains no session directory, do NOT error. Print and stop:
   - ko: `아직 Argus 결정 기록이 없습니다. \`/argus:review "<결정>"\` 로 시작하세요.`
   - en: `No Argus decisions yet. Start one with \`/argus:review "<your decision>"\`.`
3. **Legacy guard:** if only pre-v2 (`v0.5`-era) files exist with no `session.json`, note that legacy sessions aren't rendered by this version and point to the newest v2 session if any.

### Default (no flags) — show current session

1. Find the latest session: the session directory whose `session.json` has the newest `updated_at`; if `updated_at` is missing or tied, fall back to directory mtime. Read its `session.json`.
2. Read these per-version files for the active draft: `versions/{label}/current_bearing.json` (the current call block — course, unknown/risk, next step), `scaffold.json` (reframed_question, assumptions, checkpoints), `verification.json` (read `routing_decision` + `overall_status` + `root_crack`), `boss_feedback.json` (boss status). **Missing vs corrupt are different states:** treat a *missing* file as "not run" (render the dash, route to the skill that produces it). Treat a file that exists but *fails to parse* as **corrupt, not absent** — render `⚠ <name> unreadable (recover: rerun /argus:<skill>)` for that line and quarantine it to `<name>.corrupt.<ts>`; do NOT silently collapse a corrupt `verification.json` into "not run," which would route the user past a verification that actually ran (and may have blocked).
3. Parse draft tree from `session.drafts[]`, then **reconcile against the version directories on disk — the dirs are authoritative** (session-layout → Concurrency): for any `versions/{label}/` dir with no matching `drafts[]` entry, add it to the rendered tree (a concurrent writer may have created the dir before its `drafts[]` index write landed). If `drafts[]` is empty entirely (session predates draft persistence, or only clarify ran), build the whole tree from the dirs present instead of rendering blank. Never show fewer drafts than there are version dirs.
4. Render a one-screen map:

```text
## Argus Version Tree - {{session.id}}

Problem: {{problem_text[:80]}}
Active: {{active_label}}  Released: {{released_label or "-"}}

current call:
- Course: {{current_bearing.current_course.summary or "not rendered yet"}}
- Unknown/Risk: {{current_bearing.fog_or_reef.issue or "none named"}}
- Next step: {{current_bearing.next_helm or "run /argus:review --resume {{id}}"}}

Version Tree:
v0.1 (initial read)
  `- v0.2 (applied verification repair)  [active]
  `- v0.1.1 (alternate lower-scope course)

Open Checks:
- Verification: {{overall_status or "not run"}}
{{if root_crack}}- Reality check: "{{root_crack.claim clipped 50}}" (course rests on it; only reality confirms) -> /argus:check when known{{endif}}
- Human checks: {{first human check or "none"}}
- Boss condition: {{approval_condition or "none"}}
{{if contract past check-by}}- Contract: "{{predicate clipped 50}}" was due {{check_by}} -> /argus:check{{endif}}

Next:
- If verification is missing: `/argus:review --resume {{session.id}}` (routes to the verify step)
- If verification is blocked: complete human checks, then `/argus:review --resume {{session.id}}`
- Apply boss concerns / verify challenges: `/argus:review --resume {{session.id}}` (the revise step forks a child draft with the fixes + re-verifies)
- Promote this draft to v1.0: `/argus:history versions --promote {{active_label}}`
- Branch from an older draft: `/argus:history versions --checkout <label>` then `/argus:review --resume {{session.id}}` (revise branches from the checked-out draft)
```

Do not render worker counts by default. If the user wants internals, they can
open the detail path or use `--json`.

---

## Version Tree Rendering

For `session.drafts[]`, render parent-child relationships.

Algorithm:

1. Find root draft (`parent_draft_id == null`).
2. Recursively walk children by `parent_draft_id`.
3. Sort siblings by `created_at`, then `version_label`.
4. Mark active draft with `[active]`.
5. Mark released draft with `[released]`.
6. Mark a draft with `boss_reviewed == true` with `[reviewed]` (this is the flag's
   one consumer — boss sets it precisely so the tree can show which drafts a
   stakeholder has already reacted to).
7. Include `change_summary` when present — render it verbatim. A revise-born
   draft carries a neutral record of what changed (e.g. `"addressed: rollout
   kill-criteria · awaiting reality check: GDPR readiness"`); that is where the
   navigation layer (which fork the human took) shows *what changed and what is
   still open*. Render it as written — never a "most-wrong claim" verdict.

ASCII example:

```text
v0.1 (initial scaffold)
  |- v0.2 (addressed: kill-criteria · awaiting reality check: GDPR readiness) [active]
  `- v0.1.1 (lower-scope branch) [released]
```

Avoid fragile box-drawing characters; this runs in varied terminals.

---

## Next Command Logic

Compute the next useful command as an **ordered if / else-if — first match wins**
(the conditions overlap, so precedence is mandatory; a flat list would let two
gates both claim the same state). The verification gates read **one field,
`verification.json.routing_decision`** — a single enum computed by verify Step 7
as its own ordered-first-match, so it holds **exactly one** of `revise_team` /
`stop_for_human_check` / `ask_user` / `proceed_to_boss`. Do NOT read multiple
boolean flags or `overall_status` for routing — `routing_decision` is the single
source of truth, and reading anything else is what reintroduces gate collisions.

- A sealed contract (ledger or this session's read seed) is past its
  check-by date -> `/argus:check` (outranks everything below — an unsettled
  past prediction is the most perishable item on the version tree)
- Missing `verification.json` on a medium/high draft -> `/argus:review --resume <id>` (routes to the verify step)
- Verification `revise_team` -> `/argus:review --resume <id>` (the revise step auto-detects the challenged claims to repair)
- Verification `stop_for_human_check` -> show the first human check and
  `/argus:review --resume <id>` after evidence is added
- Verification `ask_user` (unresolved critical challenge) -> `/argus:review --resume <id>` to make the call
- Boss critical applied concerns exist -> `/argus:review --resume <id>` (the revise step auto-applies the accepted concerns)
- No `current_bearing.json` -> `/argus:review --resume <id>`
- Read status is `anchor` -> `/argus:history versions --promote <active_label>`
- Otherwise -> `/argus:review --resume <id> "<directive>"` or `/argus:history versions --promote <active_label>`

---

## `--checkout <label>`

1. Verify label exists.
2. Update `session.active_draft_id`.
3. Do not rewrite draft contents.
4. Report:

```text
Switched active draft to {{label}}.
Next: /argus:review --resume {{session.id}}
```

---

## `--promote <label>`

Promote means anchor: this is the draft the user is ready to treat as released.

1. Verify label exists.
2. Verify the active version has either:
   - `current_bearing.current_course.status == "anchor"`, or
   - user explicitly confirms promotion despite non-anchor status.
3. Verify the label is pre-release via `isPreRelease()` logic — major tier is
   `0` (e.g. `v0.3`, `v0.2.1`) OR it is not a `vN.0` release for `N >= 1`. Do NOT
   use a `v0\.\d+` regex: it wrongly rejects valid branch labels like `v0.1.1`
   and post-v1 labels like `v1.2` that `promoteToMajor` supports.
4. Compute new label via the `promoteToMajor` algorithm:
   - `v0.3` -> `v1.0`
   - `v0.3.1` -> `v1.0`
   - `v1.2` -> `v2.0`
5. Rename the version directory.
6. Update `session.drafts[].version_label`.
7. Set `session.released_draft_id`.
8. If `current_bearing.contract_seed` exists, print it as the suggested
   Decision Contract seed to carry into the webapp or future plugin loop.

Report:

```text
Anchored {{old_label}} -> {{new_label}}.
Released draft: {{new_label}}
Contract seed: {{predicate or "none"}}
```

---

## `--delete <session-id>`

Ask one confirmation:

- Title: `Delete Session`
- Question: `Delete {{id}}? This cannot be undone.`
- Options:
  - `Delete`
  - `Cancel`

Only delete after confirmation. Then remove the directory **cross-platform** —
this skill runs on Windows too. Use the Claude Code file tools, or
`rm -rf .argus/sessions/{{id}}/` on Unix / `Remove-Item -Recurse -Force .argus/sessions/{{id}}/`
on Windows. Do NOT assume `rm -rf` exists — on win32/PowerShell it fails and the
user is wrongly told the session was deleted.

---

## `--tree`

Render all sessions with session id, active label, released label, and compact
tree. Keep each session to a few lines.

---

## `--json`

Emit:

```json
{
  "sessions": [
    {
      "id": "...",
      "phase": "...",
      "active_label": "...",
      "released_label": "...",
      "current_course": "...",
      "verification_status": "...",
      "drafts": []
    }
  ]
}
```

---

## Version Label Algorithm

```text
nextChildLabel(parent_label, existing_children):
  if existing_children is empty:
    return incrementLastTier(parent_label)
  return parent_label + "." + (branch_count + 1)

incrementLastTier("v0.3") -> "v0.4"
promoteToMajor("v0.3") -> "v1.0"
promoteToMajor("v1.2") -> "v2.0"
```

ROOT_LABEL = `v0`. First child = `v0.1`.

---

## Meta-Check Gates

- **No LLM:** version tree never invokes an LLM.
- **Idempotent default:** `/argus:history versions` does not mutate state.
- **Read-centered:** default view starts from current course and next step.
- **Branch clarity:** active and released drafts are visibly distinct.
- **Safe mutation:** checkout/promote/delete read and verify before writing.

---

## Forbidden Patterns

- Generating new analysis in version tree.
- Printing long worker internals in the default version tree.
- Auto-promoting without confirmation when the read is not anchor-ready.
- Deleting without confirmation.
- Rewriting version labels outside the promotion path.
