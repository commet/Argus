# Argus v2 Self-Rehearsal Runbook

> **HISTORICAL HARNESS — vocabulary frozen pre-O3 (2026-07-17).** This rehearsal
> simulates the pre-O3 surface (individual clarify/team/verify/boss commands,
> MBTI-first boss config). The DO-NOT-INVOKE list below is still safe — those
> names no longer exist as commands. If this harness is revived, re-target it at
> `skills/review/pipeline.md` and the seat-first boss (config
> role/owns/goals/authority) first.

You are auditing Argus plugin v2 via **dry-run simulation**. This file is your runbook — read it once, then execute the protocol below.

> **Use ultrathink throughout.** This is a thorough self-audit, not a quick scan. Reasoning depth determines bug-find rate.

## Your job

1. Read the spec (pre-flight section)
2. Pick or use the given test case
3. Walk the pipeline phase-by-phase **in your head** (no real skill invocation)
4. Apply M-gate checks at each phase
5. Report bugs + propose patches
6. Apply user-approved patches
7. Repeat or stop per criteria

## Hard rules — read carefully

**🚫 DO NOT invoke real plugin commands.** No `/argus:sail`, `/argus:clarify`, `/argus:team`, `/argus:verify`, `/argus:boss`, `/argus:versions`. These would actually execute SKILL.md procedures, create real `.argus/sessions/` directories, spawn real Task tool subagents, and hit real LLM calls. **Simulation ≠ execution.**

**🚫 DO NOT spawn Task tool subagents to "test" individual agents.** That's also real execution.

**✅ Simulation means**: You read the SKILL.md, mentally execute its steps, and write down what each step **would** produce given the test case. You also write down what each agent (sujin, donghyuk, etc.) **would** output in their voice based on their `agents.yaml` profile + worker-mode example dialogues.

**✅ ultrathink everything.** Dry-run reasoning that's shallow misses spec bugs. Be exhaustive.

**✅ User approves patches before you apply.** Never auto-edit files based on simulation findings. Show user the patch proposal, get OK, then Edit.

---

## Pre-flight reading

Read in this order. Internalize structure, not memorize content. ~10 minutes.

**Tier 1 — must read fully:**
1. `BUILD_STATUS.md` — current build state, all prior patches, known issues
2. `.claude-plugin/plugin.json` — manifest, command list
3. `skills/sail/SKILL.md` — orchestrator
4. `skills/clarify/SKILL.md` — Phase 0
5. `skills/team/SKILL.md` — Phase 1 (longest, most complex — read carefully)
6. `skills/boss/SKILL.md` — Phase 2
7. `skills/versions/SKILL.md` — version tree utility

**Tier 2 — skim for structure:**
8. `data/agents.yaml` — 17 agents (read at least 3 fully: sujin, donghyuk, junseo for voice reference)
9. `data/boss-types.yaml` — 16 MBTI types (sample 2-3)
10. `data/classification.yaml` — task types, domains, output types, stakes rules
11. `data/schemas/final-scaffold.json` — the plugin's signature output
12. `data/schemas/session.json` — session record structure

**Tier 3 — reference if needed:**
13. `lib/session/version-numbering.md` — version label algorithm
14. `lib/session/session-layout.md` — directory structure
15. `lib/locale-conventions.md` — locale handling conventions
16. `data/schemas/*.json` — other schemas
17. `data/README.md` — data provenance

---

## Test case selection

**If user provided a test case in their prompt**, use it.

**Otherwise default**: 
> "Should I add automated tests to `argus-plugin-v2/` before swapping it with the v0.5 plugin currently at `~/.claude/plugins/argus-v0.5-backup`?"

This default is intentional — it:
- Lives in the actual repo (tests `repo_scan` or `explicit_target` mode)
- Has surface-vs-real tension (XY problem potential — real Q might be "what's the minimum risk-reduction needed before swap?")
- Important stakes (reversible swap, but reputational if v2 has bugs)
- Likely 3-5 execution_plan steps (tests Step 3.5 reconciliation)
- Critique step natural (donghyuk fits)

