---
name: sail
description: Top-level Argus orchestrator. Routes a decision through clarify, crew work, verification, optional stakeholder review, and a compressed Current Bearing. The user-facing product is a decision voyage with one practical bearing, not a multi-agent workflow report. Invoked as `/argus:sail`.
---

# /argus:sail

## Product Contract

Argus must not feel like a complex multi-agent machine. Internally it may run
clarify, team, verify, boss, and revise. Externally it gives the user their
current coordinates in a decision voyage:

> "I know the current course, why that course is justified, what remains foggy,
> what path I am not taking, what to do next, and what future claim could be
> checked against reality."

The default user-facing output is either:

- a MinimalScaffold for low-density reversible decisions, or
- a Current Bearing for medium/high decisions.

Do not expose worker counts, ledger counts, schemas, model names, or phase names
in the default bearing. Those details live in `.argus/sessions/` and
`/argus:chart`.

---

## When To Run

The default entry point:

- `/argus:sail "<problem description>"`
- `/argus:sail @PR#123`
- `/argus:sail @<file>`
- `/argus:sail`
- `/argus:sail --full "<problem>"`
- `/argus:sail --quick "<problem>"`
- `/argus:sail --no-boss "<problem>"`
- `/argus:sail --resume <session-id>`

---

## Path Resolution

Reference data resolves to:

- `~/.claude/argus-data/`
- `~/.claude/argus-lib/`

Session artifacts live in:

- `<cwd>/.argus/sessions/`

---

## Step 0 - Load Config

Read `.argus/config.yaml`.

If missing, silently create it from `~/.claude/argus-lib/config.example.yaml`.
Print one line only:

- en: "Created `.argus/config.yaml`. Continuing with defaults."
- ko: Translate the same sentence naturally.

Do not ask setup questions on first run.

---

## Step 1 - Parse Input

Determine:

- mode: new session, resume, or continue latest
- target: problem text, PR, file, branch, issue, or bare repo state
- flags: `--full`, `--quick`, `--no-boss`, `--resume`

If target is a file/PR/document, downstream skills must cite that artifact when
making claims. A generic answer after a user gives a file is a product failure.

---

## Step 2 - Resolve Session

1. If `--resume <id>`, load that session.
2. If bare `/argus:sail`, continue latest session when one is active.
3. If an existing session targets the same PR/file, ask one compact
   `AskUserQuestion`: continue existing or start fresh.
4. Otherwise create a new session and continue to clarify.

---

## Step 3 - Route By Phase

| Current phase | Next action |
|---|---|
| new / no session | `/argus:clarify` |
| `analyzing` or `conversing` without execution plan | `/argus:clarify --continue` |
| `conversing` with execution plan | `/argus:team` |
| `team_working` or `mixing` | show short progress/status |
| `verifying` or team complete without `verification.json` | `/argus:verify` |
| `dm_feedback` | `/argus:boss` |
| `refining` or `complete` | show Current Bearing/chart and offer `/argus:revise` |

---

## Step 4 - Full Pipeline

For `--full`, run:

1. `/argus:clarify --no-minimal`
2. `/argus:team --invoked-via-sail`
3. `/argus:verify --invoked-via-sail`
4. `/argus:boss --invoked-via-sail`, unless `--no-boss` or verification blocks
   review
5. Step 7 Current Bearing

Transitions must describe value, not machinery:

- en: "Narrowed the decision. Checking evidence..."
- en: "Separating weak claims from usable evidence..."
- en: "Setting the current bearing..."
- ko: Translate the same meanings naturally.

Forbidden transition strings:

- "team deployed"
- "verify ledger complete"
- "boss review running"
- "7 agents finished"
- "multi-agent orchestration"

---

## Step 5 - Quick Mode

`--quick` runs `/argus:clarify --no-minimal` and stops.

Use this when the user wants problem framing, not a full bearing. Do not run
team, verify, or boss. Do not render Current Bearing.

---

## Step 6 - Default Mode

Run `/argus:clarify` first, then branch.

### Step 6a - Low Density

