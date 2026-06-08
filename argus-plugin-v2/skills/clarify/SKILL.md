---
name: clarify
description: Sharpen a problem before deploying a team to work on it. Surfaces hidden assumptions, reframes the surface question into the real question, and produces a skeleton + execution plan. Entry point of the Argus pipeline (charting the waters before sailing). Use when the user has a problem to work through — a technical decision, a PR to review, a design choice, a fuzzy goal. Output is an AnalysisSnapshot written to `.argus/sessions/{id}/versions/v0.1/analysis.json` that `/argus:team` will consume. NEVER skip this step to save time — the analysis IS the value. Invoked as `/argus:clarify`.
---

# /argus:clarify

**What this skill does:** Takes a user problem and produces a structured understanding before any team deployment. This is Phase 0 of the Argus judgment harness: **reframe the question before answering it**.

**Why this matters (M5 — Analysis Primacy):** Every other skill in this plugin assumes the question has been sharpened. If a user invokes `/argus:team` directly on a surface question, output quality collapses. This skill IS the differentiator vs commodity "multi-agent code review" tools.

---

## When to run

Invoke automatically when:
- `/argus:sail` is called without prior session state in `.argus/sessions/`
- User passes a problem via `/argus:clarify "<problem text>"`
- User passes a target via `/argus:clarify @PR#123` / `@<file-path>` / `@<branch>`
- After `/argus:clarify --revise <session-id>` — re-clarifies with new input

Do NOT run when:
- A session with phase >= `conversing` already exists and user hasn't asked to restart
- User explicitly skips with `--skip-clarify` flag (not recommended)

**Flags clarify accepts:**
- `--no-minimal` — force Step 5b (regular scaffold) even when `decision_density == "low"`. Sail passes this when invoked with `--quick` or `--full`. Direct `/argus:clarify "<problem>"` invocations honor minimal mode automatically.
- `--continue` — Q&A deepening round on an existing session.
- `--revise <session-id>` — re-clarify with new input (post-MVP).

---

## Inputs

One of:

1. **Direct problem text** (string argument)
2. **Target reference** — expand via context collection:
   - `@PR#N` → `gh pr view N --json title,body,files,state,commits` + diff
   - `@<file>` → Read file contents + `git log -5 --oneline <file>` for recent churn
   - `@<branch>` → `git log main..<branch>` + `git diff main...<branch> --stat`
   - `@<issue-N>` → `gh issue view N`
3. **Autodetect from git state** (no args):
   - Current branch name (not `main`/`master`)
   - Last 1-3 commit messages
   - Uncommitted changes (`git diff HEAD`)
   - Open PRs authored by user
   - Report what was detected before proceeding

If multiple candidates, use **AskUserQuestion** to disambiguate: "Which of these are you working on?"

---

## Execution steps

### Step 1 — Session bootstrap

1. **Read config**: Load `.argus/config.yaml` (schema: `~/.claude/argus-data/schemas/config.json`). If clarify is invoked via `/argus:sail`, the config is already loaded and present (sail Step 0 silent-creates it). If clarify is invoked DIRECTLY by the user with no config, silent-create from `~/.claude/argus-lib/config.example.yaml` (same logic as sail Step 0) — print one line "ℹ config 자동 생성 (ISTJ 기본)" and proceed. No AskUserQuestion. All user-facing text in this skill uses `config.locale`.
2. Compute session ID: `YYYY-MM-DD-<kebab-of-first-N-words-of-problem>`. Collision-safe by appending `-2`, `-3`.
3. Create `.argus/sessions/{id}/` directory.
4. Create `session.json` at the root with schema from `~/.claude/argus-data/schemas/session.json`. Fields:
   - `id`, `problem_text`, `repo_path` (from `pwd`), `repo_branch` (from `git branch --show-current`)
   - `invoking_context`: `{target_type, target_ref}` from the input expansion
   - `boss_agent`: from `config.boss` if present
   - `phase: "analyzing"`, `round: 0`, `max_rounds: 3`
   - `created_at`, `updated_at`
5. Create `versions/v0.1/` subdirectory. This holds all artifacts for draft v0.1.

### Step 2 — Initial analysis

**Prompt the LLM (yourself) as follows:**

