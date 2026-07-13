# ADR — Decision Knowledge Kernel v6 P0 운영 계약

Date: 2026-07-14
Status: **Accepted — v6 구현 공정의 P0 exit evidence**
Decision owner: Decision Knowledge Kernel implementation stream
Normative source: `DESIGN-decision-knowledge-kernel-v6-final-2026-07-14.md`

---

## 결정

Argus는 다음 두 언어를 같은 의미 모델의 서로 다른 층으로 유지한다.

1. 커널은 `Proposal → Judgment → Return Contract → Observation → Resolution Assertion → Closure`를 사용한다.
2. 제품 표면은 사용자의 이해를 위해 `WorkItem → DecisionRecord → Return Promise → 정산`을 사용한다.

둘은 별도의 상태 기계가 아니다. 제품 언어는 커널 이벤트를 읽는 projection이며, 정산은 단순 결과 텍스트가 아니라 **사람이 Resolution Assertion을 채택하는 Closure**다.

이 ADR은 v6 P0의 네 산출물을 고정한다.

- 사용자 glossary와 한·영 기본 용어
- Authority Matrix와 승인 근거 규칙
- Resolution taxonomy와 product settlement mapping
- 기존 BLUEPRINT, 제품 설계, v2 구현과의 충돌·이행 계약

---

## 1. 사용자 용어와 커널 용어

### 1.1 기본 glossary

| 커널 | 사용자 한국어 | 사용자 영어 | 정의 |
|---|---|---|---|
| Proposal | 이어서 하기 | Continue | AI·사람·호스트가 만든 미채택 구조화 후보 |
| Assertion | 근거 기록 | Evidence note | 출처를 단 발화·관찰·문서 주장 |
| Judgment | 판단 기록 | Decision record | 사람이 명시적으로 봉인한 판단·선택·약속 |
| Premise | 전제 | Premise | 판단이 기댄다고 사람이 채택한 주장 |
| Return Contract | 돌아보기 약속 | Return promise | 언제 무엇을 다시 물을지에 대한 약속 |
| Observation | 실제로 일어난 일 | Observation | 외부 세계에 관한 출처 있는 주장 |
| Resolution Assertion | 확인한 답 | Recorded answer | 관찰이 돌아보기 질문에 주는 답에 대한 사람의 해석 |
| Closure | 정산 | Settle / Close | 사람이 답을 채택해 판단을 닫는 행위 |
| Defer | 아직 | Not yet | 질문을 닫지 않고 새 귀환일을 약속하는 행위 |
| Withdraw | 철회 | Withdraw | 저자가 판단을 더 이상 유지하지 않는 행위 |
| Supersede | 새 판단으로 바꾸기 | Replace | 의미가 달라진 새 판단이 이전 판단을 대체하는 관계 |

`Proposal`은 화면에 항상 “판단 기록”으로 부르지 않는다. 사용자가 소유하지 않은 분석·초안·질문·AI 제안은 `WorkItem` 또는 `이어서 하기`로만 보인다.

### 1.2 상태와 사용자 카피

| Kernel projection | 기본 한국어 | 기본 영어 | 의미 |
|---|---|---|---|
| proposal | 이어서 하기 | Continue | 아직 봉인되지 않음 |
| sealed, not due | 기다리는 중 | Waiting | 귀환 약속이 있으나 아직 조건이 오지 않음 |
| due | 돌아볼 때 | Ready to revisit | 귀환 시점/조건이 충족됨 |
| deferred | 아직 | Not yet | 상태가 아니라 return-deferred 이력; 다시 sealed/due로 파생 |
| closed/answered | 정산 완료 | Settled | 돌아보기 질문에 답하고 사람이 닫음 |
| closed/indeterminate | 확인 불가로 정산 | Closed without an answer | 충분한 시간 뒤에도 증거로 답할 수 없음 |
| closed/moot | 질문 소멸로 정산 | Closed — no longer applicable | 질문의 전제·목표·대상이 사라짐 |
| withdrawn | 철회됨 | Withdrawn | 저자가 판단을 더는 유지하지 않음; 실패 아님 |
| superseded | 새 판단으로 대체됨 | Replaced | 새 의미의 판단이 이전 판단을 대체 |
| archived (surface-only) | 보관 | Archived | 활성 projection에서 숨긴 사용자 선택; kernel terminal state가 아님 |

