---
name: team
description: Deploy a team of specialized agents as WORKERS on a clarified problem (the crew sets out from port). Each agent does their domain work — research, numbers, UX, legal, risk, etc. — in their own voice on the actual artifact (code, PR, file, design doc). Agents are not a panel of generic critics; they're producers whose claims will be verified by `/argus:verify`. Output is a MixResult plus a candidate FinalScaffold with attribution preserved. Invoke after `/argus:clarify` has produced an AnalysisSnapshot with an `execution_plan`. Invoked as `/argus:team`.
---

# /argus:team

**What this skill does:** Takes a clarified problem + execution plan, classifies it, selects the right 2–4 agents, deploys them in parallel as WORKERS (not a review panel), and aggregates their work into a candidate scaffold.

**Why this matters (M9 — Workers not critics):** The legacy 4R plugin had agents as "persona reviewers." This skill rejects that model. Agents here PRODUCE artifacts — research notes, ROI tables, UX checks, compliance checklists. Verification is a separate downstream quality gate (`/argus:verify`), and stakeholder/personality review is a later optional layer (`/argus:boss`).

**Why this matters (M3 — Contradiction preservation):** For `stakes: critical` problems, this skill runs a two-stage pipeline with an explicit debate step. Agent disagreements are stored in `team_contradictions[]`, not aggregated away. `/argus:verify` later classifies those tensions as supported, challenged, or still unresolved.

---

## When to run

Invoke after:
- `/argus:clarify` has written `versions/v{X}/analysis.json` with `execution_plan.steps` ≥ 2
- User explicitly runs `/argus:team` with a prior session in conversing phase

Refuse to run when:
- No session exists → direct user to `/argus:clarify` first
- Latest snapshot lacks `execution_plan` → direct user to run another round of clarify
- Unless `--force` flag is passed (prints warning)

---

## Inputs

