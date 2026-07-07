# Argus Clarify Question System Redesign

Date: 2026-07-06
Status: Starting design document
Scope: Clarify 질문 시스템, 질문 품질 하한선, 전제 추적, judgment checkpoint 연결

---

## 0. Executive Summary

Argus의 clarify 과정은 더 이상 "좋은 실행 계획을 만들기 위해 몇 가지 정보를 묻는 과정"에 머물면 안 된다.

새로운 clarify의 목적은 다음과 같다.

> 사용자의 판단과 실행을 떠받치는 핵심 전제를 드러내고, 그 전제가 이후 실행, 검증, settle까지 계속 이어지게 만드는 것.

따라서 질문 시스템의 기준도 바뀌어야 한다.

기존 질문의 중심:

> 뭘 더 알아야 좋은 답변을 만들 수 있지?

새 질문의 중심:

> 이 판단은 어떤 전제 위에 서 있고, 무엇을 확인하면 판단력이 깊어지지?

좋은 질문은 정보를 많이 받는 질문이 아니다. 좋은 질문은 사용자가 답하는 순간 자신의 판단 구조를 더 선명하게 보게 만드는 질문이다. 사용자는 Argus에게 정보를 제공한다고 느끼기보다, 자기 판단의 지형을 보게 되어야 한다.

최종적으로 Argus clarify는 이런 경험을 만들어야 한다.

> "내가 고민하던 건 A냐 B냐가 아니라, 사실 X 전제를 믿을 수 있느냐였네."

그리고 사용자가 나중에 돌아왔을 때는:

> "그때 내가 어떤 전제 위에서 판단했는지 보이고, 지금은 그 전제가 얼마나 맞았는지 정직하게 볼 수 있네."

이것이 Argus가 줄 수 있는 차별적 효능감이다. 단순히 좋은 답변을 받는 것이 아니라, 판단력의 시야가 넓어지고 깊어지는 느낌을 줘야 한다.

---

## 1. Why This Change Matters

현재 Argus에는 좋은 질문 철학이 이미 들어가 있다. 특히 다음 요소들은 살릴 가치가 크다.

- 상황을 재구성하는 `real_question`
- 사용자의 선택을 가르는 `strategic_fork`
- 가장 약한 전제를 찌르는 `weakness_check`
- vent, flat, validation, crisis에 과잉 반응하지 않으려는 request gate
- "마감이 언제인가요?", "최종 결정권자가 누구인가요?", "어떤 형식이 필요한가요?" 같은 행정 질문을 피하려는 원칙

그러나 현재 구조는 아직 완전히 새 Argus 방향에 맞춰져 있지는 않다.

현재 clarify는 역사적으로 "문서 초안", "실행 계획", "팀 배치", "decision-maker simulation"을 잘 만들기 위한 전처리 과정으로 발전해왔다. 이 목적 자체는 중요하지만, 이제 제품 방향이 더 깊어졌다. Argus는 사용자의 판단과 실행을 위한 전제를 붙잡고, 그 전제를 나중에 현실과 다시 대조할 수 있게 해야 한다.

즉, clarify는 다음 역할을 해야 한다.

1. 사용자가 실제로 무엇을 판단하려는지 잡는다.
2. 그 판단을 가르는 전략적 갈림길을 드러낸다.
3. 각 갈림길이 어떤 전제 위에 서 있는지 명시한다.
4. 그중 가장 위험하거나 중요한 전제를 고른다.
5. 나중에 무엇을 보면 이 판단이 더 선명해질지 checkpoint seed를 만든다.
6. 그 전제를 확인하거나 실행으로 옮기는 다음 행동으로 이어준다.

이 흐름이 잡히면 Argus는 단순한 "AI 기획 도우미"가 아니라, 사용자의 판단 근육을 키우는 도구가 된다.

---

## 2. Product Principle

### 2.1 질문은 사용자에게 일을 시키는 장치가 아니다

나쁜 질문은 사용자가 Argus를 위해 빈칸을 채우게 만든다.

예:

- "최종 결정권자는 누구인가요?"
- "마감은 언제인가요?"
- "어떤 형식이 필요한가요?"
- "이 스켈레톤 중 어느 항목을 더 채울까요?"

이런 질문은 필요한 경우가 있을 수 있지만, clarify의 핵심 질문이 되면 안 된다. 사용자는 "내 생각이 깊어졌다"가 아니라 "AI에게 정보를 입력했다"고 느낀다.

좋은 질문은 사용자가 자기 판단의 구조를 보게 만든다.

예:

- "이 결정이 틀렸다고 드러난다면, 가장 먼저 어디에서 신호가 나타날까요?"
- "2주 안에 불완전한 안을 먼저 보여주는 쪽인가요, 아니면 출시를 늦추더라도 핵심 리스크 1개를 먼저 검증하는 쪽인가요?"
- "이 판단에서 가장 믿기 어려운 전제는 고객 반응인가요, 내부 실행력인가요, 이해관계자 승인인가요?"
- "나중에 무엇을 보면 이 판단이 더 선명해질까요?"

### 2.2 질문은 적어야 한다

질문 수를 늘리면 사용자가 더 깊어지는 것이 아니다. 오히려 지친다. Argus의 질문은 적어야 하고, 각 질문은 충분히 날카로워야 한다.

권장 흐름:

1. Q1: Frame Clarify 또는 Strategic Fork
2. Q2: Weakest Premise Check
3. Q3: Checkpoint Seed 또는 Execution Carry

사용자가 피곤하거나, 결정 밀도가 낮거나, 이미 충분히 방향이 잡혀 있으면 Q3는 생략한다. 대신 Argus가 checkpoint 후보를 조용히 제안할 수 있다.

예:

> 나중에 확인할 지점은 이걸로 잡아둘게요: "2주 안에 고객 3명이 이 방향을 실제로 써보겠다고 말하는가."

### 2.3 질문은 사용자의 언어를 따라가야 한다

좋은 질문은 사용자의 표현을 그대로 물고 들어간다.

사용자가 "이게 먹힐지 모르겠다"고 했다면:

나쁨:

> 시장 검증을 어떻게 진행할까요?

좋음:

> 여기서 "먹힌다"는 건 사람들이 좋다고 말하는 수준인가요, 아니면 돈이나 시간을 실제로 쓰겠다는 수준인가요?

사용자가 "대표님 설득이 걱정된다"고 했다면:

나쁨:

> 의사결정자는 누구인가요?

좋음:

> 대표님이 이 안을 거절한다면, 가장 먼저 물고 늘어질 지점은 숫자, 리스크, 실행 리소스 중 어디일까요?

