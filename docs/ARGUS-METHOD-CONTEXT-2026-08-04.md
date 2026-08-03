# ARGUS METHOD — DESIGN HISTORY AND REVIEW CONTEXT

## v0.1에서 v0.3까지 무엇을 고민했고, 왜 지금의 결론에 도달했는가

Date: 2026-08-04
Status: **Descriptive decision history and AI handoff; not a normative method canon**
Normative canon: `docs/ARGUS-METHOD-V0.3-2026-08-03.md`
Historical snapshots: `ARGUS-METHOD-V0.1`, `ARGUS-METHOD-V0.2`
Scope: product reasoning, theoretical choices, rejected paths, unresolved hypotheses,
and review instructions

---

## 0. 처음 읽는 사람과 AI를 위한 5분 요약

### 0.1 한 문장으로 무슨 일이 있었나

Argus는 오랫동안 **판단을 왜곡하지 않고 보존하는 구조**를 깊게 만들었지만,
그 구조 위에서 **사용자가 지금 더 나은 결정을 내리도록 어떻게 적극적으로 도울지**는
충분히 방법론화하지 못했다. 2026-08-03의 재설계는 이 둘을 분리하고 순서를
바로잡은 과정이다.

```text
이전 중심
정직한 기록 + 한 전제/한 질문 + 현실 귀환

문제 제기
기록은 강하지만 첫 세션의 직접 가치와 좋은 판단 방법이 약함

현재 중심
능동적 결정 지원 + 사용자 채택 + 정직한 기록 + 행동 + 현실 귀환 + 제한된 학습
```

### 0.2 현재 결론

Argus는 다음 제품이 되어야 한다.

> 중요한 제품·시장 결정을 앞둔 사람이 지금 필요한 만큼만 더 잘 생각하고,
> 실제 다음 행동을 선택하며, 사용자가 채택한 판단을 왜곡 없이 남기고, 현실의
> signal이 돌아오면 다음 판단 방식을 개선하도록 돕는 폐루프 의사결정 파트너.

사용자에게 보이는 방법은 네 동사뿐이다.

```text
UNDERSTAND → IMPROVE ↺ → MOVE → RETURN
이해한다   → 개선한다   → 움직인다 → 돌아본다
```

### 0.3 현재 상태는 제품 구현 GO가 아니다

```text
GO      · method manual, offline harness, comparative evaluation, real pilot
NO-GO   · public UX migration, canonical schema migration, broad implementation
UNKNOWN · 일반 AI보다 Argus의 폐루프가 실제로 더 가치 있는가
```

v0.3은 완성된 제품의 증거가 아니라 **검증할 수 있을 만큼 명료해진 가설**이다.

### 0.4 이 문서와 다른 문서의 권한

| 문서 | 역할 | 권한 |
|---|---|---|
| `ARGUS-METHOD-V0.3-2026-08-03.md` | 현재 방법·제품 경계·AI 계약·실증 gate | 구현 전 규범적 정본 |
| 이 문서 | v0.3까지의 이유·긴장·폐기안·미해결 질문 | 설명과 검토 context |
| `ARGUS-METHOD-V0.2-2026-08-03.md` | graph·module·harness를 최대로 확장한 연구안 | 역사적 snapshot |
| `ARGUS-METHOD-V0.1-2026-08-03.md` | 능동적 코칭으로 방향을 전환한 첫 baseline | 역사적 snapshot |
| `ARGUS-BLUEPRINT.md` §9.12 | Track R의 권한·단계·무접촉 경계 | repository 실행 정본 |
| 기존 F/H/K/E/JCR 문서 | 무결성·배관·기존 구현의 근거 | 연구 자산; 새 방법의 자동 제약 아님 |

서로 충돌하면 v0.3의 방법론이 우선하지만, 현재 공개 runtime을 자동 변경하지는
않는다. runtime 변경은 R3 증거와 R4 Blueprint amendment 뒤에만 가능하다.

### 0.5 이 기록의 provenance와 한계

이 문서는 2026-08-03~04의 창업자 대화, v0.1~v0.3 원문, 최근 Git history,
기존 value/architecture 문서를 바탕으로 재구성했다. 전체 대화 transcript는 아니며,
문장 사이의 연결과 쟁점 이름은 작성 AI의 synthesis다.

- 인용부호 안의 창업자 문장은 방향을 정한 primary design input이다.
- version별 내용은 보존된 원문으로 확인했다.
- 최근 구현에 대한 평가는 당시 repository review와 commit history에 근거하지만,
  이후 구현 판단에 사용할 때는 코드를 다시 검증해야 한다.
- 이 문서가 어떤 설계 선택을 기록한다는 사실은 그 선택의 실증적 정당성을 뜻하지
  않는다.

---

## 1. 재설계 이전의 Argus

### 1.1 이미 강했던 것

기존 Argus의 가장 강한 부분은 화려한 AI 분석이 아니라 의미와 권한의 절제였다.

- AI proposal과 사용자 judgment를 구분했다.
- 사용자만 seal, adopt, resolve, close 같은 권한 행위를 할 수 있게 했다.
- 누가 무엇을 언제 말하고 승인했는지 provenance와 authority를 추적했다.
- 과거 판단과 나중 observation을 분리하고 과거를 덮어쓰지 않았다.
- outcome, resolution, closure를 같은 것으로 취급하지 않았다.
- 사용자 성격·능력·승률을 AI가 판정하는 것을 제한했다.
- MCP, plugin, web 사이의 의미 drift와 silent failure를 실제 테스트로 추적했다.
- 귀환 알림, answer delta, 반복 질문, authorship violation을 계측하기 시작했다.

이 기반은 버리지 않았다. v0.3의 `honest agency`, Source Ledger, adoption gate,
Return/Learning은 이 축적 위에서 가능하다.

### 1.2 당시 제품 철학

이전 철학은 대략 다음과 같았다.

```text
maximum generation, zero judgment
prediction → seal → settle against reality
one grounded premise → one valuable question
user-owned ledger → honest return
```

이 철학은 AI가 사람의 결정을 대신하거나, 사용자에게 없던 이유를 만들어 넣거나,
결과를 보고 과거를 고치는 위험에 매우 강했다. 특히 일반 LLM이 끊긴 맥락을
그럴듯하게 메우는 문제를 구조적으로 막으려 한 것은 계속 유지할 핵심 자산이다.

### 1.3 왜 수십 개 커밋 뒤에도 core가 미완성이었나

2026-08-02 전후의 최근 커밋은 실제로 많은 것을 고쳤다.

- baseline을 다음 턴까지 보존
- 질문이 이미 답한 내용을 다시 묻지 않게 함
- answer가 무엇을 바꿨는지 delta로 표시
- MCP가 AI belief를 사용자 belief로 쓰는 오류 차단
- generic return 질문 대신 당시 특정 질문 복원
- return funnel과 reminder→answer 전환 계측
- 영문·국문 guard parity
- 오래된 analysis를 새 결과처럼 보이는 문제 수정
- 질문·응답 latency와 model call 비용 계측

