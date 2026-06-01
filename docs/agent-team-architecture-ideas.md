# Agent Team Architecture: Invisible Structure + LLM-Native Design

> 2026-04-03. BMAD 비교 분석 + 확률적 품질 문제 논의에서 도출.
> 핵심 문제: /blindspot의 날카로움이 확률적이다. 구조를 넣되 사용자에게 보이지 않게.

---

## 1. 핵심 테제: 보이지 않는 구조

BMAD는 사용자가 12단계를 밟는다 (보이는 구조). ChatGPT는 구조 없이 LLM 판단에 의존한다.
Argus의 자리: **에이전트 팀이 구조를 실행하고, 사용자는 결과만 받는다.**

```
사용자: "이 계획 봐줘" (30초)
         ↓ keyword matching → 관련 agent 2-3명 자동 선택
         ↓
    동혁: Pre-mortem        ← 병렬
    민재: 숫자 검증          ← 병렬
    현우: 전략 구멍 탐색      ← 병렬
         ↓ orchestrator가 가장 날카로운 1개 선택
         ↓
사용자: 💀 결과 1개 (10줄 이내)
```

- 사용자 경험: 변화 없음 (30초, 질문 없음, 결과 1개)
- 내부: 복수 에이전트가 각자의 framework로 분석
- 바닥: framework이 최소 품질 보장
- 천장: 3배 시도이므로 적중 확률 상승

---

## 2. LLM이 잘 실행하는 Named Frameworks

LLM은 이름이 있는 방법론을 잘 실행한다. 훈련 데이터에 HBR, McKinsey blog, MBA 교재, tech blog 등에서 대량의 적용 사례가 포함되어 있기 때문. "날카로워라"는 모호하지만 "Pre-mortem을 실행해라"는 구체적 절차가 있다.

### Tier 1: 매우 풍부한 훈련 데이터 (자신 있게 사용)

| Framework | 출처 밀도 | 적합한 Agent | 활용 |
|---|---|---|---|
| **Pre-mortem** (Gary Klein) | HBR, 경영서 다수 | 동혁 Critic | "실패했다고 가정하고 원인 역추적" |
| **SWOT** | MBA 교과서, 블로그 수만 건 | 현우 Strategist | 기본 전략 분석 |
| **Porter's 5 Forces** | 경영학 표준 | 현우 Strategist | 산업 구조 분석 |
| **Jobs-to-be-Done** (Christensen) | HBR, Intercom blog | 현우 Strategist | 고객 니즈 프레이밍 |
| **MECE** (McKinsey) | 컨설팅 블로그 대량 | 수진 Researcher | 분석 구조화 |
| **Pyramid Principle** (Minto) | 컨설팅 커뮤니케이션 표준 | 서연 Copywriter | 문서 구조화 |
| **Socratic Method** | 철학+교육 문헌 대량 | Orchestrator | 질문으로 깊이 파기 |
| **Devil's Advocate** | 법학+토론+군사 | 동혁 Critic | 반론 생성 |
| **Red Team / Blue Team** | 군사+사이버보안 | 동혁 Critic | 공격자 관점 분석 |
| **Design Thinking** (IDEO) | 디자인+비즈니스 대량 | 지은 UX | 사용자 중심 분석 |
| **Root Cause / 5 Whys** | 제조+소프트웨어 대량 | 동혁 Critic | 근본 원인 추적 |
| **Unit Economics** | 스타트업 블로그 대량 | 민재 Numbers | 수익 구조 검증 |
| **TAM/SAM/SOM** | 투자/스타트업 표준 | 민재 Numbers | 시장 규모 추정 |
| **Stakeholder Mapping** | PM/경영 문헌 | 예린 PM | 이해관계자 파악 |

### Tier 2: 풍부한 훈련 데이터 (안정적으로 사용)

