---
name: recast
description: "기존 계획에서 AI와 사람의 역할을 재설계한다. '이건 AI가 해도 돼' vs '이건 반드시 사람이 판단해야 해'를 명확히 구분. 이미 만든 계획이 있을 때 사용."
argument-hint: "[계획서, 실행 계획, 또는 TODO 리스트]"
allowed-tools: Read, Write, AskUserQuestion
---

## When to use

- ✓ 이미 만든 계획/기획안의 AI/사람 역할을 명확히 하고 싶을 때
- ✓ /argus 결과물의 실행 계획을 더 세밀하게 다듬고 싶을 때
- ✓ 팀 프로젝트에서 "이건 누가 해?" 질문에 구조적으로 답하고 싶을 때
- ✗ 아직 계획이 없음 → /argus 먼저
- ✗ 판단자 피드백을 받고 싶음 → /rehearse

**핵심 철학: AI가 빨라지는 시대에, "사람이 반드시 판단해야 하는 지점"을 설계하는 것이 실행의 품질을 결정한다.**

**Always respond in the same language the user uses.**

## Step 0: 계획 가져오기

**3가지 경로** 중 하나:

1. **인자로 받음** — `/recast "시장 조사 → 프로토타입 → 고객 검증 → 런칭"` 형태
2. **이전 결과 읽기** — `.argus/last-run.md` 또는 `.argus/recast.md`가 있으면 자동으로 읽어서 제안:

> 이전에 만든 계획이 있습니다. 이걸로 역할 설계를 할까요?

3. **없으면 질문**:

> 어떤 계획의 역할을 설계할까요? 실행 계획, TODO 리스트, 또는 기획안을 붙여넣어 주세요.

## Context injection from /reframe

If `.argus/reframe.md` exists, read its contract and inject context:

### 1. Design north star
Read `reframed_question` → this is the question the plan must ultimately answer.

### 2. Assumption evaluation injection
Read `assumptions` and group by evaluation state:

**Doubtful assumptions** (최우선 — 검증 단계 필수):
- Mark each as `[from reframe]` in steps
- Place validation steps EARLY in the plan — before execution, not after
- Each doubtful assumption → create or identify a step that validates it
- Include the user's doubt reason: "사용자가 '시장 존재 자체가 의심' → Step 1에서 고객 인터뷰로 검증"

**Uncertain assumptions** (검증 방법 제시):
- Include in `key_assumptions` with `certainty=low`
- Suggest specific verification methods in step descriptions

**Confirmed assumptions** (계획 근거):
- Reference as foundation: "이 계획은 [confirmed assumption]을 전제로 합니다"

**Risk-based design guidance** (automatic):
If ≥50% of evaluated assumptions are doubtful → inject this design directive:
> "사용자가 전제의 절반 이상을 의심합니다. 보수적으로 설계하고, 검증 단계를 앞쪽에 배치하세요."

### 3. Framing confidence
Read `framing_confidence`:
- <50: "프레이밍이 불안정합니다. 탐색적 설계: 작은 실험과 학습 루프를 먼저 배치."
- 50-69: "프레이밍이 불확실합니다. 검증 단계를 실행 전에 배치하세요."
- 70-89: 표준 설계
- ≥90: 실행 구체성에 집중

### 4. Interview signal → design directive mapping
Read `interview_signals` and convert each signal to a specific design instruction:

**Nature signals:**
- `known_path` → "검증된 방법이 있는 과제입니다. 실행의 구체성에 집중하세요."
- `needs_analysis` → "분석이 필요한 과제입니다. 데이터와 전문성 기반으로 접근하세요."
- `no_answer` → "탐색적 과제입니다. 작은 실험과 학습 루프를 설계하세요."
- `on_fire` → "긴급 상황입니다. 즉각 대응과 근본 해결을 구분하세요."

