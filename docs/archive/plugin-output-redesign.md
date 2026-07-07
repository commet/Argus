# Plugin Output 디자인 리디자인 계획

> 2026-03-29 작성. 다른 기기에서 이어서 작업하기 위한 문서.

---

## 1. 현재 문제 진단

### 왜 계속 "별로"인가

몇 차례 개선을 시도했지만 근본적 개선이 안 된 이유는 **매체와 접근법의 구조적 충돌** 때문.

**LLM은 레이아웃 엔진이 아니다**
- 스킬 프롬프트가 76자 폭, `╭╮╰╯` 박스, `════╪═══` 테이블 등 픽셀 수준 설계
- 실행하는 건 코드가 아니라 LLM → 한글 더블바이트 폭 계산 실패, 컬럼 정렬 불일치, 매번 다른 output
- LLM이 내용과 포맷을 동시에 처리하면 **둘 다 질이 떨어짐**

**Code block이 함정**
- 현재: 전체 카드를 하나의 code block에 넣음
- Code block 안에서는 bold/italic/color/header 전부 불가
- 유일한 도구: 유니코드 문자 + 스페이싱
- 장식을 넣으면 busy, 빼면 밋밋 → 양쪽 다 별로

**Over-decoration**
- 박스 드로잉 (`╭╮╰╯`, `┌│└`, `═══╪`, `───┼`) + 프로그레스 바 (`████░░`) + emoji 10종+
- 좋은 CLI 디자인(`gh`, `vercel`, `cargo`)은 장식이 아니라 **절제**로 만들어짐

---

## 2. 생태계 조사 결과

### 대부분의 스킬: 포맷 지시 자체가 없음

- Anthropic 공식 스킬 (`commit-push-pr`, `triage-issue`, `doc-coauthoring` 등) → task 지시만, output 포맷 지시 없음
- 인기 커뮤니티 스킬 (`badlogic/claude-commands`, `wshobson/commands` 57개, `EveryInc/claude_commands`) → 동일
- Argus처럼 비주얼 시스템을 설계한 스킬은 **사실상 없음**
- 대부분 Claude의 기본 마크다운 출력에 맡김

### 비주얼이 필요한 스킬은 브라우저로 탈출

- `careerhackeralex/visualize` → HTML 파일 생성 → 브라우저
- `nicobailon/visual-explainer` → Mermaid/Chart.js/HTML → 브라우저
- Anthropic 공식 `codebase-visualizer` → Python → HTML → 브라우저
- **터미널 안에서 예쁘게 만들려는 시도 자체를 안 함**

### "구조화 데이터 + 터미널 렌더러" 방식은 0개

- LLM이 JSON 뱉고 별도 렌더러가 터미널에 그려주는 방식 → 아무도 안 함
- 생태계에 이 중간 지대 자체가 없음

### Code block: 밖이 기본

- 대부분의 스킬 output은 일반 마크다운
- Code block은 실제 코드/YAML/JSON에만 사용
- 전체 카드를 code block에 넣는 건 예외적 접근

---

## 3. Claude Code 렌더링 역량

### 작동하는 것

| 방법 | 효과 |
|------|------|
| `**bold**` | 터미널 굵게 표시 |
| `*italic*` | 터미널 기울임 |
| `` `인라인 코드` `` | 별도 스타일링 |
| `` ```diff `` 블럭 | `+`줄 녹색 배경, `-`줄 빨간 배경 |
| `` ```언어 `` 코드블럭 | 언어별 구문 강조 색상 |
| `> blockquote` | 구분된 스타일 |
| `- 리스트` | 자연스러운 위계 |
| `1. 넘버링` | 순서 표현 |
| `---` 구분선 | 섹션 구분 |

### 작동 안 하거나 제한적인 것

