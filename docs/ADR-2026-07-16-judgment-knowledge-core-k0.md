# ADR — Judgment Knowledge Core K0 결정 경계

Date: 2026-07-16
Status: **Proposed — 창업자 결정 5건 대기, K1 shadow schema의 임시 계약**
Decision owner: Judgment Knowledge Core implementation stream
Founder decision owner: Argus founder
Normative source: `DESIGN-judgment-knowledge-core-and-coaching-v1-2026-07-16.md`

---

## 결정 요약

K-트랙은 기존 DKK v3를 확장하거나 재해석하지 않는다. 새 의미 모델은
`argus-mcp/src/v4/`의 `SEMANTIC_VERSION = 4`로 구현하고, 명시적 환경 플래그가
켜진 경우에만 기존 쓰기 성공 뒤 별도의 shadow sink로 복제한다. shadow 실패는
기존 v1/v2/v3 쓰기의 성공·응답·수명주기를 바꾸지 않는다.

K1의 임시 계약은 다음과 같다.

- canonical storage는 discriminated `Assertion` 한 종류이고 role별 projection을 제공한다.
- `DecisionCase`는 지속되는 질문, `JudgmentVersion`은 시점별 인간 승인 입장이다.
- `Prediction`은 assertion role이며 최초 기록을 수정하지 않는다.
- `EvidenceArtifact`는 자료, `Observation`은 자료에서 관찰한 보고, `Assertion`은 채택한 명제다.
- 의미 관계는 기본 `proposed`; 결정적 구조 관계만 `system_verified`가 가능하다.
- user-facing 이름, 코칭 카드, 5차원 Patterns UI는 O4 gate 전까지 열지 않는다.

이 ADR은 §16의 열 가지 질문을 닫되, 창업자 판단이 필요한 항목은 임시 기본값만
둔다. 창업자 승인 전에는 해당 경계를 public contract 또는 되돌리기 어려운 저장
정책으로 승격하지 않는다.

---

## 결정 상태 표

| # | 질문 | K0 제안 | 소유자 | K1 효력 |
|---:|---|---|---|---|
| 1 | `JudgmentVersion`을 제품·API에서도 쓸 것인가 | 코어 내부 이름으로만 사용. 제품은 기존 사용자 언어 유지 | **[창업자 결정 필요 F1]** | public surface 미노출 |
| 2 | Assertion 저장 구조 | 단일 canonical discriminated union + role별 projection | [구현 결정 I1] | 확정 |
| 3 | 한 번 승인으로 Premise 채택과 sync를 함께 설명하는 법 | 한 카드 안에서 항목과 sync 범위를 분리 표시하고 한 번 승인 | **[창업자 결정 필요 F2]** | A0 내부 consent receipt만, 카피 비정본 |
| 4 | `system_verified` 허용 범위 | ID·해시·정규화된 exact key 등 결정적 관계만 허용 | [구현 결정 I2] | 확정 |
| 5 | 매번 묻지 않고 semantic relation precision을 지키는 법 | 관계는 저장 가능하나 의미 변화에 사용할 때만 확인; 그 전에는 제안 | [구현 결정 I3] | UI 미노출, proposed만 허용 |
| 6 | 개인 Pattern 최소 사례 수 | 독립 resolved case 3건 기본, blast radius는 예외 | **[창업자 결정 필요 F3]** | Patterns 생성/노출 금지 |
| 7 | Evidence 원문 보존·저작권·개인정보 | 기본은 locator+hash+짧은 발췌/측정값, 원문 미복제 | **[창업자 결정 필요 F4]** | full content 필드 금지 |
| 8 | local-only 판단의 server watch 최소 sync 정보 | 선택된 premise text + WatchSpec + decision opaque ref만 | **[창업자 결정 필요 F5]** | 명시 scope 전송만 허용 |
| 9 | web DecisionContract read-only 전환 시점 | dual-write replay parity와 rollback rehearsal 통과 후 | [구현 결정 I4] | 기존 read/write 유지 |
| 10 | DKK v4인가 v3 extension인가 | 별도 DKK v4 | [구현 결정 I5, 사용자 경계로 승인됨] | 확정 |

