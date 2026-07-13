# ARGUS DECISION KNOWLEDGE KERNEL v5

## 판단 원장 — 헌법·의미론·증명·공정의 통합 정본 후보

Date: 2026-07-14<br>
Status: **설계 정본 후보 (최종본 지향) · 구현 전 · 창업자 서명 대기 (§15)**<br>
Supersedes: v0 · v2 · v3 · v4 (구현 권위로서. 넷은 연구 기록으로 보존)<br>
Self-containment: 이 문서만 읽고 P0에 진입할 수 있어야 한다. 앞 버전 참조는
계보 확인용이지 규범 보충용이 아니다.

### 계보 — 각 버전에서 무엇을 가져왔는가

| 버전 | 기여 (v5에 계승된 것) | v5가 기각한 것 |
|---|---|---|
| v0 (codex) | 선행 체계 조사, conformance 정신, kill criteria 문화 | 노드 9종 온톨로지, greenfield K-공정 |
| v2 | 코드베이스 실측 감사, 의미/인코딩 분리, 시간상자·kill 규율 | "승격" 시공 철학 (존재≠정당성) |
| v3 | 세계관 층: 기록 행위 원칙, 세 부정문, 흡수 밸브, 존재 이유표 규율, 소감 아닌 기계 증명 | "커밋의 대수" 명명 (연산 법칙 미증명), mu에 유예를 뭉갬 |
| v4 (codex) | authority/provenance 분리, 실행/승인 분리, 복수 종결 분류, 이시간(bi-temporal) 정직, atomic batch, 비용 포함 델타, 공간·파기 운영화, 표면 최소 규칙 | 96단어 정체성 문장, 21조 헌법 인플레이션, 시간상자·예산 규칙 삭제, 실례 부재 |

### v5의 편집 판정 (요지)

v4는 정밀한 사양이지만 세 가지를 잃었다: 기억 가능한 정체성, 헌법의 위계,
공정의 규율. v5는 v4의 의미론적 정밀도를 전부 보존하면서 — (a) 정체성을
전문(preamble)과 조문으로 분리하고, (b) 21개 조항을 3장 14조로 재편하며
(내용 무손실 — §8 대응표), (c) 시간상자와 예산 규칙을 복원하고, (d) 전
버전에 없던 실례 스레드(§14)를 추가한다. 그리고 헌법 인플레이션 방지 규칙을
신설한다: **새 조(條)의 추가는 권력 배치가 바뀔 때만 허용되고, 그 외의 새
규칙은 기존 조 아래 파생 규칙으로 편입한다** (§8.0).

---

## 0. 열두 결정 (v4 계승 + 두 개 수정)

이 문서는 다음을 고정한다. 충돌하는 구현은 기존 코드 여부와 무관하게 고친다.

1. Argus의 커널은 메모리도 개인 온톨로지도 아닌 **판단 원장**이다.
2. 원장의 정본은 마음의 상태가 아니라 **시간이 찍힌 기록 행위**다.
3. 권한 구조는 **서기(AI)·저자(사람)·외부 세계**의 분리이며, 각 주체는
   하나의 권한을 구조적으로 부정당한다 (§1.1 세 부정문).
4. AI는 제안·기록·(사람이 명령한) 실행을 할 수 있으나 승인자가 될 수 없다.
5. 현실은 출처 붙은 관찰 주장과 사람의 해석을 통해서만 원장에 들어온다.
6. 원장 항목은 제안·주장·저자 행위·시스템 행위의 네 층으로 구분된다.
7. `still_pending`은 종결이 아니라 유예다. 판정 불가 계열의 종결은
   `indeterminate`(끝내 알 수 없음)와 `moot`(질문 소멸)뿐이다.
8. 판단의 질은 채점하지 않되, 구조적 무결성(빈 기록·권한 부재·시간 모순)은
   강제한다.
9. 헌법이 이유와 금지를, 의미 모델이 상태와 전이를, 어댑터가 저장 형식을
   소유한다.
10. 기존 v2 구현은 자동 승격도 전면 폐기도 없이 `inherit/reforge/reject`로
    판정한다.
11. 독창성 주장은 가설이며 §11이 판정한다 — 가설의 내용은 §3.
12. 가치는 정확도와 **사용자 비용을 함께** 잰 재구성 델타로 증명하고,
    실패하면 주장을 축소하거나 중단한다.

수정 두 가지 (v4 대비): 결정 3에 세 부정문을 복원했고, 공정 규율(시간상자 +
"커널 공정은 퍼널 수리에 양보한다")을 결정 목록 바깥이 아니라 §12의 구속
규칙으로 되살렸다.

---

## 1. 정체성

### 1.1 전문 — 기억되는 형태

> **Argus는 사람이 AI와 생각하는 동안 내린 판단을, 그 판단이 기댄 전제·저자·
> 시점·귀환 약속과 한 몸으로 봉인하고, 이후의 관찰·해석·종결을 분리해 남겨,
> 어떤 표면에서도 "누가 언제 무엇을 승인했는가"를 기계의 창작 없이 재구성할
> 수 있게 하는 판단 원장이다.**

이 문장이 성립하는 이유는 세 부정문이다:

```text
서기 (AI)     모든 것을 받아 적고, 사람의 명령을 실행할 수 있으나,
              어떤 저자 행위도 스스로 승인할 수 없다.
저자 (사람)   봉인·채택·귀환 약속·종결의 전권을 가지나,
              자신을 채점할 수 없다 (체계에 평결 어휘가 없다).
세계 (현실)   유일하게 옳고 그름을 답하나, 스스로 기록하지 못한다
              (관찰은 언제나 출처를 단 주장으로만 입장한다).
```

한 호흡 판: **생각이 AI와의 대화가 된 시대에, 내가 무엇을 믿고 결정했는지를
기계가 위조할 수 없게 남기고, 현실이 답할 날을 약속하는 원장.**

### 1.2 사용자가 얻는 것