- **Session ID** (optional): from `--session <id>`. Defaults to most recently modified session in `.argus/sessions/`.
- **Force flag** (optional): `--force` skips the analysis_readiness check.
- **Revise flag** (optional): `--revise` — this run is a feedback-driven repair (from `/argus:revise`, or verify's `routing_decision: "revise_team"`). Read the revision items and inject them into the owning workers; without this a "revision" is just an identical re-roll that never sees the feedback.
  - **Primary source:** `.argus/sessions/{id}/pending_revision.json` (written by `/argus:revise`) — it aggregates the selected boss concerns AND verify challenges as `items[]`, each with `text`, `suggested_fix`, `owner_agent_id`, `severity`, plus a `directive_text`. For each item, inject into its `owner_agent_id` worker: "Your prior output was challenged on «text»; suggested fix: «suggested_fix» — produce a revised analysis that addresses it." Workers with no targeted item carry their prior output forward where possible.
    - **Unmatched owner (defensive).** If an item's `owner_agent_id` matches no worker in this revision's plan (the prior worker isn't being re-run, or the id is stale), do NOT silently drop it: inject it into the `navigator` synthesis pass instead, and if there is no synthesis pass either, append it to the scaffold's `human_required_checkpoints[]` with `reason: "revision_item_unrouted"`. A revision item must always land somewhere a human can see.
  - **Fallback** (no pending_revision.json): read the latest `versions/{parent_label}/verification.json` and inject its `challenged_claims[]` the same way.
  - Compute a new **child** version label (Step 1.4 branches from `session.active_draft_id`). Append the child Draft with `directive = directive_text`, `reviewing_agent_id = "navigator"`. **Delete `pending_revision.json`** when done (it's a consumed hand-off).
  - **Bound the loop here — this is the single chokepoint both revise paths cross** (`/argus:revise` and sail's `revise_team` → `team --revise`). At the START of a `--revise` run, before reworking: read `session.revise_cycles` (default 0) and `session.max_revise_cycles` (default 3). If `revise_cycles >= max_revise_cycles`, do **NOT** rework — write the still-open challenges from the parent's `verification.json.challenged_claims[]` to the scaffold's `human_required_checkpoints[]` with `reason: "max_revisions_reached"`, leave `session.active_draft_id` on the parent, and stop with a one-line "수정 한도(N)에 도달 — 사람 확인이 필요합니다 / revise cap (N) reached — needs a human check." Otherwise increment `session.revise_cycles += 1` and proceed. This caps the loop even when sail routes `revise_team` directly and bypasses the revise skill.
- **Override agents** (optional): `--agents sujin,donghyuk,jieun` — bypass automatic selection. Use sparingly; classification is usually better.
- **Sail-invocation flag** (optional): `--invoked-via-sail` — suppress Step 11 verbose print block. JSON files are still written; sail's Step 7 will compose the consolidated decision card from them. Use this to avoid double-rendering when sail orchestrates the chain.

---

## Execution steps

### Step 0 — Preflight: agents.yaml readable (L3.2)

Before anything else, verify `${CLAUDE_PLUGIN_ROOT}/data/agents.yaml` exists, is
readable, and contains the `capabilities:` key (resolve the path per sail §Path
Resolution: plugin install dir first, then the legacy copy-install dir, then
repo-local `argus-plugin-v2/data/`). If not found anywhere: stop and print
exactly one line in the user's locale — ko: `agents.yaml이 없거나 손상됐어요 —
플러그인을 재설치해 주세요 (/plugin install argus@argus).` · en: `agents.yaml is
missing or corrupt — reinstall the plugin (/plugin install argus@argus).` Do not
improvise a crew without it.

### Step 1 — Load session state

1. Find session: latest `.argus/sessions/*/session.json` or specified via `--session`.
2. Read the latest snapshot from `versions/{label}/analysis.json` (authoritative; session.json no longer stores snapshots).
3. Assert `execution_plan.steps` has ≥ 2 entries. If not, halt with direction to run more clarify rounds.
4. Compute next version label using rules from `${CLAUDE_PLUGIN_ROOT}/lib/session/version-numbering.md`:
   - v0.1 directory exists already (created by `/argus:clarify`).
   - **Marker-file detection for re-run**: a version is considered "team-completed" when `versions/{label}/workers.json` exists. If the latest version's `workers.json` exists, this invocation is a re-run → compute the next label via `nextChildLabel(parent_label, existing_siblings_under_same_parent)` from version-numbering.md.
   - **Branch from the checked-out draft, not the newest.** `parent_label` is the `version_label` of `session.active_draft_id` (set by `/argus:chart --checkout` or the last run), NOT simply the newest label on disk. On a `--revise` or post-checkout run this is what makes the new draft a proper child/branch (e.g. revising `v0.1` while `v0.2` exists yields `v0.1.1`, not a `v0.3` main-line). Only when `active_draft_id` is unset/points to the latest does this reduce to "main-line continuation" (`v0.2`).
   - If `workers.json` does NOT exist in the latest version dir, this is the first team run for that version → use the existing label (do NOT create a new version dir). The team populates the same dir clarify already opened.
5. Create `versions/{label}/` directory only if a new version was computed; otherwise reuse existing.
6. Read locale from `.argus/config.yaml` (default `ko`). All user-facing text in this skill (AskUserQuestion options, report strings, worker instructions) uses this locale.

### Step 1.5 — Gather repo context (CRITICAL for M1 code-native)

**Purpose:** Workers need real artifacts to work on, not prose. This step assembles the codebase/target context ONCE so stage-1 workers can act code-native.

**Three paths:**

**(A) Explicit target** — `session.invoking_context.target_type` in `{pr, file, branch, issue, design_doc}`:
- **Primary source:** read `versions/v0.1/meta.json` → `target_context` (written by `/argus:clarify` when it expanded the target — see clarify Inputs). This is the single source of truth for the diff/contents/body the team must work ON. Use `target_context.diff` / `.contents` / `.body` / `.files_changed` directly.
- **If `target_context` is absent or has an `error` field** (clarify ran before this field existed, or `gh` failed): re-fetch live as a fallback —
  - `pr` → `gh pr view <N> --json title,body,files,state` + `gh pr diff <N>`
  - `file` → re-read the file contents + `git log -5 <file>`
  - `branch` → `git diff main...<branch>` + `git log main..<branch>`
  - `issue` → `gh issue view <N>`
  - If the live fetch also fails, fall to path (C) hypothetical mode and say so — never silently analyze nothing while claiming a target.
- **Never** proceed in explicit-target mode with empty target content; that is the silent M1 failure (workers analyze the repo generically instead of the actual changeset).

**(B) Bare prose invocation** (`target_type: ad_hoc`, the most common case):
- Sample repo structure: run `git ls-files` and take the first ~100 entries. **Cross-platform:** on Unix `git ls-files | head -100`; on Windows PowerShell `git ls-files | Select-Object -First 100`. Do NOT pipe to `head` on Windows — it errors, leaves the sketch empty, and silently drops you into hypothetical mode (workers then fabricate instead of citing real files). Same rule wherever `head`/`tail`/`rm` appear: pick the shell-appropriate form, never assume Unix.
- Read `package.json` (or `Cargo.toml` / `pyproject.toml` / `go.mod`) for stack hints.
- Read `README.md` first 50 lines if present.
- Run `git log -10 --oneline` for recent activity.
- Assemble a **repo_sketch** block: `{languages, frameworks, recent_commits, directory_tree_sample}`.
- Workers receive this sketch and can Grep/Glob for specific files as they work.

**(C) Document / strategy mode** (a first-class path, NOT an error — many decisions are not about code: market entry, hiring, vendor choice, career, pricing). Two entry conditions: no git repo at all, **or** the target is a document (`target_context.kind == "document"` / `"pasted"`) even when a git repo happens to exist — a deck reviewed inside a code repo is still a document decision; do not force path (A)/(B) repo framing onto it:
- Skip repo gathering. Set `repo_context.mode = "document"`.
- If `meta.json.target_context` exists (the user named a document in prose or via `@doc:<path>` in clarify, or pasted context), pass that artifact to workers as the thing they reason ON — same role the diff plays in code mode.
- Otherwise workers reason from the problem text + their domain expertise. This is legitimate, not degraded.
- Do NOT print a "you're using it wrong / run from a repo" warning. Only suggest a repo when the question is clearly code-related yet no repo was found (e.g. it mentions files/PRs/functions). For a market-entry or hiring question, a repo is irrelevant — saying "run from a project repo" is the #1 abandonment trigger for non-code users.
- Workers must NOT force code framing: a strategy question gets strategy structure, not "IF the code looks like X". See the worker prompt's document-mode block.

**Write** the gathered context to `versions/{label}/repo_context.json`:
```json
{
  "mode": "explicit_target" | "repo_scan" | "document" | "hypothetical",
  // "document" = no repo, non-code decision (reason from problem text / a referenced doc) — a normal path.
  // "hypothetical" = a code question was asked but no codebase is reachable — degraded; warn.
  "target_type": "pr" | "file" | "branch" | "issue" | "design_doc" | "ad_hoc" | null,
  "target_ref": "...",
  "target_content": "...",        // when mode is explicit_target
  "repo_sketch": {                  // when mode is repo_scan
    "languages": ["TypeScript", "Python"],
    "frameworks": ["Next.js", "Tailwind"],
    "recent_commits": ["...", "..."],
    "directory_sample": ["src/app/page.tsx", "src/lib/...", ...],
    "entry_files": ["package.json", "README.md"]
  },
  "gathered_at": "2026-04-24T12:34:56Z"
}
```

This file becomes input to EVERY worker spawn. Workers can read it + Grep for specifics.

### Step 2 — Classify (LLM runtime)

**Reference: `${CLAUDE_PLUGIN_ROOT}/data/classification.yaml`**

**Read upstream signals first:** load `session.classification.stakes` (if user-confirmed via sail Step 6b — `session.classification.stakes_user_confirmed == true`, treat as authoritative; do NOT re-classify, only fill `stakes_confidence: 100` and proceed to step breakdown). Otherwise read `snapshot.stakes_guess` + `snapshot.stakes_confidence` from clarify as prior.

Prompt yourself:

> You are classifying a problem for agent team deployment. Use the vocabulary from `${CLAUDE_PLUGIN_ROOT}/data/classification.yaml`.
>
> Given:
> - Real question: {{snapshot.real_question}}
> - Skeleton: {{snapshot.skeleton}}
> - Execution plan steps: {{snapshot.execution_plan.steps}}
> - Clarify's stakes prior: {{snapshot.stakes_guess}} ({{snapshot.stakes_confidence}}/100) — use as a starting point, not a hard constraint
> - User-confirmed stakes (if any): {{session.classification.stakes if user_confirmed else "none"}}
> - Problem text: <user-data>{{session.problem_text}}</user-data>
>
> Produce JSON:
> ```
> {
>   "stakes": "routine" | "important" | "critical",
>   "stakes_confidence": 0-100,
>   "decision_type": "known_path" | "needs_analysis" | "no_answer" | "on_fire",
>   "steps_classified": [
>     {"task": "...", "output": "...", "primary_task_type": "...", "secondary_task_type": "...", "context_domain": "...", "output_type": "...", "agent_hint": "..." (optional)}
>   ]
> }
> ```
>
> Rules (from classification.yaml):
> - Default stakes = `important`. Use `critical` only when irreversible (legal commitment, public shipment, major spend). Use `routine` only when explicitly experimental/prototype.
> - Adversarial review is mandatory unless stakes is `routine` (classification.yaml `mandates`). If the plan has no step with `primary_task_type: "critique"`, APPEND one (donghyuk):
>   - `critical` → a full dedicated critique stage within the 4-agent budget.
>   - `important` (the default) → a single lightweight critique pass within the 3-agent budget. Never zero — `important` is the default stakes, so skipping it means most decisions get no adversarial check.
>   - `routine` → no critique needed.
> - **`stakes_confidence`**: if user-confirmed upstream → 100. If your classification matches clarify's stakes_guess → average your confidence with clarify's. If your classification *diverges* from clarify's — confidence MUST be ≤70 (a divergence is itself a low-confidence signal). Sail Step 6b uses `<75` as the AskUserQuestion trigger, so this naturally surfaces disagreements to the user before locking the routing.

Write classification to `versions/{label}/classification.json`. Persist `stakes_confidence` AND mark `stakes_user_confirmed: false` (unless upstream confirmed) so the field is explicit.

### Step 3 — Select agents (LLM + capabilities)

**Reference: `${CLAUDE_PLUGIN_ROOT}/data/agents.yaml`** — each agent has `capabilities: {task_types, domains, output_types, anti_patterns}`.

For each step, compute best agent by:

1. **Score** (scoring formula from agent-capabilities.ts, ported):
   ```
   score = rank_score(step.primary_task_type, agent.task_types) * 0.5
         + rank_score(step.context_domain, agent.domains) * 0.3
         + rank_score(step.output_type, agent.output_types) * 0.2
         - (0.4 if step.primary_task_type in agent.anti_patterns else 0)
   ```
   where `rank_score(item, ranked_list)` = 1.0 for position 0, 0.8 for 1, 0.6 for 2, 0.45 for 3, 0.3 for 4, 0.2 for 5, 0.05 if not in list.

2. **Constraint**: no agent assigned to more than one step in the same session (unless forced).

3. **Critical stakes mandate**: donghyuk MUST be assigned to the critique step. If donghyuk scores below another agent for that step, still choose donghyuk.

4. **Stakes budget**: limit total agents to `stakes.agent_count_max` (routine: 2, important: 3, critical: 4).

### Step 3.5 — Reconcile steps vs budget (when `steps.length > agent_count_max`)

Apply (a), then (b), then (c) in order. Each step may resolve the overage partially — continue to the next step while `steps.length > agent_count_max` still holds. Stop as soon as budget is met, or fall to (d) if none suffices.

**(a) Stakes auto-upgrade when critique is present.** If at least one step has `primary_task_type == "critique"` AND current stakes is `routine` or `important`, upgrade stakes by one level (`routine → important` or `important → critical`). Recompute `agent_count_max` (important=3, critical=4). Log upgrade in `classification.json` with `stakes_upgrade_reason: "critique_step_present"`.
- Applies regardless of over-count magnitude. Rationale: a critique step in the execution plan is a strong signal the problem merits fuller team deployment; don't gate on "exactly +1 over budget."
- **Only a critique step that came from the PLAN counts.** A critique/critic
  step that Step 2's own mandate appended (or that exists only because a step
  was loosely classified as critique when it's really analysis/research) must
  not trigger the upgrade — otherwise every important-stakes 3-step plan
  self-escalates to critical (mandate adds critic → budget overflows → (a)
  fires), nearly doubling cost on a classification coin-flip. When in doubt
  whether a step is genuinely critique, it isn't.
- If still over budget after (a), continue to (b).

**(b) Merge adjacent same-type steps.** Scan steps for pairs with identical `primary_task_type` AND similar `context_domain` (same or adjacent in classification.yaml). Merge iteratively: concatenate `task` strings with " + ", union `expected_output`, keep the agent with higher score if both had hints. Each merged step gets one agent. Log merges to `classification.json:merges[]`.
- Example: two research steps on same domain → one sujin handles both, task becomes "research X + research Y".
- If still over budget after merges exhausted, continue to (c).

**(c) Drop lowest-scoring steps iteratively.** While `steps.length > agent_count_max`: compute best-match agent score for every remaining step, drop the ONE with lowest score. Preserve each dropped step in `classification.json:dropped_steps[]` with its reason and best-agent score. Repeat until budget matches.
- **Mandatory surfacing**: every dropped step MUST be represented in the final `scaffold.human_required_checkpoints[]` with `checkpoint: "<original task>", why: "dropped from automated pipeline — over_agent_budget"`. This preserves transparency (M4) and gives the user a path to manually cover the dropped area.

**(d) Forbidden fallback**: one agent assigned to two un-merged steps. Do NOT do this silently. If (a)–(c) all failed (e.g., stakes already critical AND no mergeable pairs AND budget still exceeded), halt with error message explaining the conflict and suggesting the user increase `team.max_agents_override` in config.yaml or split the execution_plan into two `/argus:team` invocations.

After reconciliation, `steps.length ≤ agent_count_max` is guaranteed.

### Step 3.6 — Framework assignment per agent

Look up `agents.yaml[agent_id].frameworks[classification.decision_type]` (fallback to `frameworks.default`). Pick the first framework in that list.

Produce `versions/{label}/team_plan.json`:
```json
{
  "stages": [
    {
      "id": "stage-1",
      "label": "Domain work",
      "worker_ids": ["w-1", "w-2", "w-3"],
      "depends_on_stage_id": null
    },
    {
      "id": "stage-2",
      "label": "Critical review",
      "worker_ids": ["w-4"],
      "depends_on_stage_id": "stage-1"
    }
  ],
  "workers": [
    {"id": "w-1", "agent_id": "sujin", "framework": "Analysis of Competing Hypotheses", "task": "...", "expected_output": "...", "task_type": "research", "context_domain": "tech", "output_type": "report"}
  ]
}
```

**Role of team_plan.json — internal orchestration + forensic.**
- **Step 4–6 read it** to know which agent runs in which stage with which framework. It IS the working plan.
- **Kept post-execution** so `/argus:chart` (or any future debugger) can answer "why did *this* team get deployed for this decision?" If a deployment looked weird, the assignment scoring + reconciliation results that produced it are inspectable here.
- **Not consumed by sail Step 7** — the final decision card draws from `scaffold.json` + `boss_feedback.json`. team_plan is intentionally *upstream* of the user-facing artifact: it's how the team was planned, not what the team produced.

Stage rules:
- `stakes: routine` → single stage (all workers parallel; no critique).
- `stakes: important` → stage-1 = domain workers in parallel; stage-2 = the single lightweight critique worker (donghyuk), depends on stage-1. A bounded second stage, not a full debate. (This is the change that makes the default-stakes path actually adversarial.)
- `stakes: critical` → two stages: stage-1 = all non-critique workers; stage-2 = critique worker(s) + debate, depends on stage-1 results.
- General rule: **any plan containing a `critique` step runs that step in stage-2** (it needs stage-1 results as input), regardless of stakes label.

### Step 3.7 — Run-cost accountability (before spawning)

Fan-out runs on the **user's own metered plan**, and parallel subagents are billed
at a premium (Anthropic moved parallel subagent usage to a separately-metered pool
in 2026-06). Spawning a large agent tree with no cost signal makes a serious user
feel reckless. So, before Step 4 spawns:

1. **Pre-spawn budget line.** State it first: `Deploying ~{N} agents in parallel
   (stage-1 {a}, stage-2 {b}) on your plan.` where N is the planned worker count.
   This is one line, not ceremony — restraint made legible.
2. **`--lean` flag.** If invoked with `--lean` (or `team.lean: true` in config), cap
   fan-out: stage-1 width ≤ 2, skip stage-2 unless stakes are `critical`, and cap
   revise iterations at 1. Lean is the explainable economical default for routine
   stakes; say `(lean mode — capped fan-out)` so the user knows what was traded.
3. **Model routing.** Run planning/synthesis (navigator) on the strong tier and the
   domain/critique workers on the fast/default tier — workers are ~85% of the calls
   and the cheaper tier covers them at a fraction of the cost. Never route every
   worker to the strongest model "to be safe."

### Step 4 — Deploy stage 1 workers in parallel

For each worker in stage-1, use the **Task / Agent tool** to spawn a sub-agent.

> **Dispatch mechanism — read this.** The Agent/Task tool's `subagent_type` only accepts built-in types (`general-purpose`, `Explore`, `Plan`, …); it does **NOT** bind a custom agent by bare id like `subagent_type: "sujin"` (that silently runs a generic model while still printing the worker's name — the persona collapses invisibly). So:
> - **subagent_type**: `general-purpose`.
> - **Persona injection (this is what makes the worker actually be `sujin`):** read the agent's definition — `${CLAUDE_PLUGIN_ROOT}/agents/<agentId>.md` if present (plugin install; for copy installs try `~/.claude/agents/<agentId>.md`), else the agent's entry in `${CLAUDE_PLUGIN_ROOT}/data/agents.yaml` (`voice_markers`, `worker_mode_examples`, capabilities) — and **inline its system-prompt content + voice examples at the top of the worker prompt below.** The worker's voice/expertise comes from this injected text, not from `subagent_type`.
> - If a future Claude Code version supports custom-agent dispatch (e.g. plugin-scoped `subagent_type: "argus:sujin"` when installed as a plugin), you may switch to that — but inline injection is the mechanism that works today and must remain the fallback.

- **description**: short (e.g., "research 3 competitors")
- **prompt**: constructed as (locale-aware), led by the injected persona block, then:

  ```
  You are {{agent.name}} ({{agent.name_en}} if locale=en) working as a team worker on this problem.
  
  <user-data context="problem">
  Real question: {{snapshot.real_question}}
  Your task: {{worker.task}}
  Expected output shape: {{worker.expected_output}}
  </user-data>
  
  ── Repo context (mode: {{repo_context.mode}}) ──
  
  {{if mode == "explicit_target"}}
  You have a specific artifact to work on:
  <user-data context="artifact" type="{{target_type}}" ref="{{target_ref}}">
  {{target_content}}
  </user-data>
  
  Read this artifact directly. You may Grep/Glob the repo for additional files if needed.
  {{endif}}
  
  {{if mode == "repo_scan"}}
  No specific artifact was provided. This is a repo-wide question. Repo sketch:
  - Languages: {{repo_sketch.languages_joined}}
  - Frameworks: {{repo_sketch.frameworks_joined}}
  - Recent commits: {{repo_sketch.recent_commits_first_5}}
  - Directory sample: {{repo_sketch.directory_sample_first_20}}
  - Entry files: {{repo_sketch.entry_files_joined}}
  
  You have Read/Grep/Glob tools. **Use them** to find and read the files relevant to YOUR task before producing output. Do not rely on the sketch alone — it's a starting map, not the answer. Cite specific file paths + line numbers in your output when relevant.
  {{endif}}
  
  {{if mode == "document"}}
  This is a non-code decision (strategy, hiring, vendor, pricing, market, career, etc.). {{if target_content}}Work ON this referenced document:
  <user-data context="document" ref="{{target_ref}}">
  {{target_content}}
  </user-data>{{else}}Reason from the problem statement and your domain expertise.{{endif}}
  Structure your output for THIS domain — do NOT use code analogies or "IF the code looks like X". Apply your real-world expertise (numbers, risk, people, market, legal — whatever your role is) in plain domain language. No `[hypothetical]` prefix; this is a legitimate decision, not a degraded fallback.
  {{endif}}
  
  {{if mode == "hypothetical"}}
  ⚠ HYPOTHETICAL MODE: a code-related question was asked but no codebase is reachable. Prefix your output with `[hypothetical — code not accessible]` and structure as "IF the code looks like X, THEN Y", explicit about assumptions. (This prefix is metadata for the synthesis step — Step 9 strips it from the final scaffold so it never leaks into the user's decision card.)
  {{endif}}
  
  ── Framework ──
  {{worker.framework}}
  
  ── Voice ──
  (The persona block injected above IS your voice + expertise — it was inlined from the agent's .md / agents.yaml because the tool cannot load it via subagent_type.) Produce the output in YOUR voice; the example dialogues in that block are the rhythm reference.
  
  ── Rules ──
  - Do NOT critique other workers; they run in parallel and you don't see their work.
  - Do NOT summarize the whole problem; you handle YOUR task.
  - Cite specific files/lines when working from `explicit_target` or `repo_scan`.
  - **Speak this problem's domain.** Your persona examples are software-flavored, but your expertise is general — if this is a market/hiring/finance/legal decision, use that domain's vocabulary, not code analogies. Frame risk as that domain's risk, not DB-lock time.
  - {{locale-specific concluding line: ko="~이내로 간결하게 작성하세요." en="Keep under {{word_budget}} words."}}
  
  Return a {{worker.output_type}} in ~{{word_budget}} words.
  ```
  
  Word budget by stakes:
  - routine: 150 words max
  - important: 300 words max  
  - critical: 500 words max

All stage-1 workers spawn in a **single message with multiple Task tool calls in parallel** (per Agent tool usage rules). Do NOT sequential spawn.

### Step 5 — Collect stage 1 results

Each Task returns a result. For each:
1. Append to `workers` array in `versions/{label}/workers.json` with `status: "done"`, `result: <agent output>`, timestamps.
2. If any worker errored, log to `.argus/sessions/{id}/errors.log` (the canonical per-session log — same path sail and session-layout.md use; do NOT write a separate `versions/{label}/errors.log`). Don't halt — other workers continue.

**Worker failure contract (output integrity — "never lie about completeness").** A worker that returns empty, off-shape, unparseable, or errors is a *failure to record*, never a thing to silently drop, paraphrase around, or backfill with a plausible-looking result:
- Set that worker `status: "error"` (or `"verification_failed"` if it ran but produced unusable output) and store the cause in `error`. A weak-but-present result keeps `status: "done"` but carries `verification_score` (<70 = must be surfaced as challenged, not promoted).
- Every `error` / `verification_failed` / score<70 worker MUST appear in the user-facing output — as a `fog_or_reef` item or a `scaffold.human_required_checkpoints[]` entry (`reason: "worker_failed"`). The synthesis/verify step must NOT mark `overall_status: "verified"` while any worker failed; downgrade to `mixed`/`needs_revision`.
- If ALL workers in a stage fail, do not emit a clean scaffold: surface "could not complete — N of M contributions failed, retry or narrow the scope" rather than empty defaults. An incomplete run must never render as a clean, verified result. (Guarded mechanically by `scripts/validate-gates.mjs` OUTPUT-INTEGRITY.)

### Step 6 — Deploy stage 2 negative validation worker (whenever a critique/stage-2 worker exists — i.e. `important` or `critical`)

Stage-2 workers (typically donghyuk) get **stage-1 results as context**:

```
You are {{agent.name}} doing negative validation of the team's work.
Your task: {{worker.task}}

Team results from stage 1:
{{for each stage-1 worker}}
## {{worker.agent_name}} ({{worker.task_type}}) — {{worker.task}}
{{worker.result}}
{{endfor}}

Framework: {{worker.framework}}

Your job: identify the 2-3 most important ranked risks (unsupported claims, false-positive traps, foundational evidence gaps) in the team's combined output, PLUS one risk nobody on the team named (the unspoken one). For each, give a one-line mitigation or the specific evidence that would resolve it. This matches your agent spec (2-3 + one unspoken) — do NOT collapse to a single easily-absorbed criticism. Follow M9 — you are doing the WORK of risk analysis, not "reviewing" each agent in turn.

If a risk is a foundational evidence gap (the decision's premise is unverified — e.g. "we assume X is legal/true" with no source), flag it explicitly as `foundational: true` so `/argus:verify` can route it to a human-required check rather than waving it through.

Return a risk_assessment in ~500 words.
```

Stage-2 output is still a worker result, not the final verifier. `/argus:verify` reads it as negative-validation evidence.

### Step 7 — Debate (critical stakes only)

#### Detection — when does debate trigger?

Agents often disagree across **different frames** (legal vs tech, cost vs UX) yet reach opposing conclusions on a **shared canonical decision axis**. A naive "same topic" check misses this. Use these canonical axes:

| Axis | Trigger phrases (any framing) |
|---|---|
| **ship_or_halt** | "merge / don't merge", "release / hold", "approve / block", "now / wait" |
| **scope_cut_vs_expand** | "narrower / wider", "subset first / full", "MVP / complete" |
| **build_vs_buy** | "in-house / vendor", "own / outsource" |
| **invest_vs_defer** | "fund now / wait", "increase budget / hold" |
| **rollback_vs_forward** | "revert / fix forward", "patch / replace" |
| **fast_vs_safe** | "ship today / harden first", "speed / certainty" |
| **automate_vs_manual** | "AI handles / human decides", "automated check / review gate" |

For each axis, LLM scans all stage-1 outputs and asks: **does any agent imply one side AND another agent imply the other side, even if they argue from different domain lenses?** If yes → debate.

Examples that previous spec might have missed:
- taejun (legal frame): "halt — premise is wrong" + junseo (tech frame): "conditional ship — flag covers risk" → BOTH speaking to `ship_or_halt`. **Trigger debate.**
- minjae (numbers frame): "ROI 24mo, slow" + hyunwoo (strategy frame): "moat is decisive, ship now" → BOTH speaking to `invest_vs_defer`. **Trigger debate.**
- jieun (UX frame): "users will revolt, hold rollout" + minseo (marketing frame): "launch window closes Friday, ship" → `fast_vs_safe`. **Trigger debate.**

Counter-examples (NO debate — different axes):
- taejun: "GDPR concern" + junseo: "DB lock manageable" → different axes, no opposing stance on same axis. Convergent on "issues exist," divergent only in domain. No debate.

#### Spawn

If detection triggers, identify the canonical axis + the (≥2) agents on opposite sides. Spawn debate prompt:

> Team agents {{A}}, {{B}} (and possibly more) reached opposing positions on the **{{canonical_axis}}** axis, even though they argued from different domain frames. State each agent's position in their own voice (1-2 sentences), then identify what specific information/condition would resolve the tie. **Do NOT pick a winner.** The user will resolve.

Write to `versions/{label}/debate.json`:
```json
{
  "topic": "PR #42 ship_or_halt",
  "axis": "ship_or_halt",
  "positions": [
    {"agent_id": "taejun", "frame": "legal", "stance": "Halt — premise오류 의심."},
    {"agent_id": "junseo", "frame": "tech", "stance": "Conditional ship — flag + rollback 필수."}
  ],
  "tie_breaking_condition": "원 ticket의 실제 legal 요구사항 확인되면 해소.",
  "unresolved": true
}
```

If multiple axes have opposing stances simultaneously, write multiple entries to debate.json (as an array).

### Step 8 — Synthesize (MixResult)

Prompt yourself:

> Aggregate the team's work into a MixResult (schema: `${CLAUDE_PLUGIN_ROOT}/data/schemas/mix-result.json`).
>
> Team outputs:
> {{all worker results with agent names}}
>
> {{if debate ran}}
> Unresolved contradictions (DO NOT resolve, preserve):
> {{debate.topic}} — {{positions}}
> {{endif}}
>
> Produce:
> - `title`: a tight name for the session output
> - `executive_summary`: 2-3 sentences. NOT "our team analyzed..." — WHAT the work found.
> - `sections[]`: logical grouping of team outputs. Each section MUST cite `contributor_worker_ids`. If using sentence-level attribution (recommended for critical stakes), include `sentences[]` with per-sentence `contributor_worker_ids`.
> - `key_assumptions[]`: 3-5 assumptions that, if false, would collapse the output. Pulled from agent outputs where they flagged such assumptions.
> - `next_steps[]`: concrete actions.
>
> Do NOT collapse contradictions. If section prose MUST reference a tension, phrase it as "X says A, Y says B, unresolved."
>
> Do NOT strip a load-bearing claim's **condition**. If a worker stated "X holds IF Y" / "X, assuming Z" / "X in the optimistic case", the mix MUST carry that qualifier with the claim — dropping "if adoption holds" from "ROI 24mo if adoption holds" turns a conditional into a false certainty that verify will then validate as fact. Keep the condition in the section text, or record it in `key_assumptions[]` tied to that claim. Compress wording freely; never drop a qualifier that changes whether the claim is true.

Write result to `versions/{label}/mix.json`.

### Step 9 — Build Candidate FinalScaffold (plugin-native output)

This is the PLUGIN-SPECIFIC divergence from webapp. Webapp produces a markdown document; plugin produces a decision scaffold.

Construct a candidate `FinalScaffold` (schema: `${CLAUDE_PLUGIN_ROOT}/data/schemas/final-scaffold.json`). Candidate means it is not yet trusted; `/argus:verify` owns final verification state.
- `reframed_question`: from snapshot
- `key_trade_offs[]`: extract from team outputs + debate. Each trade-off = axis + side_a + side_b.
- `hidden_assumptions[]`: from mix.key_assumptions, with `evaluation` (likely_true / uncertain / doubtful) based on team's validation
- `team_contradictions[]`: populated from debate.json if ran; else empty array
- `human_required_checkpoints[]`: extract from worker outputs where agents flagged "AI cannot decide this" or "human judgment needed". **Also append**: every entry from `classification.json:dropped_steps[]` (from Step 3.5(c)) as a checkpoint with `checkpoint: "<original task>", why: "dropped from automated pipeline — over_agent_budget. Manual coverage needed."`. This is mandatory per M4 transparency.
- `verification`: set to `{ "overall_status": "unverified", "supported_count": 0, "challenged_count": 0, "human_check_count": human_required_checkpoints.length, "routing_decision": "not_run" }`. This prevents a freshly mixed scaffold from looking final.
- `next_actions[]`: from mix.next_steps, annotated with `actor` = ai_executable or user

**Strip worker-mode artifacts.** Any `[hypothetical …]` prefix or "IF the code looks like X" scaffolding from hypothetical-mode workers is internal metadata — remove it from every scaffold field (reframed_question, trade-offs, assumptions, actions). It may remain in `workers.json` for provenance, but it must NEVER appear in the user-facing card. (A literal `[hypothetical absent code]` leaking into an action item was a real defect.)

Write to `versions/{label}/scaffold.json`.

### Step 10 — Update session.json

- Workers, stages, mix, and the scaffold are ALREADY written write-once to `versions/{label}/` (`workers.json`, `team_plan.json` stages, `mix.json`, `scaffold.json`) — do NOT also copy them into session.json. Duplicating them is exactly the monolithic-blob merge-conflict surface this model removes.
- Update `session.classification` (small routing state — kept in the skeleton)
- **Append a Draft to `session.drafts[]`** (schema: `${CLAUDE_PLUGIN_ROOT}/data/schemas/draft.json`) and set `session.active_draft_id` to it. Without this the chart version tree is permanently empty and `--checkout` / `--promote` / branching cannot work. **Concurrency (see session-layout → "the version dirs are authoritative"):** re-read `session.json` *immediately before* this write and append to the drafts[] you find *now* — never to the snapshot you loaded back in Step 1. A second `team --revise` (or another session) may have appended a sibling draft in between; appending to the stale snapshot would atomically erase it. Your `versions/{label}/` dir was created write-once under a unique label so it never collides — only this drafts[] index can lose an entry, and the re-read-then-union (dedup by `version_label`) prevents it. Shape:
  - `id`: stable draft id (e.g. `draft-{label}`)
  - `parent_draft_id`: the draft this one descends from — on a `--revise`/branch run, the draft whose `version_label` matches the checked-out `session.active_draft_id`; on the first team run, `null` (root)
  - `version_label`: the version label this run wrote (e.g. `v0.1`, `v0.2`, `v0.1.1`)
  - `directive`: on `--revise`, a short note of what was asked to change; else `null`
  - `reviewing_agent_id`: `navigator` on a `--revise` child draft; else `null`
  - `boss_reviewed`: `false` (boss hasn't run on this fresh draft yet)
  - `change_summary`: one line (≤60 chars) for the chart tree annotation (e.g. "초기 팀 배치" / "ISTJ 우려 반영")
  - `created_at`
  - (Do NOT embed the scaffold/mix/feedback in the draft node — they live in `versions/{label}/`; the draft is a pointer.)
- Set `phase: "verifying"` (ready for `/argus:verify`) OR `phase: "complete"` only when the user explicitly asked for team output without verification
- Update `updated_at`

### Step 11 — Report to user

**Branch on `--invoked-via-sail`.**

#### Step 11a — `--invoked-via-sail` set → minimal one-line ack

Sail's Step 7 will render the consolidated decision card. Team only emits a value-oriented transition line (NOT a machinery report — no agent counts, no "N contradictions preserved", no phase names; those are exactly the strings sail's forbidden-transition list bans):

```
✓ Crew work done. Checking evidence next.
{{if N_failed > 0}}⚠ Some domain coverage is incomplete — see .argus/sessions/{{id}}/errors.log{{endif}}
```

That's it. No print of contradictions/assumptions/checkpoints/counts (sail Step 7 surfaces what matters). JSON files in `versions/{label}/` are still written — sail reads them.

#### Step 11b — Direct invocation (no `--invoked-via-sail`) → full report

User typed `/argus:team` directly without going through sail. Render the full block:

```
## Argus · Team · {{label}}

**Classification:** {{stakes}} · {{decision_type}} ({{agent_count}} agents)

**Agents deployed:**
{{for each worker}}
- {{agent_emoji}} {{agent_name}} ({{framework}}) — {{one-line task}}
{{endfor}}

**Key findings** (from MixResult executive_summary):
{{executive_summary}}

{{if team_contradictions}}
**⚠ Unresolved contradictions** (preserved, not aggregated):
{{for each}}
- {{topic}}: {{agent A}} says {{stance A}}; {{agent B}} says {{stance B}}
{{endfor}}
{{endif}}

**Hidden assumptions** (if any prove false, rethink):
{{for each in scaffold.hidden_assumptions}}
- [{{evaluation}}] {{assumption}}
{{endfor}}

**Human-required checkpoints:**
{{for each}}
- {{checkpoint}} — {{why AI cannot}}
{{endfor}}

**Next step:** `/argus:verify` to split supported/challenged claims. Then `/argus:boss` if the verified scaffold should face stakeholder review.
```

---

## Meta-check gates (self-verify before returning)

- **M1 (Code-native)**: Did `repo_context.mode` match the invocation? If `mode == hypothetical` but the user provided a target (named in prose or via `@` — see clarify §Inputs), something broke. If `mode == repo_scan` but no worker cites a file path in its output, agents didn't actually use repo access — the output is de-facto hypothetical; flag it. **Do NOT flag `mode == document` as a failure** — a non-code decision with no repo is a legitimate, first-class path, not an M1 violation. M1 only governs questions that ARE about code.
- **M9 (Worker not critic)**: Did each stage-1 worker PRODUCE an artifact in their domain? If any output reads as "I reviewed X and found issues" instead of "here's the X analysis," that's critic mode — reject and re-spawn.
- **M3 (Contradiction preservation)**: **Only applies when debate ran.** If stakes is critical AND debate ran AND debate found disagreement, `scaffold.team_contradictions[]` MUST contain the debate entry. If debate ran and found no genuine disagreement, empty `team_contradictions[]` is correct and M3 passes. Do NOT fabricate contradiction to fill the array.
- **M4 (Decision scaffold)**: Does scaffold have `key_trade_offs[]`, `hidden_assumptions[]`, `human_required_checkpoints[]`, `verification`, and `next_actions[]` all present (empty arrays are valid — the fields must EXIST)?
- **M-Verify handoff**: Does scaffold.verification exist with `overall_status: "unverified"` and `routing_decision: "not_run"`? If absent, the team step is overstating certainty and the scaffold does not conform to schema.
- **M6 (Agent relationship / stakes-driven)**: Did agent count match stakes budget? If critical stakes with only 2 agents, you under-budgeted.
- **M7 (Commodity bot check)**: If the output reads as "here's a code review" or "here's a summary," you've lost the judgment-scaffold shape. Output must preserve decision structure, not be a flat review.

---

## Error modes

- **Task tool spawn fails**: retry once. If still fails, mark worker status=error, continue with other workers. Explain in final report.
- **Agent .md missing**: the persona is injected inline anyway (see Step 4 dispatch) — read it from `${CLAUDE_PLUGIN_ROOT}/data/agents.yaml` instead of `agents/<id>.md`. agents.yaml is the always-present source; the .md files are a convenience copy. Note which source was used.
- **Debate classification ambiguous**: if you can't identify 2 clearly disagreeing agents, skip debate but log "no clear disagreement surfaced" to session.json. Don't fabricate debate.
- **Word budget exceeded by an agent**: accept output, don't re-spawn. Note in attribution.

---

## Forbidden patterns

- Running `/argus:team` without prior `/argus:clarify` session.
- Spawning agents sequentially when they should be parallel (you MUST use multiple Task tool calls in a single message for stage-1 workers).
- Collapsing team_contradictions into a "consensus" bullet.
- Letting stage-1 workers critique each other. They don't see each other's work until stage 2 (critical stakes only).
- Using `devils-advocate` as a default agent. It's not in agents.yaml for a reason — critique is in-stage via donghyuk.
- Writing a "final deliverable markdown document" à la webapp. Plugin emits FinalScaffold. The mix is internal.
- Marking team output as verified. Only `/argus:verify` can do that.
