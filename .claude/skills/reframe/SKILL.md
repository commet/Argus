---
name: reframe
description: "Sharpen your question before asking AI. Finds hidden assumptions in your problem and reframes it so you get breakthrough answers instead of generic ones. Use when AI gives predictable answers, when starting a strategic decision, or when something feels off about a problem."
argument-hint: "[problem or question to reframe]"
allowed-tools: Read, Write, AskUserQuestion
---

## When to use

- ✓ Starting a strategic decision — before committing time or resources
- ✓ Building a product — before asking AI to code it
- ✓ AI keeps giving predictable, generic answers to your question
- ✓ Something feels off about the problem but you can't articulate why
- ✗ Tactical questions with obvious answers (just do them)
- ✗ When you already know the real question and just need execution (use /recast)

**Always respond in the same language the user uses.** UI chrome (Argus · Reframe, skill names, symbols) stays English.

## Step 0: Get the problem

**If no argument:** Ask ONLY this — nothing else:

> What problem or decision are you thinking about?

Wait for response. **If argument provided**, proceed immediately.

## Context detection

**Build context** — creating something:
- Signals: build, make, create, app, tool, SaaS, MVP, ship, 만들다, 개발, 앱, 서비스, 플랫폼

**Decide context** (default) — making a decision or plan:
- Signals: decide, strategy, expand, hire, 결정, 전략, 기획, 제안서

**Ambiguous?** Use AskUserQuestion:
- question: "이건 뭘 만드는 건가요, 아니면 판단/기획하는 건가요?"
- header: "컨텍스트"
- options:
  - label: "만드는 것", description: "앱, 서비스, 도구 등"
  - label: "판단/기획", description: "전략, 기획안, 제안서, 결정"

Record as `context: build` or `context: decide`.

## Step 1: Instant First Draft

**Do this IMMEDIATELY. No interview first.**

Analyze the input and produce a first draft:

---

**Argus · Reframe** — 문제 재정의

**상황 정리**: [1-2줄, 사용자가 처한 상황]

**진짜 질문 (초안)**: [리프레이밍. 물어본 것과 실제 해결할 것의 차이. 1-2문장.]

**숨겨진 전제 (초안)**

```diff
- ? [전제 1]
- ? [전제 2]
- ? [전제 3]
```

> 초안이다. 몇 가지만 더 알면 훨씬 날카로워진다.

---

## Step 2: Interview (AskUserQuestion)

**Use the AskUserQuestion tool.** Do NOT present questions as code blocks.

### Decide context:

**Q1:**
- question: "이 과제의 성격은?"
- header: "성격"
- options:
  - label: "방법이 명확함", description: "이미 알고 있고 실행만 하면 되는 상황"
  - label: "분석 필요", description: "정답은 있지만 아직 파악 안 된 상황"
  - label: "답이 불분명", description: "탐색하면서 배워야 하는 상황"
  - label: "긴급 대응", description: "지금 당장 행동해야 하는 상황"

Maps to `nature`: known_path / needs_analysis / no_answer / on_fire

**Q2:**
- question: "가장 걱정되는 건?"
- header: "핵심 걱정"
- options:
  - label: "방향 자체가 안 잡힘", description: "뭘 해야 할지 모르겠음"
  - label: "구조화가 안 됨", description: "내용은 있는데 정리가 안 됨"
  - label: "설득력 부족", description: "논리나 근거가 약할 것 같음"
  - label: "이해관계자 설득", description: "반대하는 사람을 넘어야 함"

Maps to `concern`: direction / structure / persuasion / stakeholders

### Build context:

**Q1:**
- question: "누가 쓸 건가요?"
- header: "사용자"
- options:
  - label: "나만 쓸 것", description: "개인 도구나 프로젝트"
  - label: "특정 그룹", description: "정해진 사용자층"
  - label: "누구나", description: "대중 대상"
  - label: "아직 모름", description: "사용자 불명확"

Maps to `audience`: personal / niche / mass / unknown

**Q2:**
- question: "성공이 뭔가요?"
- header: "성공 기준"
- options:
  - label: "사람들이 쓴다", description: "실제 사용자 확보"
  - label: "아이디어 검증", description: "가설이 맞는지 확인"
  - label: "돈을 번다", description: "매출/수익 발생"
  - label: "배움/포트폴리오", description: "실력 향상이 목적"

Maps to `success_model`: users / validation / revenue / learning

## Step 3: Assumption Discovery + Evaluation

After interview, analyze the problem using interview signals to find 3-4 hidden assumptions.

### Decide context dimensions:
- **Value**: Is this actually valuable to someone?
- **Feasibility**: Can this realistically be done?
- **Viability**: Does the economics work?
- **Capacity**: Can the team/org handle this?

### Build context dimensions (3, not 4 — lighter):
- **Value**: Does someone want this enough to switch?
- **Differentiation**: Why not use [specific existing tool]?
- **Feasibility**: Can this be built in this timeframe?

### Interview signals shape assumptions:
- nature=no_answer → existential assumptions ("this problem actually exists")
- nature=needs_analysis → methodological ("the right approach is X")
- nature=on_fire → causal ("the root cause is X")
- concern=direction → value assumptions ("we know what success looks like")
- concern=stakeholders → priority assumptions ("stakeholder A's goal matters more")

