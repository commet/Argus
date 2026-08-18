# ARGUS METHOD v0.1

## 능동적 판단 코칭 · 결정 실행 · 현실 귀환 · 반복 학습

Date: 2026-08-03  
Status: **Founder-directed method baseline; implementation is not authorized**  
Blueprint track: **R0–R3 planning and evidence**  
Scope: web app, MCP, plugin, and future surfaces  

---

## 0. 이 문서의 지위

이 문서는 기존 구현을 설명하거나 정당화하기 위한 문서가 아니다. Argus가 어떤
인간 문제를 해결하고, 어떤 방법으로 가치를 만들며, 그 방법이 언제 실패했다고
판정할지를 원점에서 다시 정한다.

기존 코드와 문서는 세 종류의 입력일 뿐이다.

1. 이미 검증된 무결성 원칙
2. 다시 사용할 수 있는 구현 자산
3. 제품 가치를 방해한 역사적 제약과 실패 사례

기존에 존재한다는 이유만으로 어떤 flow, object, page, route, agent, store도
승계하지 않는다. 반대로 기존 구현과 충돌한다는 이유만으로 좋은 방법을 포기하지
않는다. 방법이 먼저이고, architecture와 migration은 그 다음이다.

R0–R3 동안 공개 사용자 흐름과 canonical storage를 바꾸지 않는다. 이 문서의
방법론이 사례·비교·사용자 검증을 통과한 뒤에만 R4에서 구현 수렴안을 작성한다.

---

## 1. 원점 판정

### 1.1 지금까지 강하게 만든 것

Argus는 다음 무결성 문제를 깊게 다뤘다.

- AI 제안과 사용자 채택의 분리
- 누가 무엇을 언제 말하고 승인했는지에 대한 provenance와 authority
- 과거 기록의 비덮어쓰기
- 당시 판단과 사후 관찰의 시간 분리
- 관찰, 해석, 종결의 분리
- 사용자에 대한 성격·등급·승률 판정의 제한

이것은 버릴 기반이 아니다. 다만 이것만으로 사용자가 첫 세션에서 얻는 도움은
충분하지 않다.

### 1.2 지금까지 약하게 만든 것

Argus는 다음 질문에 일관된 답을 갖지 못했다.

- 좋은 판단 과정은 무엇으로 구성되는가?
- 이 사람의 현재 결정에서 가장 약한 부분은 무엇인가?
- 질문, 반론, 조사, 대안 생성, 추천 중 지금 무엇을 해야 하는가?
- 충분히 생각했다는 중단 조건은 무엇인가?
- 결정하지 않기, 실험하기, 보류하기는 언제 더 좋은가?
- 현실이 돌아온 뒤 결과와 과정과 운을 어떻게 구분하는가?
- 한 번의 회고가 언제 다음 판단에 쓸 만한 학습이 되는가?

기존 흐름은 premise를 발견하고 검토하는 데 과도하게 집중했다. 그러나 실제 결정은
사실 전제만으로 이루어지지 않는다. 가치, 대안, 제약, 예측, trade-off, 권한,
실행 가능성이 서로 다른 역할을 한다.

### 1.3 핵심 교정

원장은 방법론이 아니다.

```text
판단 방법론이 무엇을 다룰지 결정한다.
원장은 그 과정을 정직하게 보존한다.
LLM은 그 방법을 낮은 마찰로 능동적으로 실행한다.
각 표면은 같은 방법 상태를 상황에 맞게 보여준다.
```

---

## 2. 제품 방향

### 2.1 한 문장

> **Argus는 중요한 결정을 내리는 사람이 결정의 진짜 분기점을 찾고, 충분한
> 도움을 받아 다음 행동을 정하며, AI와 함께 바뀐 자신의 판단을 정직하게 남기고,
> 나중에 현실의 답으로 다음 판단 방식을 개선하게 하는 판단 학습 시스템이다.**

### 2.2 네 가치 순간

1. **코칭 — 지금 더 잘 생각한다.**  
   질문만 하지 않는다. 프레임 교정, 가치 명료화, 대안 생성, 근거 확인, 반론,
   시뮬레이션, 실험 설계, 조건부 추천을 능동적으로 제공한다.

2. **결정 — 생각을 다음 상태로 옮긴다.**  
   결론 강요가 아니라 결정, 조사, 실험, 보류, 철회 중 적합한 다음 상태를
   사용자가 선택할 수 있게 한다.

3. **정직한 연속성 — 무엇이 누구의 말인지 잃지 않는다.**  
   AI가 도움을 많이 줄수록 provenance와 human adoption은 더 중요해진다.

4. **학습 — 현실로부터 다음 판단 방식을 개선한다.**  
   결과를 맞고 틀림으로 채점하지 않고, 당시 과정·불확실성·운·새 관찰을 나눈다.

### 2.3 첫 세션과 장기 가치

```text
첫 세션 가치 = 더 좋은 이해 + 더 좋은 다음 행동
신뢰 기반      = 저자성 + 출처 + 시간 무결성
장기 차별성    = 정교한 귀환
최종 가치      = 반복 귀환에서 만들어진 재사용 가능한 판단 학습
```

첫 세션이 약하면 사용자는 귀환까지 가지 않는다. 귀환이 약하면 Argus는 일반 AI
코치와 다르지 않다. 두 가치를 따로 설계하고 따로 검증한다.

### 2.4 하지 않는 주장

Argus는 다음을 약속하지 않는다.

- 정답이나 성공 결과
- 모든 결정에 같은 절차
- AI의 객관성 또는 완전한 중립
- 사용자의 성격·능력·판단력 점수
- 한 번의 경험에서 도출한 영구적 자기지식
- 여러 AI persona의 합의를 현실 증거로 취급하는 것
- 의료·법률·재무 전문가의 책임을 대체하는 것

---

## 3. 누구를 위한 첫 제품인가

### 3.1 초기 대상

첫 대상은 **결과가 늦게 나타나고, 되돌아볼 가치가 있으며, 한 명의 책임 있는
결정자가 있는 중요한 업무 판단**이다.

대표 사례:

- 제품 출시와 범위 결정
- 채용, 역할 변경, 팀 구성
- 가격, 시장, 파트너십, 고객 대응
- 사업 우선순위와 자원 배분
- 조직 운영상의 중요한 commitment
- 중요한 커리어 선택

초기 핵심 사용자는 창업자, 제품 책임자, 팀 리더, 독립 전문가처럼 비슷한 형태의
결정을 반복해서 내리는 사람이다. 반복성이 있어야 Return과 Learning의 누적 가치가
생긴다.

### 3.2 초기 비대상 또는 별도 route

- 단순 정보 검색
- 가벼운 일상 선택
- 해결보다 정서적 지지가 우선인 발화
- 자해·폭력·즉각적 위기
- 전문가 진단과 책임이 필요한 고위험 의료·법률·재무 판단
- 결정권자가 불분명한 복잡한 집단 의사결정
- 이미 닫혔고 다시 열기를 원하지 않는 결정

비대상은 거절과 동의어가 아니다. Argus는 도움을 주되 전체 Judgment Loop를
억지로 실행하지 않는다. 정보 요청에는 정보를, 감정적 상황에는 먼저 듣기와
안정을, 위기에는 적절한 안전 경로를 제공한다.

### 3.3 깊이는 하나의 방법 안에서 조절한다

별개의 light/heavy 철학을 만들지 않는다. 같은 방법을 결정 부담에 따라 더 깊게
실행한다.

```text
decision burden = stakes × irreversibility × uncertainty × coordination cost
```

이 식은 사용자 점수가 아니라 처리 깊이를 정하는 내부 개념이다.

- 낮고 되돌릴 수 있음: 빠른 조언 또는 작은 실험
- 중요하지만 되돌릴 수 있음: 핵심 가치·대안·불확실성 점검
- 중요하고 되돌리기 어려움: 전체 품질 점검, 외부 근거, 반대 검토

시간 압박과 분야 전문성도 함께 본다. 숙련자가 시간 압박 아래 내리는 자연주의적
판단을 무조건 긴 체크리스트로 해체하지 않는다. 필요하면 첫 plausible action을
mental simulation으로 검토하고 실행을 돕는다.

---

## 4. 방법론의 네 층

### 4.1 Decision Quality Model — 무엇이 좋은 과정인가

결정 내용의 품질을 구성하는 요소를 정의한다.

### 4.2 Adaptive Coaching Protocol — 지금 무엇을 할 것인가

현재 가장 약한 요소를 찾고, 가장 가치 있는 다음 개입을 하나씩 실행한다.

### 4.3 Integrity Kernel — 무엇을 거짓으로 만들 수 없는가

AI 제안, 사용자 채택, 외부 관찰, 시간과 변경 이력을 분리한다.

### 4.4 Learning Loop — 무엇을 다음 결정에 가져갈 것인가

결과와 과정과 운을 분리하고, 반복된 현실 접촉에서만 학습 후보를 만든다.

네 층을 섞지 않는다. 예를 들어 provenance가 완벽하다고 decision quality가 좋은
것은 아니며, 결과가 성공했다고 과정이 좋았다는 뜻도 아니다.

---

## 5. Argus Decision Quality Model

### 5.1 여덟 요소

| 요소 | 핵심 질문 | 대표 실패 |
|---|---|---|
| **Frame** | 정확히 무엇을 누가 언제 결정하는가? | 잘못된 질문, 범위 혼동 |
| **Values** | 무엇을 이루고 지키려는가? | 타인의 기준, 가치 충돌 은폐 |
| **Alternatives** | 선택 가능한 경로가 충분한가? | 양자택일, do-nothing 누락 |
| **Beliefs** | 각 경로가 어떤 결과를 낳는다고 보는가? | 막연한 기대, 인과 비약 |
| **Evidence** | 무엇을 알고 무엇을 추측하는가? | 출처 없는 확신, 낡은 정보 |
| **Constraints** | 실제 한계와 변경 가능한 조건은 무엇인가? | 선호를 제약으로 착각 |
| **Trade-offs** | 무엇을 얻기 위해 무엇을 감수하는가? | 기준 충돌을 정보 부족으로 처리 |
| **Commitment** | 누가 무엇을 언제 실행하고 무엇이 바뀌면 재검토하는가? | 결론만 있고 행동 없음 |

기존 `premise`는 중심 객체가 아니라 Belief, Constraint, Evidence-derived Claim 등의
읽기 projection이 된다. 제품은 모든 것을 전제로 번역하지 않는다.

### 5.2 내용 종류는 검증 방식이 다르다

- **Value:** 사용자가 중요하다고 채택한다. 사실 검증 대상이 아니다.
- **Belief:** 참·거짓 또는 가능성에 관한 판단이다. 근거와 반증 조건을 가질 수 있다.
- **Forecast:** 미래의 관찰 가능한 사건에 대한 belief다. 조건이 맞으면 확률을
  선택적으로 기록할 수 있다.
- **Evidence:** belief를 지지하거나 약화시키는 자료·관찰이다. 출처가 있다고
  자동으로 참이 되지 않는다.
- **Constraint:** 현재 선택 공간을 제한하는 조건이다. 고정인지 협상 가능한지
  구분한다.
- **Alternative:** 사용자가 취할 수 있는 경로다. 예측이나 가치가 아니다.
- **Commitment:** 자원을 투입하거나 되돌림 비용을 만드는 사용자 행위다.

이 구분이 무너지면 LLM은 가치 충돌을 사실 문제로 만들거나, 추측을 제약으로
만들거나, 추천을 사용자의 결정으로 만들게 된다.

### 5.3 Outcome과 Decision Quality를 분리한다

좋은 과정도 불확실성 때문에 나쁜 결과를 낼 수 있다. 나쁜 과정도 운으로 좋은
결과를 낼 수 있다. Return에서 결과만 보고 과거 판단을 채점하지 않는다.

Argus는 두 질문을 별도로 다룬다.

1. 당시 이용 가능한 정보와 가치에 비추어 과정은 충분했는가?
2. 현실에서는 무엇이 일어났는가?

---

## 6. 세 개의 중첩 루프