| Framework | 적합한 Agent | 활용 |
|---|---|---|
| **Assumption Mapping** | 동혁 Critic | 전제 분류 (중요도 × 확실성) |
| **Six Thinking Hats** (de Bono) | Orchestrator | 다중 관점 전환 |
| **Inversion** (Charlie Munger) | 동혁 Critic | "어떻게 하면 확실히 망할까?"에서 역추적 |
| **Regret Minimization** (Bezos) | Orchestrator | 장기 의사결정 |
| **Scenario Planning** (Shell) | 현우 Strategist | 복수 미래 시나리오 |
| **Business Model Canvas** | 현우 Strategist | 비즈니스 모델 전체 조망 |
| **ICE/RICE Scoring** | 예린 PM | 우선순위 |
| **Sensitivity Analysis** | 민재 Numbers | "이 숫자가 2배 틀리면?" |
| **Heuristic Evaluation** (Nielsen) | 지은 UX | UX 품질 체크 |
| **PREP** (Point-Reason-Example-Point) | 서연 Copywriter | 설득 구조 |
| **Amazon 6-Page Memo** | 서연 Copywriter | 장문 의사결정 문서 |
| **PRFAQ** (Amazon) | 서연 Copywriter | 역방향 제품 기획 |
| **FMEA** (Failure Mode Effects) | 동혁 Critic | 체계적 고장 모드 분석 |
| **Eisenhower Matrix** | 예린 PM | 긴급/중요 분류 |

### Tier 3: 있지만 실행 품질 불안정 (가이드 보강 필요)

| Framework | 주의점 |
|---|---|
| **Monte Carlo Simulation** | 개념은 알지만 실제 계산은 코드 필요 |
| **DCF Valuation** | 공식은 아는데 가정 품질이 문제 |
| **Grounded Theory** | 절차는 아는데 실제 데이터 없이 빈약 |
| **Wardley Mapping** | 훈련 데이터 상대적으로 적음 |

---

## 3. LLM의 숨은 강점 — Agent 설계에 활용

LLM이 특히 잘하는 것 중 현재 agent 설계에 충분히 활용되지 않는 것들:

### 3-1. Cross-domain Analogy (도메인 간 유추)
LLM은 모든 도메인의 데이터를 동시에 학습했기 때문에, "이 문제는 다른 분야에서 이미 풀렸다"를 찾는 데 인간보다 빠르다.

**활용:** 수진(Researcher)이나 새 Agent에게 "이 문제와 구조적으로 유사한 다른 산업의 사례를 찾아라" task 부여. 예: "물류 자동화 → 이건 제조업의 MES 도입과 같은 구조다."

### 3-2. Register Translation (언어 레지스터 변환)
같은 내용을 기술→경영, 학술→일상, 한국어→영어로 재구성하는 능력이 매우 강함. 훈련 데이터에 번역, 요약, 편집 사례가 대량.

**활용:** 이미 /argus의 vocabulary bridge가 이걸 쓰고 있음. 서연(Copywriter)의 핵심 역할로 강화 가능. "개발자가 쓴 스펙을 대표님이 읽을 수 있는 1페이지로."

### 3-3. Adversarial Critique (적대적 비평)
LLM은 토론, 법정 변론, 논문 peer review, 코드 리뷰 데이터를 대량 학습함. "이 주장의 약점을 찾아라"에 매우 강함.

**활용:** 동혁(Critic)의 핵심 강점. 하지만 현재 혼자 동작한다. **에이전트 간 debate** (동혁이 현우의 전략을 공격)으로 확장 가능.

### 3-4. Structured Output Generation
JSON, YAML, 테이블, diff 형식의 structured output을 매우 안정적으로 생성. 훈련 데이터에 코드+문서가 대량.

**활용:** Agent 결과를 structured format으로 받으면 orchestrator의 비교/선택이 용이해짐. 자유 텍스트보다 `{ blindspot, severity, specificity_score, evidence }` 형태가 처리하기 좋다.

### 3-5. Persona Consistency (페르소나 유지)
소설, 대본, 롤플레이 데이터 대량 학습. 한 번 설정한 페르소나를 대화 전체에서 유지하는 능력이 강함.

**활용:** Boss agent가 이미 이걸 잘 쓰고 있음. 에이전트별 "성격"이 결과의 톤과 관점에 일관되게 반영되게.

---

## 4. 개별 Agent 강화 아이디어

### 동혁 (Critic) — 가장 중요한 Agent

