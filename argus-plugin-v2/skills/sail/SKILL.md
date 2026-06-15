---
name: sail
description: Top-level Argus orchestrator. Routes a decision through clarify, crew work, verification, optional stakeholder review, and a compressed Current Bearing. Use whenever the user weighs a consequential decision or wants something pressure-checked before committing — even without the slash command. Triggers — "이거 해도 되나?", "머지해도 될까?", "A랑 B 중 뭐가 낫지?", "이 보고서/기획안 검토해줘", "임원회의 가져가도 되나?", "should we ship/migrate/hire?", "review this deck/plan". Handles repo decisions (PR, design doc, architecture) and non-code ones (market entry, hiring, vendor, pricing, a PPT/report). Targets may be named in plain prose (PR, issue, file, branch, document — office files extracted per clarify §Document Extraction); no syntax needed. NOT for trivial reversible choices or pure execution tasks. Output is one practical bearing, not a multi-agent report. Invoked as `/argus:sail`.
argument-hint: "[your decision — may mention a PR, issue, file, branch, or document]"
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

The default entry point. The argument is plain prose — quotes are optional
(`/argus:sail PR 12 머지해도 되나` works as-is), and when the text names a PR,
issue, file, branch, or document, clarify detects and reads that artifact
(see clarify §Inputs); the user never needs reference syntax. Claude may also
invoke this skill WITHOUT the slash command when the user's plain request
matches the description triggers — treat that invocation identically:

- `/argus:sail "<problem description>"`
- `/argus:sail "PR 12 머지해도 되나?"` (prose target — clarify expands it)
- `/argus:sail "docs/strategy.md 방향이 맞나?"`
- `/argus:sail @PR#123` / `@<file>` (explicit override when prose is ambiguous)
- `/argus:sail` (no args — autodetect from git state)
- `/argus:sail --full "<problem>"`
- `/argus:sail --quick "<problem>"`
- `/argus:sail --no-boss "<problem>"`
- `/argus:sail --resume <session-id>`

---

## Path Resolution

When this skill (or any sub-skill it invokes) refers to
`${CLAUDE_PLUGIN_ROOT}/data/...` or `${CLAUDE_PLUGIN_ROOT}/lib/...`, resolve in
this order — **first hit wins** (this is the canonical order; every Argus skill
defers here):

1. **Plugin install (the documented path):** `${CLAUDE_PLUGIN_ROOT}/data/` and
   `${CLAUDE_PLUGIN_ROOT}/lib/` — Claude Code sets `${CLAUDE_PLUGIN_ROOT}` to the
   plugin's install directory when Argus is installed via the marketplace. All
   bundled files ship with the plugin; no extra install step is needed.
2. **Copy install (legacy `install.sh`):** `~/.claude/argus-data/` and
   `~/.claude/argus-lib/` (note: session docs live under `argus-lib/session/` —
   `install.sh` preserves the subdir; do NOT look for them flat).
3. **Developer mode (working inside the Argus repo):**
   `<repo>/argus-plugin-v2/data/` and `<repo>/argus-plugin-v2/lib/`.

Directory contents: `data/` = schemas, agents.yaml, boss-types.yaml,
classification.yaml, prompts/; `lib/` = locale-conventions.md,
config.example.yaml, rehearsal-prompt.md, session/ (session-layout.md,
version-numbering.md).

If ALL three locations are absent, stop with one line in the user's locale —
ko: `Argus 데이터 파일을 찾을 수 없어요 — 플러그인을 재설치해 주세요
(/plugin install argus@argus).` · en: `Argus data files not found — reinstall
the plugin (/plugin install argus@argus).` Never improvise schemas from memory.

Session artifacts live in:

- `<cwd>/.argus/sessions/`

---

## Step 0 - Load Config

**Zero-droppings rule for auto-invocation.** When sail was triggered from a
plain natural-language request (no explicit `/argus:sail`), do NOT create
`.argus/` or any file yet. Hold all writes in memory through clarify's initial
analysis; create `.argus/` only once the decision is confirmed non-trivial
(`decision_density` medium/high, or the user engages with a question). If the
density turns out low, answer with the minimal card inline and write
NOTHING — a mistaken auto-trigger must leave the user's repo byte-identical.
Explicit `/argus:sail` invocations create files as written below.

Read `.argus/config.yaml`.

**If missing, silently create from `${CLAUDE_PLUGIN_ROOT}/lib/config.example.yaml`** (resolve per §Path Resolution; no AskUserQuestion — first-run friction was the discoverability killer). First ensure the target dir exists: `mkdir -p .argus` (on a true first run in a fresh repo `.argus/` does not exist yet, so writing the config straight away would fail).

