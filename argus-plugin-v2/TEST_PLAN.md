# Plugin v2 Reality Check — Test Plan

**Why this exists.** Build did 4 simulation rounds (85%→92% confidence) where the
model audited itself. Devils-advocate identified that all "validation" was
AI-imagining-AI. Real users haven't seen any output. This plan replaces simulation
with **actual runs** + structured observation, targeting the 5 critiques that
matter most: #1 (worker/critic fiction), #2 (contradiction preservation),
#3 (agent voice differentiation), #5 (commodity perception), #7 (self-audit
blind spot).

---

## Setup (one-time)

```bash
# From repo root
./argus-plugin-v2/install.sh --link
```

Restart Claude Code. Verify:

```bash
ls ~/.claude/skills/sail/SKILL.md       # → file exists
ls ~/.claude/agents/donghyuk.md          # → file exists
ls ~/.claude/argus-data/schemas/      # → 8 .json files
```

---

## How to use this plan

**Mode A (manual)** — read each TC, run `/argus:sail` in CC, watch output, fill
in the rubric below by hand.

**Mode B (assistant-driven)** — open a fresh CC session in this repo, paste:
> Read `argus-plugin-v2/TEST_PLAN.md` and execute it. Run all 4 test cases
> via `/argus:sail`, then write your findings to
> `.argus/test-observations.md` using the format at the bottom of this file.
> Be honest — if a critique manifests, mark FAIL. Do not soften.

Mode B is faster but make sure the session running this plan does NOT also have
the plugin-build context loaded, or its judgment will be polluted.

---

## Test cases

Each TC is one `/argus:sail` invocation. Run them in order.

### TC1 — Low stakes (routine label)

```
/argus:sail "워크스페이스 탭 이름을 '워크스페이스'에서 '작업실'로 바꿀까?"
```

**Why**: routine UX label decision. plugin should NOT mobilize debate or critical
machinery. Should produce a useful answer in <30 sec read-time.

**Watch for**: clarify ceremoniousness, agent count (should be ≤2), whether
output tells you what to do or hedges with abstract trade-offs.

---

### TC2 — Important (typical product decision)

```
/argus:sail "webapp Boss feature를 그대로 둘까, plugin v2가 흡수할까?"
```

**Why**: typical product call, the sweet-spot stakes plugin claims to serve.

**Watch for**: agent voice differentiation (TC2 deploys multiple agents — paste
3 of their outputs blind, can you tell who is who?); whether stage-2 outputs
read as worker-mode or critic-mode; whether `team_contradictions[]` is empty
or genuinely useful.

---

### TC3 — Critical (debate trigger)

```
/argus:sail "plugin v2를 폐기하고 judgment-harness positioning을 버리는 게 옳은가?"
```

**Why**: high-stakes question about the plugin itself. Tests whether
`debate.json` fires (it should — `stakes: critical` triggers Step 7) and
whether contradictions are preserved or papered over.

**Watch for**: does `debate.json` exist in `versions/v0.1/`? Read it — are the
opposing positions genuine or manufactured? Does the FinalScaffold preserve the
disagreement or quietly resolve it?

---

### TC-meta — Plugin judging plugin

```
/argus:sail "기능이 너무 많은가? 4R + plugin v2 + 17 agents + 16 MBTI boss + 7 schema"
```

**Why**: the most honest stress test. If plugin can't honestly judge its own
bloat, it can't honestly judge anything else. Watch whether the output is
self-serving or willing to recommend cuts.

**Watch for**: does any agent recommend killing parts of the plugin? Or does
the team rationalize all features as load-bearing? Self-serving output is the
clearest sign #7 (self-audit blind spot) is real.

---

## Observation rubric

For each TC, mark each critique as **PASS / PARTIAL / FAIL** with one-line
evidence.

### #1 Worker / critic separation
- PASS: each agent's stage-2 output reads as own work that builds on what's
  visible. No "I disagree with X" or "X's analysis missed Y" phrasing.
- FAIL: agents review or critique each other's output. Stage 2 reads like
  panel-of-personas, not workers.

### #2 Contradiction preservation
- PASS: `team_contradictions[]` non-empty when relevant; entries are genuine
  disagreements you'd actually use to decide.
- PARTIAL: empty when it should be empty (low stakes), populated when it
  should be (high stakes).
- FAIL: empty in TC3 critical-stakes case, OR full of manufactured tension
  to fill the field.

### #3 Agent voice differentiation
Blind test: copy 3 agent outputs from any TC into a scratch buffer with names
removed. Can you guess which agent is which?
- PASS: ≥2 of 3 correct from voice/rhythm alone.
- FAIL: indistinguishable. Voices are theatrical decoration, not differentiation.

### #5 Commodity perception (first-impression test)
Show the rendered FinalScaffold to yourself with fresh eyes. First reaction in
≤3 seconds:
- PASS: "this is structured differently from a Cursor review."
- FAIL: "this is a markdown review doc with extra fields."

### #7 Use intent
Would you actually use the output to act on the decision?
- PASS: yes, you'd commit to next_actions[] or act on a checkpoint.
- FAIL: feels patronizing / over-engineered / you'd ignore it and ask ChatGPT
  for a one-paragraph recommendation.

---

## Output format

Write results to `.argus/test-observations.md`:

```markdown
# Plugin v2 Test Observations — YYYY-MM-DD

## TC1 (low stakes — workspace rename)
**Invocation**: `/argus:sail "..."`
**Final scaffold output (full)**: [paste]

### Critique findings
- #1 worker/critic: PASS — [one-line evidence]
- #2 contradiction: PARTIAL — empty as expected for low stakes
- #3 voice: PASS — [evidence]
- #5 commodity: FAIL — [evidence]
- #7 use intent: PARTIAL — would skim, not act

## TC2 ...
## TC3 ...
## TC-meta ...

## Summary
- Critiques manifested: #5, #7 (clear)
- Critiques refuted: #1 (clean separation in practice)
- Critiques uncertain: #2, #3 (need more runs)
```

---

## What to bring back

When done, the building session needs:

1. The full observations file (don't summarize — paste raw outputs).
2. Your honest one-liner: "the plugin **actually** [solves / fakes / partially
   solves] the judgment-harness claim."

Whichever critiques manifest with FAIL evidence become the next fix priority.
The rest stay as backlog.