`settled`는 product projection의 umbrella label이다. kernel에서 `answered`, `indeterminate`, `moot`를 평탄화하지 않으며 상세 화면·export·MCP receipt에는 실제 resolution kind를 항상 유지한다.

### 1.3 금지어

사용자 카피와 커널 필드에 다음을 사람의 판정으로 사용하지 않는다.

- 좋은/나쁜 판단
- 판단력 점수, 티어, 등급
- 실패한 사람, 막힌 사용자, 오래 방치함
- “AI가 기억한 당신의 결정”처럼 저자·승인을 흐리는 문구

`missed`, `held`, `avoided` 등 기존 v2 outcome 어휘는 legacy 입력의 원문으로 보존할 수 있지만 v3 semantic package의 canonical user-facing enum이 아니다.

---

## 2. 제품 projection 계약

### 2.1 생애주기 대응

```text
WorkItem / 이어서 하기
  = Proposal (및 아직 채택되지 않은 Assertion)

DecisionRecord / 판단 기록
  = Judgment + active Return Contract + 관련 Premise

Return Promise / 돌아보기 약속
  = Return Contract

실제로 일어난 일
  = Observation

확인한 답
  = Resolution Assertion

정산
  = Closure
```

제품의 `DecisionRecord`는 `judgment_sealed`와 `return_promised`가 같은 atomic batch에 존재할 때 시작한다. Return Contract가 없는 기록은 DecisionRecord가 아니라 WorkItem/note로 남는다.

### 2.2 `Settlement`의 정확한 의미

정산 화면은 다음 세 단계를 한 번의 짧은 확인 흐름으로 보여 준다.

1. 무엇이 실제로 일어났는가 — Observation
2. 그 사실이 돌아보기 질문에 어떤 답을 주는가 — Resolution Assertion
3. 그 답을 내가 채택해 이 판단을 닫는가 — Closure

한 화면·한 번의 확인이 세 의미를 합쳐 기록할 수는 있어도, reducer·export·audit에서는 세 단계를 구분해야 한다.

### 2.3 제품 route·상태 호환

- 기존 `/project` route와 deep link는 P6 전까지 유지한다.
- `draft/sealed/due/settled/archived`는 surface projection 언어다.
- `due`는 저장된 flag가 아니라 active Return Contract와 기준 시각에서 계산한다.
- `archived`는 visibility preference다. kernel의 `withdrawn`, `superseded`, `moot`와 동의어가 아니다.
- `local_only`, `sync_failed`, `delivery_failed`, `premise_changed`는 AttentionSignal이다. judgment lifecycle을 바꾸지 않는다.

---

## 3. Authority Matrix

### 3.1 역할

| Field | 의미 | 허용 주체 |
|---|---|---|
| `originated_by` | 내용 또는 구조를 처음 만든 주체 | human, ai, host, imported |
| `recorded_by` | 원장에 이벤트를 쓴 표면·도구 | mcp, web, telegram, plugin, migration |
| `observed_by` | 관찰을 수행하거나 보고한 주체 | human, host, external source |
| `authorized_by` | Authorial Act를 승인한 사람 | human principal only |

`provenance`는 content의 출처이고 `authority`는 의미 변화를 승인한 주체다. 둘은 서로 대체하지 않는다.

### 3.2 이벤트별 승인 규칙