If you change the default, explain why in your final report.

---

## M-gate definitions

These are the 10 gates Argus v2 must pass. Apply each at the relevant phase during simulation.

### M1 — Code-native
The pipeline operates on real artifacts (files, PR, diff), not abstract prose. **Test**: in `team` simulation, do agents cite specific file paths + line numbers when `repo_context.mode != hypothetical`? If outputs are "if your code looks like X..." style despite repo access, M1 fails.

### M2 — Personality preservation
Agents speak in distinct voices. **Test**: substitute agent names with "Reviewer 1, 2, 3" — would output change meaningfully? If not, voices have collapsed to generic. Sample agents.yaml `voice_markers` and `worker_mode_examples` should be visibly reflected in simulated outputs.

### M3 — Contradiction preservation
When agents genuinely disagree on a canonical decision axis (see team SKILL.md Step 7 axis table), `team_contradictions[]` is populated; aggregation forbidden. **Test**: in team simulation, did debate trigger when warranted? Or did the LLM aggregate into "consensus"?

### M4 — Decision scaffold
Output shape preserves `key_trade_offs[]`, `hidden_assumptions[]`, `human_required_checkpoints[]`, `next_actions[]`, `verification`, optionally `team_contradictions[]`, `boss_concerns_*`, `boss_questions_pending[]`. Required fields exist (empty arrays OK). **Test**: simulated FinalScaffold conforms to `final-scaffold.json` schema and does not look final when `verification.overall_status` is `unverified`, `mixed`, `needs_revision`, or `blocked`?

### M4.5 - Verification before boss
Medium/high paths produce `verification.json` before boss review. **Test**: simulated `/argus:sail` route includes `/argus:verify` between `/argus:team` and `/argus:boss`; `verification.json` separates supported claims, challenged claims, unresolved tensions, and human-required checks. If boss runs with no verification ledger, M4.5 fails.

### M5 — Analysis primacy
`/argus:clarify` is mandatory first step. Reframing requires `surface_request != real_question`. **Test**: in clarify simulation, is real_question genuinely different (deeper) than the surface phrasing of the test case?

### M6 — Stakes-driven agent selection
Agent count limited per stakes (routine: 2, important: 3, critical: 4). Reconciliation flow (Step 3.5) deterministic when steps > budget. **Test**: in team simulation, walk through Step 3.5 (a)→(b)→(c)→(d) explicitly. Verify exit condition.

### M7 — Commodity bot test
If the simulated final output could come from Cursor / Copilot Review / a generic multi-agent framework, the plugin failed differentiation. **Test**: would a commodity tool produce this? If yes, the scaffold-shape isn't carrying weight.

### M8 — Archive growth
Each run enriches `.argus/sessions/` meaningfully. Versions accumulate via Draft tree. **Test**: simulated session produces meaningfully different `versions/v0.1/` content than what would exist before.

### M9 — Worker, not critic
Stage-1 agents PRODUCE artifacts in their domain (research, numbers, UX, legal, tech). Critique is donghyuk's WORK, not meta-review of other agents. **Test**: do simulated stage-1 outputs read as "here's the research / numbers / UX analysis" or as "I reviewed X and found issues"? Latter = critic mode = fail.

### M10 — Versioning-ready
Every artifact has `version_id + parent_version_id + timestamp + triggering_skill` metadata. Re-runs bump labels via `nextChildLabel`. **Test**: simulate a re-run; does it produce v0.2 (or v0.1.1 if branching) correctly?

---

## Simulation protocol — phase by phase

### Phase 0 — Setup