**Privacy default — write `.argus/.gitignore` on first create** (unless it already exists) so sessions stay local by default:
```
# Argus: decision sessions can contain code diffs + business context.
# Remove this line (and set archive.commit_sessions: true) to share with your team.
sessions/
# The ledger holds your personal predictions and settled outcomes verbatim.
ledger/
errors.log
```
If `config.archive.commit_sessions == true`, omit the `sessions/` line so the user's opt-in to team sharing is honored. The `ledger/` line stays even then — the calibration record is personal by default; the user can delete the line by hand to share it.

If `.argus/.gitignore` already exists but lacks the `ledger/` line (it predates the settlement loop), append the two ledger lines above — do not touch the rest of the file.

**Substitute the detected locale into the written config — do not leave the template's `locale: ko`.** The template defaults to Korean; if you write it verbatim, every downstream output is Korean regardless of the user. After detecting locale (below):
- Set `locale:` in the written config to the detected value.
- If detected locale is `en`, also replace the Korean boss persona with English defaults: `name: "Manager"`, `gender: male`, `role: "Manager"` (keep `mbti_code: ISTJ`). If `ko`, keep the template's `박 팀장`.

Print ONE line in the detected locale:
- ko: "ℹ `.argus/config.yaml` 자동 생성 (ISTJ 박 팀장 기본). 다른 boss 원하면 그 파일 편집."
- en: "ℹ `.argus/config.yaml` auto-created (ISTJ default boss). Edit it if you want a different stakeholder."

Locale detection when no config exists yet (first match wins):
- If `LANG` / `LC_ALL` env starts with `ko` → ko
- On Windows (no `LANG`): if `Get-Culture` / system UI culture is Korean (`ko-*`) → ko
- Else if the user's `problem_text` is predominantly Korean (Hangul) → ko
- Else → en

(This default — en when nothing indicates Korean — is the one the rest of the plugin assumes; keep `lib/locale-conventions.md` consistent with it.)

All downstream skills inherit `locale` from the (now-existing) config.

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

**`conversing` tiebreaker (two rows below would both match):** read `versions/{label}/analysis.json`. If `execution_plan.steps.length >= 2` → treat as "ready" (route to team). Otherwise → "not ready" (route to clarify --continue). Decide by the execution_plan, never guess.

| Current phase | Next skill |
|---|---|
| new / no session | `/argus:clarify` |
| `analyzing` or `conversing` (execution_plan < 2 steps) | `/argus:clarify --continue` |
| `conversing` (execution_plan ready, ≥ 2 steps) | `/argus:team` |
| `team_deploying` (verify routed `revise_team`) | `/argus:team --revise` — re-run team with `verification.json` challenged_claims fed into the worker prompts |
| interrupted mid-team (`team_plan.json` exists, no `workers.json`) | `/argus:team` — the prior run died before workers finished; re-run is safe (team reuses the same version dir) |
| `verifying` or team complete with no `verification.json` | `/argus:verify` |
| `dm_feedback` pending | `/argus:boss` |
| `refining` | `/argus:revise` (apply boss concerns / verify challenges → child draft + re-verify) |
| `complete` | show Current Bearing/chart via `/argus:chart`; `/argus:revise` to iterate or `--promote` to finalize |

---

## Step 4 - Full Pipeline

For `--full`, run sequentially:

