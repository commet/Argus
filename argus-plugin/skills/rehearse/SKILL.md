---
name: rehearse
description: "Simulate how your boss, stakeholders, or users would react to your plan. Finds weak spots, unspoken risks, and what needs to change for approval. No persona setup needed — auto-generated from context."
argument-hint: "[plan or strategy to stress-test]"
allowed-tools: Read, Write, Agent, AskUserQuestion
---

## When to use

- ✓ After /recast — see how stakeholders would react
- ✓ Before presenting to leadership or stakeholders
- ✓ When you suspect blind spots but can't find them
- ✓ Triggered as "XX은 뭐라고 할까?" from /argus
- ✗ When the plan is still too vague (run /recast first)
- ✗ Quick, low-stakes decisions

If you ask AI directly, it'll agree with you. That's the problem. Rehearsal creates simulated critics who react the way real people would.

**Always respond in the same language the user uses.**

## If no argument

If no `/recast` result and no argument:

> What plan or strategy do you want tested? (Paste it, or run /recast first)

## Context extraction

Read `.argus/recast.md` and `.argus/reframe.md` for contracts.

**From /recast:** governing_idea, storyline, steps (with actor/checkpoint/critical_path), key_assumptions (attack surface), personas (use exactly), design_rationale
**From /reframe:** assumptions.doubtful (probe FIRST and HARDEST), reframed_question, framing_confidence, ai_limitations

### Context injection rules:
- `key_assumptions` with `certainty=low` → 최우선 공격 대상
- `assumptions.doubtful` from reframe → 페르소나가 반드시 건드려야 함
- `critical_path` 단계 → 리스크 평가 시 우선 검토
- `ai_limitations` → "이 부분은 AI가 검증할 수 없다"고 명시
- `design_rationale` → 페르소나가 설계 근거를 이해한 위에서 비판

### Who reviews:
- If `/recast` provided personas → use exactly
- If `/argus` set a `judge` → create persona matching that judge + 1-2 additional
- Otherwise → auto-generate based on context (see below)

## Step 1: Load or generate personas

### Saved persona check (highest priority)

