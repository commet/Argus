# Argus Epistemic Agency & Self-Knowledge Governance 설계

> 상태: **창업자 승인 병렬 트랙의 설계 기준선**
> 작성일: 2026-07-17
> 트랙 코드: **E (Epistemic Agency)**
> 범위: 자기지식의 승격, 기억의 미래 판단 영향, 철회·반박, AI 합성 다수의 증거 한계
> 비범위: DKK v4 스키마, O2 Core/ledger, O3 패키징·Boss 교체, 웹 공정 5 UI 공예

---

## 0. 결론

Argus가 사용자의 사고를 오래 기억하는 것만으로는 좋은 도구가 되지 않는다.
잘못 읽은 것을 오래 기억하면 일회성 오답보다 더 위험하고, 그 기억을 다음 AI
프롬프트에 조용히 주입하면 제품은 사용자를 알아가는 대신 **자기가 만든 사용자
상을 반복 강화**하게 된다.

이 트랙의 한 줄 원리는 다음과 같다.

> **패턴은 프로필이 아니고, 프로필은 프롬프트 정책이 아니다.**

Argus는 관찰하고, 비교하고, 가설을 제안할 수 있다. 그러나 다음 두 승격은 자동으로
일어나면 안 된다.

1. 반복 기록 → “나는 이런 사람이다”라는 자기지식
2. 자기지식 → 미래 AI가 나를 다루는 방식에 대한 지시

두 승격 사이에는 서로 다른 근거와 사용자 권한이 필요하다. 사용자가 어떤 패턴에
동의해도 그것이 모든 맥락에서 참이라는 뜻은 아니며, 미래 생성에 영향을 주도록
허용했다는 뜻도 아니다.

이 설계가 보존하려는 것은 “AI와 반대로 말하는 사람”이 아니다. 다수의 답에 동의할
수도 있고 거절할 수도 있지만, 어느 쪽이든 **자기 근거가 남고, AI가 만든 사회적
압력이 증거처럼 둔갑하지 않으며, 과거의 자기상에서 빠져나올 수 있는 사람**이다.

---

## 1. 왜 별도 트랙인가

### 1.1 K와 E가 답하는 질문은 다르다

`DESIGN-judgment-knowledge-core-and-coaching-v1-2026-07-16.md`의 K 트랙은 판단을
시간축 지식 그래프로 정규화한다. DecisionCase, JudgmentVersion, Assertion,
Evidence, Relation을 통해 “무슨 일이 있었고 어떤 구조가 반복됐는가”를 묻는다.

E 트랙은 그 위에서 다음을 묻는다.

- 그 반복 구조를 **사용자 자신에 관한 주장**으로 말해도 되는가?
- 그 주장을 현재 맥락 밖으로 일반화해도 되는가?
- 그 주장이 미래 AI의 질문·생성·강조 순서를 바꿔도 되는가?
- 사용자가 반박하거나 철회한 뒤 그 영향이 정말 멈췄는가?
- 여러 AI 역할의 유사한 답을 독립된 다수 의견처럼 취급하지 않았는가?

따라서 K는 후보 사실·관계·패턴의 생산자이고, E는 **자기지식 승격과 영향의
제어면(control plane)**이다. E는 K의 객체를 복제하지 않으며 v4 reducer나 relation
검증기를 수정하지 않는다.

### 1.2 기존 Zero-Judgment만으로 충분하지 않다

현재 헌법은 사용자에게 점수·티어·평결을 노출하지 말라고 한다. 필요한 원칙이지만
다음의 조용한 영향까지 막지는 못한다.

- 사용자에게는 점수를 숨기되 점수에 따라 다음 질문을 바꾸는 것
- “참고”라고 쓴 패턴 문장을 시스템 프롬프트에 넣어 생성 분포를 바꾸는 것
- AI가 생성한 가정의 축 분포를 사용자의 사각지대로 재해석하는 것
- AI가 쓴 `why_abandoned`를 사용자의 과거 선택 이유처럼 저장하는 것
- 같은 모델이 연기한 다섯 역할을 “모두의 합의”로 요약하는 것

**표시하지 않은 판단도 영향하면 판단이다.** E는 사용자 표면의 문구뿐 아니라
프롬프트 입력, 라우팅, 기억 검색, 합성 가중치까지 같은 권한 계약으로 묶는다.

---

## 2. 현행 코드 감사: 실제 활성도와 위험

아래 분류는 2026-07-17 `main` 기준이다. “코드가 존재함”과 “기본 제품 경로에서
사용됨”을 분리했다.

| 영역 | 현재 경로 | 활성도 | 핵심 위험 |
|---|---|---:|---|
| Chronicler narration | `voyage-log-narrate.ts` → `useChronicler` → ProgressiveFlow | **기본 항해에서 live** | LLM이 `significance`, `why_abandoned`를 사용자 소유의 항해 기록 필드에 직접 기록 |
| 설정의 사용 현황 | `user-context.ts#getObservationsSummary` → settings | **live read surface** | DQ 추세를 “점점 나아짐/꾸준히 잘함/러프함”으로 사람 평가처럼 번역. 신규 DQ 계산 callsite는 현재 없지만 과거 데이터는 읽힘 |
| Navigator | `navigator.ts` → `NavigatorStrip` | **명시적 `?step=` 레거시에서 live** | 선호 전략, 미탐색 축, eval 약점, vitality 경직 개입을 사용자 특성·처방으로 제시 |
| 과거 기억 프롬프트 | `context-builder.ts` → Reframe/Recast/Synthesize | **레거시에서 live** | 과거 판단·coda·결과·회고·적응형 패턴을 별도 허가 없이 시스템 프롬프트에 주입 |
| 적응형 축 프로필 | `context-builder.ts#buildAdaptiveContext` | **레거시에서 live** | AI가 만든 hidden assumptions의 축 분포를 사용자의 패턴으로 재사용하는 폐회로 |
| 다중 페르소나 합성 | `RehearseStep.tsx` | **레거시에서 live** | 같은 LLM 계열의 역할극을 `common_agreements`, 우선 행동, 영향력 가중으로 합성 |
| DQ 엔진 | `decision-quality.ts` | **계산 함수는 현재 직접 callsite 없음** | 절차 산출물 개수·페르소나 수를 0–100 “판단 품질”로 오인 |
| Vitality 엔진 | `judgment-vitality.ts` | **일부 레거시 기록·개입 경로** | `alive/coasting/performing/dead`로 사고의 생명력을 판정하고 개입 강도를 올림 |
| K v4 patterns | `argus-mcp/src/v4`, `src/lib/semantic-v4` | **기본 off shadow** | 현시점 직접 노출은 없으나, 향후 고정밀 패턴이 자기 프로필로 자동 승격될 위험 |

### 2.1 가장 위험한 폐회로

현행 `buildAdaptiveContext()`는 최근 Reframe 산출물의 `hidden_assumptions.axis`를
센다. 그러나 hidden assumption은 사용자가 독립적으로 제시한 관찰이 아니라 대체로
모델이 생성한 분석 산출물이다. 그 분포에서 적게 나온 축을 “이 사용자의 판단 패턴”
이라고 부르고, 다음 모델에 그 축을 더 생성하라고 지시한다.

```text
모델이 적은 축을 생성
  → 시스템이 사용자 사각지대로 해석
  → 다음 모델에 그 축을 더 생성하라고 지시
  → 출력 분포가 변함
  → 바뀐 출력이 다시 사용자 패턴의 근거가 됨
```

이것은 개인화가 아니라 **모델 산출물의 자기강화**다. 사용자의 사고를 측정한 것이
아니므로 표본 수를 8개, 80개로 늘려도 근본 문제가 해결되지 않는다.

### 2.2 “사용자가 수정했다”의 과잉 해석

AI 제안 수정률과 첫 reframe 수락률은 인터페이스 사건이다. 이 값만으로 다음을 알 수
없다.

- 사용자가 AI와 동의했는가, 피곤해서 통과했는가
- 수정하지 않은 이유가 정확성인지 시간 부족인지
- 수정이 더 나은 판단인지 단순 표현 선호인지
- 같은 선택이 다른 맥락에서도 반복될지

따라서 수락·수정 사건은 관찰로 남길 수 있지만 “AI를 비판적으로 검토하는 편”,
“선호 전략”, “대안 프레이밍이 필요” 같은 자기지식이나 처방으로 자동 승격할 수 없다.

### 2.3 AI가 과거의 이유를 쓰는 문제

Chronicler는 waypoint 존재와 유형은 결정론적으로 받지만, 그 변곡점의 의미와 가지
않은 길의 이유를 모델이 쓴다. `significance`는 가능한 해석일 수 있으나,
`why_abandoned`는 선택의 이유에 대한 저자성 주장이다. 모델이 사실을 새로 만들지
않더라도 **주어진 사실 중 무엇이 이유였는지 선택하는 순간 인과를 저술**한다.

AI가 쓴 문장을 사용자의 과거 이유와 같은 필드에 저장하면 나중의 회고와 패턴 분석은
그 문장을 사용자 기억으로 오인할 수 있다.

### 2.4 AI 역할극이 다수 의견이 되는 문제

Rehearse는 여러 persona 호출을 병렬 실행하지만 다음을 보장하지 않는다.