### 6.1 Coaching Loop — 지금 더 잘 생각하기

```text
ORIENT → BASELINE → DIAGNOSE → INTERVENE → DELTA
```

### ORIENT

상황을 결정, 판단, sensemaking, 정보, 정서 지원, 위기로 route한다. 결정으로
보인다고 곧바로 의식(ritual)을 시작하지 않는다.

확인할 최소 항목:

- 무엇을 원하는가
- 누가 결정하는가
- 언제까지인가
- 이미 닫힌 결정인가
- 위험과 되돌림 비용은 어느 정도인가

모든 항목을 질문으로 묻지 않는다. 발화에서 충분히 확인되면 조용히 사용하되,
추론한 것은 추론으로 유지한다.

### BASELINE

AI가 방향성 있는 도움을 주기 전에 사용자의 현재 상태를 보존한다.

- 현재 lean 또는 `아직 없음`
- 사용자가 말한 핵심 이유
- 이미 고려한 대안
- 사용자가 알고 있다고 말한 사실과 불확실성

Baseline은 장문의 양식이 아니다. 사용자가 이미 말한 내용은 다시 입력시키지 않는다.
Baseline을 건너뛰면 “AI 이전 상태 미기록”으로 정직하게 남기며 나중에 복원하지
않는다.

### DIAGNOSE

여덟 요소의 완성도를 점수화해 사용자에게 보여주지 않는다. 다음 개입을 선택하기
위한 bounded internal assessment만 한다.

진단 결과는 다음을 포함한다.

- 현재 가장 약한 한두 요소
- 그 약점이 결정을 바꿀 수 있는 이유
- 이미 충분한 요소
- 추가 사고의 예상 가치가 낮은 요소

### INTERVENE

질문만 하지 않는다. §7의 intervention library에서 가장 가치 있는 다음 개입을
선택한다. 한 턴에는 하나의 primary move가 있어야 하지만, 필요하면 여러 턴을
이어간다.

### DELTA

각 개입 뒤 사용자가 이해할 수 있는 변화만 보여준다.

- 새로 알게 된 것
- 달라진 것
- 여전히 유지되는 것
- 아직 결정에 중요한 미확실성
- 다음으로 할 수 있는 것

Delta는 old report의 재출력이 아니다. 최신 개입과 사용자 응답 때문에 생긴
변화만 trace할 수 있어야 한다.

### 6.2 Decision Loop — 생각을 다음 상태로 옮기기

```text
DELTA → READY CHECK → DECIDE | TEST | RESEARCH | DEFER | REFRAME | STOP
```

가능한 올바른 종료:

- **DECIDE:** 현재 경로를 채택하고 행동한다.
- **TEST:** 되돌릴 수 있는 작은 실험으로 불확실성을 줄인다.
- **RESEARCH:** 결정에 실제 가치가 있는 정보를 확인한다.
- **DEFER:** 특정 날짜나 사건까지 판단을 보류한다.
- **REFRAME:** 처음 질문이 잘못됐음을 인정하고 새 case로 연결한다.
- **STOP:** 결정할 필요가 없거나 추가 사고의 가치가 낮다.

사용자에게 결론을 강요하지 않는다. 그러나 `DECIDE`가 준비된 상황에서 Argus가
끝없이 질문하며 책임을 회피해서도 안 된다.

### 조건부 추천

Argus는 능동적으로 추천할 수 있다.

좋은 추천의 형식:

```text
현재 확인된 가치 X와 제약 Y를 기준으로는 A를 권합니다.
이유는 Z입니다.
다만 B가 사실이라면 권고는 바뀝니다.
이것은 Argus의 제안이며 아직 사용자의 결정은 아닙니다.
```

추천을 허용하는 조건:

- 결정 질문과 결정권자가 명확하다.
- 중요한 가치와 trade-off를 사용자에게서 확인했다.
- 핵심 대안이 지나치게 좁지 않다.
- 결정적 belief와 uncertainty를 이름 붙일 수 있다.
- 추천의 근거와 뒤집힐 조건을 말할 수 있다.
- 규제·전문가 책임을 침범하지 않는다.

조건이 부족하면 막연한 중립 문구로 숨지 않고, 무엇이 부족해 추천이 약한지
말하고 그 부분을 돕는다.

### 사용자 소유 record

Decision Loop의 durable record는 다음을 포함한다.

- 사용자가 채택한 결정 또는 다음 상태
- 중요하게 본 가치
- 결정적 belief 또는 uncertainty
- 고려한 핵심 alternatives
- 다음 행동과 책임자
- 판단을 바꿀 조건
- AI가 제안한 부분과 사용자가 직접 말한 부분

사용자가 AI 초안을 그대로 채택할 수 있다. 클릭이 저자를 소급해 바꾸지는 않는다.
`machine-proposed + human-adopted`라는 족보를 유지한다.

### 6.3 Learning Loop — 현실에서 배우기

```text
RETURN → OBSERVE → RESOLVE → DEBRIEF → LESSON CANDIDATE → REUSE
```

### RETURN

귀환은 날짜 알림이 아니라 과거 판단이 현실과 다시 만나는 계약이다.

트리거 유형:

- date: 특정 날짜
- event: 고객 답변, 이사회, 출시, 채용 종료 같은 사건
- metric: 일정 지표의 관찰 가능 시점
- information: 특정 자료가 생겼을 때
- manual: 사용자가 직접 다시 열기

날짜는 사건이 포착되지 않을 때의 fallback이 될 수 있다.

### OBSERVE

먼저 해석 없이 무엇이 일어났는지 기록한다.

- 관찰 내용
- 출처
- 관찰 시점
- 직접 관찰인지 전달받은 것인지
- 아직 모르는 부분

### RESOLVE

어떤 과거 질문과 belief에 답이 생겼는지 사용자가 해석한다. 현실은 관찰을
제공하지만 자신의 의미를 자동으로 판정하지 않는다.

### DEBRIEF

Return은 다음 다섯 질문을 한 화면의 설문으로 강제하지 않는다. 대화와 상태에 맞게
진행하되 이 구분을 보존한다.