정답이 아니라, 다음 질문에 대한 정직한 답이다: 나는 당시 무엇을 판단했나 /
무엇에 기대고 있었나 / 무엇이 내 말이고 무엇이 AI의 제안이었나 / 그때 무엇을
몰랐나 / 언제 다시 보기로 했나 / 이후 무엇을 관찰했나 / 나는 그것을 근거로
어떻게 닫았나 / 아직 답이 없는가, 질문 자체가 사라졌는가.

이 재구성이 가능하면 기억은 판단을 사후 편집하기 어려워진다. 불가능하면 AI가
빈칸을 유창하게 메우고, 사용자는 자기 판단의 저자성을 잃는다.

### 1.3 충성의 대상과 비목표

충성 대상은 하나다: **사람이 자신의 판단 기록을 소유하고, 나중에도 그 판단의
저자와 당시 맥락을 구별할 수 있는 능력.** 모델의 기억 지속성, 조직의 운영
효율, 완전한 지식 그래프, 판단 점수 향상, 모든 사건의 완벽한 포착은 충성
대상이 아니다.

커널이 하지 않는 것: 마음·확신·무의식의 실체를 정본화하지 않는다 / 사람을
점수·등급·티어로 평가하지 않는다 / AI 추론을 자동 채택하지 않는다 / 관찰을
사실로 승격하지 않는다 / 모든 대화를 판단으로 수확하지 않는다 / DMN식 규칙
실행 엔진이 되지 않는다 / Palantir식 세계 운영 모델이 되지 않는다.

---

## 2. 왜 지금인가 — AI는 병이자 약이다

**병.** AI는 말하지 않은 이유를 그럴듯하게 보충하고, 현재의 결과를 과거의
판단에 섞고, 여러 세션의 발화를 하나의 일관된 입장처럼 합성하고, 자기 제안을
사용자의 결론처럼 재진술한다. hallucination만의 문제가 아니다 — 사실 문장이
전부 맞아도 **누가 언제 무엇을 승인했는가**가 사라지면 저자성은 훼손된다.

**약.** 같은 기술이 판단 기록의 오랜 실패 원인인 구조화 비용을 무너뜨렸다.
구조화된 판단 기록의 가치는 늘 알려져 있었다 — 과학은 사전등록으로, 시장은
정산으로, 법정은 조서로 증명했다. 개인에게 없었던 것은 가치가 아니라 지불
가능성이다 (창업자 확정: "귀찮아서 절대 안 함"). AI가 대화에서 판단 후보를
발견하고, 전제와 검토일 초안을 만들고, 과거 기록을 출처와 함께 회수한다.

**AI-native의 정확한 뜻**: AI가 더 많은 권한을 갖는 것이 아니라 — **AI가
구조화 비용을 대부분 부담하면서 저자 권한은 0으로 유지되는 구조.** 병과 약이
같은 기술이라는 사실이 이 제품의 시대 좌표이고, 권한 0이 이 제품의 척추다.

---

## 3. 독창성의 정확한 위치 — 빈칸 논증과 그 가설화

부품은 발명하지 않았고 목록으로 밝힌다: append-only 원장은 회계·event
sourcing에서, 사전 커밋과 시간 오염 방지는 preregistration에서, provenance는
W3C PROV-O에서, 객체·행동·권한의 삼위는 Palantir Ontology에서, 판정 불가와
annulment는 예측 시장에서, 결정·이유·검토일 서식은 기존 decision journal에서.
직접 인접 제품도 있다: Decision Journal, DecisionLedger, Reckon, Lound.

발명의 위치는 부품이 아니라 **분립**이다 — 민주주의가 법원·선거·군대를 발명한
것이 아니라 그 셋의 분립을 발명했듯이, Argus의 발명 주장은 §1.1의 세 부정문을
프롬프트가 아니라 스키마와 reducer로 집행한다는 것이다. 권력 배치 축으로 줄
세우면 빈칸이 보인다:

| 체계 | 정본 | 심판 | 사람의 지위 | 시간 축 |
|---|---|---|---|---|
| Palantir Ontology | 조직의 운영 세계 | 조직의 행동 결과 | 운영자 | 현재 상태 |
| PROV-O | 산출물의 계보 | 없음 | agent의 한 종류 | 생성 시점 |
| 예측 시장 | 군중의 예측 | 현실 (운영자 판정) | **점수화되는** 예측자 | resolution |
| decision journal 앱들 | 개인의 결정 메모 | 자기 회고 | 필자 | 검토일 |
| agent memory (MemGPT류) | AI의 작업 기억 | 없음 | 컨텍스트 공급자 | 세션 |
| **Argus** | **개인의 판단 기록 행위** | **현실 (사람이 종결)** | **주권자 — 점수 없음** | **봉인→귀환→종결, 이시간** |

인접 저널 앱들과의 차이를 정확히: 그들은 서식(결정·이유·검토일)을 제공하지만,
**AI가 개입하는 전 표면에서 제안/채택 분리·실행/승인 분리·당시 기록/사후 관찰
분리를 하나의 실행 의미론으로 집행**하지 않는다. 이것이 Argus의 검증 가능한
차별 가설이며 — "세상에 없다"는 단언이 아니라 **가설**이다. §11의 비교 실험이
판정하고, 지면 위 주장은 실험을 이길 수 없다.

한 줄 대비(방어 문답용): Palantir는 조직이 세계에 대해 아는 것을 모델링해
행동하게 하고, Argus는 사람이 행동할 때 믿었던 것을 모델링해 현실이 대답하게
한다. 예측 시장은 누가 옳았는지를 시장에 알려주고, Argus는 내가 무엇을
믿었는지를 미래의 나에게 돌려준다. agent memory는 AI가 잘 행동하기 위한 AI의
기억이고, Argus는 사람이 저자로 남기 위한 사람의 원장이다.

---

## 4. 존재론 — 무엇이 원장에 설 수 있는가

### 4.1 기록 행위 원칙