현재: Pre-mortem, Red Team, Assumption Mapping, 2nd-order Effects
**추가해야 할 것:**

1. **Inversion 기법 추가**: "어떻게 하면 이 계획이 확실히 망할까?" → 역추적. LLM이 매우 잘 실행함.
2. **FMEA (Failure Mode Effects Analysis) 추가**: Pre-mortem보다 체계적. 각 실패 모드에 likelihood × impact 점수.
3. **Specificity 자체 검증**: 동혁의 output에 대해 "이건 아무 계획에나 붙일 수 있는 말인가?" self-check 단계 추가. /blindspot SKILL.md에 있는 구체성 테스트를 동혁의 checkpoint에 내장.
4. **Cross-reference with observations**: Lv.2+에서 "이 사용자가 과거에 놓친 것들"을 참조해서 같은 패턴이 반복되는지 확인.

### 민재 (Numbers)

현재: TAM/SAM/SOM, Unit Economics, Sensitivity Analysis
**추가:**

1. **Sanity Check 프로토콜**: 사용자가 제시한 숫자에 대해 "이 숫자가 맞으려면 어떤 가정이 필요한가?" 역검증. LLM이 잘하는 영역.
2. **Fermi Estimation**: "이 시장이 1조라고 했는데, 그러려면 사용자 수 × ARPU가 이래야 하는데, 현실적인가?" 훈련 데이터 풍부.
3. **Break-even 시나리오**: "이 사업이 BEP 찍으려면 몇 명이 필요한가?" 단순하지만 강력한 현실 체크.

### 현우 (Strategist)

현재: Porter 5F, SWOT, Value Chain, Jobs-to-be-Done
**추가:**

1. **Competitive Response Simulation**: "경쟁사가 이걸 보면 뭘 할까?" — 게임 이론적 사고. LLM이 잘함.
2. **Scenario Planning (Shell method)**: 2-3개 미래 시나리오를 만들고, 각 시나리오에서 이 계획이 살아남는지 테스트.
3. **Blue Ocean / Red Ocean 판별**: "이건 기존 시장에서 싸우는 건가, 새 시장을 만드는 건가?" — 전략의 방향성 질문.

### 서연 (Copywriter)

현재: PREP, Pyramid Principle, One Message Rule
**추가:**

1. **Audience Adaptation**: 같은 내용을 대표용 / 팀장용 / 투자자용으로 변환. Register Translation 강점 활용.
2. **Amazon Memo Format**: 6-page memo, PRFAQ. 이건 LLM 훈련 데이터에 매우 풍부.
3. **"So What?" 테스트**: 각 문단마다 "그래서 뭐?" 검증. McKinsey의 So What/Why So.

### 수진 (Researcher)

**추가:**

1. **Cross-domain Pattern Matching**: "이 문제는 다른 산업에서 어떻게 풀렸는가?" — LLM의 가장 독특한 강점.
2. **Source Quality Assessment**: "이 주장의 근거가 1차 자료인가 2차 자료인가?" — 이미 MECE에 포함되어 있지만 별도 checkpoint으로.
3. **Counter-evidence Search**: 사용자의 가설을 지지하는 증거만 찾지 말고, 반증도 찾아라.

### 태준 (Legal)

**추가:**

1. **Regulatory Landscape Mapping**: "이 사업이 걸리는 규제가 뭐가 있는가?" 도메인별 규제 목록.
2. **IP Risk Pattern**: "이거 특허 침해 가능성은?" — LLM이 특허 문서를 많이 학습함.

### 지은 (UX)

**추가:**

1. **User Scenario Stress Test**: 제안된 UX에 대해 "최악의 사용자 시나리오"를 생성. "인터넷이 느린 환경에서", "시니어 사용자가", "처음 온 사람이".
2. **Heuristic Evaluation 체크리스트**: Nielsen의 10가지 휴리스틱을 체크포인트로.

---

## 5. Orchestrator (악장/Concertmaster) 설계

현재 악장은 total_tasks 30에 unlock. 하지만 orchestration 기능 자체가 정의되어 있지 않다. 이것이 가장 중요한 빈 칸.

