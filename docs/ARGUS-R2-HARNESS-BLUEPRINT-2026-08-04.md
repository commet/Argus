# ARGUS R2 HARNESS — 구현 설계도

Date: 2026-08-04
Status: **Track R · R2 산출물의 구현 정본. `ARGUS-METHOD-V1.0.md`를 코드로 옮기는 유일한 지도**
Canon: `docs/ARGUS-METHOD-V1.0.md`
승인 근거: BLUEPRINT §9.12 v1.0 확정 판정 — "R1·R2의 착공을 이 정본이 승인한다"

---

## 1. 무엇을 짓고 무엇을 짓지 않는가

**짓는다 (R2 offline harness):**

- v1.0 §10의 실행 계약을 **컴파일되고 테스트되는 TypeScript**로: typed
  envelope, deterministic validator(§10.6 기계 목록 14개 전부), event-sourced
  reducer(adoption gate·재유도·DORMANT), return scheduler(portfolio·chain·전역
  예산·backstop), 영향력 측정기(material edit·baseline coverage), prompt
  compiler(L0–L6, data-not-instructions), web/MCP projection parity.
- R1 씨앗: one-page facilitator card + gold case fixture 12건(30건 corpus의
  시작분 — **부분임을 명시**, 완성은 R1 exit 작업).

**짓지 않는다 (무접촉 경계):**

- 공개 UI, DB schema, canonical writer, MCP/plugin 명령, 알림 배관의 변경.
- LLM 호출 자체 — harness는 model의 **출력을 받는 쪽**이다. 실제 호출은
  R3-A/B에서 이 계약 위에 얹는다.
- `src/` 와의 어떤 import 관계도 만들지 않는다 (양방향 금지, 테스트로 강제).

## 2. 위치와 격리

```text
method-harness/
  types.ts          # 모든 enum·envelope·event·card 타입 (schema의 정본)
  constitution.ts   # §10.3 헌법 원문 + compilePromptPacket (L0–L6)
  ledger.ts         # LedgerEvent union, append-only Ledger, 조회 helper
  validator.ts      # §10.6 기계 검사 14종 — 거부/강등을 명시적으로 반환
  reducer.ts        # CaseState fold: adoption gate, 상태 전이, DORMANT, 재유도 입력 검증
  returns.ts        # return portfolio: chain, 전역 예산, date backstop
  influence.ts      # verbatim(material edit), baseline coverage, recall 기록
  projection.ts     # projectCard(state, 'web'|'mcp') — parity의 대상
  fixtures/
    gold-cases.ts   # 12 gold cases (부분 corpus, 축 커버리지 명시)
  __tests__/
    validator.test.ts
    reducer.test.ts
    returns.test.ts
    influence.test.ts
    projection-parity.test.ts
    constitution.test.ts
    fixtures.test.ts
    isolation.test.ts   # src/ ↔ method-harness/ 양방향 import 금지 가드
```

- 최상위 폴더 — Next 앱이 import하지 않으므로 번들에 들어가지 않는다.
- 루트 tsconfig의 `**/*.ts` 포함으로 `next build`가 strict 타입체크한다
  (테스트 파일은 기존 exclude 규칙대로 vitest만 본다).
- 루트 vitest가 테스트를 실행한다 (exclude 목록에 걸리지 않음).
- 외부 의존성 0 — validator·reducer의 결정론이 의존성 drift에 노출되지 않게
  한다.

## 3. 핵심 설계 결정

### 3.1 실패는 시끄럽거나 정직하다 (LLM-glue invariant의 코드화)

validator는 **조용히 고치지 않는다.** 모든 판정은 세 갈래의 명시적 결과다:

```ts
type Verdict =
  | { kind: 'pass' }
  | { kind: 'downgrade'; code: DowngradeCode; detail: string }  // 예: reframe→question
  | { kind: 'reject'; code: RejectCode; detail: string }        // 예: 저자성 전이 위반
```

downgrade는 v1.0이 규정한 강등(reframe→질문, directional→process 등)만
허용하고, 강등 사유를 envelope 밖으로 반환해 telemetry와 사용자 공개가
가능하게 한다. reducer는 위반 event를 받으면 **throw**한다 — 침묵 무시 없음.