### Evaluation

Present assumptions for evaluation using AskUserQuestion. Bundle all assumptions into ONE call:

- question: "이 전제들을 어떻게 평가하세요?"
- header: "전제 평가"
- For each assumption, present as a separate question within the same AskUserQuestion call (up to 4 questions per call):
  - question: "[assumption text]"
  - header: "전제 [N]"
  - options:
    - label: "맞다 ✓", description: "확신함"
    - label: "불확실 ?", description: "모르겠음"
    - label: "의심 ✗", description: "틀릴 가능성 높음"

If user selects "Other", capture their reasoning — extremely valuable.

## Step 4: Reframing

Two things determine the approach: **evaluation pattern** + **interview signals**.

### Evaluation patterns:

**CONFIRMED** (0 doubtful, 0 uncertain): Direction validated. Sharpen execution.
**MIXED** (some of both): Direction stands. Integrate doubtful items as CONDITIONS.
- CRITICAL: Do NOT flip direction based on one doubtful assumption. Confirmed ones support direction — respect that.
**CHALLENGED** (≥50% doubtful): Premises broken. Question whether this should be done.

### Reframing strategies:

**Decide:**
- on_fire → **Diagnose Root Cause** (separate immediate from structural)
- no_answer + mostly doubtful → **Challenge Existence** (maybe don't do this)
- needs_analysis + mostly confident → **Narrow Scope** (smallest experiment)
- concern=stakeholders → **Redirect Angle** (different stakeholder's eyes)
- Otherwise → **Redirect Angle**

**Build:**
- CONFIRMED → **Sharpen Wedge** — specify exact MVP and first user
- MIXED → **Narrow Scope** — maintain direction, add constraint from doubtful
- CHALLENGED → **Validate First** — reframe toward validation, not building

### Mental checklist before reframing:
1. What does the assigner REALLY want? (surface goal ≠ actual goal)
2. What happens if we do nothing for 6 months?
3. What is this deliberately NOT addressing?
4. Is this technical, organizational, political, or timing?

## Step 4 Output

---

**Argus · Reframe** — 문제 재정의

**물어본 것:** "[original]"

**진짜 질문:**
[reframed question]

[왜 이게 더 날카로운지 — 1-2문장]

---

**전제**

```diff
+ ✓ [confirmed assumption]
- ? [uncertain assumption]
- ✗ [doubtful assumption]
```

---

**확인할 것**

1. [question] — [reason]
2. [question] — [reason]
3. [question] — [reason]

---

> 💡 [blind spot — uncomfortable insight, 1-2 sentences. Specific to THIS problem.]

`Next? 1 /recast · 2 edit · 3 save`

---

### Blind spot rules:
- Specific to THIS problem, not generic
- Uncomfortable — if user nods "yeah I knew that," you failed
- Captures the DELTA: "You were thinking about X, but the real issue is Y"
- Good: "This isn't a tech project — it's an organizational change project."
- Bad: "There are risks." / "It's a complex problem."

### Quick actions:
- `1` → save + launch /recast
- `2` → show editable items (reframed question, assumption ratings)
- `3` → save and stop
- Anything else → respond naturally

## Rendering rules

- Markdown first. Bold, blockquote, list, diff blocks.
- **No box drawing.** No `╭╮╰╯`, `┌│└`. Use `---`, `**bold**`, whitespace.
- **No fixed width.** Markdown auto-wraps.
- **diff = color tool.** `+` = confirmed (green). `-` = risk/uncertain (red). Max 3 per output.
- No academic citations in output.
- No generic praise. No "Great question!" Go straight to work.

## Auto-save

Save to `.argus/reframe.md`:

```markdown
# Reframe

**물어본 것:** [original]
**진짜 질문:** [reframed]

## 전제
- [symbol] [assumption] — [user reason if given]

## 확인할 것
- [question]

> 💡 [blind spot]

---

## Context Contract
context: [build|decide]
reframed_question: [question]
assumption_pattern: [confirmed|mixed|mostly_doubtful]
strategy: [strategy name]
interview_signals: [nature/goal or audience/success_model]
assumptions_doubtful:
  - [assumption] | reason: [reason]
assumptions_uncertain:
  - [assumption] | reason: [reason]
assumptions_confirmed:
  - [assumption]
ai_limitations:
  - [limitation]
```

## Journal

Append to `.argus/journal.md`:

```
## [date] /reframe — [topic, ≤5 words]
- Context: [build|decide]
- Original: "[original]"
- Reframed: "[new question]"
- Interview: [signals]
- Pattern: [confirmed|mixed|mostly_doubtful]
- Strategy: [strategy name]
- Assumptions: [N] confirmed, [N] uncertain, [N] doubtful
  - ✗/? [each doubtful/uncertain — 1 line, max 4]
- Blind spot: "[insight]"
- Pipeline: reframe ✓ → recast · rehearse · refine
```

## Returning users

Check `.argus/journal.md` at start. If exists, read last 10 entries.

**Recurring blind spot** (same area 2+ times): Force-add one assumption about that area.
**Strategy repetition** (same 3+ times): Note it. Not a blocker.
**Topic overlap**: Show: `💭 관련 이전 분석: [date] "[topic]" — 블라인드 스팟: "[insight]"`