사람의 마음은 연속적이고 모순되며 관찰 불가능하다. 커널이 저장하는 것은
마음의 진실이 아니라 특정 시점의 기록 행위다 — "사용자가 7월 14일 18:20에 이
문장을 판단으로 승인했다"는 검증 가능하고, "사용자는 사실 그전부터 확신하고
있었다"는 심리 해석이다. 이 치환은 인류가 지저분한 실재 위에 신뢰 체계를 세운
공통 수다: 법정은 진실이 아니라 증언을, 회계는 가치가 아니라 거래를, 과학은
믿음이 아니라 사전등록된 주장을 다룬다. 기록 행위는 이산적이므로(승인했거나
안 했거나) 체계는 어디서도 "얼마나 결정했는지"의 연속량을 재지 않는다.

### 4.2 네 층

| 층 | 의미 | 생성 권한 | 예 |
|---|---|---|---|
| Proposal | 아직 채택되지 않은 구조화 제안 | AI·사람·호스트 | 판단 후보, 전제 후보, 연결 후보 |
| Assertion | 출처를 단 주장 | 누구나 (provenance 필수) | 사용자 발화 인용, 관찰, 문서 주장 |
| Authorial Act | 판단의 의미·생명주기를 바꾸는 승인 행위 | **사람만 승인** | seal, adopt, promise, defer, close |
| System Event | 전달·동기화·집행 상태 | 시스템 | outbox, bridge, gate, sync |

Proposal과 Assertion은 원장에 존재할 수 있지만 사용자 판단이 아니다.
Authorial Act가 붙을 때만 사용자 소유의 의미가 생긴다.

### 4.3 여섯 의미 객체와 두 단면

핵심 의미 객체는 여섯이고, provenance와 시간은 객체가 아니라 모든 객체에
붙는 **단면(facet)**이다 (v4가 provenance를 일곱 번째 객체로 둔 것은 분류
착오 — 출처는 사물이 아니라 사물의 속성이다).

| 객체 | 무엇의 추상인가 | 의도적으로 버리는 것 | 버림의 근거 |
|---|---|---|---|
| **Judgment** | 검증을 걸겠다는 승인의 문장화 (`statement`, `sealed_at`, …) | 확신의 정도 (숫자) | 확신 숫자는 자기 채점의 씨앗이자 거짓 정밀도 |
| **Premise** | 판단이 기댄다고 사용자가 채택한 주장 | 암묵·감정·무의식의 전제 | 끌어내면 숙제(over-fire), 지어내면 세탁 |
| **Return Contract** | 재대면 약속 (`review_at`/trigger, `review_question`, 선택적 `resolution_criterion`) | 상시 감시·연속 추적 | 상시 감시는 불안 엔진이고 비용 전가다 |
| **Observation** | 외부 세계에 관한 출처 있는 주장 | "사실" 지위 (무검증) | 현실은 스스로 기록하지 못한다 — 관찰자와 방법이 곧 의미 |
| **Resolution Assertion** | 관찰이 판단에 갖는 의미에 대한 사람의 해석 | 자동 판정 | 기계 판정 = 기계 평결 (분립 붕괴) |
| **Closure** | 종결의 저자 행위 (해석·근거 관찰·시점 연결) | 점수화 | 점수는 기록 회피를 낳고 기록 회피는 원장을 죽인다 |

규율 (v3 계승): 새 객체의 추가는 이 표의 네 열을 전부 채울 수 있을 때만
허용된다. "버리는 것"과 "버림의 근거"를 채우지 못하는 타입은 추상이 아니라
축적이다.

객체 사이의 핵심 구분 두 가지:

- `Judgment.statement`(무엇을 판단·선택·약속했는가)와 `review_question`
  (돌아와 무엇을 물을 것인가)은 다른 필드다. "A를 채용하기로 했다"와 "90일 뒤
  역할 기대를 충족했는가"를 한 필드에 섞지 않는다.
- Return Contract가 없는 항목은 sealed judgment가 아니라 후보·메모·작업물이다.
  이것은 기록 실패가 아니라 제안과 커밋의 경계다 — 기록은 언제나 가능하고
  (기록과 의식의 분리), 봉인만 재대면 의지를 요구한다.

### 4.4 연결

판단은 독립적으로 먼저 서고, `supports / contradicts / depends_on /
supersedes / same_question` 연결은 이후에 제안될 수 있다. AI가 만든 연결은
proposal이고, 의미를 바꾸는 연결은 사용자 채택이 필요하며, 검색용 유사도
연결은 파생 데이터다. 입력 시 완벽한 분해를 강요하지 않는다.

---

## 5. 권한과 시간

### 5.1 Authority Context — 네 역할

한 이벤트에 actor는 하나가 아니다. 네 역할을 분리한다:

```ts
type AuthorityContext = {
  originated_by: PrincipalRef;   // 내용을 처음 만든 주체 (human | ai | host | imported)
  recorded_by: PrincipalRef;     // 원장에 쓴 주체 (mcp | web | telegram | plugin | migration)
  observed_by?: PrincipalRef;    // 관찰의 수행·보고 주체
  authorized_by?: HumanPrincipalRef;  // 저자 행위의 승인자 — 사람만
  authorization_mode?: 'direct_command' | 'explicit_confirmation' | 'signed_import';
  authorization_ref?: EvidencePointer; // 승인 근거 (사용자의 말)
};
```

**출처와 권한은 다른 사실이다**: "사용자 대화에서 나왔다"(provenance)와
"사용자가 이 행위를 승인했다"(authority)를 한 필드에 섞지 않는다.

### 5.2 실행과 승인의 분리

"AI는 종결할 수 없다"는 API를 호출할 수 없다는 뜻이 아니다.

```text
사용자: "이 판단은 질문 자체가 사라졌어. moot로 닫아줘."
→ judgment_closed: originated_by=human, recorded_by=mcp,
  authorized_by=human (direct_command, 근거=사용자 발화 포인터)     ← 합법
AI가 대화를 보고 "아마 moot일 것"이라며 종결
→ authorized_by 없음                                              ← 거절
```