따라서 “50개 커밋이 아무 일도 하지 않았다”는 평가는 정확하지 않다. 배관,
저자성, 관찰 가능성, 회귀 방지는 실제로 강해졌다.

그러나 많은 커밋이 다음 질문에는 직접 답하지 않았다.

- 좋은 결정 과정은 정확히 무엇인가?
- 사용자의 현재 병목은 무엇인가?
- 지금 질문, 조사, 대안, 반론, 추천 중 무엇을 해야 하는가?
- 얼마나 생각하면 충분한가?
- 전략, 진단, 예측, 실행은 어떻게 다르게 도와야 하는가?
- 첫 세션에서 일반 AI보다 어떤 직접 가치를 주는가?

즉, **제품의 혈관은 많이 고쳤지만 어떤 도움을 흘려보낼지 정하는 method core는
상대적으로 약했다.** 구현량과 방법론 완성도는 같은 지표가 아니었다.

### 1.4 기존 가치 계약의 한계

2026-08-02의 value contract는 첫 세션을 다음처럼 보았다.

```text
pre-AI baseline
→ one grounded mirror
→ one decision-shaping question
→ visible delta
→ user wording
→ reality return
```

이것은 당시 premise 중심 흐름 안에서는 좋은 개선이었다. 반복 질문과 AI의
저자성 침범을 줄이고, “한 질문이 실제로 상태를 바꾸는가”를 측정 가능하게 했다.

하지만 이 계약은 여전히 Argus의 직접 도움을 너무 좁게 정의했다.

- 질문하지 않아도 대안을 만들어 줄 수 있다.
- 외부 사실을 조사하는 편이 더 유용할 수 있다.
- 사용자의 논리에 반례를 줄 수 있다.
- 충분히 이해했다면 명확한 추천을 할 수 있다.
- 결정 대신 실험이나 contingent policy를 설계할 수 있다.
- 질문 하나보다 여러 턴의 정교한 협업이 필요한 결정도 있다.

“좋은 질문”은 중요한 개입이지만 제품 전체가 될 수는 없었다.

---

## 2. 창업자 피드백이 방향을 바꾼 순서

### 2.1 hero-demo-v2는 표현층으로 보류

재설계 초기에 demo를 폐기하거나 더 다듬는 선택이 먼저 논의됐다. 창업자의 판단은
“데모는 일단 괜찮고, 나중에 방법에 맞게 다시 만들자”였다.

이 결정은 중요하다.

- demo의 시각적 완성도가 core method의 증거는 아니다.
- method가 바뀌기 전에 demo를 최적화하면 낡은 flow를 더 단단히 만들 수 있다.
- 기존 demo는 참고 자산으로 보존하되 새 기획의 제약으로 삼지 않는다.

따라서 Track R은 landing/demo 수정이 아니라 method와 evidence를 먼저 소유한다.

### 2.2 첫 번째 충격: 구현량과 core 가치의 불일치

최근 구현을 총괄 검토한 뒤, 창업자는 많은 표면과 껍데기가 만들어졌지만 최초
기획의 중요한 부분이 아직 연결되지 않았다는 점에 문제를 제기했다.

핵심 반응은 다음이었다.

> “나는 50번의 commit을 하면서 다 구체화되고 core가 탄탄해졌을 줄 알았는데.”

이 반응은 구현을 더 서두르라는 지시가 아니었다. 오히려 core 가치와 방법을 먼저
다시 명료하게 만들라는 지시였다.

### 2.3 첫 세션 가치의 재정의

초기 대화에서는 다음 문장이 중요하게 등장했다.

> “첫 세션에서 한 번의 좋은 질문만으로 ‘내 판단이 정확히 이렇게 달라졌구나’를
> 느껴야 한다.”

이 문장은 두 부분으로 읽혔다.

1. 첫 세션은 장기 귀환을 기다리지 않고 즉시 가치가 있어야 한다.
2. 변화는 막연한 만족이 아니라 사용자가 알아볼 수 있는 판단 delta여야 한다.

그러나 이후 창업자는 이 문장을 더 강하게 교정했다.

> “Argus는 정말로 하나의 질문이 아니야. 정말 가치 있게 개입해야 돼.”

따라서 최종 원칙은 `one question`이 아니라 다음이 되었다.

```text
첫 응답부터 material contribution
한 턴에 primary move 하나
필요하면 여러 턴
질문은 여러 개입 중 하나
실제 행동이 더 가치 있으면 멈춤
```

이 사이 창업자는 최종 사용자 여정을 먼저 쉬운 말로 설명하라고 요구했다. 이 요청은
framework 이름보다 사용자가 실제로 무엇을 보고, 무엇이 달라지고, 어디로 이동하는지
먼저 설계하게 했다. 그 결과가 이후 네 동사 flow의 출발점이 되었다.

### 2.4 Minto와 전략 도구에 대한 비교 요구

창업자는 Minto Pyramid처럼 오래 쓰이는 컨설팅 방법과 비교했을 때 Argus가 그만한
구조적 가치와 이론적 기반을 가지는지 물었다.

이 질문은 “Minto를 복제하라”는 뜻이 아니었다. 다음 세 가지를 요구했다.

- 외우기 쉬운 방법적 골격
- 상황이 달라도 일관되게 적용되는 사고 규율
- 좋은 문장이나 prompt를 넘어서는 재사용 가치

검토 결과 Minto는 주로 생각과 커뮤니케이션의 구조화에 강하지만, 의사결정 전체의
규범 이론은 아니다. Argus는 Minto 하나를 중심으로 삼기보다 Decision Quality,
value-focused thinking, uncertainty, naturalistic decision-making, robust strategy,
human-AI reliance, return learning을 목적에 맞게 결합해야 했다.

### 2.5 premise 중심성에서 벗어나라는 지시

기존 Argus는 load-bearing premise와 한 질문을 중심으로 발전했다. 창업자는 이 흐름이
계속 “전제만 조지는” 경험이 된다고 지적했다.

실제 결정에는 서로 다른 종류가 있다.

- 사용자가 이루고 싶은 가치
- 선택 가능한 대안
- 사실과 evidence
- 미래에 대한 belief와 uncertainty
- 현실적 constraint
- consequence와 trade-off
- 실행 책임과 commitment

이들을 모두 premise로 번역하면 가치 충돌을 사실 검증처럼 다루거나, 선호를
constraint로 만들거나, 행동 설계를 빠뜨리게 된다. 이 지적이 v0.1의 Decision
Quality Model로 이어졌다.

### 2.6 zero judgment의 재해석

기존 원칙은 AI의 방향성 있는 개입을 매우 의심했다. 이 원칙은 over-fire와
persuasive AI를 방어했지만, 다음 부작용도 만들었다.

