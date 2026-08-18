# ADR — Judgment Knowledge Core K0 결정 경계

Date: 2026-07-16
Status: **Accepted — 창업자 결정 F1~F5 완료, K1 shadow schema 계약**
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

이 ADR은 §16의 열 가지 질문을 닫고, 창업자 판단이 필요한 항목 F1~F5의 제품 경계를
확정한다. K1/K2의 구현 범위는 여전히 shadow-only이며, public surface, Evidence Vault,
Patterns UI, legacy read/write cutover는 아래 결정과 후속 gate를 통과한 범위에서만 연다.

---

## 결정 상태 표

| # | 질문 | K0 제안 | 소유자 | K1 효력 |
|---:|---|---|---|---|
| 1 | `JudgmentVersion`을 제품·API에서도 쓸 것인가 | 사용자 UI는 쉬운 말 유지, developer/export API에는 코어 명칭 공개 가능 | **[창업자 결정 F1]** | 사용자 표면 미노출, developer/export 초안 가능 |
| 2 | Assertion 저장 구조 | 단일 canonical discriminated union + role별 projection | [구현 결정 I1] | 확정 |
| 3 | 한 번 승인으로 Premise 채택과 sync를 함께 설명하는 법 | 한 카드 안에서 승인 가능하되 premise adoption과 remote sync receipt는 분리 | **[창업자 결정 F2]** | W1 copy/receipt 설계 가능 |
| 4 | `system_verified` 허용 범위 | ID·해시·정규화된 exact key 등 결정적 관계만 허용 | [구현 결정 I2] | 확정 |
| 5 | 매번 묻지 않고 semantic relation precision을 지키는 법 | 관계는 저장 가능하나 의미 변화에 사용할 때만 확인; 그 전에는 제안 | [구현 결정 I3] | UI 미노출, proposed만 허용 |
| 6 | 개인 Pattern 최소 사례 수 | 독립 resolved case 3건 기본, 민감한 패턴은 후속 정책에서 3~5건으로 상향 가능 | **[창업자 결정 F3]** | O4 전 Patterns 생성/노출 금지 |
| 7 | Evidence 원문 보존·저작권·개인정보 | 기본은 최소 저장, 명시 동의한 자료만 후속 Evidence Vault에 원문 보관 가능 | **[창업자 결정 F4]** | v4 core `full_content` 필드 금지 |
| 8 | local-only 판단의 server watch 최소 sync 정보 | 전송 전 preview와 선택 편집 제공, 선택된 premise text + WatchSpec + opaque ref만 전송 | **[창업자 결정 F5]** | 자동 확장 전송 금지 |
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

**[F1 결정]** 사용자 표면은 판단 기록, 예측, 전제, 근거, 돌아보기 같은 쉬운 말을
유지한다. developer/export API에는 `DecisionCase`, `JudgmentVersion`, `Assertion`,
`EvidenceArtifact` 같은 코어 명칭을 공개할 수 있다.

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

**[F2 결정]** 사용자에게는 한 카드/한 흐름으로 승인할 수 있게 하되, authorization
receipt에는 premise adoption과 remote sync consent를 별도 필드로 기록한다. 항목 또는
scope가 바뀌면 이전 승인을 재사용하지 않는다.

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

**[F3 결정]** 개인 반복 Pattern은 독립 resolved case 3건을 기본 최소치로 둔다.
민감하거나 사용자를 강하게 규정할 수 있는 패턴은 후속 정책에서 3~5건으로 상향할 수
있다. K1에서는 Pattern 산출 자체를 구현하지 않는다.

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

**[F4 결정]** 기본 Evidence 보존은 locator, hash, 짧은 excerpt 또는 measurement로
제한한다. 사용자가 명시적으로 허용한 자료는 후속 Evidence Vault에서 원문 보관을
지원할 수 있다. Vault는 retention, export, erasure, copyright 정책을 별도 ADR로
승인한 뒤 설계한다. K1 schema는 `full_content`를 허용하지 않는다.

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

