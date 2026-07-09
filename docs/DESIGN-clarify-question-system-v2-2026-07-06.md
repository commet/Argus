# Argus Clarify Question System v2 — 실행 설계서

Date: 2026-07-06
Status: **Execution-ready design** — supersedes `internal design notes` (CODEX 초안)
Rev: v2.1 — 심층 재검토 반영: premises-core 전문 검증(§3.1b), framing_confidence 자기보고 결함(§4.3b), "모르겠다"의 open_question 승격, 피로 감지 오탐 교정, validator 커버리지 확장
Executor: Opus/Sonnet 세션이 이 문서만 읽고 구현할 수 있게 쓴다.
Scope: Clarify 질문 시스템, 질문 품질 하한선, 전제 추적, judgment checkpoint 연결

Read-first (구현 전 필독):
- `CLAUDE.md` — Zero-Judgment Gate(특히 mirror clause) + LLM-glue invariant(Honest Structure)
- `src/lib/question-types.ts` — 현재 타입 시스템의 정본
- `src/lib/premises-core.ts` — **이미 존재하는 전제 모델** (이 문서의 §3이 핵심)
- Companion doc: `docs/DESIGN-judgment-checkpoints-v2-2026-07-06.md`

---

## 0. 이 v2가 CODEX 초안과 다른 점 (요약)

CODEX 초안의 방향은 옳다 — clarify의 목적을 "정보 수집"에서 "판단을 떠받치는
전제 드러내기"로 옮기는 것. 그 철학과 질문 예시·품질 게이트의 뼈대는 전부
계승한다. v2가 바꾸는 것은 다섯 가지다.

1. **전제 모델을 새로 만들지 않는다.** CODEX가 제안한 `JudgmentPremise`와
   거의 같은 것이 이미 main에 있다: `src/lib/premises-core.ts` (webapp review
   경로 + argus-mcp와 byte-for-byte 공유, `premises-core-drift.test.ts`로 고정).
   세 번째 병렬 전제 모델을 만드는 것은 Argus가 이미 데어본 one-brain-many-bodies
   드리프트를 재생산한다. → §3에서 재사용 설계.
2. **질문을 늘리지 않고 전제를 얻는다.** CODEX의 7-타입 체계는 질문 수를
   늘릴 위험이 있다. v2는 premise extraction을 *질문이 아니라 기존 질문의
   부수 효과*로 설계한다 — strategic_fork 답변이 전제를 생성하고,
   기존 weakness_check가 "가장 불안한 전제 고르기" 역할을 이미 한다.
   신규 질문 타입은 사실상 checkpoint_seed 하나뿐이고, 그마저 gated다. → §4.
3. **fire-gate를 프롬프트가 아니라 구조에 박는다.** 현재
   `pickNextQuestionType()`은 `request_type`을 아예 안 본다 — vent/flat 차단이
   경로 차단(R32)에만 의존하고 질문 엔진 자체엔 방어가 없다. 스파인 규칙
   "게이트가 형식보다 먼저"를 코드 시그니처 수준에서 강제한다. → §5.
4. **validator는 결정론 우선 + LLM judge는 abstain 가능한 보조.** 그리고
   validator 실패 경로(재생성 루프, fallback)를 LLM-glue invariant에 따라
   "조용히 나빠지는" 대신 "시끄럽게 실패하거나 정직하게 안전한" 구조로 만든다.
   현재 최악의 한 줄 — `progressive-engine.ts:490`의 fallback
   `"이 결과물을 누가 최종 판단해?"` — 는 Phase 0에서 즉시 제거한다. → §6.
5. **CODEX가 남긴 Open Questions 10개를 전부 결정한다.** 실행 세션이
   고민하다 멈추지 않게. → §10.

---

## 1. Fable 자기심문 — 이 설계를 퀀텀 점프시킨 질문들

이 문서는 아래 8개 질문을 스스로에게 던지고 답하는 과정으로 만들어졌다.
실행자는 구현 중 막히면 이 질문들로 돌아오라 — 각 답이 해당 섹션을 가리킨다.

**Q1. 이 설계가 참이라고 가정하는 것 중, 코드베이스가 반증하는 것은?**
→ "전제 모델을 만들어야 한다"가 반증됨. `premises-core.ts`가 이미 있고
MCP·review 경로와 드리프트 가드로 묶여 있다. 답: 만들지 말고 잇는다. (§3)