> You are analyzing a problem for a decision-making plugin. Your job is NOT to solve it. Your job is to reframe it so the team (invoked next) can work on the RIGHT thing.
>
> <user-data context="problem">
> {{problem_text}}
> </user-data>
>
> {{if invoking_context}}
> <user-data context="target">
> {{target expansion — PR description, file contents, etc.}}
> </user-data>
> {{endif}}
>
> Produce JSON conforming to `~/.claude/argus-data/schemas/analysis-snapshot.json`:
>
> - `real_question`: what the user is ACTUALLY deciding. Often different from surface.
> - `hidden_assumptions`: 3-5 assumptions the user is making without stating.
> - `skeleton`: 3-7 bullets of what a complete answer would contain (structural, not substantive).
> - `framing_confidence`: 0-100, your self-assessment. Low when the surface question looks like an XY problem.
> - `insight`: one-line insight that surfaced from this analysis.
> - `reversibility`: "reversible" | "partial" | "irreversible". Cheap-to-undo? UI label change = reversible. Public legal commitment = irreversible.
> - `stakes_guess`: "routine" | "important" | "critical". Vocabulary from `classification.yaml`. Default "important" if unclear.
> - `stakes_confidence`: 0-100. How sure are you about stakes_guess? <75 means downstream sail must AskUserQuestion before locking the routing.
> - `decision_density`: "low" | "medium" | "high". The cognitive weight this decision actually deserves. See rule 4 below for low-density gate. Default "medium".
> - `decision_density_reasoning`: one-sentence justification for the chosen density.
>
> Rules:
> 1. The `real_question` MUST NOT be "how do I {{surface request verbatim}}?". If surface matches real, you haven't reframed. Examples:
>    - Surface: "should we use TypeScript or JavaScript?" → Real: "How much long-term velocity are we willing to trade for short-term setup speed, given team seniority?"
>    - Surface: "review my PR" → Real: "What's the ONE risk in this PR that would make me roll it back in 48 hours?"
> 2. `hidden_assumptions` must be declarative sentences, not questions.
> 3. Do NOT propose solutions. This skill's job ends at structuring the question — UNLESS rule 4 applies.
> 4. **`decision_density: "low"` gate** — set ONLY when ALL of:
>    - `reversibility == "reversible"` (decision can be undone in <1 day with no signal cost)
>    - `framing_confidence >= 80`
>    - The right action is collapsible to a single sentence ("rename / don't rename" / "ship / wait")
>    - There is no human-required checkpoint that needs >5 minutes of user verification
>
>    When low fires, Step 5 emits a `MinimalScaffold` (1-line recommendation + 1-line check), NOT the regular skeleton output. This is one of the few places clarify gives a directive — intentional, because the alternative (forcing a 5-section FinalScaffold onto a tab-rename) is the over-engineering failure mode surfaced in the 2026-04-28 reality test (TC1).
>
>    When in doubt between low/medium, choose medium. False-low is more harmful than false-medium because false-low gives a directive the user might act on without verification.

**Note on `execution_plan`**: At version 0 (initial analysis), `execution_plan` is usually `null` or absent. It emerges in later rounds (deepening) once the real_question is locked AND enough specificity has been extracted. Do NOT force-fill execution_plan on round 0. The `/argus:team` skill is blocked from running until execution_plan with ≥2 steps exists.

Write result to `versions/v0.1/analysis.json`.

### Step 3 — Framing validation (conditional)

If `framing_confidence < 70`:

1. Use **AskUserQuestion** with locale-aware content:

   **locale: ko**
   - Title: "프레이밍 확인"
   - Question: "위 real_question으로 진행할까요? (자신도가 낮습니다: {{score}}/100)"
   - Options:
     - "맞아, 이 방향으로 가자" → lock framing, proceed
     - "내가 원래 생각한 것과 달라" → re-analyze with their correction
     - "다시 설명해줄게" → accept new input, re-analyze

   **locale: en**
   - Title: "Confirm framing"
   - Question: "Proceed with this real_question? (low confidence: {{score}}/100)"
   - Options:
     - "Yes, this is the right angle" → lock framing, proceed
     - "This isn't what I meant" → re-analyze with correction
     - "Let me reframe it" → accept new input, re-analyze

2. If user rejects, re-run Step 2 with rejection reason as additional context.

### Step 4 — Q&A loop (deepening rounds)

**Skip entirely when `decision_density == "low"` AND `--no-minimal` not set.** Minimal mode produces no execution_plan and no team — there's nothing to deepen toward. The Q&A loop's purpose is filling execution_plan for team deployment; it has no value for a 1-line decision card. (False-low density would be caught by M-density meta-check before reaching here.)

**Skip when `framing_confidence >= 90` AND execution_plan already produced in Step 2.** Some clear questions yield execution_plan in the initial round; no deepening needed.