**[F5 결정]** server watch 전송 전에는 사용자가 보낼 내용을 미리 보고 원하면 편집할
수 있어야 한다. 편집 단계를 필수로 막지는 않지만, 전송 범위는 선택된 premise literal
text, WatchSpec, opaque decision reference, consent receipt, source client ID로 제한한다.
전체 판단 문장, 선택지, rationale, 다른 premises는 자동 전송하지 않는다.

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
- 창업자 결정 F1~F5는 이 ADR에 명시된 public/product 경계로 확정된다.
- §14.1~14.5가 실행 가능한 betrayal fixture 목록으로 변환된다.
- fixture가 K1 코드보다 먼저 추가되고, missing v4 contract로 실패하는 것을 확인한다.
- K1은 fixture를 통과시키는 최소 schema/reducer/shadow contract만 구현한다.
- v3와 금지 파일의 diff가 0이다.

---

## 창업자 결정 체크리스트

- [x] **F1** export/developer API에는 코어 명칭 공개 가능, 사용자 UI는 쉬운 말 유지
- [x] **F2** premise 채택과 원격 sync는 한 흐름으로 승인 가능하되 receipt는 분리
- [x] **F3** 개인 반복 Pattern은 기본 3건, 민감 패턴은 후속 정책에서 3~5건 가능
- [x] **F4** 기본은 최소 Evidence 저장, 명시 동의 자료만 후속 Vault 원문 보관 가능
- [x] **F5** server watch 전 미리보기와 선택 편집 제공, 자동 확장 전송 금지

---

## 창업자 결정 브리프

이 부록은 F1~F5의 최종 결정을 구현 가능한 다음 단계로 압축한 메모다. K1/K2는
여전히 shadow-only이며, 아래 결정은 후속 W1/O4/Vault/cutover gate의 입력으로 사용한다.

| 결정 | 권고 기본값 | 승인하면 열리는 다음 단계 | 승인 전 금지 |
|---|---|---|---|
| F1 public naming | 내부 코어와 developer/export API는 `DecisionCase`, `JudgmentVersion`, `Assertion`, `EvidenceArtifact`를 유지하고, 사용자 UI는 기존 판단/예측/전제/근거 언어를 유지한다. | developer-facing 문서와 export schema 초안을 만들 수 있다. | 사용자 표면에서 `JudgmentVersion`을 제품 용어로 노출하지 않는다. |
| F2 combined consent | UI는 한 번 승인처럼 보일 수 있지만 receipt는 premise adoption과 remote sync consent를 별도 필드로 기록한다. | W1 검토 카드의 copy와 receipt shape를 설계할 수 있다. | 한 버튼 클릭을 두 권한의 재사용 가능한 포괄 동의로 저장하지 않는다. |
| F3 Pattern floor | 개인 반복 Pattern은 독립 resolved case 3건을 기본 최소치로 두고, 민감 패턴은 후속 정책에서 3~5건으로 상향 가능하게 둔다. Blast radius 알림은 별도 deterministic 경로로 둔다. | O4 이후 Patterns policy test와 projection fixture를 만들 수 있다. | K1/K2에서 개인 Pattern 산출, 코칭 카드, 5차원 Patterns UI를 만들지 않는다. |
| F4 Evidence retention | 기본은 locator, hash, 짧은 excerpt 또는 measurement만 저장한다. 사용자가 명시적으로 허용한 자료는 후속 Evidence Vault에서 원문 보관할 수 있다. | evidence excerpt limit, private source policy, vault 별도 ADR을 열 수 있다. | private 원문, 업로드 본문, 웹 문서 전문을 v4 core schema에 추가하지 않는다. |
| F5 watch redaction | server watch 전 미리보기와 선택 편집을 제공한다. 전송은 선택된 premise literal text, WatchSpec, opaque decision ref만 허용한다. | watch consent UI와 edit affordance를 설계할 수 있다. | 전체 판단 문장, rationale, 선택지, 다른 premise를 자동 전송하지 않는다. |

### Draft 해제 기준

PR #170을 Draft에서 Ready로 바꾸려면 F1~F5 결정이 이 ADR과 설계 문서에 일치하게
반영되고, CI와 경계 테스트가 통과해야 한다.

어느 경우에도 K1/K2 병합 전까지 다음 경계는 유지한다.

- `ARGUS_SEMANTIC_V4_SHADOW=1`이 없으면 v4는 off다.
- v4는 v3 reducer/store를 import하거나 monkey-patch하지 않는다.
- v1/v2 write path의 성공, 응답, 수명주기를 바꾸지 않는다.
- proposed semantic relation은 judgment lifecycle을 바꾸지 못한다.
- 별도 authorization receipt 없이는 `user_lean`에서 `JudgmentVersion`을 만들지 않는다.