- 근거가 한 방향을 지지해도 질문 뒤에 숨는다.
- 사용자가 원하는 직접 도움을 회피한다.
- “판단하지 않음”이 “도움이 없음”으로 느껴질 수 있다.
- 첫 세션 가치가 코칭 기법 하나에 종속된다.

창업자의 최종 입장은 명확했다.

> 현실을 왜곡하지 않는 선에서 코칭하고 직접 돕는 것은 좋다.

그래서 `zero judgment` 전체를 버리지 않고 두 부분으로 분해했다.

```text
유지
저자성, provenance, 현실성, 과거 비덮어쓰기, 사용자에 대한 평가 금지

폐기
방향 제시, 반론, 조사, 대안 생성, 추천까지 금지하는 광범위한 수동성

새 원칙
honest agency
```

### 2.7 구현에 binding되지 말라는 지시

창업자는 기존 schema, page, route, persona, progressive flow를 보존하는 방향으로
기획을 축소하지 말라고 했다. 이는 기존 자산을 모두 폐기하라는 뜻도 아니었다.

결론은 다음 위계다.

```text
방법이 인간 문제와 가치를 정한다.
architecture가 그 방법을 안정적으로 실행한다.
기존 코드는 retain / reforge / retire의 검토 대상이다.
존재한다는 이유만으로 방법을 구속하지 않는다.
```

### 2.8 복잡한 v0.2를 다시 공격하라는 지시

Decision Graph와 체계화는 긍정적으로 받아들여졌지만, 창업자는 여기서 멈추지 않고
더 비판적이고 현실적으로 검토하라고 요청했다.

핵심 요구는 다음이었다.

- 이론에 그치지 말 것
- 이론적으로도 더 탄탄할 것
- 앞으로의 구현 비용을 가르는 최종 판단을 내릴 것
- 기존에 만들었다는 이유로 accept하지 말 것
- 필요하면 과감히 줄일 것

이 요청이 v0.2의 확장이 아니라 v0.3의 대규모 삭제와 단순화를 만들었다.

---

## 3. 설계 과정의 세 버전

### 3.1 v0.1 — 방향을 돌린 문서

v0.1의 역할은 “원장은 방법론이 아니다”를 선언하고 Argus를 능동적 판단 코칭으로
돌리는 것이었다.

주요 도입:

- 코칭, 결정, 정직한 연속성, 학습의 네 가치 순간
- Frame, Values, Alternatives, Beliefs, Evidence, Constraints, Trade-offs,
  Commitment의 8요소 모델
- Coaching, Decision, Learning의 세 loop
- 질문 외에 반론·조사·대안·추천을 포함하는 intervention library
- honest agency
- 사용자 채택과 AI proposal의 분리
- 종이 방법→offline harness→실사용 증거→구현의 R track

v0.1이 해결한 것은 **방향**이었다. 그러나 다음이 약했다.

- 8요소가 checklist처럼 보였다.
- 상황별 차이를 충분히 다루지 못했다.
- “가장 약한 요소”가 실제 병목과 같은지 불명확했다.
- LLM에게 무엇을 어떻게 지시할지 충분히 구체적이지 않았다.
- 전략과 deep uncertainty를 다루는 방법이 얕았다.

### 3.2 v0.2 — 가능한 구조를 끝까지 확장한 문서

v0.2는 v0.1의 빈 곳을 전문가 방법론과 AI harness 수준까지 채우려 했다.

주요 확장:

- 15개 node와 typed relation을 가진 Decision Graph
- Choice, Strategy, Diagnosis, Forecast, Plan, Stakeholder, Sensemaking router
- reducible, irreducible, deep, preference, execution, social uncertainty
- strategy kernel과 choice cascade
- directional, process, robust, contingent recommendation
- commitment, signal, outcome, learning return portfolio
- Expected Decision Quality Improvement 개념
- MethodState, InterventionProposal, TurnEnvelope
- prompt stack과 canonical AI operating constitution
- multi-call topology, tool policy, context budget, failure recovery
- 두 개의 end-to-end walkthrough

v0.2는 실패한 문서가 아니다. 다음을 가능하게 했다.

1. “체계적”이라는 말을 실제 구조로 끝까지 밀어보았다.
2. 무엇이 과도한지 구체적으로 볼 수 있게 했다.
3. AI에게 줄 instruction이 원칙만으로는 부족하다는 점을 해결했다.
4. strategy, uncertainty, recommendation, return을 독립적으로 깊게 검토했다.

그러나 v0.2를 제품 정본으로 쓰면 새로운 문제가 생겼다.

- graph가 정교해 보이는 만큼 틀린 구조도 권위를 얻는다.
- 7개 router는 model seed와 문장 표현에 따라 흔들릴 수 있다.
- 내부 completeness가 사용자 진전보다 우선될 수 있다.
- 모든 node/relation을 저장하면 잘못된 기억과 privacy cost가 누적된다.
- EDQI는 실제 측정식이 아닌데 정밀 계산처럼 보인다.
- 넓은 대상군 때문에 gold case와 recommendation policy가 분산된다.
- 일반 AI도 graph와 framework 설명은 흉내 낼 수 있어 차별성이 약하다.

### 3.3 v0.3 — 구조를 삭제하고 제품 계약을 봉인한 문서

v0.3의 목적은 더 많은 것을 넣는 것이 아니라 **무엇이 canonical이어야 하는지
최종 판정하는 것**이었다.

핵심 교정:

| v0.2 | v0.3 |
|---|---|
| 8개 자체 품질 요소 | 검증된 Decision Quality 6요건 |
| 7개 archetype router | 네 user phase + optional reasoning lens |
| full Decision Graph persistence | disposable session working model |
| typed graph completeness | 현재 commitment를 위한 최소 충분성 |
| EDQI | 관찰 가능한 intervention selection 순서 |
| 넓은 업무·커리어 대상 | 창업자·제품 책임자의 제품/시장 결정 |
| 세 surface 동시 구현 암시 | primary surface + second-surface continuity |
| 장기 AI model memory | source, adopted record, observation, learning의 권한 분리 |

v0.3은 Decision Graph를 버리지 않았다. **product truth에서 working representation으로
내렸다.** Strategy도 버리지 않았다. **route에서 optional lens로 내렸다.** 이
차이는 중요하다. 유용한 사고 도구는 유지하되, 제품과 저장 구조의 주인이 되지
못하게 했다.

### 3.4 세 버전을 읽는 법

- v0.1은 왜 능동적 코칭으로 방향을 돌렸는지 읽는 문서다.
- v0.2는 어떤 이론·구조·하네스 가능성을 탐색했는지 읽는 문서다.
- v0.3은 무엇을 실제로 정본으로 남기고 무엇을 내렸는지 읽는 문서다.