| Event | 누가 만들 수 있는가 | `authorized_by` | 추가 규칙 |
|---|---|---|---|
| `proposal_created/revised` | human, ai, host | 불필요 | AI 구조화와 사용자 발화 출처를 구분 |
| `assertion_recorded` | human, ai, host, import | 불필요 | provenance와 evidence를 보존 |
| `observation_recorded` | human, host, import | 불필요 | `observed_by` 또는 출처 필요; closure를 자동 생성하지 않음 |
| `judgment_sealed` | command는 어느 표면에서나 | 필수 | direct command 또는 explicit confirmation evidence 필수 |
| `premise_adopted/retired` | command는 어느 표면에서나 | 필수 | AI 이유의 자동 승격 금지 |
| `return_promised/deferred/superseded` | command는 어느 표면에서나 | 필수 | `deferred`는 terminal 불가 |
| `resolution_asserted` | AI가 초안 가능 | 필수 | subject, answer/reason, evidence refs를 표시하고 승인 |
| `judgment_closed` | command는 어느 표면에서나 | 필수 | 참조된 resolution assertion 필요 |
| `judgment_withdrawn/superseded` | command는 어느 표면에서나 | 필수 | 과거를 덮지 않고 관계를 남김 |
| system event | 시스템 | 불필요 | 사용자 의미 상태를 직접 바꾸지 않음 |

### 3.3 승인 근거 규칙

| Mode | 허용 조건 | 최소 증거 |
|---|---|---|
| `direct_command` | 사용자가 특정 대상과 행위를 직접 명령 | user utterance pointer + resolved target id |
| `explicit_confirmation` | 시스템이 고정된 내용을 보이고 사용자가 확인 | rendered command digest + confirmation event/pointer |
| `signed_import` | 외부 서명·신뢰 경계가 검증됨 | signature metadata + trust policy ref |

“전부 저장해” 같은 일괄 승인은 대상 목록과 command digest가 사용자에게 표시·고정된 경우에만 유효하다. 목록이 바뀌면 새 승인이 필요하다. 침묵은 승인도 거절도 아니다.

---

## 4. Resolution Taxonomy

### 4.1 Canonical shape

```ts
type ResolutionAssertion =
  | {
      kind: 'answered';
      subject_ref: ReturnContractRef;
      answer_summary: string;
      criterion_result?: 'met' | 'not_met' | 'partial' | 'not_applicable';
      evidence_refs: ObservationRef[];
    }
  | {
      kind: 'indeterminate';
      subject_ref: ReturnContractRef;
      reason: string;
      evidence_refs: ObservationRef[];
    }
  | {
      kind: 'moot';
      subject_ref: ReturnContractRef;
      reason: string;
      evidence_refs: ObservationRef[];
    };
```

### 4.2 Invariants

- `subject_ref`는 active 또는 explicitly superseded Return Contract를 가리킨다.
- `answered`는 적어도 하나의 Observation을 참조한다. 사람의 직접 보고도 Observation으로 기록할 수 있다.
- `indeterminate`와 `moot`는 빈 문자열이 아닌 reason을 요구한다. evidence가 없을 수 있다는 사실도 reason에 명시한다.
- `criterion_result`는 criterion이 사전에 존재할 때만 쓴다. 없으면 system이 억지 code를 붙이지 않는다.
- `judgment_closed`는 하나의 authorized Resolution Assertion을 참조한다.
- `still_pending`은 resolution kind가 아니다. `return_deferred`가 새로운 return date/trigger를 기록한다.

### 4.3 Product mapping

| Kernel result | Product primary copy | Product detail |
|---|---|---|
| `answered + met` | 정산 완료 | 조건 충족 |
| `answered + not_met` | 정산 완료 | 조건 미충족 |
| `answered + partial` | 정산 완료 | 일부 충족 |
| `answered + no criterion` | 정산 완료 | 사용자가 남긴 답 |
| `indeterminate` | 확인 불가로 정산 | 충분한 시간 뒤에도 답할 증거 없음 |
| `moot` | 질문 소멸로 정산 | 질문이 더는 적용되지 않음 |
| `return_deferred` | 아직 | 새 귀환 약속과 함께 계속 열림 |

---

## 5. 현재 구현과의 충돌·이행 계약

### 5.1 v2 MCP ledger

