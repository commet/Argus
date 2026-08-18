# ARGUS METHOD v0.7 — AMENDMENT: 적대적 경제학과 측정의 정직성

Date: 2026-08-04
Status: **v0.5+v0.6에 대한 규범적 개정 문서. v1.0에 통합되어 소멸 예정**
Base: `ARGUS-METHOD-V0.5-2026-08-03.md` + `ARGUS-METHOD-V0.6-2026-08-04.md`
비판 각도: **회의적인 투자자와 red team의 눈 — 이 방법의 비용은 누가 내고,
측정기는 누가 속이고, validator는 정말 무엇을 막으며, 이 제품을 만들지 말아야
할 가장 강한 이유는 무엇인가**

---

## 0. 이 개정의 판정

v0.5+v0.6은 정직성의 기계를 쌓았지만 세 가지를 계산하지 않았다: 그 기계의
**가격**(사용자가 내는 지연·마찰), 그 측정기의 **조작 가능성**(Goodhart), 그리고
방법이 아무리 옳아도 제품이 죽는 **경제적 사인**. context §11.5("validator가
의미 오류를 막는 척하면서 schema 오류만 막고 있지 않은가")와 Q10(gate의 false
positive), Q12(만들지 말아야 할 가장 강한 이유)가 이 각도다. 다섯 개정으로
답한다.

---

## 1. 개정 7 — Harness tax: 정직성의 가격표와 성능 예산

모든 v0.4~v0.6 기계(baseline 추출, branching 검사, falsifier, ledger 대조,
bounded critic)는 턴당 지연과 비용을 만든다. 정직한 턴이 일반 챗 턴보다 3배
느리면 사용자는 무결성을 경험하기 전에 떠난다. **지연은 UX 세부가 아니라
방법의 생존 조건이다.**

**규범:**

- **턴 성능 예산을 R2에서 봉인한다**: 표준 턴의 p50/p95 지연 상한과 턴당
  model 호출 수 상한(기본: 표준 턴 1회, bounded critic 발동 시 3회 이내).
- 검증 기계는 **응답 경로에서 비차단이 원칙**이다: 결정론 검사(enum, 개수,
  ref 실존, 권한 전이)는 밀리초 단위이므로 인라인, 비싼 검사가 예산을 넘으면
  **degrade ladder**를 탄다 — canonical write를 포기하고 plain helpful
  response를 즉시 준다 (v0.5 §10.5의 실패 행동을 성능 사유로 확장). 사용자를
  의식(ceremony) 때문에 기다리게 하지 않는다.
- R3-A의 "사용자 부담" 평가 차원에 **응답 지연을 명시적으로 포함**한다 —
  baseline 대비 지연 열세는 부담 악화로 계산된다.
- 비용: 턴당 토큰 예산을 계측하고 R3-B 리포트에 단위 경제(결정 1건 완주당
  비용)를 포함한다. 가격 없는 moat 주장은 금지다.

## 2. 개정 8 — Goodhart 방어: 측정기의 조작 가능성을 측정기에 내장한다

영향력 3측정기(§9.5)는 시스템 자신이 속일 수 있다.

| 측정기 | 조작 경로 | 방어 규범 |
|---|---|---|
| verbatim adoption rate | 사소한 수정을 유도하는 초안 형식("한 글자만 고치세요") → 지표는 좋아지고 실질은 그대로 | **material edit만 센다**: 정규화 후 의미 단위 diff 비율이 봉인된 임계 미만인 edit은 verbatim으로 분류한다. edit 존재가 아니라 edit 실질을 측정한다. |
| blind recall probe | 유도성 문구("당신의 원래 생각은 X였죠?")가 회상을 오염 | probe 문구는 **measurement contract에 고정 문안으로 봉인**하고 변형을 금지한다. probe는 개방형 한 문장이다. |
| baseline 추출 | 과소 추출(빈 baseline)이 "영향 측정 불가"를 만들어 책임 회피 | **baseline coverage**(발화에 lean/이유가 있었는데 추출 실패한 비율)를 R2 fixture로 회귀 검사한다. 미기록은 허용되지만 추출 실패는 결함이다. |

**메타 규범:** 세 측정기의 정의·임계·문안은 R3 시작 전 measurement contract에
봉인되고, 이후 변경은 관찰 후 유리한 조정이 아니라 명시적 amendment로만
가능하다. 측정기를 최적화 대상으로 삼는 순간 측정기가 아니다.

## 3. 개정 9 — Validator의 정직한 명세: 기계가 막는 것의 전수 목록 (§11.5)

"deterministic validator"라는 말은 과대 포장될 수 있다. v0.7은 경계를 전수
명세한다.

**기계적으로 막는 것 (결정론, R2에서 테스트로 고정):**

1. move type이 enum 밖 — 거부
2. reframe에 falsifier 부재 — 질문으로 강등
3. 결정 형성 질문에 branches < 2 — 질문 기각
4. 턴당 질문 > 1 — 거부
5. directional 추천의 valueClaimRefs: **참조 event의 실존, source='user',
   authority∈{said,adopted}, 인용문의 원문 포함 여부** — 실패 시 강등
