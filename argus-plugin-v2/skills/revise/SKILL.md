---
name: revise
description: Revise an Argus draft after verification, boss feedback, or a user directive. Creates a child version using the navigator agent, preserving attribution and unresolved tensions while applying only the requested changes. Invoked as `/argus:revise`.
---

# /argus:revise

**What this skill does:** Creates a new child draft from the active Argus draft.
It is the repair loop after `/argus:verify` or `/argus:boss`.

**Why this matters:** Verification is only useful if challenged output can be
repaired without restarting the whole session. Revise turns the current scaffold
into the next version while preserving the audit trail.

---

## When To Run

Invoke when:

- verification routed to `revise_team`,
- boss concerns should be applied,
- user asks to revise, refine, repair, shorten, make decisive, or branch from an
  older draft,
- `/argus:chart` says the active draft has open concerns.

Refuse when:

- no session exists,
- there is no active draft or `scaffold.json`,
- the latest output is `minimal_scaffold.json` only,
- the requested change requires external/human evidence that has not been
  provided.

---

## Inputs

- `/argus:revise "<directive>"` - revise active draft.
- `/argus:revise --apply-boss` - apply boss concerns that were accepted or not
  yet applied.
- `/argus:revise --repair-verification` - repair challenged claims that are
  agent-owned.
- `/argus:revise --session <id>` - target a specific session.
- `/argus:revise --from <label>` - branch from a specific version label.
- `/argus:revise --no-verify` - create the child draft but do not immediately
  route to `/argus:verify`.

If no directive/flag is provided, ask one compact `AskUserQuestion`:

- `Apply boss concerns`
- `Repair verification challenges`
- `Custom revision`

For custom revision, request one short directive.

---

## Execution Steps

### Step 1 - Load State

1. Read `.argus/config.yaml` for locale.
2. Find the target session.
3. Resolve parent draft:
   - `--from <label>` if provided,
   - otherwise `session.active_draft_id`,
   - otherwise latest draft by `created_at`.
4. Read `versions/{parent_label}/scaffold.json`.
5. Read optional files in the same version:
   - `verification.json`
   - `boss_feedback.json`
   - `mix.json`
   - `workers.json`
   - `debate.json`

If `verification.routing_decision == "stop_for_human_check"` and the user did
not provide new human evidence in the directive, stop and show the required
checks. Do not revise around missing evidence.

### Step 2 - Build Revision Directive

Create a clear directive string:

- `--apply-boss`: apply critical and important boss concerns with their
  `fix_suggestion`.
- `--repair-verification`: repair `challenged_claims[]` where
  `owner_agent_id` exists or the suggested fix is agent-owned.
- quoted directive: use the user's exact intent.

Keep human-only issues as `human_required_checkpoints[]`; do not pretend they
were solved.

### Step 3 - Compute Child Label

Use `lib/session/version-numbering.md`:

1. Parent label is the active/from label.
2. Find existing children of that parent in `session.drafts[]`.
3. If none exist, child label is `incrementLastTier(parent_label)`.
4. If children exist, child label is `parent_label + "." + (branch_count + 1)`.

Examples:

- parent `v0.1`, no children -> `v0.2`
- parent `v0.1`, existing main child `v0.2` -> `v0.1.1`
- parent `v1.0`, no children -> `v1.1`

### Step 4 - Invoke Navigator

Spawn the `navigator` agent with:

- parent scaffold,
- verification ledger,
- boss feedback,
- relevant mix/worker excerpts,
- directive,
- required output shape from `agents/navigator.md`.

Navigator must return:

- `change_summary`,
- `changed_fields`,
- `revision_notes`,
- `requires_reverification`,
- `scaffold_patch`.

If the navigator tries to mark the draft as verified, retry with stricter
instructions.

### Step 5 - Create Child Scaffold

Apply the patch to the parent scaffold.

Rules:

- Preserve required `FinalScaffold` fields.
- Preserve `team_contradictions[]` unless explicitly resolved by new evidence.
- Preserve `human_required_checkpoints[]`; append new human checks from
  verification/boss when needed.
- Set `verification` on the child:
  - if `requires_reverification == true`: `{ overall_status: "unverified", supported_count: 0, challenged_count: 0, human_check_count: <current human checkpoints count>, routing_decision: "not_run", top_challenge: "Revision changed claims; rerun /argus:verify" }`
  - if `requires_reverification == false`: copy parent verification summary.

Write:

- `versions/{child_label}/scaffold.json`
- `versions/{child_label}/revise_directive.txt`
- `versions/{child_label}/revision_notes.json`
- copy forward `mix.json`, `workers.json`, and `debate.json` when present
- copy forward `boss_feedback.json` only when the child still reflects it

Do not copy forward `verification.json` when `requires_reverification == true`.
That would make stale verification look current.

### Step 6 - Update Session

Append a `Draft`:

```json
{
  "id": "draft-...",
  "parent_draft_id": "<parent id or null>",
  "version_label": "<child_label>",
  "change_summary": "<navigator change_summary>",
  "directive": "<directive>",
  "reviewing_agent_id": "navigator",
  "final_scaffold": "<child scaffold>",
  "final_mix": "<copied mix or null>",
  "dm_feedback": "<copied boss feedback or null>",
  "created_at": "<now>"
}
```

Update:

- `active_draft_id` to the child draft id,
- `final_scaffold` to the child scaffold,
- `phase` to `verifying` when reverification is needed, otherwise `complete`,
- `verification` to null when reverification is needed, otherwise preserve parent
  ledger,
- `updated_at`.

### Step 7 - Next Route

If `requires_reverification == true` and `--no-verify` is not set:

1. Print one transition line.
2. Invoke `/argus:verify --session <id>` on the child draft.

If `--no-verify` is set, stop after writing the child and show the exact next
command:

```text
/argus:verify --session <id>
```

### Step 8 - Report

Keep output to one screen:

```text
## Argus - Revise - {{child_label}}

Changed: {{change_summary}}
Parent: {{parent_label}}
Fields: {{changed_fields joined}}
Reverification: {{yes/no}}

Next: {{/argus:verify ... or /argus:chart --promote child_label}}
Path: .argus/sessions/{{id}}/versions/{{child_label}}/
```

---

## Meta-Check Gates

- **No stale verification:** If meaning changed, the child must not retain
  parent `verification.json`.
- **No lost blockers:** Human-required checks from parent, verification, and boss
  must remain visible.
- **No contradiction erasure:** Do not remove unresolved tensions without new
  evidence or explicit user directive.
- **Minimal delta:** Change only fields implicated by the directive.
- **Version integrity:** Child label must follow `version-numbering.md`.

---

## Forbidden Patterns

- Editing parent version files in place.
- Marking a revised draft as verified without rerunning `/argus:verify`.
- Using boss feedback as proof.
- Treating human-only checks as agent-owned repairs.
- Re-running the whole team when a targeted revision is enough.