v0.3에 없다는 이유로 v0.2의 연구가 모두 금지된 것은 아니다. 필요성이 case와
evidence로 확인되면 optional lens나 implementation detail로 다시 사용할 수 있다.
다만 처음부터 canonical schema나 user journey로 승격하지 않는다.

---

## 4. 가장 중요했던 설계 논쟁과 최종 선택

### 4.1 원장인가, 방법론인가

**논쟁:** 정직한 ledger와 return loop가 강하면 그것만으로 별도 제품 가치가 되는가?

**최종 선택:** 원장은 정직성을 보장하는 기반이지 좋은 판단 방법 자체가 아니다.
첫 세션에 능동적 도움을 주지 못하면 사용자는 귀환까지 가지 않는다.

**남은 가설:** first-session coaching이 좋아도 사용자가 record와 return을 원하지
않을 수 있다. 이 경우 Argus는 active coach 또는 ledger 중 하나로 축소해야 한다.

### 4.2 한 질문인가, 적극적 파트너인가

**논쟁:** 가장 중요한 전제 하나와 질문 하나가 low-friction wedge가 될 수 있는가?

**최종 선택:** 한 질문은 개입 library의 하나다. Argus는 질문 전에 줄 수 있는
material contribution을 먼저 주고, 여러 턴을 허용한다.

**방어:** 한 턴 primary move 하나, material-question rule, stop rule로 과잉 개입을
제한한다.

### 4.3 zero judgment인가, honest agency인가

**논쟁:** 방향성 있는 추천은 사용자 agency를 침범하는가?

**최종 선택:** 추천 자체가 아니라 추천의 권한 세탁과 불확실성 은폐가 문제다.
Argus는 추천할 수 있지만 AI proposal, 사용자 adoption, external fact를 분리한다.

**남은 위험:** 유창한 추천은 metadata가 정직해도 심리적으로 과도한 영향력을 가질
수 있다. 이는 schema만으로 해결되지 않으며 user study가 필요하다.

### 4.4 premise인가, Decision Quality인가

**논쟁:** 모든 판단의 load-bearing premise를 찾는 것이 보편 core가 될 수 있는가?

**최종 선택:** premise는 Information/Reasoning 안의 한 종류다. 좋은 결정은 frame,
alternatives, information, values/trade-offs, reasoning, commitment의 여섯 요건을
상황에 맞게 본다.

### 4.5 full graph인가, 최소 record인가

**논쟁:** 장기 learning을 위해 가능한 한 풍부한 decision graph를 저장해야 하는가?

**최종 선택:** full graph는 AI의 disposable working model이다. 사용자가 채택한
작은 Decision Card와 source event만 durable하다.

**이유:** 더 많은 memory가 더 많은 truth를 의미하지 않는다. AI inference를 오래
보존하면 false precision, stale context, privacy risk, hindsight rewrite가 커진다.

### 4.6 archetype router인가, phase와 lens인가

**논쟁:** Strategy, Diagnosis, Forecast, Plan 등을 별도 module로 route해야 하는가?

**최종 선택:** 사용자의 안정적 흐름은 Understand, Improve, Move, Return이다.
상황별 framework는 현재 병목을 풀기 위한 optional lens다.

**이유:** route label을 먼저 맞히는 제품은 사용자의 문제보다 분류를 우선할 수 있고,
LLM variation이 경험 variation으로 직결된다.

### 4.7 새 점수인가, 관찰 가능한 규칙인가

**논쟁:** 개입 가치를 EDQI 같은 하나의 개념으로 최적화할 수 있는가?

**최종 선택:** 계산할 수 없는 값을 숫자처럼 보이게 하지 않는다. 다음 commitment,
material bottleneck, 가변성, 사용자 비용, 정직성, stop 여부를 순서대로 판단한다.

### 4.8 범용 제품인가, 좁은 wedge인가

**논쟁:** 중요한 개인·업무 결정을 넓게 포괄해야 장기 graph와 learning이 가치 있는가?

**최종 선택:** v1은 창업자·제품 책임자의 제품/시장 결정으로 좁힌다.

**이유:** owner가 명확하고, 결정이 반복되며, 1~12주 안에 signal이 오고, 고위험
전문 책임을 피할 수 있어 method와 return을 함께 검증하기 좋다.

### 4.9 여러 AI agent인가, 하나의 통제된 loop인가

**논쟁:** 다양한 persona와 specialist가 더 깊은 판단을 만드는가?

**최종 선택:** 여러 AI의 합의는 독립 현실 evidence가 아니다. 기본은 한 proposer,
typed candidate, deterministic validation/reducer다. 실제로 분리 가능한 research만
fan-out할 수 있다.

**이유:** agent theater는 reasoning diversity를 보이는 대신 latency, cost,
inconsistency, false consensus를 만들 수 있다.

### 4.10 세 surface 동시 구현인가, 의미 연속성 우선인가

**논쟁:** web, MCP, plugin을 처음부터 모두 같은 수준으로 만들어야 하는가?

**최종 선택:** semantics와 parity fixture는 처음부터 공유하되, production은 primary
surface에서 loop를 완주하고 두 번째 surface에서 continuity를 증명한다.

---

## 5. 이론 탐색에서 실제로 얻은 것

외부 연구의 정확한 서지와 링크는 v0.3 §19에 모아 두었다. 이 절은 논문 목록이
아니라 각 이론이 어떤 설계 결정을 바꿨고 어디까지 주장할 수 없는지를 설명한다.

### 5.1 Minto Pyramid

Minto는 결론과 근거를 구조화하고 커뮤니케이션을 명료하게 하는 데 강하다. Argus가
배울 것은 사용자에게 변화와 이유를 짧고 계층적으로 보여주는 법이다.

그러나 Minto만으로는 다음을 다루기 어렵다.

- 어떤 대안을 선택할지
- 불확실성 아래 consequence를 어떻게 볼지
- 사용자의 value와 trade-off
- 실행 commitment와 현실 return
- AI proposal과 사용자 authority

따라서 Minto는 출력 구조의 참고이지 Argus method의 중심이 아니다.

### 5.2 Decision Quality

Decision Quality의 여섯 요건은 v0.3의 규범적 중심이 되었다.

```text
Appropriate Frame
Creative Alternatives
Meaningful Information
Clear Values & Trade-offs
Sound Reasoning
Commitment to Action
```

이 선택의 이유는 새 checklist를 발명하지 않고, 결정의 규범적 구성요소를 이미
정리한 기반 위에서 Argus의 LLM intervention과 return을 설계하기 위해서다.

중요한 한계: 여섯 요건을 채우는 것이 좋은 outcome을 보장하지 않는다. uncertainty와
luck은 남는다.

### 5.3 Value-Focused Thinking과 Value of Information

Value-Focused Thinking은 주어진 대안 두 개를 비교하기 전에 사용자가 이루고 지킬
것에서 더 나은 대안을 만들게 한다.

Value of Information은 질문과 research의 가치를 다음처럼 제한한다.