AI가 할 수 있는 것: 후보 제안, 발화 인용 assertion, statement·전제·검토일
초안, 사용자 직접 명령의 실행, 관찰·연결 후보 제안, 정본 데이터의 결정론적
요약. AI가 할 수 없는 것: 무승인 봉인, AI 추론의 전제 자동 채택, 침묵의 승인
간주, 모호한 승인 대상의 임의 선택, 관찰만으로 종결 생성, 사람에 대한 평결.

침묵과 일괄 승인: 침묵은 승인도 거절도 아니다. "전부 저장해"는 대상 목록이
표시·고정된 뒤에만 유효하고, 목록이 바뀌면 새 승인이 필요하다. 승인자가 증명
안 되는 legacy 이벤트는 `authority_status: legacy_unknown`으로 하향 표시하며
소급 세탁하지 않는다.

### 5.3 이시간(bi-temporal) 정직

```ts
type TemporalContext = {
  occurred_at?: string;   // 주체가 주장하는 사건·판단 시점
  recorded_at: string;    // 원장에 처음 기록된 시점
  authorized_at?: string; // 사람이 승인한 시점
  temporal_mode: 'contemporaneous' | 'retrospective';
};
```

회고 진술은 합법이지만 당시 봉인으로 승격되지 않는다. "당시에도 그렇게
믿었다"는 retrospective premise assertion이며 `as_of` projection(당시 기록만
보기)에는 포함되지 않는다. 결과를 안 뒤 추가된 정보는 과거 판단의 입력으로
되돌아가지 않는다. 시간적 정직성이란 심리 시점을 맞히는 것이 아니라 **원장이
실제로 알게 된 시점을 숨기지 않는 것**이다.

---

## 6. 이벤트 문법과 상태 의미론

(v3의 "커밋의 대수"라는 이름은 연산 법칙이 증명되지 않았으므로 쓰지 않는다 —
v4의 판정 수용. 이것은 문법과 결정론적 상태 기계다.)

### 6.1 이벤트 계열

```text
Proposal   proposal_created · proposal_revised · proposal_rejected · proposal_expired
Assertion  assertion_recorded · observation_recorded · evidence_attached · assertion_corrected
Authorial  judgment_sealed · premise_adopted · premise_retired
           return_promised · return_deferred · return_contract_superseded
           resolution_asserted · judgment_closed · judgment_withdrawn · judgment_superseded
System     delivery · sync · bridge · outbox · gate telemetry (사용자 의미 상태 불변)
```

채택은 proposal을 변이시키지 않는다 — `judgment_sealed.source_proposal_id`
참조로 adopted 상태가 파생된다 (원본 보존). 수정은 덮지 않고 정정 관계를 새
이벤트로 만든다.

### 6.2 한 command, 여러 event, 한 번의 확인

```text
SealJudgment command ("이 판단을 이 전제와 함께 봉인하고 9월 1일에 보자")
  -> assertion_recorded (필요시)
  -> judgment_sealed
  -> premise_adopted
  -> return_promised          ← 하나의 atomic batch, 사용자 확인은 한 번

CloseJudgment command
  -> observation_recorded (새 관찰이 있는 경우)
  -> resolution_asserted
  -> judgment_closed
```

의미를 분리한다는 것이 사용자에게 네 번 확인받으라는 뜻이 아니다. replay와
감사에서 구분되면 된다.

### 6.3 판단 상태와 종결 분류

```text
SEALED --(return due)--> DUE/OVERDUE --(defer)--> SEALED
SEALED --(close)-----> RESOLVED
SEALED --(withdraw)--> WITHDRAWN     · 저자가 판단을 더는 유지하지 않음 (실패 아님)
SEALED --(supersede)-> SUPERSEDED    · 새 판단이 대체
```

`DUE/OVERDUE`는 저장 status가 아니라 return contract와 기준 시각에서 파생된다.

```ts
type Resolution =
  | { kind: 'answered'; outcome: 'held' | 'avoided' | 'missed' | 'partial' }
  | { kind: 'indeterminate'; reason?: string }   // 끝내 증거로 답할 수 없음
  | { kind: 'moot'; reason?: string };           // 질문 자체가 의미를 잃음
// still_pending은 Resolution이 아니다 — return_deferred다.
```

### 6.4 amendment 규칙

봉인 이후 원문은 덮지 않는다: 오탈자·표시 메타데이터는 correction event /
전제 추가·폐기는 premise lifecycle / 날짜만 변경은 `return_deferred` /
review question·criterion의 의미 변경은 기존 contract를 supersede하고 새
contract / 판단문의 의미 변경은 기존 판단을 supersede하고 새 seal / **결과를
안 뒤 과거 statement·question·criterion 변경은 금지.** 같은 ID를 유지한 채
사실상 다른 판단으로 바꾸는 사후 오염을 이 규칙이 막는다.

### 6.5 결정론적 fold와 충돌

동일한 유효 이벤트 집합과 정렬 규칙은 모든 표면에서 동일한 상태를 만든다.
정렬: space 내 monotonic sequence → causal parent와 batch order →
occurred_at + event_id (최후 fallback). 해소 불가능한 동시 저자 행위는
timestamp로 조용히 덮지 않고 conflict state로 노출해 사람에게 돌린다.

---

## 7. 지저분한 현실의 네 밸브

체계의 가치는 깨끗한 사례가 아니라 지저분한 사례에서 판정된다. 지저분함이
체계로 들어오는 문은 넷이고, 넷 다 근거가 있다.

1. **모호성의 가격제** — 모호한 판단문·검토 질문도 봉인할 수 있다. 커널이
   요구하는 것은 품질이 아니라 구조적 무결성뿐이다(비어 있지 않은 판단문,
   사람의 승인, 봉인 시점, provenance, 귀환 시점 또는 trigger). 모호함의
   비용은 금지·경고가 아니라 정산일의 현실이 청구한다 — "판정할 수 없음"을
   스스로 겪는 경험이 잔소리보다 정확하게 다음 술어를 벼린다. 남은 모호함은
   `specification_status: open` 같은 중립 파생으로만 표시한다 (`bad/weak/
   low-quality` 금지).