### Orchestrator의 역할

```
Input Analysis → Agent Selection → Dispatch → Collection → Synthesis → Output
```

### 5-1. Input Analysis

사용자 입력을 분석해서:
- **도메인 태그** 추출 (기술, 전략, 재무, 법률, UX, ...)
- **판단 유형** 분류 (새 시작 vs 방향 전환 vs 검증 vs 위기 대응)
- **Stakes 수준** 추정 (일상적 vs 중요 vs 치명적)

Stakes 수준에 따라 동원 에이전트 수가 달라진다:
- 일상적: 1명 (가장 관련 높은 agent)
- 중요: 2-3명 (관련 agent + 동혁 Critic)
- 치명적: 3-4명 (복수 관점 + debate)

### 5-2. Agent Selection Logic

현재 keyword matching만 있음. 강화 방안:

```
1차: keyword matching (현재)
2차: observation 기반 보정
     - "이 사용자는 숫자를 자주 놓친다" → 민재 우선 투입
     - "이 사용자는 법적 리스크를 간과한다" → 태준 우선 투입
3차: 도메인 태그 × agent group 매핑
     - 기술 도메인 → 준서 + 동혁
     - 재무 도메인 → 민재 + 동혁
     - 전략 도메인 → 현우 + 동혁
```

동혁(Critic)은 거의 항상 포함. 다른 agent는 도메인에 따라.

### 5-3. Dispatch Protocol

각 agent에게 보내는 것:
```
{
  input: 사용자 원문,
  framework: 실행할 named methodology (agent skill set에서 선택),
  focus: "이 관점에서 가장 위험한 1가지를 찾아라",
  format: structured output (blindspot, severity, evidence, specificity),
  agent_context: accumulated observations (Lv.2+)
}
```

**중요: "가장 위험한 1가지"로 제한.** 각 agent가 3-5개 나열하면 orchestrator 부담이 커진다.

### 5-4. Collection + Synthesis

Agent 결과를 받아서:

```
1. Specificity 검증: "이건 아무 계획에나 붙일 수 있는 말인가?"
   → 통과 못하면 탈락
   
2. Overlap 제거: 두 agent가 같은 문제를 짚었으면 merge
   
3. 날카로움 랭킹:
   - Specificity: 사용자 입력의 구체적 단어/숫자를 인용하는가?
   - Non-obviousness: 사용자가 이미 알 확률이 낮은가?
   - Actionability: 지금 당장 할 수 있는 수정이 있는가?
   - Agent confidence: 이 agent의 observation track record
   
4. 최종 선택: 1개 (기본) 또는 2-3개 (사용자가 "더 없어?" 시)
```

### 5-5. Cross-Agent Debate (고급 모드)

Stakes가 높은 입력일 때:

```
Round 1: 각 agent가 독립적으로 blindspot 1개 제출
Round 2: 동혁이 다른 agent의 결과를 받아서 "이것도 문제지만 진짜 문제는 이거다" 반론
Round 3: Orchestrator가 Round 1 + Round 2를 종합
```

이건 BMAD의 "Party Mode"와 유사하지만, 각 agent가 named framework을 쓰기 때문에 generic debate보다 구체적.

---

## 6. Feedback Loop — 확률적 → 학습하는 제품

### 현재 있는 것

```
task_approved → +10 XP, reinforceObservation (+0.15 confidence)
task_rejected → -5 XP
observations → agent context에 주입 (Lv.2+)
```

### 추가해야 할 것

#### 6-1. Blindspot-specific 반응 수집

/blindspot 결과에 대해:
```
- "몰랐다" (hit) → observation: "이 유형의 blindspot이 유효했다" + reinforce
- "이미 알아" (miss) → observation: "이 유형은 이 사용자에게 뻔하다" + contest (-0.2)
- "중요하지 않아" (irrelevant) → observation: "이 도메인에서 이건 우선순위가 낮다"
```

이 세 가지 반응만 수집하면 calibration이 시작된다.

#### 6-2. Hit Rate Dashboard

