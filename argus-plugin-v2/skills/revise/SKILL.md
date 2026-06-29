---
name: revise
description: Apply boss concerns and/or verify's challenged claims to a reviewed scaffold and produce a NEW child draft — the iteration loop that turns a one-shot answer into a converging decision. Branches from the active draft, re-runs the relevant workers with the specific fixes injected, re-verifies, and appends the result to the version tree. Use after /argus:boss or /argus:verify when you want to act on the feedback instead of just reading it. Invoked as `/argus:revise`.
---

# /argus:revise

**What this skill does:** Takes the feedback already produced (boss concerns, verify challenges) and produces a **new child draft** that actually addresses it — re-running the owning workers with the specific fixes injected, then re-verifying. This closes the loop: clarify → team → verify → boss → **revise** → (verify) → …

**Why this matters:** Without revise, a finished voyage is read-only — the user gets a scaffold with concerns and has nowhere to go. The second run is what determines whether anyone keeps using the tool. revise is the bridge from "here's what's wrong" to "here's the fixed version, and here's whether the fix held."

---

## When to run

Invoke after:
- `/argus:boss` produced concerns (phase `refining`), OR
- `/argus:verify` routed `revise_team` / produced `challenged_claims[]`, OR
- the user explicitly says "반영해줘 / apply the feedback / revise this".

Refuse when:
- No session exists, or the active draft has neither `boss_feedback.json` nor `verification.json` → there is no feedback to apply yet. Direct the user to run `/argus:verify` (and optionally `/argus:boss`) first.

---

## Inputs

- `--session <id>` optional. Defaults to latest.
- `--from <version-label>` optional. Revise from a specific draft instead of the active one (e.g. branch from an older `v0.1` while `v0.2` exists). Defaults to `session.active_draft_id`.
- `--invoked-via-sail` optional. Suppress the verbose report; emit a one-line transition (sail owns the card).
- `--no-prompt` optional. Don't AskUserQuestion; apply all `critical`/`applied` items automatically. For automated/test runs.
- `--max-revisions <N>` optional. Writes `session.max_revise_cycles` (default 3). The hard cap on automated revise cycles; once `session.revise_cycles` reaches it, the loop stops and remaining challenges escalate to a human check instead of re-running.

---

## Execution steps

### Step 1 — Load the draft being revised

1. Read `.argus/config.yaml` for `locale`. All user-facing text uses it.
2. Find the session; resolve the parent draft: if `--from <label>` is given, find the draft in `session.drafts[]` whose `version_label` matches it; else use `session.active_draft_id`. Call its id `parent_draft_id` and its `version_label` `parent_label`. (Everything downstream branches from THIS draft, not necessarily the active one — `--from v0.1` while `v0.2` is active must branch from `v0.1`.)
3. Read from `versions/{parent_label}/`: `scaffold.json` (required), `boss_feedback.json` (if present), `verification.json` (if present).
4. If neither `boss_feedback.json` nor `verification.json` exists, halt: there is nothing to revise. Point the user to `/argus:verify` first.
5. Defensive-read every JSON (see clarify error modes — the canonical discipline) — on parse failure, quarantine the file to `<name>.corrupt.<ts>`, log to `errors.log`, and report the recovery path; never crash. **Distinguish missing from corrupt:** a *missing* `verification.json`/`boss_feedback.json` means there is nothing to revise yet → point the user to `/argus:verify` (Step 4 already halts on this). A *corrupt* one is different — it must NOT be read as "not run": revising against a `verification.json` you couldn't parse (treating it as "no challenges") would silently drop the very challenges this skill exists to apply. Halt naming the file to recover rather than producing a child draft from an unreadable parent record.

### Step 2 — Gather the revision items

Build a list of concrete things to fix, each tied to an owner:

- From `boss_feedback.json.concerns[]`: every concern with `applied == true` (critical ones default applied). Each → `{ source: "boss_concern", text, suggested_fix, owner_agent_id, severity }`. **Boss concerns carry no owner — revise resolves it here** (the boss reviews the scaffold, not a specific worker). See §Resolving the owner below; the resolved `owner_agent_id` is required, never left blank.
- From `verification.json.challenged_claims[]`: every `critical` / `important` challenge. Each → `{ source: "challenged_claim", text: claim, suggested_fix, owner_agent_id, severity }`. Verify already attributes these to the originating worker.
- **`verification.json.root_crack`** (if non-null): the **reality reef** — an
  `external`, load-bearing claim only reality can confirm. Re-running the team
  CANNOT settle it (the agents would just re-agree), so do **NOT** add it to
  `items[]`. Instead carry it into the child scaffold's
  `human_required_checkpoints[]` (`reason: "reality_reef"`) so the next draft
  still surfaces the real-world check. revise repairs only the *agent-fixable*
  (internal) challenged claims; the reef stays a human/external check.
