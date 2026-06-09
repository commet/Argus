---
name: chart
description: Display the chart of the current Argus session — its version tree, phase, agents deployed, verification status, open concerns, and any active drafts. The 해도 view of your decision voyage. Read-only utility. Use to navigate the draft branch history, promote a draft to v1.0, switch active draft, or delete stale sessions. No LLM work here — pure file reading + terminal rendering. Invoked as `/argus:chart`.
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

### Step 0 — Load config & guard for empty state

1. Read `.argus/config.yaml` (silent-create from `~/.claude/argus-lib/config.example.yaml` if missing, same as other skills). All user-facing text in this skill uses `config.locale`.
2. **Zero-sessions guard:** if `.argus/sessions/` does not exist or contains no session directory, do NOT error. Print and stop:
   - ko: `아직 Argus 항해 기록이 없습니다. \`/argus:sail "<결정>"\` 로 시작하세요.`
   - en: `No Argus voyages yet. Start one with \`/argus:sail "<your decision>"\`.`
3. **Legacy guard:** if only pre-v2 (`v0.5`-era) files exist with no `session.json`, note that legacy sessions aren't rendered by this version and point to the newest v2 session if any.

### Default (no flags) — show current session

1. Find the latest session: the session directory whose `session.json` has the newest `updated_at`; if `updated_at` is missing or tied, fall back to directory mtime. Read its `session.json`.
2. Read these per-version files for the active draft: `versions/{label}/scaffold.json` (Current block — reframed_question, assumptions, checkpoints), `workers.json` (agent count), `verification.json` (verification line), `boss_feedback.json` (boss status + concern count). Treat any missing file as "not run" rather than failing.
3. Parse draft tree from `session.drafts[]`. If `drafts[]` is empty (session predates draft persistence, or only clarify ran), render a single-node tree from the version directories present instead of a blank tree.
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
- Verification: {{overall_status or "not run"}} · supported {{N}} · challenged {{N}} · human checks {{N}}
- Boss reviewed: {{yes/no, mbti_code}}
- Critical concerns open: {{count}}
- Hidden assumptions: {{count}} ({{N doubtful}})
- Human checkpoints: {{count}}

## Next
- If verification is missing: run `/argus:verify`
- If verification is blocked: complete human checks, then `/argus:sail --resume {{session.id}}`
- Apply boss concerns (revise — post-MVP): edit `versions/{{active_label}}/scaffold.json` directly, then re-run `/argus:boss` to re-review. (A dedicated `/argus:revise` that forks a new draft is planned.)
- Promote this draft to v1.0: `/argus:chart --promote {{active_label}}`
```
(Branch-from-older-draft via `/argus:chart --checkout <label>` is available, but creating a revised child draft from it needs `/argus:revise`, which is post-MVP — see note above.)

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
3. No content copy needed: `session.active_draft_id` is the only pointer that moves. The Current view and every downstream reader resolve the active draft's `version_label` and read `versions/{label}/scaffold.json` directly (it is authoritative). There is no `session.final_scaffold` to sync — the skeleton holds pointers, not scaffolds.
4. Report: "Switched active draft to {{label}}. Run `/argus:chart` to see tree."

### Flag: `--promote <label>`

1. Verify label is pre-release via `isPreRelease()` logic — major tier is `0` (e.g. `v0.3`, `v0.2.1`) OR it is not a `vN.0` release for `N >= 1`. Do NOT use a `v0\.\d+` regex: it wrongly rejects valid branch labels like `v0.1.1` and post-v1 labels like `v1.2` that `promoteToMajor` supports.
2. Compute new label via promoteToMajor algorithm:
   - `v0.3` → `v1.0`
   - `v0.3.1` → `v1.0`
   - `v1.2` → `v2.0`
3. Rename `versions/{old_label}/` → `versions/{new_label}/`.
4. Update `session.drafts[].version_label` for that draft.
5. Set `session.released_draft_id` to that draft's id.
6. Report: "Promoted {{old}} → {{new}}. Marked as released."

### Flag: `--delete <session-id>`

1. AskUserQuestion (locale-aware):
   - **ko** — Title: "정말 삭제?" · Question: "세션 {{id}} — {{problem_text_snippet}}. 복구 불가능합니다." · Options: "네, 삭제", "아니오, 취소"
   - **en** — Title: "Delete session?" · Question: "Session {{id}} — {{problem_text_snippet}}. This cannot be undone." · Options: "Yes, delete", "No, cancel"
2. If confirmed, remove the directory cross-platform (this skill runs on Windows too): use the Claude Code file tools, or `rm -rf .argus/sessions/{{id}}/` on Unix / `Remove-Item -Recurse -Force .argus/sessions/{{id}}/` on Windows. Do NOT assume `rm -rf` exists — on win32/PowerShell it fails and the user is wrongly told the session was deleted.
3. Report (locale-aware): ko "{{id}} 삭제됨." / en "Deleted {{id}}."

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