---

## F1. 코어 명칭과 제품 명칭

### 제안

`DecisionCase`, `JudgmentVersion`, `Assertion`, `EvidenceArtifact`는 코어와 내부 API의
정확성을 위한 이름으로 둔다. 사용자 표면은 기존의 판단 기록, 예측, 전제, 근거,
돌아보기 언어를 유지한다.

### 이유

- `Version`은 구현에는 정확하지만 사용자가 자기 판단을 소프트웨어 버전처럼 느끼게 한다.
- public API에 이름을 조기에 고정하면 향후 projection 언어를 바꾸기 어렵다.
- K1은 shadow-only이므로 내부 의미의 정확성이 제품 용어 통일보다 먼저다.

### 창업자 결정

**[F1] 향후 export/developer API에는 내부 명칭을 그대로 공개할지 결정해야 한다.**
승인 전 기본값은 internal-only다.

---

## I1. Assertion 저장과 projection

### 결정

저장은 하나의 `Assertion` discriminated union으로 통합한다. role은 다음과 같다.

```text
prediction | premise | constraint | criterion |
change_signal | open_question | rationale
```

각 role은 공통 provenance/authority/time/scope를 공유하되 payload schema는 role별로
엄격히 구분한다. 조회 편의를 위한 `predictions`, `premises` 등은 projection이지 별도
canonical table이 아니다.

### 불변식

- 기존 assertion payload를 in-place 수정하지 않는다.
- 의미 수정은 새 assertion과 `supersedes` 관계다.
- role 전환도 수정이 아니라 새 assertion이다.
- projection은 같은 event stream에서 결정적으로 재생되어야 한다.

---

## F2. 한 번 승인과 sync 동의

### 제안

하나의 검토 카드에서 두 의미를 시각적으로 분리한다.

1. “내 판단이 기대는 전제로 저장”할 항목
2. “변화를 확인하기 위해 Argus 계정과 동기화”할 항목과 전송 범위

사용자는 한 번 누를 수 있지만 authorization receipt에는 채택 대상과 sync scope를
별도 필드로 기록한다. 항목 또는 scope가 바뀌면 이전 승인을 재사용하지 않는다.

### 창업자 결정

**[F2] 한 번의 버튼이 premise adoption과 원격 sync consent를 함께 승인해도 되는지,
아니면 첫 server watch 때 step-up consent를 분리할지 결정해야 한다.**

임시 기본값은 로컬 채택과 sync consent를 논리적으로 분리하고, UI가 한 번 승인으로
묶더라도 두 receipt를 생성하는 방식이다.

---

## I2. `system_verified` 경계

### 결정

다음처럼 결정론적으로 재현 가능한 관계만 `system_verified`가 될 수 있다.

- 동일 canonical entity ID
- 동일 content hash
- 동일하게 정규화된 URL, 측정 series ID, source record ID
- 명시적 구조 관계(`judgment_of`, `prediction_for`, `evidenced_by` 등)
- 사용자가 이미 승인한 relation의 단순 역방향 projection

LLM, embedding, 어휘 유사성, 추론된 인과로 만든 `same_fact`, `supports`,
`contradicts`, `depends_on`, `shared_constraint`는 K1에서 항상 `proposed`다.

---

## I3. 의미 관계 확인 정책

### 결정

관계를 발견할 때마다 묻지 않는다. 후보는 조용히 `proposed`로 저장할 수 있지만 다음
중 하나에 쓰기 직전에만 사용자 확인을 요구한다.

- 사용자 판단의 의미를 바꾸는 authorial command의 근거
- 반복 Pattern의 핵심 인과 연결
- 여러 열린 판단에 영향을 준다는 blast-radius 알림
- export에서 human-confirmed knowledge로 표시

K1은 관계 UI를 만들지 않으며, proposed 관계가 judgment lifecycle을 바꾸지 못하도록
schema와 reducer로 차단한다.

---

## F3. 개인 Pattern의 최소 사례

### 제안

개인 성향처럼 읽힐 수 있는 반복 코칭은 다음을 모두 요구한다.