Walk through `skills/sail/SKILL.md`:
- Step 0: assume `.argus/config.yaml` state. Choose: present (with `boss: {mbti_code: <pick a type>}`) OR absent (test fallback path).
- Step 1: parse args. Test case is bare prose → `target_type: ad_hoc`.
- Step 2: scan `.argus/sessions/` → none exist (new test).
- Step 3-6: route to `clarify`.

**Note any uncertainty** about Step 0 behavior when config absent. Spec gap → bug.

### Phase 1 — Clarify dry-run

Walk through `skills/clarify/SKILL.md` Steps 1-6:

1. **Bootstrap**: produce session.json with chosen test case.
2. **Initial analysis**: write what AnalysisSnapshot version 0 WOULD contain for this test case:
   - `real_question`: should be genuinely different from surface (M5).
   - `hidden_assumptions[]`: 3-5 declarative.
   - `skeleton[]`: 3-7 bullets.
   - `framing_confidence`: pick a value 0-100. If <70, simulate framing validation (Step 3).
3. **Q&A loop**: pick a strategic_fork question. Choose a plausible user answer.
4. **Deepening**: produce updated snapshot (version 1) with `execution_plan.steps[]`.

Apply gates: **M5** (reframing depth).

Record bugs found in Phase 1.

### Phase 2 — Team dry-run

Walk through `skills/team/SKILL.md` Steps 1-11:

1. **Load session**: re-use Phase 1 output.
2. **Step 1.5 repo context**: choose mode. For default test case → `repo_scan` (no @target).
   - Sample what the repo_sketch would contain (languages, frameworks, recent commits, directory_sample).