1. 실제로 무엇이 일어났는가?
2. 어떤 belief가 지지·약화·미판정되었는가?
3. 당시 가진 정보로 보아 결정 과정은 충분했는가?
4. 결과 중 통제 가능한 요소와 운은 무엇이었는가?
5. 다음 유사한 결정에서 유지하거나 바꿀 질문·규칙은 무엇인가?

### LESSON CANDIDATE

한 건의 회고는 영구적 자기지식이 아니다. 다음과 같이 층을 둔다.

```text
case observation
→ lesson candidate
→ independent cases and counterexamples
→ user-endorsed scoped heuristic
→ optional future influence grant
```

예: “나는 출시를 항상 늦춘다”가 아니라 “최근 세 번의 출시 범위 결정에서 외부
약속보다 내부 완성도 기준을 더 크게 예상했다. 다음 출시에서 이 질문을 먼저
검토할지”라고 제안한다.

---

## 7. Active Intervention Library

### 7.1 개입 유형

| 유형 | 하는 일 | 예시 |
|---|---|---|
| **Mirror** | 상황과 긴장을 정확히 비춘다 | “속도와 품질보다 약속의 신뢰가 핵심으로 들립니다.” |
| **Frame** | 잘못되거나 좁은 질문을 바꾼다 | “출시 여부보다 이번 달에 무엇을 검증할지가 결정 아닐까요?” |
| **Value** | 목적과 우선순위를 명료화한다 | “이번 결정에서 성장과 팀 지속성 중 무엇을 더 지켜야 하나요?” |
| **Alternative** | 빠진 경로를 만든다 | 전면 출시 외에 제한 베타·파트너 파일럿 생성 |
| **Belief test** | load-bearing belief를 찾고 반증한다 | “8월을 넘기면 실제로 무엇을 잃나요?” |
| **Evidence** | 필요한 외부 정보를 찾거나 품질을 평가한다 | 계약, 데이터, 고객 발화 확인 |
| **Trade-off** | 동시에 가질 수 없는 것을 드러낸다 | 속도 2주와 범위 30%의 교환 |
| **Simulation** | 경로를 mental simulation 또는 premortem한다 | “실패했다고 가정하면 가장 그럴듯한 원인은?” |
| **Experiment** | 되돌릴 수 있는 작은 행동을 설계한다 | 10명 파일럿, 48시간 인터뷰 |
| **Recommendation** | 조건부 방향을 제안한다 | “현재 기준으로는 제한 베타를 권합니다.” |
| **Commitment** | 행동·책임자·시점을 명확히 한다 | “내일 누가 어떤 메시지를 보내나요?” |
| **Stop** | 추가 분석을 멈춘다 | “더 생각하는 것보다 실행 후 관찰 가치가 큽니다.” |

### 7.2 다음 개입 선택 규칙

각 후보는 다음 기준을 통과해야 한다.

1. **Grounded:** 사용자 말이나 명시된 자료에 기반하는가?
2. **Relevant:** 현재 DecisionCase의 약한 요소를 겨냥하는가?
3. **Branching:** 서로 다른 반응이 판단이나 행동을 바꾸는가?
4. **Novel:** 이미 말하거나 답한 내용을 반복하지 않는가?
5. **Actionable:** 사용자가 지금 답하거나 실행할 수 있는가?
6. **Proportionate:** 결정 부담에 비해 비용이 적절한가?
7. **Safe:** 권한·전문성·상대방 관점·민감성의 한계를 넘지 않는가?
8. **Explainable:** 왜 지금 이 개입인지 한 문장으로 설명할 수 있는가?

개념적 우선순위:

```text
expected decision improvement
× probability the intervention resolves the weakness
÷ cognitive + time + emotional cost
```

실제 근거 없이 정밀 숫자를 만들지 않는다. high/medium/low의 근거 있는 비교로
사용하고, 후보가 threshold를 넘지 않으면 멈춘다.

### 7.3 다중 턴 규칙

- 한 턴에는 하나의 primary move가 있다.
- 여러 턴은 허용하며 복잡한 결정에는 필요하다.
- 매 턴 뒤 method state와 delta를 갱신한다.
- 다음 질문을 미리 정해 둔 questionnaire처럼 실행하지 않는다.
- 사용자가 충분하다고 말하면 멈춘다.
- 새 정보가 이전 약점을 해소하면 다음 weakest link를 다시 진단한다.
- 같은 약점을 다른 문장으로 반복 공격하지 않는다.
- 분석이 아니라 외부 행동이 더 가치 있으면 행동으로 전환한다.

### 7.4 좋은 개입의 반사실 검사

개입 전에 두 개 이상의 그럴듯한 반응을 가정한다.

```text
response A → state/action A
response B → state/action B
```

두 경로가 사실상 같다면 그 개입의 decision value는 낮다. 단, 사용자가 정서적
이해나 표현 도움을 요청한 경우에는 decision branching이 아닌 해당 목표로 평가한다.

---

## 8. 사용자 경험 문법

### 8.1 사용자가 이해해야 할 것은 방법론이 아니라 현재 가치다

사용자에게 여덟 요소, state machine, provenance graph를 공부시키지 않는다.
사용자가 보는 기본 문법은 다음이면 충분하다.

```text
말해 주세요.
→ 제가 이해한 핵심은 이것입니다.
→ 지금 가장 도움이 되는 한 가지를 같이 보겠습니다.
→ 그래서 달라진 것은 이것입니다.
→ 이제 결정하거나, 확인하거나, 멈출 수 있습니다.
→ 원하면 현실이 답할 때 다시 가져오겠습니다.
```

### 8.2 첫 세션

첫 세션은 다음을 느끼게 해야 한다.

1. Argus가 상황을 정확히 이해했다.
2. 뻔한 질문이 아니라 실제 분기점을 건드렸다.
3. 질문만 한 것이 아니라 생각을 전진시켰다.
4. 무엇이 달라졌는지 볼 수 있다.
5. 이제 무엇을 할지 전보다 분명하다.

봉인과 return 설정은 가치 경험 뒤에 온다. 다만 baseline은 AI의 방향 개입 전에
가볍게 보존한다.

### 8.3 진행 중 화면