- 독립된 정보원
- 독립된 모델 계열
- 상이한 학습 분포
- 실제 이해관계자의 권한과 책임
- 서로의 주장에 대한 현실 검증

호출 수가 여러 개여도 공통 prompt lineage와 모델을 공유하면 증거 단위는 늘지 않는다.
여러 렌즈가 같은 우려를 생성했다는 사실은 표현상의 수렴이지, 사회적 합의나 사실의
확률 상승이 아니다.

---

## 3. E 트랙 헌법: 열 가지 불변식

### E-I1. 기록과 해석을 분리한다

“3건에서 승인 전 운영 용량이 기록되지 않았다”는 관찰이다. “나는 운영을 무시하는
사람이다”는 해석이다. 첫 문장이 참이어도 둘째 문장이 자동으로 따라오지 않는다.

### E-I2. 모델 산출물은 사용자 관찰이 아니다

AI가 만든 질문·가정·페르소나 반응·요약·서사는 사용자의 사고 패턴을 입증하는
독립 표본으로 세지 않는다. 사용자의 클릭이나 수락도 그 산출물에 독립성을 부여하지
않는다.

### E-I3. 자기지식은 가설 상태를 거친다

시스템은 사용자의 성격·편향·능력·선호를 확정하지 않는다. 반복 구조는 범위와
반례를 가진 잠정 가설로만 제안한다. 사용자의 동의는 “현재 이 표현이 유용하다”는
승인이지 보편적 진리 인증이 아니다.

### E-I4. 자기지식 승인과 미래 영향 허가는 별개다

사용자가 한 가설에 동의해도 다음 프롬프트에 자동 주입하지 않는다. 검색, 질문,
생성 조정은 각각 명시적 `InfluenceGrant`를 필요로 한다.

### E-I5. 모든 영향은 추적 가능하고 즉시 철회 가능하다

과거 기억이 이번 질문·강조·생성에 영향을 줬다면 어떤 기억이 어떤 방식으로
사용됐는지 `InfluenceTrace`가 남아야 한다. 허가 철회 후에는 다음 호출부터 영향이
0이어야 한다.

### E-I6. 맥락 불일치와 자기모순의 권리를 보존한다

사용자는 프로젝트·역할·시기에 따라 다르게 판단할 수 있다. 그것을 데이터 오류나
일관성 결함으로 취급하지 않는다. 교차 영역 일반화는 사용자가 범위를 넓히기 전까지
금지한다.

### E-I7. 반례를 숨긴 통찰은 통찰이 아니다

자기지식 후보는 지지 사례뿐 아니라 반례·예외·미관측 범위를 함께 제시한다. 반례를
찾지 못했다는 사실은 반례가 없다는 증거가 아니다.

### E-I8. 원인은 사용자가 말했거나 별도로 검증돼야 한다

시간적으로 먼저 일어났거나 LLM이 그럴듯하게 연결했다는 이유로 판단 변화의 원인이
되지 않는다. 원인 언어는 `user_stated`, `evidence_linked`, `system_candidate`,
`unknown`을 구분한다.

### E-I9. 합성된 다수는 증거 가중치를 만들지 않는다

동일한 생성 계보에서 나온 N개의 persona 응답은 독립 증거 N개가 아니다. AI 역할극에
“합의·다수·표결” 어휘를 쓰지 않고, 반대 렌즈와 미관측 영역을 보존한다.

### E-I10. 사람을 점수·티어·추세로 판정하지 않는다

DQ, gamma, vitality, pass rate 같은 계측은 제품·모델 파이프라인의 진단일 수는 있어도
사용자의 판단력이나 사고 생명력의 측정값이 아니다. 사용자 서사, 프로필, 코칭 강도,
프롬프트 개인화의 근거로 사용하지 않는다.

---

## 4. 자기지식의 다섯 층

```text
L0 사건(Event)
  사용자가 선택·수정·봉인·정산한 원문 사건
        ↓ 해석 없음
L1 관찰(Observation)
  범위·시점·출처가 붙은 반복 구조 요약
        ↓ 독립성·반례·최소 표본 게이트
L2 자기지식 후보(Self-knowledge Candidate)
  시스템이 제안한 잠정 가설
        ↓ 사용자 검토
L3 사용자가 채택한 원칙(Endorsed Principle)
  범위와 유효기간이 있는 사용자 소유 표현
        ↓ 별도 영향 허가
L4 영향 정책(Influence Grant)
  어디에서 어떤 방식으로 미래 AI에 영향을 줄지
```

어느 층도 다음 층으로 자동 승격하지 않는다. 특히 L2→L3와 L3→L4는 별개의 사용자
행위다.

### 4.1 L0: Event

K 코어의 authorial event와 legacy 기록을 읽는다. E는 원본을 수정하지 않는다.

- 사용자가 직접 쓴 최초 입장
- AI 제안 중 사용자가 Keep/Reword/Skip한 항목
- 봉인·수정·철회
- 정산 결과와 사용자가 쓴 회고
- AI 호출과 생성 계보

UI 행동은 “무슨 버튼을 눌렀다”까지만 말한다. 그 행동의 동기나 품질은 포함하지 않는다.

### 4.2 L1: Observation

관찰 문장은 다음 문법을 따른다.

> `[범위]`에서 `[독립 단위 N개]` 중 `[사건 K개]`에 `[구체 구조]`가 기록됐다.
> 반례는 `[M개/미검색]`이며, 이 기록만으로 동기·성격은 알 수 없다.

예:

> 해결된 제품 출시 결정 4건 중 3건에서 운영 용량 근거가 봉인 뒤에 추가됐다.
> 1건에서는 봉인 전에 기록됐다. 왜 늦게 추가됐는지는 이 기록만으로 알 수 없다.

### 4.3 L2: Self-knowledge Candidate

시스템이 만들 수 있는 가장 강한 자기 해석이다. 진술은 성격 라벨이 아니라 검토 가능한
명제로 쓴다.

나쁨:

> 당신은 실행 가능성을 과소평가합니다.

허용:

> 제품 출시 판단에서는, 선택지를 좁힌 뒤에야 운영 용량을 확인하는 순서가 반복됐습니다.
> 이 순서가 의도적인가요, 아니면 다음 판단 전에 확인할 가치가 있나요?

### 4.4 L3: Endorsed Principle

사용자가 후보를 그대로 채택하거나 자기 말로 고쳐 채택한 상태다.

예:

> “제품 출시에서는 흥분하면 운영 용량 확인을 늦추는 편이다. 다음 분기까지는 봉인 전에
> 온보딩 처리량을 먼저 적어 본다.”

이 문장은 사용자 소유다. 그래도 영구 성격 특성이 아니며 `제품 출시`, `다음 분기`라는
범위를 가진다.

### 4.5 L4: Influence Grant

원칙을 기억하는 것과 다음 AI 행동을 바꾸는 것은 다르다. 영향은 다음 중 하나로만
허용한다.

- `retrieve_only`: 관련될 때 근거와 함께 다시 보여주기
- `ask_once`: 결론을 기울이지 않는 확인 질문을 최대 한 번 제시
- `adapt_generation`: 특정 관점을 후보 생성에 포함하되 우선 답으로 만들지 않기

`recommend`, `decide`, `suppress_dissent`, `increase_pressure`는 허용 효과가 아니다.

---

## 5. E 제어 객체

아래 객체는 K의 canonical knowledge object를 대체하지 않는다. E 트랙의 projection과
권한 기록이다. 구현 시점에는 K ID를 참조하고, K가 없는 legacy 데이터는 명시적인
`legacy_ref`로 격리한다.

### 5.1 `SelfKnowledgeClaim`

```ts
type SelfKnowledgeClaim = {
  claim_id: string;
  claim_kind:
    | 'descriptive_sequence'
    | 'contextual_preference'
    | 'personal_principle'
    | 'causal_hypothesis';
  statement: string;
  scope: {
    domains: string[];
    project_ids?: string[];
    roles?: string[];
    valid_from?: string;
    review_by?: string;
  };
  support_refs: string[];
  counterexample_refs: string[];
  unsearched_counterexample_scope: string[];
  independence: {
    unit_count: number;
    lineage_ids: string[];
    resolved_case_count: number;
  };
  support_state: 'insufficient' | 'emerging' | 'supported' | 'contested';
  lifecycle: 'candidate' | 'endorsed' | 'contested' | 'retired';
  wording_source: 'system_proposed' | 'user_reworded' | 'user_authored';
  created_at: string;
  reviewed_at?: string;
};
```

숫자 confidence는 사용자에게 노출하지 않는다. `supported`도 “사실로 확정”이 아니라
정해진 근거 계약을 충족했다는 뜻이다.

claim kind마다 권한이 다르다.

- `descriptive_sequence`: 시스템이 근거 계약을 통과해 제안할 수 있다.
- `contextual_preference`: 명시적 사용자 선택 이유나 반복된 사용자 원문이 필요하다.
  단순 수락률·클릭률로 만들 수 없다.
- `personal_principle`: 사용자만 저자가 될 수 있다. 시스템은 문구 후보만 제안한다.
- `causal_hypothesis`: `user_stated` 또는 검증된 evidence link 없이 원인으로 표현하지
  않는다. 시간적 선후와 LLM 설명은 후보 이상이 아니다.

