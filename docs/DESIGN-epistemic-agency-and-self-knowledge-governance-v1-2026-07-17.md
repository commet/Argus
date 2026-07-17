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