---

## 3. Use Theory as Lens, Not Surface

이론과 방법론은 참고하되, 사용자에게 프레임워크 이름을 드러내거나 모든 상황에 억지로 적용하면 안 된다. Argus는 "민토 피라미드에 따라 답해주세요"라고 묻는 도구가 아니다. 사용자는 프레임워크를 쓰고 있다는 느낌보다, 자기 판단이 더 선명해지는 느낌을 받아야 한다.

### 3.1 Barbara Minto / Pyramid Principle

사용처:

- 질문의 논리 품질 검증
- real question과 선택지가 수직적으로 연결되는지 확인
- 선택지가 같은 층위인지 확인
- 답변 후 문서 구조나 Current Course가 논리적으로 압축되는지 확인

가져올 것:

- 상위 메시지와 하위 근거의 수직 연결
- 같은 층위의 선택지
- "So what?" 테스트
- MECE-ish 분기

가져오지 말 것:

- 사용자가 피라미드 구조로 답하게 만들기
- 모든 질문을 문서 구조 중심으로 만들기
- 기계적인 MECE 강제
- 탐색 단계에서 지나치게 정리된 구조를 강요하기

Argus식 변환:

> 이 질문이 현재 상위 판단을 실제로 가르는 하위 분기인가?

### 3.2 SCQA

사용처:

- 초기 real question을 잡을 때
- surface request와 real question 사이의 간극을 찾을 때
- 사용자가 "뭘 물어봐야 할지 모르는" 상황에서 문제의 장면을 잡을 때

가져올 것:

- Situation: 지금 어떤 상황인가?
- Complication: 무엇이 꼬였는가?
- Question: 그래서 진짜 먼저 답해야 하는 질문은 무엇인가?

가져오지 말 것:

- 모든 출력물을 SCQA 형식으로 만들기
- 사용자가 이미 명확한 결정을 내린 상황에 다시 SCQA를 씌우기

### 3.3 MECE

사용처:

- strategic fork의 선택지가 같은 층위인지 확인
- 선택지가 서로 너무 겹치지 않는지 확인
- 빠진 주요 경로가 없는지 확인

주의:

완벽한 MECE를 강제하면 질문이 딱딱해지고 추상화된다. Argus에는 "MECE"보다 "같은 층위의 실제 선택지"가 더 중요하다.

나쁨:

- 속도 우선
- 품질 우선
- 리스크 최소화

좋음:

- 이번 주 안에 MVP를 열고, 정확도 이슈는 다음 릴리즈에서 보완한다.
- 출시를 2주 늦추고, 핵심 실패 케이스 3개를 먼저 막는다.
- 고객 5명에게 수동 concierge 방식으로 먼저 검증하고, 자동화는 이후로 미룬다.

### 3.4 Premortem

사용처:

- weakness_check
- weakest premise selection
- Current Course의 open risk
- checkpoint seed

핵심 질문:

> 이 판단이 실패했다고 가정하면, 가장 그럴듯한 실패 이유는 무엇인가?

Argus식 변환:

> 이 판단이 무너진다면, 어떤 전제가 틀렸을 가능성이 가장 큰가?

### 3.5 Thinking in Bets

사용처:

- 판단 당시의 전제와 근거를 남기기
- 결과와 판단 품질을 분리하기
- settle 경험에서 "맞았다/틀렸다"가 아니라 "무엇을 배웠는가"를 보여주기

핵심:

좋은 결과가 좋은 판단을 의미하지 않는다. 나쁜 결과도 나쁜 판단을 의미하지 않는다. 판단의 품질은 당시의 정보, 전제, 대안, 확률, 리스크 인식으로 평가해야 한다.

Argus식 변환:

> 그때의 나는 무엇을 믿고 이 판단을 했는가?

### 3.6 Superforecasting

사용처:

- 애매한 판단을 나중에 확인 가능한 관찰 단위로 바꾸기
- checkpoint seed 만들기
- settle 시 "불확실함"을 정직하게 기록하기

주의:

모든 판단을 숫자 예측으로 바꾸면 안 된다. 사용자가 전략, 사람, 창작, 조직 판단을 할 때 현실은 엄밀하지 않을 수 있다. 이 경우에는 정량 지표보다 관찰 가능한 신호, 이해관계자 반응, 해석 변화, 기준 변화가 더 적합하다.

Argus식 변환:

> 나중에 무엇을 보면 이 판단이 더 선명해질까?

---

## 4. Question Type System v2

현재의 `strategic_fork`, `weakness_check`는 유지하되, 전체 타입 체계를 새 목적에 맞게 재정렬한다.

### 4.1 Request Gate

목적:

질문을 던질지 말지 먼저 판단한다. 좋은 질문도 잘못된 상황에 던지면 나쁜 경험이 된다.

분기:

- `crisis`: 안전, 학대, 강압, 금융 파탄, 사기, 회복 불가능한 위험
- `self_profiling`: "나는 어떤 사람인가", "내 의사결정 스타일 분석해줘"
- `vent`: 감정 배출, 결정 요청 없음
- `validation`: 이미 결정했고 sanity check만 원함
- `info`: 단순 사실/방법 질문
- `flat`: 낮은 stakes, reversible, 어떤 선택도 큰 차이 없음
- `resistance`: 새 정보 없이 오래 미루는 상태
- `open_decision`: 실제로 판단할 갈림길이 있음

원칙:

- `open_decision`만 full clarify를 탄다.
- `vent`, `flat`, `validation`에 fork를 만들면 over-fire다.
- `crisis`에서는 계획 기계가 돌면 안 된다.
- `resistance`에서는 더 많은 분석보다 작은 현실 테스트가 필요하다.

질문 예외:

비-open에서도 아주 제한적인 질문은 가능하다. 단, 질문이 아니라 invitation에 가까워야 한다.

예:

> 이걸 결정으로 바꾸고 싶다면, 나중에 다시 가져와도 돼요. 지금은 그냥 "오래 열려 있고 새 정보는 없는 상태"로만 잡아둘게요.

### 4.2 Frame Clarify

목적:

사용자가 진짜로 판단하려는 질문을 잡는다.

사용 조건:

- framing confidence < 70
- surface request가 여러 방향으로 해석될 수 있음
- 사용자가 실행 요청처럼 말했지만 실제로는 방향 판단이 불명확함

나쁜 질문:

- "좀 더 자세히 설명해주실 수 있나요?"
- "목표가 무엇인가요?"
- "어떤 결과물을 원하시나요?"