> 답을 알게 되었을 때 선택이나 행동이 바뀌는가?

이것이 material-question rule과 research policy의 기반이 되었다.

### 5.4 Influence Diagrams와 Decision Graph

Influence diagram은 decision, uncertainty, consequence, value를 구분해 관계를
보는 데 유용했다. v0.2의 Decision Graph는 여기에 evidence, stakeholder, signal,
commitment, observation을 확장했다.

그러나 영향도 표현의 유용성이 모든 자연어 relation의 canonical persistence를
정당화하지는 않는다. v0.3은 graph를 reasoning scratchpad로 사용한다.

### 5.5 Bounded Rationality와 Ecological Rationality

현실의 결정자는 시간, 정보, 주의, 계산 능력이 제한되어 있다. 단순 heuristic은
환경 구조에 맞을 때 복잡한 분석보다 나을 수 있다.

이 근거는 Argus에 두 가지 제약을 줬다.

1. 모든 결정을 full analysis로 밀지 않는다.
2. 의사결정 비용도 decision quality의 일부로 본다.

### 5.6 Naturalistic Decision-Making

숙련자는 시간 압박과 익숙한 환경에서 모든 대안을 비교하지 않고 pattern을 인식해
첫 plausible action을 찾고 mental simulation할 수 있다.

따라서 Argus는 숙련자의 직관을 무조건 해체하지 않는다. 환경이 익숙하고 feedback이
좋으면 빠른 simulation과 anomaly check를 한다. 반대로 낯선 환경과 약한 feedback에서는
outside view와 대안 설명을 강화한다.

### 5.7 Robust Decision Making

deep uncertainty에서는 하나의 가장 가능성 높은 미래에 최적화하는 것이 위험할 수
있다. 여러 plausible future에서 살아남는 robust action, signpost, contingent policy가
더 적절하다.

이 연구가 `DECIDE` 외에 `TEST`, `RESEARCH`, `DEFER`, contingent recommendation을
정상적인 다음 상태로 인정하게 했다.

### 5.8 Human-AI appropriate reliance

AI 설명이 많다고 적절한 신뢰가 생기지는 않는다. 설명은 잘못된 AI 조언을 더
설득력 있게 만들 수 있고, cognitive forcing은 과신을 줄이는 대신 부담을 높일 수
있다.

따라서 Argus는 매번 반대 의견을 강제하지 않는다. 중요한 recommendation에서
근거, uncertainty, change condition, AI authority를 노출하고 실제 사용자 이해를
측정한다.

### 5.9 Decision aids와 coaching evidence의 한계

구조화된 decision aid는 지식, 위험 인식, 가치 명료성, 참여를 개선한다는 비교적
강한 근거가 있다. 그러나 regret, adherence, downstream outcome의 개선은 같지 않거나
아직 불명확하다. decision coaching 자체의 근거는 더 제한적이다.

따라서 다음 문장은 연구 사실이 아니다.

> “LLM이 여러 턴 코칭하고 기록과 귀환을 연결하면 실제 decision quality가
> 개선된다.”

이것은 Argus가 직접 검증해야 할 제품 가설이다.

### 5.10 Hindsight, implementation, learning

- hindsight 연구는 outcome을 안 뒤 과거 prediction과 confidence를 다르게 기억할
  수 있음을 보여준다.
- implementation intention은 구체적인 상황–행동 연결이 vague intention보다 행동에
  유리할 수 있음을 시사한다.
- double-loop learning은 행동뿐 아니라 그 행동을 만든 목표·규칙·가정을 다시 보게
  한다.

이들이 각각 baseline, next action, return contract, lesson candidate를 지지한다.
그러나 ledger가 편향을 제거하거나, return 한 번이 일반적 학습을 증명하지는 않는다.

---

## 6. 현재 방법을 가장 쉽게 이해하는 법

### 6.1 UNDERSTAND

사용자의 말을 길게 반복하지 않는다.

```text
현재 결정 또는 긴장 한 문장
+ 이미 보이는 중요한 조건이나 모순 하나
+ 즉시 유용한 contribution 또는 정말 필요한 질문 하나
```

좋은 첫 응답은 사용자가 답하기 전에도 한 칸 전진시킨다.

### 6.2 IMPROVE

한 턴에 하나의 primary move를 고른다.

```text
reframe | value clarification | alternative | research | evidence split
competing hypothesis | outside view | premortem | experiment
trade-off | recommendation | next action
```

질문은 사용자만 알고, 답에 따라 다음 수가 달라지고, 질문 비용이 가정보다 낮을 때만
우선한다.

### 6.3 MOVE

대화를 다음 상태 중 하나로 닫는다.

```text
DECIDE | TEST | RESEARCH | DEFER | REFRAME | STOP
```

Argus는 후보를 만들 수 있지만 사용자가 명시적으로 채택해야 한다.

### 6.4 RETURN

결정 당시 한 개의 meaningful trigger를 정한다. 날짜가 아니라 사건이나 signal일 수
있다. 귀환하면 당시 질문·선택·이유·불확실성을 복원하고 새 observation을 append한다.

```text
Observation
→ 당시 uncertainty resolution
→ 당시 정보 아래 process
→ luck / environment change
→ next action or scoped lesson candidate
```

### 6.5 Strategy는 어떻게 들어오나

Strategy는 별도 제품 route가 아니다. 현재 문제가 전략 coherence라면 다음 렌즈를
잠시 사용한다.

```text
Diagnosis
→ Governing Choice
→ Coherent Actions
→ Strategic Thesis + Signposts
```

좋은 전략은 목표 목록이 아니라 무엇을 하고 하지 않을지, 왜 그것이 작동할지,
무엇이 틀렸음을 알려줄지를 가진 선택 체계다.

---

## 7. AI와 architecture에 대한 현재 정신 모델

### 7.1 진실 지위의 네 층

```text
Source & Observation Ledger
≠ Disposable Working Decision Model
≠ User-adopted Decision Record
≠ Revocable Learning Projection
```

1. **Source & Observation Ledger**
   - 사용자의 실제 발화, 연결한 문서, 외부 출처, 나중 observation
   - “사용자가 말했다”는 근거이지 외부 사실이라는 뜻은 아님

2. **Working Decision Model**
   - LLM이 현재 도움을 만들기 위해 구성한 graph와 해석
   - 틀릴 수 있고 session 단위로 폐기 가능

3. **User Decision Record**
   - 사용자가 채택한 작은 Decision Card
   - decision, rationale, material assumption, next action, return contract

4. **Return & Learning Projection**
   - 과거와 현실 비교, lesson candidate
   - 파생되고 철회 가능하며 자동 self-knowledge가 아님

이 네 층은 database 네 개를 뜻하지 않는다. 의미, 권한, 수명의 경계다.

### 7.2 LLM과 결정론 코드의 분업

LLM:

- 자연어 이해
- frame, alternative, hypothesis, scenario 생성
- bottleneck과 uncertainty 후보
- recommendation과 설명 초안

결정론 코드:

- provenance와 authority
- user adoption
- canonical append와 non-overwrite
- source/time validation
- state transition과 return trigger
- cross-surface identity

LLM은 canonical record 후보를 만들 수 있지만 직접 canonical truth를 쓸 수 없다.

### 7.3 Decision Graph의 정확한 지위

Decision Graph는 다음에 유용하다.

- 대안이 같은 이름의 변형인지 확인
- belief가 어떤 consequence와 value에 연결되는지 보기
- 전략 thesis와 signpost 연결
- 여러 턴에서 문맥 일관성 유지

하지만 다음에는 사용할 수 없다.

- 사용자에게 필수 편집 UI로 강제
- LLM edge를 현실 관계로 장기 저장
- graph completeness를 decision quality로 대체
- 많은 node 수를 제품 가치로 측정

### 7.4 surface 전략

web, MCP, plugin은 같은 constitution, state, event, adoption 의미를 가져야 한다.
그러나 세 production surface를 동시에 만드는 것은 core 검증을 지연시킨다.

```text
R2: 세 surface semantic parity fixture
R5: primary surface에서 full loop
R5: 두 번째 surface에서 continuity 증명
Later: 가치가 확인된 뒤 세 번째 surface 확장
```

---

## 8. 제품 경계와 차별성 가설

### 8.1 왜 제품·시장 결정인가

v1 대상은 다음 조건을 만족해야 한다.

- 창업자나 제품 책임자 한 명이 owner
- 자원·일정·고객 약속·기회비용이 걸림
- 지금 취할 next action이 있음
- 1~12주 안에 meaningful signal 가능
- 비슷한 판단이 반복됨
- regulated expert 책임이 필요하지 않음

이 범위는 모든 decision theory를 증명하기 위한 것이 아니라 first-session과 return을
같은 vertical에서 빠르게 검증하기 위한 wedge다.

### 8.2 v1에서 일부러 제외한 것

- 범용 인생 고민
- 관계·정서 지원 중심 대화
- 의료·법률·재무 고위험 판단
- owner가 없는 복잡한 집단 합의
- 장기간 signal을 관찰할 수 없는 추상적 목표
- 자동 사용자 성격·편향·승률 profile

### 8.3 무엇이 moat가 아닌가

- Decision Quality framework 자체
- Decision Graph 자체
- 좋은 prompt와 한 번의 좋은 답변
- 많은 AI persona와 합의
- 긴 report와 dashboard

일반 AI도 이들을 상당 부분 모방할 수 있다.

### 8.4 무엇이 moat가 될 수 있는가

```text
active help now
+ truthful minimal record
+ user adoption
+ event-driven return
+ cross-surface continuity
+ user-approved scoped learning
```

여기서 중요한 말은 “될 수 있다”다. 실제 사용자가 이 loop를 원하고 반복하지 않으면
moat가 아니다.

---

## 9. 아직 증명되지 않은 것과 실증 gate

### 9.1 여섯 제품 가설

1. **First-session lift:** 사용자가 일반 AI보다 구체적인 판단 delta를 얻는다.
2. **Honest agency:** 원래 생각, AI proposal, user adoption을 구분한다.
3. **Low-burden movement:** 양식 없이 유용한 next state와 행동으로 간다.
4. **Continuity:** 시간이 지나거나 surface가 바뀌어도 정확히 이어간다.
5. **Return value:** 당시 record가 기억만으로 하는 회고보다 유용하다.
6. **Scoped learning:** 일부 귀환이 다음 유사 결정에 실제로 쓰이는 작은 규칙을 만든다.

### 9.2 R1과 R2

먼저 codebase를 바꾸지 않고 다음을 만든다.

- one-page facilitator card
- 최소 30개 실제형 case와 failure expectation
- intervention/recommendation evaluator handbook
- canonical prompt compiler
- typed turn envelope
- disposable working model과 adoption-gated reducer
- provenance/source/time validator
- paraphrase, multi-seed, adversarial, long-context test
- surface parity fixture

### 9.3 R3-A comparative evaluation

30개 case에서 동일한 context, tool, 시간·턴 budget 아래 비교한다.

- 일반 목적 AI의 최선 구성
- 정적 Decision Quality worksheet
- Argus method/harness

Argus는 최소 20/30 case에서 전체적으로 선호되고 accuracy, agency, burden이 baseline보다
악화되지 않아야 한다. 한 명의 LLM judge가 아니라 대상 사용자, 복수 평가자,
기계 integrity invariant를 분리한다.

### 9.4 R3-B real pilot

대상 사용자 15명의 실제 제품·시장 결정을 다루고 최소 5개의 실제 return을 추적한다.

GO의 최소 기준:

- 10/15가 구체적 delta를 자신의 말로 설명
- 10/15가 next state와 실제 행동을 채택
- 10/15가 구체적인 재사용 상황을 지목
- 4/5 return에서 당시 record가 회고 복원에 유용
- 최소 3개 return에서 user-approved lesson 또는 정직한 `no lesson`
- zero-tolerance authorship/reality failure 없음
- bureaucracy가 주된 이탈 이유가 아님

이 표본은 보편 이론의 증명이 아니다. 좁은 R5 vertical을 구현할 비용을 써도 되는지
판정하는 gate다.

### 9.5 실패했을 때의 선택

| 결과 | 대응 |
|---|---|
| first-session만 가치 있음 | continuity/return 주장을 축소하고 active coach로 재검토 |
| record는 가치 있으나 coaching 차이 없음 | ledger/continuity product로 축소 |
| 특정 case에서만 가치 있음 | 더 좁은 vertical product |
| return을 원하지 않음 | 장기 learning thesis 철회 |
| 일반 AI와 차이 없음 | broad implementation 중단 |
| 정적 worksheet와 비슷함 | LLM architecture 비용을 정당화하지 않음 |
| persuasion harm가 큼 | recommendation scope 축소 또는 중단 |

---

## 10. 의도적으로 폐기하거나 보류한 것

### 10.1 폐기

- premise를 모든 결정의 중심 객체로 삼기
- 질문만 하는 코치를 Argus 전체 가치로 삼기
- 7개 archetype을 user journey 또는 persistent route로 사용
- EDQI를 실제 점수처럼 사용
- full Decision Graph를 canonical long-term memory로 저장
- AI 합의를 독립 reality evidence로 표시
- 사용자 judgment score, bias score, personality profile
- 세 production surface 동시 구축

### 10.2 R3 전 보류

- 공개 user flow 변경
- Decision Card canonical schema
- DB migration
- runtime zero-judgment contract 교체
- real notification scheduler 변경
- legacy writer 제거
- broad pattern/learning UI
- 팀 의사결정과 stakeholder governance

### 10.3 다시 열 수 있는 조건