**Goal signals:**
- `clear_goal` → "목표가 명확합니다. 달성 경로에 집중하세요."
- `direction_only` → "방향만 있고 구체적 목표가 없습니다. 목표를 구체화하는 단계를 포함하세요."
- `competing` → "목표가 충돌합니다. 이해관계자별 우선순위 정렬이 필요합니다."
- `unclear` → "목표가 불분명합니다. governing_idea를 특히 구체적으로 작성해주세요."

**Stakes signals:**
- `irreversible` → "되돌리기 어려운 결정입니다. 검증 단계를 실행 전에 배치하세요."
- `important` → "중요하지만 수정 가능합니다. 체크포인트를 적절히 배치하세요."
- `experiment` → "실험 수준입니다. 빠른 실행과 피드백 루프에 집중하세요."

**History signal:**
- `failed` → "과거에 비슷한 시도가 실패했습니다. '이번에는 다른 점'을 명확히 하는 단계를 포함하세요."

### 5. AI limitations
Read `ai_limitations` → 해당 영역은 반드시 🧑 또는 ⚡ 배정. "이 부분은 AI가 검증할 수 없다"고 설계 근거에 명시.

## Step 1: 즉시 분석 — Storyline + 현재 역할 구조 파악

계획을 받으면 **즉시** Storyline을 도출하고 각 단계를 분석:

---

**Argus · Recast** — 역할 재설계

**Storyline:**
- **Situation:** [현재 상황 — 1-2문장]
- **Complication:** [왜 지금 이게 필요한지 — 긴장 요소]
- **Resolution:** [이 계획이 제시하는 해결 — governing idea]

**현재 계획의 역할 구조:**

| # | 단계 | 현재 담당 | 산출물 | 예상 시간 |
|---|------|----------|--------|----------|
| 1 | [단계] | 🤖 AI | [산출물] | [quick/short/medium/long] |
| 2 | [단계] | 🧑 사람 | [산출물] | [시간] |
| 3 | [단계] | ⚡ 둘 다 | [산출물] | [시간] |
| 4 | [단계] | 🧑→🤖 | [산출물] | [시간] |

**역할 분포:** 🤖 AI [N]개 · 🧑 사람 [N]개 · ⚡ 둘 다 [N]개 · 🧑→🤖 [N]개 · 🤖→🧑 [N]개

**Critical Path:** 단계 [N], [M], [K] ★

```diff
- ⚠️ [자동 분석에서 발견된 역할 배분 문제점 — 예: "3단계 고객 검증을 AI 단독으로 하면 진짜 고객 반응을 놓칠 수 있다"]
```

---

> 각 단계를 하나씩 검토하겠다. 내가 질문하면 답해달라.

---

### Time estimation guide:
- **Quick** (<2시간): AI-only 데이터 수집
- **Short** (반나절~1일): 단일 분석 또는 빌드
- **Medium** (2-5일): 리서치 + 합성, 기능 개발
- **Long** (1-2주): 복합 프로세스, 대규모 빌드

### Critical path identification:
1. 다른 단계의 선행 조건인 단계를 찾는다
2. 시작→끝까지 가장 긴 의존성 체인을 추적
3. 이 단계들이 critical path — 여기가 지연되면 전체가 지연
4. Critical path 단계에는 ★ 표시 + 체크포인트 권장

## Step 2: 4-Question 역할 검토 (AskUserQuestion)

**핵심 가치: 이 단계가 /recast의 존재 이유.**

모든 단계를 한번에 묻지 않는다. **가장 판단이 애매한 1-2개 단계**부터 시작.

### 검토 대상 선정 기준:
- ⚡ Both로 배정된 단계 (역할 경계 모호)
- 🤖 AI인데 판단/정치 요소가 있는 단계
- 🧑 사람인데 AI가 80%는 할 수 있는 단계
- ★ Critical path 단계 (역할이 잘못되면 영향 큼)

### 각 단계에 대해 AskUserQuestion:

**예시 — "시장 조사" 단계:**

- question: "[단계명] — 이건 누가 해야 할까?"
- header: "역할 판단"
- options:
  - label: "🤖 AI가 해도 됨", description: "내부 지식/정치 불필요, 틀려도 수정 가능"
  - label: "🧑 사람이 해야 함", description: "내부 맥락·정치 필요, 또는 틀리면 되돌릴 수 없음"
  - label: "⚡ 둘 다", description: "AI가 초안, 사람이 검증/판단"
  - label: "🧑→🤖 사람이 방향, AI가 실행", description: "사람이 기준/방향 설정 → AI가 실행"
  - label: "🤖→🧑 AI가 분석, 사람이 판단", description: "AI가 옵션/분석 제공 → 사람이 최종 결정"

사용자가 선택하면, 선택 이유를 한 줄로 기록하고 다음 단계로.

**2-3개 단계를 검토한 후**, 나머지는 자동 배정 유지하고 전체 결과를 보여준다.

### 4-Question Framework (내부 판단 기준 — 사용자에게 직접 노출하지 않고 AI가 옵션 설명에 반영):

1. **내부/정치적 지식 필요?** → 조직 내 역학, 승인 라인, 비공식 권력 구조 → 🧑
2. **주관적/전략적 판단?** → "이게 맞다/아니다"의 판단이 사람 경험에 의존 → 🧑
3. **틀렸을 때 비용이 크고 되돌릴 수 없음?** → 한 번 잘못되면 복구 불가 → 🧑 or ⚡
4. **특정인이 책임져야 함?** → "누가 판단했어?"에 답할 수 있어야 → 🧑
→ 4개 모두 아님 → 🤖 AI

### "Both" means clear scope boundaries:
⚡ 배정 시 반드시 `ai_scope`와 `human_scope`를 명시:
- Bad: "AI and human work together on market analysis"
- Good: "AI generates 3-scenario financial model (ai_scope). Human sets scenario assumptions and interprets which one matches our risk appetite (human_scope)."

## Step 3: 재설계 결과 출력 + 핵심 가정

---

**Argus · Recast** — 역할 재설계 완료

**Governing Idea:** [계획의 핵심 논지 — 1-2문장]

**재설계된 실행 계획:**

| # | 단계 | 담당 | 산출물 | 판단 근거 | 시간 | 비고 |
|---|------|------|--------|----------|------|------|
| 1 | [단계] | 🤖 AI | [산출물] | [왜 AI] | [시간] | |
| 2 | [단계] | 🧑 사람 ⚑ | [산출물] | [왜 사람] | [시간] | ★ critical path |
| 3 | [단계] | ⚡ 둘 다 | [산출물] | AI: [범위] / 사람: [범위] | [시간] | ∥ 1과 병렬 |
| 4 | [단계] | 🤖→🧑 | [산출물] | AI 분석→사람 판단 | [시간] | |

⚑ = 사람 체크포인트 (다음 단계 진행 전 승인 필요)
★ = critical path (지연 시 전체에 영향)
∥ = 병렬 실행 가능

**변경 사항:**

```diff
- [이전: 단계 X를 AI 단독]
+ [이후: 단계 X를 사람+AI 협업 — 이유: ...]
```

**역할 분포 변화:**

```diff
- Before: 🤖 3 · 🧑 1 · ⚡ 1 · 🧑→🤖 0 · 🤖→🧑 0
+ After:  🤖 2 · 🧑 1 · ⚡ 1 · 🧑→🤖 0 · 🤖→🧑 1
```

**전체 예상 소요:** [시간]

---

**핵심 가정** (이 계획이 전제하는 것)

| # | 가정 | 중요도 | 확실도 | 틀리면? |
|---|------|-------|-------|--------|
| 1 | [가정] | high | medium | [결과] |
| 2 | [가정] | high | low | [결과] |
| 3 | [가정] [from reframe] | high | low | [결과] |

