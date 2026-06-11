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
- `--invoked-via-sail` — clarify is running as a step inside `/argus:sail`, not standalone. When set, Step 5b writes its files but emits only a one-line ack instead of the full scaffold print, and does NOT tell the user to run `/argus:team` (sail is already chaining it). Prevents the double-render where the user sees clarify's scaffold AND sail's final card. Minimal mode (Step 5a) still prints, since on the minimal path sail exits silently and clarify's output IS the answer.
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
   - `@doc:<path>` → Read a local document (`.md`/`.txt`/`.pdf`/etc.) into `target_context` (`kind: "document"`). This is the non-code intake path: a strategy deck, contract, memo, or spec the decision is about. Downstream team runs in document mode on it — no repo needed.
   - You can also accept pasted context inline (the user drops the relevant facts in the problem text); set `target_context.kind: "pasted"`.
3. **Autodetect from git state** (no args):
   - Current branch name (not `main`/`master`)
   - Last 1-3 commit messages
   - Uncommitted changes (`git diff HEAD`) — **redact before use.** This can include modified-but-gitignored files (e.g. `.env`, `.env.local`) with live secrets. Skip hunks from paths matching `.env*`, `*.pem`, `*.key`, `*secret*`, `*credential*`, and replace high-entropy strings / `BEGIN ... PRIVATE KEY` blocks with `[REDACTED]` before sending any diff into a prompt or writing it to `target_context`/`repo_context.json`. The same redaction applies to expanded PR diffs and file contents.
   - Open PRs authored by user
   - Report what was detected before proceeding

If multiple candidates, use **AskUserQuestion** to disambiguate: "Which of these are you working on?"

**Persist the expanded target context.** Whenever a target reference is expanded (PR diff, file contents, branch diff, issue body), write the result to `versions/v0.1/meta.json` under `target_context` so `/argus:team` can consume it directly without re-fetching — `gh` may be unauthorized or offline by the time team runs, and re-fetching duplicates work. Shape:
- `pr` → `target_context: {kind: "pr", ref, title, description, state, files_changed: [...], diff}`
- `issue` → `target_context: {kind: "issue", ref, title, body, state}`
- `branch` → `target_context: {kind: "branch", ref, commits, diff_stat}`
- `file` → `target_context: {kind: "file", ref, contents, recent_churn}`
This is the single source of truth for the artifact the team works ON (M1 code-native). If expansion failed (gh missing / not a repo), write `target_context: {kind, ref, error: "<reason>", fallback_text: "<user-pasted text if any>"}` so team can degrade to hypothetical mode knowingly instead of silently analyzing nothing.

---

## Execution steps

### Step 1 — Session bootstrap

1. **Read config**: Load `.argus/config.yaml` (schema: `${CLAUDE_PLUGIN_ROOT}/data/schemas/config.json`). If clarify is invoked via `/argus:sail`, the config is already loaded and present (sail Step 0 silent-creates it). If clarify is invoked DIRECTLY by the user with no config, silent-create from `${CLAUDE_PLUGIN_ROOT}/lib/config.example.yaml` (same logic as sail Step 0, including locale detection) — print sail Step 0's one-line ack in the detected locale and proceed. No AskUserQuestion. All user-facing text in this skill uses `config.locale`. (Resolve `${CLAUDE_PLUGIN_ROOT}` paths per sail §Path Resolution: plugin install dir first, then the legacy copy-install dirs, then repo-local `argus-plugin-v2/`.)
2. Compute session ID: `YYYY-MM-DD-<kebab-of-first-5-words-of-problem>-<author>`, where `<author>` is the first 4 hex chars of a hash of `git config user.email` (fallback: `git config user.name`, else `local`). The author suffix makes the same problem from two teammates resolve to two non-colliding directories that still both travel via git — the team-safety guarantee. Still collision-safe within one author by appending `-2`, `-3`.
3. Create `.argus/sessions/{id}/` directory.
4. Create `session.json` at the root with schema from `${CLAUDE_PLUGIN_ROOT}/data/schemas/session.json`. Fields:
   - `id`, `problem_text`, `repo_path` (from `pwd`), `repo_branch` (from `git branch --show-current`; if the command errors because this is not a git repo, set `repo_branch: null` and `invoking_context.git_available: false` — do NOT halt or write garbage. Team Step 1.5 path C (hypothetical mode) keys off `git_available: false`.)
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
> Produce JSON conforming to `${CLAUDE_PLUGIN_ROOT}/data/schemas/analysis-snapshot.json`:
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

### Step 3.5 — 시험 항해 (Trial Sail probe) — W2 재배선

**Skip when `decision_density == "low"`** (a 1-line decision doesn't get a
crew — cost discipline + the P0.B lesson: probes talk on everything unless
gated) **or `--quick`.**

