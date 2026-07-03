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

## Step 1: 즉시 분석 — 현재 역할 구조 파악

계획을 받으면 **즉시** 각 단계를 분석하고 자동 역할 배정:

---

**Argus · Recast** — 역할 재설계

**현재 계획의 역할 구조:**

| # | 단계 | 현재 담당 | 산출물 |
|---|------|----------|--------|
| 1 | [단계] | 🤖 AI | [산출물] |
| 2 | [단계] | 🧑 사람 | [산출물] |
| 3 | [단계] | ⚡ 둘 다 | [산출물] |
| 4 | [단계] | 🤖 AI | [산출물] |

**역할 분포:** 🤖 AI [N]개 · 🧑 사람 [N]개 · ⚡ 둘 다 [N]개

```diff
- ⚠️ [자동 분석에서 발견된 역할 배분 문제점 — 예: "3단계 고객 검증을 AI 단독으로 하면 진짜 고객 반응을 놓칠 수 있다"]
```

---

> 각 단계를 하나씩 검토하겠다. 내가 질문하면 답해달라.

---

## Step 2: 4-Question 역할 검토 (AskUserQuestion)

**핵심 가치: 이 단계가 /recast의 존재 이유.**

모든 단계를 한번에 묻지 않는다. **가장 판단이 애매한 1-2개 단계**부터 시작.

### 검토 대상 선정 기준:
- ⚡ Both로 배정된 단계 (역할 경계 모호)
- 🤖 AI인데 판단/정치 요소가 있는 단계
- 🧑 사람인데 AI가 80%는 할 수 있는 단계

### 각 단계에 대해 AskUserQuestion:

**예시 — "시장 조사" 단계:**

- question: "[단계명] — 이건 누가 해야 할까? 4가지 기준으로 판단해보자."
- header: "역할 판단"
- options:
  - label: "🤖 AI가 해도 됨", description: "내부 지식/정치 불필요, 틀려도 수정 가능, 판단보다 실행"
  - label: "🧑 사람이 해야 함", description: "내부 맥락·정치 필요, 또는 틀리면 되돌릴 수 없음"
  - label: "⚡ 둘 다", description: "AI가 초안, 사람이 검증/판단"

사용자가 선택하면, 선택 이유를 한 줄로 기록하고 다음 단계로.

**2-3개 단계를 검토한 후**, 나머지는 자동 배정 유지하고 전체 결과를 보여준다.

### 4-Question Framework (내부 판단 기준 — 사용자에게 직접 노출하지 않고 AI가 옵션 설명에 반영):

1. **내부/정치적 지식 필요?** → 조직 내 역학, 승인 라인, 비공식 권력 구조 → 🧑
2. **주관적/전략적 판단?** → "이게 맞다/아니다"의 판단이 사람 경험에 의존 → 🧑
3. **틀렸을 때 비용이 크고 되돌릴 수 없음?** → 한 번 잘못되면 복구 불가 → 🧑 or ⚡
4. **특정인이 책임져야 함?** → "누가 판단했어?"에 답할 수 있어야 → 🧑
→ 4개 모두 아님 → 🤖 AI

## Step 3: 재설계 결과 출력

---

**Argus · Recast** — 역할 재설계 완료

**재설계된 실행 계획:**

| # | 단계 | 담당 | 산출물 | 판단 근거 |
|---|------|------|--------|----------|
| 1 | [단계] | 🤖 AI | [산출물] | [왜 AI] |
| 2 | [단계] | 🧑 사람 ⚑ | [산출물] | [왜 사람 — 체크포인트] |
| 3 | [단계] | ⚡ 둘 다 | [산출물] | AI: [범위] / 사람: [범위] |
| 4 | [단계] | 🤖 AI | [산출물] | [왜 AI] |

⚑ = 사람 체크포인트 (다음 단계 진행 전 승인 필요)

**변경 사항:**

```diff
- [이전: 단계 X를 AI 단독]
+ [이후: 단계 X를 사람+AI 협업 — 이유: ...]
```

**역할 분포 변화:**

```diff
- Before: 🤖 3 · 🧑 1 · ⚡ 1
+ After:  🤖 2 · 🧑 2 · ⚡ 1
```

---

**핵심 원칙이 지켜졌는가:**

```diff
+ ✓ 되돌릴 수 없는 결정에 사람 체크포인트 있음
+ ✓ 내부 지식이 필요한 단계에 사람 배정
- ? [아직 모호한 점 — 있다면]
```

> 💡 [역할 설계에서 발견된 인사이트 — 예: "AI가 시장 조사를 하되, 경쟁사 전략의 '의도' 해석은 사람이 해야 한다. 숫자는 AI가 빠르지만 숫자 뒤의 맥락은 사람만 읽는다."]

---

## Step 4: 다음 행동

AskUserQuestion:

- question: "재설계된 계획으로 무엇을 할까?"
- header: "다음"
- options:
  - label: "이걸로 진행", description: "저장하고 실행 시작"
  - label: "판단자 반응 보기", description: "/rehearse로 이 계획을 검증"
  - label: "다시 조정", description: "특정 단계의 역할을 바꾸고 싶다"

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
- Actor emoji: 🤖 AI, 🧑 사람, ⚡ 둘 다
- ⚑ = 체크포인트 (사람 승인 필요)

## Auto-save

Save to `.argus/recast.md`:
- Top: 재설계된 실행 계획 (human-readable)
- Bottom after `---`: Context Contract (all persona fields for /rehearse)

## Journal

```
## [date] /recast — [topic, ≤5 words]
- Input: [새 계획 | 기존 계획 재설계 | /argus 후속]
- Steps: [N] | 🤖 [M] · 🧑 [K] · ⚡ [L]
- Changes: [N]개 역할 변경
- Key insight: [1줄]
```