---

**핵심 원칙이 지켜졌는가:**

```diff
+ ✓ 되돌릴 수 없는 결정에 사람 체크포인트 있음
+ ✓ 내부 지식이 필요한 단계에 사람 배정
+ ✓ Critical path에 적절한 체크포인트 배치
- ? [아직 모호한 점 — 있다면]
```

> 💡 [역할 설계에서 발견된 인사이트 — 예: "AI가 시장 조사를 하되, 경쟁사 전략의 '의도' 해석은 사람이 해야 한다. 숫자는 AI가 빠르지만 숫자 뒤의 맥락은 사람만 읽는다."]

---

## Step 4: 다음 행동 + 판단자 프로필 생성

AskUserQuestion:

- question: "재설계된 계획으로 무엇을 할까?"
- header: "다음"
- options:
  - label: "판단자 반응 보기", description: "/rehearse로 이 계획을 검증"
  - label: "이걸로 진행", description: "저장하고 실행 시작"
  - label: "다시 조정", description: "특정 단계의 역할을 바꾸고 싶다"

### 판단자 프로필 자동 생성

`/rehearse`로 넘어갈 때, 계획 내용을 기반으로 3명의 판단자(Decide) 또는 2명(Build) 프로필을 자동 생성하여 contract에 포함:

**Decide context — 3 stakeholders:**
1. **Reporting audience** — 산출물을 받는 사람
2. **Gatekeeper** — 승인을 통제하는 사람
3. **Domain expert** — 현실성을 아는 사람

Each persona includes: name, role, organization, influence, decision_style, risk_tolerance, priorities, communication_style, known_concerns, success_metric, primary_concern, blocking_condition.

**Diversity check:**
- [ ] 최소 2가지 다른 thinking style
- [ ] 최소 1명 conservative + 1명 aggressive on risk
- [ ] 최소 1명 high influence (프로젝트를 죽일 수 있는 사람)

**Build context — 2 user personas:**
1. **Target User** — name, context, current_solution (specific!), switch_threshold, dealbreaker
2. **Skeptic** — name, alternative (specific product!), objection

---

## Build context 모드

계획이 아니라 **제품을 만드는 상황**이면 (Build context 감지 시), 역할 설계 대신 **feature spec 모드**로 전환:

- P0/P1/P2 feature spec 생성
- User story
- Scope cuts
- Success metric
- Implementation prompt

(기존 Build context 출력 유지 — 이 경우 역할 검토 프레임워크는 적용하지 않음)

---

## Rendering rules

- Markdown sections separated by `---`.
- **No box drawing.** Use `---`, `**bold**`, whitespace.
- **No fixed width.** Markdown auto-wraps.
- **diff = color.** `+` confirmed (green), `-` risk (red). Max 3 per output.
- Actor emoji: 🤖 AI, 🧑 사람, ⚡ 둘 다, 🧑→🤖, 🤖→🧑
- ⚑ = 체크포인트 (사람 승인 필요)
- ★ = critical path
- ∥ = 병렬 실행 가능

## Auto-save

Save to `.argus/recast.md`:
- Top: Storyline + 재설계된 실행 계획 (human-readable)
- Bottom after `---`: Context Contract (all fields for /rehearse — governing_idea, storyline, steps with all metadata, key_assumptions, critical_path, personas)

## Journal

```
## [date] /recast — [topic, ≤5 words]
- Input: [새 계획 | 기존 계획 재설계 | /argus 후속]
- Storyline: S:[situation] C:[complication] R:[resolution]
- Steps: [N] | 🤖 [M] · 🧑 [K] · ⚡ [L] · 🧑→🤖 [X] · 🤖→🧑 [Y]
- Critical path: steps [N, M, K]
- Changes: [N]개 역할 변경
- Key assumptions: [N]개 (high-importance: [M])
- Key insight: [1줄]
- Personas generated: [names with roles]
```