1. `/argus:clarify --no-minimal --invoked-via-sail` (until ready for mix, or max rounds). `--no-minimal` suppresses Step 6a auto-collapse (`--full` is an explicit user override); `--invoked-via-sail` makes clarify suppress its own scaffold print + "run /argus:team" hint and emit a one-line ack only — sail Step 7 renders the consolidated card. Without it, clarify double-renders under sail.
2. `/argus:team --invoked-via-sail` (on the snapshot's execution_plan). The `--invoked-via-sail` flag tells team to suppress its own verbose Step 11 print block; sail's Step 7 will render the consolidated card.
3. `/argus:verify --invoked-via-sail` (on the team output). This is the core gate: supported/challenged/human-check claims become visible before any stakeholder review.
4. `/argus:boss --invoked-via-sail` (unless `--no-boss` OR verify's `routing_decision` is `revise_team` / `stop_for_human_check` / **`ask_user`**). `ask_user` means verify could not resolve the route (e.g. a `critical` challenged claim under `--no-prompt`); boss must NOT run on an unresolved critical challenge. Same flag otherwise — suppresses boss's verbose narration; sail Step 7 surfaces the bearing only.
5. Step 7 Current Bearing (see below).

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

Run `/argus:clarify --invoked-via-sail` first, then branch. The flag makes
clarify suppress its medium/high scaffold print (Step 5b) and emit a one-line ack
so sail Step 7 owns the surface — a low-density run still prints its MinimalScaffold
(clarify Step 5a is the terminal deliverable there and ignores the flag).

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

After the user answers, persist the user-confirmed stakes to
`session.classification.stakes`, set `stakes_user_confirmed = true`, and set
`stakes_confidence = 100` (the user just confirmed it — it is no longer
uncertain). Without this reset, Step 6c sees confidence still `< 75` and stalls
with no action. Then continue to Step 6c with the locked stakes.

### Step 6c - Medium/High

When confidence is high enough, do not ask how to proceed. The user invoked
Argus to get orientation inside the decision, not to manage a workflow.

Print one line (include a rough time preview so a quick question never silently
becomes a multi-minute run — `~4-8 min` for important, `~8-12 min` for critical;
honest numbers from a measured run, not aspirations — and print it BEFORE any
probe/extraction work begins, not after the user has already waited):

- en: "Checking evidence and weak claims, then returning the current bearing (~{{time_range}}). (Ctrl-C to halt)"
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

**Coverage-gap guard:** read `workers.json` and count any `status: "error"` /
`verification_failed` entries. If any worker failed, the bearing MUST open with a
visible warning (ko: `⚠ 워커 {{M}}/{{N}} 실패 — 일부 도메인 분석 누락` · en:
`⚠ {{M}}/{{N}} workers failed — some domain analysis is missing`). Never present
a bearing assembled from survivors as if coverage were complete.

Read:

- `analysis.json`
- `scaffold.json`
- `verification.json`
- `workers.json` (for the coverage-gap guard above)
- optional `boss_feedback.json`
- optional `mix.json`

Write:

- `versions/{label}/current_bearing.json`, conforming to
  `${CLAUDE_PLUGIN_ROOT}/data/schemas/current-bearing.json` (include the required
  `generated_at` ISO-8601 timestamp — a bearing without it fails schema validation)
- `session.json`: set `phase: "complete"` after the bearing is rendered. Boss
  leaves the phase at `refining` and nothing else ever closes it — without
  this line no session in the default flow EVER reaches `complete`, and a
  later `--resume` misroutes a finished voyage into `/argus:revise`.

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
  anchor. Use `null` for early framing or missing evidence. When present it has
  FOUR required parts (all four, per the schema — a seed without pass/fail
  conditions cannot be graded later):
  - `predicate`: the future claim ("if X, then Y").
  - `check_by`: when reality gets consulted (date or event + offset).
  - `pass_condition`: the observable that confirms the predicate (≤180 chars).
  - `fail_condition`: the observable that falsifies it (≤180 chars). If you
    cannot name one, the seed is not falsifiable — write `null` instead.
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

**First-voyage hint:** if this is the project's FIRST session (exactly one
directory under `.argus/sessions/`), append one line after the bearing —
ko: `첫 항해가 기록됐어요. /argus:chart 로 언제든 돌아올 수 있고, /argus:help 가 지도예요.`
en: `Your first voyage is logged. /argus:chart returns here anytime; /argus:help shows the map.`
Never print it again after the first session.

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

**Verification routing override:** If `verification.routing_decision` is
`revise_team` or `stop_for_human_check`, Step 7 still renders the bearing but
MUST set the course to `revise` / `collect_evidence` and not imply completion.
Append a resume next-line:
- ko: `다음: {{routing_decision == "revise_team" ? "/argus:sail --resume " + session.id + " (팀이 반박 항목을 반영해 재작업 후 재검증)" : "사람 확인 항목을 처리한 뒤 /argus:sail --resume " + session.id}}`
- en: `Next: {{routing_decision == "revise_team" ? "/argus:sail --resume " + session.id + " (team reworks the challenged claims, then re-verifies)" : "complete human checks, then /argus:sail --resume " + session.id}}`

(On `revise_team`, verify has set `phase = team_deploying`; resuming routes to
`/argus:team --revise`, which re-runs the team with `verification.json`'s
challenged_claims injected — see Step 3.)

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

- **No args + no git state**: ask for the decision question via AskUserQuestion.
- **Session exists mid-phase**: resume by default; offer restart only if user asks.
- **Sub-skill fails**: log to `.argus/sessions/{id}/errors.log` (the canonical
  per-session log — keep this consistent across sail, team, and
  session-layout.md; gitignore `.argus/sessions/*/errors.log`), show the
  shortest actionable failure, and stop.

---

## Forbidden Patterns

- Running team before clarify.
- Skipping verify on medium/high paths.
- Printing worker/ledger/boss internals in the default bearing.
- Asking "how should we proceed?" when confidence is high.
- Letting sub-skills print their full reports when `--invoked-via-sail` is set.
- Calling the final output SurfaceCard.
