# Plugin CLI Design Upgrade Plan

> 2026-03-27 | 다른 기기에서 이어서 작업하기 위한 설계 문서

## 현재 상태 진단

### 쓰고 있는 것
- Unicode box-drawing (`╭╮╰╯┌┐└┘━─│`)
- 심볼 어휘 (`■ ▸ · ● ○ ✓ ✗ ? █░`)
- 전체 출력이 하나의 ` ``` ` 코드블록 안에 감싸짐
- 모노스페이스 정렬, 컬러 없음

### 안 쓰고 있는 것 (쓸 수 있는데)
- `**Bold**`, `*italic*` — 코드블록 밖 마크다운 → ANSI bold/italic 렌더링
- ` ```diff ` — `+초록` / `-빨강` 구문 강조 (유일한 간접 컬러 제어)
- ` ```yaml `, ` ```json `, ` ```python ` — 언어별 구문 강조 색상
- 마크다운 테이블 — 파이프 구분 자동 정렬
- 코드블록 ↔ 산문 교차 — 시각적 리듬감
- 블록인용 (`>`) — 들여쓰기 + 시각적 구분

### 핵심 문제
1. **단조로움** — 모든 섹션이 같은 `■` 헤더 + 같은 밀도로 이어짐
2. **컬러 부재** — 모노크롬이라 위험도/중요도 구분이 텍스트에만 의존
3. **리듬 없음** — 하나의 거대한 코드블록이라 "숨 쉴 틈"이 없음
4. **Devil's Advocate 기초적** — 가장 임팩트 있어야 할 부분이 가장 밋밋함

---

## 사용 가능한 무기 정리

### 확인된 Claude Code 렌더링 지원

| 기법 | 작동 | 비고 |
|------|------|------|
| `**Bold**` | O | 코드블록 밖에서만 |
| `*Italic*` | O | `_underscore_` 형태는 snake_case와 충돌 주의 |
| ` ```diff ` | O | `+`줄 초록, `-`줄 빨강 |
| ` ```yaml/json/python ` | O | 키워드별 구문 강조 |
| 마크다운 테이블 | O | 정렬 약간 불안정할 수 있음 |
| 블록인용 `>` | O | 단일 레벨만 |
| `# Header` | X | 무시됨 — bold로 대체 |
| ~~취소선~~ | X | 무시됨 |
| ANSI 이스케이프 직접 | X | 모델 출력에서 불가 |
| 배경색 | X | 불가 |
| shimmer/애니메이션 | X | 렌더러 자체 기능 |

### 핵심 원칙
- 색상은 `diff` 블록으로만 간접 제어 가능
- 구조적 시각 변화는 코드블록/마크다운 교차로 만들어야 함
- Windows 터미널에서 Unicode box-drawing이 깨질 수 있음 (이미 쓰고 있으니 유지)

---

## 설계 방향: 3가지 축

### 축 1: 하이브리드 렌더링 (코드블록 ↔ 마크다운 산문)

**현재:** 전체가 하나의 코드블록
```
  ╭──────────────────────────────╮
  │  Argus · Reframe          │
  ╰──────────────────────────────╯
  ■ Analysis
    [you asked:]
    "[original]"
    [the real question:]
    ...60줄 연속...
```

**개선:** 구조 데이터는 코드블록, 해설은 마크다운
```
  ╭──────────────────────────────╮
  │  Argus · Reframe          │
  │  ● Interview  ● Assumptions  │
  ╰──────────────────────────────╯
```
**The real question isn't** *whether to expand* — **it's whether your team can execute before the window closes.**

```
  ■ Hidden Assumptions
    1  ✓  Market demand exists
    2  ✗  Team has capacity
    3  ?  Timeline is realistic
```

> This creates **rhythm**: dense data → breathing room → dense data → insight

### 축 2: diff 블록으로 컬러 주입

가장 강력한 무기. 적재적소에 사용.

#### 용례 1: Reframe — 원본 vs 리프레이밍 비교
```diff
- 원래 질문: "AI 도입 전략을 어떻게 세울까?"
+ 진짜 질문: "6개월 안에 팀 50명이 실제로 쓸 수 있는 AI 워크플로우는 무엇인가?"
```

#### 용례 2: Refine — 수정 전후 비교
```diff
- Step 2: AI가 시장 분석 수행 (2주)
+ Step 2: AI 초안 → 현지 팀 검증 (1주 + 3일)
  이유: 현지 맥락 없이 AI만으로는 신뢰도 부족
```

#### 용례 3: Risk 강조
```diff
- [CRITICAL] 핵심 인재 2명이 이번 분기 퇴사 예정
  [manageable] 예산 10% 초과 가능성
+ [RESOLVED] 대체 인력 확보 + 인수인계 일정 반영
```