폐기 또는 보류는 영구 금지가 아니다. 다음처럼 evidence가 있을 때만 다시 연다.

- graph persistence가 실제 continuity를 높이고 오류·privacy cost보다 가치가 큼
- stable router가 general policy보다 case quality를 반복적으로 높임
- 특정 domain에서 calibrated quantitative scoring이 action을 개선함
- 세 번째 surface가 독립적인 사용자 수요와 loop completion을 만듦
- 반복된 독립 return이 범위 넓은 learning을 정당화함

framework가 이론적으로 멋지다는 이유만으로 다시 열지 않는다.

---

## 11. 다음 검토자가 반드시 공격해야 할 긴장

### 11.1 적극적 추천과 심리적 영향력

provenance를 정확히 표시해도 사용자는 유창한 AI recommendation을 과신할 수 있다.
`AI proposed` metadata는 법적·의미적 경계를 지킬 뿐 심리적 독립을 보장하지 않는다.

검토 질문:

- 어떤 stakes에서 direct recommendation을 금지해야 하는가?
- baseline capture가 anchoring을 실제로 줄이는가?
- change condition이 사용자의 반대 사고를 돕는가, 면책 문구로만 보이는가?

### 11.2 first-session 가치와 return 가치의 분리

첫 세션이 강해도 사용자가 record를 남기거나 나중에 돌아올 이유가 없을 수 있다.
반대로 기록은 유용하지만 적극적 coaching 차이가 없을 수 있다.

두 가치를 반드시 따로 측정해야 한다.

### 11.3 최소 기록과 정확한 continuity

Decision Card를 너무 작게 만들면 다음 세션에서 중요한 nuance가 사라진다. 너무 크게
만들면 AI inference가 장기 기억이 된다.

검토 질문:

- 무엇이 반드시 durable해야 하는가?
- raw conversation retention 없이 provenance를 재구성할 수 있는가?
- source event의 보존 기간과 deletion은 어떻게 동작해야 하는가?

### 11.4 v1 범위의 강도

제품·시장 결정도 여전히 넓다. launch, prioritization, pricing, positioning은 evidence와
return horizon이 다르다.

R1 case 결과에 따라 최초 vertical을 “reversible product launch/experiment” 하나로
더 좁힐 준비가 필요하다.

### 11.5 model variation과 harness의 실제 힘

typed envelope가 있어도 bottleneck selection과 recommendation은 LLM에 남는다.

검토 질문:

- paraphrase와 seed에 따라 primary move가 얼마나 바뀌는가?
- 어느 변화는 허용 가능한 다양성이고 어느 변화는 random experience인가?
- validator가 의미 오류를 막는 척하면서 schema 오류만 막고 있지 않은가?

### 11.6 Return의 선택 편향

귀환하는 사용자는 성공·실패·관심이 큰 사례에 치우칠 수 있다. 보고한 outcome도
부분적이며 인과가 불명확하다.

Argus는 return data로 “당신은 X에 강하다” 같은 profile을 만들면 안 된다. 먼저
과거 복원과 case-specific next action이 실제 가치인지 확인해야 한다.

### 11.7 product moat의 취약성

general AI가 memory, task, reminder, connector를 빠르게 통합하면 Argus의 기능 조합은
쉽게 복제될 수 있다.

Argus의 방어력은 기능 목록이 아니라 다음에서만 생길 수 있다.

- 훨씬 정직한 authority semantics
- 훨씬 정확한 과거 state reconstruction
- 더 좋은 intervention policy
- 실제로 응답하는 return timing
- 사용자가 다시 쓰는 learning

이 중 어느 것도 현재 증명되지 않았다.

---

## 12. 처음 읽는 AI를 위한 검토 프로토콜

### 12.1 읽기 순서

1. 이 문서 §0–§4로 문제와 결정 역사를 이해한다.
2. `ARGUS-METHOD-V0.3-2026-08-03.md` 전체를 현재 proposal로 읽는다.
3. v0.1과 v0.2는 더 나은 대안이 버려졌는지 확인할 때 읽는다.
4. `ARGUS-BLUEPRINT.md` §9.12에서 권한과 R stage를 확인한다.
5. 기존 runtime을 검토할 때만 F/H/K/E/JCR 및 관련 ADR을 읽는다.

### 12.2 사실, 설계 결정, 가설을 구분하라

**사실 또는 repository evidence 예:**

- 기존 runtime은 provenance와 append-only semantics를 강화했다.
- v0.3은 아직 public implementation이 아니다.
- recent commits가 delta, return, authorship, parity를 실제 수정했다.

**설계 결정 예:**

- Decision Quality 6요건을 method core로 사용한다.
- graph는 disposable working model이다.
- v1은 제품·시장 결정으로 좁힌다.

**검증되지 않은 가설 예:**

- active coaching + record + return이 general AI보다 낫다.
- 사용자가 Decision Card와 return을 원한다.
- scoped learning이 다음 결정에서 재사용된다.

가설을 문서에 쓰였다는 이유로 사실처럼 다루지 않는다.

### 12.3 검토할 때 하지 말 것

- 기존 코드가 있으므로 v0.3을 코드에 맞춰 축소하지 않는다.
- `FINAL`이라는 제목 때문에 v0.3을 방어하지 않는다.
- framework를 더 추가하는 것으로 깊이를 가장하지 않는다.
- graph, persona, agent 수를 sophistication로 평가하지 않는다.
- 첫 응답 예시 하나만 보고 장기 제품 가치를 인정하지 않는다.
- LLM judge 총점만으로 GO를 내리지 않는다.
- 좋은 outcome을 좋은 decision process의 증거로 쓰지 않는다.

### 12.4 기대하는 검토 결과 형식

```text
1. Steelman
   이 방법이 실제로 가치 있을 가장 강한 이유

2. Fatal risks
   맞으면 방향을 중단하거나 크게 바꿔야 하는 문제

3. Method critique
   Decision Quality, intervention, recommendation, stop policy의 공백

4. Product critique
   target user, first-session value, return behavior, differentiation

5. Harness critique
   LLM variation, authority, storage, cross-surface, failure recovery

6. Evidence critique
   pilot design, comparator fairness, metrics, self-deception risk

7. Cuts and replacements
   무엇을 삭제·축소·교체해야 하는지

8. Verdict
   GO TO EVIDENCE | REVISE METHOD | NO-GO
```

### 12.5 가장 중요한 질문 12개