| 현재 위치 | 현행 의미 | v6 판정 | 이행 |
|---|---|---|---|
| `argus-mcp/src/v2/events.ts` | provenance enum과 24 events | Reforge | source·authority·temporal context 분리, v2 read 유지 |
| `argus-mcp/src/v2/reducer.ts` | harvested → sealed → settled/dismissed | Reforge | v3 semantic reducer는 별도 package; v2 reducer 변경 전 adapter replay |
| `argus-mcp/src/tools/seal.ts` | harvest/seal/premise_add를 한 command로 기록 | Inherit + Reforge | atomic batch는 계승, statement/return/premise 의미 분리 |
| `argus-mcp/src/tools/settle.ts` | `still_pending`을 defer로 재무장 | Inherit | v6에서도 defer 비종결; resolution/closure로 분리 |
| evidence pointer | byte/hash/verification evidence | Inherit | authority evidence와 혼동하지 않음 |

### 5.2 Web, account, plugin, Telegram

| 현재 위치 | 현행 의미 | v6 이행 |
|---|---|---|
| `src/lib/checkpoint-core.ts` | web DecisionContract seal→settle | P6 source adapter 대상; 기존 write path는 P4/P5 전 유지 |
| `src/stores/useReviewStore.ts` | review receipt follow-up settle/defer | P3 adapter 대상으로 읽고 legacy outcome 손실 보고 |
| `src/app/api/mcp/seal/route.ts` | account mirror seal/settle/defer/dismiss | P6 command adapter 대상; direct account writes는 v3 conformance 전 보존 |
| `src/lib/telegram-settlement.ts` 및 webhook | Telegram settlement | P7 surface adapter; terminal authorization evidence를 추가 |
| `src/stores/usePluginStore.ts` | plugin status/outcome mirror | P7 surface adapter; local enum을 canonical enum으로 승격 금지 |

### 5.3 BLUEPRINT와 제품 설계의 전환

현재 `ARGUS-BLUEPRINT.md` §8에는 판단 기록 시스템 통합 전환이 대기 항목으로 적혀 있다. 사용자 최신 지시는 v6 P0–P5를 실행하도록 이 전환을 승인한다.

- 이 stream은 사용자가 수정 중인 `ARGUS-BLUEPRINT.md`를 P0에서 변경하지 않는다.
- P0–P5는 existing route·write path를 파괴하지 않는 semantic kernel·fixture·adapter·MCP vertical slice에 한정한다.
- P5의 go를 통과한 뒤, P6 웹 전에는 BLUEPRINT 공정표와 제품 설계의 phase를 별도 reconciliation commit으로 갱신한다.
- P5가 fail이면 BLUEPRINT의 기존 surface 공정은 유지하고 v6 claim을 축소한다.

이 계약은 기존 공정의 무단 폐기가 아니라, 현재 사용자 지시로 채택된 선행 기반 공사다.

---

## 6. P0 Exit Evidence

P0는 다음이 모두 참일 때 완료다.

- 이 문서의 glossary가 product copy와 kernel type의 역할을 분리한다.
- 모든 Authorial Act의 approval requirement와 evidence mode가 정해져 있다.
- resolution의 대상·답·근거·terminal/defer 경계가 정해져 있다.
- v2, web, plugin, Telegram, BLUEPRINT의 충돌과 이행 순서가 명시되어 있다.
- P1 corpus가 이 glossary와 taxonomy만으로 사례를 라벨링할 수 있다.

P0가 명시적으로 다음 P2 이전 ADR로 넘기는 항목은 여덟 가지다.

1. repository-local human identity key
2. exact `authorization_ref` envelope format
3. event-based return trigger v1 inclusion
4. signed import trust boundary/key rotation
5. Supabase canonical/replica deployment declaration
6. physical backup erasure retention
7. private metrics export/delete/AI-access default
8. simultaneous defer/close conflict resolution UX

각 항목은 해당 phase의 implementation owner가 ADR로 닫는다. 닫히지 않은 항목은 관련 write surface를 열지 않는다.

---

## 7. P0 Validation Commands

P0는 문서 단계이므로 기존 runtime behavior를 바꾸지 않는다. 다음은 다음 phase의 baseline이다.

```text
argus-mcp: npm run typecheck
argus-mcp: npm test
root web:  npm test
```

P1부터는 glossary/taxonomy fixtures가 semantic package test에서 machine-readable한 기대값으로 소비되어야 한다. 문서에만 있는 용어는 P2 exit를 통과하지 못한다.