#### 용례 4: DQ Score — 점수 변화
```diff
- Framing      ███░░  3/5  (지난번)
+ Framing      ████░  4/5  (+1: 가정을 먼저 명시)
  Alternatives ███░░  3/5
- Reasoning    ██░░░  2/5  (개선 필요)
```

#### 용례 5: Devil's Advocate — 가장 아픈 말
```diff
- [FATAL] 이 계획은 고객 검증 0건으로 진행됩니다.
- TAM 분석은 수요가 아닙니다. 5명만 만나면 3개월을 절약할 수 있습니다.
```

### 축 3: 구문 강조로 구조 문서 컬러링

#### Agent Harness → yaml
```yaml
mission: "6개월 안에 팀 50명이 쓸 수 있는 AI 워크플로우 설계"

steps:
  - name: "현지 고객 5명 인터뷰"
    owner: human
    deliverable: "인터뷰 요약 + 패턴 분석"
    checkpoint: true

  - name: "시장 규모 분석"
    owner: ai
    deliverable: "TAM/SAM/SOM + 3개 시나리오"

constraints:
  - "현지 팀 리소스 2명 한정"
  - "규제 검토 완료 전 실행 불가"

risks:
  critical: "핵심 인재 이탈"
  unspoken: "VP의 실제 동기는 가시성"
```

#### Thinking Summary → 마크다운 bold/italic 활용 (코드블록 밖)

**TL;DR:** 시장 진출이 아니라 *팀의 실행 역량 검증*이 선행되어야 합니다.

**원래 질문 → 진짜 질문:**
- 물어본 것: "동남아 진출 전략"
- 진짜 질문: **"우리 팀이 해외 운영을 감당할 수 있는가?"**

---

## 스킬별 개선 구체안

### /reframe

| 현재 | 개선 |
|------|------|
| 전체 하나의 코드블록 | 인터뷰 = 코드블록, 분석 = 하이브리드 |
| 원본/리프레임 텍스트만 나열 | `diff` 블록으로 빨강/초록 비교 |
| "What you didn't see" 같은 weight | **bold** + 블록인용으로 시각적 강조 |
| Sharpened Prompt 코드블록 안 | 별도 코드블록 or 블록인용으로 분리 |

**"What you didn't see" 새 포맷:**

---

> **What you didn't see**
> *You were solving a technology problem, but this is a people problem.*

---

### /recast

| 현재 | 개선 |
|------|------|
| Execution Steps 모두 같은 `┌┐└┘` 박스 | Human/AI/Both 박스 스타일 분화 |
| Key Assumptions 텍스트만 | Confidence가 낮은 것은 `diff -` 강조 |
| Storyline 텍스트 나열 | Situation/Complication/Resolution 각각 시각 구분 |

**실행 단계 Actor별 시각 분화:**

```
  ┌─ Step 1 ─────────────────── 🧑 Human ──┐
  │  ...                                     │
  └──────────────────────────────────────────┘
```
```
  ╔═ Step 2 ═══════════════════ 🤖 AI ═════╗
  ║  ...                                     ║
  ╚══════════════════════════════════════════╝
```
```
  ┏━ Step 3 ━━━━━━━━━━━━━━━━━━ ⚡ Both ━━━┓
  ┃  AI does: ...                            ┃
  ┃  Human does: ...                         ┃
  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### /rehearse

| 현재 | 개선 |
|------|------|
| 모든 페르소나 같은 포맷 | influence별 헤더 스타일 분화 |
| Risk 태그 `[critical]` 텍스트 | `diff` 블록으로 critical 빨간색 |
| Devil's Advocate 밋밋함 | **가장 강한 시각적 treatment** 적용 |
| Bottom Line 위치가 첫 섹션 | 유지하되 bold 마크다운으로 강조 |

**Risk 분류 새 포맷 (rehearse 전용):**

```diff
- [critical]  핵심 인재 이탈로 프로젝트 6개월 지연
```
```
  [manageable] 예산 10% 초과 → 긴급예비비로 대응 가능
```
```diff
- [unspoken]  이 프로젝트의 실제 목적은 VP의 승진 실적
```

**Devil's Advocate 새 포맷:**

기존의 가장 basic한 포맷에서 → 가장 시각적으로 강한 포맷으로:

```
  ╭──────────────────────────────────────────╮
  │  ⚡ Devil's Advocate                      │
  ╰──────────────────────────────────────────╯