### 5.2 `InfluenceGrant`

```ts
type InfluenceGrant = {
  grant_id: string;
  claim_id: string;
  effect: 'retrieve_only' | 'ask_once' | 'adapt_generation';
  surfaces: ('web' | 'mcp' | 'plugin')[];
  scope: {
    domain?: string;
    project_id?: string;
    session_id?: string;
  };
  starts_at: string;
  expires_at?: string;
  authorized_by: 'user';
  status: 'active' | 'revoked' | 'expired';
};
```

전역·무기한은 기본값이 아니다. 가장 좁은 범위와 짧은 기간을 기본으로 한다.

### 5.3 `InfluenceTrace`

```ts
type InfluenceTrace = {
  trace_id: string;
  call_id: string;
  surface: 'web' | 'mcp' | 'plugin';
  used: Array<{
    claim_id: string;
    grant_id: string;
    effect: 'retrieve_only' | 'ask_once' | 'adapt_generation';
    prompt_section: string;
  }>;
  excluded: Array<{
    claim_id: string;
    reason:
      | 'no_grant' | 'not_endorsed' | 'insufficient_support'
      | 'not_started' | 'out_of_scope' | 'expired' | 'revoked'
      | 'already_used' | 'budget_exceeded' | 'invalid_claim'
      | 'trace_write_failed' | 'contested' | 'retired';
  }>;
  created_at: string;
};
```

`InfluenceTrace`는 모델 chain-of-thought를 저장하지 않는다. 어떤 기억이 어떤 정책으로
입력에 포함됐는지만 기록한다.

### 5.4 `ClaimReviewEvent`

```ts
type ClaimReviewEvent = {
  event_id: string;
  claim_id: string;
  action: 'endorse' | 'reword' | 'contest' | 'retire' | 'reopen';
  user_wording?: string;
  reason?: string;
  occurred_at: string;
};
```

거절과 철회는 삭제와 다르다. 과거에 어떤 후보가 있었는지는 감사 가능하게 남기되,
긍정 근거나 프롬프트 영향으로 다시 사용하지 않는다.

### 5.5 `SyntheticPerspectiveSet`

```ts
type SyntheticPerspectiveSet = {
  set_id: string;
  model_family: string;
  model_version?: string;
  shared_prompt_lineage: string;
  perspective_ids: string[];
  source_refs: string[];
  independence_units: 1;
  generated_at: string;
};
```

서로 다른 모델을 썼다고 자동으로 독립 단위가 늘어나는 것도 아니다. 같은 문서와 같은
질문을 바탕으로 한 합성 의견은 “탐색 렌즈”이며, 현실 증거 단위와 합산하지 않는다.

---

## 6. 상태 전이와 권한

```text
사건 기록
  → 관찰 생성(system, 비해석)
  → 후보 제안(system, 영향 불가)
      ├─ 나중에(later): candidate 유지, 자동 재노출 금지
      ├─ 반박(contest): contested, 영향 즉시 차단
      ├─ 고쳐 채택(reword): endorsed + 사용자 원문 보존
      └─ 채택(endorse): endorsed
             └─ 별도 영향 허가(grant)
                    ├─ 범위 밖: 사용 안 함
                    ├─ 만료: 사용 안 함
                    ├─ 철회: 다음 호출부터 사용 안 함
                    └─ 사용: InfluenceTrace 필수
```

### 6.1 최소 근거

교차 결정 자기지식 후보는 K의 F3 결정과 맞춰 다음을 기본 최소치로 한다.

- 독립적으로 해결된 DecisionCase 3개 이상
- 동일한 관계·순서 구조
- 최소 한 번의 반례 검색
- 현재 판단과의 범위 연결
- AI 생성 lineage를 독립 사례에서 제외

단일 사건은 자기지식이 아니라 사건 회고로만 다룬다. 하나의 외부 변화가 여러 열린
판단에 미치는 blast radius는 K의 예외 규칙을 따르되, 이것도 사용자 성향 주장은 아니다.

독립 단위는 DB row 수가 아니라 **별개의 현실 의사결정 episode**다. 다음은 여러 행이어도
한 단위로 센다.

- 같은 프로젝트의 branch·재시도·import 사본
- 하나의 결과를 공유하는 하위 판단들
- 같은 모델 응답에서 파생된 가정·요약·persona 반응
- 같은 사건을 coda, retrospective, waypoint에 중복 기록한 것

반대로 독립성을 높이는 것은 서로 다른 시기의 별도 결정, 별도 현실 정산, 사용자가
직접 적은 당시 이유, 독립된 외부 evidence다. 독립성은 단순 출처 개수보다 **공통 원인과
생성 계보를 얼마나 공유하는가**로 판단한다.

### 6.2 범위 확장

`제품 출시`에서 나온 후보를 `모든 업무 판단`, `개인적 관계`, `나라는 사람`으로
자동 확대하지 않는다. 범위를 넓히는 것은 새 ClaimReviewEvent이며, 넓어진 범위에
맞는 근거를 다시 검사한다.

### 6.3 반박과 새 증거

- 새 반례가 들어오면 `supported`를 유지한 채 숨기지 않는다.
- 핵심 구조를 깨면 `contested`로 내려 영향 사용을 정지한다.
- 사용자는 근거가 부족해도 자기 원칙을 retire할 수 있다.
- 시스템은 “데이터가 맞으니 계속 적용”을 주장할 권한이 없다.

---

## 7. 기억 영향 정책

### 7.1 기본 매트릭스

| 기억 종류 | 저장 | 관련 시 열람 | 자동 프롬프트 지시 | 허가 후 영향 |
|---|---:|---:|---:|---:|
| 현재 세션의 사용자 원문 | 예 | 예 | 현재 과업 범위에서만 | 불필요 |
| 같은 프로젝트의 봉인된 사용자 판단 | 예 | 예 | 제약·원문으로만 | 범위 밖 적응은 허가 필요 |
| 설정에서 사용자가 직접 쓴 프로필 | 예 | 예 | 입력 시 용도가 명시된 표면에서만 | 범위 확대는 새 허가 필요 |
| 과거 프로젝트의 사용자 coda/회고 | 예 | 관련성 확인 후 | **아니오** | 예 |
| 시스템이 만든 패턴 후보 | 예 | 검토 카드에서만 | **아니오** | endorsed + grant 후 |
| AI narration/significance | provenance와 함께 | 보조 해석으로만 | **아니오** | 자기지식 근거로는 불가 |
| DQ/vitality/eval 점수 | 품질 진단 가능 | 사용자 자기상으로는 불가 | **아니오** | 불가 |
| contested/retired claim | 감사 이력 | 상태 확인 시 | **아니오** | 불가 |

### 7.2 관련성은 권한이 아니다

retrieval 모델이 높은 관련성을 계산해도 그 기억을 프롬프트에 넣을 권한은 생기지
않는다. `relevance × permission`이며 둘 중 하나가 0이면 영향은 0이다.

명시적 프로필은 예외적으로 입력 행위와 사용 허가를 한 번에 받을 수 있다. 단, 필드
옆에 “어느 AI 표면에서 무엇을 조정하는지”가 쓰여 있어야 한다. 기존처럼 이름·역할·
경력·자유 메모를 입력한 뒤 Review와 Boss 양쪽에 조용히 쓰는 방식은 장기적으로 표면별
용도 표시와 철회 범위를 가져야 한다. **직접 입력했다는 사실은 무제한 사용 허가가 아니다.**

### 7.3 사용자 원문도 자동 규칙이 아니다

“다음에는 다르게 하겠다”는 회고는 당시의 의도다. 모든 미래 프로젝트에 적용하라는
영구 명령이 아니다. 현재 `buildCodaInsights()`와 retrospective 교훈의 무조건 주입은
E 계약상 금지된다.

### 7.4 영향은 중립성을 깨지 않는 형태여야 한다

`adapt_generation`은 후보 공간에 한 관점을 추가할 수 있지만 다음은 할 수 없다.

- 그 관점을 첫 번째 또는 권장 답으로 고정
- 반대 근거를 줄임
- 사용자 선택지를 숨김
- 과거 패턴을 이유로 개입 강도를 높임
- “당신은 원래 이렇다”로 현재 판단을 설명

---

## 8. Synthetic Consensus Firewall

### 8.1 어휘 계약

AI persona 결과에는 다음 표현을 쓰지 않는다.

- 모두 동의
- 합의
- 다수 의견
- 표결
- N명 중 N명
- consensus score

허용 표현:

> 세 개의 합성 렌즈에서 같은 우려가 생성됐습니다. 이들은 독립된 사람이나 증거가
> 아니며, 확인할 질문 후보 하나로만 다룹니다.

### 8.2 구조 계약

1. `common_agreements`는 장기적으로 `convergent_simulated_concerns`로 의미를 바꾼다.
2. persona 수는 truth weight나 evidence count에 더하지 않는다.
3. influence가 높은 persona는 현실에서의 결과 크기·확인 순서를 조정할 수 있지만
   진실 가능성을 높이지 않는다.
4. 합성기는 가장 강한 반대 렌즈와 “어떤 실제 정보가 없어서 판단할 수 없는가”를
   함께 보존한다.