- 서로 다른 `DecisionCase` 3건 이상
- 각 case가 resolved 또는 명시적 terminal 상태
- 같은 role/관계 타입이 아니라 같은 인과 구조
- 양쪽 evidence가 있는 검증 관계
- 현재 결정과의 relevance

한 외부 사실이 여러 열린 판단에 미치는 deterministic blast radius는 반복 Pattern이
아니므로 1건에서도 알릴 수 있다.

### 창업자 결정

**[F3] “3건”을 제품 헌법의 고정 최소치로 둘지, risk/evidence 등급에 따라 3~5건으로
올릴 수 있는 정책값으로 둘지 결정해야 한다.**

K1에서는 Pattern 산출 자체를 구현하지 않는다.

---

## F4. Evidence 보존

### 제안

기본 `EvidenceArtifact`는 다음만 보존한다.

- locator 또는 external record ID
- content hash
- publisher, published/retrieved time
- 사용자가 인용한 짧은 excerpt 또는 구조화된 measurement
- provenance와 access classification

웹 문서 전문, private message 전문, 업로드 파일 본문은 기본 복제하지 않는다. 원문이
필요한 별도 vault는 retention, export, erasure, copyright 정책이 승인된 뒤 설계한다.

### 창업자 결정

**[F4] 짧은 excerpt의 최대 범위, private evidence의 서버 보존 기본값, 원문 vault를
Argus가 제공할지 결정해야 한다.**

K1 schema는 `full_content`를 허용하지 않는다.

---

## F5. local-only 판단의 watch sync

### 제안

server watch가 필요한 경우에도 다음 최소 묶음만 전송한다.

- 사용자가 선택한 premise의 literal text
- 대상 entity/metric/query/materiality/cadence/source policy가 담긴 WatchSpec
- 서버가 원문 decision을 역추적할 수 없는 opaque decision reference
- consent receipt와 source client ID

전체 판단 문장, 선택지, rationale, 다른 premises는 전송하지 않는다. watch 결과는
opaque ref로 로컬 case에 다시 연결한다.

### 창업자 결정

**[F5] premise literal text도 민감할 수 있으므로 local redaction/사용자 편집 단계를
필수로 둘지 결정해야 한다.**

임시 기본값은 명시적으로 선택된 literal text만 전송하고 자동 확장하지 않는 것이다.

---

## I4. DecisionContract 전환 게이트

### 결정

기존 web `DecisionContract`는 다음 조건을 모두 만족하기 전까지 canonical write/read
경로로 유지한다.

1. 동일 입력을 legacy와 v4 shadow에 dual-write한다.
2. replay projection의 의미 parity fixture가 통과한다.
3. 최초 `user_lean` 보존율과 event 수 누락률이 목표를 만족한다.
4. shadow sink 장애가 legacy 성공률에 영향을 주지 않는다.
5. rollback rehearsal에서 env flag off만으로 기존 경로로 복귀한다.
6. 운영 관찰 기간과 별도 cutover ADR을 통과한다.

K1/K2에서 legacy write를 수정하거나 read-only로 바꾸지 않는다.

---

## I5. DKK v4와 배포 경계

### 결정

- namespace: `argus-mcp/src/v4/`
- semantic version: `4`
- opt-in flag: `ARGUS_SEMANTIC_V4_SHADOW=1`
- 기본값: off
- write mode: shadow-only
- v3 import 금지: v4가 v3 reducer/store를 호출하거나 monkey-patch하지 않는다.
- v1/v2 write path 변경 금지: 연결은 기존 write가 성공한 뒤 호출되는 별도 adapter에서만 한다.

K1은 schema, pure reducer, shadow sink contract와 독립 테스트까지만 구현한다. 실제 봉인
도구 배선은 O1 방4와 충돌하므로 이 공정에 포함하지 않는다.

---

## K0 exit criteria

- §16의 열 질문 모두 owner와 임시/확정 상태가 있다.
- 창업자 결정 5건은 public contract가 아닌 안전한 임시 기본값으로 제한된다.
- §14.1~14.5가 실행 가능한 betrayal fixture 목록으로 변환된다.
- fixture가 K1 코드보다 먼저 추가되고, missing v4 contract로 실패하는 것을 확인한다.
- K1은 fixture를 통과시키는 최소 schema/reducer/shadow contract만 구현한다.
- v3와 금지 파일의 diff가 0이다.

