---
name: sail
description: Top-level Argus orchestrator — set sail on a decision. Structures the journey by running clarify → team → boss in sequence, adapting based on user intent. Use when the user has a problem to work through in their current codebase/repo — a technical decision, PR to review, design doc, fuzzy goal. Unlike Cursor or Copilot Review (which generate or critique code), Argus produces a DECISION SCAFFOLD preserving trade-offs, hidden assumptions, team contradictions, and human-required checkpoints. The output is thinking structure, not a solution. This is the entry point most users will invoke. Invoked as `/argus:sail`.
---

# /argus:sail

**What this skill does:** Routes a user's problem through the Argus pipeline. Detects intent from args + repo state, then chains appropriate sub-skills.

**Why this skill exists:** Users shouldn't need to memorize `/argus:clarify` → `/argus:team` → `/argus:boss`. This command does the right thing for their input.

---

## When to run

The default entry point. User typed:
- `/argus:sail "<problem description>"` — process a new problem (auto-routed by stakes/density)
- `/argus:sail @PR#123` — work through this PR
- `/argus:sail @<file>` — think about this file
- `/argus:sail` (bare) — continue latest session, or prompt for input
- `/argus:sail --full "<problem>"` — force full pipeline (clarify → team → boss → final card)
- `/argus:sail --quick "<problem>"` — clarify only (regular scaffold, no team)
- `/argus:sail --no-boss "<problem>"` — skip boss review at end of full pipeline (combines with default or --full)
- `/argus:sail --resume <session-id>` — continue a prior session

Default mode (no flag) auto-routes based on `decision_density` and `stakes_confidence` — see Step 6.

---

## Path resolution

When this skill (or any sub-skill it invokes) refers to `data/...` or `lib/...`,
these resolve to:
- `~/.claude/argus-data/` — schemas, agents.yaml, boss-types.yaml, classification.yaml, README.md
- `~/.claude/argus-lib/` — session-layout.md, version-numbering.md, locale-conventions.md, config.example.yaml, rehearsal-prompt.md

`install.sh` (both `--link` developer mode and copy mode) places them there.
User's session artifacts live in `<cwd>/.argus/sessions/`.

## Execution steps

### Step 0 — Load config

Read `.argus/config.yaml` (schema: `~/.claude/argus-data/schemas/config.json`).

**If missing, silently create from `~/.claude/argus-lib/config.example.yaml`** (no AskUserQuestion — first-run friction was the discoverability killer). Print ONE line in detected locale:
- ko: "ℹ `.argus/config.yaml` 자동 생성 (ISTJ 박 팀장 기본). 다른 boss 원하면 그 파일 편집."
- en: "ℹ `.argus/config.yaml` auto-created (ISTJ default boss). Edit it if you want a different stakeholder."

Locale detection when no config exists yet:
- If `LANG` env starts with `ko` OR system locale is Korean → ko
- Else → en

All downstream skills inherit `locale` from the (now-existing) config.

**Why no prompt:** the user just typed `/argus:sail "..."` — they want a decision, not a setup dialog. The default config is reversible (one file edit). Asking for permission to create a config they obviously want is the kind of ceremoniousness this plugin's reality test (TC1, 2026-04-28) marked as a fail.

### Step 1 — Parse input + detect intent

Given the raw args, determine:
- **Mode**: new session vs continuation
- **Target type**: problem_text / PR / file / branch / issue / bare
- **Scope flag**: `--full` / `--quick` / `--resume`
- **Boss skip**: `--no-boss` → don't invoke boss at the end

Emit an early message in config.locale confirming detection: e.g., "PR #42를 대상으로 full pipeline 진행합니다." (ko) / "Running full pipeline on PR #42." (en)

### Step 2 — Check session state

1. Scan `.argus/sessions/` for existing sessions.
2. If `--resume <id>`: load that session, determine next step based on `phase`.
3. Else: check whether a session for the same target already exists (same PR/file). If yes, ask via AskUserQuestion whether to continue or start fresh.
4. Else: new session — proceed to Step 3.

### Step 3 — Route based on phase

Decision table:

| Current phase | Next skill |
|---|---|
| new / no session | `/argus:clarify` |
| `analyzing` or `conversing` (not ready for mix) | `/argus:clarify --continue` |
| `conversing` (execution_plan ready) | `/argus:team` |
| `team_working` or `mixing` | wait / show progress via status |
| `dm_feedback` pending | `/argus:boss` |
| `refining` or `complete` | show scaffold via `/argus:chart`, offer `/argus:revise` |

### Step 4 — Chain skills (if `--full`)

Run sequentially:
1. `/argus:clarify --no-minimal` (until ready for mix, or max rounds). The `--no-minimal` flag suppresses Step 6a auto-collapse — `--full` is an explicit user override.
2. `/argus:team --invoked-via-sail` (on the snapshot's execution_plan). The `--invoked-via-sail` flag tells team to suppress its own verbose Step 11 print block; sail's Step 7 will render the consolidated card.
3. `/argus:boss --invoked-via-sail` (unless `--no-boss`). Same flag — suppresses boss's verbose narration; sail Step 7 surfaces approval_condition + top critical concern only.
4. **Step 7 — final decision card** (see below).

Clarify still computes `decision_density` (for telemetry/logging in meta.json) but Step 5 emits the regular scaffold instead of MinimalScaffold.

Between skills, report ONE-line transition to user (terse — verbose narration was the legacy boss-of-friction problem):
> "✓ Clarify · 팀 배치 중..."
> "✓ Team ({{N}} agents) · Boss({{mbti}}) 검토 중..."
> "✓ Boss · 결정 카드 ↓"

### Step 5 — `--quick` mode

Runs only `/argus:clarify --no-minimal`. The `--no-minimal` flag forces clarify to emit the regular scaffold (Step 5b) even on low-density questions, because the user explicitly opted into the framing exercise. Useful for:
- Fast problem framing check ("is this even the right question?")
- When the problem is too small for team deployment
- Initial exploration

The scaffold in quick mode has `key_trade_offs` and `hidden_assumptions` but empty `team_contradictions` and a note that team was not deployed.

**Difference from auto-MinimalScaffold (Step 6a)**:
- `--quick` always emits the regular scaffold structure (skeleton + hidden_assumptions arrays). The user explicitly opted into the framing exercise.
- Auto-MinimalScaffold (Step 6a) emits a 1-line directive when decision_density==low. The user did NOT opt in — clarify decided the question was sub-routine and the framing exercise itself would over-engineer.

If user passes `--quick` AND clarify computes density==low: still emit regular scaffold (user override). The minimal-mode collapse is only for the no-flag default path.

### Step 6 — Default mode (no flag)

If `--full` / `--quick` not specified: run `/argus:clarify` first, then branch on the resulting AnalysisSnapshot.

#### Step 6a — `decision_density == "low"` → MinimalScaffold path (clarify already rendered)

Clarify Step 5a already printed the minimal card AND wrote `versions/{label}/minimal_scaffold.json` AND set `session.phase = "complete"`. The user has their answer on screen.

Sail's job here: **exit silently**. No re-print, no AskUserQuestion, no Step 7 invocation. Anything sail prints now is duplicative with clarify's output and wastes screen space.

**Why no AskUserQuestion here**: rule 4 in clarify Step 2 already gated this with strict conditions (reversibility==reversible AND framing_confidence>=80 AND single-action AND no >5min checkpoint). Adding a confirmation prompt re-introduces the bikeshed cost we just saved. The user can override with `/argus:sail --full "<problem>"` if they disagree — that's the escape hatch printed in clarify Step 5a output.

#### Step 6b — `decision_density in {"medium", "high"}` AND `stakes_confidence < 75` → confirm stakes first

When clarify is uncertain about stakes (borderline routine/important or important/critical), ask before locking the routing:

Use AskUserQuestion:
- Title (ko): "스테이크 확인" / Title (en): "Confirm stakes"
- Question (ko): "이 결정이 **{{stakes_guess}}** 정도로 보이는데(자신도: {{stakes_confidence}}/100) 맞나요?"
- Question (en): "I read this as **{{stakes_guess}}** stakes (confidence: {{stakes_confidence}}/100). Right?"
- Options:
  - "맞아 — {{stakes_guess}}로 진행" / "Yes, proceed as {{stakes_guess}}"
  - "더 가볍게 봐도 돼" / "Lighter than that" — downgrade one level
  - "더 무겁게 봐야 해" / "Heavier than that" — upgrade one level

Persist the user-confirmed stakes to `session.classification.stakes` and `session.classification.stakes_user_confirmed = true`. Then continue to Step 6c with the locked stakes.

If `stakes_confidence >= 75`: skip directly to Step 6c without asking — clarify is sure enough that the friction of asking outweighs the routing risk.

#### Step 6c — Standard routing (medium/high density, stakes locked)

**Auto-proceed when confidence is high.** This is the convenience layer: if clarify produced strong signals, do not stop the user with a 3-option AskUserQuestion. They typed `/argus:sail` because they want a decision, not a routing dialog.

Decision matrix:

| stakes (locked) | stakes_confidence | density | Auto-action | User asked? |
|---|---|---|---|---|
| `critical` | ≥ 80 | medium/high | run team → boss → final card | No (just one-line "auto-proceeding" notice) |
| `important` | ≥ 80 | medium/high | run team → boss → final card | No (one-line notice) |
| `routine` | ≥ 80 | medium (non-low) | run quick scaffold (clarify --no-minimal already done in Step 6 path; emit final card on snapshot only) | No |
| any | 75–79 | medium/high | ask once: 3 options below | Yes |
| any | < 75 | any | should have been caught by Step 6b | n/a |

**Auto-action notice (when skipping the prompt):** print one line in config.locale before chaining.
- ko: "자동 진행 — `{{stakes}}` ({{confidence}}/100). 팀 배치 후 boss 검토 + 최종 카드까지 이어갑니다. (멈추려면 Ctrl-C)"
- en: "Auto-proceeding — `{{stakes}}` ({{confidence}}/100). Chaining team → boss → final card. (Ctrl-C to halt)"

**When asking is necessary (75–79 borderline):**

Use AskUserQuestion:
- Title: "다음 단계"
- Question: "stakes={{stakes}} (confidence {{confidence}}/100) — 어떻게 진행할까요?"
- Options: "전부 자동 진행 (team → boss → 최종)", "팀까지만, boss 생략", "빠른 스캐폴드만 (에이전트 없이)", "일단 멈추자 — 더 생각해볼게"

Why these 4 options (not the legacy 3): "전부 자동 진행" is the new default. "boss 생략" is a one-shot equivalent of `--no-boss`. The other two are unchanged.

**After Step 6c picks a path (auto or asked):**
- "전부 자동 진행" → invoke `/argus:team --invoked-via-sail`, then (unless `--no-boss` or boss-skip selected) `/argus:boss --invoked-via-sail`, then **Step 7 final card**.
- "팀까지만" → `/argus:team --invoked-via-sail` only, then Step 7.
- "빠른 스캐폴드만" → clarify Step 5b output is already the user-facing view (skeleton + hidden_assumptions). **No Step 7** (no scaffold.json to render). Exit.
- "일단 멈추자" → write a stub `versions/{label}/meta.json` `{phase_at_pause: "conversing"}`. Print "/argus:sail --resume {{session.id}} 으로 이어가세요." Exit.

### Step 7 — Final decision card (consolidated one-screen output)

**Invoked only after team or boss ran (Step 4 --full path or Step 6c team-running path).** Step 6a (minimal mode) does NOT invoke Step 7 — clarify already rendered.

Step 7 emits ONE consolidated view. The user should NOT have to read JSON files in `versions/{label}/` to know what was decided. Per locale.

#### Source data

Read the latest `versions/{label}/`:
- `analysis.json` → `reframed_question`, `framing_confidence`
- `scaffold.json` (FinalScaffold) → `key_trade_offs[0]`, `team_contradictions[]`, `hidden_assumptions[]` (filter doubtful), `human_required_checkpoints[]`, `next_actions[0..1]`
- `boss_feedback.json` (if boss ran) → `approval_condition`, top critical concern (if any)

#### Render

```
## Argus · {{session_id}} · {{label}}

**질문:** {{reframed_question}}

{{if boss_feedback exists}}
**Boss({{boss.mbti}}) 결론:** {{boss_feedback.approval_condition}}
{{else}}
**팀 권장:** {{next_actions[0].action}}
{{endif}}

**우선 행동 (이번 주):** {{next_actions[0].action}}{{if next_actions[1]}} · {{next_actions[1].action}}{{endif}}

{{if team_contradictions length > 0}}
**⚠ 미해결 갈등 ({{team_contradictions.length}}건):** {{team_contradictions[0].topic}} {{if team_contradictions.length > 1}}외 {{team_contradictions.length - 1}}건{{endif}}
{{endif}}

{{if hidden_assumptions filter doubtful length > 0}}
**⚠ 의심 가정 ({{N}}건):** {{first.assumption}}{{if N > 1}} 외 {{N-1}}건{{endif}}
{{endif}}

{{if human_required_checkpoints length > 0}}
**👤 사용자 작업 ({{N}}건):** {{first.checkpoint}}
{{endif}}

{{if boss_feedback critical concerns}}
**🛑 Boss critical 우려:** {{first critical concern}}
{{endif}}

📁 `.argus/sessions/{{session_id}}/versions/{{label}}/`
🗺  전체 트리: `/argus:chart`
```

Target length: 12–18 lines. The user should be able to read it in one screen.

The full JSON files remain in `versions/{label}/` for chart and revise to consume. The card is the SUMMARY — anyone wanting more depth opens the files. This is the "한 화면 결정 카드" the user actually consumes.

---

### Boss skip handling

`--no-boss` flag (sail) OR `boss = null` in config.yaml OR user picked "팀까지만, boss 생략" in Step 6c → skip boss step. Step 7 still emits the card; just without the boss line. `boss_feedback.json` is not produced.

---

## Output

Sail has three terminal user-facing outputs depending on the path taken:

| Path | What user sees | Renderer |
|---|---|---|
| Step 6a (low density) | clarify Step 5a minimal card (recommendation + 1 check + optional caveat) | clarify |
| Step 5 / Step 6c "빠른 스캐폴드만" (--quick or quick option) | clarify Step 5b regular scaffold (skeleton + hidden_assumptions) | clarify |
| Step 4 (--full) / Step 6c team-running paths | Step 7 consolidated decision card (~12-18 lines) | sail |

No JSON dumps, no path-only summaries. The card or scaffold is the consumable artifact; the JSON files in `versions/{label}/` are inspectable by `/argus:chart` when the user wants depth.

---

## Meta-check gates

- **M5 (Analysis primacy)**: Clarify must always run first — even in `--quick` mode. No path to team without clarify.
- **M7 (Commodity test)**: Would Cursor or Copilot Review produce this output? If yes, the orchestrator is not surfacing the judgment-scaffold shape.
- **Never bypass AskUserQuestion for mode choice** when intent is ambiguous. Argus is about preserving user agency.

---

## Error modes

- **No args + no git state**: prompt for input via AskUserQuestion.
- **Session exists in intermediate phase**: resume is default; offer restart only if user asks.
- **Sub-skill fails**: log to `.argus/errors.log`, report to user, don't proceed to next skill.

---

## Forbidden patterns

- Running `/argus:team` before `/argus:clarify`. The whole pipeline is invalidated.
- Skipping `/argus:boss` silently when user didn't pass `--no-boss` AND boss is configured. Boss is default unless explicitly skipped or unconfigured.
- Collapsing the pipeline into a single monolithic prompt "to save time." The pipeline IS the product.
- Renaming sessions or modifying existing versions — orchestrator only creates new sessions or advances phases.
- **Asking the user "어떻게 진행할까요?" when stakes_confidence ≥ 80** — this is the friction that made the plugin feel ceremonious. Auto-proceed and inform with one line. (Step 6c table is the spec — follow it.)
- **Letting team or boss print their full Step 11 / Step output blocks when invoked via sail.** The `--invoked-via-sail` flag must suppress that; sail Step 7 owns the user-visible final view. Otherwise the user sees the same content rendered twice (team print + sail card), which is exactly the verbose pattern we removed.