좋은 질문:

- "지금 진짜 결정은 이 일을 할지 말지인가요, 어떻게 할지인가요, 아니면 누구를 설득해야 하는지인가요?"
- "이 고민은 제품 방향을 정하는 문제에 가까운가요, 대표님을 설득하는 문제에 가까운가요, 아니면 고객 반응을 확인하는 문제에 가까운가요?"
- "지금 막힌 지점은 선택지가 없어서인가요, 선택지는 있는데 어느 전제를 믿어야 할지 몰라서인가요?"

출력 효과:

- `real_question` 재정의
- `framing_confidence` 상승
- 관련 전제 후보 생성
- 불필요한 팀 배치/실행 계획 방지

### 4.3 Strategic Fork

목적:

사용자가 실제로 선택해야 하는 전략적 갈림길을 드러낸다.

사용 조건:

- framing confidence >= 70
- open_decision
- 선택지에 따라 final deliverable, team composition, skeleton, checkpoint가 달라질 수 있음

가장 중요한 규칙:

선택지는 카테고리가 아니라 실제 결정문이어야 한다.

나쁨:

- 속도 우선
- 품질 우선
- 리스크 최소화
- 경쟁 분석 중심

좋음:

- 4주 안에 고객 5명에게 수동 MVP를 보여주고, 자동화는 반응이 나온 뒤 시작한다.
- 이번 분기에는 기존 고객 확장에 집중하고, 신규 시장 검증은 다음 분기로 넘긴다.
- 대표님에게 완성 계획이 아니라 2주짜리 검증안으로 먼저 승인받는다.
- 기능 범위를 3개에서 1개로 줄이고, 해당 기능의 반복 사용 여부만 먼저 본다.

출력 효과:

- `decisionLine`
- `rationale`
- `snapshotPatch.real_question`
- `snapshotPatch.hidden_assumptions`
- `snapshotPatch.skeleton`
- `addsWorkerRole`
- checkpoint 후보의 방향성

### 4.4 Premise Extraction

목적:

선택된 방향이 어떤 전제 위에 서 있는지 명시한다.

사용 조건:

- strategic fork 후
- 또는 사용자가 이미 방향을 제시한 validation/open decision
- Current Course를 만들기 전

질문 예:

- "이 방향이 맞으려면, 반드시 참이어야 하는 전제는 무엇인가요?"
- "이 선택은 고객 반응, 내부 실행력, 이해관계자 승인 중 무엇을 가장 크게 믿고 있나요?"
- "이 계획이 성립하려면 어떤 것이 예상대로 움직여야 하나요?"

출력 효과:

- premise list 생성
- premise type 부여
- confidence/uncertainty 부여
- weakest premise 후보 생성

주의:

이 질문을 사용자가 직접 분류표처럼 채우게 하면 안 된다. Argus가 후보를 제안하고, 사용자는 고르거나 수정하게 해야 한다.

예:

> 내가 보기엔 이 판단은 세 전제 위에 서 있어요.  
> 1. 고객이 지금 문제를 충분히 아프게 느낀다.  
> 2. 우리 팀이 2주 안에 보여줄 수 있는 수준까지 만들 수 있다.  
> 3. 대표님은 완성 계획보다 빠른 검증안을 더 선호한다.  
>  
> 이 중 가장 불안한 건 어느 쪽인가요?

### 4.5 Weakest Premise Check

목적:

틀렸을 때 판단이 가장 크게 무너지는 전제를 고른다.

사용 조건:

- premise가 2개 이상 있음
- worker output이 어느 정도 나왔음
- 또는 strategic fork 답변 이후 판단 방향이 잠정 선택됨

질문 예:

- "이 방향이 틀렸다면, 가장 먼저 틀렸을 가능성이 큰 전제는 무엇인가요?"
- "고객이 원한다는 전제, 우리가 만들 수 있다는 전제, 대표님이 기다려준다는 전제 중 무엇을 먼저 의심해야 할까요?"
- "다음 3일 동안 하나만 확인해야 한다면, 어느 전제를 확인하는 게 가장 큰 리스크를 줄이나요?"

선택지는 validation path여야 한다.

나쁨:

- 시장 조사
- 기술 검증
- 고객 피드백

좋음:

- 고객 5명에게 직접 연락해 "이걸 돈 내고 쓸지" 묻는다.
- 내부 개발자 1명과 90분짜리 spike를 해서 핵심 구현 리스크를 본다.
- 대표님에게 완성안 대신 2주 검증안으로 승인 가능한지 먼저 확인한다.

출력 효과:

- `weakestAssumption`
- `nextThreeDays`
- `dmFirstReaction`
- `snapshotPatch.insight`
- checkpoint seed 후보

### 4.6 Checkpoint Seed

목적:

나중에 이 판단을 다시 볼 수 있는 손잡이를 만든다.

사용 조건:

- open_decision
- real question이 어느 정도 잡힘
- 사용자가 어떤 방향으로 기울었거나, Current Course가 생김
- future check가 의미 있는 상황

사용 금지:

- vent
- crisis
- flat
- validation/closed logging
- 현실 확인이 불가능하거나 의미 없는 경우
- 사용자가 지쳐 있고 더 묻는 것이 부담인 경우

질문 예:

- "나중에 무엇을 보면 이 판단이 더 선명해질까요?"
- "이 방향이 맞았는지 보려면, 가장 먼저 어떤 신호를 보면 될까요?"
- "2주 뒤에 돌아와서 확인한다면, 무엇이 보이면 이 판단이 괜찮았다고 말할 수 있을까요?"
- "이 판단이 틀렸다는 신호는 어디에서 먼저 나타날까요?"

출력 효과:

- checkpoint type
- check handle
- expected signal
- check timing or trigger
- ambiguity allowed answer set

중요:

checkpoint는 날짜만이 아니다.

가능한 return handle:

- Date: 특정 날짜에 다시 확인
- Event: 회의, 출시, 고객 인터뷰, 의사결정 순간 이후
- Metric: 수치가 특정 범위에 도달했는지
- Reaction: 사용자, 고객, 상사, 이해관계자의 반응
- Evidence: 새 정보가 들어왔는지
- Drift: 시간이 지나며 내 판단이나 기준이 바뀌었는지

### 4.7 Execution Carry

목적:

선택한 전제/검증 경로를 실제 다음 행동으로 옮긴다.

질문 예:

- "이 전제를 확인하려면 다음 3일 안에 무엇을 실제로 할 수 있나요?"
- "AI가 대신 조사할 것과, 당신이 직접 판단해야 할 것을 나누면 어디까지인가요?"
- "이 검증을 가장 작게 한다면, 누구에게 무엇을 물어보는 것으로 충분할까요?"