화면의 주인공은 분석 보고서가 아니라 네 블록이다.

- **현재 결정:** 지금 무엇을 결정하려는가
- **지금 중요한 것:** 현재 weakest link 또는 active intervention
- **달라진 것:** 최신 delta
- **다음 선택:** 계속 보기 / 결정 / 확인하기 / 보류 / 끝내기

Frame, Values, Alternatives 등 전체 모델은 펼쳐보는 상세 정보다.

### 8.4 귀환 화면

귀환 시 첫 화면은 다음 순서를 지킨다.

1. 당시 사용자가 채택한 문장
2. 당시 중요하게 본 가치와 불확실성
3. 무엇이 드러나면 다시 보기로 했는지
4. 지금 관찰된 것 입력 또는 연결
5. 결과와 과정과 학습의 분리

알림은 “맞았는지 채점하세요”가 아니라 “그때의 질문에 이제 답할 수 있나요?”라고
부른다.

---

## 9. 능동적 코칭과 권한 헌법

### 9.1 새 원칙: zero judgment가 아니라 honest agency

기존 `zero judgment`는 사용자를 평가하거나 AI 판단을 사용자 소유로 세탁하지
않는 데 중요한 역할을 했다. 그러나 방향성 있는 도움까지 금지하면 Argus는
수동적인 질문지와 원장으로 축소된다.

새 헌법은 다음과 같다.

> **Argus는 적극적으로 분석하고 반대하고 추천할 수 있다. 그러나 AI의 도움,
> 사용자의 가치와 결정, 외부 현실을 서로 다른 권한으로 정직하게 보존한다.**

### 9.2 Argus가 해도 되는 것

- 사용자의 frame에 이의를 제기한다.
- 말하지 않은 대안을 제안한다.
- 약한 추론과 모순을 직접 지적한다.
- 필요한 외부 조사를 수행하거나 요청한다.
- 더 나은 선택을 조건부로 추천한다.
- 사용자가 원하면 강한 반대 관점을 제시한다.
- 지금은 더 분석하지 말고 행동하라고 말한다.
- 결정하지 않거나 철회하는 선택을 제안한다.

### 9.3 Argus가 해서는 안 되는 것

- 사용자가 말하지 않은 가치·의도·이유를 사용자의 것으로 확정한다.
- AI 추천을 사용자의 최종 결정으로 저장한다.
- 출처 없는 내용을 사실 또는 실제 제약으로 표현한다.
- 한쪽 당사자의 설명만으로 다른 사람의 동기와 성격을 판정한다.
- 여러 AI 역할의 합의를 독립 증거로 표현한다.
- 결과를 보고 과거의 과정이 좋거나 나빴다고 단정한다.
- 불확실성을 감추고 확신 있는 문체로 메운다.
- 도움을 계속하기 위해 이미 끝난 결정을 다시 연다.

### 9.4 방향성의 정직성

완전한 중립을 주장하지 않는다. 가장 가치 있는 질문을 고르는 것부터 이미 방향을
가진다. 대신 다음을 드러낸다.

- 어떤 사용자 가치 또는 목표를 기준으로 했는가
- 어떤 사실과 추론에 의존했는가
- 무엇을 모르는가
- 무엇이 바뀌면 추천이 바뀌는가
- 누가 최종 결정권자인가

---

## 10. LLM Harness: 적극적이지만 random하지 않게

### 10.1 기본 분업

LLM은 의미를 해석하고 좋은 후보를 만드는 데 적극적으로 사용한다. 결정론 코드는
권한과 상태 전이와 품질 하한을 소유한다.

**LLM이 소유하는 것:**

- 상황의 가능한 frame 후보
- value와 tension 후보
- 대안과 반론 생성
- belief/evidence/constraint 후보 추출
- intervention 후보 생성
- mental simulation과 조건부 추천 초안
- 자연스러운 대화 문구

**결정론 구조가 소유하는 것:**

- route와 safety hard gate
- canonical entity identity와 version
- 출처·저자·시점·권한
- 사용자가 말하지 않은 내용의 승격 금지
- asked/answered/skipped history
- delta 계산과 causal attribution
- intervention budget와 중단 상태
- append/replay/idempotency
- surface capability와 fallback

### 10.2 Turn pipeline

```text
1. capture user utterance
2. route and safety gate
3. fold canonical method state
4. generate state patch candidates
5. diagnose weakest links
6. generate intervention candidates
7. rank + counterfactual test + policy validation
8. compose one primary move
9. validate claims, authority, and response contract
10. render for the active surface
11. append user-visible proposal and later user response
12. compute visible delta
```

모델은 완성된 state를 덮어쓰지 않는다. typed patch와 intervention proposal을
만든다. reducer가 허용된 변화만 접는다.

### 10.3 공통 MethodState

개념적 상태는 다음을 표현해야 한다. 이것은 DB schema 결정이 아니다.

```ts
type MethodState = {
  case: DecisionCase;
  orientation: RouteAndBurden;
  baseline: Baseline | ExplicitlyMissing;
  frame: FramedDecision | Unresolved;
  values: ValueObjective[];
  alternatives: Alternative[];
  beliefs: BeliefOrForecast[];
  evidence: EvidenceClaim[];
  constraints: Constraint[];
  tradeoffs: Tradeoff[];
  activeIntervention: Intervention | null;
  deltas: MethodDelta[];
  currentPosition: UserPosition | null;
  nextState: Decision | Test | Research | Defer | Reframe | Stop | null;
  returnContract: ReturnContract | null;
  observations: Observation[];
  lessonCandidates: LessonCandidate[];
};
```

### 10.4 Intervention proposal contract

```ts
type InterventionProposal = {
  kind: InterventionKind;
  targetElement: DecisionQualityElement;
  purpose: string;
  grounding: SourceAnchor[];
  unresolvedGap: string;
  plausibleBranches: Array<{
    responseShape: string;
    expectedStateChange: string;
  }>;
  expectedValue: 'low' | 'medium' | 'high';
  userCost: 'low' | 'medium' | 'high';
  risks: string[];
  proposedContent: unknown;
};
```