If `decision_density == "low"`, clarify has already rendered MinimalScaffold and
written `minimal_scaffold.json`.

Exit silently. Do not reprint. Do not ask another question.

### Step 6b - Uncertain Stakes

If `decision_density in {"medium", "high"}` and `stakes_confidence < 75`, ask
one `AskUserQuestion`.

Question:

- en: "How heavy is this decision?"
- ko: Translate naturally.

Options:

- "Light framing only"
- "Current Bearing"
- "Treat as high-stakes"

Persist the chosen stakes and continue.

### Step 6c - Medium/High

When confidence is high enough, do not ask how to proceed. The user invoked
Argus to get orientation inside the decision, not to manage a workflow.

Print one line:

- en: "Checking evidence and weak claims, then returning the current bearing. (Ctrl-C to halt)"
- ko: Translate naturally.

Run:

1. `/argus:team --invoked-via-sail`
2. `/argus:verify --invoked-via-sail`
3. `/argus:boss --invoked-via-sail`, unless skipped or blocked
4. Step 7 Current Bearing

---

## Step 7 - Current Bearing

Current Bearing is the default consumable artifact. It hides the internal
pipeline but preserves the voyage shape: course, evidence, fog, road not taken,
next helm action, and an optional decision-contract seed.

Read:

- `analysis.json`
- `scaffold.json`
- `verification.json`
- optional `boss_feedback.json`
- optional `mix.json`

Write:

- `versions/{label}/current_bearing.json`, conforming to
  `~/.claude/argus-data/schemas/current-bearing.json`

### Current Bearing Mapping

Build:

- `label`: the active version label.
- `current_course.status`: one of `proceed`, `hold`, `fork`, `anchor`,
  `revise`, or `collect_evidence`.
- `current_course.summary`: what the user should understand as the current
  bearing.
- `why_this_course[]`: 1-3 concrete reasons tied to the user's repo/file/PR/
  document/session evidence.
- `fog_or_reef`: the biggest unsupported claim, contradiction, blocker, or
  human-only check. Use `null` only when there is no meaningful remaining fog.
- `road_not_taken[]`: up to 2 plausible alternatives and why they are not the
  current course.
- `next_helm`: one concrete next action.
- `contract_seed`: a falsifiable future predicate when the decision is close to
  anchor. Use `null` for early framing or missing evidence.
- `blocked`: true when verification routes to `revise_team` or
  `stop_for_human_check`.
- `detail_path`: `.argus/sessions/{id}/versions/{label}/`

If the user provided a file/PR/document and `why_this_course[]` contains no
source reference, treat the bearing as failed. Rebuild from artifacts or mark the
answer as not ready.

### Assembly Priority

Use artifacts in this order:

1. **Route:** start from `verification.routing_decision`.
   - `revise_team` -> `current_course.status = "revise"`
   - `stop_for_human_check` -> `current_course.status = "collect_evidence"`
   - `ask_user` without a recorded user choice -> `current_course.status = "hold"`
   - `proceed_to_boss` -> choose `proceed`, `fork`, or `anchor` from scaffold
     confidence and remaining tensions
2. **Reasons:** take strongest source-specific supported claims first. Then add
   boss approval condition only when it changes the course.
3. **Fog/Reef:** choose exactly one top item by priority:
   - critical challenged claim
   - blocking human-required check
   - unresolved tension with no tie-breaker result
   - critical boss concern
   - strongest remaining assumption
4. **Road not taken:** derive from `scaffold.key_trade_offs[]`,
   `verification.unresolved_tensions[]`, or explicit boss concerns. If none
   exists, create one from the rejected obvious alternative. For medium/high
   paths this field must contain 1-2 items.
5. **Next helm:** choose the smallest concrete action that moves the voyage:
   repair, human check, source pull, spike, or promotion.
6. **Contract seed:** include only when the current course is `proceed`, `fork`,
   or `anchor` and the predicate can be checked later. For blocked or early
   evidence-collection courses, use `null`.

### Status Mapping