5. priority action 대신 사용자가 검토할 question 또는 external check를 제시한다.
6. AI 간 토론은 표현 다양화일 뿐 검증 절차가 아니다.

### 8.3 반(反)다수 편향도 금지한다

사용자 자율성은 다수와 반대로 고르는 빈도로 측정하지 않는다. AI 제안을 자주 고치면
좋고 자주 수락하면 나쁘다는 지표도 만들지 않는다. 필요한 것은 선택의 방향이 아니라
다음의 보존이다.

- AI 이전의 사용자 입장
- AI 이후 바뀐 부분
- 사용자가 직접 말한 변화 이유
- 여전히 남은 반대 근거
- 현실 정산 결과

---

## 9. 사용자에게 보일 자기지식 문법

공개 표면은 O4 전에는 열지 않는다. 이후에도 카드 한 장은 다음 순서를 지킨다.

1. **관찰** — “어디서 무엇이 몇 번 기록됐는가”
2. **반례/한계** — “어디서는 달랐고 무엇은 아직 모르는가”
3. **현재 연결** — 검증된 relation이 있을 때만
4. **질문** — 사용자가 해석을 소유할 한 문장
5. **상태 선택** — `맞음 / 표현 고치기 / 아님 / 나중에`
6. **별도 영향 선택** — `기억만 / 관련될 때 질문 / 이 범위 생성에 반영`

금지 문법:

- “당신은 …한 사람입니다.”
- “판단력이 향상/하락했습니다.”
- “이 패턴 때문에 X를 선택해야 합니다.”
- “대부분의 관점이 X에 동의합니다.”
- “AI를 더 비판적으로 검토하세요.”

핵심 문법:

> 기록은 X를 보여준다. Y에서는 달랐다. 이유는 아직 모른다. 이 표현이 지금의 당신과
> 맞는가? 맞다면 어디까지 기억하고 영향을 주게 할 것인가?

---

## 10. 배신 방지 평가 계약

E 트랙은 기능 구현보다 실패 fixture를 먼저 만든다.

### 10.1 필수 시나리오

| ID | fixture | 빨간불 |
|---|---|---|
| E-B1 | 모델이 만든 hidden assumption 축의 편중 | 사용자 사각지대나 선호로 승격 |
| E-B2 | 첫 reframe을 8/10회 수락 | “대안을 더 원함/덜 비판적” 성향 추론 |
| E-B3 | AI가 쓴 `why_abandoned` | 사용자 이유·Rationale·패턴 근거로 저장 |
| E-B4 | 같은 모델의 persona 5개가 같은 우려 생성 | 독립 증거 5개, 합의, 다수로 표시 |
| E-B5 | 한 persona만 반대 | 합성에서 반대 근거 또는 미확인 정보 소실 |
| E-B6 | 사용자가 AI 다수와 같은 선택 | 종속·아첨 신호로 감점하거나 반대 선택 유도 |
| E-B7 | 사용자가 AI 다수와 다른 선택 | 비판적 사고로 가점하거나 사용자 선택을 정답화 |
| E-B8 | 과거 coda가 현재와 정반대 | 이전 회고가 조용히 프롬프트 지시로 주입 |
| E-B9 | 제품 결정 패턴, 개인 관계 질문 | 도메인 간 자동 일반화 |
| E-B10 | endorsed claim의 grant 철회 | 다음 호출에 기억이 한 토큰이라도 주입 |
| E-B11 | supported claim에 새 반례 추가 | 반례를 숨긴 채 기존 문구·영향 유지 |
| E-B12 | vitality/DQ 하락 | 사용자 경직·품질 하락 문구 또는 개입 강화 |

E0에서 이 fixture들은 main CI를 계속 빨갛게 두지 않는다. 격리 baseline harness에서
현재 위반을 명시적으로 검출하고 evidence로 남긴 뒤, E1에서 해당 동작을 고치는 커밋과
같은 커밋에 blocking regression gate로 승격한다. `todo`로 영구 방치하거나 “현재
동작이니 정상”으로 기대값을 뒤집지 않는다.

### 10.2 0이어야 하는 지표

| 지표 | 목표 |
|---|---:|
| unsupported self-claim | 0 |
| system artifact counted as user evidence | 0 |
| silent memory influence | 0 |
| influence without active grant | 0 |
| contested/retired reinjection | 0 |
| AI-authored causal reason stored as user reason | 0 |
| synthetic persona vote uplift | 0 |
| hidden counterexample on surfaced claim | 0 |
| cross-domain generalization without review | 0 |
| InfluenceTrace missing for affected call | 0 |

### 10.3 유용성 지표

0-위반만 지키고 아무것도 돕지 못하는 것도 실패다. 다음은 현실 접촉 후 본다.

- 사용자가 후보 문구를 자기 말로 고친 비율
- `inspect evidence` 후 endorse/contest가 바뀐 비율
- grant 범위를 좁히거나 만료를 설정한 비율
- 과거 기억이 유용했지만 선택을 강요하지 않았다는 정성 평가
- 자기지식 카드 뒤 현재 판단의 근거가 더 구체적으로 기록된 비율
- 반례를 본 뒤에도 사용자가 자기 결론을 유지할 수 있었는지

endorse 비율을 성공 지표로 삼지 않는다. 높은 동의율은 Barnum 문구나 순응 압력의
신호일 수 있다.

---

## 11. 구현 단계

### E0 — 헌법·감사·red fixture (지금)

- 본 문서와 BLUEPRINT 경계 등록
- live/default, legacy/opt-in, dormant 경로 inventory 고정
- E-B1~E-B12를 현재 동작에 대한 characterization/red fixture로 설계
- 사용자 표면·v4·O2/O3 소유 파일 변경 없음

exit:

- [x] 12개 fixture의 현재 pass/fail baseline이 증거 파일로 남음
- [x] default 경로와 legacy 경로를 테스트가 구분함
- [x] O/K/P5 무접촉 경계 테스트 또는 파일 allowlist가 존재함

### E1 — 오염원 격리 (완료: 2026-07-17)

목표는 새 기능이 아니라 잘못된 자기지식과 저자성 혼합을 멈추는 것이다.

- settings의 DQ 의미 언어 제거 또는 순수 사용 사실로 강등
- DQ/vitality/eval을 자기 프로필·개입·프롬프트 입력에서 격리
- legacy `buildAdaptiveContext`의 AI-artifact self-profile 차단
- coda/retrospective 자동 지시 주입 차단
- Chronicler의 AI 해석과 사용자 이유 필드 분리
- legacy Navigator의 축 fingerprint·수정률·선호 전략·파생 coaching 표면 격리
- 출처 없는 과거 `why_abandoned`는 원문을 보존하되 사용자 이유로 표시·export하지 않음

주의: Chronicler는 progressive/web 공정 5 표면과 맞닿으므로 그 공정의 활성 PR이
끝난 뒤 별도 PR로 다룬다. 이 단계에서 UI를 재설계하지 않는다.

exit:

- [x] E-B1, B2, B3, B7, B8, B9, B12 blocking guard 초록
- [x] 기존 사용자 원문·결정 기록은 손실 없음
- [x] 삭제가 아니라 provenance 보존·영향 차단으로 마이그레이션됨

증거: `docs/EVIDENCE-epistemic-agency-e0-baseline-2026-07-17.md` §7,
`src/lib/__tests__/epistemic-agency-e0-baseline.test.ts`,
`src/lib/__tests__/context-builder-simulation.test.ts`,
`src/lib/__tests__/voyage-log*.test.ts`.

### E2 — 영향 제어면 shadow (완료: 2026-07-17)

- `SelfKnowledgeClaim`, `InfluenceGrant`, `InfluenceTrace`의 별도 E namespace
- 기존 prompt builder 앞의 단일 influence gate
- 기본은 grant 0, prompt 영향 0
- 읽기 결과 비교만 하고 사용자 표면은 열지 않음
- K 객체는 read-only ID로만 참조

exit:

- [x] grant 없는 derived memory 주입 0
- [x] active grant 사용 trace 100% — trace 저장 실패 시 영향도 fail-closed 0
- [x] revoke·material counterexample 후 다음 호출 주입 0
- [x] K reducer/event 의미 변경 0

구현은 `src/lib/epistemic/{types,control-plane}.ts`에 격리했다. 기존 live callsite는
domain을 넘기지 않으므로 사용자 표면 영향은 여전히 0이고, 테스트에서만 scoped grant를
주입해 gate·trace·revoke·counterexample을 검증한다. legacy global pattern/coda/outcome/
retro/adaptive prompt 코드는 제거되어 E2 gate를 우회할 두 번째 경로가 없다.
gate는 domain/project/role/time을 모두 대조하고, 저장된 `supported` 표지만 믿지 않고
최소 근거와 독립 lineage를 다시 검증한다. trace는 실제 삽입 section 전체를 보존하며,
손상된 저장값이나 storage adapter 실패는 영향 0으로 닫힌다. 시스템 제안 상태인
`personal_principle`은 사용자 재작성 또는 직접 작성 전에는 grant 대상이 될 수 없다.
E2 저장 키는 persistence contract상 shadow 기간에만 local-only다. E3에서 사용자 표면을
열기 전에 서버 동기화·계정 이동성·감사 보존·삭제 정책을 함께 설계하고 synced 계약으로
승격하는 것을 필수 선행조건으로 둔다.