- Any free-text directive the user typed in the invocation. Owner = `navigator` (synthesis pass).

**§Resolving the owner for a boss concern (so none is silently lost).** Each
applied concern's `text` points to WHERE (section/line) per the dm-feedback
schema. Resolve in order:
1. **Section → worker.** Match the targeted section to the worker who produced it
   (`mix.json` records each section's contributing worker; fall back to scaffold
   section attribution). Assign that `owner_agent_id`.
2. **Cross-cutting → `navigator`.** If the concern targets the synthesis, the
   overall frame, or a contradiction *between* workers (no single owner), assign
   `owner_agent_id = "navigator"` — the synthesis pass owns cross-cutting rework.
3. **Not worker-addressable → human check, not a revision item.** If the concern
   cannot be resolved by re-running any worker (e.g. "needs real legal sign-off",
   "the market data doesn't exist yet"), do NOT add it to `items[]`. Append it to
   the scaffold's `human_required_checkpoints[]` with `reason: "boss_concern_unrouted"`
   so it survives into the bearing. Surfacing it is the honest outcome; dropping it
   is the bug this rule closes.

Every applied boss concern ends as exactly one of: an owned `items[]` entry, or a
`human_required_checkpoints[]` entry. None disappears.

**Human choice (unless `--invoked-via-sail` or `--no-prompt`):** use AskUserQuestion to confirm which items to apply — preselect all `critical` items. Keep it to one compact multi-select, not a chat.
- ko Title: `무엇을 반영할까요?` — options are the items as `[{{severity}}] {{text}}`, plus "직접 입력".
- en Title: `Which feedback should I apply?` — same shape, plus "Let me type it".

If the user deselects everything, exit without creating a draft ("반영할 항목이 없습니다 / nothing selected").

### Step 3 — Stage the revision for the team

Write `.argus/sessions/{id}/pending_revision.json` (a transient hand-off file, consumed and deleted by team):

```json
{
  "parent_draft_id": "{parent_draft_id}",
  "parent_label": "{parent_label}",
  "directive_text": "Address: rollout kill-criteria; tighten the cost model.",
  "reality_reef": "GDPR readiness is already complete",
  "items": [
    { "source": "challenged_claim", "text": "...", "suggested_fix": "...", "owner_agent_id": "donghyuk", "severity": "important" }
  ]
}
```

`reality_reef` is the claim string from `verification.json.root_crack` (omit the
key when it was null) — it is preserved as a human check, NOT an `items[]` entry
to be re-run. `items[]` holds only the agent-fixable (internal) challenged claims.

Set `session.phase = "team_deploying"` and `updated_at`.

### Step 4 — Re-run the team on a new child draft

Invoke `/argus:team --revise` (and `--invoked-via-sail` if this skill was). Team will:
- Branch from `pending_revision.parent_draft_id` (the resolved parent — NOT necessarily `session.active_draft_id`) → compute the child label via `nextChildLabel` from `parent_label` (e.g. revising `v0.1` while `v0.2` exists → `v0.1.1`; revising the latest → `v0.2`). (team Step 1.4)
- Read `pending_revision.json` and inject each item into its `owner_agent_id` worker's prompt ("Your prior output was challenged on X; the suggested fix is Y — produce a revised analysis that addresses it"). Workers without a targeted item carry their prior output forward unchanged where possible.
- Write the new `versions/{child_label}/` artifacts and append a child Draft with `directive = directive_text`, `reviewing_agent_id = "navigator"`, `parent_draft_id` set, and `set session.active_draft_id` to it.
  - **`change_summary`**: a NEUTRAL record of what this draft changed — name the items addressed, e.g. `"반영: 출시 kill-criteria, 비용 모델"` (ko) / `"addressed: rollout kill-criteria, cost model"` (en). When a `reality_reef` was carried forward, append `"· 현실 확인 대기: {reef}"` / `"· awaiting reality check: {reef}"`. Do NOT label it "첫 균열/first crack/wrongest" or any ranking verdict — the tree records *what changed and what's still open*, never a judgment about which claim was most wrong (spine: no laundered verdict in a persistent label).