- `proceed`: evidence is sufficient for a reversible next move.
- `hold`: do not decide yet; a specific check comes first.
- `fork`: two viable paths remain and the next action is to choose or test one.
- `anchor`: this draft can be promoted or sealed.
- `revise`: agent-owned claims need repair before the bearing is usable.
- `collect_evidence`: a human or external source must provide missing evidence.

When `verification.routing_decision` is `revise_team`, set `status: "revise"`.
When it is `stop_for_human_check`, set `status: "collect_evidence"`.

### Render - Default

Render in the user's locale. Keep the labels natural, but preserve this
information order:

```text
## Argus - Current Bearing - {{label}}

Current course: {{current_course.summary}}

Why this course:
- {{why_this_course[0].point}}{{if source}} ({{source}}){{endif}}
{{if why_this_course[1]}}- ...{{endif}}
{{if why_this_course[2]}}- ...{{endif}}

{{if fog_or_reef}}Fog / reef: {{fog_or_reef.issue}}
Why it matters: {{fog_or_reef.why_it_matters}}
{{if fog_or_reef.required_check}}Required check: {{fog_or_reef.required_check}}{{endif}}{{endif}}

{{if road_not_taken[0]}}Road not taken: {{road_not_taken[0].option}} - {{road_not_taken[0].why_not_now}}{{endif}}
{{if road_not_taken[1]}}Road not taken: {{road_not_taken[1].option}} - {{road_not_taken[1].why_not_now}}{{endif}}

Next helm: {{next_helm}}

{{if contract_seed}}Contract seed: {{contract_seed.predicate}}
Check by: {{contract_seed.check_by}}{{endif}}

{{if blocked}}Status: do not execute/sign off yet. The repair or check above comes first.{{endif}}
Details: {{detail_path}}
```

Target length: 10-16 lines. Never exceed one terminal screen.

### Bearing Rules

- Do not render counts like "4 supported / 2 challenged" in the default
  bearing.
- Do not mention agent count, model names, schemas, or internal phase.
- Do not show both a fog/reef item and a stakeholder concern if they are the
  same issue. Merge them.
- If evidence is thin, set the course to `hold` or `collect_evidence` instead
  of writing a longer report.
- Always include 1-2 road-not-taken items for medium/high decisions.
- Contract seed must be falsifiable. If it cannot be checked later, omit it.
- The detail path is a quiet escape hatch, not the main product.

---

## Boss Skip Handling

`--no-boss`, `boss = null`, or user choice can skip stakeholder review. Still
render Current Bearing. Do not mention that boss was skipped in the bearing.

---

## Outputs

| Path | What user sees |
|---|---|
| Low density | MinimalScaffold |
| Quick | Clarify scaffold |
| Medium/high | Current Bearing |

No JSON dumps. No path-only summaries. No internal pipeline report unless the
user explicitly asks for `/argus:chart` or opens session files.

---

## Meta-Check Gates

- **Surface compression:** default output fits one screen and contains only
  current course, why, fog/reef, road not taken, next helm, optional contract
  seed, and detail path.
- **Voyage continuity:** output preserves at least one alternate course or states
  why none matters.
- **Evidence feel:** when user gave a file/PR/document, the bearing must prove
  it read that artifact through source-specific reasons.
- **No false completion:** blocked or challenged output must not sound approved.
- **Analysis primacy:** clarify always runs first.
- **No machinery selling:** do not make the user care how many agents ran.
- **Decision-contract readiness:** when near anchor, include a falsifiable seed
  that could later be graded.

---

## Error Modes

- No args + no git state: ask for the decision question via AskUserQuestion.
- Session exists mid-phase: resume by default.
- Sub-skill fails: log to `.argus/errors.log`, show the shortest actionable
  failure, and stop.

---

## Forbidden Patterns

- Running team before clarify.
- Skipping verify on medium/high paths.
- Printing worker/ledger/boss internals in the default bearing.
- Asking "how should we proceed?" when confidence is high.
- Letting sub-skills print their full reports when `--invoked-via-sail` is set.
- Calling the final output SurfaceCard.