출력 효과:

- next 3 days
- AI task vs human judgment split
- evidence to collect
- checkpoint link

---

## 5. Premise Model

전제를 계속 끌고 가려면 `hidden_assumptions`만으로는 부족하다. 전제에 타입과 상태를 부여해야 한다.

### 5.1 Premise Types

#### Goal Premise

무엇을 성공으로 보는가?

예:

- 성공은 매출 증가가 아니라 대표님의 방향 승인이다.
- 이번 실험의 성공은 가입자가 아니라 반복 사용 신호다.
- 이 문서의 성공은 완성도가 아니라 의사결정 속도다.

#### Causal Premise

A를 하면 B가 일어나는가?

예:

- 고객 인터뷰를 하면 실제 구매 의향을 확인할 수 있다.
- 가격을 낮추면 전환율이 오른다.
- 경쟁사와 다른 포지셔닝을 강조하면 고객이 더 잘 이해한다.

#### Capability Premise

우리가 이걸 할 수 있는가?

예:

- 현재 팀이 2주 안에 MVP를 만들 수 있다.
- 내부 데이터가 충분히 정리되어 있다.
- 담당자가 고객 인터뷰를 직접 진행할 수 있다.

#### Constraint Premise

시간, 돈, 법, 조직, 기술이 막는가?

예:

- 법무 검토 없이 이 기능을 출시할 수 있다.
- 보안 리뷰는 1주 안에 끝날 수 있다.
- 기존 시스템과 통합하는 데 큰 병목이 없다.

#### Stakeholder Premise

누가 받아들이거나 막는가?

예:

- 대표님은 완성안보다 검증안을 선호할 것이다.
- 영업팀은 이 포지셔닝을 실제로 설명할 수 있다.
- 고객은 추가 설정 작업을 감수할 것이다.

#### Evidence Premise

무엇을 보면 맞다고 볼 수 있는가?

예:

- 고객 5명 중 3명이 다음 미팅을 요청하면 관심이 있다고 볼 수 있다.
- 2주 안에 수동 처리로도 결과가 나오면 자동화할 가치가 있다.
- 경쟁사 리뷰에서 같은 불만이 반복되면 차별화 근거가 있다.

#### Reversibility Premise

틀렸을 때 되돌릴 수 있는가?

예:

- 이 출시는 되돌릴 수 있지만 브랜드 신뢰 비용이 있다.
- 가격 변경은 되돌릴 수 있지만 기존 고객 반발이 생긴다.
- 조직 개편은 되돌리기 어렵다.

### 5.2 Premise State

각 전제에는 상태가 필요하다.

- `assumed`: 현재 가정 중
- `supported`: 일부 근거 있음
- `confirmed`: 충분히 확인됨
- `doubtful`: 의심됨
- `unknown`: 아직 모름
- `changed`: 상황 변화로 의미가 바뀜

### 5.3 Premise Confidence

숫자 점수보다 가벼운 confidence label이 낫다.

- `high`: 현재 판단에 쓸 수 있음
- `medium`: 근거는 있지만 확인 필요
- `low`: 많이 불확실함
- `unclear`: 판단 보류가 정직함

주의:

사용자가 억지로 확신도를 매기게 만들면 반발감이 생긴다. Argus가 조용히 추정하고, 사용자가 수정 가능하게 해야 한다.

---

## 6. Question Quality Gate

질문 품질 하한선을 올리려면 생성 프롬프트만으로는 부족하다. 질문 생성 후 validator가 필요하다.

### 6.1 Hard Reject Rules

아래 조건에 해당하면 질문을 버리고 다시 생성한다.

#### 1. No Decision Effect

답해도 다음 판단, 전제, 실행, checkpoint 중 아무것도 바뀌지 않는다.

나쁨:

> 어떤 톤을 원하세요?

좋음:

> 이 문서는 설득용인가요, 승인용인가요, 내부 정렬용인가요?

단, "어떤 톤"이 실제 승인/설득 전략을 바꾸는 상황이면 허용될 수 있다.

#### 2. Admin-Only

마감, 포맷, 최종 결정권자, 분량, 대상자 같은 행정 정보만 묻는다.

금지 예:

- "마감은 언제인가요?"
- "최종 결정권자는 누구인가요?"
- "어떤 형식으로 만들까요?"

허용 예외:

행정 정보가 실제 판단을 가르는 병목일 때.

예:

> 이게 이번 주 금요일 이사회용이면 리스크 최소화 문서이고, 다음 달 전략 워크숍용이면 방향 선택 문서예요. 어느 쪽인가요?

#### 3. Category Options

선택지가 추상 카테고리다.

나쁨:

- 속도
- 품질
- 리스크
- 고객
- 기술

좋음:

- 이번 주 안에 MVP를 열고, 품질 문제는 다음 릴리즈에서 보완한다.
- 출시를 2주 늦추고, 핵심 실패 케이스 3개를 먼저 막는다.
- 고객 5명에게 수동으로 먼저 제공하고, 자동화는 반복 신호가 나온 뒤 시작한다.

#### 4. Leading or Tilted

특정 답을 유도한다.

나쁨:

> 무리하게 출시하기보다는 안전하게 검증하는 게 낫지 않을까요?

좋음:

> 지금 더 큰 비용은 늦게 배워서 기회를 놓치는 것인가요, 빨리 내서 신뢰를 잃는 것인가요?

#### 5. Re-asking Known Information

사용자가 이미 말한 것을 다시 묻는다.

나쁨:

사용자가 "대표님 보고용"이라고 했는데:

> 이걸 누구에게 보여줄 건가요?

좋음:

> 대표님 보고용이라면, 가장 먼저 방어해야 할 건 숫자 근거인가요, 실행 리소스인가요, 리스크 관리인가요?

#### 6. Confirmation Bias

사용자가 이미 선택한 방향을 확인해주는 질문이다.

나쁨:

> 이제 이 방향이 맞나요?

좋음:

> 이 방향이 틀렸다면, 가장 먼저 틀릴 가능성이 큰 전제는 무엇인가요?

#### 7. Internal Product Structure

Argus 내부 작업물을 사용자에게 고르게 한다.

나쁨:

> 이 스켈레톤 중 어느 항목을 더 채울까요?

좋음:

> 지금 더 불확실한 건 고객이 원하는지, 우리가 만들 수 있는지, 대표님이 승인할지 중 어느 쪽인가요?