2. **복수의 정직한 종결** — answered(held/avoided/missed/partial),
   indeterminate, moot는 전부 정식 결과다. Yes/No 강박은 채점 가능한 사소한
   결정만 기록하게 만들어 원장을 왜곡한다. 단, "아직 모름"은 유예(defer)이고
   "끝내 알 수 없음"만 indeterminate다.
3. **침묵의 합법성** — 말하지 않은 이유를 채우지 않고, 판단 없는 관찰을
   판단으로 승격하지 않고, 포착 안 된 사건을 꾸짖지 않는다. 공백은 오류가
   아니라 provenance의 경계다.
4. **연결의 후행성** — §4.4. 입력 시 완벽한 분해와 연결을 강요하지 않는다.

이 밸브들이 없으면 체계는 둘 중 하나로 죽는다: 깨끗한 사례만 담는 장난감
(밸브 없음), 아무거나 담는 잡동사니 (경계 없음).

---

## 8. 헌법 — 전문과 3장 14조

### 8.0 인플레이션 방지 규칙

헌법은 v0의 12조에서 v4의 21조까지 라운드마다 불었다. 조항이 늘수록 조항의
무게는 준다. v5의 재편은 내용 무손실이며(각 조에 흡수한 v4 조항을 표기),
이후의 규칙은 다음을 따른다: **새 조의 신설은 권력 배치(누가 무엇을 할 수
있는가)가 바뀔 때만. 그 외의 새 규칙은 기존 조의 파생 규칙으로 편입한다.**

집행 규율 (전 버전 계승): 채택 시 각 조는 같은 구현 phase에서 최소 하나의
집행 지점(schema refine / reducer guard / betrayal fixture)과 연결된다.
집행 지점 없는 조항은 소망이다.

### 전문

§1.1의 두 문장과 세 부정문이 이 헌법의 전문이다.

### 제1장 권력 — 누가 무엇을 할 수 있는가

- **제1조 인간 주권** (v4 C1+C18): 저자 행위는 사람의 승인 없이 성립하지
  않는다. 실행과 승인은 분리된다 — 사람이 명령한 행위를 AI가 기록하는 것은
  합법이고, 승인 없는 terminal은 거절된다. 관찰은 자동으로 종결이 되지
  않는다. *집행: authority refine + no-auto-resolve guard.*
- **제2조 저자성 세탁 금지** (v4 C2+C17): 출처는 하향만 허용된다. 출처
  (provenance)와 권한(authority)은 별도 필드로 보존된다. 침묵은 승인이
  아니다. legacy 불명 권한은 소급 세탁되지 않는다. *집행: downgrade property
  test + authority matrix tests.*
- **제3조 세계는 주장으로** (v4 C3): 외부 세계는 출처 있는 주장으로만
  들어온다. AI가 여러 번 동의해도 사실로 승격되지 않는다. *집행: assertion
  schema.*
- **제4조 사람에 대한 평결 금지** (v4 C6+C20): 판단 능력·사람됨을 점수·등급·
  티어로 표현하지 않고, outcome으로 사람을 줄 세우지 않고, 숨은 calibration
  점수로 노출·권한을 차등하지 않는다. 시스템 품질 측정(재구성 정확도,
  provenance 누락률, 전달률, 중립 개수·기간·분포)은 허용하되 개인 평결로
  전용하지 않으며, 정본과 분리된 파생물로 둔다. *집행: forbidden vocabulary
  fixture + metric allow/deny list.*

### 제2장 시간과 기록 — 무엇이 남고 어떻게 변하는가

- **제5조 덮어쓰기 금지** (v4 C4): 과거 의미를 덮지 않고 정정·폐기·승격을 새
  이벤트로 남긴다. §6.4 amendment 규칙이 이 조의 파생 규칙이다. *집행:
  reducer immutability.*
- **제6조 이시간의 정직** (v4 C21): 주장된 사건 시점과 실제 기록·승인 시점을
  섞지 않는다. 회고는 회고로 남고 `as_of`는 당시 기록만 본다. *집행:
  retrospective/as-of fixtures.*
- **제7조 귀환은 의미다** (v4 C5): 반환 약속은 알림 설정이 아니라 판단 의미의
  일부다. 채널 전달 실패는 delivery state이지 decision state가 아니다.
  *집행: return event + due fold.*
- **제8조 복수의 정직한 종결** (v4 C15): answered·indeterminate·moot를
  구분하고, defer를 종결로 위장하지 않는다. *집행: state transition
  fixtures.*
- **제9조 결정론적 등뼈** (v4 C8+C19): 같은 유효 이벤트는 표면과 모델에
  관계없이 같은 상태를 만들고, 모든 표면은 동일 전이·권한 규칙을 쓴다. 충돌은
  사람에게 노출된다. *집행: cross-surface conformance vectors.*

### 제3장 소유와 경계 — 원장은 누구의 것인가

- **제10조 최소 구조** (v4 C7): 재구성과 권한 집행에 필요한 최소 구조만
  강제하며, 이 규율은 온톨로지 자신에도 적용된다 (§4.3 네 열 규율). *집행:
  optionality tests.*
- **제11조 소유와 파기** (v4 C9+C13): 사용자는 원장을 읽고 내보내고 지울 수
  있다. append-only는 영구 감금이 아니다 — 파기는 논리 삭제(즉시 제외 +
  deletion receipt)와 물리 파기(원장·복제본·색인·캐시·백업)의 2단계로
  집행되며, receipt에 대상 범위·완료 위치·유예 백업·실패 위치가 남는다
  (삭제된 본문은 receipt에 복제하지 않는다). *집행: export/erasure fixture +
  purge contract.*