6. 저자성 전이 위반(ai_proposed→user_said 류) — 거부
7. adoption event 없는 canonical write — 거부
8. 과거 record의 overwrite — 거부 (append/supersedes만 허용)
9. observed_later가 believed_then에 병합 — 거부
10. pushed × major × one_way의 directional 추천 — 강등 (v0.6 개정 6)
11. safety_route에서의 추천 — 거부
12. return trigger가 event/signal인데 date_backstop 부재 — 거부

**기계가 막지 못하는 것 (정직하게 명시, 다른 방어로 이관):**

- 참조된 가치가 추천을 실제로 **정당화하는가** (entailment) → change
  condition 의무 + bounded critic + R1 평가자
- frame 제안의 **정확성** → falsifier의 품질은 사람이 평가
- 보조 내용이 새 인지 요구를 만드는지 (v0.6 개정 4) → 평가자 handbook
- 병목 선택의 적절성 → gold case 대조 + paraphrase 안정성 테스트
- 문체에 실린 과잉 확신 → blind 비교와 recall probe가 사후 탐지

**전수성 규범:** zero-tolerance 목록(§15.4)의 각 항목은 위 기계 목록의 최소
한 개 검사에 대응되어야 하며, 대응이 없는 항목은 **R3에서 표본 사람 감사**
대상으로 명시한다. "validator가 있다"는 문장은 이 대응표가 있을 때만 참이다.

## 4. 개정 10 — Model 세대 교체와 회귀 그물

방법은 특정 model 위에 산다. model 교체는 침묵의 방법 교체가 될 수 있다.

**규범:**

- R2의 gold case fixture는 **회귀 그물**이다: model/prompt 변경 시 fixture
  전체를 재실행하고, 병목 선택·개입 선택·readiness 판정의 변화율을 보고한다.
- canonical state(ledger, Card)는 model 교체와 무관하게 불변이다.
- model 교체 후 첫 주는 verbatim rate·recall 오염 지표를 상시 관찰한다 —
  새 model의 문체가 영향력 지형을 바꿀 수 있다.

## 5. 개정 11 — 만들지 말아야 할 가장 강한 이유 (Q12): 빈도 문제

정직하게 명시한다. **이 제품의 가장 강한 반대 논거는 무결성도 경쟁도 아니라
빈도다.** 대상 사용자의 범위 내 결정(제품·시장, 1~12주 signal)은 한 달에
2~4건일 수 있다. 폐루프의 가치는 루프가 돌 때만 생기는데, 루프가 월 2회 돌면
제품은 사용자의 습관에 들어가지 못하고, 돌아올 때마다 재학습 비용을 낸다.
방법이 완벽해도 이 빈도면 제품은 죽는다.

**규범 (방어와 측정):**

- **portfolio가 빈도의 답이다**: 결정 1건의 빈도는 낮아도 열린 case 3~5건의
  포트폴리오는 주 단위 접촉을 만든다 (commitment return, signal 도래, 새 관찰
  연결). v0.6의 전역 예산은 이 접촉이 spam이 되지 않게 하는 짝이다.
- **MCP가 빈도의 두 번째 답이다**: 결정은 Argus 안에서 생기지 않고 작업
  도구 안에서 생긴다. MCP surface는 기능 추가가 아니라 **빈도 문제의 구조적
  해법**으로 자리매김한다 (fire-gate 준수 하에).
- R3-B에 **빈도 현실 검사**를 추가한다: pilot 사용자별 범위 내 결정의 실제
  발생 빈도를 기록하고, GO 판정문에 "이 빈도에서 제품이 성립하는가"를 별도
  항목으로 답한다. 빈도가 월 1건 이하로 관찰되면 HOLD 축소 지도의 후보는
  vertical 협소화가 아니라 **포트폴리오·ambient 접촉의 강화**다.

## 6. 개정 12 — 기밀성: ledger는 honeypot이다

창업자의 제품·시장 결정 기록은 경쟁 정보의 농축물이다. 한 문단의 규범:

- 사용자 데이터로 model을 훈련하지 않는다 (방법 개선용 집계 telemetry는 v0.8
  범위에서 별도 동의·익명화로만).
- ledger·Card는 저장 시 암호화, 사용자 단위 export, 삭제는 기존
  erasure-coverage 기계에 등록 (v0.5 §6.2 유지).
- pilot harness(R3-B)의 데이터는 pilot 종료 시 반출 후 삭제가 기본값이다.

---

## 7. v1.0 반영 목록

7. 턴 성능 예산 + degrade ladder + 지연의 부담 계상 → §10, §15
8. Goodhart 방어(material edit, 고정 probe 문안, baseline coverage) → §9.5, §15
9. validator 기계/비기계 전수 명세 + zero-tolerance 대응표 → §10, §15
10. model 회귀 그물 → §10, §15.3
11. 빈도 문제의 명시 + portfolio/MCP 재자리매김 + 빈도 현실 검사 → §1, §11, §15.5, 위험표
12. 기밀성 문단 → §6.2 강화