```

```diff
- Most realistic failure:
- 6개월 뒤 이 프로젝트는 멈춰 있을 것이다.
- 이유: 데이터 파트너십 계약이 3개월 걸리는데
- 아무도 그걸 일정에 반영하지 않았다.
```

> **The silent problem:**
> *모두가 알지만 아무도 말하지 않는 것 —*
> *이 이니셔티브는 사업적 필요가 아니라 VP의 가시성을 위해 승인되었다.*

```diff
- Regret test (1년 후):
- 고객 5명만 먼저 만났더라면 3개월을 절약했을 것이다.
- TAM 숫자는 수요가 아니다.
```

### /refine

| 현재 | 개선 |
|------|------|
| 변경사항 텍스트 나열 | `diff` 블록으로 before/after |
| Convergence 텍스트 | 시각적 진행 바 + 텍스트 |
| Re-test 숫자만 | `diff` 색상으로 개선/악화 표시 |

**Convergence 시각화:**

```
  ■ Convergence

    Critical:   ██░░░  2 → ░░░░░  0  ✓
    Manageable: ███░░  3    ██░░░  2
    Conditions: █░░░░  1/4  ███░░  3/4
```
```diff
+ Status: Converged after 2 rounds ✓
```

### /argus (풀 파이프라인)

| 현재 | 개선 |
|------|------|
| breadcrumb 텍스트만 | diff 블록으로 완료 단계 초록 표시 |
| DQ Score 코드블록 안 | 점수 변화 diff + 해석 마크다운 |
| 3 deliverables 같은 레벨 | 각각 다른 렌더링 전략 |

**Pipeline breadcrumb 새 포맷:**

```diff
+ reframe ●  완료
```
```
  recast  ○  다음
  rehearse ○
  refine   ○
```

**Deliverable별 최적 렌더링:**

| Deliverable | 렌더링 전략 |
|-------------|------------|
| Sharpened Prompt | 블록인용 (`>`) — 즉시 복사 가능한 느낌 |
| Thinking Summary | 마크다운 bold/italic — 이메일처럼 |
| Agent Harness | ` ```yaml ` — 구조 문서답게 |
| DQ Scorecard | 코드블록 (바 차트) + `diff` (점수 변화) |

### /help

| 현재 | 개선 |
|------|------|
| 전체 코드블록 | 설명은 마크다운, 명령어 목록은 코드블록 |
| 평면적 나열 | 핵심 2개 bold 강조 |

---

## 구현 순서 (추천)

### Phase 1: 기반 패턴 확립 (가장 효과 큼)
1. **하이브리드 렌더링 규칙** — 모든 SKILL.md의 Output 섹션 업데이트
   - "코드블록 안에 모든 것" → "구조 = 코드블록, 해설 = 마크다운"
2. **diff 블록 도입** — /reframe의 원본 vs 리프레이밍 비교부터
3. **Devil's Advocate 비주얼 강화** — 가장 기초적이니 가장 큰 개선

### Phase 2: 스킬별 적용
4. /reframe — diff 비교, "What you didn't see" 블록인용
5. /rehearse — Risk diff 컬러, 페르소나 카드 분화
6. /recast — Actor별 박스 스타일, yaml 하네스
7. /refine — before/after diff, convergence 시각화

### Phase 3: 파이프라인 통합
8. /argus — breadcrumb diff, deliverable별 최적 렌더링
9. /help — 하이브리드 렌더링

### Phase 4: 검증
10. 실제 실행 후 렌더링 확인 (특히 diff 블록 색상)
11. Windows 터미널 테스트

---

## 변경 대상 파일

```
argus-plugin/skills/reframe/SKILL.md        ← Output 섹션 전면 개편
argus-plugin/skills/recast/SKILL.md         ← Step 박스 분화, yaml 하네스
argus-plugin/skills/rehearse/SKILL.md       ← Risk diff, 페르소나 분화
argus-plugin/skills/refine/SKILL.md         ← diff before/after, convergence
argus-plugin/skills/argus/SKILL.md       ← deliverable 렌더링, breadcrumb
argus-plugin/skills/help/SKILL.md           ← 하이브리드 렌더링
argus-plugin/agents/devils-advocate.md       ← 비주얼 대폭 강화

.claude/skills/ 하위 동일 파일들                  ← 위와 동기화
```

---

## 주의사항

1. **과하지 않게** — diff 블록은 진짜 중요한 곳에만. 모든 텍스트를 diff로 감싸면 의미 없음
2. **기능적으로** — 색상은 장식이 아니라 의미 전달 (빨강=위험/삭제, 초록=해결/추가)
3. **Windows 호환** — diff 블록은 Windows에서도 안정적. box-drawing보다 오히려 안전
4. **코드블록 밖 마크다운은 짧게** — 길어지면 줄바꿈 이슈. 1-2문장 단위로
5. **diff 블록 안에서 한글** — `+`/`-` 뒤 공백 필수, 한글 렌더링 확인 필요
6. **기존 구조 유지** — 박스 헤더, 심볼 어휘 등은 브랜드 아이덴티티. 개선이지 교체 아님