- **제12조 독립과 이식** (v4 C10+C16): 어떤 모델·인코딩·벤더도 의미의 정본이
  아니다. 의미 모델과 wire/storage 형식은 분리되고, 모델 교체는 승인된 의미를
  바꾸지 못한다. *집행: model-free reducer + adapter round-trip.*
- **제13조 기계의 정직** (v4 C11+C12): 모르는 출처·이유·관찰을 만들어 채우지
  않고, 모든 회수에는 기준 시점과 회수 이유가 붙는다. *집행: missing-data
  fixtures + retrieval receipt.*
- **제14조 집행 장소** (v4 C14): 커널은 라이브러리다. 규칙은 write gateway와
  conformance suite에서 집행되며, 중앙 authority 서버는 세우지 않는다.
  보증의 범위는 "우리 코드의 관문을 지나는 모든 쓰기"이고, 사용자 자신의 파일
  직접 편집은 위협이 아니라 권리다 — 이 한계를 숨기지 않는다. *집행: gateway
  coverage map.*

(대응 확인: v4 C1–C21 전부가 위 14조에 흡수되었다. C17→제2조, C18→제1조,
C19→제9조, C20→제4조, C21→제6조.)

---

## 9. 세 종류의 정본과 공간

### 9.1 정본의 분담

| 정본 | 소유하는 것 | 형태 |
|---|---|---|
| Normative SSOT | 왜·금지·권리 (헌법) | 이 문서 + ADR |
| Semantic SSOT | 타입·전이·불변식·fold | versioned package |
| Instance SSOT | 실제 사용자 이벤트 | space별 canonical ledger |

semantic package가 제공하는 것: canonical event types, command/authority
validation, deterministic reducer, temporal projections, conformance
vectors, legacy adapters, export/erasure contract, schema version registry.
웹·MCP·Telegram·plugin은 자체 판단 상태 기계를 만들지 않는다 — 같은 패키지를
쓰거나 같은 conformance vectors를 통과한 구현을 쓴다.

### 9.2 버전과 legacy

새 기록은 current semantic version으로 쓰고, 과거 인코딩은 adapter로 읽는다.
upcast는 원본을 덮지 않고, 복원 불가 필드는 `unknown` 또는 explicit loss로
남기며, unknown extension은 보존하고, downcast 손실은 loss report로 반환한다.
round-trip과 replay equivalence를 테스트한다.

### 9.3 공간과 복제

local-first는 "모든 복사본이 정본"이 아니다. space마다 canonical ledger
위치, replica/projection 목록, write authority, sync ordering, conflict
policy, export 경계, erasure 전파, backup 보존을 명시한다.

| 표면 | 역할 | 정본 여부 |
|---|---|---|
| repository JSONL | repository space canonical ledger | 예 |
| web local cache | projection/replica | 아니오 |
| Supabase | account space canonical 또는 replica | 배포 설정에 명시 |
| Telegram message | capture source | 아니오 |
| MCP response | command receipt/projection | 아니오 |

canonical 위치는 설정마다 다를 수 있으나 한 space 안에서 모호하면 안 된다.

---

## 10. 현행 v2 구현의 재료 판정

원칙 (v3·v4 합의): 자동 승격도 전면 폐기도 없다. 아래는 P3에서 확정될 판정의
초안이며, "계승이 근거 없이 100%면 심판이 아니라 도장이다"가 검수 기준이다.

**Inherit** — append-only JSONL ledger, strict parsing과 schema version,
deterministic reducer 골격, idempotency·atomic append, candidate proposal
plane, evidence pointer(byte+sha256+등급), outbox·bridge·gate telemetry,
still_pending 비종결 처리, silent auto-seal 방지 확인 흐름.

**Reforge** — envelope의 단일 actor → AuthorityContext / provenance enum →
출처·수집 방법·권한의 축 분리 / `seal` → statement·return contract·premise의
분리된 의미 이벤트(atomic batch) / settlement → observation·resolution·
closure 분리 / `amend` → correction·premise lifecycle·defer·supersede 분해 /
outcome 어휘 → answered·indeterminate·moot+defer 재매핑 / space 소유권과
sync contract / 웹 localStorage·Supabase 상태 모델 → shared reducer
projection.

**Reject** — AI 추론의 전제 자동 승격, 결과 인지 후 과거 statement·question·
criterion 수정, still_pending의 terminal 처리, 금지어 검사만으로 헌법 집행
간주, 표면별 독자 의미 모델, legacy 불명 권한의 소급 승인, 판단 점수·티어
저장.

**Legacy mapping** — v2의 24개 이벤트를 기계적 1:1로 매핑하지 않는다. 각
이벤트가 실제로 만든 의미 변화를 판정한 뒤 exact / split(하나가 여러 의미
이벤트로) / degraded(일부 복원+unknown) / opaque(legacy extension 보존)로
분류하고, 모든 legacy fixture는 구 reducer 결과와 신 projection의 차이를
loss report로 남긴다. 이벤트 이름·기존 파일은 어떤 경우에도 변경하지 않는다
(읽기 전용 legacy encoding — 제12조).

---

## 11. 증명 전략 — 소감이 아니라 기계 증거

### 11.1 불가능성 증명 (11 배신)

각 명제는 산문 방어("우리 표면에선 안 일어나요")가 아니라 adversarial
command와 저장 이벤트를 포함한 executable fixture로 증명한다.

1. AI proposal을 사용자 판단으로 조용히 승격할 수 없다.
2. 결과를 안 뒤 과거 sealed statement를 덮어쓸 수 없다.
3. 승인 근거 없는 AI resolve가 terminal을 만들 수 없다.
4. 관찰 하나가 자동으로 closure가 될 수 없다.
5. 동일 이벤트 replay가 표면마다 다른 상태를 만들 수 없다.
6. still_pending이 resolved 통계에 포함될 수 없다.
7. 오늘의 회고 진술이 과거의 contemporaneous projection에 나타날 수 없다.
8. legacy unknown authority가 human-authorized로 상향될 수 없다.
9. erasure된 본문이 일반 projection에 다시 나타날 수 없다.
10. 사용자가 인용문에 쓴 어휘가 시스템 카피 금지어 검사를 오탐시키지 않는다.
11. 모델 교체가 sealed meaning을 바꿀 수 없다.