#### 8. Over-fire on Non-open Requests

vent, flat, validation, crisis에 fork/checkpoint/team machinery를 돌린다.

나쁨:

사용자가 "그냥 너무 지친다"고 했는데:

> 이 상황에서 가장 중요한 결정은 A인가요, B인가요?

좋음:

> 지금은 결정으로 만들기보다, "오래 열려 있고 새 정보는 없는 상태"로만 잡아둘게요.

#### 9. Forced Checkpoint

미래 확인이 의미 없는 상황에 checkpoint를 억지로 만든다.

나쁨:

> 이 감정을 언제 다시 확인할까요?

좋음:

> 이건 판단 체크포인트보다 지금 상태를 정직하게 남기는 게 맞아요.

### 6.2 Positive Quality Tests

좋은 질문은 아래 중 최소 3개 이상을 만족해야 한다.

- 답하면 real question이 바뀐다.
- 답하면 전제 목록이 바뀐다.
- 답하면 다음 실행 경로가 바뀐다.
- 답하면 checkpoint seed가 생긴다.
- 답하면 사용자 본인의 기준이 드러난다.
- 답하면 어떤 리스크를 먼저 볼지 정해진다.
- 선택지가 실제 행동/결정 문장이다.
- 사용자의 언어를 포함한다.
- 나중에 settle할 때 다시 볼 수 있는 손잡이가 생긴다.

### 6.3 Minto-Based Validator

민토 피라미드는 내부 질문 검증기로 쓴다.

#### Top Question Test

이 질문이 현재 real question과 직접 연결되는가?

Fail:

> 마감은 언제인가요?

Pass:

> 마감이 고정되어 있다면, 이번 판단은 완성도보다 어떤 리스크를 먼저 줄일지의 문제가 되나요?

#### Vertical Logic Test

질문 -> 답변 -> 바뀌는 판단/실행/전제가 이어지는가?

Fail:

> 어떤 자료가 더 필요하세요?

Pass:

> 이 판단을 뒤집을 수 있는 자료가 있다면, 고객 반응, 비용 구조, 내부 리소스 중 어디에서 나올 가능성이 가장 큰가요?

#### Same-Level Option Test

선택지들이 같은 층위인가?

Fail:

- 시장 조사
- 고객 5명 인터뷰
- 대표님 설득

Pass:

- 고객 5명에게 직접 구매 의향을 확인한다.
- 내부 팀과 2일짜리 구현 spike를 한다.
- 대표님에게 2주 검증안으로 먼저 승인 가능성을 확인한다.

#### So-What Test

사용자가 답한 뒤 무엇이 달라지는가?

Fail:

답해도 똑같은 skeleton이 나온다.

Pass:

답에 따라 real question, skeleton, premise, checkpoint가 바뀐다.

#### Pyramid Fit Test

이 질문이 상위 판단을 떠받치는 하위 근거/분기인가, 아니면 그냥 궁금한 정보인가?

Fail:

> 누가 이 일을 맡나요?

Pass:

> 이 판단의 병목이 사람 배치라면, 지금 필요한 건 방향 결정인가요, 리소스 재조정인가요?

---

## 7. Current Code Alignment

### 7.1 살릴 것

#### strategic_fork

현재 webapp의 typed `strategic_fork`는 방향이 좋다. 특히 "상사가 사인할 수 있는 1줄 결정"이라는 기준은 유지해야 한다.

강점:

- 카테고리 선택을 금지한다.
- 선택지마다 `decisionLine`, `rationale`, `addsWorkerRole`, `snapshotPatch`를 요구한다.
- 답변에 따라 real question, skeleton, worker role이 바뀌게 한다.

보완:

- checkpoint seed와 premise extraction으로 연결해야 한다.
- plugin 문서의 예시도 webapp 수준으로 맞춰야 한다.

#### weakness_check

현재 `weakness_check`는 새 Argus 방향과 매우 잘 맞는다.

강점:

- 전제를 찌른다.
- 다음 3일 검증 경로로 이어진다.
- decision-maker first reaction까지 연결된다.

보완:

- "weakest assumption"을 premise model과 연결해야 한다.
- 전제 타입과 상태를 업데이트해야 한다.
- checkpoint seed 후보를 자동 생성해야 한다.

#### Request Gate

현재 request type gate는 중요하다.

강점:

- crisis, self_profiling, vent, validation, info, flat, resistance, open을 나누려 한다.
- over-fire를 문제로 인식하고 있다.
- flat decision에서 불필요한 machinery를 피하려 한다.

보완:

- 질문 generator와 gate가 완전히 연결되어야 한다.
- fallback 질문이 gate 원칙을 깨면 안 된다.

### 7.2 고쳐야 할 것

#### Bad Fallback

현재 fallback에 "이 결과물을 누가 최종 판단해?" 또는 "Who will make the final decision on this?" 류가 남아 있다면 제거해야 한다.

이 질문은 prompt 안에서 나쁜 질문으로 금지한 바로 그 유형이다. typed question 생성이 실패하는 순간 품질 하한선이 무너진다.

대체 fallback:

- "이 판단이 틀렸다고 드러난다면, 가장 먼저 어디에서 신호가 나타날까요?"
- "이 결정에서 결과를 가장 크게 바꿀 제약은 무엇인가요?"
- "지금 더 불확실한 건 고객 반응, 내부 실행력, 이해관계자 승인 중 어느 쪽인가요?"

#### Weak Deepening Fallback

"이제 이 방향이 맞나요?" 같은 질문은 confirmation bias를 만든다.

대체:

- "이 방향이 틀렸다면, 어떤 전제가 가장 먼저 무너질까요?"
- "이 방향을 계속 가기 전에 무엇 하나만 확인해야 한다면 무엇인가요?"
- "지금 판단을 가장 크게 바꿀 수 있는 새 정보는 어디에서 나올까요?"

#### Unimplemented `frame_clarify`

질문 타입에는 `frame_clarify`가 있지만 typed prompt가 제대로 구현되어 있지 않다면 우선순위를 높여야 한다.

low-confidence framing은 가장 위험한 구간이다. 이때 generic fallback에 의존하면 잘못된 방향으로 전체 세션이 진행된다.

#### `skeleton_clarify`

"스켈레톤 중 무엇을 채울까"는 사용자 관점에서 약하다.

대체 방향:

- skeleton item 선택이 아니라 premise/fork/checkpoint 선택으로 바꾼다.
- 사용자에게 내부 구조를 고르게 하지 않는다.

#### Plugin/Webapp Drift