최소 두 branch를 설명하지 못하는 질문은 decision-shaping 질문으로 통과시키지
않는다. Mirror, emotional support, information answer는 각자의 목적 계약으로
평가한다.

### 10.5 Randomness를 통제하는 장치

- 동일 state에는 동일한 허용 intervention set
- schema validation과 authority validation
- paraphrase에 불변인 metamorphic tests
- 여러 seed/provider의 분포와 worst case 보고
- 질문 반복·이미 답한 내용·근거 없는 승격 결정론 차단
- failure 시 old answer 재포장 금지
- model confidence를 사실 confidence로 사용하지 않기
- 중요한 추천에는 weakness/contradiction second pass
- 여러 모델의 합의를 정답으로 사용하지 않기
- 모든 surface가 동일 event fixture를 같은 의미로 fold

High-stakes에서 critic은 투표자가 아니다. 빠진 가치, 대안, 근거, 부작용을 찾는
bounded weakness review만 수행한다.

### 10.6 Prompt보다 harness가 우선한다

프롬프트에는 방법의 의미와 생성 지침을 둔다. 다음 사항은 프롬프트만으로 보장하지
않는다.

- authorship
- source grounding
- already-answered suppression
- state transition
- return lifecycle
- recommendation adoption
- cross-surface parity

모델이 규칙을 어기면 그럴듯한 문장을 보여주기 전에 patch를 거절하거나 정직한
fallback을 사용한다.

---

## 11. 웹·MCP·플러그인 공통 제품

### 11.1 하나의 방법, 여러 projection

세 표면은 같은 MethodState와 event grammar를 사용한다. 서로 다른 제품 두뇌를
두지 않는다.

| 표면 | 강점 | 기본 표현 |
|---|---|---|
| **Web** | 시각적 state, 비교, 긴 세션, 귀환 inbox | 카드와 delta, 펼침 상세 |
| **MCP** | 실제 업무 대화 속 context와 도구 사용 | 짧은 제안, elicitation, receipt |
| **Plugin** | 자연스러운 포착, ambient return, host context | 조용한 trigger와 명령 |

### 11.2 surface parity

모든 표면에서 다음 의미는 같아야 한다.

- AI proposal과 user adoption
- baseline의 존재 또는 부재
- active intervention과 목적
- decision/test/research/defer/stop 상태
- return trigger와 observation
- 과거 비덮어쓰기

UI 능력 차이는 의미 차이가 아니다. 위젯이 없는 MCP에서는 텍스트로 낮추고,
elicitation이 차단된 호스트에서는 사용자가 답하지 않은 상태로 남긴다.

### 11.3 cross-surface continuity

사용자는 웹 방법론과 MCP 방법론을 따로 배우지 않는다.

예:

```text
Codex 대화에서 제품 출시 결정 포착
→ Argus가 value/alternative 약점을 찾아 코칭
→ 사용자가 제한 베타를 채택
→ 웹에서 decision state와 return 조건 확인
→ 플러그인이 고객 인터뷰 완료 사건 감지
→ 어느 표면에서든 같은 귀환을 이어감
```

동기화되지 않았으면 동기화된 척하지 않는다. local-only와 account replica의 상태를
명시한다.

---

## 12. End-to-end 예시

### 상황

> 8월에 출시하고 싶지만 아직 품질이 불안하다.

### ORIENT / BASELINE

- 결정: 8월에 어떤 범위로 출시할 것인가
- 현재 lean: 조금 더 미루는 쪽
- 사용자 이유: 첫인상이 나쁘면 회복이 어렵다고 생각함
- AI 이전 상태로 보존

### DIAGNOSE

- Frame은 충분함
- Values: 신뢰와 학습 속도의 trade-off가 아직 불명확
- Alternatives: 전면 출시와 연기뿐이라 약함
- Belief: 나쁜 첫인상은 회복이 어렵다는 믿음이 load-bearing

### INTERVENTION 1 — Alternative

Argus가 전면 출시와 연기 사이에 제한 베타, 특정 고객군 출시, 기능 축소 출시를
제안한다. 사용자는 특정 고객 20명 제한 베타를 현실적이라고 선택한다.

### DELTA 1

- 바뀜: 결정이 `출시 vs 연기`에서 `누구에게 어떤 범위로 출시`로 바뀜
- 유지: 첫인상 신뢰가 중요함
- 미확인: 20명에게 줄 핵심 가치가 현재 품질로 전달되는가

### INTERVENTION 2 — Experiment

Argus가 20명 중 5명을 대상으로 한 guided onboarding과 성공 기준을 설계한다.

### CONDITIONAL RECOMMENDATION

> 신뢰를 지키면서 8월 학습을 시작하려는 현재 기준이라면, 전면 출시 연기보다
> 5명 guided pilot 후 20명 제한 베타를 권합니다. 다만 첫 5명 중 3명 이상이
> 핵심 행동을 완료하지 못하면 범위 확대를 멈추는 조건입니다.

### DECISION

사용자가 추천을 수정해 채택한다.

- 8월 8일 5명 pilot
- 성공 기준: 3명 이상 핵심 행동 완료 및 2명 이상 재사용
- 실패 시 20명 확대 보류
- AI 제안 + 사용자 수정/채택 족보 보존

### RETURN

사건 trigger: 5명 pilot 종료. 날짜 fallback: 8월 15일.

### LEARNING

결과만 `성공/실패`로 기록하지 않는다.

- 실제 관찰
- 첫인상 belief가 얼마나 지지되었는지
- 대안 생성이 결정 품질을 어떻게 바꿨는지
- 다음 출시에서도 작은 pilot을 먼저 볼 가치가 있는지 lesson candidate로 제안

이 예시에서 좋은 개입은 전제 질문을 반복하는 것이 아니라, 부족한 대안을 만들고
검증 가능한 행동으로 전환한 것이다.

---

## 13. 방법론 평가 계약

### 13.1 Method-level 평가

구현 전에 사람과 평가자가 다음을 할 수 있어야 한다.