3. **Step 2 classification**: assign stakes, decision_type, per-step task_types/domains/output_types.
4. **Step 3 agent selection**: compute scores. Pick best agent per step.
5. **Step 3.5 reconciliation** (if steps > budget): walk (a)→(b)→(c)→(d) explicitly. Show your work.
6. **Step 4 stage-1 deploy**: simulate each worker's output IN THEIR VOICE based on agents.yaml. Aim for 3-5 sentences each. Cite (mock) file paths if `repo_scan` mode.
7. **Step 5 collect**: aggregate.
8. **Step 6 stage-2** (if critical): donghyuk's pre-mortem.
9. **Step 7 debate detection**: walk through canonical axes. Does any agent pair imply opposing positions? If yes, simulate debate.json. If no, document why no debate (and verify M3 doesn't false-fire).
10. **Step 8 synthesize**: simulate MixResult.
11. **Step 9 FinalScaffold**: simulate scaffold.json.

Apply gates: **M1, M3, M4, M6, M7, M9**.

Record bugs.

### Phase 3 — Boss dry-run

Walk through `skills/boss/SKILL.md` Steps 1-10:

1. Load scaffold from Phase 2.
2. Load MBTI from config (or fallback if absent).
3. Build review prompt with personality block.
4. Simulate review output IN THE BOSS'S VOICE — heavy reference to that MBTI's `example_dialogue` from boss-types.yaml.
5. Walk through Step 8 routing of new demands (concerns vs decision-demands vs investigation vs questions).
6. Update scaffold with boss_concerns_* and boss_questions_pending if any.

Apply gates: **M2** (boss voice distinct from generic reviewer), **M4** (scaffold preserved).

Record bugs.

### Phase 4 — Version tree dry-run

Walk through `skills/versions/SKILL.md`:
1. Render version tree (just v0.1 at this point).
2. Verify status output shape.

Apply: **M8, M10**.

### Phase 5 — Re-run simulation (optional, tests #11/#12 patches)

Imagine user re-runs `/argus:team` after applying boss feedback:
- Does Step 1.4 detect existing `workers.json` correctly?
- Does it bump label to v0.2 via `nextChildLabel`?

If you've already verified this in the same session via thinking, skip. Otherwise simulate briefly.

---

## Bug discovery format

For each issue found, write:

```
🐛 Bug #<sequential> — <short title>
Severity: critical | high | medium | low
Phase: <where in pipeline>
Location: <file>:<line> OR "spec gap, no location"
Symptom: <what goes wrong in the simulated output>
Root cause: <why the spec produces this>
Patch proposal: <specific edit — file path + before/after text>
```

**Severity guide:**
- **critical**: M-gate fails, output is fundamentally wrong, blocks shipping
- **high**: Spec inconsistency that produces non-deterministic behavior, or significantly degrades a gate
- **medium**: Edge case mishandled, minor gate weakening, UX rough edge
- **low**: Documentation imprecision, polish, future-improvement note

---

## Patch protocol

After listing all bugs (sorted by severity):

1. **Show user the bug list** with severity grouping. Critical+high first.
2. **For each bug user wants to patch**: 
   - Show the proposed Edit (before/after).
   - Wait for user confirmation.
   - Apply via Edit tool.
3. **Re-simulate** the affected phase to verify fix doesn't introduce new bugs.
4. **Update `BUILD_STATUS.md`** with a patch entry under "Patches applied <date> (<n>th pass — self-rehearsal)".

**Never auto-apply.** Even for "obvious" bugs, ask first. The user is the spec authority.

---

## Stop conditions

Stop when **any** of:

- ✅ All M1-M10 pass with no critical or high bugs in latest simulation
- ⏱ 3 simulation iterations completed (don't loop indefinitely)
- 🛑 User says stop
- 📊 Self-assessed confidence ≥ 92% AND no high-severity bugs

If iteration 3 still has critical bugs → **escalate to user** with structured handoff. Don't just keep trying.

---

## Final report format

When stopping, produce:

```markdown
## Self-Rehearsal Report — <YYYY-MM-DD>

### Test case
"<problem>"
(or: "default" if used the runbook default)

### Iterations
<N>

### M-gate status (final)
| Gate | Pass | Notes |
|---|---|---|
| M1 Code-native | ✓/✗ | <evidence> |
... (all 10) ...

### Bugs found this session
- Bug #N: <title> (severity) — patched | deferred | open
... (all bugs) ...

### Confidence assessment
<0-100>%
Reasoning: <why this number>

### Recommended next step
<one of: "ship — real Claude Code test", "another self-rehearsal round (stop hit), "hold — needs user decision on bug X", ...>
```

Save this report to `.argus/rehearsals/YYYY-MM-DD-rehearsal-<n>.md` (create dir if absent).

---

## Critical reminders before you start

1. **You're a fresh session**. You don't have memory of prior simulations. Read pre-flight thoroughly.
2. **Dry-run, not live run**. Re-read Hard Rules above.
3. **ultrathink**. Don't shortcut M-gate checks.
4. **Patches need user approval**. Always.
5. **Stop conditions exist for a reason**. Don't infinite-loop "improving."
6. **Simulation can't catch runtime bugs** (Task tool binding, schema $ref resolution, install paths). Final report should note this honestly.

---

## Optional: deeper-than-default test cases

If user wants to stress-test specific code paths, use these alternate test cases:

- **Tests `explicit_target` mode + critical stakes + debate**: 
  > `/argus:sail PR 42 이대로 머지해도 되나?` where PR is a database migration adding NOT NULL to a 50M-row column. (Prose target — also exercises v2.4 natural-language detection; `@PR#42` is the equivalent explicit override.)

- **Tests Step 3.5 reconciliation (5+ steps)**: 
  > "Boss simulator를 Argus에서 분리해 독립 제품으로 만들까?"

- **Tests boss demands routing (Bug #20 patch)**:
  > Anything where ESTJ/INTJ boss likely demands new investigation. e.g., "팀 전체를 Linear에서 Height로 마이그레이션할까?" — likely demands "팀 분위기 어때?" question (boss_questions_pending).

- **Tests hypothetical mode**:
  > Run from a directory that's NOT a git repo. e.g., `/tmp/empty-dir`. Test case: any prose problem.

---

End of runbook. Begin pre-flight reading now.