Otherwise, repeat up to `max_rounds` times (default 3) or until the snapshot contains a filled `execution_plan`:

1. **Generate next question** based on latest snapshot. Priorities:
   - If `framing_confidence < 90` and not yet asked: ask a **strategic_fork** question to clarify the decision. Example: "이 결정에서 가장 중요한 건 (A) 속도 (B) 확실성 (C) 장기 유지보수 중 어느 쪽인가?"
   - If weakest_assumption identified: ask a **weakness_check** question. Example: "너는 X를 전제하고 있는데, 이게 틀리면 결정이 바뀌어? (O/X)"
   - Otherwise: ask a **skeleton_clarify** question. Example: "이 스켈레톤 중 어느 항목부터 자세히 채우는 게 가장 가치 있나?"

2. Use **AskUserQuestion** to get user input. Include:
   - `header`: short title in config.locale
   - `question`: the actual question in config.locale
   - `multiSelect: false` unless the question naturally accepts multiple
   - 2-4 options covering the answer space + open option: `"직접 입력"` (ko) / `"Let me type it"` (en)

3. **Run deepening analysis**: update the snapshot with the answer. Produce a new version of AnalysisSnapshot. Append to `snapshots[]` in session.json (NOT overwrite — keeping history).

4. **Check convergence**:
   - If `execution_plan.steps` now present with ≥2 steps AND `framing_confidence >= 75` → `readyForMix = true`, exit loop.
   - If `round >= max_rounds` → exit loop even if not ready. User can run again later.
   - Otherwise → continue loop.

### Step 5 — Output the scaffold (plain-text summary for user)

**Branch on `decision_density` AND `--no-minimal` flag.**

If `--no-minimal` was passed (typically via sail --quick/--full): skip directly to Step 5b regardless of computed density. Log to meta.json: `density_was: "low"` so the user can see the override happened.

#### Step 5a — `decision_density == "low"` AND `--no-minimal` not set → MinimalScaffold

This is the one place clarify produces a directive. The full scaffold pipeline is bypassed because the routing math (rule 4 in Step 2) said it would over-engineer the answer.

1. Construct `MinimalScaffold` (schema: `~/.claude/argus-data/schemas/minimal-scaffold.json`):
   - `recommendation`: single-sentence imperative. "그냥 작업실로 바꿔. 신호 0이면 손해 0." Not "consider X if Y" — a directive.
   - `one_check`: one thing the user verifies in <5 minutes that would flip the recommendation. If none exists, density was set wrong — go back to Step 2.
   - `caveat_if_signal_appears`: optional. Only when there's a real downstream signal worth watching post-action.
   - `_meta.mode = "minimal"`, `_meta.decision_density = "low"`, `_meta.framing_confidence`, `_meta.reversibility`, `_meta.skipped = ["team", "verify", "boss", "debate"]`.
2. Write to `versions/{label}/minimal_scaffold.json`.
3. Set `session.phase = "complete"` (no team/verify/boss to follow).
4. Print to user (locale-aware):

   **locale: ko**
   ```
   ## Argus · Minimal · v0.1

   **권장:** {{recommendation}}

   **확인 한 가지** (5분 이내): {{one_check}}

   {{if caveat_if_signal_appears}}**조심:** {{caveat_if_signal_appears}}{{endif}}

   ─────
   _density: low ({{decision_density_reasoning}}) · 팀 배치 / Boss 검토 생략_
   _재실행하려면: `/argus:sail --full "{{problem_text}}"` (강제 풀파이프)_
   ```

   **locale: en**
   ```
   ## Argus · Minimal · v0.1

   **Recommendation:** {{recommendation}}

   **One check** (<5 min): {{one_check}}

   {{if caveat_if_signal_appears}}**Watch out:** {{caveat_if_signal_appears}}{{endif}}

   ─────
   _density: low ({{decision_density_reasoning}}) · team, verify & boss skipped_
   _Force full pipeline: `/argus:sail --full "{{problem_text}}"`_
   ```

5. Skip to Step 6 (session.json update). Do NOT emit a regular skeleton — the user got their answer.

#### Step 5b — `decision_density in {"medium", "high"}` (or absent for legacy) → regular scaffold

Print to user:

```
## Argus · Clarify · v0.1

**Real question:** {{real_question}}

**Hidden assumptions** (unverified):
- {{assumption 1}}
- {{assumption 2}}
...

**Skeleton:**
1. {{bullet}}
2. {{bullet}}
...

**Framing confidence:** {{score}}/100
**Stakes guess:** {{stakes_guess}} ({{stakes_confidence}}/100)

{{if execution_plan ready}}
**Execution plan** ({{N}} steps) — team is ready to deploy.
Run `/argus:team` to deploy the agents.
{{else}}
**Not yet ready for team deployment.** Run `/argus:clarify --continue` to add another round, or invoke `/argus:team --force` to proceed on current snapshot.
{{endif}}

**Session:** `.argus/sessions/{{id}}/`
```

### Step 6 — Update session.json

Set `phase: "conversing"` (if not ready for team) or stay on `"conversing"` (if ready — team deployment is next). Update `snapshots[]`, `questions_and_answers[]`, `updated_at`.

---

## Output files

Written to `.argus/sessions/{id}/`:

- `session.json` — top-level session record (schema: `~/.claude/argus-data/schemas/session.json`)
- `versions/v0.1/analysis.json` — the AnalysisSnapshot (schema: `~/.claude/argus-data/schemas/analysis-snapshot.json`)
- `versions/v0.1/questions_and_answers.json` — the Q&A history
- `versions/v0.1/meta.json` — `{triggering_skill: "clarify", timestamp, framing_locked, user_accepted_framing}`
- `versions/v0.1/minimal_scaffold.json` — **only when `decision_density == "low"`** (Step 5a). MinimalScaffold (schema: `~/.claude/argus-data/schemas/minimal-scaffold.json`). When this file exists, downstream `/argus:sail` MUST set phase=complete and skip team/verify/boss.

---

## Meta-check gates (self-verify before returning)

Before finalizing, verify:

- **M5 (Analysis primacy)**: Did you reframe? Is `real_question` different from the surface request? If same → fail, retry Step 2 with stricter instruction.
- **M4 (Decision scaffold shape)**: Does the snapshot contain `hidden_assumptions` and `skeleton` as actual arrays, not flat recommendation? If LLM returned a solution-like narrative → fail, retry. **Exception: when `decision_density == "low"`, `skeleton` may be empty array (the minimal scaffold replaces it).**
- **M9 (Worker mode, not critic)**: clarify doesn't invoke workers. NA. But DO NOT include agent voices or critique in the analysis output — that's /argus:team and /argus:boss territory.
- **M-density (Minimal-mode integrity)**: If `decision_density == "low"`:
  - `reversibility` MUST be `"reversible"` AND `framing_confidence >= 80`. If either is missing, downgrade density to `medium` and revise.
  - `recommendation` in MinimalScaffold MUST be a single imperative sentence. Strings starting with "consider" / "depends" / "it may be" → fail, downgrade to medium.
  - `one_check` MUST be verifiable in <5 minutes by the user with no external dependencies (no "ask your team," no "wait 1 week"). If it can't, density was wrong.
  - `human_required_checkpoints` (in the broader sense) MUST be empty. The whole point of minimal mode is that there's nothing the user has to verify outside the one_check. If you wrote checkpoints, density wasn't low.
- **Security**: All user-provided text in prompts must be wrapped in `<user-data>` tags. No raw user text concatenated into system prompts.

If any gate fails, revise before emitting files.

---

## Error modes

- **No `.argus/` directory**: create it. First-time use.
- **`.argus/config.yaml` missing**: silent-create from `~/.claude/argus-lib/config.example.yaml`. Print one ack line. No prompts. (Legacy behavior of "proceed without boss" is removed — first-run users would never realize they could fix it.)
- **User provides no problem text and git state is clean**: prompt for problem text via AskUserQuestion.
- **PR/issue reference fails** (gh not installed, unauthorized): degrade gracefully — ask user to paste the text, note fallback in meta.json.
- **LLM returns malformed JSON**: retry once with stricter schema emphasis. If still fails, write what you got to `versions/v0.1/raw_analysis.txt` and explain the issue to user.

---

## Forbidden patterns

- Shortening clarify to save tokens. The full loop IS the product.
- Proposing solutions. This skill reframes; it does not answer — **EXCEPT** in Step 5a (decision_density == "low"), which is the deliberate exception.
- Aggregating `hidden_assumptions` into a single "main concern" bullet. Keep them separate.
- Skipping the framing validation when confidence < 70 "because it's probably fine."
- Using trait descriptions of agents ("a researcher would ask...") — no agents run here.
- Setting `decision_density: "low"` to "save the user time" when the four conditions in Step 2 rule 4 don't all hold. False-low is more harmful than false-medium.
- Writing a MinimalScaffold with `recommendation` that says "consider X" or "it depends." Minimal mode is for directives only; if you can't give a directive, density isn't low.