- 한 페이지를 읽고 방법을 설명한다.
- 종이와 대화만으로 전체 loop를 수행한다.
- 같은 case에서 weakest link를 대체로 합의한다.
- 좋은 개입과 과잉 개입을 구분한다.
- recommendation의 근거와 뒤집힐 조건을 찾는다.
- outcome과 decision process를 구분한다.
- 어떤 상황에서 Argus를 쓰지 말아야 하는지 안다.

### 13.2 Gold case corpus

최소 다음 축을 포함한다.

- 단순/복잡
- reversible/irreversible
- 짧은/긴 deadline
- belief 부족/value conflict/alternative poverty/frame error/action gap
- 이미 닫힌 결정
- 정보 요청, vent, validation, crisis
- 상대방이 얽힌 편향 위험
- 전문가 사용자와 초보 사용자
- 좋은 결과의 나쁜 과정 / 나쁜 결과의 좋은 과정
- return에서 answered/indeterminate/moot

각 case에는 하나의 정답 문장을 두지 않는다. 다음을 annotation한다.

- 허용 가능한 frame 범위
- weakest-link 후보와 근거
- 가치 있는 intervention 후보
- 금지 또는 과잉 개입
- 추천 가능 여부
- 가능한 stop states
- return에서 구분할 관찰/해석/학습

### 13.3 비교군

새 Argus는 최소 세 조건과 비교한다.

1. 일반적인 고성능 챗봇
2. 정적인 Decision Quality/decision journal worksheet
3. 현행 Argus flow

평가 시간과 입력 정보는 가능한 한 맞춘다.

### 13.4 첫 세션 지표

- 사용자가 결정 질문을 더 정확히 설명할 수 있는가
- 새로운 가치 있는 대안 또는 trade-off가 생겼는가
- 사용자가 “무엇이 달라졌는지” 정확히 말할 수 있는가
- 개입이 이미 답한 내용을 반복하지 않았는가
- 다음 행동이 더 분명해졌는가
- AI 추천과 자신의 결정을 구분할 수 있는가
- 얻은 가치 대비 시간·인지·정서 비용
- 일반 챗과의 차이를 사용자 자신의 말로 설명할 수 있는가

### 13.5 Return 지표

- return contract를 자발적으로 설정했는가
- 실제 trigger에 적절히 돌아왔는가
- 당시 state가 변조 없이 재구성되는가
- 관찰과 사후 해석이 구분되는가
- outcome과 process를 구분할 수 있는가
- lesson candidate를 사용자가 유용하다고 보는가
- 이후 유사 결정에 실제로 재사용되는가

### 13.6 zero-tolerance integrity failures

- AI 문장을 사용자 원문으로 표시
- 말하지 않은 가치·이유를 사용자 소유로 저장
- 최신 결과를 과거 state에 혼입
- 출처 없는 내용을 외부 사실로 승격
- 사용자가 답하지 않았는데 host/model이 대신 승인
- 한쪽 설명으로 타인의 동기 판정
- 여러 model/persona의 합의를 독립 현실 증거로 표시
- 과거 record를 조용히 overwrite

### 13.7 반증과 kill criteria

다음이면 기능 추가보다 방향을 재검토한다.

- 종이 방법이 일반 대화보다 일관된 개선을 만들지 못한다.
- 사용자가 도움보다 심문과 의식을 더 크게 느낀다.
- 적극적 추천이 일반 챗보다 유용하거나 정직하지 않다.
- 사용자가 delta를 이해하지 못한다.
- first-session value는 있으나 record/return을 원하지 않는다.
- return은 열지만 reusable learning을 만들지 못한다.
- 정적 worksheet가 비슷한 품질을 훨씬 낮은 비용으로 낸다.
- 표면마다 다른 의미와 경험이 반복된다.

실패 결과에 따라 제품을 축소할 수 있다.

- 코칭만 가치 있으면 standalone ledger 주장을 축소한다.
- 원장만 가치 있으면 능동 코치를 별도 모드로 둔다.
- 특정 결정 유형에서만 가치 있으면 vertical product로 좁힌다.
- return 가치가 없으면 장기 학습 주장을 철회한다.

---

## 14. R 트랙 단계와 구현 진입 게이트

### R0 — 방향과 주장

이 문서의 §1–§4를 founder와 검토한다.

Exit:

- 한 문장 방향 승인
- 초기 대상과 비대상 승인
- 능동적 코칭과 추천 권한 승인
- 기존 `zero judgment` 중 유지/폐기 조항 명시
- 승인 뒤 BLUEPRINT §1과 `CLAUDE.md` runtime 원칙의 amendment 범위 확정

### R1 — 방법 매뉴얼

§5–§9를 실행 가능한 manual로 만든다.

Exit:

- one-page method
- intervention evaluator handbook
- 30개 이상 gold cases와 counterexamples
- 세 개의 full paper walkthrough
- decision/outcome/learning 구분 합의

### R2 — Offline harness contract

실제 제품과 DB를 건드리지 않는 harness에서 MethodState, intervention proposal,
delta, recommendation, return debrief를 반복 실행한다.

Exit:

- schema와 reducer prototype
- multi-seed/provider distribution
- paraphrase/metamorphic suite
- authorship/grounding/repetition zero-tolerance gate
- web/MCP/plugin text projection parity fixture

### R3 — 구현 전 증거

사람을 대상으로 방법과 prototype을 비교한다.

Exit:

- general chat, worksheet, current Argus 대비 blinded review
- first-session value와 user cost 기록
- 적어도 몇 건의 실제 decision→return walkthrough
- 실패와 abandonment를 포함한 qualitative review
- 구현할 가치가 있다는 명시적 GO/HOLD/NO-GO

표본 수와 수치 threshold는 관찰 뒤 유리하게 바꾸지 않도록 R3 시작 전에 별도
measurement contract로 봉인한다.

### R4 — Architecture convergence

R3 GO 뒤에만 현재 구현을 `retain / reforge / retire`로 판정한다.

결정 대상:

- 기존 semantic kernel과 새 MethodState의 관계
- 기존 H progressive flow의 폐기 또는 adapter
- F/H/K/E/JCR 계약 amendment
- canonical events와 projection
- cross-surface prompt/runtime consolidation
- DB migration과 rollback
- legacy data의 정직한 보존