plugin의 clarify skill과 webapp prompt가 서로 다른 기준을 갖고 있으면 제품 품질이 흔들린다.

필요:

- strategic fork 예시 통일
- bad question 목록 통일
- question quality gate 통일
- checkpoint seed 정책 통일
- request gate 기준 통일

---

## 8. Proposed Implementation Plan

### Phase 1. Question Quality Gate 추가

목표:

나쁜 질문이 출력되지 않도록 하한선을 먼저 올린다.

작업:

1. question validator 유틸 추가
2. hard reject rule 구현
3. Minto-based validator 구현
4. fallback 질문 교체
5. typed question 실패 시에도 안전한 fallback만 나오게 변경

검증:

- admin-only 질문이 생성되지 않는지
- category option이 생성되지 않는지
- "이 방향이 맞나요?" 류가 나오지 않는지
- vent/flat/validation에서 fork가 생성되지 않는지

### Phase 2. Frame Clarify typed prompt 구현

목표:

framing confidence가 낮을 때 generic question이 아니라 frame 선택 질문이 나오게 한다.

출력 구조:

```ts
interface FrameClarifyEffect {
  framingBoost?: number;
  snapshotPatch?: {
    real_question?: string;
    hidden_assumptions?: string[];
    skeleton?: string[];
    insight?: string;
  };
}
```

질문 예:

> 지금 진짜 결정은 어느 쪽에 가까운가요?

선택지:

- 이 일을 할지 말지 정해야 한다.
- 하기로 했다면 어떤 범위로 할지 정해야 한다.
- 무엇을 할지는 정했지만 누구를 먼저 설득해야 할지 모르겠다.

주의:

선택지는 "문제 유형"이 아니라 실제 frame이어야 한다.

### Phase 3. Premise Model 도입

목표:

hidden assumptions를 추적 가능한 premise로 확장한다.

예상 타입:

```ts
type PremiseType =
  | 'goal'
  | 'causal'
  | 'capability'
  | 'constraint'
  | 'stakeholder'
  | 'evidence'
  | 'reversibility';

type PremiseState =
  | 'assumed'
  | 'supported'
  | 'confirmed'
  | 'doubtful'
  | 'unknown'
  | 'changed';

interface JudgmentPremise {
  id: string;
  text: string;
  type: PremiseType;
  state: PremiseState;
  confidence: 'high' | 'medium' | 'low' | 'unclear';
  why_it_matters: string;
  possible_check?: string;
}
```

주의:

기존 `hidden_assumptions`를 즉시 제거하지 말고, 호환 레이어를 둔다. 예: hidden assumptions는 premise list의 plain-text projection으로 유지.

### Phase 4. Premise Extraction question 추가

목표:

strategic fork 이후 선택된 방향이 어떤 전제 위에 서 있는지 명시한다.

방식:

Argus가 후보 전제를 제시하고, 사용자는 가장 불안한 것을 선택하거나 수정한다.

질문 예:

> 내가 보기엔 이 방향은 세 전제 위에 서 있어요. 어느 쪽이 가장 불안한가요?

선택지:

- 고객이 이 문제를 충분히 아프게 느낀다.
- 우리 팀이 2주 안에 보여줄 수 있다.
- 대표님은 완성 계획보다 빠른 검증안을 선호한다.

출력:

- selected premise
- premise confidence
- next question type: weakness_check or checkpoint_seed

### Phase 5. Checkpoint Seed 도입

목표:

Current Course와 judgment checkpoint를 연결한다.

예상 구조:

```ts
type CheckpointType =
  | 'outcome'
  | 'reaction'
  | 'evidence'
  | 'standard'
  | 'drift';

interface JudgmentCheckpointSeed {
  id: string;
  type: CheckpointType;
  prompt: string;
  expected_signal?: string;
  negative_signal?: string;
  return_handle: {
    kind: 'date' | 'event' | 'metric' | 'reaction' | 'evidence' | 'manual';
    value: string;
  };
  linked_premise_ids: string[];
  ambiguity_allowed: boolean;
}
```

질문 예:

> 나중에 무엇을 보면 이 판단이 더 선명해질까요?

선택지:

- 고객 3명 이상이 실제 사용 의사를 보이는지
- 대표님이 완성안보다 검증안을 승인하는지
- 2주 안에 핵심 기능을 보여줄 수 있는지

주의:

checkpoint seed는 강제하면 안 된다. "아직 판단하기 어렵다" 또는 "지금은 기록만"이 가능해야 한다.

### Phase 6. Current Course 업데이트

목표:

Current Course가 단순 추천/요약이 아니라 판단 구조를 압축해서 보여주게 한다.

현재 유용한 필드:

- current_course
- why_this_course
- open_risk
- set_aside_options
- next_step
- prediction_to_check

개선 방향:

- `prediction_to_check`를 `judgment_checkpoint`로 확장
- `open_risk`를 weakest premise와 연결
- `why_this_course`에 선택된 premise를 반영
- `set_aside_options`에 버린 방향과 그 이유를 남김

Current Course는 이렇게 느껴져야 한다.

> 지금은 이 방향으로 간다.  
> 왜냐하면 이 전제를 현재로서는 가장 믿을 수 있기 때문이다.  
> 다만 이 전제가 틀리면 방향을 바꿔야 한다.  
> 그래서 이 신호를 나중에 다시 본다.

### Phase 7. Settle experience 연결

목표:

사용자가 돌아왔을 때 판단과 현실을 정직하게 비교하게 한다.

settle 결과는 단순히 맞음/틀림이 아니다.

가능한 결과:

- mostly held
- missed
- mixed
- unclear
- changed context

사용자에게 허용해야 하는 답:

- 아직 판단하기 어렵다.
- 데이터가 부족하다.
- 결과가 섞였다.
- 해석에 자신이 없다.
- 상황이 바뀌었다.

중요:

Argus는 사용자가 현실을 거짓으로 정리하지 않게 도와야 한다. 불확실하면 불확실하다고 남기는 것이 좋은 settle이다.

---

## 9. UX Design Notes

### 9.1 질문 UI

질문은 설문처럼 보이면 안 된다. 판단의 초점이 좁혀지는 느낌이어야 한다.

각 질문에는 다음이 있어야 한다.

- 질문 본문
- 왜 이 질문이 중요한지 한 줄
- 2-4개의 선택지
- 직접 입력 가능
- "아직 모르겠다" 또는 "나중에 판단" 경로

선택지는 구체적인 장면/결정/검증 경로여야 한다.

### 9.2 사용자의 피로 관리

질문이 좋아도 사용자가 지치면 실패다.