| 방법 | 문제 |
|------|------|
| `## 헤더` | 위계 표현이 제거됨 (알려진 이슈 #26390) |
| ANSI escape 코드 직접 출력 | 마크다운 렌더러 통과 → 불가 |
| 임의 색상/배경색 지정 | diff 블럭의 녹/빨만 가능 |
| diff 블럭 안 마크다운 서식 | bold 등 안 먹힘 |
| 테이블 → 리치 텍스트 복사 | 깨짐 (이슈 #35066) |

### 색상은 diff 블럭이 유일한 무기

- `+` 줄 → 녹색 배경 (확인됨, 긍정, 핵심)
- `-` 줄 → 빨간색 배경 (미확인, 위험, 주의)
- 두 가지만 가능하므로 전략적으로 사용해야 함

---

## 4. 채택 방향: 마크다운 기본 + diff 전략적 사용

### 원칙

1. **Code block 밖으로 나온다** — bold, blockquote, list 등 마크다운 도구 활용
2. **diff 블럭을 색상 도구로 전용** — 핵심 구분에만 사용 (녹색=확인, 빨간색=미확인)
3. **Code block은 테이블/구조 데이터만** 담당
4. **박스 드로잉 전면 제거** — `╭╮╰╯`, `┌│└`, `═══╪`, `───┼` 전부 삭제
5. **여백이 디자인** — 장식 대신 공백으로 구조를 만듦
6. **LLM 인지 부하 감소** — 포맷 지시를 줄여서 내용 품질에 집중시킴

### 도구별 역할

| 마크다운 도구 | 용도 |
|--------------|------|
| `**bold**` | 섹션 레이블, 핵심 용어 강조 |
| `` ```diff `` | 가정 확인/미확인 구분, before/after 비교, 핵심 질문 강조 |
| `> blockquote` | 💡 인사이트, 페르소나 발언 인용 |
| `` `인라인 코드` `` | quick action 메뉴, 기술 용어 |
| `- 리스트` | 열거, 체크리스트 |
| `1. 넘버링` | 순서 있는 항목 (먼저 확인, 실행 단계) |
| `---` | 대섹션 구분 |
| `` ```yaml/json `` | Context Contract, Agent Harness |
| 일반 `` ``` `` code block | 테이블 (파이프 테이블, 정렬 필요한 것) |

---

## 5. 스킬별 Before/After 설계

### /reframe

**Before (현재):**
```
╭──────────────────────────────────────────╮
│  🎯 Argus · Reframe                  │
│  ● Interview  ○ Assumptions  ○ Reframe  │
╰──────────────────────────────────────────╯

가정 ────────────────────────────────────────

✓ │ 코드 리뷰에 과도한 시간을 쓰고 있다
──┼──────────────────────────────────────────
? │ 기존 도구 대비 틈새가 존재한다
```

**After (목표):**

```
(아래는 실제 마크다운 렌더링 기준)
```

**🎯 Reframe**

**물어본 것**
"개발자를 위한 AI 코드 리뷰 자동화 SaaS"

```diff
+ ▸ 진짜 질문
+ AI 코드 리뷰 도구가 5개 이상 존재하는 시장에서, 기존 도구가
+ 의도적으로 방치하는 리뷰 마찰은 무엇이며, 독립 SaaS가
+ 들어갈 틈이 있는가?
```

**가정**

```diff
+ ✓ 코드 리뷰에 과도한 시간을 쓰고 있다
+ ✓ AI 리뷰 코멘트를 신뢰하고 반영할 것이다
- ? 기존 도구 대비 틈새가 존재한다
- ? 팀 리드가 월 구독료를 지불할 의향이 있다
```

**먼저 확인**
1. CodeRabbit/Codacy 사용자 불만 Top 3
2. 개발팀 리드 3명에게 지불 경험 확인
3. GitHub Copilot 코드 리뷰 로드맵

> 💡 자동화의 경쟁자는 다른 도구가 아니라 "리뷰를 통해 주니어를 가르치고 싶은 시니어"다.

`다음? 1 /recast · 2 수정 · 3 저장`

---

### /recast (build context)

**After (목표):**

**📋 Recast**

```diff
+ ▸ 10인+ 개발팀에서 시니어가 주니어 PR 리뷰 시 반복적
+   스타일·패턴 지적은 AI가 처리하고, 시니어는 아키텍처·설계
+   판단에만 집중하게 해주는 리뷰 어시스턴트.
```

**User Story**
10인 개발팀의 시니어로서, 주니어 PR 스타일 지적에 시간을 뺏기지 않고 설계 리뷰에 집중하고 싶다.

**MVP**

```
     기능              동작
P0   팀 컨벤션 학습     PR 히스토리에서 팀 고유 패턴 자동 추출
P0   리뷰 분리 필터     스타일(AI) vs 설계(시니어) 자동 분류
P1   시간 대시보드      리뷰어별 시간 절약 · ROI 시각화
P2   온보딩 가속기      새 팀원 첫 10개 PR에 가이드 자동 첨부
```

**✂ Scope Cuts:** CI/CD 연동 · 보안 스캔 · 자동 수정/머지 · IDE 플러그인

**가정**

```diff
+ ✓ 코드 리뷰에 과도한 시간이 든다
- ? 기존 도구 대비 "팀 컨벤션 학습" 틈새가 있다 ← reframe
- ? CTO가 리뷰 시간 절약에 월 구독료를 낼 것이다 ← reframe
- ? 시니어가 AI 스타일 지적을 도움으로 받아들인다 ← new
```

**페르소나** → /rehearse

- 🎯 **준호** — 시니어 백엔드, 10인 팀 — 현재: CodeRabbit 무료 + 수동
- 🤨 **수진** — DevOps, Codacy 해지 경험 — "AI 리뷰는 noise 때문에 결국 끈다"

**성공 기준** = 3개 팀이 2주 사용 후 시니어 리뷰 시간 30% 감소

`다음? 1 /rehearse · 2 수정 · 3 저장 · ← 0`

---

### /rehearse

**After (목표):**

**👥 Rehearse**

**바꿔야 할 것**
1. "팀 컨벤션 학습"이 기존 linter 조합과 실제로 다르다는 증거
2. 시니어가 "빼앗기는 느낌"이 아닌 "돌려받는 느낌" 온보딩 설계
3. false positive 비율 구체적 목표

---

🎯 **준호** — 시니어 백엔드 · 10인 팀

```diff
- ✗ false positive 20% 넘으면 알림 피로로 끔
- 🔇 스타일 지적하면서 주니어 가르치는 게 뿌듯한데, AI가 하면 내 역할이 뭐지?
```

> ▸ "팀 컨벤션 학습이 우리 PR 100개를 진짜 이해하는 수준이면 혁명. ESLint 규칙 뽑아내는 수준이면 내가 왜 돈을 내."

**Approve if:** 1주 내 "ESLint로 못 잡는 건데" 순간 3번+

---

🤨 **수진** — DevOps · Codacy 해지 경험

```diff
- ✗ "팀 컨벤션 학습"은 마케팅 용어, 실제로는 패턴 매칭
- 🔇 시니어는 도입 결정권자이면서 역할 축소 당사자 — 셀프 디스럽션 안 함
```

> ▸ "CodeRabbit + ESLint + Prettier면 스타일은 이미 90% 잡힌다. 남은 10%를 위해 새 SaaS?"

**Approve if:** "Codacy랑 뭐가 다른지" 10초 내 설명

---

**Devil's Advocate**

```diff
- ✗ 파일럿 2주 후 이탈 — 학습이 아니라 초기 패턴 캐시였음
- 🔇 CTO(구매자)는 시간 절약 원하지만 시니어(사용자)는 리뷰가 영향력 원천. 인센티브 충돌.
- ⏳ GitHub Copilot이 컨벤션 학습 기능 출시. 독립 SaaS 존재 이유 소멸.
```

> 💡 핵심 긴장: "시니어의 시간을 아껴준다"가 아니라 "시니어의 권한을 줄인다"로 읽힐 수 있다.

`⚠️ Critical 3개 · 다음? 1 /refine 권장 · 2 수정 · 3 저장 · ← 0`

---

### /refine

**After (목표):**

**🔧 Refine · Round 1**

**변경 사항**

| # | 변경 | 이유 |
|---|------|------|
| 1 | P0에 "false positive < 10% 필터" 추가 | 준호 critical: 알림 피로 |
| 2 | 온보딩 → "시니어 역할 재정의" 메시지 포함 | 준호 unspoken: 역할 위협 |
| 3 | 첫 데모를 "ESLint 차별점" 중심으로 | 수진 approval 조건 |

**페르소나 재평가**

```diff
- 준호: 조건부 → 준호: 수용 (false positive 필터 + 역할 보장)
+ 수진: 거부 → 수진: 조건부 (차별점 데모 필요)
```

**미해결**
- CTO-시니어 인센티브 충돌 → /refine으로 해결 불가, 가격/포지셔닝 전략 문제

> 💡 기술 데모가 아니라 "시니어의 시간이 어디로 가는지" 보여주는 게 핵심 셀링 포인트.

`다음? 1 저장 · 2 Round 2 · 3 수정`

---

### /argus (풀 파이프라인)

각 단계별로 위 포맷을 순차 적용. 추가 요소:

**파이프라인 진행 표시** — diff 블럭 활용:

```diff
+ reframe ●  done
+ recast  ●  done
```
```
  rehearse ○  next
  refine   ○
```

**DQ 스코어카드** — code block 사용 (정렬 필요):

```
  Decision Quality Score

  Framing        ████░  4/5
  Alternatives   ███░░  3/5
  Information    ████░  4/5
  Perspectives   █████  5/5
  Reasoning      ████░  4/5
  Actionability  ███░░  3/5

  Overall        77/100
```

**Anti-sycophancy 체크** — diff 활용:

```diff
+ ✓ Initial framing challenged
+ ✓ 2 blind spots surfaced
+ ✓ Plan revised after rehearsal
```

**Deliverables** — 각각 적절한 포맷:
- Implementation Prompt → blockquote
- Product Brief / Thinking Summary → bold + diff + 일반 텍스트
- Agent Harness → ```yaml code block

---

### Interview 단계 (공통)

질문은 code block 안에 유지 (선택지 정렬 필요):

```
■ 인터뷰                              1 / 3

이 과제의 성격은?

  1 · 방법이 명확함
  2 · 분석 필요
  3 · 답이 불분명
  4 · 긴급 대응

▸
```

확인 응답은 code block 밖에서: **✓ 분석 필요**

---

## 6. 프롬프트 수정 체크리스트

각 스킬 SKILL.md에서 변경할 것:

### 공통 변경

- [ ] "ONE code block" 규칙 → "마크다운 기본, code block은 테이블/contract만" 으로 교체
- [ ] 박스 드로잉 문자 전면 제거: `╭╮╰╯`, `┌│└`, `═══╪`, `───┼`, `━━━` 전부
- [ ] "76-char content width" 규칙 제거 (마크다운은 자동 래핑)
- [ ] 프로그레스 바 (`████░░`) → 간소화 or 제거
- [ ] diff 블럭 사용법 추가: `+`줄 = 확인/긍정/핵심, `-`줄 = 미확인/위험/주의
- [ ] bold 사용법 추가: 섹션 레이블에 `**text**`
- [ ] blockquote 사용법 추가: 인사이트(`💡`), 페르소나 발언(`▸`)
- [ ] Quick action → 인라인 코드로: `` `다음? 1 /recast · 2 수정 · 3 저장` ``

### /reframe (SKILL.md)

- [ ] "Rendering rules" 섹션 전면 교체
- [ ] "Card template" 교체 (위 After 참조)
- [ ] Overview + Q1: interview 질문만 code block 유지, 나머지 마크다운
- [ ] 가정 표시: diff 블럭으로 (`+` 확인, `-` 미확인)
- [ ] 먼저 확인: 넘버 리스트로
- [ ] 💡: blockquote로

### /recast (SKILL.md)

- [ ] "Output card" 전면 교체
- [ ] Product thesis: diff 블럭 (녹색 강조)
- [ ] MVP 테이블: 일반 code block (간소화 테이블)
- [ ] Scope cuts: bold + inline (`**✂ Scope Cuts:** ...`)
- [ ] 가정: diff 블럭
- [ ] 페르소나: bold + 리스트
- [ ] Implementation Prompt: blockquote 유지

### /rehearse (SKILL.md)

- [ ] "Output card" 전면 교체
- [ ] 바꿔야 할 것: 넘버 리스트
- [ ] 페르소나별: bold 헤더 + diff 블럭 (리스크) + blockquote (발언)
- [ ] Devil's Advocate: diff 블럭
- [ ] 💡: blockquote
- [ ] severity quick action: 인라인 코드

### /refine (SKILL.md)

- [ ] "Output card" 전면 교체
- [ ] 변경 사항: 마크다운 테이블 (`| # | 변경 | 이유 |`)
- [ ] 페르소나 재평가: diff 블럭 (before/after)
- [ ] 미해결: 일반 리스트
- [ ] 수렴 지표: 간소화

### /argus (SKILL.md)

- [ ] 각 단계별 output 포맷을 위 개별 스킬과 동기화
- [ ] 파이프라인 진행: diff 블럭
- [ ] DQ 스코어: code block (정렬)
- [ ] Anti-sycophancy: diff 블럭
- [ ] Deliverables 포맷: 각각 적절한 마크다운

---

## 7. 주의사항

### diff 블럭 남용 경계
- diff 블럭이 많으면 "코드 리뷰처럼" 보임
- 한 스킬 output에서 diff 블럭은 **2-3개 이하** 유지
- 가정 구분, 핵심 질문 강조, before/after 비교에만 사용

### LLM 렌더링 일관성
- 마크다운은 Claude Code가 렌더링하므로 code block보다 일관적
- 하지만 LLM이 bold 마크업(`**`)을 빼먹을 수 있음 → 프롬프트에 예시를 명확히
- 테이블 정렬은 여전히 code block 안에서만 안정적

### 헤더 (`##`) 비신뢰
- Claude Code에서 헤더 위계가 제거되는 알려진 이슈 (#26390)
- 섹션 구분은 `**bold**` + `---` 조합으로 대체
- 또는 `**🎯 Reframe**` 형태의 emoji + bold 조합

### 웹앱 연동 (장기)
- 현재 Argus 웹앱과 연결 시 HTML 카드 렌더링 가능
- 스킬이 `.argus/*.md`에 저장하는 Context Contract는 그대로 유지
- 웹앱이 Contract를 파싱해서 리치 UI로 렌더링하는 구조 가능
- 터미널 output과 웹 UI를 이원화: 터미널=요약, 웹=풀 카드

---

## 8. 작업 순서 제안

1. `/reframe` SKILL.md 먼저 수정 (가장 많이 쓰는 단일 스킬)
2. 테스트 실행 2-3회 → 렌더링 확인
3. `/recast` 수정
4. `/rehearse` 수정
5. `/refine` 수정
6. `/argus` 수정 (개별 스킬 포맷 확정 후)
7. 나머지 유틸리티 스킬 (`/configure`, `/patterns`, `/doctor`, `/setup`) → 이들은 현재도 심플해서 우선순위 낮음