> Locale note: the quoted Korean strings below are the ko reference copy —
> render user-facing lines in `config.locale`. English equivalents:
> step 3 → "The crew read the same brief independently — no differentiated
> instructions." · step 7 → "The crew converged on the same course. No
> measurable fork inside this text — the remaining risk lives outside it."
> The constraint lines (no persona text in probe prompts, mechanical
> post-filters, call budget) are implementation rules and apply regardless
> of locale.

1. Read the probe prompts from `${CLAUDE_PLUGIN_ROOT}/data/prompts/probe-prompts.md`
   — **단일 원천이다. 절대 기억으로 재작성하지 마라** (the file is held in
   byte-parity with the web engine by a test; an improvised variant silently
   diverges from the G0-validated levers). Path fallback per sail §Path
   Resolution.
2. **C 분기 탐침**: launch 3 parallel haiku-class Tasks, each = GROUND_RULES +
   the brief verbatim in `<user-data>` + the C sample block. **차별화 지시
   절대 금지 — 페르소나 텍스트를 이 프롬프트에 넣지 마라** (측정 오염). Crew
   names/emoji are presentation only, applied to finished cards.
3. Render cards as they arrive: "같은 브리프를 따로따로 읽었어요 — 서로 다른
   지시는 없었어요."
4. **C 병합** (sonnet-class, 1 call): the fork rules block. Mechanical
   post-filter (trust no model): drop forks with empty `flipped_user_claim`;
   drop forks whose `cause_quote` does not occur in the brief.
5. **D 하중 탐침** (sonnet-class, 1 call): the ablation block. Drop findings
   whose `removed_sentence` does not occur in the brief.
6. Write `versions/{label}/probe.json`:
   `{ samples[], forks[], findings[], silent }`.
7. **갈림 0 && 하중 0** → say exactly: "선원들이 같은 곳으로 갔어요. 이 텍스트
   안에서 잴 수 있는 갈림은 없었어요 — 남은 위험은 텍스트 밖이에요." and
   proceed. 침묵도 출력이다 — do NOT manufacture a finding to seem useful.

Budget: 5 calls (3 haiku + 2 sonnet-class), ≤8 총량 준수.

### Step 4 — Q&A loop (deepening rounds)

**Skip entirely when `decision_density == "low"` AND `--no-minimal` not set.** Minimal mode produces no execution_plan and no team — there's nothing to deepen toward. The Q&A loop's purpose is filling execution_plan for team deployment; it has no value for a 1-line decision card. (False-low density would be caught by M-density meta-check before reaching here.)

**Skip when `framing_confidence >= 90` AND execution_plan already produced in Step 2.** Some clear questions yield execution_plan in the initial round; no deepening needed.

Otherwise, repeat up to `max_rounds` times (default 3) or until the snapshot contains a filled `execution_plan`:

1. **Generate next question** based on latest snapshot. Priorities:
   - **(FIRST — 측정-정박 질문, W2 재배선)** If `versions/{label}/probe.json`
     has forks not yet asked: convert the highest-priority fork MECHANICALLY
     (no LLM) per `probe-prompts.md` §갈림→질문 — purpose_reading forks first,
     then variants count / anchor length; question quotes the `cause_quote` +
     "이 선택에 따라 '{flipped_user_claim}'이 참도 거짓도 됩니다"; options =
     the executors' actual variants + "직접 입력". **세션당 ≤2.** These are
     measurements, not AI opinions — never frame them as warnings.
   - If `framing_confidence < 90` and not yet asked: ask a **strategic_fork** question to clarify the decision. Example: "이 결정에서 가장 중요한 건 (A) 속도 (B) 확실성 (C) 장기 유지보수 중 어느 쪽인가?"
   - If weakest_assumption identified: ask a **weakness_check** question. Example: "너는 X를 전제하고 있는데, 이게 틀리면 결정이 바뀌어? (O/X)"
   - Otherwise: ask a **skeleton_clarify** question. Example: "이 스켈레톤 중 어느 항목부터 자세히 채우는 게 가장 가치 있나?"

2. Use **AskUserQuestion** to get user input. Include:
   - `header`: short title in config.locale
   - `question`: the actual question in config.locale
   - `multiSelect: false` unless the question naturally accepts multiple
   - 2-4 options covering the answer space + open option: `"직접 입력"` (ko) / `"Let me type it"` (en)

3. **Run deepening analysis**: update the snapshot with the answer. Produce a new version of AnalysisSnapshot and write it to `versions/{label}/analysis.json` (latest is authoritative). Append the Q&A turn to `versions/{label}/questions_and_answers.json` to keep history. Do NOT store snapshots in session.json — the version dir is the authoritative, write-once-per-round home (keeps session.json thin and conflict-free).

4. **Check convergence**:
   - If `execution_plan.steps` now present with ≥2 steps AND `framing_confidence >= 75` → `readyForMix = true`, exit loop.
   - If `round >= max_rounds` → exit loop even if not ready. User can run again later.
   - Otherwise → continue loop.

