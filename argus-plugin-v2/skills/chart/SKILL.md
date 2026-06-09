---
name: chart
description: Display the chart of the current Argus decision voyage: version tree, active draft, Current Bearing summary, verification state, open concerns, and next route. Read-only by default; supports checkout, promote, delete, and json flags. Invoked as `/argus:chart`.
---

# /argus:chart

**What this skill does:** Shows the map of an Argus session. It is the user's
way to see branches, active draft, released draft, current bearing, blockers,
and the next useful command.

**Default behavior:** read-only. No LLM. No analysis generation.

---

## When To Run

- `/argus:chart`
- `/argus:chart --session <id>`
- `/argus:chart --tree`
- `/argus:chart --checkout <version-label>`
- `/argus:chart --promote <version-label>`
- `/argus:chart --delete <session-id>`
- `/argus:chart --json`

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

1. Find latest or requested session.
2. Read `session.json`.
3. Read all `versions/*/meta.json` when present.
4. Read active version:
   - `current_bearing.json` if present
   - `scaffold.json`
   - `verification.json`
   - `boss_feedback.json` if present
5. Render a one-screen map.

```text
## Argus Chart - {{session.id}}

Problem: {{problem_text[:80]}}
Active: {{active_label}}  Released: {{released_label or "-"}}

Current Bearing:
- Course: {{current_bearing.current_course.summary or "not rendered yet"}}
- Fog/Reef: {{current_bearing.fog_or_reef.issue or "none named"}}
- Next helm: {{current_bearing.next_helm or "run /argus:sail --resume {{id}}"}}

Version Tree:
v0.1 (initial bearing)
  `- v0.2 (applied verification repair)  [active]
  `- v0.1.1 (alternate lower-scope course)

Open Checks:
- Verification: {{overall_status or "not run"}}
- Human checks: {{first human check or "none"}}
- Boss condition: {{approval_condition or "none"}}

Next:
- {{computed next command}}
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
6. Include `change_summary` when present.

ASCII example:

```text
v0.1 (initial scaffold)
  |- v0.2 (verification repair) [active]
  `- v0.1.1 (lower-scope branch) [released]
```

Avoid fragile box-drawing characters; this runs in varied terminals.

---

## Next Command Logic

Compute the next useful command:

- Missing `verification.json` on a medium/high draft -> `/argus:verify --session <id>`
- Verification `revise_team` -> `/argus:revise --repair-verification --session <id>`
- Verification `stop_for_human_check` -> show the first human check and
  `/argus:sail --resume <id>` after evidence is added
- Boss critical applied concerns exist -> `/argus:revise --apply-boss --session <id>`
- No `current_bearing.json` -> `/argus:sail --resume <id>`
- Bearing status is `anchor` -> `/argus:chart --promote <active_label>`
- Otherwise -> `/argus:revise "<directive>"` or `/argus:chart --promote <active_label>`

---

## `--checkout <label>`

1. Verify label exists.
2. Update `session.active_draft_id`.
3. Do not rewrite draft contents.
4. Report:

```text
Switched active draft to {{label}}.
Next: /argus:sail --resume {{session.id}}
```

---

## `--promote <label>`

Promote means anchor: this is the draft the user is ready to treat as released.

1. Verify label exists.
2. Verify the active version has either:
   - `current_bearing.current_course.status == "anchor"`, or
   - user explicitly confirms promotion despite non-anchor status.
3. Compute new label:
   - `v0.3` -> `v1.0`
   - `v0.3.1` -> `v1.0`
   - `v1.2` -> `v2.0`
4. Rename the version directory.
5. Update `session.drafts[].version_label`.
6. Set `session.released_draft_id`.
7. If `current_bearing.contract_seed` exists, print it as the suggested
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

Only delete after confirmation.

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

- **No LLM:** chart never invokes an LLM.
- **Idempotent default:** `/argus:chart` does not mutate state.
- **Bearing-centered:** default view starts from current course and next helm.
- **Branch clarity:** active and released drafts are visibly distinct.
- **Safe mutation:** checkout/promote/delete read and verify before writing.

---

## Forbidden Patterns

- Generating new analysis in chart.
- Printing long worker internals in the default chart.
- Auto-promoting without confirmation when the bearing is not anchor-ready.
- Deleting without confirmation.
- Rewriting version labels outside the promotion path.