1. Argus가 일반 AI보다 별도 제품일 이유는 실제로 무엇인가?
2. Decision Quality 6요건은 LLM intervention policy로 충분히 번역됐는가?
3. 첫 응답의 contribute-first가 정확성보다 성급함을 만들지 않는가?
4. 한 턴 한 primary move가 복잡한 결정에 지나치게 인공적인가?
5. 추천 readiness와 금지 범위는 충분히 operational한가?
6. Decision Card가 continuity에는 너무 작고 privacy에는 너무 크지 않은가?
7. disposable graph를 매번 재구성할 때 reasoning drift는 어떻게 막는가?
8. optional lens 선택이 사실상 숨은 unstable router가 되지 않는가?
9. 사용자가 return contract를 실제로 받아들일 이유가 충분한가?
10. 15명/5 returns gate가 false positive를 얼마나 허용하는가?
11. 특정 launch/experiment vertical로 더 좁혀야 하는가?
12. 이 제품을 만들지 말아야 할 가장 강한 이유는 무엇인가?

---

## 13. 현재 repository와 실행 경계

### 13.1 현재 공개 runtime

현재 shipped product에는 기존 `zero judgment` runtime 규칙이 계속 적용된다. v0.3의
honest agency는 R0–R3 연구에서 허용된 candidate replacement다.

따라서 현재 금지되는 것:

- v0.3 문구를 곧바로 web/MCP/plugin system prompt에 복사
- recommendation을 live surface에 추가
- 새 Decision Card schema migration
- legacy canonical writer 교체
- graph persistence 추가

### 13.2 R stage

```text
R0 · 방향과 주장                       v0.3으로 완료 후보
R1 · method manual + cases             다음 단계
R2 · offline harness                   R1과 반복 가능
R3 · comparative evidence + real pilot 구현 전 gate
R4 · architecture convergence          GO 뒤에만
R5 · narrow vertical slice             R4 뒤에만
```

### 13.3 기존 구현을 평가하는 시점

R3 GO 뒤에 기존 자산을 다음으로 분류한다.

- **retain:** provenance, authority, append-only, source/time, return plumbing처럼
  새 method에도 그대로 필요한 것
- **reforge:** premise, progressive session, current judgment UI처럼 의미를 바꿔
  재사용할 수 있는 것
- **retire:** 사용자 가치 없이 complexity만 늘리거나 새 method를 왜곡하는 것

지금 미리 전면 migration plan을 쓰지 않는다.

---

## 14. 시간순 결정 기록

| 시점 | 관찰 또는 질문 | 그때의 결론 | 다음 전환 |
|---|---|---|---|
| 2026-07 초 | MCP spine과 no-verdict 구조 점검 | 정직한 core는 강하고 표면 배관이 문제 | cross-surface와 return 강화 |
| 2026-07 중 | DecisionCase, JudgmentVersion, Assertion graph 제안 | 시간·저자·관계 기반 knowledge core 확장 | premise/pattern coaching 강화 |
| 2026-07 말 | MCP/plugin/web drift와 authorship 오류 | deterministic core와 one-dataset 필요 | 실제 배선·parity·honesty 수정 |
| 2026-08-02 | first-three-minute value contract | baseline→한 질문→delta→return을 wedge로 설정 | 수십 개 관련 구현·계측 커밋 |
| 2026-08-03 | hero-demo-v2의 다음 처리 | 표현층은 보존하되 core가 정해질 때까지 재작업 보류 | method-first 전환 |
| 2026-08-03 | 전체 구현을 최초 기획과 대조 | integrity는 강하지만 method core와 직접 가치가 약함 | 원점 재기획 요청 |
| 같은 날 | Minto와 decision/strategy method 비교 | premise 하나로는 불충분; 체계적 method 필요 | v0.1 작성 |
| 같은 날 | active coaching과 추천 권한 재검토 | zero judgment를 honest agency로 교정 | v0.1 방향 봉인 |
| 같은 날 | strategy, graph, uncertainty, LLM instruction 심화 | full Decision Graph와 module/harness 설계 | v0.2 작성 |
| 같은 날 | complexity, false precision, user burden 재검토 | 구조가 method를 삼킬 위험 확인 | v0.3 대규모 단순화 |
| 2026-08-04 | 다른 AI에게 더 깊은 검토를 넘길 context 필요 | 결정의 이유와 미해결 가설을 별도 기록 | 이 문서 작성 |

---

## 15. 용어 사전

| 용어 | 이 문서에서의 뜻 |
|---|---|
| **Decision Quality** | frame, alternatives, information, values/trade-offs, reasoning, commitment의 과정 품질 |
| **honest agency** | AI가 적극적으로 돕되 AI proposal, user adoption, external reality를 섞지 않는 원칙 |
| **primary move** | 한 턴에서 판단을 실제로 전진시키는 주 개입 하나 |
| **material bottleneck** | 답이나 구조가 바뀌면 실제 선택·행동이 달라질 지점 |
| **commitment point** | 자원, 권한, 일정, 되돌림 비용이 실제로 발생하는 다음 지점 |
| **Decision Card** | 사용자가 채택한 결정·이유·가정·다음 행동·return의 최소 기록 |
| **Working Decision Model** | 현재 도움을 만들기 위한 폐기 가능한 AI 해석/graph |
| **Source event** | 사용자 원문, 외부 자료, 나중 observation처럼 provenance의 근거가 되는 사건 |
| **Return contract** | 언제 어떤 현실 signal에서 과거 결정을 다시 볼지 정한 약속 |
| **LessonCandidate** | 아직 일반화되지 않은, 사용자 승인 전의 범위 제한 학습 후보 |
| **reasoning lens** | diagnosis, outside view, strategy, stakeholder, premortem처럼 필요할 때만 쓰는 사고 도구 |
| **surface parity** | web, MCP, plugin이 표현은 달라도 같은 의미·권한·상태를 유지하는 성질 |

---

## 16. 이 문서가 남기려는 마지막 context

이 재설계의 핵심은 기존 Argus가 무가치했다는 선언이 아니다. 오히려 기존 Argus는
대부분의 AI 제품이 나중에야 발견하는 provenance, authority, time, return의 문제를
먼저 깊게 다뤘다.

문제는 그 강한 기반이 제품 가치 전체인 것처럼 간주된 순간 생겼다. 정직하게
기록한다고 사용자가 더 잘 결정하는 것은 아니다. 좋은 질문 하나가 모든 판단을
돕는 것도 아니다. 복잡한 graph가 좋은 방법론을 보장하지도 않는다.

현재의 방향은 다음 균형을 시도한다.

```text
수동적이지 않을 만큼 적극적이다.
권한을 빼앗지 않을 만큼 정직하다.
실행을 막지 않을 만큼 단순하다.
현실과 끊기지 않을 만큼 오래 기억한다.
사람을 규정하지 않을 만큼 제한적으로 배운다.
```

이 균형은 문서로 증명할 수 없다. 다음 검토자의 역할은 더 아름다운 framework를
붙이는 것이 아니라, 이 균형이 실제 사용자와 실제 결정에서 성립할 수 있는지 가장
강하게 공격하는 것이다.

Argus가 살아남아야 하는 이유와 만들지 말아야 하는 이유를 같은 강도로 검토한 뒤,
그 결과만 R1–R3에 반영한다.