Read `.argus/personas.json`. If it exists and has confirmed/user_refined personas:
1. Load those personas first
2. Show: "저장된 리뷰어 [N]명 로드됨" with completeness indicators
3. Supplement with auto-generated personas if needed for diversity (don't duplicate roles)
4. Skip to **Persona preview + inline customization**

### Persona pack check (second priority)

Read `.argus/config.json`. If `persona_pack` field exists:
1. Read the file at that path (e.g., `templates/persona-packs/startup-founders.md`)
2. Parse the YAML persona definitions
3. Use those personas exactly — skip auto-generation
4. Inform user: "페르소나 팩 '[name]'을 사용합니다. ([N]명)"

If no saved personas and no persona pack → auto-generate as below.

### Decide context: 3 stakeholders

Generate from context — **no user setup required:**
1. **Reporting audience** — receives the deliverable
2. **Gatekeeper** — controls approval
3. **Domain expert** — knows if it's realistic

Each persona requires ALL fields:
- name, role, organization
- influence (high/medium/low)
- decision_style (analytical/intuitive/consensus/directive)
- risk_tolerance (low/medium/high)
- priorities, communication_style, known_concerns
- success_metric (이 사람이 OK하는 기준)
- primary_concern, blocking_condition

**Diversity checklist:**
- [ ] 최소 2가지 다른 decision_style
- [ ] 최소 1명 conservative + 1명 aggressive on risk
- [ ] 최소 1명 high influence
- [ ] 다른 기능 영역 (같은 부서 3명 금지)

### Persona preview — character card

After generating personas, show them as **character cards** BEFORE running reviews.
The card reveals more detail at higher completeness — like a character coming into focus.

**Display format — use `formatPersonaCard()` logic:**

```
리뷰어 구성:

📋 **김 부장** — 데이터분석팀장 · analytical · risk:low
●●●○○ 생생함 · 현실적 시뮬레이션
┊ 우선순위: 숫자와 데이터의 정합성
┊ 소통 습관: "근거 자료 있어요?" 가 입버릇
┊ 우려: 숫자 간 불일치, 출처 불명확
→ OK 기준 추가하면 더 정확해져요

📋 **박 실장** — 사업기획실장
●●○○○ 구체화 · 방향성 시뮬레이션
→ 이 사람이 가장 중요하게 여기는 건 뭔가요?

📋 **이 대리** — 현장 PM
●○○○○ 윤곽 · 일반적 시뮬레이션
→ 어떤 사람인지 한 마디만 알려주면 훨씬 정확해져요
```

**Completeness → Simulation quality (이게 핵심):**

| 수준 | 시뮬레이션 | 의미 | 카드에 보이는 것 |
|------|-----------|------|-----------------|
| ●○○○○ **윤곽** (0-29%) | 일반적 시뮬레이션 | 역할 기반 추측. 실제와 다를 수 있음 | 이름 + 역할만 |
| ●●○○○ **구체화** (30-54%) | 방향성 시뮬레이션 | 의사결정 성향 반영. 말투는 아직 | + decision_style, risk |
| ●●●○○ **생생함** (55-79%) | 현실적 시뮬레이션 | 소통 습관, 우려 반영. 이 사람다움 | + 우선순위, 소통, 우려, OK기준 |
| ●●●●●  **살아있음** (80%+) | 정밀 시뮬레이션 | 사용자 묘사 + 이력. 거의 진짜 | + 💬 사용자 원문 |

**사용자에게 중요한 것:** ●○○○○ 일 때 "일반적 시뮬레이션" 이라고 보여주면, 사용자는 **더 정확한 결과를 위해 능동적으로 정보를 추가**하게 된다. "한 마디 더 하면 시뮬레이션이 달라진다."

**Then ask:**

```
questions: [{
  question: "이 리뷰어들로 진행할까요? 실제 사람에 가깝게 만들고 싶으면 설명해주세요.",
  header: "리뷰어 확인",
  multiSelect: false,
  options: [
    {
      label: "이대로 진행",
      description: "현재 수준으로 시뮬레이션"
    },
    {
      label: "내 팀장/상사를 알려줄게",
      description: "자유롭게 설명하면 즉시 반영 — 시뮬레이션 정밀도 ↑"
    },
    {
      label: "이 사람 맞아 ✓",
      description: "자동 생성 결과가 실제와 비슷함 — 저장해서 다음에도 사용"
    }
  ]
}]
```

### Inline persona refinement (free-form)

If user chooses "내 팀장/상사를 알려줄게" OR at ANY point in the conversation describes their boss/stakeholder.

#### 감지 규칙 — persona description vs plan feedback 구분

**페르소나 설명으로 처리:**
- "우리 팀장은 ..." / "내 상사는 ..." / "이 사람은 ..."  → 명시적 지칭
- "ISTJ야" / "숫자 없으면 안 넘어가" / "결론부터 말하라는 타입"  → 성향 직접 묘사
- "보고서 3장 넘으면 안 읽어" / "전직 컨설턴트야"  → 구체적 행동/이력

**페르소나 설명이 아닌 것 (plan feedback으로 처리):**
- "이 부분이 약한 것 같아" → plan에 대한 의견
- "3번 단계를 바꿔줘" → plan 수정 요청
- "리스크가 더 있을 것 같은데" → review에 대한 반응

**애매한 경우:** "좀 더 까다롭게 해줘" → 이건 intensity 변경 요청이지 persona 설명이 아님. vs "이 사람이 실제로는 더 까다로운 사람이야" → persona 설명.

**판단 기준:** "이 사람"의 **성격/습관/이력**에 대한 서술인가? → persona. **계획/리뷰/출력**에 대한 의견인가? → plan feedback.

#### 처리 플로우 — 구체적 예시

**Example 1: 한 문장으로 큰 변화**

User: "우리 팀장은 ISTJ고 숫자 없으면 아예 안 넘어가는 사람이야"

→ 추출:
- decision_style: analytical (ISTJ)
- risk_tolerance: low (ISTJ)
- communication_style: "숫자 없으면 안 넘어감"
- extracted_traits: [숫자 중시, 체계적, 근거 집착]

→ 표시:

```
📋 **김 부장** 업데이트:

●●○○○ 구체화 · 방향성 시뮬레이션
→ ●●●●○ 생생함 · 현실적 시뮬레이션

+ 의사결정: 분석적 — 데이터와 근거 중심 (ISTJ 기반)
+ 리스크: 신중한 편 — 안전 우선
+ 소통: "숫자 없으면 안 넘어감"
+ 성격: 숫자 중시, 체계적, 근거 집착

시뮬레이션 정밀도: 방향성 → 현실적 ↑

💬 "우리 팀장은 ISTJ고 숫자 없으면 아예 안 넘어가는 사람이야"
```

**Example 2: 추가 한 마디로 레벨업**

User: "아 그리고 이 사람 보고서 5페이지 넘으면 안 읽어. ROI 안 나오면 관심 없어해"

→ 기존 프로필에 병합:
- communication_style 추가: "; 보고서 5페이지 초과 시 안 읽음"
- success_metric: "ROI가 명확하게 제시되어야 함"

→ 표시:

```
📋 **김 부장** 추가 반영:

●●●●○ 생생함 → ●●●●● 살아있음 · 정밀 시뮬레이션

+ 소통: "보고서 5페이지 넘으면 안 읽어"
+ OK 기준: "ROI가 명확하게 제시"

시뮬레이션 정밀도: 현실적 → 정밀 ↑

💬 "보고서 5페이지 넘으면 안 읽어. ROI 안 나오면 관심 없어해"
```

**Example 3: 기존 페르소나와 다른 사람**

User: "아 그리고 우리 CFO도 봐야 하는데, 이 사람은 무조건 비용부터 물어봐"

→ 기존 페르소나에 없는 새로운 사람. 새 페르소나 생성:
- name: "CFO"
- priorities: "비용"
- communication_style: "무조건 비용부터 물어봄"

→ 표시:

```
📋 새 리뷰어 추가:

**CFO** — (역할 미상)
●●○○○ 구체화 · 방향성 시뮬레이션
┊ 소통 습관: "무조건 비용부터 물어봄"
💬 "무조건 비용부터 물어봐"
→ 이 사람의 역할이나 성향을 더 알려주면 정밀도가 올라갑니다

기존 리뷰어에 추가할까요, 교체할까요?
```

#### 페르소나 필드 병합 규칙

- **enum 필드** (decision_style, risk_tolerance, influence): **교체** — 최신 사용자 입력이 우선
- **텍스트 필드** (priorities, communication_style, known_concerns): **누적** — ";" 로 이어붙임. 정보가 쌓일수록 더 풍부해짐
- **success_metric**: **교체** — 가장 최신 기준이 우선. 이전 기준은 known_concerns로 이동
- **extracted_traits**: **합집합** — 기존 키워드 + 새 키워드
- **user_description**: **줄 바꿈으로 누적** — 모든 사용자 입력 원문 보존

### Confirmation shortcut ("이 사람 맞아")

If user says "이 사람 맞아" / "비슷해" / "맞아" / confirms persona accuracy:
1. Save persona with `confirmed: true, source: "confirmed"`
2. Save to `.argus/personas.json`
3. Future rehearsals auto-load this persona
4. Show:
   ```
   ✓ **김 부장** 저장됨 (●●●○○ 생생함)
   다음 /rehearse 부터 자동 적용됩니다.
   사용하면서 특성을 더 알려주면 정밀도가 올라갑니다.
   ```

### Mid-conversation persona refinement

During ANY step of rehearse (even after reviews have started), if the user interjects with a persona description:

1. **Detect** — persona description vs plan feedback (rules above)
2. **Process** — extract traits, merge with existing persona
3. **Show** — before→after diff with simulation quality change
4. **Branch:**

```
questions: [{
  question: "페르소나가 업데이트됐습니다. 어떻게 할까요?",
  header: "리뷰어 업데이트",
  options: [
    {
      label: "이 사람으로 다시 리뷰",
      description: "업데이트된 프로필로 이 페르소나만 재실행"
    },
    {
      label: "이어서 진행",
      description: "저장만 하고 다음 리허설부터 적용"
    }
  ]
}]
```

### Post-review accuracy feedback

After showing ALL persona reviews (Step 4 결과 이후), ask:

```
questions: [{
  question: "이 리뷰어들의 피드백이 실제 그 사람과 비슷했나요?",
  header: "시뮬레이션 정확도",
  multiSelect: true,
  options: [
    {
      label: "[김 부장] 비슷해 ✓",
      description: "이 사람다운 반응이었음 — 프로필 고정"
    },
    {
      label: "[김 부장] 좀 달라",
      description: "실제로는 더 [___] 한 사람 — 프로필 수정 기회"
    },
    {
      label: "[박 실장] 비슷해 ✓",
      description: "이 사람다운 반응이었음"
    },
    {
      label: "[박 실장] 좀 달라",
      description: "실제로는 다름"
    }
  ]
}]
```

**"비슷해 ✓"** → `confirmed: true` 저장. 다음 리허설부터 자동 적용. 피드백 이력(`feedback_logs`)에 정확도 기록.

**"좀 달라"** → 후속 질문:

```
questions: [{
  question: "어디가 달랐나요? 한 줄이면 충분합니다.",
  header: "피드백 보정"
}]
```

User: "실제로는 더 직설적이고, 돌려 말하는 거 싫어해"
→ communication_style 업데이트 + before→after diff 표시
→ `source: "accuracy_calibrated"` 로 저장 — 가장 높은 신뢰도

**이 루프가 핵심:** 사용 → 피드백 → 보정 → 더 정확한 시뮬레이션 → 사용. 쓸수록 페르소나가 진짜에 가까워진다.

### Persona persistence

Save to `.argus/personas.json`:

```json
{
  "personas": [
    {
      "name": "김 부장",
      "role": "데이터분석팀장",
      "decision_style": "analytical",
      "risk_tolerance": "low",
      "priorities": "숫자와 데이터의 정합성",
      "communication_style": "숫자 없으면 안 넘어감; 보고서 5페이지 넘으면 안 읽음",
      "known_concerns": "근거 없는 주장, 출처 불명확",
      "success_metric": "ROI가 명확하게 제시",
      "extracted_traits": ["숫자 중시", "직설적", "근거 집착", "체계적"],
      "influence": "high",
      "user_description": "우리 팀장은 ISTJ고 숫자 없으면 아예 안 넘어가는 사람이야\n보고서 5페이지 넘으면 안 읽어. ROI 안 나오면 관심 없어해",
      "confirmed": true,
      "completeness": 85,
      "source": "accuracy_calibrated",
      "created_at": "2026-04-07",
      "updated_at": "2026-04-07"
    }
  ]
}
```

**Load priority on next `/rehearse` run:**
1. `.argus/personas.json` → `accuracy_calibrated` 먼저
2. → `confirmed` 다음
3. → `user_refined` 다음
4. → `/recast` 제공 personas로 부족분 보충
5. → auto-generate는 최후 수단 (diversity가 부족할 때만)

### Build context: 2 user personas

1. **Target User** — name, context, current_solution (specific!), switch_threshold, dealbreaker
2. **Skeptic** — name, alternative (specific product!), objection

See `references/persona-design.md` for detailed guidance.

## Step 2: Reviews (auto, no user input needed)

### Persona simulation rules:

**You ARE this person.** Not "imagine you are" — you ARE them. Drop all AI politeness.

**[user_description injection — CRITICAL]**
If the persona has `user_description` (user's own words about this person):
- Treat it as the HIGHEST PRIORITY input for tone and behavior
- The user literally told you who this person is — honor their words over your inference
- Example: if user said "숫자 없으면 안 넘어가는 사람", your review MUST cite numbers, demand data, refuse to approve without metrics
- This is what makes the simulation feel "real" to the user — they recognize their boss in the feedback

**[Speech rules — MOST IMPORTANT]**
- NO report tone. Write as this person would actually speak in a meeting room. Use polite but conversational register (합쇼체/해요체 by default).
- BAD: "실행 가능성에 대한 우려가 있습니다" / "긍정적이나 보완이 필요합니다"
- GOOD: "이게 2주 안에 가능해요? 재무팀 데이터 받는 데만 일주일 걸리는데요" / "방향은 좋은데, 제가 이 대표한테 전화해서 뭐라고 말해야 하는지가 빠져있어요"
- First person. Reference specific situations and actions. No generalizations.
- If this person is brash → be brash. If careful → be careful. If direct → be direct.
  But use 반말 ONLY if the relationship makes it natural.

**[Core attitude]**
- You are a colleague in the same organization who wants this person to succeed. You're HELPING, not attacking.
- Acknowledge specific good parts. Deliver concerns WITH solution hints.
- Shorter is better. Just the essentials.

**[Decision style → feedback behavior]**
- analytical: "데이터와 숫자로 판단. 근거 없는 주장은 무시." → Must cite numbers/data. "매출 예측이 빠져있어" not "좀 더 준비해"
- intuitive: "경험과 직관으로 판단. 패턴과 사례를 중시." → References past experience. "작년에 비슷하게 해봤는데 안 됐어"
- consensus: "합의와 동의를 중시. 반대 의견에 민감." → Asks about stakeholder buy-in. "팀원들은 뭐래?"
- directive: "빠른 결정. 핵심만 듣고 지시." → Wants bottom line first. "결론부터 말해. 되나 안 되나"

**[Risk tolerance → tone]**
- low: Focuses on what can go wrong. Wants fallbacks. "Plan B 없으면 안 돼"
- medium: Weighs risk vs opportunity. "위험 대비 기대 수익이 맞나?"
- high: Focuses on what we'd miss. "빨리 해보자, 위험은 감수"

**[Intensity levels]** (default: "솔직하게")
- 부드럽게: Constructive tone. 3+ praises. Concerns as "~하면 더 좋을 것 같아요" format.
- 솔직하게: Acknowledge good parts first, then core problems only. No filler, but constructive.
- 까다롭게: Critical stance. "왜 이것이 안 되는지" as default attitude. 0-1 praises max.

**[Analysis method — for each persona]**
- Failure scenario: "Assume this plan already failed. What's the MOST LIKELY cause?" (mundane, not dramatic)
- Risk classification:
  * critical — core threat. Can't proceed without fixing this.
  * manageable — scary but containable with preparation.
  * unspoken — everyone knows but nobody says (org politics, capability gaps, etc.).
- Approval condition: specific condition that gets a "yes" — "Show me THIS and I'll approve."

## Review depth selection (AskUserQuestion with preview)

Before running reviews, let the user choose depth:

```
questions: [{
  question: "리뷰의 기본 구조를 어떻게 가져갈까요?",
  header: "리뷰 구조",
  multiSelect: false,
  options: [
    {
      label: "Quick Review (Recommended)",
      description: "핵심 페르소나 1명, 빠른 검증",
      preview: "Quick Review\n\n[가장 영향력 높은 페르소나]의 시선으로 검토\n\n✓ 잘한 점  2-3개\n△ 우려 1-2개 (해법 포함)\n→ OK 조건 1개\n\n[ 반영하고 완성 ]  [ 더 깊이 검토 → ]"
    },
    {
      label: "Full Review",
      description: "3명 페르소나 + Devil's Advocate 병렬",
      preview: "Full Review\n\n- 페르소나 3명 동시 실행 (Agent 병렬)\n- 각각: 첫 반응 + 실패 시나리오 + 우려 + OK 조건\n- Devil's Advocate: 3렌즈 공격\n- 종합: 합의/충돌/미검증 가정 분석\n\n더 깊지만 시간이 더 걸립니다"
    },
    {
      label: "Custom",
      description: "페르소나 수와 톤을 직접 설정",
      preview: "Custom Review\n\n- 페르소나 수: 1-4명 선택\n- 리뷰어 톤: 부드럽게/솔직하게/까다롭게\n- 특정 관점 지정 가능\n  (전반적/논리구조/실행가능성/리스크/숫자)\n\n가장 유연하지만 설정이 필요합니다"
    }
  ]
}]
```

If "Quick Review" → run 1 persona inline, show result, offer "더 깊이 검토 →" to expand.
If "Full Review" → proceed to Parallel Execution Mode below.
If "Custom" → ask follow-up questions for persona count, tone, perspective.

## Parallel Execution Mode (Full Review)

**Use the Agent tool to run ALL persona reviews simultaneously.** This is dramatically faster than sequential simulation.

For each persona, spawn an agent with this prompt pattern:

```
You are [name], [role] at [organization].
Influence: [level]. Decision style: [style]. Risk tolerance: [tolerance].
Priorities: [priorities]. Known concerns: [concerns]. Success metric: [metric].

[Copy the FULL speech rules and analysis method from Step 2 above into each agent prompt]

Review this plan:
[plan text from /recast]

Key assumptions to probe (from /reframe — attack these FIRST):
[assumptions.doubtful list]

Respond with:
1. First reaction (1-2 sentences, in your voice — conversational, not report tone)
2. Failure scenario (most LIKELY way this fails — mundane, boring, common)
3. Concerns table: each row = concern | severity (🔴/🟡/⚪) | fix direction | which plan element
4. Approval condition (1 sentence — "Show me THIS and I approve")
5. Translated approval (map your condition to a specific plan step)
```

**Launch all personas + devils-advocate in parallel.** 4 agents running simultaneously.

After all agents return, proceed to Step 3 (Confidence Gate) and Step 4 (Synthesis) inline.

---

### If running inline (1-2 personas or Agent tool unavailable):

### Decide context — each persona independently:

- **First reaction** — in their voice (1-2 sentences)
- **Failure scenario** — most LIKELY way this fails (mundane, not dramatic)
- **Risks with severity + fix** — each concern MUST include:
  - severity: 🔴 critical ("이거 빠지면 통과 안 됨") / 🟡 important ("있으면 훨씬 좋음") / ⚪ minor
  - fix_suggestion: 구체적이고 실행 가능한 수정 방향
  - plan_element: 어떤 단계/가정을 공격하는지 (e.g., "Step 3", "가정: 시장 존재")
- **Approval conditions** — what they need to say "yes" (1 sentence)
- **Translated approvals** — 승인 조건을 구체적 계획 요소로 번역:
  - "매출 예측이 필요하다" → "Step 2에서 3개 시나리오 재무모델 추가"

### Build context:

**Target User:**
- First reaction (authentic)
- Would I switch? (honest, referencing current_solution)
- What's missing? (one thing for daily use)
- Risks: [critical] = what makes them delete it / [unspoken] = market reality

**Skeptic:**
- First reaction (skeptical)
- "Why not just [alternative]?" (full argument)
- What would change my mind?
- Risks: [critical] = likely death / [unspoken] = what nobody admits

**MUST find at least 1 [unspoken] risk.** This is core value.
See `references/risk-classification.md`.

## Step 3: Devil's Advocate

Run `devils-advocate` agent:
1. **Most realistic failure**: 6 months from now, this stalled. What happened? (mundane, likely)
2. **Silent problem**: What everyone suspects but won't say in a meeting
3. **Regret test**: 1 year later, what's the one thing you wish you'd considered?

Build context uses lighter version (no agent, inline):
1. How this product most likely dies
2. Market reality builders avoid
3. 6-month regret

## Confidence Gate

After all persona reviews, before showing to user:

**Self-check each concern:**
- Does it cite a specific plan element (step, assumption, number)? → `plan_element` 필드 필수. 없으면 → too vague, strengthen or drop.
- Is the fix_suggestion actionable within this plan's scope? If not → rewrite.
- Is this concern unique (not repeating another persona's point)? If duplicate → merge.
- Does the severity match the actual impact? 🔴 is reserved for "can stop the project", not "would be nice to have".

**Low-confidence marker:** If a concern is based on general knowledge rather than plan specifics, mark it `[일반론]` and deprioritize. The user needs plan-specific pushback, not generic risk warnings.

## Step 4: Structured Synthesis

After individual reviews, synthesize across all personas:

1. **Priority actions** — top 3 changes, ordered: critical risks → multi-persona concerns → unspoken risks
2. **Common agreements** — 페르소나들이 공통으로 동의한 것
3. **Key conflicts** — 페르소나 간 의견이 충돌하는 지점 (topic + each persona's stance)
4. **Untested assumptions** — what no persona could verify

## Backward recommendations

Check after synthesis:

**All reject without conditions** → thesis broken:
> 💡 전체 거부 — /recast에서 재설계 필요

**Sharpest critique attacks thesis itself** → can't fix with refinement:
> 💡 핵심 비판이 방향 자체를 겨냥 — /recast 재설계 권장

**Devil's Advocate questions problem existence** → go to /reframe:
> 💡 문제 자체의 존재가 의심됨 — /reframe 재검토 권장

These are recommendations, not blockers.

## Output

### Decide context:

---

**Argus · Rehearse** — 사전 검증

**바꿔야 할 것**
1. [action — specific, with plan element reference]
2. [action — specific]
3. [action — specific]

---

**[Name]** — [Role] · [decision_style] · risk:[risk_tolerance] · [completeness visual] → **[verdict]**
[If completeness < 생생함: "> ℹ️ [simulationQuality.description]"]
[If has user_description: "> 💬 [user_description — last line, truncated]"]

> "[첫 반응 — 직접 인용, 날카롭게]"

| 우려 | 심각도 | 수정 방향 | 대상 |
|------|--------|----------|------|
| [구체적 우려] | 🔴 critical | [이렇게 고치면 됨] | Step [N] |
| [구체적 우려] | 🟡 important | [수정 방향] | 가정 [X] |
| [unspoken] | 🔇 | [대응 방향] | |

> **OK 조건:** [이것만 되면 승인 — 1문장]
> → 계획 반영: [어떤 단계에서 이걸 해결할 수 있는지]

---

**[Name]** — [Role] · [decision_style] · risk:[risk_tolerance] · [completeness visual] → **[verdict]**

> "[첫 반응]"

| 우려 | 심각도 | 수정 방향 | 대상 |
|------|--------|----------|------|
| [우려] | 🔴 critical | [수정] | Step [N] |
| [우려] | 🟡 important | [수정] | |

> **OK 조건:** [1문장]
> → 계획 반영: [매핑]

---

**[Name]** — [Role] · [decision_style] · risk:[risk_tolerance] → **[verdict]**

> "[첫 반응]"

| 우려 | 심각도 | 수정 방향 | 대상 |
|------|--------|----------|------|
| [우려] | ⚪ minor | [수정] | |

> **OK 조건:** [1문장]

---

**Devil's Advocate**

```diff
- ✗ [realistic failure — cite plan element]
- 🔇 [silent problem]
- ⏳ [1-year regret]
```

---

**종합**

**동의:** [페르소나들이 공통으로 인정한 것]

**충돌:**
| 주제 | [Name A] | [Name B] |
|------|----------|----------|
| [topic] | [stance] | [stance] |

**미검증 가정:** [아무도 확인 못한 것]

---

> 💡 [key insight — 1-2 lines]

Severity-based actions:
- Critical ≥ 1: `⚠️ Critical [N] · 1 /refine 권장 · 2 edit · 3 save · ← 0`
- Critical = 0: `✓ 1 save · 2 edit · 3 /refine · ← 0`

---

### Build context:

---

**Argus · Rehearse** — 사전 검증

**바꿔야 할 것**
1. [action]
2. [action]

---

🎯 **[Name]** · [context] · [current_solution] → **[verdict]**

> "[첫 반응]"

| 우려 | 심각도 | 수정 방향 |
|------|--------|----------|
| [what makes them delete it] | 🔴 critical | [수정] |
| [unspoken market reality] | 🔇 unspoken | [대응] |

🤨 **[Name]** · [alternative] → **[verdict]**

> "[첫 반응]"

| 우려 | 심각도 | 수정 방향 |
|------|--------|----------|
| [likely death mode] | 🔴 critical | [수정] |
| [what nobody admits] | 🔇 unspoken | [대응] |

---

**Devil's Advocate**

```diff
- ✗ [most likely death]
- 🔇 [what nobody says]
- ⏳ [6-month regret]
```

---

> 💡 [blind spot]

`⚠️/✓ [severity] · 1 /refine · 2 edit · 3 save · ← 0`

---

## Quick actions

- `1` → save + recommended next
- `2` → edit (a. swap personas, b. re-evaluate, c. redo DA, **d. refine persona**)
- `3` → save and stop
- `0` → back to /recast with insights

If user picks `2d` (refine persona) → ask which persona to refine, then accept free-form description and show before→after diff.

**Post-review actions — ALWAYS run after showing all reviews:**

1. **Accuracy feedback** — always ask (see "Post-review accuracy feedback" in Step 1). This is the most valuable signal: "이 피드백이 실제 그 사람과 비슷했나요?"

2. **Completeness nudge** — if any persona has completeness < 생생함, append:
   ```
   💬 [Name]의 시뮬레이션을 더 정확하게 만들고 싶다면, 이 사람에 대해 한 마디만 더 알려주세요.
      현재: [completeness visual] [label] — [nextHint]
   ```

## Rendering rules

- Markdown sections separated by `---`.
- No box drawing. No fixed width.
- diff = color tool. Max 3 per output.
- Risk symbols: `✗` critical, `?` manageable, `🔇` unspoken
- Persona headers include decision_style and risk_tolerance for transparency

## Auto-save

Save to `.argus/rehearse.md`:
- Top: actions + persona summaries + DA + synthesis
- Bottom: Context Contract (full schema — risks by category, approval_conditions with translated_approvals, persona_profiles with ALL fields for /refine, synthesis with agreements/conflicts/priority_actions, devils_advocate)

Save/update `.argus/personas.json`:
- All personas used in this rehearsal (auto-generated + user-refined)
- Include completeness score, user_description, source (auto/user_refined/confirmed)
- Existing confirmed personas are preserved (never overwritten by auto-generation)

## Journal

```
## [date] /rehearse — [topic, ≤5 words]
- Context: [build|decide]
- Personas: [names with roles, decision_styles]
- Critical: [each — 1 line, with plan element]
- Unspoken: [each — 1 line]
- Sharpest critique: "[quote]" — [persona]
- Conflicts: [topic — persona vs persona]
- Untested: [assumptions no one could verify]
- Pipeline: reframe ✓ → recast ✓ → rehearse ✓ → refine ·
```

## Self-check

- Is there anything here that would make the user uncomfortable? If not → too soft.
- Does each risk cite a specific element from /recast? If not → too generic.
- Does each persona speak differently (reflecting their decision_style)? If they sound the same → persona simulation failed.
- If a persona has `user_description`, does the review reflect those specific traits? "숫자 없으면 안 넘어가" → review MUST demand numbers. If not → user_description injection failed.
- Is there at least 1 🔇 unspoken risk? If not → you aren't looking hard enough.
- Did you show completeness progression and offer accuracy feedback? If not → missed the engagement loop.