### R5 — Vertical slice

한 사용자군과 한 결정 유형으로 다음을 완주한다.

```text
active coaching
→ user-owned next state
→ cross-surface continuity
→ real return
→ scoped lesson candidate
```

새 랜딩, 넓은 pattern UI, 팀 기능, agent theater보다 이 loop 하나가 먼저다.

---

## 15. 열린 연구 질문과 현재 기본안

| 질문 | v0.1 기본안 | 검증 방법 |
|---|---|---|
| 추천은 언제 가능한가 | 충분한 values·alternatives·beliefs가 보일 때 조건부 추천 | gold case + user study |
| baseline은 필수인가 | 캡처 또는 명시적 missing, 재입력 강제 없음 | friction 비교 |
| 숫자 확률을 쓸 것인가 | 관찰 가능한 forecast에만 opt-in | calibration usefulness |
| return contract 없는 record | 허용하되 completed learning loop로 세지 않음 | 실제 사용 이유 조사 |
| 한 세션의 턴 수 | 고정 없음, 매 턴 marginal value로 중단 | cost/value curve |
| external research 기본값 | decision value와 최신성 요구가 높을 때 제안 또는 실행 | source quality eval |
| learned pattern 최소 사례 | 독립 사례와 반례 필요, 숫자는 사전 고정하지 않음 | longitudinal pilot |
| 팀 결정 | v1 비대상, 개인 결정권자 중심 | 후속 stakeholder 연구 |

---

## 16. 연구 기반과 한계

Argus는 기존 방법의 이름을 붙인 조립품으로 끝나면 안 되지만, 검증된 지식을
무시하고 새 이론인 척해서도 안 된다.

- Minto Pyramid/SCQ: 생각과 커뮤니케이션의 구조화
- Decision Quality: frame, alternatives, information, values, reasoning, commitment
- Value-Focused Thinking: 대안보다 가치와 목적에서 시작
- Value of Information: 답이 후속 판단을 바꾸는 질문의 가치
- Human-AI appropriate reliance: AI 이전 판단과 이후 조정, 과신·과소신뢰 구분
- Cognitive forcing: 수동 수용을 줄이되 friction과 만족도 trade-off 존재
- Hindsight/outcome bias: 사후 결과가 과거 기억과 과정 평가를 왜곡
- Prospective hindsight/premortem: 미래 실패를 이미 일어난 것처럼 검토
- Naturalistic Decision Making: 숙련자는 모든 대안을 비교하지 않고 경험 기반으로
  plausible action을 찾고 mental simulation할 수 있음
- Implementation intentions: 구체적인 상황-행동 연결
- Double-loop learning: 행동뿐 아니라 그것을 만든 전제·목표·규칙을 수정
- Event sourcing/provenance: 시간과 저자와 변경 이력을 재구성

이 근거들은 Argus 전체를 증명하지 않는다. 각각 특정 조건과 연구 범위를 가진다.
Argus의 독자적 주장은 **이들을 낮은 사용자 부담의 능동적 LLM coaching, 정직한
authority ledger, cross-surface continuity, real-world return으로 결합하면 더 나은
판단 과정과 반복 학습을 만든다**는 것이다. 이 주장은 R3와 이후 longitudinal
evidence가 판정한다.

---

## 17. 한 페이지 요약

### 방향

Argus는 수동적인 판단 원장이 아니라 **능동적 판단 코칭과 현실 기반 학습을 잇는
시스템**이다.

### 방법

```text
COACHING LOOP
현재 상태 → 가장 약한 결정 요소 → 가장 가치 있는 개입 → 보이는 변화

DECISION LOOP
변화 → 결정 | 실험 | 조사 | 보류 | 재정의 | 중단 → 사용자 채택

LEARNING LOOP
귀환 → 관찰 → 과거 belief와 비교 → 과정/결과/운 분리 → 학습 후보
```

### 품질 모델

```text
Frame · Values · Alternatives · Beliefs · Evidence · Constraints · Trade-offs · Commitment
```

### 헌법

```text
AI는 적극적으로 돕는다.
AI의 제안은 AI의 제안으로 남는다.
사용자의 가치와 결정은 사용자가 채택한다.
현실은 출처 있는 관찰로 들어온다.
과거는 덮어쓰지 않는다.
결과로 사람을 채점하지 않는다.
```

### 구현 전 조건

```text
one-page method
→ gold cases and evaluator agreement
→ offline harness
→ comparison with chat/worksheet/current Argus
→ real decision-return evidence
→ GO/HOLD/NO-GO
→ architecture and implementation
```

---

## 18. 외부 참고

- Barbara Minto, Pyramid Principle and SCQ: <https://barbaraminto.com/>
- Strategic Decisions Group, Requirements of Decision Quality:
  <https://sdg.com/wp-content/uploads/2024/05/Requirements-of-Decision-Quality.pdf>
- Ralph Keeney, Value-Focused Thinking:
  <https://doi.org/10.1016/0377-2217(96)00004-5>
- Rao & Daumé, clarification questions and expected value of perfect information:
  <https://aclanthology.org/P18-1255/>
- Fischhoff, hindsight and foresight:
  <https://www.cmu.edu/epp/people/faculty/faculty-images-and-files/jep-hpp-hindsight-foresight-1975.pdf>
- Pieters, Baumgartner & Bagozzi, biased memory for prior decisions:
  <https://doi.org/10.1016/j.obhdp.2005.05.004>
- Schemmer et al., appropriate reliance on AI advice:
  <https://arxiv.org/abs/2204.06916>
- Buçinca, Malaya & Gajos, cognitive forcing and overreliance:
  <https://doi.org/10.1145/3449287>
- Mitchell, Russo & Pennington, prospective hindsight:
  <https://doi.org/10.1002/bdm.3960020103>
- Gary Klein, Recognition-Primed Decision model:
  <https://www.gary-klein.com/rpd>
- Gollwitzer & Sheeran, implementation intentions meta-analysis:
  <https://doi.org/10.1016/S0065-2601(06)38002-1>
- Chris Argyris, double-loop learning:
  <https://doi.org/10.1093/oso/9780199276813.003.0013>