### Step 5 — Output the scaffold (plain-text summary for user)

**Branch on `decision_density` AND `--no-minimal` flag.**

If `--no-minimal` was passed (typically via sail --quick/--full): skip directly to Step 5b regardless of computed density. Log to meta.json: `density_was: "low"` so the user can see the override happened.

#### Step 5a — `decision_density == "low"` AND `--no-minimal` not set → MinimalScaffold

This is the one place clarify produces a directive. The full scaffold pipeline is bypassed because the routing math (rule 4 in Step 2) said it would over-engineer the answer.

1. Construct `MinimalScaffold` (schema: `${CLAUDE_PLUGIN_ROOT}/data/schemas/minimal-scaffold.json`):
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
   _density: low ({{decision_density_reasoning}}) · 팀 배치 / 검증 / Boss 검토 생략_
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

**If `--invoked-via-sail` is set:** do NOT print the scaffold block below. Write all files (analysis.json, meta.json, etc.) as normal, then emit a single ack line in `config.locale` and return — sail Step 7 renders the consolidated card.
- ko: `✓ Clarify — 진짜 질문 파악 완료, 팀 배치 중…`
- en: `✓ Clarify — real question framed, deploying team…`

**Otherwise (direct invocation)**, print to user:

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

Set `phase: "conversing"` (if not ready for team) or stay on `"conversing"` (if ready — team deployment is next). In session.json update ONLY the thin skeleton fields: `phase`, `round`, `updated_at` (and `classification` if stakes were set). The analysis snapshot and Q&A history live in `versions/{label}/analysis.json` and `questions_and_answers.json`, not in session.json.

---

## Output files

Written to `.argus/sessions/{id}/`:

- `session.json` — top-level session record (schema: `${CLAUDE_PLUGIN_ROOT}/data/schemas/session.json`)
- `versions/v0.1/analysis.json` — the AnalysisSnapshot (schema: `${CLAUDE_PLUGIN_ROOT}/data/schemas/analysis-snapshot.json`)
- `versions/v0.1/questions_and_answers.json` — the Q&A history
- `versions/v0.1/meta.json` — `{triggering_skill: "clarify", timestamp, framing_locked, user_accepted_framing, target_context?, density_was?}`. `target_context` is present whenever a target reference was expanded (see Inputs) and is what `/argus:team` reads to work on the real artifact.
- `versions/v0.1/minimal_scaffold.json` — **only when `decision_density == "low"`** (Step 5a). MinimalScaffold (schema: `${CLAUDE_PLUGIN_ROOT}/data/schemas/minimal-scaffold.json`). When this file exists, downstream `/argus:sail` MUST set phase=complete and skip team/verify/boss.
- `versions/v0.1/probe.json` — **only when Step 3.5 ran** (density medium/high, not --quick). `{ samples[], forks[], findings[], silent }` — the trial-sail measurement; Step 4 reads it for 측정-정박 질문.

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
- **`.argus/config.yaml` missing**: silent-create from `${CLAUDE_PLUGIN_ROOT}/lib/config.example.yaml`. Print one ack line. No prompts. (Legacy behavior of "proceed without boss" is removed — first-run users would never realize they could fix it.)
- **User provides no problem text and git state is clean**: prompt for problem text via AskUserQuestion.
- **PR/issue reference fails** (gh not installed, unauthorized): degrade gracefully — ask user to paste the text, note fallback in meta.json.
- **LLM returns malformed JSON**: retry once with stricter schema emphasis. If still fails, write what you got to `versions/v0.1/raw_analysis.txt` and explain the issue to user.
- **Corrupt/half-written stored JSON** (a prior run was interrupted mid-write, so `session.json` / `analysis.json` won't parse): do NOT crash with an opaque error. Defensively try/parse every stored file you read; on parse failure, move the bad file to `<name>.corrupt.<timestamp>`, log to `.argus/sessions/{id}/errors.log`, and either recreate it from defaults (if it's regenerable, e.g. analysis.json → re-run Step 2) or halt with a precise message naming the exact file to delete. This guard applies to every skill that reads stored session JSON (clarify, team, verify, boss, chart) — never let one interrupted write permanently brick a session.

---

## Forbidden patterns

- Shortening clarify to save tokens. The full loop IS the product.
- Proposing solutions. This skill reframes; it does not answer — **EXCEPT** in Step 5a (decision_density == "low"), which is the deliberate exception.
- Aggregating `hidden_assumptions` into a single "main concern" bullet. Keep them separate.
- Skipping the framing validation when confidence < 70 "because it's probably fine."
- Using trait descriptions of agents ("a researcher would ask...") — no agents run here.
- Setting `decision_density: "low"` to "save the user time" when the four conditions in Step 2 rule 4 don't all hold. False-low is more harmful than false-medium.
- Writing a MinimalScaffold with `recommendation` that says "consider X" or "it depends." Minimal mode is for directives only; if you can't give a directive, density isn't low.
