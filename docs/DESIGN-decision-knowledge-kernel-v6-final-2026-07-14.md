# ARGUS DECISION KNOWLEDGE KERNEL

## 판단 원장 — 최종 정본 v6

Date: 2026-07-14  
Status: **최종 규범 기준선 · 구현 공정 진입용**  
Supersedes as implementation authority: v0 · v2 · v3 · v4 · v5  
Preserves as research history: 각 버전의 조사·반론·설계 진화  
Change policy: 이 문서를 다시 전면 재작성하지 않는다. 구현 중 발견되는 변경은 ADR과 명시적 amendment로 남기고, 권력 배치가 바뀔 때만 헌법 조항을 고친다.

---

## 계보와 최종 편집 판정

| 버전 | 최종 정본에 남긴 것 | 최종 정본이 기각·교정한 것 |
|---|---|---|
| v0 | 선행 체계 조사, conformance 정신, kill criteria | 9종 greenfield 온톨로지 |
| v2 | 현행 코드 감사, adapter·시간상자·예산 규율 | 존재하는 구현의 자동 승격 |
| v3 | 판단 원장 정체성, 기록 행위 원칙, 흡수 밸브, 기계 증명 | 미증명 “커밋의 대수”, defer를 포함한 mu |
| v4 | authority/provenance 분리, 실행/승인 분리, 이시간 정직, atomic batch, 비용 포함 델타, 공간·파기 | 21개 조항의 평면적 나열, 늦은 가치 검증 |
| v5 | 기억 가능한 전문, 3장 14조, 실례 스레드, 헌법 인플레이션 방지 | 사람의 자기 채점 금지라는 잘못된 대칭, 현실=심판의 과장, resolution 대상 불명확, authority 단면 누락, 퍼널 절대 우선 |

최종 정본의 편집 원칙은 네 가지다.

1. 세계관은 기억 가능해야 한다.
2. 의미론은 예시 하나가 끝까지 통과할 만큼 정확해야 한다.
3. 헌법은 적고 무거워야 하며 모든 조항은 기계 집행점이 있어야 한다.
4. 가치 가설은 표면을 넓히기 전에 질 수 있는 실험으로 판정해야 한다.

이 문서만 읽고 P0에 진입할 수 있어야 한다. 외부 문서는 연구 근거와 제품 용어의 SSOT이지, 빠진 규범을 보충하는 비밀 부록이 아니다.

---

## 0. 열두 결정

1. Argus의 커널은 메모리나 개인 온톨로지가 아니라 **판단 원장**이다.
2. 원장의 정본은 마음의 상태가 아니라 **시간이 찍힌 기록 행위**다.
3. 권한은 서기(AI)·저자(사람)·외부 세계 사이에 분리된다.
4. AI는 제안·기록·사람이 명령한 실행을 할 수 있지만 승인할 수 없다.
5. 사람은 승인·종결할 수 있지만 봉인된 과거를 덮어쓸 수 없다. 정정·대체·파기는 명시적 행위로만 가능하다.
6. 세계는 결과를 낳지만 스스로 원장에 기록되거나 해석되지 않는다. 출처 있는 관찰 주장으로만 들어온다.
7. 원장 항목은 Proposal·Assertion·Authorial Act·System Event의 네 층으로 구분된다.
8. `still_pending`은 종결이 아니라 유예다. 종결은 `answered`, `indeterminate`, `moot`를 구분한다.
9. 판단의 질과 사람됨은 채점하지 않되, 빈 기록·권한 부재·시간 모순 같은 구조적 무결성은 강제한다.
10. 헌법은 이유와 금지를, 의미 모델은 타입·상태·전이를, adapter는 저장 형식을 소유한다.
11. 기존 v2 구현은 자동 승격도 전면 폐기도 하지 않고 `inherit / reforge / reject`로 판정한다.
12. 독창성과 가치는 가설이다. 정확도와 사용자 비용을 함께 잰 재구성 델타에서 실패하면 주장을 축소하거나 구현을 중단한다.

이 열두 결정과 충돌하는 구현은 기존 코드 여부와 무관하게 고친다. 충돌하지 않는 기존 구현은 가능한 한 계승한다.

---

## 1. 정체성

### 1.1 전문

> **Argus는 사람이 AI와 생각하는 동안 내린 판단을, 그 판단이 기댄 전제·저자·시점·귀환 약속과 함께 봉인하고, 이후의 관찰·해석·종결을 분리해 남겨, 어떤 표면에서도 “누가 언제 무엇을 승인했는가”를 기계의 창작 없이 재구성할 수 있게 하는 판단 원장이다.**

한 호흡으로는 다음과 같다.

> **생각이 AI와의 대화가 된 시대에, 내가 무엇을 믿고 결정했는지를 기계가 위조할 수 없게 남기고, 미래의 나와 다시 대면시키는 원장.**

### 1.2 세 부정문

분립은 각 주체가 가진 능력보다 갖지 못한 권한으로 정의한다.

```text
서기 (AI)    받아 적고 제안하고 사람의 명령을 실행할 수 있으나,
             어떤 저자 행위도 스스로 승인할 수 없다.

저자 (사람)  봉인·채택·귀환 약속·종결의 전권을 가지나,
             봉인된 과거를 조용히 덮어쓸 수 없다.
             정정·대체·파기는 흔적과 권한을 가진 별도 행위다.

세계 (현실)  원장 밖에서 결과를 낳고 판단을 제약하나,
             스스로 기록되거나 자신의 의미를 해석할 수 없다.
             관찰자·방법·시점을 단 주장으로만 원장에 들어온다.
```