**Q2. 이 설계에서 스파인(zero-judgment + mirror clause)과 충돌하는 지점은?**
→ 세 곳. (a) checkpoint_seed가 기본 템플릿이 되면 flat 케이스에 체크포인트를
제조한다 — fire-gate가 형식보다 먼저 와야 함. (b) 답변 후 능동 피드백("이 선택은
X 전제를 택한 거예요")은 사용자의 답을 AI가 재해석하는 것 — ai_surfaced 표기
+ 수정/무시 escape 필수, 그리고 절대 성향 언어 금지. (c) Argus가 전제 confidence를
조용히 추정하는 것 — 내부 라우팅용은 OK, 사용자 노출은 수정 가능한 제안으로만. (§5, §7)

**Q3. LLM-glue 관점: 어느 와이어가 조용히 끊길 수 있나?**
→ (a) typed question의 effect 필드가 생산되고 소비되지 않는 것 — F2 소비 계약
테스트로 막는다. (b) LLM이 premise 필드를 누락하면 조용히 빈 배열 — honest gap
규칙으로 "전제 미확인" 상태를 명시한다. (c) validator 재생성 루프가 무한이면
비용 폭주, 조용히 포기하면 품질 붕괴 — 재시도 2회 상한 + 큐레이션된 fallback
풀 + `user_events` 로깅. (§6)

**Q4. 가장 레버리지 높은 최소 변경은?**
→ `progressive-engine.ts:490` fallback 문자열 교체. 한 줄로 품질 바닥이 올라간다.
Phase 0으로 분리해 다른 모든 것과 독립적으로 먼저 출하한다. (§9)

**Q5. 질문 수를 늘리지 않고 전제·체크포인트를 얻으려면?**
→ premise extraction을 질문으로 만들지 않는다. fork 답변의 snapshotPatch가
이미 hidden_assumptions를 재작성한다 — 그 지점에서 전제 후보를 함께 생성하고,
weakness_check(이미 존재)가 "가장 약한 전제 선택"을 담당한다. 순 질문 증가:
checkpoint_seed 최대 1개, 그것도 gated. (§4)

**Q6. 세 표면(webapp / argus-plugin-v2 / argus-mcp) 드리프트를 어떻게 막나?**
→ 규칙을 데이터로: banned-question 목록, option 규칙, request-gate 기준을
단일 모듈로 추출하고 기존 패턴(`course-status-parity.test.ts`,
`premises-core-drift.test.ts`)대로 드리프트 테스트를 건다. (§8)

**Q7. 품질을 '느낌'이 아니라 숫자로 어떻게 재나?**
→ 결정론 validator는 픽스처 테스트로, 생성 품질은 eval 케이스 세트
(CODEX의 9케이스 계승 + 3케이스 추가)로 회귀 측정. (§9 Phase 1, §11)

**Q8. 지친 사용자는 어디로 나가나?**
→ 모든 질문에 "모르겠다/나중에" escape 유지(스파인의 friction-escape 규칙).
피로 신호 시 질문 생략 + Argus가 조용히 후보 제안. 강제 입력 게이트 금지. (§7)

---

## 2. Ground Truth — 지금 코드에 실제로 있는 것

실행자는 이 표를 신뢰하되, 구현 직전에 각 위치를 다시 열어 확인하라
(병렬 세션이 잦은 레포다).

| 구성요소 | 위치 | 상태 |
|---|---|---|
| 질문 타입 정본 | `src/lib/question-types.ts` — `QuestionTypeTag = frame_clarify \| strategic_fork \| weakness_check \| free_follow_up` | 4타입. 결정론 라우터 `pickNextQuestionType()` 존재 |
| 타입별 프롬프트 | `src/lib/progressive-prompts.ts` — `buildStrategicForkPrompt`(1084행 부근), `buildWeaknessCheckPrompt`(1188행 부근) | fork/weakness만 구현. 품질 기준(1줄 결정문, 카테고리 금지) 이미 우수 |
| frame_clarify | `progressive-engine.ts` ~335행 | **타입만 있고 미구현** — legacy generic 질문으로 폴스루 |
| 나쁜 fallback | `progressive-engine.ts:490` — `'이 결과물을 누가 최종 판단해?'` / `'Who will make the final decision on this?'` | **금지 목록 1호 질문이 fallback으로 살아 있음** |
| Request gate | snapshot `request_type: 'open'\|'flat'\|'vent'\|'validation'\|'info'\|'resistance'\|'self_profiling'\|'crisis'` + `applyRouteContract()` (engine ~114행) | 경로 수준 차단은 있음. **질문 엔진(`pickNextQuestionType`)은 request_type을 안 받음** |
| 전제 모델 | `src/lib/premises-core.ts` (+ `src/lib/review/`, `argus-mcp/src/lib/`와 공유) | `PremiseState`, `source:'ai'\|'user'`, `status:'active'\|'retired'\|'resolved'`, MAX_ACTIVE=5, MAX_LOAD_BEARING=2, recheck cadence, materiality rule(`numeric-drift.ts`), amend 상태기계(`accept\|refine\|replace\|retire`) |
| 전제 드리프트 가드 | `src/lib/__tests__/premises-core-drift.test.ts` | webapp↔MCP byte-for-byte 고정 |
| Current Course | `src/lib/current-bearing.ts` + `CurrentBearingCard.tsx` | `prediction_to_check` 등 CODEX가 언급한 필드 실재 |
| framing_confidence | LLM **자기보고** (`progressive-prompts.ts:939` "if uncertain, say so"). 누락 시 `?? 75`(engine:450) / `?? 70`(engine:581) 기본값 | **결함: 신호 부재가 확신으로 취급되어 frame_clarify 게이트(< 70)를 건너뜀** — §4.3b에서 교정. 다른 소비처(judgment-gates.ts:92의 ≥80, decision-contract.ts:729의 ≥75)도 존재하므로 기본값 변경은 라우팅 지점에 국한할 것 |
| 정산 루프 | `src/lib/decision-contract.ts` — stable id predicates, `PredicateVerdict('happened'\|'avoided'\|'partial'\|'unknown'\|'pending')`, `basis`, `lean_after` | companion doc(§checkpoints v2)이 다룸 |
| 소비 계약 테스트 패턴 | `src/lib/__tests__/snapshot-consumption-contract.test.ts`, `user-judgment-binding.test.ts` | F2 패턴의 선례 — 이 문서의 신규 필드도 같은 방식으로 |

**CODEX 초안 대비 정정 2건:**
- CODEX §7.2 "fallback에 남아 있다면 제거" → 남아 있음, 확정 (engine:490).
- CODEX §12.1의 7-타입 `QuestionTypeTag` → 현재 4타입. `skeleton_clarify`는
  현 코드에 타입으로 존재하지 않는다(legacy 흐름 잔재 여부는 구현 시 grep으로
  확인하고, 있으면 Clean Removal 원칙대로 제거).

---

## 3. 전제 모델 — 만들지 말고 잇는다 (v2의 최대 구조 결정)

### 3.1 결정

**진행(progressive) 결정 흐름의 전제는 `premises-core.ts`의 `PremiseState`를
그대로 쓴다.** CODEX의 `JudgmentPremise` 신규 타입은 폐기한다.

이유:
- premises-core는 이미 세 표면(webapp review, argus-mcp, 이제 progressive)이
  공유하는 정본이고, 드리프트 테스트로 고정되어 있다. "하나의 전제가 터미널에서도
  브라우저에서도 같은 것을 의미한다"는 그 파일의 존재 이유가 정확히 이 케이스다.
- CODEX가 원한 것들이 이미 있다: 상태(`active/retired/resolved` + recheck의
  `drifted`), 출처(`source: 'ai' | 'user'` — 스파인의 provenance 요구를 충족),
  수정 상태기계(`accept/refine/replace/retire`), 재확인 주기, 하드 캡
  ("결정은 위키가 아니라 전제 5개다" — MAX_ACTIVE_PREMISES=5, MAX_LOAD_BEARING=2).
- 판단 체크포인트(companion doc)가 전제 recheck 인프라(cadence·drift 감지)를
  그대로 승계할 수 있다.

### 3.1b premises-core 비판적 검증 — 전문을 읽고 확인한 것

"재사용"은 무비판 수용이 아니다. 파일 전체(246행)를 읽고 확인한 적합성과
경계, 그리고 **의도적으로 추가하지 않기로 한 것**:

**이미 있어서 그대로 쓰는 것 (재확인됨):**
- `load_bearing: boolean` — weakness_check의 승격 대상 필드가 실재
- `source: 'ai' | 'user'` + `ai_original`(사용자가 고쳐도 AI 원문 보존) —
  스파인의 provenance 요구를 필드 수준에서 충족
- `premiseId(decisionId, kind, text)` — 결정-스코프 안정 id(djb2). 재생성해도
  고아가 안 생기고, 두 결정의 같은 문장이 충돌하지 않음. progressive에서는
  `decisionId` 자리에 projectId를 넣는다
- `kind: 'open_question'` + reconsider cadence(기본 21일, floor 14, cap 90) —
  §5.5에서 "모르겠다" 답변의 저장소로 활용 (공짜 귀환 루프)
- amend 상태기계(`accept/refine/replace/retire`) + `amend_history` —
  ordinal은 영구·재번호 금지("은퇴한 P2는 영원히 P2")

**재사용 경계 (여기를 넘지 마라):**
- 재사용 대상은 **core 절반만**이다. ledger-bound 절반(`premises.ts`의
  duePremises/resolvePremiseRef 등)은 MCP 대화-replay 전제라 progressive에
  맞지 않는다. progressive는 `PremiseState[]`를 snapshot jsonb에 직접 보관하고
  amend_history를 in-place append한다.
- `isMonitored()` = active + load_bearing + **external**만 감시. 즉 내부 전제
  ("우리 팀이 2주 안에 만들 수 있다")는 recheck 루프가 **영원히 안 닿는다.**
  이것은 버그가 아니라 분업이고, 그 분업을 명시적으로 계승한다:
  **외부 사실 → recheck 루프 / 내부·판단 전제 → 판단 체크포인트**(companion
  doc §4). 실행 시 이 경계를 흐리는 코드(내부 전제에 recheck 넛지)를 만들지 말 것.
- `external` 값은 LLM이 생성 시 분류한다 — 오분류가 조용히 감시를 켜고 끈다
  (LLM-glue). **기본값 false**(감시 꺼짐 — under-fire 기본)로 두고, 사용자가
  전제 카드에서 올릴 수 있게 한다.

**없지만 추가하지 않는 것 (스키마를 굶긴다):**
- `confidence` 없음 → **추가 금지.** weakest 후보 정렬용 확신도는 질문 생성
  시점의 ephemeral 계산(프롬프트 내부)으로만 쓰고 저장하지 않는다 — 저장하는
  순간 "AI의 전제 평결"이 데이터로 굳어 스파인 리스크가 된다.
- `why_it_matters` 없음(CODEX 제안) → **추가 금지.** 질문의 subtext와
  체크포인트의 check_prompt가 그 역할을 이미 한다.
- CODEX의 7-타입 enum → §3.2대로 프롬프트 렌즈로만.

정말 필드를 추가해야 한다면: premises-core **한 곳**에서, 세 사본
(src/lib, src/lib/review, argus-mcp) + `premises-core-drift.test.ts`를
같은 커밋에서 갱신한다.

### 3.2 CODEX 타입 분류(goal/causal/…)의 처분

CODEX의 7개 PremiseType(goal, causal, capability, constraint, stakeholder,
evidence, reversibility)은 **스키마가 아니라 생성 프롬프트의 렌즈로만 쓴다.**

- 스키마에 enum으로 박으면: LLM이 매번 분류를 강요당하고(오분류 조용히 발생),
  세 표면의 타입 정의가 또 갈라진다.
- 프롬프트 렌즈로 쓰면: "전제 후보를 뽑을 때 이 7개 각도에서 스캔하라"는
  생성 지침이 되어 커버리지를 올리되, 저장은 `PremiseState.text` 자유문으로
  남는다. 분류가 필요해지는 날(패턴 분석 등) 그때 derived 필드로 추가한다.

`premises-core.ts`에 progressive 흐름이 필요로 하는 필드가 정말 부족한 경우에만
optional 필드를 추가하되, **추가는 premises-core 한 곳에서 하고 드리프트
테스트(`premises-core-drift.test.ts`)와 MCP 사본을 같은 커밋에서 갱신한다**
(Schema Sync 원칙).

### 3.3 `hidden_assumptions`와의 병행

- `hidden_assumptions: string[]`는 **premises의 read-only projection**이 된다:
  `premises.filter(p => p.status === 'active').map(p => p.text)`.
- 이행기 동안 snapshot에는 둘 다 존재하되, 쓰기는 premises로만 하고
  hidden_assumptions는 파생한다. 파생 함수는 한 곳
  (`src/lib/premise-projection.ts` 신규, 또는 premises-core 옆)에 둔다.
- 일몰 기준: Current Bearing·프롬프트·플러그인 import가 전부 premises를 읽게
  되면 hidden_assumptions 쓰기를 제거한다(읽기 호환은 유지 — old localStorage).

### 3.4 전제의 생성 지점 (질문이 아니라 효과)

```
STEP-0 분석      → 전제 후보 0~3개 (source:'ai', 조용히 snapshot에 부착)
strategic_fork   → 선택된 option의 snapshotPatch가 전제 후보를 재작성
                   (기존 hidden_assumptions 재작성 자리에 premises 재작성)
weakness_check   → 사용자가 "가장 불안한 전제"를 선택 = 그 전제가
                   load_bearing으로 승격 + weakestAssumption 필드와 연결
사용자 수정      → source:'user'로 전환 (amend: refine/replace)
```

**Honest gap 규칙:** LLM이 전제를 생성하지 못하면(파싱 실패·누락) 빈 배열을
조용히 저장하지 말고 snapshot에 `premises_unavailable: true`를 남기고 UI는
"전제 미확인"을 표시한다. 모델이 빈 자리를 그럴듯한 전제로 채워 넣는 것 금지.

---

## 4. 질문 타입 시스템 v2 — 최종 형태

### 4.1 타입 목록 (4 → 6)

```ts
// src/lib/question-types.ts
export type QuestionTypeTag =
  | 'frame_clarify'     // 기존 타입, 이번에 구현
  | 'strategic_fork'    // 기존 유지
  | 'weakness_check'    // 기존 유지 — "가장 약한 전제 선택"으로 의미 확장
  | 'checkpoint_seed'   // 신규 — gated, companion doc과 연결
  | 'free_follow_up';   // 기존 유지
```

CODEX의 `premise_extraction`은 타입으로 만들지 않는다(§3.4 — fork의 효과).
CODEX의 `execution_carry`는 weakness_check의 `nextThreeDays` effect가 이미
그 역할을 한다 — 별도 질문으로 만들면 중복이다. execution_carry의 남은 조각
("AI가 대신 조사할 것 vs 당신이 직접 판단할 것" 분리)은 weakness_check
effect에 optional 필드 `aiTaskSplit`으로 추가한다.

### 4.2 표준 세션의 질문 예산

**한 세션의 기본 질문 수는 2, 최대 3.**

```
Q1: frame_clarify (framing_confidence < 70일 때)  또는  strategic_fork
Q2: weakness_check (워커 산출 이후)
Q3: checkpoint_seed — 아래 fire-gate를 전부 통과할 때만
```

피로 신호(§7) 감지 시 Q2 이후를 생략하고 Argus가 후보를 조용히 제안한다.

### 4.3 frame_clarify (이번에 구현 — 최우선 신규 작업)

low-confidence framing은 가장 위험한 구간이다: 여기서 generic fallback으로
넘어가면 세션 전체가 잘못된 방향으로 진행된다. 현재 정확히 그렇게 동작한다.

- 프롬프트: `buildFrameClarifyPrompt(ctx, locale)` 신규
  (`progressive-prompts.ts`, fork 프롬프트와 같은 구조).
- 질문 본문 규칙: "지금 진짜 결정은 X인가요, Y인가요, Z인가요?" 꼴.
  선택지는 문제 유형 카테고리가 아니라 **실제 frame 문장**:
  - ✓ "이 일을 할지 말지부터 정해야 한다"
  - ✓ "하기로 했고, 어떤 범위로 할지가 문제다"
  - ✓ "무엇을 할지는 정했고, 누구를 먼저 설득할지가 막혔다"
  - ✗ "전략 문제" / "실행 문제" / "커뮤니케이션 문제" (카테고리 — 금지)
- Effect 스키마 (question-types.ts에 추가):

```ts
export interface FrameClarifyEffect {
  chosenFrame: string;          // 선택된 frame 1줄
  framingBoost: number;         // +10~+40, 결과 confidence는 엔진이 clamp
  snapshotPatch: {
    real_question: string;      // frame에 맞춰 재정의 (?로 끝남)
    premises?: PremiseSeed[];   // 이 frame이 기대는 전제 후보 0~3
    skeleton?: string[];
    insight?: string;
  };
}
```

- 소비 계약: `framingBoost`는 엔진의 confidence 갱신에, `chosenFrame`은
  다음 질문 프롬프트의 컨텍스트에 반드시 소비된다 — 테스트로 고정 (§9 Phase 2).

### 4.3b 게이트 신호 자체의 결함 교정 — framing_confidence는 자기보고다

frame_clarify 게이트(< 70)가 딛고 있는 `framing_confidence`는 LLM
자기보고이고, Argus의 엔진 원칙은 "모델 자기확신을 신뢰하지 않는다"이다.
자기보고를 당장 대체할 수는 없지만(대체물이 없다), 세 가지를 교정한다:

1. **누락 기본값 버그 수정 (Phase 2에 포함).** 현재 LLM이 필드를 누락하면
   `?? 75`(engine:450) / `?? 70`(engine:581)로 채워져 게이트를 건너뛴다 —
   "신호 부재 = 확신"은 honest-gap 위반이고, 방향도 거꾸로다(모를수록
   frame을 물어야 한다). 교정: **질문 라우팅 입력에서만** 누락 → 50으로
   취급 (`framing_confidence_reported: boolean`을 함께 넘겨 명시). 전역
   기본값은 건드리지 않는다 — judgment-gates(≥80)·decision-contract(≥75) 등
   다른 소비처의 동작이 걸려 있다.
2. **신뢰 가능한 증분은 결정론 boost뿐.** frame_clarify 답변의
   `framingBoost`(+20~30)는 사용자 행동에서 온 신호이므로 신뢰한다.
   LLM이 두 번째 자기보고로 confidence를 스스로 올리는 경로는 만들지 않는다.
3. **임계값 70은 튜닝 대상으로 표시.** eval 세트(§11)에 자기보고 인플레
   케이스를 넣고(모호한 요청인데 confidence 90 보고), 게이트 통과율을
   회귀 관찰한다. 상수는 `question-rules.ts`에 두어 한 곳에서 조정.

### 4.4 strategic_fork (유지 + 전제 연결)

현 구현의 기준(상사가 사인할 1줄 결정, 카테고리 금지, snapshotPatch로 피벗
체감)은 이미 이 문서의 철학과 일치한다. 변경은 두 가지만:

1. option의 `snapshotPatch.hidden_assumptions` 재작성 자리에
   `premises` 재작성을 추가한다(§3.4). 기존 필드는 projection으로 유지.
2. 프롬프트에 Global Question Instruction(§6.4)과 사용자 언어 계승 규칙
   (CODEX §2.3 — "사용자가 '먹힐지 모르겠다'고 했으면 '먹힌다'를 물고
   들어가라")을 추가한다.

### 4.5 weakness_check (유지 + 의미 확장)

기존 effect(weakestAssumption, nextThreeDays, dmFirstReaction)는 유지.
확장:

1. 선택지가 가리키는 대상을 premises와 연결: 각 option에
   `premiseId?: string` — 이 검증 경로가 찌르는 전제. 답이 선택되면 그
   전제의 `load_bearing` 승격 + checkpoint seed 후보 생성.
2. `aiTaskSplit?: { ai: string[]; human: string[] }` optional 추가
   (§4.1의 execution_carry 흡수).
3. 질문 문구가 이미 사용자의 확정 방향을 전제하지 않게 — confirmation bias
   금지 규칙은 validator(§6)가 잡는다.

### 4.6 checkpoint_seed (신규 — gated)

목적: Current Course와 판단 체크포인트(companion doc)를 잇는 손잡이 생성.

**fire-gate가 형식보다 먼저다. 아래 전부 참일 때만 이 질문이 존재한다:**

```ts
function checkpointSeedEligible(ctx): boolean {
  return ctx.requestType === 'open'          // 구조적 — LLM 판단 아님
    && ctx.forkOrWeaknessAnswered            // 판단 방향이 실제로 잡혔음
    && !ctx.fatigueDetected                  // §7
    && ctx.premises.some(p => p.status === 'active'); // 확인할 전제가 있음
}
```

게이트를 통과 못 하면: 질문 없음. 대신 Argus가 Current Course에 체크포인트
후보 1개를 조용히 부착하고(제안 표기 + 수정/삭제 가능), 사용자에게 고르라고
요구하지 않는다. **"이 감정을 언제 다시 확인할까요?" 류의 제조된 체크포인트는
스파인 위반이다** (mirror clause).

질문 형태(통과 시): "나중에 무엇을 보면 이 판단이 더 선명해질까요?" +
선택지는 관찰 가능한 신호 문장(날짜 아님). Effect는 companion doc의
`CheckpointSeed` 스키마를 따른다 — return_handle(kind: date/event/metric/
reaction/evidence/manual), linked_premise_ids, expected/negative signal.

### 4.7 라우터 변경

```ts
// question-types.ts — 시그니처 자체에 게이트를 박는다 (Q2/Q3 방어)
export function pickNextQuestionType(ctx: QuestionStateContext): QuestionTypeTag | null {
  // 구조적 게이트: 비-open이면 타입 라우팅 자체가 없다.
  // (경로 차단(R32)이 이미 막지만, 여기가 최후 방어선 — defense in depth)
  if (ctx.requestType !== 'open') return null;

  if (ctx.userRequestedMore) return 'free_follow_up';
  const asked = new Set(ctx.askedTypes);
  if (ctx.framingConfidence < 70 && !asked.has('frame_clarify')) return 'frame_clarify';
  if (!asked.has('strategic_fork')) return 'strategic_fork';
  if (ctx.workerOutputsReady && !asked.has('weakness_check')) return 'weakness_check';
  if (checkpointSeedEligible(ctx) && !asked.has('checkpoint_seed')) return 'checkpoint_seed';
  return null;
}
```

`QuestionStateContext`에 `requestType`, `fatigueDetected`, `premises` 추가.
**이 함수는 결정론이며 LLM은 타입 선택 권한이 없다** — 현 코드의 원칙 유지.

---

## 5. 스파인 정합 — 이 설계가 지켜야 하는 선

구현 중 아래를 어기는 코드를 쓰게 되면 멈추고 설계로 돌아오라.

1. **fire-gate가 형식보다 먼저.** checkpoint_seed·fork 템플릿이 기본값이 되어
   flat/vent 케이스에 질문을 제조하면 안 된다. §4.7의 구조적 게이트가 그
   보증이다. 프롬프트 지시("flat이면 묻지 마라")는 보증이 아니다 —
   rounds 5–8이 증명했다.
2. **질문은 중립 crux question, 기울인 진술 금지.** "무리하게 출시하기보다
   안전하게 검증하는 게 낫지 않을까요?"는 금지. "이 방향이 맞다고 보시죠?"류
   confirmation도 금지. disclaimed lean("제 판단은 아니지만 X 쪽이…")은
   **더 나쁘다** — 태그를 붙인 평결도 평결이다.
3. **답변 후 능동 피드백(CODEX §9.3)은 조건부 채택.** "이 선택은 '늦게 배우는
   비용이 더 크다'는 전제를 택한 거예요"는 판단 구조를 비추는 좋은 피드백이지만:
   - 반드시 ai_surfaced 시각 표기(기존 provenance shading 패턴)를 달고,
   - 사용자가 한 번의 탭으로 수정/거부할 수 있어야 하고,
   - 성향 언어("당신은 ~한 유형") 절대 금지 — 이번 판단의 구조만.
   - 빈도 기반 성장 피드백("예전보다 빨리 잡았어요")은 이 시스템의 소관이
     아니다 — `patterns`의 sample-size-scaled 문장으로만 (companion doc §11).
4. **confidence 추정은 내부용.** Argus가 전제별 확신도를 조용히 추정해
   라우팅(weakest 후보 정렬)에 쓰는 것은 허용. 사용자에게 숫자/등급으로
   노출 금지. 노출은 "내가 보기엔 이게 가장 불안해 보여요 — 맞나요?" 꼴의
   수정 가능한 제안뿐.
5. **모든 질문에 escape.** "모르겠다", "나중에", 직접 입력. 강제 선택 없음.
6. **escape는 데이터 손실이 아니라 승격이다.** 사용자가 "모르겠다"를 고르면
   그 질문의 crux를 `kind: 'open_question'`으로 premises에 저장한다 —
   premises-core의 reconsider cadence(기본 21일)가 **공짜로 귀환 루프를
   무장**시킨다: "그때 답 못 했던 질문인데, 지금은 답할 수 있나요?"
   열어두는 것이 계속 유효한 답이라는 premises-core의 원칙(M3)도 함께
   계승한다 — reconsider 넛지는 답을 요구하지 않는다.

---

## 6. Question Quality Gate — 2층 validator

### 6.1 구조

```
LLM이 typed question 생성
  → [1층] 결정론 validator (동기, <1ms, 테스트 가능)
      실패 → 재생성 (최대 2회, 실패 사유를 프롬프트에 주입)
  → [2층] LLM judge (선택적, tilt/leading 같은 의미론 검사, abstain 가능)
      실패 → 재생성 (1층과 합산 상한 공유)
  → 상한 소진 → 큐레이션된 fallback 풀에서 컨텍스트 매칭 (§6.3)
  → 모든 단계에서 reject 사유를 user_events에 로깅 (측정 가능하게)
```

**LLM-glue 규칙 적용:** validator가 통과 못 시킨 질문이 조용히 나가는 경로가
없어야 하고(구조상 불가능하게), fallback 사용은 로깅되어 /admin에서 비율을
볼 수 있어야 한다. fallback 비율이 곧 생성 품질의 온도계다.

### 6.2 1층 — Hard Reject Rules (결정론)

`src/lib/question-validator.ts` 신규. 입력: 질문 텍스트 + options + effect +
컨텍스트(request_type, previousQA, 사용자 원문). 출력:
`{ ok: true } | { ok: false; rule: RejectRule; detail: string }`.

CODEX의 9개 hard reject 중 결정론으로 잡을 수 있는 것:

| # | Rule | 구현 |
|---|---|---|
| R1 | admin-only | banned 패턴 목록(§8의 rules-as-data)과 문자열/정규식 매칭. ko+en. "마감", "최종 결정권자", "어떤 형식", "몇 페이지", "어떤 톤", "어느 섹션" 등 |
| R2 | category options | 옵션 평균 길이 < 12자(ko)/20자(en), 동사 부재, 금지 단어("우선", "중심", "최소화" 단독) 휴리스틱. 보수적으로: 3개 이상 옵션이 전부 짧은 명사구면 reject |
| R3 | re-asking known | previousQA의 질문/답변 + 사용자 원문과 n-gram 중복률 임계 초과 시 reject |
| R4 | internal structure | "스켈레톤", "섹션", "항목을 채울" 등 내부 구조 언어 매칭 |
| R5 | over-fire | request_type !== 'open'인데 validator까지 왔다면 그 자체가 버그 — throw (fail loud). §4.7 게이트가 뚫렸다는 뜻 |
| R6 | forced checkpoint | checkpoint_seed인데 linked premise가 없거나 request가 비-open이면 reject |
| R7 | no options escape | 선택지에 직접입력/모르겠다 경로가 UI 계약상 있는지 — 이것은 validator가 아니라 렌더러 테스트로 |

의미론이 필요해 결정론으로 못 잡는 것(leading/tilted, confirmation bias,
no-decision-effect)은 2층으로.

**휴리스틱 규칙(R2, R3)의 정직한 한계와 운용:**
- R2(길이·동사 기반 카테고리 감지)와 R3(n-gram 중복)는 근사다. 한국어는
  조사·띄어쓰기 변이로 n-gram이 잘 어긋난다 — 비교 전에
  `normalizePremiseText` 계열 정규화(공백 접기 + lowercase)를 거치고,
  임계값은 상수로 두지 말고 **픽스처 20케이스로 튜닝**한다(§9 Phase 1의
  테스트가 그 픽스처다). 오탐(좋은 질문 reject)이 미탐보다 비싸다 —
  재생성 2회 상한을 태우기 때문. 의심스러우면 통과시키고 2층에 맡긴다.
- **커버리지: validator는 typed 경로만이 아니라 질문이 사용자에게 나가는
  모든 경로를 감싼다** — `free_follow_up`, legacy generic 질문 생성부,
  deepening 질문 전부. Phase 1 배선 시 `runTypedQuestion` 밖에서 질문을
  만드는 곳을 grep으로 전수 확인하라 (`next_question` 생산처). 한 경로라도
  validator 밖에 있으면 품질 하한선이 아니라 품질 확률이 된다.

### 6.3 2층 — LLM judge (선택적, abstain 우선)

- 프롬프트: "이 질문이 특정 답을 유도하는가? 사용자가 이미 정한 방향을
  확인해주기만 하는가? 답해도 아무것도 안 바뀌는가? **불확실하면 pass를
  반환하라**(억울한 reject가 무한 재생성보다 나쁘다)."
- 출력: `{ verdict: 'pass' | 'reject' | 'abstain', reason }`. abstain=pass.
- 호출 비용이 문제면 Phase 1에서는 끄고 1층만으로 시작 가능(코드에 hook만).
  이것이 CODEX Open Q7의 답: **결정론이 기본, LLM judge는 증분**.

### 6.4 프롬프트 강화 (validator와 별개로, 생성 자체를 올린다)

모든 typed question 프롬프트에 공통 주입(§8의 단일 모듈에서):

> Your job is not to collect information. Your job is to expose the premise
> or fork that changes the user's judgment. Never ask: final decision-maker,
> deadline, format, tone, section-to-fill, "does this look right".
> Follow the user's own words — if they said "먹힐지 모르겠다", interrogate
> what "먹힌다" means, don't translate it into "시장 검증".

### 6.5 Fallback 풀 교체 (Phase 0 — 한 줄 수정 + 풀 추가)

`progressive-engine.ts:490`의 `'이 결과물을 누가 최종 판단해?'`를 제거하고
`src/lib/question-fallbacks.ts` 신규 모듈의 풀에서 뽑는다:

```ts
// 전부 중립 crux question — 어떤 컨텍스트에도 안전한 질문만
export const SAFE_FALLBACK_QUESTIONS = {
  ko: [
    '이 판단이 틀렸다고 드러난다면, 가장 먼저 어디에서 신호가 나타날까요?',
    '지금 더 불확실한 건 상대의 반응인가요, 우리의 실행력인가요, 판단의 전제 자체인가요?',
    '이 결정에서 결과를 가장 크게 바꿀 수 있는 제약 하나를 꼽으면 무엇인가요?',
  ],
  en: [ /* 대응 번역 */ ],
} as const;
```

deepening fallback("이제 이 방향이 맞나요?" 류가 있으면 — 구현 시 grep으로
확인)도 같은 풀로 교체. confirmation bias 문구는 전면 금지.

---

## 7. 피로 관리 — 결정론 신호

CODEX §9.2의 피로 신호를 결정론 감지로 구체화한다 (`src/lib/fatigue-signal.ts`):

```ts
export function detectFatigue(recentAnswers: AnswerRecord[]): boolean {
  // 즉시 true (단독으로 충분한 신호):
  //   A. 명시적 중단 큐: "그냥 정해줘" / "알아서 해" / "빨리" / "그만"
  //   B. 같은 세션에서 질문 3개 이미 소진 (예산 상한)
  // 약한 신호 — 2개 이상 겹칠 때만 true:
  //   C. 직전 답변이 5자 미만
  //   D. escape(모르겠다/나중에) 선택
  //   E. 직전 2개 답변이 연속으로 짧아짐 (체감 급감)
}
```

**주의 — escape 1회는 피로가 아니다.** "모르겠다"는 이 시스템이 1급으로
설계한 정직한 답(§5.6 — open_question으로 승격되는)이고, 그것을 피로로
오분류하면 정직하게 답한 사용자가 남은 질문을 잃는다. 약한 신호는 반드시
2개 이상 겹쳐야 발화한다.

true면: 남은 질문 생략, checkpoint_seed는 자동으로 조용한 제안 모드(§4.6),
마무리 문구는 "지금은 여기까지면 충분해요" 계열. **이것도 LLM 판단이 아니라
구조다** — 프롬프트에 "지쳐 보이면 묻지 마라"라고 쓰는 것은 보증이 아니다.

---

## 8. 세 표면 단일 소스 — rules-as-data

banned-question 목록, good/bad 예시, option 규칙, request-gate 기준이
webapp 프롬프트·argus-plugin-v2 markdown·argus-mcp에 각각 복사되면 반드시
드리프트한다(이미 데인 패턴). 해법은 기존 관례를 따른다:

1. `src/lib/question-rules.ts` 신규 — banned 패턴(ko/en), 공통 instruction
   문자열(§6.4), option 규칙 상수를 export. webapp 프롬프트 빌더들은 여기서
   import.
2. plugin/MCP에는 각자의 사본을 두되, **드리프트 테스트로 고정**:
   `src/lib/__tests__/question-rules-drift.test.ts`가 plugin skill markdown과
   MCP 사본에서 규칙 블록을 읽어 대조 (`premises-core-drift.test.ts`와 같은 방식).
3. 의도적 분기(플러그인만 다른 것)는 intentional-divergence 목록에 명시
   (parity-map 관례).

---

## 9. 구현 계획 — Phase와 컷라인

각 Phase는 독립 출하 가능. **Phase 0–2가 컷라인** — 여기까지만 해도 제품
바닥이 올라간다. 3+는 companion doc과 보조를 맞춘다.

### Phase 0 — fallback 척결 (최소·최대 레버리지, ~반나절)

1. `question-fallbacks.ts` 신규 + engine:490 교체 (§6.5)
2. deepening/기타 fallback grep 후 동일 교체
   (`grep -rn "최종 판단\|이 방향이 맞나\|final decision" src/`)
3. 테스트: fallback 풀의 모든 문장이 R1~R4 hard reject를 통과하는지 자체 검증
   (validator가 없더라도 이 테스트는 문자열 규칙으로 먼저 작성 가능)

검증: typed question 생성을 강제로 실패시키고 fallback이 안전 풀에서만
나오는지 확인.

### Phase 1 — Question Quality Gate (1층 결정론, ~2일)

1. `question-validator.ts` + `question-rules.ts` 신규 (§6.2, §8)
2. `runTypedQuestion()`에 validator 배선: 재생성 ≤2회, 사유 프롬프트 주입,
   소진 시 fallback 풀, 전 단계 `user_events` 로깅
3. 2층 LLM judge는 인터페이스만 (`validateSemantics?: async`) — 끈 채로 출하
4. 테스트: 픽스처 20개(나쁜 질문 10 — CODEX §6.1의 예시 그대로 / 좋은 질문 10)
   → reject/pass 회귀. R5(over-fire면 throw) 테스트 포함.

### Phase 2 — frame_clarify 구현 (~2일)

1. `buildFrameClarifyPrompt` (§4.3) + `FrameClarifyEffect` 타입
2. engine ~335행의 폴스루 제거 — frame_clarify가 실제 실행되게
3. `pickNextQuestionType`에 `requestType` 게이트 추가 (§4.7) — **이 단계에서
   QuestionStateContext 시그니처가 바뀌므로 호출부 전수 갱신**
3b. framing_confidence 누락 기본값 교정 (§4.3b) — 라우팅 입력에서만
   누락→50 + `framing_confidence_reported` 플래그. 다른 소비처 불변 확인
   테스트 포함
4. 소비 계약 테스트: framingBoost·chosenFrame이 소비되는지
   (`snapshot-consumption-contract.test.ts` 패턴)
5. 검증: framing_confidence < 70 세션에서 generic 질문이 아니라 frame 선택
   질문이 나오는지 라이브 확인

### Phase 3 — 전제 배선 (premises-core 재사용, ~3일)

1. snapshot에 `premises?: PremiseState[]` 추가 (optional + fallback —
   Defensive Data Access). `hidden_assumptions`는 projection으로 전환 (§3.3)
2. STEP-0·fork 프롬프트에 전제 후보 생성 추가 (§3.4, 7렌즈는 프롬프트 지침)
3. weakness_check option에 `premiseId` 연결 (§4.5)
3b. escape("모르겠다") → `kind:'open_question'` 저장 배선 (§5.6) +
   external 기본값 false 확인 (§3.1b)
4. honest gap: `premises_unavailable` 플래그 + UI 표시
5. **CLAUDE.md 새 필드 체크리스트 전항목 수행** — types.ts, store, defaults,
   Supabase(snapshot이 저장되는 테이블 컬럼 확인 — jsonb 내부면 마이그레이션
   불요, 최상위 컬럼이면 같은 커밋에 마이그레이션 + `schema-drift.test.ts`
   TABLE_COLUMNS 갱신), 프롬프트, UI, handoff 함수
6. 소비 계약 테스트: fork가 생성한 premises가 weakness_check 프롬프트와
   Current Bearing에 실제로 소비되는지

### Phase 4 — checkpoint_seed (companion doc과 동시 진행, ~2일)

1. `checkpointSeedEligible` 게이트 + 타입 + 프롬프트 (§4.6)
2. 게이트 불통과 시 조용한 제안 경로 (Current Bearing에 부착)
3. effect가 companion doc의 CheckpointSeed 스키마로 저장되고, seal 시
   decision contract에 승계되는지 소비 계약 테스트
4. **over-fire 회귀 테스트: flat/vent/validation 케이스에서 checkpoint_seed가
   절대 질문으로 나오지 않는 것** (eval 케이스 B/C/D)

### Phase 5 — 피로 신호 + 능동 피드백 (~2일)

1. `fatigue-signal.ts` (§7) + 라우터 배선
2. 답변 후 구조 피드백 1줄 (§5.3의 조건 하에): ai_surfaced 표기 + 수정 escape
3. 성향 언어 금지를 프롬프트 + validator 패턴 양쪽에

### Phase 6 — rules-as-data 통일 (~1일 + plugin/MCP 반영)

§8. plugin skill markdown과 MCP 프롬프트의 질문 규칙 블록을 webapp과 대조하는
드리프트 테스트. 이 Phase 전까지 plugin은 기존 그대로 두어도 된다(웹앱 먼저).

---

## 10. CODEX Open Questions 10개 — 전부 결정

| # | 질문 | 결정 |
|---|---|---|
| 1 | Premise Extraction: 별도 질문 vs 자동 제안? | **자동 제안.** fork 답변의 효과로 생성, weakness_check가 확인 담당. 별도 질문 금지(피로 예산) — §3.4 |
| 2 | Checkpoint Seed를 언제 자동 제안만? | fire-gate(§4.6) 불통과 시 전부. 통과 시에만 질문 |
| 3 | Current Course에 premise 노출량? | load-bearing 최대 2개만 문장으로 (MAX_LOAD_BEARING 상수와 일치), 나머지는 접힘 |
| 4 | "모르겠다" 선택 시? | Argus가 가장 그럴듯한 후보 1개 + 가장 싼 확인 경로 1개를 제안하고 진행. 같은 질문 세션 내 재질문 금지. **crux는 `kind:'open_question'`으로 저장되어 reconsider 루프(기본 21일)를 탄다** (§5.6) — 미확인이 데이터 손실이 아니라 귀환 손잡이가 됨 |
| 5 | Settle의 ambiguous reality UX? | companion doc §8–9가 소유 (구조화된 AmbiguityRecord, 4버튼) |
| 6 | Growth feedback 최소 기록 수? | companion doc §11 (1회=insight, 2–4회=경향, 5회+=패턴) |
| 7 | Validator: LLM vs 결정론? | **결정론 기본 + LLM judge는 abstain 가능한 증분(꺼진 채 출하 가능)** — §6 |
| 8 | plugin/webapp 프롬프트 단일 소스? | rules-as-data + 드리프트 테스트 — §8 |
| 9 | hidden_assumptions 병행 기간? | projection으로 즉시 전환, 쓰기 일몰은 소비처 전환 완료 시 — §3.3 |
| 10 | "전제" 단어 사용자 노출? | 첫 노출은 풀어 쓴다("이 판단이 기대고 있는 것") + 이후 화면에서 "전제"로 축약. 코드/내부는 premise |

---

## 11. Eval Set — CODEX 9케이스 계승 + 3 추가

CODEX §10의 Case A~I를 그대로 회귀 픽스처로 만든다. 추가 3개:

**Case J. 피로한 사용자 (중도 이탈 직전)**
> (질문 2개에 이미 답한 뒤) "아 모르겠다 그냥 알아서 해줘"
기대: 질문 중단, 조용한 제안 모드, "여기까지면 충분해요" 계열 마무리,
checkpoint 질문 안 나옴.

**Case K. LLM 출력 결손**
typed question 생성이 3회 연속 파싱 실패.
기대: 안전 fallback 풀에서만 질문이 나옴. 금지 질문 절대 불출. user_events에
사유 기록. (이건 유닛 테스트로 — LLM mock)

**Case L. 사용자가 AI 전제 제안을 거부**
> Argus: "이 판단은 X 전제 위에 있어 보여요" / 사용자: "아니, 그건 상관없어"
기대: 해당 premise retire(amend 상태기계), 재주장 금지, 사용자 서술로 대체
(source:'user').

**Case M. framing confidence 인플레 (§4.3b)**
모호한 요청("우리 팀 방향 좀 잡아줘" — 대상·기간·결정 지점 전부 불명)인데
STEP-0가 framing_confidence 90을 자기보고.
기대: 게이트 통과율 회귀 관찰의 대상 케이스. 자기보고 필드 누락 변형도 포함
— 누락 시 frame_clarify가 발화해야 함(누락→50 규칙).

평가 기준은 CODEX §10.2를 그대로 쓰되 두 줄 추가:
- fallback 발동률이 측정되는가? (user_events)
- 전제가 생성→소비(weakness_check/Current Bearing/checkpoint)까지 이어졌는가?

실행 위치: 결정론 부분은 vitest 픽스처(`src/lib/__tests__/question-quality.test.ts`),
생성 품질은 `argus-plugin-v2/evals`의 gen/judge 패턴 재사용(별도 러너).

---

## 12. North Star (CODEX 원문 유지 — 이것은 그대로가 맞다)

> 질문 몇 개로 사용자의 판단을 대신하는 것이 아니라, 사용자가 자기 판단이
> 기대고 있는 전제를 보게 만들고, 그 전제를 현실 속에서 다시 확인할 수 있게 한다.

거기에 v2의 한 줄을 더한다:

> 그리고 그 보증은 프롬프트의 선의가 아니라 구조에서 나온다 — 게이트가 형식보다
> 먼저, 생산된 전제는 반드시 소비되고, 실패는 시끄럽거나 정직하다.