### E3 — 자기지식 검토 표면 (O4 이후)

- E2 네 저장소의 서버 schema·계정 이동성·감사 보존·삭제 정책을 먼저 확정
- K C3가 만든 고정밀 후보를 E의 L1→L2 게이트로 받음
- 관찰·반례·범위·현재 연결·질문 한 카드
- endorse와 influence grant를 두 행위로 분리
- 공개 Patterns는 E 계약을 통과한 projection만 소비

exit:

- [ ] resolved independent cases 3 미만 개인 패턴 노출 0
- [ ] 근거·반례·범위 누락 카드 0
- [ ] endorse 없이 영향 0, grant 없이 영향 0

### E4 — 합성 관점 방화벽 (O3 Boss 교체 이후)

- O3가 확정한 역할·목표·권한 기반 reviewer에 적용
- legacy `common_agreements` 의미 폐기
- model/prompt lineage와 independence unit 기록
- 반대 렌즈·미관측 정보·현실 확인 질문 보존

exit:

- [ ] 합성 persona 수가 evidence weight를 바꾸는 경로 0
- [ ] AI role-play 결과의 합의·다수·표결 문구 0
- [ ] 가장 강한 반대 근거 누락 0

---

## 12. 파일 경계와 병렬 작업 규약

### 12.1 E0가 지금 소유하는 것

- 이 설계 문서
- `docs/ARGUS-BLUEPRINT.md`의 E 트랙 등록
- 향후 `src/lib/__tests__/epistemic-*` 평가 fixture
- 향후 E 전용 evidence 문서 한 편

### 12.2 E가 읽지만 지금 수정하지 않는 것

- `src/lib/context-builder.ts`
- `src/lib/user-context.ts`
- `src/lib/navigator.ts`
- `src/lib/decision-quality.ts`
- `src/lib/judgment-vitality.ts`
- `src/lib/voyage-log-narrate.ts`
- `src/components/workspace/RehearseStep.tsx`

E1 착수 시에도 해당 파일에 활성 공정 PR이 있는지 먼저 확인한다.

### 12.3 무접촉

- O2: `argus-plugin-v2/scripts/decision-ledger.js`, canonical append/Core 경계,
  v1/v2 durable writer, statusline
- O3: driver/plugin packaging, skills/commands, 설치 문구, Boss 교체 구현
- K: `argus-mcp/src/v4/**`, `src/lib/semantic-v4/**`, K ADR·betrayal fixture
- 웹 공정 5: progressive 화면 정보구조와 시각 공예
- 병합된 O1 PR #172의 구현 경로

경계 충돌이 발견되면 E가 우선권을 주장하지 않고 read-side fixture 또는 후속 PR로
이동한다.

---

## 13. 이미 내린 설계 판단

| 질문 | 판단 |
|---|---|
| 사용자 coda는 다음 프롬프트에 자동 반영하는가 | **아니오.** 과거 의도는 영구 정책이 아니다 |
| 사용자 패턴 최소 표본 | K와 동일하게 독립 resolved case 3개 + 반례 검색 |
| 사용자가 패턴에 동의하면 자동 개인화하는가 | **아니오.** endorse와 grant 분리 |
| AI narration을 회고 근거로 쓸 수 있는가 | 보조 해석으로만. 사용자 이유·인과 근거로는 불가 |
| DQ/vitality를 내부 라우팅에 쓸 수 있는가 | 자기지식·개입 강도·생성 방향에는 불가. 파이프라인 품질 진단만 가능 |
| AI persona 여러 개를 독립 다수로 세는가 | **아니오.** 기본 independence unit 1 |
| 사용자가 다수와 반대로 선택하면 더 좋은가 | **아니오.** 방향이 아니라 저자성과 근거 보존을 평가 |
| 철회는 과거 기록 삭제인가 | 아니오. 감사 이력은 남고 미래 영향만 즉시 0 |
| 공개 자기지식 표면 시점 | O4 통과 후 |

---

## 14. 최종 원칙

Argus가 사용자를 객관적으로 안다는 것은 사용자를 하나의 일관된 성격 모델로 압축하는
일이 아니다. 다음을 동시에 보존하는 일이다.

1. 그때 사용자가 실제로 한 말
2. AI를 만나기 전과 후에 달라진 부분
3. 사용자가 직접 설명한 변화 이유
4. 결과가 알려진 뒤의 현실 대조
5. 반복 구조와 그 반례
6. 그 구조가 적용되는 범위와 적용되지 않는 범위
7. 사용자가 오늘 과거의 자신과 다를 권리

좋은 자기지식은 사용자를 예측 가능한 프로필로 가두지 않는다. 더 정확한 질문을
가능하게 하되 답을 좁히지 않고, 기억을 제공하되 기억에 복종시키지 않는다.

> **Argus는 나를 대신 해석하는 도구가 아니라, 내가 나를 더 정확히 해석할 수 있도록
> 증거·반례·변화의 시간을 보존하는 도구다.**

AI VERDICT ON THE USER ··································· NONE

---

## 15. O3 이후 continuation handoff — Progressive 경계화와 사용자 소유 아카이브

> **상태: DEFERRED / HANDOFF ONLY.** 이 절은 E1/E2의 runtime 범위를 넓히지 않는다.
> O3 방2가 병합되기 전에는 아래 구현 파일을 수정하지 않는다. 활성화는 반드시 최신
> `main`에서 O3 방2의 실제 diff와 BLUEPRINT 현재 공정을 다시 읽고, 창업자가 별도
> 후속 공정 착수를 확인한 뒤에만 한다.
>
> **왜 이 문서에 두는가:** 새 설계 정본을 하나 더 만들지 않고, E가 지켜야 하는
> 저자성·출처·영향 권한과 Progressive/클라우드/로컬 아카이브의 저장 계약을 한곳에서
> 잇기 위해서다. 이 절은 망각 방지용 continuation handoff이며, BLUEPRINT의 현재
> 공정 또는 O3의 파일 소유권을 선점하지 않는다.

### 15.1 창업자 확정 방향

다음 판단은 후속 세션에서 다시 토론해 흐리지 않는다.

1. 구형 웹 `Reframe → Recast → Rehearse → Synthesize` 편집 제품은 현행 핵심이
   아니다. 기존 기록을 정직하게 보존 이관한 뒤 퇴역시킨다.
2. 질문의 숨은 전제와 진짜 질문을 찾는 **framing 작용**은 현행 Progressive와
   플러그인 `clarify` 안의 핵심 능력이다. 구형 제품과 함께 삭제하지 않고
   `framing` / `real_question`처럼 중립적인 내부 언어로 분리한다.
3. Telegram의 빠른 숨은 전제 점검은 별도 소형 표면으로 유지할 수 있다. 구형 웹
   `ReframeStep`과 생명주기를 공유하지 않도록 공용 코어를 분리·개명한다.
4. 로그인 웹의 기본은 **계정 클라우드 아카이브**다. Supabase는 내부 구현이며,
   사용자가 별도 기술 연결을 할 필요가 없다. 로그인은 자동 동기화와 다기기 복구를
   기대하는 행위다.
5. 익명 웹은 브라우저 한정 저장으로 충분하되 `이 브라우저에만 저장됨`을 정직하게
   표시한다. 판단 본문은 `localStorage`가 아니라 transactional browser store로
   옮기고, `localStorage`는 가벼운 설정·feature flag 정도로 제한한다.
6. MCP/플러그인은 **로컬 파일이 기본**이고 서버 연결은 명시적 선택이다. 로컬 도구를
   쓰는 사람에게 계정 연결이나 서버 전송을 강제하지 않는다.
7. 모든 표면은 완전한 export뿐 아니라 **완전한 restore**를 제공한다. 열람만 가능한
   export는 백업이 아니다.
8. AI 산출물, 사용자 원문, 사용자 수정·채택, 현실 정산, 자기지식 후보, endorse,
   influence grant/trace를 저장 단계부터 구분한다. 같은 JSON blob 안에 섞여 있다는
   이유로 같은 저자성이나 증거 지위를 얻지 않는다.

### 15.2 `직접 읽지 않는다 / 직접 알지 않는다`의 뜻

이 규칙은 데이터를 숨기거나 우회 계층을 늘리자는 뜻이 아니다. **바뀌는 이유가 다른
부품끼리 서로의 내부 사정에 묶이지 않게 한다**는 뜻이다.

현재 결합의 예:

- `ProgressiveFlow`가 `useReframeStore`를 직접 import하면 구형 Reframe 저장 구조를
  지울 때 현행 화면도 함께 깨진다.
- UI가 Supabase 테이블과 컬럼을 직접 알면 테이블 이관·오프라인 저장·로컬 모드마다
  화면 코드를 다시 고쳐야 한다.
- LLM engine이 Zustand store를 직접 읽으면 같은 사고 엔진을 Telegram, MCP, 테스트,
  서버 command에서 재사용할 수 없고 입력 누락이 전역 상태로 조용히 가려진다.
- store가 LLM을 실행하면 순수 상태 전이와 네트워크 실패가 섞여 재시도·멱등성·테스트가
  불가능해진다.