### 3.2 Reducer는 event-sourced이고 append-only다

canonical 진실은 `LedgerEvent[]`뿐이다. `CaseState`는 fold의 결과이며 언제든
재계산 가능하다. overwrite가 물리적으로 불가능한 구조: 수정은 `supersedes`
event로만 표현된다. adoption gate는 fold 규칙이다 — `card_adopted` event가
없으면 CaseState에 Card가 존재하지 않는다.

### 3.3 재유도는 함수 시그니처로 강제한다

```ts
rebuildWorkingModelInputs(ledger, caseId): RederivationInputs
// 반환: 채택된 Card + source/observation events + granted lessons만.
// 이전 working model 산출물은 타입상 존재하지 않는다.
```

"이전 모델 산문을 넣지 말라"를 규범이 아니라 **타입이 막게** 한다.

### 3.4 시간은 주입된다

harness 함수는 `now: IsoTime`을 인자로 받는다. 내부에서 시계를 읽지 않는다 —
결정론·재생 가능성·테스트 용이성.

### 3.5 Validator의 ledger 대조는 lineage까지다

`valueClaimRefs` 검사: 참조 event 실존 → source='user' → authority∈{said,
adopted} → 인용문 정규화 부분 문자열 포함. **entailment는 검사하지 않으며,
그 한계를 코드 주석과 테스트 이름에 명시한다.**

## 4. 검사-대응표 (v1.0 §10.6 → 코드)

| # | 기계 검사 | 구현 위치 | 실패 동작 |
|---|---|---|---|
| 1 | move type enum | validator | reject |
| 2 | reframe falsifier | validator | downgrade → question |
| 3 | 질문 branches ≥ 2 | validator | reject question |
| 4 | 질문 ≤ 1 | types(단일 필드) + validator | 구조상 불가 + reject |
| 5 | valueClaimRefs lineage | validator + ledger | downgrade → process |
| 6 | 저자성 전이 | validator/reducer | reject |
| 7 | adoption 없는 canonical write | reducer | throw |
| 8 | overwrite | reducer (append-only) | 구조상 불가 |
| 9 | observed_later 병합 | reducer | throw |
| 10 | pushed×major×one_way directional | validator | downgrade + pulled 안내 |
| 11 | safety_route 추천 | validator | reject |
| 12 | event/signal trigger의 backstop | validator + returns | reject |
| 13 | 전역 return 예산 | returns | 대기열 |
| 14 | 재유도 입력 오염 | reducer (타입) | 구조상 불가 |

zero-tolerance 8항목 각각이 위 표의 검사에 대응됨을 `validator.test.ts`가
주석으로 명시한다. 대응 없는 항목(예: "한쪽 설명으로 타인 동기 판정")은
테스트 파일 상단에 **사람 감사 대상**으로 명시한다.

## 5. 테스트 전략

- **행마다 red**: v1.0 §10.7 실패표의 각 행 = 최소 1개 테스트.
- **경계의 가드**: isolation.test.ts가 src↔method-harness import를 grep으로
  차단 — 무접촉 경계의 기계화.
- **parity**: 같은 CaseState → projectCard(web)와 projectCard(mcp)의 의미
  필드(결정·이유·가정·다음 행동·귀환)가 동일함을 필드 단위로 비교.
- **fixture 정합**: gold case 12건이 corpus 축(가역성·병목 유형·route·
  숙련도·결과-과정 조합)을 커버함을 fixtures.test.ts가 집계 검증 — 부분
  corpus의 커버리지를 침묵시키지 않는다.
- **litmus**: "여기 wire가 조용히 끊기면 무엇이 빨간불이 되는가?" — 각 모듈
  테스트의 첫 케이스는 항상 위반 케이스다.

## 6. R3로 가는 연결부 (이 단계에서는 계약만)

- `ArgusTurn`을 생성하는 실제 LLM 호출은 R3-A에서 이 타입을 target schema로
  사용한다.
- 성능 예산(§10.2)의 계측 지점은 validator·reducer 진입/이탈 — 훅만 남기고
  측정은 R3-A에서.
- pilot harness(R3-B)는 이 모듈들을 그대로 import하고 대화 통로만 붙인다.