피로 신호:

- "머리 아파"
- "생각하기 싫다"
- "그냥 정해줘"
- "모르겠다"
- 반복적인 짧은 답변
- 선택 회피

대응:

- 질문을 하나 줄인다.
- Argus가 후보를 제안한다.
- "지금은 여기까지만 잡아도 충분하다"고 말한다.
- checkpoint seed를 강요하지 않는다.

예:

> 지금은 이 정도면 충분해요. 판단의 핵심 전제는 "고객이 이 문제를 충분히 아프게 느낀다"로 잡아두고, 나중에 고객 반응이 생기면 다시 보면 됩니다.

### 9.3 능동적 피드백

사용자가 답을 고르면 Argus는 단순히 다음 질문으로 넘어가면 안 된다. 답변이 판단 구조를 어떻게 바꿨는지 보여줘야 한다.

예:

> 이 답변이면 문제는 "무엇을 만들까"가 아니라 "2주 안에 고객 반응을 볼 수 있는 가장 작은 증거가 무엇인가"로 바뀌어요.

또는:

> 지금 선택은 속도를 택한 게 아니라, "늦게 배워서 기회를 놓치는 비용이 더 크다"는 전제를 택한 거예요.

이 피드백에서 사용자는 효능감을 느낀다.

주의:

과하면 반발감이 생긴다. "당신은 이런 사람입니다" 식으로 해석하면 안 된다. 판단 구조만 말한다.

나쁨:

> 당신은 리스크를 회피하는 유형이네요.

좋음:

> 이번 판단에서는 "실패 비용"보다 "늦게 배우는 비용"을 더 크게 보고 있어요.

### 9.4 성장 피드백

Argus는 사용자가 판단력이 성장하고 있다는 느낌을 주어야 한다. 단, 어거지로 성장 서사를 끼워 맞추면 안 된다.

좋은 성장 피드백:

- 특정 판단 행동에 기반한다.
- 이전 기록과 비교할 때만 말한다.
- 사용자의 성격이 아니라 판단 습관을 말한다.

예:

> 이번에는 예전보다 "무엇을 확인하면 판단이 바뀌는지"를 더 빨리 잡았어요.

나쁜 성장 피드백:

> 당신은 점점 더 전략적인 사람이 되고 있어요.

---

## 10. Evaluation Set

질문 품질은 느낌으로 보면 안 된다. 대표 케이스 세트를 만들고 회귀 테스트해야 한다.

### 10.1 Case Types

#### Case A. Real Strategic Decision

예:

> 기존 고객 확장에 집중할지, 신규 시장으로 갈지 고민이다.

기대:

- strategic fork 발생
- premise extraction 발생
- checkpoint seed 가능

#### Case B. Flat Decision

예:

> 오늘 점심을 A에서 먹을까 B에서 먹을까?

기대:

- full machinery 금지
- 짧은 direct answer
- checkpoint 없음

#### Case C. Validation

예:

> 이미 A로 하기로 했는데, sanity check만 해줘.

기대:

- 결정을 다시 열지 않음
- 중립적인 cheap check 하나만
- "맞다/틀리다" verdict 금지

#### Case D. Vent

예:

> 이 프로젝트 진짜 너무 지친다.

기대:

- fork 금지
- 판단으로 제조하지 않음
- 한 줄 반영 + stop

#### Case E. Resistance

예:

> 몇 달째 이 결정을 못 내리고 계속 보고만 있다.

기대:

- 더 많은 분석 금지
- 작은 현실 테스트 제안
- avoidance라는 성격 verdict 금지

#### Case F. Execution Request With Weak Premise

예:

> 이 기능 PRD 만들어줘.

하지만 맥락상 기능 자체가 필요한지 불확실함.

기대:

- 바로 PRD로 가지 않음
- frame clarify 또는 premise question
- "이 기능을 만들지 말지"와 "어떻게 만들지" 구분

#### Case G. External Stakeholder Gate

예:

> 대표님 설득용 전략안을 만들어야 한다.

기대:

- 최종 결정권자를 묻지 않음
- 대표님이 실제로 물고 늘어질 지점 질문
- stakeholder premise 생성

#### Case H. One Pivotal Number

예:

> 유료 전환 가격을 올릴지 고민이다.

기대:

- 수치 하나가 판단을 뒤집는지 확인
- metric checkpoint 가능
- 정성 질문만 반복하지 않음

#### Case I. Ambiguous Reality

예:

> 출시했는데 반응이 애매하다. 잘한 판단인지 모르겠다.

기대:

- 맞음/틀림 강제 금지
- mixed/unclear 허용
- 어떤 증거가 부족한지 기록

### 10.2 Evaluation Criteria

각 케이스에서 확인할 것:

- 질문을 아예 안 던지는 게 맞는 경우에 안 던졌는가?
- 질문이 전제를 드러냈는가?
- 선택지가 실제 결정문인가?
- 답하면 다음 경로가 바뀌는가?
- checkpoint로 이어지는가?
- 사용자가 이미 말한 것을 다시 묻지 않았는가?
- 행정 질문으로 도망가지 않았는가?
- 과하게 똑똑한 척하지 않았는가?
- 사용자의 언어를 따라갔는가?
- 모호함을 정직하게 남길 수 있게 했는가?

---

## 11. Concrete Prompt Changes

### 11.1 Global Question Instruction

모든 question generator에 들어갈 핵심 문장:

> Your job is not to collect information. Your job is to expose the premise or fork that changes the user's judgment.

한국어 버전:

> 정보를 더 받는 것이 목적이 아니다. 사용자의 판단을 실제로 바꾸는 전제나 갈림길을 드러내는 것이 목적이다.

### 11.2 Bad Question Ban

모든 question generator에 명시:

Never ask these unless they are the actual load-bearing constraint:

- Who is the final decision-maker?
- What is the deadline?
- What format do you want?
- What tone do you want?
- Which section should we fill next?
- Does this direction look right?

한국어:

- 최종 결정권자가 누구인가요?
- 마감은 언제인가요?
- 어떤 형식이 필요한가요?
- 어떤 톤을 원하나요?
- 어느 섹션을 더 채울까요?
- 이 방향이 맞나요?

### 11.3 Good Question Pattern

질문은 가능한 한 아래 중 하나여야 한다.

- frame question: "지금 진짜 결정은 X인가요, Y인가요, Z인가요?"
- fork question: "A 방식으로 약속할 것인가, B 방식으로 약속할 것인가?"
- premise question: "이 방향이 맞으려면 무엇이 참이어야 하나요?"
- weakness question: "틀렸다면 어느 전제가 먼저 무너질까요?"
- checkpoint question: "나중에 무엇을 보면 이 판단이 더 선명해질까요?"
- execution question: "이 전제를 가장 작게 확인하려면 다음 3일 안에 무엇을 할 수 있나요?"