### 11.2 지저분함 corpus

13 사례군(회고 봉인 / 반쯤 결정·귀환 거부 / 의도적 모호 / 증거 부족 지속 /
질문 소멸 / 판단 없는 사건 / 사적 침묵 / 관점 변화 / 얽힌 판단들 / AI 초안
부분 채택 / 일괄 승인 / 두 표면 동시 defer·resolve 충돌 / 삭제 후 낡은
replica 귀환)을 사람이 정답 라벨과 함께 만든다. 각 사례에 named/의도적
unnamed/허용 손실/금지 fabrication/기대 projection/사용자 확인 비용을
명시한다. 판정 삼분법 (v3 계승): 무손실 / **명명된 손실**(§4.3 표의 "버리는
것"에 이미 이름이 있음 — 설계의 확인) / **미명명 손실**(버리기로 한 적 없는
것이 표현 불가 — 이것만 설계 결함이며, 표의 네 열 전부를 채우는 개정으로만
수리).

### 11.3 재구성 델타 — 비용 포함

비교군 4: raw transcript 검색 / transcript+RAG+인용 / 일반 decision-journal
템플릿 / Argus 원장. 측정은 정확도와 비용 양면: 판단문 복원, 저자 귀속 오류,
당시·사후 정보 혼입률, premise provenance 복원률, 귀환 약속 복원률, 종결
상태·근거 복원률, fabrication rate **그리고** 입력·확인 시간, 확인 클릭 수,
잘못 봉인한 후보 비율, 놓친 판단 비율. synthetic adversarial corpus와 실제
dogfood corpus를 분리하고, 가능하면 라벨러를 조건 맹검으로 둔다.

이 벤치마크의 두 번째 용도 (v3 계승): 각본과 채점이 공개되고 기계적이면
누구나 같은 결과를 재현한다 — "AI에게 물어본 나의 결정사"가 눈앞에서 틀리는
것을 보는 순간이 어떤 설명보다 강한 체감이며, 시연은 소감이 아니다. 공개
벤치마크로 키울지는 창업자 결정(§15).

### 11.4 사전 선언 go/kill

구현 전에 항목을 고정하고, 수치는 P1에서 corpus를 본 뒤 확정하되 항목은 바꾸지
않는다: 저자 귀속·hindsight leakage의 baseline 대비 최소 개선 / 허용 가능한
추가 확인 시간 / silent false seal 상한 / cross-surface conformance 100% /
legacy critical-path 무손실률 / erasure 전파 성공률.

중단·축소 조건: 구조화 비용을 포함하면 일반 템플릿 대비 재구성 우위가 없다 /
authority 모델이 실제 대화 UX에서 지속 우회된다 / 지저분함 corpus를 과도한
예외 없이 흡수할 수 없다 / 표면마다 semantic fork가 반복된다 / local
ownership과 erasure를 현실 비용으로 지킬 수 없다. **증명은 이겨야 증명이
아니라 질 수 있어야 증명이다.**

---

## 12. 구현 공정 P0–P7

구속 규칙 셋 (v2·v3 복원 — v4가 떨어뜨린 것):

- **시간상자**: 각 phase에 세션 상한을 두고, 상한 2배 초과 시 무조건 중단하고
  남은 것을 BLUEPRINT §8로 되돌린다.
- **예산**: 커널 공정은 퍼널 수리를 이기지 못한다 — 제품 공정과 경합하면
  제품이 이긴다.
- **한 phase에 하나의 비가역적 의미 결정** (v4 계승). exit 증거 없이 다음
  단계 없음.

| Phase | 목표 | 상자 | Exit (요지) |
|---|---|---|---|
| **P0 정본 봉인** | 언어·권한을 흔들리지 않게 | 1 | §15 서명 완료, glossary·authority matrix·resolution taxonomy 확정, 두 사람이 같은 예시를 같은 타입·상태로 분류, 기존 문서 충돌 목록 |
| **P1 corpus와 기준** | 코드 전에 현실을 버리지 않는지 검증 | 2 | messy corpus 30+건 전부 v5 어휘로 표현(예외 코드 0), go/kill 수치 확정, 미명명 손실 0 또는 §4.3 표 개정 |
| **P2 의미 모델 spike** | 문서를 타입·전이·불변식으로 | 3 | 14조 각 최소 1 집행 지점, corpus golden test, 모델·네트워크 없이 replay |
| **P3 자재 판정과 adapter** | 두 번째 시스템 없이 현행 자산 흡수 | 2 | §10 판정표 확정(도장 아님 검수), 실원장 red-team replay, critical path 손실 0 또는 승인된 loss 목록, 기존 파일 무변경 |
| **P4 MCP vertical slice** | 한 표면에서 전 생명주기 증명 | 2 | 공개 도구 회귀 0, silent seal/resolve 0, receipt에 authority·provenance 구분 표시 |
| **P5 웹 수렴** | 웹이 같은 원장의 projection+command 표면이 되게 | 3 | MCP·웹 conformance 100%, 동일 snapshot 상태·카운트 일치, 충돌 무단 덮기 0 |
| **P6 외부 표면** | 새 표면이 의미를 복제하지 않고 준수 | 2 | 표면별 독자 outcome enum 0, 모든 terminal에 승인 증거, import/export loss 명시 |
| **P7 델타 판정** | 존재 가치의 최종 판정 | 2 | §11.3 실험 + 사전 선언 기준 대조 → go / 주장 축소 / 중단 |