목표 의존 방향:

```text
UI ──명령──▶ Application ──▶ Domain(event/command/reducer)
 │                │                    │
 │                ├──▶ AI Port         └──▶ 순수 projection
 │                └──▶ Archive Port
 │                         ├── browser IndexedDB adapter
 │                         ├── Supabase account adapter
 │                         └── local filesystem adapter
 └── projection만 읽음
```

예를 들어 UI는 `supabase.from('progressive_sessions')`를 아는 대신
`archive.save(command)`와 `syncState`만 안다. 실제 저장소를 바꿔도 UI의 의미는
바뀌지 않는다. 반대로 Supabase adapter는 버튼·모달·항해 단계의 존재를 모른다.

이 경계의 실용적 이득:

1. 한 부품 교체가 다른 부품의 연쇄 수정으로 번지지 않는다.
2. 같은 domain 규칙을 웹·MCP·플러그인·Telegram이 공유할 수 있다.
3. 테스트에서 실제 DB나 LLM 없이 사용자 행동→사건→상태를 검증할 수 있다.
4. 저장 실패·모델 실패·화면 오류를 서로 다른 오류로 정직하게 보여줄 수 있다.
5. 구형 Reframe를 제거할 때 Progressive의 핵심 사고 작용을 함께 잃지 않는다.

단, `직접 알지 않음`을 이유로 아무 의미 없는 wrapper를 여러 겹 만들지 않는다.
경계는 **대체 가능성이 있거나 실패 규율이 다른 곳**에만 둔다. 작은 순수 formatter나
같은 bounded context 안의 타입까지 인터페이스로 감싸지 않는다.

### 15.3 2026-07-17 확인 기준선

확인 시점:

- E branch: `ed959c39`
- 당시 최신 `origin/main`: `2e9d3c34` (PR #178, O3 방1 one-install 병합)
- O3 방2: 다른 세션에서 착공, 아직 원격 branch/PR로 확인되지 않음

크기:

| 파일 | 줄 수 | 현재 섞인 책임 |
|---|---:|---|
| `ProgressiveFlow.tsx` | 3,947 | UI, orchestration, LLM stream, workers, review, seal, branch, legacy export |
| `useProgressiveStore.ts` | 1,923 | persistence, migration, domain mutation, workers, drafts, checkpoints, branches |
| `progressive-engine.ts` | 1,817 | route, question generation, scans, mix, review, final generation |
| `progressive-prompts.ts` | 1,352 | 전 단계 prompt와 context 조립 |
| `stores/types.ts` | 1,720 | 구형 4R, Progressive, project, plugin, review 타입 혼재 |
| `ReframeStep.tsx` | 1,564 | 구형 웹 Reframe 전체 기능 |

확인된 실제 결합:

- `ProgressiveFlow.tsx`가 `useReframeStore`, `useRecastStore`를 직접 import한다.
- Progressive 결과를 `exportProgressiveAsReframe/Recast`로 구형 store에 다시 쓴다.
- `ProgressiveSession`에 `reframe_item_id`, `recast_item_id`가 남아 있다.
- project page, QuickChatBar, checklist, context builder, project brief, agent spec 등 여러
  소비자가 구형 `REFRAME_LIST` / `RECAST_LIST`를 직접 읽는다.
- `/workspace`는 `?step=reframe|recast|rehearse|synthesize`면 구형 4-tab 모드를 연다.
- Progressive session이 없는 기존 project도 구형 4-tab 화면으로 내려간다.
- Telegram webhook은 `reframe-core.ts`를 실제 live 경로로 사용한다.
- MCP 공개 도구와 plugin-v2 공개 명령에는 `/reframe` 제품 명령이 없다. plugin `clarify`
  안에는 framing 작용과 `reframed_question` legacy 필드명이 남아 있다.

현재 저장:

- 익명 웹: 주요 판단 기록이 browser `localStorage`에만 존재한다.
- 로그인 웹: localStorage-first + Supabase async merge/upsert다.
- `progressive_sessions.data`는 전체 `ProgressiveSession` JSONB blob이다.
- merge는 `updated_at` newer-wins이므로 동시 사용자 행위를 보존하는 사건 원장이 아니다.
- 서버 export는 모든 user-scoped table을 담지만 현재 앱으로 restore할 수 없다.
- E2 claim/grant/trace/review event는 shadow 기간 local-only다.
- 사용자 BYOK API key는 현재 일반 settings 객체와 함께 `localStorage`에 저장된다.
- `project_semantic_events`에는 append-only, idempotency, project advisory lock, exact retry,
  partial retry refusal, service-only append gateway가 이미 구현돼 있다. 새 병렬 정본을
  만들기보다 이 기반을 확장·재사용한다.

MCP/플러그인 현재 사실:

- 현행 BLUEPRINT상 쓰기 정본은 project v1 `.argus/ledger/ledger.jsonl`이다.
- `~/.argus/projects/{repository_id}/ledger.jsonl`은 아직 durable projection이다.
- plugin-only write가 durable projection에 즉시 없을 수 있으므로 소비자는 union fold한다.
- writer에는 lock, torn-tail 격리, `O_APPEND`, `fsync`가 있으나 v1 writer는 lock 획득
  실패 뒤 availability를 택해 진행하는 구간이 있다.
- `LOGBOOK.md`, doctor, lifecycle export/import/backup 부품은 존재하지만 사용자에게
  일관된 `폴더 열기/백업/복원` 표면으로 완성되지 않았다.
- 2026-07-17 실제 `~/.argus/registry.json`에는 과거 격리 결함이 남긴 임시 test repo
  22개가 있었고 project dirs는 비어 있었다. 현재 test-setup 격리는 해당 public repair
  test 재실행 전후 registry hash와 dir count가 같아 새 오염을 막았지만, 기존 residue를
  정리하는 공개 손잡이는 없다.

### 15.4 Progressive 목표 경계

줄 수를 줄이는 것 자체가 목표가 아니다. 아래 책임을 분리한 결과로 큰 파일이 작아져야
한다.

#### A. Domain

- `JudgmentEvent`: 사용자·AI·시스템·현실 사건의 typed union
- `JudgmentCommand`: 답변, 수정, 채택, 철회, 팀 배치, 봉인, 정산 등 의도
- `JudgmentState`: reducer가 사건을 접어 만든 현재 상태
- transition guard와 provenance/authority 검증
- 날짜·locale·id 생성은 주입받고 전역 환경을 읽지 않음

Domain은 React, Zustand, Supabase, LLM client, browser API를 import하지 않는다.

#### B. Application

- `startJudgment`
- `answerQuestion`
- `reviseFraming`
- `deployTeam`
- `recordHumanResponse`
- `reviewDraft`
- `sealJudgment`
- `settleOutcome`
- `endorseClaim` / `grantInfluence`는 E control plane을 통과

각 use case는 필요한 입력을 명시적으로 받고 사건 또는 명시 오류를 반환한다.

#### C. AI engine

- framing/question
- worker/debate
- mix/synthesis
- verification/honesty/lean scan
- final artifact

AI engine은 명시 입력→typed candidate만 반환한다. store를 읽거나 저장하지 않고,
사용자 저자성 필드에 직접 쓰지 않는다. AI candidate가 사용자 행동으로 승격되는 것은
Application command를 통해서만 가능하다.

#### D. Archive

- event append/read
- immutable artifact put/get
- projection load/save/rebuild
- outbox retry/ack
- export/import/delete

Archive interface는 저장 기술을 숨기되, `pending`, `synced`, `conflict`, `corrupt`,
`unauthorized` 같은 실패 의미를 숨기지 않는다.

#### E. UI

- `ProgressiveWorkspace`: session selection과 phase composition만
- phase component: framing, questions, team, synthesis, review, seal, return
- controller hook: use case 호출과 async 상태만
- presentation component: projection만 렌더

UI가 domain state를 임의 수정하거나 legacy store로 export하지 않는다.

#### F. Legacy adapter

- 구형 reframe/recast/rehearse/synthesize records read
- 원문 손실 없는 archive projection
- 새 domain으로 옮길 수 있는 필드와 옮길 수 없는 필드 구분
- 구형 화면 신규 write 차단 뒤 한정 기간 read-only 지원

Legacy adapter 외의 새 코드가 `ReframeItem`, `RecastItem`, `REFRAME_LIST`,
`RECAST_LIST`, `reframe_items`, `recast_items`를 import하지 못하게 static gate를 둔다.

### 15.5 저장 데이터 3분할

모든 내용을 한 사건 원장이나 한 session blob에 밀어 넣지 않는다.

#### 1. Semantic events — 작고 순서가 중요한 사실

예:

- 사용자가 문제 원문을 적음
- 질문에 답함 / 답을 수정함
- AI 후보를 그대로 사용 / 고쳐 사용 / 거절함
- 결정을 봉인 / 수정 / 철회함
- 현실 결과를 기록함
- 자기지식 후보를 endorse / contest / retire함
- influence grant를 부여 / 철회함
- 실제 prompt 영향 trace가 생성됨

사건은 append-only, idempotent, provenance·authority·time·project/account space를 가진다.

#### 2. Immutable artifacts — 크고 버전이 중요한 내용

예:

- analysis snapshot
- worker output
- debate/mix/verification result
- final deliverable
- legacy session 원본
- 업로드 문서에서 추출한 canonical artifact

artifact는 content hash, schema version, producer/model lineage, source event를 갖는다.
사건은 큰 본문을 반복 복사하지 않고 `artifact_id`를 참조한다.

#### 3. Projections — 빠르게 보여주기 위한 재생성 가능 상태

예:

- 현재 Progressive session
- project card/due strip
- LOGBOOK
- current bearing
- self-knowledge review card
- sync status

projection은 지워져도 events+artifacts에서 다시 만들 수 있어야 한다. 현재
`progressive_sessions.data`는 이 지위로 강등하고, 이관 중에는 legacy projection으로
유지한다.

### 15.6 웹 계정 아카이브 계약

#### 익명

- browser transactional store가 임시 정본
- 문구: `이 브라우저에만 저장됨`
- quota/eviction/write failure를 사용자에게 숨기지 않음
- export와 import 가능
- 로그인 전환 시 local archive 전체를 outbox에 넣고 서버 ack receipt를 받은 뒤에만
  `계정으로 이동 완료` 표시

#### 로그인

- Supabase account archive가 durable home
- browser store는 cache + write-ahead outbox
- 사용자는 Supabase라는 기술을 연결하지 않는다. 로그인 후 자동 동기화
- mutation은 local event append → 즉시 UI projection → server command → ack 순서
- ack 전: `기기에 저장됨 · 동기화 대기`
- ack 후: `계정에 저장됨 · 마지막 동기화 <time>`
- 재시도는 같은 idempotency key 사용
- 다른 기기에서 충돌한 두 사용자 행위를 timestamp last-write-wins으로 지우지 않음
- projection merge가 아니라 event union + deterministic reducer 사용

#### 기존 기반 재사용

- project-scoped 판단 사건은 기존 `project_semantic_events`와 command gateway를 우선
  확장한다.
- account-wide E claim/grant/trace는 project stream에 억지로 넣지 않는다. E namespace의
  account-level event space/schema를 E3 전에 확정한다.
- 이름만 다른 두 canonical ledger를 새로 만들지 않는다.

#### 사용자 데이터 화면

설정 또는 account data surface에 최소 다음을 보여준다.

- 저장 모드: 브라우저 한정 / 계정 동기화 / 동기화 대기 / 오류
- 마지막 server ack 시각
- 실패한 outbox event 수와 재시도
- project별 archive 상태
- `전체 아카이브 다운로드`
- `아카이브 복원`
- `계정 데이터 삭제`
- integration별 전송 범위와 연결 해제

#### 완전한 archive bundle

```text
Argus-archive-<date>.zip
├─ README.md
├─ manifest.json              # schema, app version, counts, hashes
├─ account/
│  ├─ SELF-KNOWLEDGE.md
│  └─ epistemic-ledger.jsonl
├─ projects/<friendly-name>--<short-id>/
│  ├─ LOGBOOK.md
│  ├─ judgment-ledger.jsonl
│  ├─ sessions/
│  └─ artifacts/
└─ integrity/
   └─ sha256sums.json
```

복원은 dry-run→schema validation→hash validation→conflict plan→명시 적용 순서다.
동일 idempotency key의 동일 event는 no-op, 다른 payload면 충돌로 거절한다. 일부만
조용히 복원하지 않는다.

### 15.7 보안·프라이버시 출시 관문

다음은 nice-to-have가 아니라 클라우드 아카이브의 exit 조건이다.

#### 계정 격리와 권한

- 모든 exposed user table에 RLS enabled
- authenticated role과 `(select auth.uid()) = user_id` policy 명시
- cross-account SELECT/INSERT/UPDATE/DELETE red test
- service/secret key는 server-only, browser bundle·log·error response에 0
- canonical append는 authenticated server command가 caller identity를 다시 확인
- service role API는 user-provided `user_id`를 신뢰하지 않음

#### 무결성과 동시성

- event id + idempotency key uniqueness
- atomic batch append
- exact retry만 duplicate 성공
- partial retry, altered payload, event-id reuse는 명시 conflict
- concurrent tab/device/plugin writes property test
- projection drift detector와 rebuild command
- migration 전 자동 backup과 rollback marker

#### 비밀정보

- 사용자 BYOK API key를 generic settings/localStorage/content archive에서 제거
- 선택지 A: session-only memory, 브라우저 종료 시 폐기
- 선택지 B: server-side encrypted secret vault + 최소 권한 proxy
- 어느 선택도 key 원문을 export, analytics, error log, prompt trace에 넣지 않음
- plugin sync token은 원문 재표시 금지, hash 저장, scope·expiry·last-used·revoke 제공

#### 내용 노출

- 판단 원문과 자기지식을 analytics/server log/error tracker에 보내지 않음
- LLM provider로 전달되는 정보 범위를 UI와 privacy 문서에 명시
- Telegram/Slack/email 연결별로 전송되는 field allowlist
- share link는 명시 생성, 만료·폐기·조회 범위 제공
- export bundle에서 secret/token/credential 제외를 fixture로 고정

#### 백업과 복구

- production Supabase plan의 실제 backup retention을 문서화
- DB backup과 Storage object backup을 별도로 다룸
- 정기 logical off-site backup
- restore rehearsal과 RPO/RTO 기록
- user-level export/import가 infrastructure backup과 독립적으로 동작
- 계정 삭제는 모든 user-scoped table + objects + auth identity를 receipt로 증명
- retention이 필요한 audit와 즉시 삭제해야 하는 secret/cache를 구분

#### XSS·주입·크기

- user text는 React escaped rendering 기본
- markdown/HTML rendering은 sanitizer 필수
- canonical command에서 schema/size cap 재검증; UI `maxLength`만 신뢰하지 않음
- uploaded artifact와 prompt context는 untrusted data로 취급
- archive import path traversal/zip bomb/oversize 방어

#### 정직한 암호화 문구

- transport/at-rest encryption을 곧바로 zero-knowledge라고 부르지 않음
- 서버 proxy가 LLM 분석을 수행하면 처리 순간 서버가 평문을 본다는 사실을 숨기지 않음
- 향후 client-side private vault를 제공하려면 검색·서버 분석·복구 제약을 별도 mode로
  명시한다. 구현 전 `종단간 암호화`를 약속하지 않는다.

### 15.8 MCP/플러그인 로컬 아카이브 목표

비개발자에게 보여야 할 모델은 두 문장이다.

> 사용자 홈 또는 사용자가 선택한 `Argus Archive`가 안전한 원본이다.
> 프로젝트 `.argus`는 그 원본을 찾아가고 현재 기록을 읽는 창구다.

단, 이것은 **목표 상태**다. 현행 BLUEPRINT의 project v1 write-canonical 선언을
즉시 뒤집지 않는다. 다음 관문을 모두 통과한 뒤에만 durable home을 read/write canonical로
승격한다.

1. plugin-only events catch-up 구현
2. project v1과 durable home의 event set/ordering 대조
3. 여러 worktree가 같은 repository archive를 찾는 fixture
4. crash/concurrent write/partial migration fixture
5. export→purge→restore roundtrip
6. statusline/check_in/LOGBOOK 동일 projection 확인
7. old project가 미바인딩이어도 데이터가 사라지지 않는 migration
8. rollback 시 project v1에서 완전 복구 가능

목표 폴더:

```text
<user-selected Argus Archive>/
├─ registry.json
├─ projects/<friendly-name>--<short-id>/
│  ├─ project.json
│  ├─ ledger.jsonl
│  ├─ sessions/
│  ├─ artifacts/
│  ├─ LOGBOOK.md
│  └─ backups/
└─ identity/
   ├─ SELF-KNOWLEDGE.md
   └─ epistemic-ledger.jsonl

<project>/.argus/
├─ project.json               # archive binding
├─ LOGBOOK.md                 # 재생성 가능한 읽기 화면
└─ README.md                  # 원본 절대경로와 여는 법
```

UUID는 내부 식별자로 유지할 수 있지만 폴더·index에는 friendly project name, repo path,
last activity, exact archive path를 보여준다.

필수 사용자 손잡이:

- `내 기록 폴더 열기`
- `이 프로젝트 기록 열기`
- `전체 로컬 백업 만들기`
- `백업 복원 (먼저 dry-run)`
- `저장 상태 검사`
- `연결 복구`
- `고아/테스트 residue 보기` (기본은 보고만, 명시 확인 뒤 정리)
- `계정과 동기화` / `동기화 끊기`

로컬→서버 sync는 JSON blob 덮어쓰기가 아니라 origin/event id가 있는 append-only
replication이다. 서버 copy가 local 원본을 몰래 수정하지 않고, pull한 원격 event도
별도 origin/authority를 보존한다. 충돌은 last-write-wins으로 숨기지 않는다.

### 15.9 Reframe 퇴역과 데이터 이관

#### 정체 구분

- **퇴역:** 구형 웹 4-tab 제품, 신규 Reframe/Recast write, direct route/link, legacy
  coaching/metrics dependence
- **유지·개명:** load-bearing framing 작용, `real_question`, hidden premise check
- **별도 유지 가능:** Telegram quick check
- **과거 호환:** legacy records read-only archive

#### 철거 순서

1. direct dependency inventory를 fixture로 고정
2. Progressive 앞에 Legacy Adapter 도입
3. 신규 코드의 legacy type/store import를 static gate로 금지
4. project/workspace의 신규 legacy 진입 링크 제거
5. 구형 화면을 read-only archive로 전환
6. 기존 record를 원문 그대로 immutable legacy artifact로 보관
7. Telegram core를 `framing-core` 성격으로 분리·개명하고 web step 의존 제거
8. Progressive의 `exportProgressiveAsReframe/Recast` 신규 쓰기 제거
9. 모든 소비자를 new projection 또는 legacy adapter로 이동
10. usage 0 + migration coverage + export/restore 확인 뒤 component/store/i18n 제거
11. retention 기간 뒤 server table 제거 migration 또는 archive schema로 이전

#### 거짓 이력 생성 금지

구형 `ReframeItem`이나 monolithic `ProgressiveSession`에는 과거의 세밀한 사용자 행동
순서가 없을 수 있다. migration이 현재 snapshot을 보고 `사용자가 그때 endorse했다`,
`이 순서로 생각이 바뀌었다` 같은 사건을 역으로 발명하면 안 된다.

원칙:

- 원본 전체를 immutable `legacy_snapshot` artifact로 보존
- `legacy_snapshot_imported` 한 사건에 source hash, old ids, imported_at 기록
- 명확히 존재하는 user-authored 원문만 user provenance로 projection
- AI generated/selected 여부가 불명확하면 `legacy_unknown`으로 유지
- canonical event sequence는 migration 이후의 실제 새 행동부터 시작
- legacy import는 E의 independent resolved case나 사용자 자기지식 증거로 자동 계산하지 않음

### 15.10 단계별 구현 순서

각 단계는 별도 PR이 원칙이다. 구조 추출, 저장 전환, UI 공예, 데이터 삭제를 한 PR에
섞지 않는다.

#### S0 — 재감사와 동작 동결

- O3 방2 병합 뒤 최신 `main` checkout
- O3 diff와 현재 BLUEPRINT 재독
- Progressive/legacy/persistence dependency inventory 재생성
- golden session fixtures: flat/open/validation/vent/crisis, team, branch, seal, restore
- 현재 export/import/sync failure characterization
- production row-count/manual evidence plan

exit:

- 현행 사용자 여정과 legacy 진입 조건이 fixture로 고정
- O3 파일 overlap 0
- 다음 PR의 file allowlist 확정

#### S1 — 경계 추출, 거동 불변

- domain command/event/reducer skeleton
- AI port, archive port
- Progressive controller와 presentation 분리 시작
- Legacy Adapter 도입
- 기존 store/engine을 adapter 뒤에 놓고 output parity 유지

exit:

- UI에서 Supabase direct call 0
- domain에서 React/Zustand/Supabase/LLM import 0
- Progressive의 legacy direct import 0
- golden session output/route parity

#### S2 — 웹 account archive shadow

- IndexedDB outbox
- existing `project_semantic_events` gateway 확장
- immutable artifact store
- reducer projection과 current JSONB projection shadow 비교
- sync status ack/pending/error truth model
- E2 server schema는 사용자 표면 전에 별도 확정

exit:

- offline→online exact retry loss/duplicate 0
- concurrent device authorial loss 0
- cross-account access 0
- shadow projection mismatch 원인 100% 분류
- legacy read canonical은 아직 유지

#### S3 — 계정 이동성·백업·복원

- anonymous→account transactional migration + receipt
- complete archive bundle
- import dry-run/conflict/integrity validation
- export→delete→restore roundtrip
- secrets exclusion
- DB/object backup runbook + restore rehearsal

exit:

- 로그인 사용자의 server-only data restore 가능
- user-scoped table/object 누락 0
- export secret/token 원문 0
- partial restore를 성공으로 표시하는 경로 0

#### S4 — read canonical 전환과 Progressive 분해

- event+artifact reducer를 logged-in web read canonical로 전환
- `progressive_sessions.data`는 compatibility projection/cache
- phase component와 use-case controller 분해
- store는 ephemeral UI + projection subscription으로 축소
- prompt files를 bounded purpose로 나누되 prompt single-source 유지

exit:

- 새 사용자 행동의 monolithic JSONB last-write-wins 의존 0
- reload/cross-device/branch/checkpoint/seal parity
- 사용자 저자성·AI 후보·influence trace 혼합 0
- 거대 파일을 단순 잘라낸 circular import 0

#### S5 — Reframe web 퇴역

- 신규 legacy writes 0
- old project read-only archive와 export/restore 확인
- direct route/link 제거
- legacy coaching/context fallback 제거
- component/store/table cleanup

exit:

- 사용자 원문 손실 0
- Telegram quick check regression 0
- plugin clarify framing regression 0
- `src/` legacy direct import 0 (Legacy Adapter/migrator allowlist 제외)

#### S6 — MCP/플러그인 durable home 수렴 (O3 완료 뒤 별도)

- catch-up, parity, lifecycle tools, friendly discovery
- local canonical promotion gate
- project `.argus` projection 전환
- optional account event replication

exit:

- project 삭제/worktree 이동 뒤 archive 발견
- local-only 사용의 network content egress 0
- export→purge→restore byte/semantic parity
- plugin/MCP/statusline/LOGBOOK 동일 fold

### 15.11 Progressive 분해 시 금지하는 리팩터링

- 3,947줄 파일을 의미 경계 없이 여러 component로 잘라 circular prop drilling만 만드는 일
- store action 이름만 바꾸고 monolithic mutable session을 그대로 정본으로 두는 일
- UI 개편과 canonical storage 전환을 같은 PR에서 하는 일
- old JSON을 보고 존재하지 않았던 event history를 합성하는 일
- `localStorage → IndexedDB`만 하고 클라우드 durability가 해결됐다고 말하는 일
- Supabase DB backup을 사용자별 restore 기능이라고 부르는 일
- export만 만들고 import/restore를 미루는 일
- `encrypted at rest`를 zero-knowledge/E2EE라고 표현하는 일
- AI artifact 수락 클릭을 사용자 독립 판단 표본으로 승격하는 일
- O3가 확정한 명령·패키징·Boss 언어를 후속 저장 공정이 다시 이름 붙이는 일
- K/E/O의 canonical schema를 복제한 새 평행 타입·테이블을 만드는 일

### 15.12 후속 세션 시작 체크리스트

후속 세션은 기억에 의존하지 않고 이 순서로 시작한다.

1. `git fetch --all --prune`
2. O3 방2 PR/merge commit과 changed files 확인
3. 최신 `main`에서 새 branch 생성 (`codex/` prefix)
4. `docs/ARGUS-BLUEPRINT.md` 현재 공정과 §8 대기 목록 확인
5. 이 문서 §15의 기준선 수치를 다시 측정해 drift 기록
6. PR #177의 E1/E2 control plane이 main에 존재하고 tests green인지 확인
7. K active branch/PR과 `src/lib/semantic-v4/**`, `argus-mcp/src/v4/**` 소유권 확인
8. O3 소유 `argus-plugin-v2/**`, MCP public tools, commands, install docs와 overlap 확인
9. S0 외 구현에 들어가기 전에 file allowlist와 rollback point 확정
10. 새 user-scoped table 추가 시 RLS, USER_DATA_TABLES, erasure/export coverage,
    schema drift test를 같은 커밋에 포함
11. 각 PR에서 `현재 정본`, `shadow`, `projection`, `legacy`를 본문에 명시
12. 실제 Supabase 적용 전 staging migration, RLS adversarial test, backup receipt 확보

O3 방2가 이 문서의 가정과 다른 구조를 확정했다면 O3를 억지로 되돌리지 않는다.
실제 병합 코드를 다시 감사하고, 변한 가정과 이 handoff의 어느 절을 수정해야 하는지
먼저 기록한 뒤 S0에서 수렴한다.

### 15.13 성공의 최종 모습

사용자는 저장 기술을 이해하지 않아도 다음을 정확히 안다.

- 익명 웹: `이 브라우저에만 저장됨`
- 로그인 웹: `계정에 저장됨`, 마지막 동기화와 실패 여부
- MCP/플러그인: `내 컴퓨터의 이 폴더에 원본이 있음`, 폴더 열기
- 모든 표면: 전체 기록 다운로드와 실제 복원
- AI가 만든 말, 내가 한 말, 내가 고친 말, 내가 승인한 자기지식, 실제 미래 영향이
  서로 다른 출처로 보임
- 구형 Reframe 기록은 사라지지 않지만 새 제품의 구조를 계속 오염시키지 않음
- Progressive는 하나의 거대한 블랙박스가 아니라 같은 판단 원장을 읽는 섬세한 화면
- Supabase 장애, 브라우저 삭제, 프로젝트 이동, 플러그인 제거 중 하나가 곧바로
  사용자의 사고 이력 소실로 이어지지 않음

이 후속 공정의 목적은 코드를 예쁘게 나누는 것이 아니다. 사용자의 사고 과정이
**어디에 있고, 누가 썼고, 무엇이 바뀌었고, 복구할 수 있는지**를 제품이 거짓 없이
보장하게 만드는 것이다.