### 11.4 Option Rule

모든 선택지는 다음 조건을 만족해야 한다.

- 자체로 의미가 있어야 한다.
- 선택지만 읽어도 다음 단계가 어느 정도 결정되어야 한다.
- 카테고리가 아니라 장면, 결정, 검증 경로여야 한다.
- 서로 같은 층위여야 한다.
- 최소 하나의 전제 또는 실행 경로를 바꿔야 한다.

---

## 12. Data Model Sketch

### 12.1 FlowQuestion Extension

```ts
type QuestionTypeTag =
  | 'frame_clarify'
  | 'strategic_fork'
  | 'premise_extraction'
  | 'weakness_check'
  | 'checkpoint_seed'
  | 'execution_carry'
  | 'free_follow_up';
```

### 12.2 Question Effect

```ts
interface QuestionEffectBase {
  snapshotPatch?: SnapshotPatch;
  premisePatch?: PremisePatch;
  checkpointSeed?: JudgmentCheckpointSeed;
}
```

### 12.3 Premise Patch

```ts
interface PremisePatch {
  add?: JudgmentPremise[];
  update?: Partial<JudgmentPremise>[];
  selected_weakest_premise_id?: string;
}
```

### 12.4 Snapshot Patch

기존 snapshot patch는 유지하되 premise와 checkpoint를 붙인다.

```ts
type SnapshotPatch = Partial<{
  real_question: string;
  hidden_assumptions: string[];
  skeleton: string[];
  insight: string;
  premises: JudgmentPremise[];
  checkpoint_seed: JudgmentCheckpointSeed;
}>;
```

주의:

기존 타입을 바로 깨지 말고 optional로 확장한다. localStorage, Supabase, old sessions를 고려해 optional chaining과 fallback을 써야 한다.

---

## 13. Migration Considerations

AGENTS.md 원칙에 따라 타입 필드를 추가할 경우 다음을 모두 확인해야 한다.

1. Type definition
2. Store creator
3. Store defaults
4. Supabase table/migration
5. Prompts that use the type
6. UI display
7. Handoff/conversion functions

특히 `AnalysisSnapshot`, `FlowQuestion`, `CurrentCourse` 계열에 premise/checkpoint 필드를 추가하면 다음을 같이 봐야 한다.

- `stores/types.ts`
- progressive flow store
- handoff store
- Supabase merge logic
- `progressive-prompts.ts`
- `progressive-engine.ts`
- plugin schema
- Current Course renderer
- journal/pattern analysis

원칙:

- old data may lack new fields
- LLM output may omit fields
- Supabase remote shape may differ

따라서 모든 신규 필드는 optional + fallback으로 시작한다.

---

## 14. Open Questions

아직 더 고민해야 할 것들:

1. Premise Extraction을 별도 질문으로 둘 것인가, Strategic Fork 답변 후 Argus가 자동으로 제안할 것인가?
2. Checkpoint Seed를 항상 묻지 말고 언제 자동 제안으로만 처리할 것인가?
3. Current Course에서 premise를 얼마나 노출할 것인가?
4. 사용자가 "모르겠다"를 선택했을 때 Argus는 얼마나 더 도와야 하는가?
5. Settle에서 ambiguous reality를 어떻게 UX로 편하게 기록하게 할 것인가?
6. Growth feedback은 몇 회 이상의 기록이 있어야 보여줄 것인가?
7. Question validator를 LLM judge로 둘 것인가, deterministic rule로 둘 것인가, 둘을 섞을 것인가?
8. Plugin과 webapp의 prompt single source of truth를 어떻게 만들 것인가?
9. 기존 `hidden_assumptions`와 새 `premises`를 언제까지 병행할 것인가?
10. 사용자에게 "전제"라는 단어를 그대로 쓸 것인가, "이 판단이 기대고 있는 것"처럼 풀어 쓸 것인가?

---

## 15. Target Experience

좋은 세션은 이렇게 흘러야 한다.

사용자:

> 신규 시장으로 갈지 기존 고객 확장에 집중할지 모르겠어.

Argus:

> 지금 진짜 결정은 "어느 쪽이 더 좋아 보이는가"가 아니라, 이번 분기에 더 비싼 실패가 무엇인지예요. 늦게 배워서 신규 기회를 놓치는 비용이 큰가요, 기존 고객 기반을 더 키우지 못하는 비용이 큰가요?

질문:

> 이번 분기에 어떤 약속을 먼저 걸어야 하나요?

선택지:

- 신규 시장에서 고객 5명에게 수동 MVP를 보여주고, 4주 안에 반복 사용 신호를 본다.
- 기존 고객 확장에 집중하고, 업셀 전환율을 6주 안에 15% 개선한다.
- 2주 동안 양쪽 모두에서 가장 싼 검증을 하고, 그 결과로 분기 방향을 고정한다.

사용자 답변 후 Argus:

> 이 선택은 "신규 시장이 크다"보다 "4주 안에 실제 반복 사용 신호를 볼 수 있다"는 전제에 기대고 있어요. 그래서 가장 먼저 확인할 건 시장 규모가 아니라, 고객이 실제로 다시 쓰는지예요.

다음 질문:

> 이 판단이 틀렸다면, 어느 전제가 먼저 무너질까요?

선택지:

- 고객은 관심은 있지만 반복 사용하지 않는다.
- 팀이 4주 안에 보여줄 만한 MVP를 만들지 못한다.
- 대표님은 신규 시장 검증보다 기존 고객 매출을 더 원한다.

checkpoint seed:

> 나중에 확인할 지점은 이렇게 잡을 수 있어요: "4주 안에 고객 5명 중 2명 이상이 두 번째 사용을 요청하는가." 이 신호가 없으면 방향을 다시 봐야 합니다.

이 경험에서 사용자는 단순히 계획을 받은 것이 아니다. 자신이 어떤 전제 위에서 판단하고 있는지, 무엇을 확인해야 하는지, 나중에 무엇을 보고 배울지 알게 된다.

---

## 16. One-Line Product North Star

Argus clarify의 목표:

> 질문 몇 개로 사용자의 판단을 대신하는 것이 아니라, 사용자가 자기 판단이 기대고 있는 전제를 보게 만들고, 그 전제를 현실 속에서 다시 확인할 수 있게 한다.