---

## 창업자 결정 체크리스트

- [ ] **F1** export/developer API에서 내부 코어 명칭을 공개할 것인가
- [ ] **F2** premise 채택과 원격 sync를 한 버튼으로 승인할 것인가
- [ ] **F3** 개인 반복 Pattern의 3건 최소치를 고정 헌법으로 둘 것인가
- [ ] **F4** evidence excerpt/private 원문 보존의 기본 정책은 무엇인가
- [ ] **F5** server watch 전 premise text 편집/redaction 단계를 필수로 둘 것인가

---

## 창업자 결정 브리프

이 부록은 F1~F5를 닫기 위한 의사결정 메모다. 아래 권고는 K1/K2 구현의
임시 기본값을 public contract로 승격하지 않으며, 창업자 승인 전에는 제품 표면,
export/developer API, 장기 저장 정책, 자동 코칭 정책을 열지 않는다.

| 결정 | 권고 기본값 | 승인하면 열리는 다음 단계 | 승인 전 금지 |
|---|---|---|---|
| F1 public naming | 내부 코어와 export/developer API는 `DecisionCase`, `JudgmentVersion`, `Assertion`, `EvidenceArtifact`를 유지하고, 사용자 UI는 기존 판단/예측/전제/근거 언어를 유지한다. | developer-facing 문서와 export schema 초안을 만들 수 있다. | 사용자 표면에서 `JudgmentVersion`을 제품 용어로 노출하지 않는다. |
| F2 combined consent | UI는 한 번 승인처럼 보일 수 있지만 receipt는 premise adoption과 remote sync consent를 별도 필드로 기록한다. | W1 검토 카드의 copy와 receipt shape를 설계할 수 있다. | 한 버튼 클릭을 두 권한의 재사용 가능한 포괄 동의로 저장하지 않는다. |
| F3 Pattern floor | 개인 반복 Pattern은 독립 resolved case 3건을 최소치로 두고, blast radius 알림은 별도 deterministic 경로로 둔다. | O4 이후 Patterns policy test와 projection fixture를 만들 수 있다. | K1/K2에서 개인 Pattern 산출, 코칭 카드, 5차원 Patterns UI를 만들지 않는다. |
| F4 Evidence retention | 기본은 locator, hash, 짧은 excerpt 또는 measurement만 저장하고 `full_content`는 금지한다. | evidence excerpt limit, private source policy, vault 별도 ADR을 열 수 있다. | private 원문, 업로드 본문, 웹 문서 전문을 v4 schema에 추가하지 않는다. |
| F5 watch redaction | server watch는 사용자가 선택한 premise literal text와 WatchSpec, opaque decision ref만 전송한다. redaction step은 W1에서 별도 제품 결정으로 둔다. | watch consent UI와 local redaction affordance를 설계할 수 있다. | 전체 판단 문장, rationale, 선택지, 다른 premise를 자동 전송하지 않는다. |

### Draft 해제 기준

PR #170을 Draft에서 Ready로 바꾸려면 다음 중 하나가 필요하다.

1. 창업자가 F1~F5를 위 권고 기본값으로 승인한다.
2. 창업자가 일부 항목을 수정 승인하고, 이 ADR의 해당 F 항목과 브리프가 같은
   의미로 갱신된다.
3. F1~F5는 intentionally deferred로 남기되, PR #170의 병합 범위가 shadow-only
   실험 계약임을 승인한다.

어느 경우에도 K1/K2 병합 전까지 다음 경계는 유지한다.

- `ARGUS_SEMANTIC_V4_SHADOW=1`이 없으면 v4는 off다.
- v4는 v3 reducer/store를 import하거나 monkey-patch하지 않는다.
- v1/v2 write path의 성공, 응답, 수명주기를 바꾸지 않는다.
- proposed semantic relation은 judgment lifecycle을 바꾸지 못한다.
- 별도 authorization receipt 없이는 `user_lean`에서 `JudgmentVersion`을 만들지 않는다.
