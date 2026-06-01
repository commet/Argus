---
name: chart
description: Display the chart of the current Argus session — its version tree, phase, agents deployed, open concerns, and any active drafts. The 해도 view of your decision voyage. Read-only utility. Use to navigate the draft branch history, promote a draft to v1.0, switch active draft, or delete stale sessions. No LLM work here — pure file reading + terminal rendering. Invoked as `/argus:chart`.
---

# /argus:chart

**What this skill does:** Shows current Argus session state. Pure read-only (except when flags explicitly mutate).

**Why this matters:** Draft branching is the plugin's unique affordance. Without a clear way to see the tree, branching becomes invisible. This skill is the "해도" view.

---

## When to run

- User invokes `/argus:chart` anytime
- User wants to switch drafts: `/argus:chart --checkout <version-label>`
- User wants to promote a draft: `/argus:chart --promote <version-label>`
- User wants to delete a session: `/argus:chart --delete <session-id>` (interactive confirm)

---

## Inputs

- **Session** (optional): `--session <id>`, else latest.
- **Flags** (mutually exclusive):
  - `--tree` — show all sessions' version trees, not just current
  - `--checkout <label>` — switch active draft
  - `--promote <label>` — relabel to v{major}.0 and mark released
  - `--delete <session-id>` — remove session directory (requires confirm)
  - `--json` — emit machine-readable JSON instead of formatted tree

---

## Execution steps

### Default (no flags) — show current session

1. Find latest session. Read `session.json`.
2. Read all `versions/*/` metadata.
3. Parse draft tree from `session.drafts[]`.
4. Render as ASCII tree:

```
## Session: {{session.id}}
**Problem:** {{session.problem_text[:60]}}...
**Phase:** {{phase}} · **Round:** {{round}}/{{max_rounds}}
**Boss:** {{boss.mbti_code}} {{boss.name}} (or "not configured")

## Version Tree
{{draft tree rendered — see below}}

## Current (active_draft_id: {{active_id}})
- Reframed question: {{latest scaffold.reframed_question}}
- Team deployed: {{N}} agents
- Boss reviewed: {{yes/no, mbti_code}}
- Critical concerns open: {{count}}
- Hidden assumptions: {{count}} ({{N doubtful}})
- Human checkpoints: {{count}}

## Next
- Applied concerns not yet finalized: use `/argus:revise` to apply them
- Promote this draft to v1.0: `/argus:chart --promote {{active_label}}`
- Start new branch from older draft: `/argus:chart --checkout <label>` then `/argus:revise`
```

### Tree rendering

For `drafts[]` with `parent_draft_id` relationships, render as tree. Example for a session with v0.1 → v0.2 → v0.2.1 (branch) and v0.1 → v0.3 (alt path on main line):

```
v0.1 ──┬── v0.2 ──── v0.2.1  (branch)
       └── v0.3  ← active
```

Algorithm:
1. Find root (parent_draft_id == null).
2. Recursively walk children by `parent_draft_id`.
3. Use ASCII box-drawing: `├`, `└`, `─`, `│`.
4. Mark active draft with `← active`.
5. Mark released draft (if any) with `🏷 released`.
6. Annotate each node with `change_summary` in parentheses.

Example with annotations:
```
v0.1 ──┬── v0.2 (인력 추가 반영) ──── v0.2.1 (ISTJ 우려 반영)  ← active
       └── v0.3 (범위 축소 시나리오)  🏷 released
```

### Flag: `--checkout <label>`

1. Verify label exists in `session.drafts[]`.
2. Update `session.active_draft_id` to that draft's id.
3. Copy that draft's `final_scaffold` content to `versions/{label}/` if switching branches changes the "latest" view.
4. Report: "Switched active draft to {{label}}. Run `/argus:chart` to see tree."

### Flag: `--promote <label>`

1. Verify label is pre-release (matches `v0\.\d+`).
2. Compute new label via promoteToMajor algorithm:
   - `v0.3` → `v1.0`
   - `v0.3.1` → `v1.0`
   - `v1.2` → `v2.0`
3. Rename `versions/{old_label}/` → `versions/{new_label}/`.
4. Update `session.drafts[].version_label` for that draft.
5. Set `session.released_draft_id` to that draft's id.
6. Report: "Promoted {{old}} → {{new}}. Marked as released."

### Flag: `--delete <session-id>`

1. AskUserQuestion:
   - Title: "정말 삭제?"
   - Question: "세션 {{id}} — {{problem_text_snippet}}. 복구 불가능합니다."
   - Options: "네, 삭제", "아니오, 취소"
2. If confirmed: `rm -rf .argus/sessions/{{id}}/`.
3. Report: "Deleted {{id}}."

### Flag: `--tree`

Render all sessions' trees in one view. Use session id as section header.

### Flag: `--json`

Emit machine-readable summary for integration:
```json
{
  "sessions": [
    {
      "id": "...",
      "phase": "...",
      "drafts": [...],
      "active_draft_id": "...",
      "released_draft_id": "..."
    }
  ]
}
```

---

## Version label algorithm (ported from lib/version-numbering.ts)

```
nextChildLabel(parent_label, existing_children):
  if existing_children is empty:
    # Main line continues
    return incrementLastTier(parent_label)
  else:
    # New branch
    branch_prefix = parent_label + "."
    branch_count = count of existing_children starting with branch_prefix
    return branch_prefix + (branch_count + 1)

incrementLastTier(label):
  parts = parse "v0.3" → [0, 3]
  parts[last] += 1
  return "v" + parts.join(".")

promoteToMajor(label):
  parts = parse
  major = parts[0] + 1
  return "v" + major + ".0"
```

ROOT_LABEL = `"v0"` (virtual root). First child = `v0.1`.

---

## Meta-check gates

- **No LLM**: this skill must not invoke LLM. Pure filesystem operation.
- **Idempotent**: running `/argus:chart` repeatedly must not mutate state.
- **Read-before-write**: mutations (--checkout, --promote, --delete) must read the session first, verify the target exists, then write.

---

## Forbidden patterns

- Generating analysis or commentary in the status output. Just state.
- Silently auto-promoting or auto-deleting. Always confirm.
- Rewriting version labels outside the `promoteToMajor` path (breaks tree integrity).