“사람을 채점하지 않는다”는 저자의 능력을 금지하는 네 번째 대칭문이 아니다. **체계에 부과되는 헌법적 제한**이며 제4조가 담당한다. 사용자는 자신의 경험을 성찰하거나 원하면 개인 통계를 볼 수 있다. 체계가 그것을 사람의 등급과 권한 차등으로 바꾸지 못한다.

### 1.3 사용자가 얻는 것

Argus는 정답을 약속하지 않는다. 다음 질문에 대한 정직한 재구성을 약속한다.

- 나는 당시 무엇을 판단·선택·약속했는가?
- 무엇을 전제로 채택했는가?
- 무엇이 내 말이고 무엇이 AI의 제안이었는가?
- 그때 무엇을 몰랐으며, 무엇이 나중에 들어왔는가?
- 언제 무엇을 다시 묻기로 했는가?
- 이후 무엇을 관찰했는가?
- 그 관찰을 나는 어떻게 해석했고 어떻게 닫았는가?
- 아직 답을 기다리는가, 끝내 알 수 없는가, 질문 자체가 사라졌는가?

### 1.4 충성 대상과 비목표

충성 대상은 **사람이 자신의 판단 기록을 소유하고, 나중에도 저자와 당시 맥락을 구별할 수 있는 능력**이다.

커널은 다음을 목표로 하지 않는다.

- 마음·확신·무의식·성격의 실체를 정본화
- 사용자의 판단 능력·사람됨을 점수·등급·티어로 평가
- AI 추론을 사용자의 전제나 결론으로 자동 채택
- 관찰을 검증 없는 객관적 사실로 승격
- 모든 대화를 판단으로 수확
- 반복 의사결정 규칙을 실행하는 DMN 엔진
- 조직 운영 세계 전체를 모델링하는 Palantir식 ontology
- 모든 사건과 관계를 빠짐없이 포착하는 완전한 개인 지식 그래프

커널 밖의 제품이 조언·검색·분석·패턴 탐색을 제공할 수는 있다. 그 결과는 proposal 또는 derived projection이며 저자 행위를 대체하지 않는다.

---

## 2. 왜 지금인가 — AI는 병이자 약이다

**병.** AI는 사용자가 말하지 않은 이유를 보충하고, 현재 결과를 과거 판단에 섞고, 여러 세션의 발화를 하나의 일관된 입장처럼 합성하며, 자신의 제안을 사용자의 결론처럼 재진술한다. 사실 문장이 모두 맞아도 누가 언제 무엇을 승인했는지가 사라지면 저자성은 훼손된다.

**약.** 같은 기술이 판단 기록의 오랜 실패 원인인 구조화 비용을 낮춘다. AI는 대화에서 판단 후보를 발견하고, 전제·검토 질문·귀환일 초안을 만들고, 과거 기록을 출처와 함께 회수할 수 있다.

**AI-native의 뜻**은 AI에게 더 많은 권한을 주는 것이 아니다.

> **AI가 구조화 비용을 대부분 부담하면서 저자 권한은 0으로 유지되는 구조.**

---

## 3. 독창성의 정확한 위치

Argus는 부품을 발명하지 않았다.

- append-only 원장은 회계와 event sourcing에서 배운다.
- 사전 커밋과 시간 오염 방지는 preregistration에서 배운다.
- provenance는 W3C PROV-O에서 배운다.
- 객체·행동·권한 분리는 Palantir Ontology에서 배운다.
- 판정 불가와 annulment는 예측 시장에서 배운다.
- 결정·이유·검토일 서식은 기존 decision journal에서 배운다.

직접 인접 제품도 Decision Journal, DecisionLedger, Reckon, Lound 등이 존재한다. 따라서 “세상에 없다”는 단언을 하지 않는다.

Argus의 검증 가능한 차별 가설은 다음 결합이다.

> **AI가 개입하는 대화·MCP·웹·메신저·플러그인 전 표면에서 제안/채택, 실행/승인, 당시 기록/사후 관찰, 관찰/해석/종결을 하나의 실행 의미론으로 분리하고 재구성한다.**

| 체계 | 정본 | 외부 결과의 처리 | 사람의 지위 | 시간 축 |
|---|---|---|---|---|
| Palantir Ontology | 조직의 운영 세계 | 조직 action과 state | 운영자 | 현재 상태 중심 |
| PROV-O | entity/activity/agent의 계보 | 판정 없음 | agent 한 종류 | 생성·파생 시점 |
| 예측 시장 | 군중의 예측 | 운영자가 resolve | 점수화되는 예측자 | 예측→resolution |
| decision journal | 개인의 결정 메모 | 자기 회고 | 필자 | 기록→검토일 |
| agent memory | AI의 작업 기억 | 없음 | 컨텍스트 공급자 | 세션 중심 |
| **Argus** | **개인의 승인된 판단 행위** | **관찰→사람의 해석→종결** | **원장 소유자·저자** | **봉인→귀환→종결 + 이시간** |

이 표는 논증이지 증명이 아니다. §11의 비교 실험이 판정한다.

연구 근거:

- [Palantir Ontology overview](https://www.palantir.com/docs/foundry/ontology/overview/)
- [W3C PROV-O](https://www.w3.org/TR/prov-o/)
- [Metaculus FAQ](https://www.metaculus.com/faq)
- [Decision Journal](https://decisionjournalapp.com/guides/app/adding_decisions.html)
- [DecisionLedger](https://apps.apple.com/us/app/decisionledger/id6757331604)
- [Reckon](https://roland.leth.ro/projects/reckon)
- [Lound](https://lound.ai/decision-journal-app/)

---

## 4. 존재론 — 여섯 객체, 네 층, 세 단면

### 4.1 기록 행위 원칙

사람의 마음은 연속적이고 모순되며 완전히 관찰할 수 없다. 커널은 마음의 진실이 아니라 특정 시점의 기록 행위를 저장한다.

> “사용자가 7월 14일 18:20에 이 문장을 판단으로 승인했다”는 검증 가능하다. “사용자는 사실 그전부터 확신했다”는 심리 해석이다.

기록 행위는 이산적이다. 승인했거나 하지 않았다. 커널은 “얼마나 결정했는가”라는 연속량을 추정하지 않는다.

### 4.2 네 층

| 층 | 의미 | 생성·승인 권한 | 예 |
|---|---|---|---|
| Proposal | 아직 채택되지 않은 구조화 제안 | AI·사람·호스트 생성 | 판단·전제·연결 후보 |
| Assertion | 출처를 단 주장 | 누구나 기록, provenance 필수 | 발화 인용, 관찰, 문서 주장 |
| Authorial Act | 판단 의미·생명주기를 바꾸는 행위 | 사람만 승인 | seal, adopt, promise, defer, close |
| System Event | 전달·동기화·집행 상태 | 시스템 | outbox, bridge, gate, sync |

Proposal과 Assertion은 원장에 존재할 수 있지만 사용자 판단이 아니다. Authorial Act가 붙을 때만 사용자 소유의 판단 의미가 생긴다.

### 4.3 여섯 의미 객체

| 객체 | 무엇의 추상인가 | 의도적으로 버리는 것 | 버림의 근거 |
|---|---|---|---|
| **Judgment** | 사용자가 판단·선택·약속한 문장 | 숫자로 된 확신·판단 품질 | 거짓 정밀도와 자기 채점 유도 |
| **Premise** | 판단이 기댄다고 사용자가 채택한 주장 | 암묵·감정·무의식 전제 | 끌어내면 숙제, 지어내면 세탁 |
| **Return Contract** | 무엇을 언제 다시 물을지에 대한 약속 | 상시 감시·연속 추적 | 불안 엔진과 비용 전가 방지 |
| **Observation** | 외부 세계에 관한 출처 있는 주장 | 자동 “사실” 지위 | 관찰자·방법·시점이 의미의 일부 |
| **Resolution Assertion** | 관찰이 반환 질문에 주는 답에 대한 사람의 해석 | 자동 판정 | 세계는 스스로 해석하지 않음 |
| **Closure** | 해석을 채택하고 판단을 닫는 저자 행위 | 사람 점수 | 기록 회피를 낳는 평결 방지 |

새 객체는 표의 네 열을 전부 채울 수 있을 때만 추가한다. 버리는 것과 버림의 근거를 쓰지 못하는 타입은 추상이 아니라 축적이다.

### 4.4 세 횡단 단면

Provenance·Authority·Time은 독립 객체가 아니라 모든 의미 이벤트를 가로지르는 context다.

| 단면 | 답하는 질문 |
|---|---|
| Provenance | 이 내용은 어디에서 왔고 어떤 근거로 추적되는가? |
| Authority | 누가 만들고, 기록하고, 관찰하고, 승인했는가? |
| Temporal | 언제 일어났다고 주장하며, 언제 기록·승인되었는가? |

세 단면 중 하나를 객체 본문에 암묵적으로 섞지 않는다.

### 4.5 Judgment와 Return Contract의 분리

`Judgment.statement`는 “내가 무엇을 판단·선택·약속했는가”다.

Return Contract는 다음을 가진다.

```ts
type ReturnContract = {
  return_contract_id: string;
  judgment_id: string;
  review_at?: string;
  review_trigger?: Trigger;
  review_question: string;
  resolution_criterion?: string;
  promised_at: string;
};
```

“A를 채용하기로 했다”와 “90일 뒤 역할 기대를 충족했는가”를 같은 필드에 섞지 않는다. Return Contract가 없는 항목은 sealed judgment가 아니라 proposal·note·work item이다. 기록은 언제나 가능하지만 봉인은 미래의 재대면 의지를 요구한다.

### 4.6 Resolution의 대상과 답

Resolution Assertion은 무엇에 답하는지 명시한다. 기본 대상은 active Return Contract의 `review_question`이다. 판단문 자체를 진위 명제로 소급 변환하지 않는다.

```ts
type ResolutionAssertion =
  | {
      kind: "answered";
      subject_ref: ReturnContractRef;
      answer_summary: string;
      criterion_result?: "met" | "not_met" | "partial" | "not_applicable";
      evidence_refs: ObservationRef[];
    }
  | {
      kind: "indeterminate";
      subject_ref: ReturnContractRef;
      reason?: string;
      evidence_refs: ObservationRef[];
    }
  | {
      kind: "moot";
      subject_ref: ReturnContractRef;
      reason?: string;
      evidence_refs: ObservationRef[];
    };
```

- `answered`: 질문에 답할 수 있다. 답은 텍스트로 보존하고, 미리 정한 criterion이 있을 때만 중립적인 결과 코드를 붙인다.
- `indeterminate`: 충분히 기다렸지만 증거로 답할 수 없다.
- `moot`: 질문의 전제·목표·대상이 사라져 더는 의미가 없다.
- `still_pending`: Resolution이 아니다. `return_deferred`다.

legacy의 `held / avoided / missed / partial`은 자동으로 사람이나 판단의 점수가 되지 않는다. adapter가 원문의 의미와 맥락을 보존해 `answer_summary`, `criterion_result`, legacy extension으로 변환한다. 손실 없는 일반 매핑이 불가능하면 `degraded`로 표시한다.

판단을 계속 유지할지, 바꿀지, 철회할지는 resolution의 참/거짓 결과가 아니다. 필요하면 새 Judgment, `judgment_withdrawn`, `judgment_superseded`로 남긴다.

### 4.7 연결

판단은 독립적으로 먼저 선다. `supports / contradicts / depends_on / supersedes / same_question` 연결은 이후 제안할 수 있다. AI가 만든 연결은 proposal이며, 의미를 바꾸는 연결은 사용자 채택이 필요하다. 검색 유사도는 파생 데이터다.

---

## 5. 권한과 시간

### 5.1 Authority Context

```ts
type AuthorityContext = {
  originated_by: PrincipalRef;
  recorded_by: PrincipalRef;
  observed_by?: PrincipalRef;
  authorized_by?: HumanPrincipalRef;
  authorization_mode?:
    | "direct_command"
    | "explicit_confirmation"
    | "signed_import";
  authorization_ref?: EvidencePointer;
};
```

- `originated_by`: 내용을 처음 만든 주체
- `recorded_by`: 이벤트를 원장에 쓴 표면·도구
- `observed_by`: 관찰을 수행하거나 보고한 주체
- `authorized_by`: 의미 변화 행위를 승인한 사람

출처와 권한은 다르다. “사용자 대화에서 나왔다”와 “사용자가 이 행위를 승인했다”를 한 필드에 섞지 않는다.

### 5.2 실행과 승인의 분리

```text
사용자: “이 질문은 더 의미가 없어. moot로 닫아줘.”
recorded_by: mcp
authorized_by: human
authorization_mode: direct_command
authorization_ref: 사용자 발화 포인터
→ 합법

AI: 대화를 보고 “아마 moot일 것”이라며 자동 종결
authorized_by: 없음
→ 거절
```

AI가 API를 호출했다는 사실은 AI가 저자라는 뜻이 아니다. 반대로 사용자 발화에서 나온 내용이라는 사실만으로 승인되었다고 간주하지 않는다.

침묵은 승인도 거절도 아니다. 일괄 승인은 대상 목록이 표시·고정된 후에만 유효하며 목록이 바뀌면 새 승인이 필요하다. legacy 승인자를 증명할 수 없으면 `authority_status: legacy_unknown`으로 남기고 소급 세탁하지 않는다.

### 5.3 이시간(bi-temporal) 정직

```ts
type TemporalContext = {
  occurred_at?: string;
  recorded_at: string;
  authorized_at?: string;
  temporal_mode: "contemporaneous" | "retrospective";
};
```

- `occurred_at`: 주체가 주장하는 사건·판단 시점
- `recorded_at`: 원장이 처음 알게 된 시점
- `authorized_at`: 사람이 저자 행위를 승인한 시점

오늘 “지난달에 이미 결정했다”고 기록하면 occurred_at은 지난달일 수 있지만 recorded_at과 authorized_at은 오늘이다. 회고 진술은 합법이지만 contemporaneous seal로 승격되지 않는다. 결과를 안 뒤 추가된 premise는 과거 `as_of` projection에 나타나지 않는다.

시간적 정직성은 정확한 심리 시점을 맞히는 것이 아니라 **원장이 실제로 알게 된 시점을 숨기지 않는 것**이다.

---

## 6. 이벤트 문법과 상태 의미론

이것은 아직 대수가 아니다. 이벤트 문법과 결정론적 상태 기계다.

### 6.1 이벤트 계열

```text
Proposal
  proposal_created · proposal_revised · proposal_rejected · proposal_expired

Assertion
  assertion_recorded · observation_recorded · evidence_attached · assertion_corrected

Authorial
  judgment_sealed · premise_adopted · premise_retired
  return_promised · return_deferred · return_contract_superseded
  resolution_asserted · judgment_closed
  judgment_withdrawn · judgment_superseded

System
  delivery · sync · bridge · outbox · gate telemetry
```

proposal 채택은 proposal을 변이시키지 않는다. `judgment_sealed.source_proposal_id` 참조로 adopted 상태가 파생된다. assertion 정정은 원문을 덮지 않고 새 정정 관계를 만든다. System Event는 사용자 의미 상태를 직접 바꾸지 않는다.

### 6.2 한 command, 여러 event, 한 번의 확인

```text
SealJudgment command
  -> assertion_recorded       필요시
  -> judgment_sealed
  -> premise_adopted          선택적
  -> return_promised

CloseJudgment command
  -> observation_recorded     새 관찰이 있으면
  -> resolution_asserted
  -> judgment_closed
```

한 command는 atomic batch로 여러 의미 이벤트를 만든다. 사용자의 명시적 확인은 한 번이면 된다. 의미 분리는 폼과 확인 횟수를 늘리기 위한 것이 아니라 replay와 감사를 위한 것이다.

### 6.3 상태

```text
                           return due
SEALED (return scheduled) ------------> DUE / OVERDUE
          ^                                   |
          |                                   | defer
          +-----------------------------------+
          |
          +---- close ------> RESOLVED
          +---- withdraw ---> WITHDRAWN
          +---- supersede --> SUPERSEDED
```

`DUE / OVERDUE`는 저장된 status가 아니라 active Return Contract와 기준 시각에서 파생된다.

### 6.4 amendment

- 오탈자·표시 메타데이터: correction event
- premise 추가·폐기: premise lifecycle event
- 반환 날짜만 변경: `return_deferred`
- review question·criterion 의미 변경: 기존 contract supersede + 새 contract
- judgment statement 의미 변경: 기존 judgment supersede + 새 seal
- 결과를 안 뒤 과거 statement·question·criterion 변경: 금지

파기는 덮어쓰기와 다르다. 사용자의 삭제권은 제11조의 논리 삭제와 물리 파기 계약으로 집행한다.

### 6.5 결정론적 fold와 충돌

동일한 유효 이벤트 집합과 동일한 정렬 규칙은 모든 표면에서 동일한 상태를 만든다.

정렬 우선순위:

1. space 내 monotonic sequence
2. causal parent와 atomic batch order
3. `occurred_at + event_id` fallback

해소 불가능한 동시 저자 행위는 timestamp로 조용히 덮지 않는다. conflict state로 노출해 사람에게 돌린다.

---

## 7. 지저분한 현실의 네 밸브

1. **모호성의 가격** — 모호한 판단과 검토 질문도 봉인할 수 있다. 품질을 채점하지 않고 비어 있지 않은 statement, 사람 승인, 시점, provenance, return만 요구한다. 남은 모호함은 `specification_status: open` 같은 중립 파생으로 표시한다.
2. **복수의 정직한 종결** — answered·indeterminate·moot는 정식 종결이다. 아직 모름은 defer다.
3. **침묵의 합법성** — 말하지 않은 이유를 채우지 않고, 판단 없는 관찰을 판단으로 승격하지 않으며, 포착하지 못한 사건을 꾸짖지 않는다. 공백은 provenance의 경계다.
4. **연결의 후행성** — 입력 시 완벽한 분해·연결을 강요하지 않는다. 관계는 나중에 제안·채택할 수 있다.

밸브가 없으면 깨끗한 사례만 담는 장난감이 되고, 경계가 없으면 아무거나 담는 잡동사니가 된다.

---

## 8. 헌법 — 3장 14조

### 8.0 인플레이션 방지

새 조의 신설은 권력 배치가 바뀔 때만 허용한다. 새 불변식·운영 규칙은 기존 조의 파생 규칙으로 편입한다. 각 조는 같은 구현 phase에서 최소 하나의 schema refine, reducer guard, betrayal fixture와 연결되어야 한다. 집행점 없는 조항은 소망이다.

### 전문

§1.1의 두 문장과 §1.2의 세 부정문이 헌법의 전문이다.

### 제1장 권력

**제1조 인간 주권**  
저자 행위는 사람의 승인 없이 성립하지 않는다. 실행과 승인은 분리된다. 관찰은 자동으로 종결이 되지 않는다.  
집행: authority refine · no-auto-resolve guard.

**제2조 저자성 세탁 금지**  
provenance와 authority를 분리한다. 침묵은 승인이 아니며, AI·host·legacy 출처를 사람 승인으로 상향 세탁하지 않는다.  
집행: authority matrix · downgrade property test.

**제3조 세계는 주장으로**  
외부 세계는 관찰자·방법·시점을 단 주장으로만 들어온다. 반복된 AI 동의가 사실 지위를 만들지 않는다.  
집행: assertion schema · observation provenance refine.

**제4조 사람에 대한 평결 금지**  
체계는 판단 능력·사람됨을 점수·등급·티어로 표현하거나 outcome으로 사람을 줄 세우지 않는다. 시스템 품질과 중립 통계는 허용하되 원장 정본과 분리하고 개인 평결로 전용하지 않는다.  
집행: metric allow/deny list · system-copy fixture.

### 제2장 시간과 기록

**제5조 덮어쓰기 금지**  
과거 의미를 덮지 않고 정정·폐기·대체를 새 행위로 남긴다.  
집행: reducer immutability · supersession fixtures.

**제6조 이시간의 정직**  
주장된 사건 시점과 실제 기록·승인 시점을 섞지 않는다. 회고는 회고로 남고 `as_of`는 당시 기록만 본다.  
집행: retrospective/as-of fixtures.

**제7조 귀환은 의미다**  
Return Contract는 알림 설정이 아니라 판단 의미다. 전달 실패는 delivery state이지 judgment state가 아니다.  
집행: return event · due fold · delivery separation.

**제8조 복수의 정직한 종결**  
answered·indeterminate·moot를 구분하고 defer를 종결로 위장하지 않는다. resolution은 subject와 evidence를 명시한다.  
집행: resolution schema · transition fixtures.

**제9조 결정론적 등뼈**  
같은 유효 이벤트는 표면과 모델에 관계없이 같은 상태를 만들고, 모든 표면은 같은 전이·권한 규칙을 쓴다. 충돌은 사람에게 노출한다.  
집행: cross-surface conformance vectors.

### 제3장 소유와 경계

**제10조 최소 구조**  
재구성과 권한 집행에 필요한 최소 구조만 강제한다. 이 규율은 ontology 자신에도 적용한다.  
집행: optionality tests · 객체 존재 이유표.

**제11조 소유와 파기**  
사용자는 원장을 읽고 내보내고 지울 수 있다. append-only는 영구 감금이 아니다. 삭제는 즉시 projection에서 제외하는 논리 삭제와 canonical ledger·replica·index·cache·attachment·backup을 다루는 물리 파기로 집행한다. receipt에는 범위·완료·유예·실패 위치만 남기고 본문을 복제하지 않는다.  
집행: export/erasure fixture · purge contract.

**제12조 독립과 이식**  
모델·인코딩·벤더는 의미의 정본이 아니다. 의미 모델과 wire/storage를 분리하고 모델 교체가 승인된 의미를 바꾸지 못하게 한다.  
집행: model-free reducer · adapter round-trip.

**제13조 기계의 정직**  
모르는 출처·이유·관찰을 만들어 채우지 않는다. 모든 회수에는 기준 시점과 회수 이유를 붙인다.  
집행: missing-data fixtures · retrieval receipt.

**제14조 집행 장소**  
커널은 라이브러리다. 규칙은 write gateway와 conformance suite에서 집행한다. 중앙 authority 서버는 세우지 않는다. 사용자의 직접 파일 편집은 권리이며, 관문을 우회한 데이터는 검증 상태를 정직하게 표시한다.  
집행: gateway coverage map · invalid/unknown event handling.

---

## 9. 세 종류의 정본과 공간

### 9.1 정본의 분담

| 정본 | 소유하는 것 | 형태 |
|---|---|---|
| Normative SSOT | 왜·금지·권리 | 이 문서 + ADR |
| Semantic SSOT | 타입·전이·불변식·fold | versioned kernel package |
| Instance SSOT | 실제 사용자 이벤트 | space별 canonical ledger |

semantic package는 canonical event types, command/authority validation, reducer, temporal projection, conformance vectors, legacy adapter, export/erasure contract, schema registry를 제공한다.

웹·MCP·Telegram·plugin은 자체 judgment state machine을 만들지 않는다. 같은 package를 사용하거나 같은 conformance vectors를 통과한다.

### 9.2 버전과 legacy

- 새 기록은 current semantic version으로 쓴다.
- 과거 encoding은 adapter로 읽고 원본을 덮지 않는다.
- 복원 불가 필드는 `unknown` 또는 explicit loss로 남긴다.
- unknown extension field는 가능한 한 보존한다.
- downcast 손실은 loss report로 반환한다.
- round-trip과 replay equivalence를 테스트한다.

### 9.3 공간과 복제

space마다 canonical ledger, replica/projection, write authority, sync ordering, conflict policy, export boundary, erasure propagation, backup retention을 명시한다.

| 표면 | 역할 | 정본 여부 |
|---|---|---|
| repository JSONL | repository space canonical ledger | 예 |
| web local cache | projection/replica | 아니오 |
| Supabase | account space canonical 또는 replica | 배포 설정에 명시 |
| Telegram message | capture source | 아니오 |
| MCP response | command receipt/projection | 아니오 |

설정에 따라 canonical 위치가 달라질 수는 있지만 한 space 안에서 모호하면 안 된다.

---

## 10. 현행 v2 구현의 재료 판정

### Inherit

- append-only JSONL ledger
- strict parsing과 schema version
- deterministic reducer 골격
- idempotency와 atomic append
- candidate proposal plane
- byte·sha256·등급을 가진 evidence pointer
- outbox·bridge·gate telemetry
- `still_pending` 비종결 처리
- silent auto-seal을 막는 확인 흐름

### Reforge

- envelope → AuthorityContext와 TemporalContext 도입
- provenance enum → 출처·수집 방법·권한 분리
- `seal` → statement·return contract·premise 의미 이벤트의 atomic batch
- settlement → observation·resolution assertion·closure 분리
- `amend` → correction·premise lifecycle·defer·supersede
- outcome → subject가 명시된 ResolutionAssertion으로 변환
- repository/personal/account space 소유권과 sync contract
- 웹 localStorage·Supabase 상태 → shared reducer projection

### Reject

- AI 추론의 premise 자동 승격
- 결과 인지 후 과거 statement·question·criterion 수정
- `still_pending` terminal 처리
- 금지어 검사만으로 헌법 집행을 증명했다고 간주
- 표면별 독자 의미 모델과 outcome enum
- legacy 불명 권한의 소급 승인
- 사람의 judgment score·tier 저장

### Legacy mapping

v2의 24개 이벤트를 1:1로 이름만 바꾸지 않는다. 실제 의미 변화를 판정해 다음으로 분류한다.

- `exact`: 무손실 변환
- `split`: 하나의 legacy event가 여러 semantic event로 분해
- `degraded`: 일부 의미만 복원하고 unknown/loss 표시
- `opaque`: legacy extension으로 원형 보존

기존 이벤트 이름과 파일은 변경하지 않는다. adapter가 읽는다. 모든 fixture는 구 reducer 결과와 새 projection의 차이를 loss report로 남긴다.

---

## 11. 증명 전략

### 11.1 열두 배신 불가능성

각 명제는 adversarial command와 저장 이벤트가 포함된 executable fixture로 증명한다.

1. AI proposal을 사용자 판단으로 조용히 승격할 수 없다.
2. 결과를 안 뒤 sealed statement를 덮어쓸 수 없다.
3. 승인 근거 없는 terminal command가 종결 상태를 만들 수 없다.
4. Observation 하나가 자동으로 Resolution 또는 Closure가 될 수 없다.
5. Resolution이 subject 없는 일반 평결로 저장될 수 없다.
6. 동일 이벤트 replay가 표면마다 다른 상태를 만들 수 없다.
7. `still_pending`이 resolved 통계에 포함될 수 없다.
8. 오늘의 회고 진술이 과거 contemporaneous projection에 나타날 수 없다.
9. legacy unknown authority가 human-authorized로 상향될 수 없다.
10. erasure된 본문이 일반 projection에 다시 나타날 수 없다.
11. 사용자의 인용문 때문에 system-copy 금지어 검사가 오탐하지 않는다.
12. 모델 교체가 sealed meaning을 바꿀 수 없다.

### 11.2 지저분함 corpus

최소 30건을 만들고 다음 사례군을 포함한다.

- 회고 봉인
- 반쯤 결정했지만 귀환 약속은 거부
- 의도적으로 모호한 statement·review question
- 증거 부족의 장기 지속
- 질문 소멸
- 판단 없이 일어난 사건
- 말하지 않은 사적 이유
- 과거와 현재 관점의 변화
- 서로 얽힌 판단
- AI 초안 일부 채택
- 고정 목록의 일괄 승인
- 두 표면 동시 defer/close 충돌
- 삭제 후 오래된 replica 귀환
- review question과 judgment statement가 다른 종류인 결정
- criterion 없는 자유 응답형 귀환

각 사례에는 named entities, 의도적 unnamed, 허용 손실, 금지 fabrication, 기대 projection, 사용자 확인 비용을 명시한다.

손실은 세 가지로 판정한다.

- 무손실
- 명명된 손실: §4.3에서 버리기로 이미 결정한 것
- 미명명 손실: 버리기로 하지 않은 것을 표현할 수 없음 — 설계 결함

### 11.3 재구성 델타

비교군:

1. raw transcript 검색
2. transcript + RAG + citation
3. 일반 decision-journal template
4. Argus judgment ledger

정확도 측정:

- judgment statement 복원
- 저자 귀속 오류
- 당시·사후 정보 혼입률
- premise provenance 복원률
- return contract 복원률
- resolution subject·근거 복원률
- fabrication rate

비용 측정:

- 입력·확인 시간
- 확인 클릭·턴 수
- 잘못 봉인한 후보 비율
- 놓친 판단 비율
- 수정·철회 비용

synthetic adversarial corpus와 실제 dogfood corpus를 분리한다. 가능하면 라벨러는 조건을 모르는 상태로 평가한다.

### 11.4 go/kill

P1에서 corpus를 본 뒤 수치는 확정하되 측정 항목은 바꾸지 않는다.

- 저자 귀속과 hindsight leakage의 최소 개선
- 허용 가능한 추가 확인 시간
- silent false seal 상한
- cross-surface conformance 100%
- legacy critical-path 무손실률
- erasure propagation 성공률

다음이면 중단하거나 주장을 축소한다.

- 사용자 비용을 포함하면 일반 템플릿보다 재구성 우위가 없다.
- authority model이 실제 UX에서 지속적으로 우회된다.
- corpus를 과도한 예외 없이 표현할 수 없다.
- 표면마다 semantic fork가 반복된다.
- local ownership과 erasure를 현실 비용으로 지킬 수 없다.

증명은 이겨야 증명이 아니라 **질 수 있어야 증명**이다.

---

## 12. 구현 공정 P0–P7

### 12.1 구속 규칙

- 각 phase는 세션 상한을 가진다. 상한의 2배가 되면 계속 밀어붙이지 않고 범위·가설·막힘을 재판정한다.
- 운영 장애와 현재 사용자 여정의 치명적 파손은 커널 공정을 중단시킬 수 있다.
- 그 외의 새 표면·기능 확장은 P5 가치 관문을 통과하기 전 커널 의미 결정을 추월할 수 없다.
- 한 phase에는 하나의 비가역적 의미 결정만 둔다.
- exit evidence 없이 다음 phase로 가지 않는다.
- 각 phase 종료 시 문서 주장, executable fixture, 실제 projection을 함께 대조한다.

이 규칙은 “커널이 항상 이긴다”도 “퍼널이 항상 이긴다”도 아니다. 사용자에게 현재 발생하는 치명적 손상은 먼저 고치되, 새로운 표면을 늘리기 위해 의미 등뼈를 다시 미루지 않는다.

| Phase | 목표 | 세션 상한 | Exit evidence |
|---|---|---:|---|
| **P0 정본 운영화** | 문서를 구현 언어로 고정 | 1 | glossary·authority matrix·resolution taxonomy, 기존 문서 충돌 목록, ADR owner |
| **P1 corpus와 기준** | 코드 전에 현실 흡수 검증 | 2 | corpus 30+건, 미명명 손실 0 또는 ontology amendment, go/kill 수치 사전 선언 |
| **P2 semantic package spike** | 타입·전이·불변식 구현 | 3 | 14조 전부 집행점, corpus golden test, model-free replay |
| **P3 legacy adapter** | 두 번째 시스템 없이 현행 자산 흡수 | 2 | 24 event 판정표, 실제 ledger replay, read-old/write-new, loss report |
| **P4 MCP vertical slice** | 한 표면에서 전 생명주기 증명 | 2 | silent seal/close 0, authority/provenance receipt, 공개 도구 회귀 0 |
| **P5 조기 가치 관문** | 확장 전에 핵심 가설 판정 | 2 | 축소 델타 실험, 비용 포함 go/kill 결정 |
| **P6 웹 수렴과 dogfood** | 웹을 같은 ledger projection·command로 | 3 | MCP·웹 conformance 100%, conflict 무단 덮기 0, 실제 사용 failure review |
| **P7 외부 표면과 최종 판정** | Telegram/plugin 준수와 전체 델타 | 2 | 독자 enum 0, terminal 승인 증거, 전체 benchmark → go/축소/중단 |

P5가 실패하면 P6·P7로 확장하지 않는다. P5가 부분 통과하면 주장과 범위를 먼저 축소한 뒤 다시 기준을 봉인한다.

### 12.2 구현 전 ADR로 닫을 항목

1. repository-local 사용자 identity key
2. 직접 명령의 authorization evidence 형식
3. 사건 기반 return trigger의 첫 버전 포함 여부
4. signed import의 신뢰 경계와 key rotation
5. Supabase의 canonical/replica 배포별 선언
6. backup 물리 삭제 최대 보존 기간
7. 개인용 통계의 export·삭제·AI 접근 기본값
8. 동시 defer/close conflict UX

---

## 13. 표면 최소 규칙

모든 표면은 다음을 보여야 한다.

- proposal인지 committed judgment인지
- 정확한 sealed statement
- 누가 내용을 만들고 누가 승인했는지
- sealed 시점과 현재 기준 시점
- return contract와 due 이유
- observation, resolution assertion, closure의 구분
- amendment·supersession history
- retrieval reason과 provenance

모든 표면은 다음을 피한다.

- “AI가 기억한 당신의 결정”처럼 출처·승인을 흐리는 문구
- 저장과 승인을 하나의 모호한 버튼으로 합치기
- `partial / moot / defer`를 모두 “완료”로 평탄화
- 결과 색으로 사람의 판단을 좋음·나쁨으로 암시
- AI 요약을 sealed 원문 대신 정본처럼 표시
- conflict를 latest timestamp로 조용히 덮기

헌법 준수는 긴 폼을 뜻하지 않는다.

```text
AI: “이 문장을 판단으로 남길까요?”
사용자: “남겨. 다음 달 1일에 다시 보자.”
시스템: statement + review question + 귀환일 + 출처를 한 화면에 표시
사용자: 확인
→ 한 번의 명시적 확인, 여러 semantic event의 atomic batch
```

사용자 표면 어휘의 SSOT는 `DESIGN-judgment-record-system-2026-07-14.md`의 glossary다. semantic package의 타입명과 사용자 카피를 억지로 같게 만들지 않는다.

---

## 14. 규범 실례 — 한 판단의 전 생애

이 스레드는 P1 corpus의 첫 fixture다. 숫자와 날짜도 의미 검증의 일부다.

```text
[e1] proposal_created                                  2026-07-14 18:02
     originated_by: ai(run r-7)
     recorded_by: mcp
     provenance: user quote
       “전환율이 아직 약해서 9월 전에는 가격을 유지하는 편이 낫겠어.”
     → AI가 구조화한 proposal일 뿐, judgment 아님

[e2] SealJudgment command                              2026-07-14 18:04
     사용자:
       “판단으로 남겨. 9월 1일까지 기존 가격을 유지한다.
        전제는 ‘신규 전환율이 3% 아래다’.
        9월 1일에 ‘3.2% 이상이 2주 연속 유지됐는가’를 보자.”

     시스템이 statement·premise·review question·귀환일·출처를 표시
     사용자: “확인.”

     → atomic batch:
       judgment_sealed
         statement: “2026-09-01까지 기존 가격을 유지한다”
         originated_by: human
         recorded_by: mcp
         authorized_by: human (explicit_confirmation)
         temporal_mode: contemporaneous

       premise_adopted
         text: “신규 전환율이 3% 아래다”
         originated_by: human

       return_promised
         review_at: 2026-09-01
         review_question: “신규 전환율이 3.2% 이상으로 2주 연속 유지됐는가?”
         resolution_criterion: “완결된 주간 코호트 두 개가 각각 3.2% 이상”

[e3] observation_recorded                              2026-08-26
     observed_by: host
     assertion: “8월 셋째 주 신규 전환율 3.4%”
     provenance: analytics dashboard report
     → 한 주뿐이므로 criterion을 아직 답하지 못함
     → judgment·resolution·closure를 자동 생성하지 않음
     → as_of(2026-07-14)에는 나타나지 않음

[e4] return_deferred                                   2026-09-01
     사용자: “완결된 두 번째 주가 아직 없어. 9월 15일에 다시 보자.”
     authorized_by: human (direct_command)
     new_review_at: 2026-09-15
     → still_pending은 resolved 통계에 포함되지 않음

[e5] CloseJudgment command                             2026-09-15
     관찰:
       “8월 마지막 주 3.3%, 9월 첫째 주 3.4%”
       “기존 가격은 9월 1일까지 유지됨”
     사용자:
       “두 주 모두 3.2%를 넘었어. 조건은 충족됐다고 닫아줘.”

     시스템이 observation·answer·criterion result·근거를 표시
     사용자: “확인.”

     → atomic batch:
       observation_recorded × 2
       resolution_asserted
         subject_ref: active return contract
         kind: answered
         answer_summary: “완결된 두 주가 각각 3.2% 이상이었다”
         criterion_result: met
         evidence_refs: 위 두 주간 관찰
       judgment_closed
         resolution_ref: 위 resolution
         authorized_by: human (explicit_confirmation)

[e6] proposal_created                                  2026-09-15
     text: “가격을 5% 인상한다”
     relation proposal: depends_on(e2 judgment)
     → 과거 판단의 resolution이 아님
     → 사용자가 채택하면 별도의 새 Judgment가 됨
```

이 스레드는 다음을 동시에 증명한다.

- AI proposal과 사용자 seal의 분리
- direct content와 explicit confirmation의 승인 근거
- Judgment statement와 Return Contract review question의 분리
- 관찰과 자동 판정의 분리
- `as_of` 시간 정직
- defer와 terminal resolution의 분리
- resolution subject와 evidence의 명시
- 후속 결정을 과거 판단의 결과로 뭉개지 않음

사용자 비용은 원래 대화 속 발화 한 번, 실질 기록 지시 세 번, 명시적 확인 두 번이다. P5에서 이 비용이 재구성 이득에 비해 허용 가능한지 실제로 측정한다.

---

## 15. 완료의 정의

문서가 최종이라는 것은 설계가 더는 배울 수 없다는 뜻이 아니다. 다음 변경 규율을 받아들였다는 뜻이다.

- 철학적 문장 때문에 실행 의미를 흐리지 않는다.
- 새로운 사례 하나 때문에 객체와 헌법을 즉시 늘리지 않는다.
- 의미 변경은 ADR, fixture, migration impact를 함께 남긴다.
- 구현이 문서와 다르면 기존 코드가 아니라 헌법·fixture·현실 증거를 함께 놓고 판정한다.
- 제품 표면은 커널을 설명하는 데 그치지 않고 동일한 reducer와 권한 규칙을 실제로 사용한다.

최종적으로 성공했다는 것은 사용자가 더 많은 판단을 기록했다는 뜻이 아니다.

> 시간이 지나고 모델과 표면이 바뀌어도, 사용자는 당시 자신이 무엇을 승인했고 승인하지 않았는지, 무엇을 근거로 삼았고 무엇은 나중에 알게 되었는지, 왜 돌아왔고 어떤 관찰을 근거로 어떻게 닫았는지를 기계의 창작 없이 재구성할 수 있다.

판단 원장의 핵심은 많이 아는 것이 아니다.

> **누가, 언제, 무엇을 자신의 판단으로 남겼는지를 끝까지 배신하지 않는 것.**