- Delete `pending_revision.json`.

### Step 5 — Re-verify the revision

Invoke `/argus:verify` (`--invoked-via-sail` if applicable) on the new child draft. The whole point is to learn **whether the fix held** — did the previously-challenged claims become supported, or are they still challenged? Verify writes the new `verification.json` + scaffold summary as usual.

**Convergence check (the exit condition `converging` means).** Compare the new
`verification.json` against the parent's. A claim that was challenged before and is
**still challenged** did not converge. If a still-challenged claim is a repeat
(same claim across this revision), OR `session.revise_cycles >= session.max_revise_cycles`,
do **NOT** invite another automatic pass — append it to the scaffold's
`human_required_checkpoints[]` with `reason: "unconverged_after_revision"` and tell
the user it needs a human, not another loop. Verify's Step 7 enforces the same cap
on the automated path; this is the human-visible half. A new pass is only offered
when there is genuinely new, agent-addressable feedback under the cap.

### Step 6 — Report

#### `--invoked-via-sail`
One value-oriented line (version labels are fine — chart shows them — but no
"N items applied · re-verify next" machinery), then let sail Step 7 render the card:
```
✓ Revised the draft ({{parent_label}} → {{child_label}}). Re-checking whether the fix held.
```

#### Direct invocation
Show what changed and whether it held (locale-aware):
```
## Argus · Revise · {{parent_label}} → {{child_label}}

**Applied ({{N}}):**
- [{{severity}}] {{item.text}} → addressed by {{owner_agent_id}}

**Re-verification:** {{new overall_status}} ({{new supported}}↑ / {{new challenged}}↓)
{{if a previously-challenged claim is now supported}}✓ Resolved: {{claim}}{{endif}}
{{if still challenged AND converging}}⚠ Still challenged: {{claim}} — one more agent pass may resolve it ({{revise_cycles}}/{{max_revise_cycles}}){{endif}}
{{if still challenged AND NOT converging (repeat or cap reached)}}⛔ Not converging: {{claim}} — escalated to a human check ({{reason}}); another auto-pass won't help{{endif}}

**Next:** `/argus:boss` to re-review · `/argus:chart` to see the tree{{if converging AND under cap}} · `/argus:revise` again if needed{{endif}}
```

---

## Meta-check gates

- **Actually addresses the item**: each applied item must map to a concrete change in the new scaffold (an updated assumption evaluation, a new/edited action, a resolved challenge). A revise that changes nothing is a failure — re-run with the fix stated more explicitly.
- **Branch integrity**: the new draft's `parent_draft_id` MUST point to the revised-from draft, and its label MUST be a child of the parent's (never overwrite the parent — drafts are immutable). The parent stays intact for comparison.
- **Honest re-verification**: do NOT mark a previously-challenged claim resolved unless the new evidence actually supports it. "Still challenged after revision" is a valid, important outcome — surface it.
- **No silent scope creep**: revise applies the selected feedback; it does not re-open the framing or swap the real_question. For a new question, that's a new session.

---

## Error modes

- **`pending_revision.json` left over from a failed prior run**: if one exists at Step 3, it's stale — overwrite it (its parent_draft_id tells you which run it belonged to).
- **team or verify sub-step fails**: the parent draft is untouched (immutable), so the session is recoverable. Log to `.argus/sessions/{id}/errors.log`, report which step failed, leave `active_draft_id` on the parent.
- **Nothing to apply** (no applied concerns, no challenges, empty selection): exit cleanly without creating an empty child draft.

---

## Forbidden patterns

- Mutating the parent draft's version dir. Revision always creates a NEW child; the tree is append-only.
- Re-running the full pipeline from clarify. Revise reuses the locked framing + analysis; only the workers re-run with fixes.
- Marking the revision "verified" itself — `/argus:verify` (Step 5) owns that, on the new draft.
- Applying feedback the user deselected.
- Looping past `session.max_revise_cycles`, or re-issuing `revise_team` on a claim that survived a prior revision. An unconverged claim escalates to a human check (`unconverged_after_revision` / `max_revisions_reached`) — it does NOT auto-loop forever.