```
동혁 hit rate: 7/10 (70%) — 최근 10회
민재 hit rate: 3/10 (30%) — 이 사용자에겐 숫자 검증이 뻔한 듯
현우 hit rate: 5/10 (50%)
```

이걸 Orchestrator가 참조: 민재 대신 다른 agent를 투입하거나, 민재의 framework을 바꾸거나.

#### 6-3. Pattern-based Pre-selection

20회 이상 사용 후:
```
"이 사용자가 가장 자주 놓치는 것: 타임라인 (4/7 hit), 경쟁 대응 (3/5 hit)"
"이 사용자가 절대 놓치지 않는 것: 기술 구현 (0/6 hit), 법적 리스크 (1/4 hit)"
```

→ Orchestrator가 타임라인/경쟁 대응 관련 agent를 우선 배치.

---

## 7. Cold Start 전략 (1-5회차)

Observation이 없는 초기에는:

1. **Framework이 바닥 역할**: named methodology가 generic 분석보다 안정적
2. **Default 편성**: 동혁(Critic) + 도메인 맞는 agent 1명 = 최소 2명
3. **첫 반응 수집을 적극적으로**: "이 분석이 도움 됐어?" 물어서 calibration 시작
4. **사용자 프로필 활용**: memory에서 user_role, 과거 프로젝트 정보 참조 → 초기 agent 선택에 반영

---

## 8. /blindspot, /rehearse, /argus 연결

### /blindspot + Agent Team

```
현재: 단일 프롬프트 → 1 LLM call → 결과
개선: Orchestrator → 2-3 agents (parallel) → 선택 → 결과
사용자 경험: 동일 (30초, 1개 결과)
```

### /rehearse + Agent Team

```
현재: 판단자 페르소나를 LLM이 즉석 생성
개선: Boss agent (MBTI+사주) 또는 Stakeholder agent 활용
     + 동혁이 Boss의 반응을 "이건 진짜 이렇게 나올까?" 검증
```

### /argus + Agent Team

```
현재: 단일 세션에서 질문 → 초안 → 시뮬레이션
개선: Step 2 deepening에서 수진(Researcher)이 배경 조사 병렬 수행 (이미 설계됨)
     Step 3 Mix에서 서연(Copywriter)이 문서 구조화
     Step 4 DM에서 Boss agent 또는 Stakeholder agent가 시뮬레이션
     각 단계에서 에이전트의 observation이 축적
```

---

## 9. 해자 분석

| 요소 | 복제 가능성 | 시간에 따른 가치 |
|---|---|---|
| Agent skill frameworks | 높음 (prompt 복사 가능) | 정적 |
| Named methodology 목록 | 높음 (공개 지식) | 정적 |
| Orchestration logic | 중간 (설계 + 구현 필요) | 느린 성장 |
| **Accumulated observations** | **낮음 (사용자별 고유)** | **복리 성장** |
| **Hit rate calibration** | **낮음 (사용 데이터 필요)** | **복리 성장** |
| **User-specific agent levels** | **낮음 (시간 투자 필요)** | **복리 성장** |

**진짜 해자는 축적되는 것들이다.** Framework은 복사할 수 있지만, "이 사용자와 20번 작업하면서 calibrated된 동혁"은 복사할 수 없다.

---

## 10. 우선순위 제안

### P0 — 지금 바로

1. **동혁(Critic) skill set 강화**: Inversion, FMEA, Specificity self-check 추가
2. **/blindspot ↔ agent store 연결**: blindspot이 agent task로 실행되도록
3. **반응 수집 UX**: blindspot 결과 후 "몰랐다/이미 알아" 1-tap 반응

### P1 — 다음

4. **Orchestrator 기본 로직**: input analysis → agent selection → dispatch → collection
5. **민재, 현우 skill set 강화**: Sanity Check, Competitive Response 추가
6. **Observation → Orchestrator 연결**: hit rate 기반 agent 선택 보정

### P2 — 축적 후

7. **Cross-Agent Debate**: 고위험 입력 시 에이전트 간 반론
8. **Pattern Dashboard**: 사용자 blindspot 패턴 시각화
9. **Concertmaster 자동 편성**: 사용 데이터 기반 최적 에이전트 조합 학습