미결 질문 (v4 §14 계승 — P2~P5 진입 전 각각 ADR로 닫는다): repository-local
사용자 identity 키 / 직접 명령의 증거 포인터 형식 / 사건 기반 return trigger의
v1 포함 여부 / signed import 신뢰 경계 / Supabase의 canonical·replica 배포별
선언 / backup 물리 삭제 최대 보존 기간 / 개인용 통계의 export·삭제·AI 접근
기본값 / 동시 resolve·defer 충돌 UX.

---

## 13. 표면 최소 규칙 (v4 계승, 압축)

모든 표면이 보여야 하는 것: proposal인지 committed인지 / 정확한 sealed
statement / 누가 만들고 누가 승인했는지 / 봉인 시점과 현재 기준 시점 / 귀환
약속과 due 이유 / 관찰과 종결 해석의 분리 / amendment 이력 / 회수 이유.

모든 표면이 피할 것: "AI가 기억한 당신의 결정"류의 출처·승인 흐리기 / 저장과
승인을 하나의 모호한 버튼으로 합치기 / partial·moot·defer의 "완료" 평탄화 /
결과 색으로 좋음·나쁨 암시 / AI 요약을 원문 대신 정본처럼 / 충돌의 조용한
timestamp 덮기.

UX 목표: 헌법 준수는 긴 폼이 아니다 —

```text
AI: "이 문장을 판단으로 남길까요?"
사용자: "남겨. 다음 달 1일에 보자."
시스템: statement + 귀환일 + 출처를 한 화면에 확인
사용자: 확인            ← 한 번의 명시적 확인, 여러 의미 이벤트의 atomic batch
```

사용자 어휘(판단하기·돌아보기·정산 등)의 정본은
`DESIGN-judgment-record-system-2026-07-14.md`의 glossary가 소유한다 — 여기
복제하지 않는다 (single source).

---

## 14. 실례 스레드 — 한 판단의 전 생애 (규범 예시)

전 버전에 없던 것: 추상이 아니라 실제 이벤트 열로 읽는 한 판단. 이 스레드는
P1 corpus의 1번 fixture이자 문서의 이해 검증용이다.

```text
[e1] proposal_created                               2026-07-14 18:02
     originated_by: ai(run r-7) · recorded_by: mcp
     quote: "8월 전엔 가격을 못 올릴 것 같아. 전환율이 아직 약해."
     (사용자 발화의 byte 증거 포인터 포함 — 화자: user)

[e2] SealJudgment command — 사용자: "이거 판단으로 남겨. 9월 1일에 보자.
     전제는 '전환율이 아직 3%를 못 넘는다'로 고쳐줘."
     → atomic batch (확인 1회):
     judgment_sealed        statement: "8월 전에는 가격을 올리지 않는다"
                            originated_by: human · recorded_by: mcp
                            authorized_by: human (direct_command, 근거=e2 발화)
                            temporal_mode: contemporaneous
     premise_adopted        text: "신규 전환율이 아직 3%를 넘지 못한다"
                            originated_by: human (수정문의 저자)
                            derived_from: e1의 전제 초안 (AI 기여 계보 보존)
     return_promised        review_at: 2026-09-01
                            review_question: "전환율이 3.2%를 넘었는가"

[e3] observation_recorded                           2026-08-05
     observed_by: host · "7월 전환율 3.4% (분석 대시보드 보고)"
     → 판정 아님, 종결 아님 (제1조·제3조). premise drift 후보로만 표면화.
     → as_of(2026-07-14) projection에는 나타나지 않는다 (제6조).

[e4] return_deferred                                2026-09-01
     사용자: "아직. 한 달 지표 더 보고." → review_at: 2026-09-15
     authorized_by: human · still_pending은 종결 통계에 없다 (제8조).

[e5] CloseJudgment command — 사용자: "부분적이었네. 8월엔 안 올렸고,
     9월 초에 5% 올렸어."                            2026-09-15
     → atomic batch:
     observation_recorded   observed_by: human · "9월 초 5% 인상 시행"
     resolution_asserted    kind: answered · outcome: partial
     judgment_closed        references: 위 resolution · authorized_by: human
```

이 다섯 걸음이 문서 전체를 통과한다: 제안→채택의 원본 보존(e1→e2), 실행/승인
분리와 atomic batch(e2), 관찰≠종결과 as_of 정직(e3), 유예≠종결(e4), 관찰·해석·
종결의 분리(e5). 그리고 사용자가 실제로 한 일은 — 말 세 번, 확인 두 번이다.

---

## 15. 창업자 서명 항목

P0 진입에 필요한 결정 다섯. 이 문서의 다른 모든 것은 이 다섯에서 파생된다.

1. **정체성** — §1.1 전문(두 문장 + 세 부정문 + 한 호흡 판)의 승인 또는 수정.
2. **종결 분류** — answered(4종)·indeterminate·moot + defer(비종결)의 확정.
3. **권한 구조** — AuthorityContext 4역할 + authorization_mode 3종의 확정.
4. **공정 편입** — P0–P7의 BLUEPRINT 공정표 내 위치와, "커널은 퍼널 수리에
   양보한다" 예산 규칙의 승인.
5. **델타의 지위** — §11.3 재구성 델타를 내부 회귀 장치로 둘지, 공개
   벤치마크·시연으로 키울지.

---

## 16. 봉인

판단 원장의 핵심은 많이 아는 것이 아니다. **누가, 언제, 무엇을 자신의
판단으로 남겼는지를 끝까지 배신하지 않는 것**이다. 그것을 지키기 위해 이
문서는 세 유혹의 상시 거부를 설계에 박았다: 완전해 보이려고 공백을 AI로
채우는 유혹(제13조), 똑똑해 보이려고 사람을 평가하는 유혹(제4조), 빨리
만들려고 표면마다 의미를 복제하는 유혹(제9조).

그리고 이 문서 자신에게도 같은 규율을 적용한다: 독창성은 가설이고(§3), 가치는
질 수 있는 실험으로만 증명되며(§11.4), 공정은 시간상자 안에서만 달린다(§12).
원장이 사용자를 배신하지 않듯, 설계는 현실을 배신하지 않아야 한다.
