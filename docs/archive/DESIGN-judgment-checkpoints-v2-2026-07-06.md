# Judgment Checkpoints v2 — 실행 설계서

Date: 2026-07-06
Status: **Execution-ready design** — supersedes `internal design notes` (CODEX 초안)
Rev: v2.1 — 심층 재검토 반영: verdict 매핑을 `expectation` 필드로 결정론화(§7.2 — 초판의 매핑 표는 자체 모순이 있었다), recheck 루프와 체크포인트의 분업 명시(§4), open_question 귀환 합류(§9.1)
Executor: Opus/Sonnet 세션이 이 문서만 읽고 구현할 수 있게 쓴다.
Scope: 판단 체크포인트 — 봉인(seal)에서 귀환(settle)까지의 루프 전체

Read-first (구현 전 필독):
- `CLAUDE.md` — Zero-Judgment Gate + LLM-glue invariant
- `src/lib/decision-contract.ts` + `src/stores/types.ts`의 Predicate 계열 — **이미 존재하는 정산 루프**
- `src/lib/premises-core.ts` — recheck cadence·amend 상태기계 (재사용 대상)
- Companion doc: `docs/DESIGN-clarify-question-system-v2-2026-07-06.md` (checkpoint_seed가 여기서 온다)

---

## 0. 이 v2가 CODEX 초안과 다른 점 (요약)

CODEX 초안의 제품 감각은 옳다 — "계약/정산/채점"의 언어를 "나중에 다시 볼
손잡이"로 바꾸고, 모호함을 일급 상태로 만들고, 성장 피드백을 근거에 묶는 것.
그 카피·타입 분류·안티패턴은 전부 계승한다. v2가 바꾸는 것은 여섯 가지다.

1. **Decision Contract를 대체하지 않고 입힌다.** 정산 루프는 이미 깊게
   구현되어 있다(stable-id predicates, 운/판단 분리 `basis`, `lean_after`,
   WakeReturn, check-in cron, statusline, plugin ledger, MCP seal/settle,
   /admin 계측). 병렬 신규 객체 `JudgmentCheckpoint`를 만드는 것은 Argus가
   이미 겪은 "정본 부재 → 8중복 + 증발" 사고의 재생산이다. → §3.
2. **verdict enum을 포크하지 않는다.** CODEX의 `mostly_held/missed/mixed/unclear`는
   저장 enum이 아니라 **표시 레이어**다. 저장은 기존
   `PredicateVerdict('happened'|'avoided'|'partial'|'unknown'|'pending')`를
   유지한다 — 이미 'unknown'이 있고, 과거 정산 데이터와의 연속성이 곧
   calibration 이력의 가치다. → §7.2.
3. **1차 정산과 2차 정산을 구분해 설계한다.** 생각↔생각(그때의 나 vs 지금의 나,
   결과 불요)이 1차이고, 생각↔현실(신호 도착 후)이 2차다. 1차가 2차를 판다 —
   이것이 활성화(현재 0 sealed/0 settled)의 실제 지렛대다. CODEX의 drift
   check는 사실 1차 정산이며, 이미 `lean_after`(WakeReturn 닻 거울)로 반쯤
   구현되어 있다. → §4.5, §8.
4. **due 계산과 귀환 트리거를 결정론 인프라에 접붙인다.** premises-core의
   recheck cadence 수학, 기존 check-in cron, companion-brief, /workspace
   due-strip이 이미 있다. 새 알림 시스템을 만들지 않는다. → §9.
5. **소비 계약을 루프 전체에 건다.** 체크포인트가 생성되고 아무도 소비하지
   않는 것(생성→봉인→due→귀환→기록→patterns 반영 중 한 와이어 단선)이
   LLM-glue invariant가 예언하는 실패다. signal-recorder가 4R에만 연결된 채
   2.5달간 신호 0건이었던 그 사고 유형. 각 단계에 소비 테스트를 명시한다. → §5.
6. **CODEX가 남긴 Open Questions 5개를 전부 결정한다.** → §13.

---

## 1. Fable 자기심문 — 이 설계를 퀀텀 점프시킨 질문들

**Q1. "Decision Contract를 대체한다"가 맞나, "입힌다"가 맞나?**
→ 입힌다. 코드베이스에 이미 예측·채점·달력·이메일·통계의 전 구간이 있다.
대체하면 (a) 기존 0건이 아니라 마이너스에서 시작하고 (b) 두 정산 데이터가
영원히 못 합쳐진다. 체크포인트 = 사용자 언어의 스킨 + 딱 두 개의 구조 확장
(return_handle의 비-날짜화, primary checkpoint 지정). (§3)

**Q2. 47 opened / 0 sealed / 0 settled — 이 설계는 그 활성화 절벽을 실제로
건드리나?**
→ 타입 체계의 우아함은 절벽을 못 건드린다. 절벽을 건드리는 것은 (a) 만들 때의
마찰(자동 생성 + 수정 가능, 강요 없음), (b) 돌아올 이유(1차 정산 — 결과가
없어도 "그때의 나"를 다시 보는 것 자체가 보상), (c) 30초 완결. 구현 우선순위를
여기에 맞춘다: 귀환 루프 > 품질 게이트 > 타입 분류. (§8, §12)

**Q3. verdict 어휘가 두 벌이 되면 무슨 일이 생기나?**
→ calibration 이력이 갈라지고, patterns가 두 소스를 합치는 변환 코드가
영구히 남는다. 저장은 한 벌, 표시만 부드러운 언어로. (§7.2)

**Q4. LLM-glue: 어느 와이어가 조용히 끊기나?**
→ (a) checkpoint_seed가 생성되고 seal에 승계 안 됨, (b) due가 됐는데 아무
표면도 안 비춤, (c) growth note가 기록 데이터가 아니라 모델의 그럴듯한 창작,
(d) 귀환 기록이 patterns에 반영 안 됨. 각각 소비 계약 테스트 + "행수 확인"
(현실 접촉 후 예상 테이블에 행이 늘었나)으로 막는다. (§5)

**Q5. drift/standard check는 새 기계가 필요한가?**
→ 아니다. drift check = 1차 정산 = `lean_after` 확장. standard check =
premises-core의 materiality rule + numeric-drift가 이미 하는 일(기준이
움직였는지 감지). 재사용. (§4.4, §4.5)

**Q6. growth note가 평결이 되지 않으려면?**
→ 방금 기록된 대조 1건만 인용(창작 금지 — 구조적으로: growth note 프롬프트에
기록 원문만 주입하고 성향 어휘를 validator로 차단), 빈도 언어는 sample-size
티어(1/2–4/5+)로만, 사용자 수정/삭제 가능, provenance 표기. (§10, §11)

**Q7. 30초 settle을 선의가 아니라 구조로 보장하려면?**
→ 화면 1개, 탭 4개(대체로 맞았다/빗나갔다/섞여 있었다/아직 모르겠다),
후속 질문 최대 1개, 자유 입력은 전부 optional. "아직 모르겠다"가 벌점 없이
다음 손잡이를 낳는 1급 경로. (§7, §8)

---

## 2. Ground Truth — 지금 코드에 실제로 있는 것

| 구성요소 | 위치 | 상태 |
|---|---|---|
| 계약 객체 | `src/lib/decision-contract.ts` + `stores/types.ts` | `Predicate`(stable id, source: governing_idea/risk/actor), `PredicateVerdict('happened'\|'avoided'\|'partial'\|'unknown'\|'pending')`, `basis`(운/판단), provenance(prompt_version), `CheckInInterval('3d'\|'1w'\|'2w'\|'1m')` — **날짜형만 존재** |
| 저장 | `projects.decision_contract` (jsonb 컬럼, 실DB 확인됨) | jsonb 내부 확장은 마이그레이션 불요 (lean_after 선례) |
| seal 재정의 | WakeReturn 세션(2026-06-29): seal = 결과물 export + "시간만 답할 한줄" | `DecisionContract.lean_after` 존재 |
| 1차 정산 UI | `WakeReturn.tsx` — 닻 거울(그대로/바뀜), AI verdict 0 | 구현됨 |
| 2차 정산 UI | `SettlementModal.tsx`, `RetroSeal.tsx`(문단 쓰면 AI가 draft 프리마크, 최종 탭은 사용자 — `verdict_via:'ai_draft'` 공개) | 구현됨 |
| 귀환 트리거 | check-in cron(리마인더 이메일 — from hello@argus.voyage 검증됨), companion-brief cron, /workspace due-strip, statusline(OVERDUE 우선) | 구현됨 — **울리는데 0 settled인 것이 현재 상태** |
| 계측 | /admin seal/settle 카운터, `user_events`(seal/settle 이벤트) | 구현됨 |
| 전제 recheck | `premises-core.ts` — cadence 수학, `PremiseRecheck.drifted`, materiality rule | 구현됨 (review 경로) — 체크포인트 due가 재사용할 대상 |
| plugin/MCP | plugin ledger(seal/settle skills), argus-mcp seal→settle 하드 게이트 | 구현됨 — 어휘 변경 시 parity 대상 |

**정정/보강 (CODEX 초안 대비):**
- "Decision Contract 언어를 교체" → 교체 대상은 **카피 레이어**다. 코드
  객체·테이블·이벤트 이름은 유지한다 (§3).
- `CheckpointResult` 신설 → 불필요. 기존 verdict + 신규 `AmbiguityRecord`로
  표현 가능 (§7.2).
- `chooseCheckpointType()` 신규 라우팅 → 유지하되, 입력 신호를 clarify v2가
  실제로 생산하는 필드에 묶는다 (§4.6).

---

## 3. 구조 결정 — 체크포인트는 계약의 스킨 + 두 가지 확장

### 3.1 정의

**판단 체크포인트 = 기존 DecisionContract 위의 사용자-facing 개념.**
새 테이블 없음, 새 스토어 없음. 구조 확장은 정확히 두 개:

```ts
// stores/types.ts — DecisionContract 내부에 optional 추가 (jsonb-nested, 마이그레이션 0)

/** 비-날짜 귀환 손잡이. 기존 CheckInInterval(날짜)의 상위 호환. */
export interface ReturnHandle {
  kind: 'date' | 'event' | 'metric' | 'reaction' | 'evidence' | 'manual';
  /** kind별 내용: date=ISO, event="이사회 미팅 후", metric="가입 전환율 확인 가능해지면" … */
  value: string;
  /** due 판정이 가능한가. date만 자동 판정, 나머지는 사용자/호스트 보고 기반
   *  + 만기 상한(§9.2) — "영원히 안 due"를 구조적으로 방지 */
  auto_due: boolean;
}

/** 이 결정의 대표 체크포인트 — 귀환 루프는 여기에만 집중한다 (MAX→1). */
export interface PrimaryCheckpoint {
  predicate_id: string;             // 기존 Predicate.id를 가리킴 — 새 객체 아님
  check_prompt: string;             // "나중에 무엇을 보면…"의 답
  expected_signal?: string;
  negative_signal?: string;
  return_handle: ReturnHandle;
  linked_premise_ids: string[];     // premises-core의 premise_id
  authorship: 'ai_suggested' | 'user_edited' | 'user_authored';
  /** checkpoint 타입은 내부 라우팅 전용 — 사용자에게 노출 금지 (§4) */
  type: 'outcome' | 'reaction' | 'evidence' | 'standard' | 'drift';
  /** 이 체크포인트의 기대 방향 — verdict 매핑(§7.2)을 결정론으로 만드는 키.
   *  seal 시 결정론으로 채운다: governing bet → 'occur',
   *  risk predicate → check_prompt가 "일어나면"꼴이면 'occur', "피하면"꼴이면
   *  'not_occur'. 판정 불가 시 'occur' 기본. 사용자에게는 필드가 아니라
   *  expected_signal 문장으로 보인다. */
  expectation: 'occur' | 'not_occur';
}
```

`DecisionContract`에 `primary_checkpoint?: PrimaryCheckpoint` 추가.
나머지 predicates는 지금처럼 존재하되, **귀환 UX는 primary 하나에 집중한다**
(CODEX 원칙 1 + 기존 "MAX→1" 보류 항목의 실행).

### 3.2 왜 predicate를 가리키는 포인터인가

- 기존 채점(grade by stable id) 인프라를 그대로 탄다 — 재생성해도 고아 없음.
- calibration 이력이 한 줄로 이어진다.
- plugin/MCP의 seal/settle이 이미 contract를 주고받는다 — 어휘만 맞추면 됨.

### 3.3 카피 마이그레이션 (사용자 언어)

CODEX §1의 어휘 결정을 그대로 채택한다: "판단 체크포인트" / "나중에 다시 볼
기준" / "다시 볼 손잡이". 금지: 계약·서약·정산·채점·예측 점수·성공/실패.

실행 방법: **한 곳의 카피 모듈**로 모은다 — `src/lib/checkpoint-copy.ts`
(ko/en). SealMoment, WakeReturn, SettlementModal, due-strip, statusline,
이메일 템플릿, plugin skills가 전부 여기서 가져오거나 드리프트 테스트로 대조.
"정산"이라는 단어가 현재 여러 표면에 있으므로 grep 전수 교체 +
intentional-divergence 목록(내부 문서/코드 주석은 유지 OK).

---

## 4. 체크포인트 5타입 — 기존 인프라에의 매핑

CODEX의 5타입 분류는 좋다. 유지하되, 각 타입이 어느 기존 기계 위에서 도는지
명시한다. **타입은 내부 라우팅 전용** — 사용자는 타입 이름이 아니라 check
prompt 문장만 본다 (CODEX Open Q1의 답).

**먼저, recheck 루프와의 분업 (premises-core 전문 검증에서 확정):**
premises-core의 `isMonitored()`는 **external + load_bearing** 전제만 감시한다.
즉 외부 사실("경쟁사가 이 기능을 아직 안 냈다")은 recheck 넛지가 커버하지만,
내부·판단 전제("우리 팀이 2주 안에 만들 수 있다", "대표님은 검증안을 선호한다")
는 recheck 루프가 **구조적으로 영원히 안 닿는다.** 판단 체크포인트가 정확히
그 남은 절반을 덮는 기계다 — 이것이 체크포인트가 recheck의 중복이 아닌 이유고,
두 루프를 하나로 합치려는 시도(내부 전제에 recheck 넛지)를 금지하는 이유다.

### 4.1 outcome — 구체적 결과와 대조
기존 Predicate + 날짜형 handle 그대로. 유일한 규칙: **숫자를 제조하지 않는다.**
사용자가 말하지 않은 임계값을 모델이 지어내면 fake precision — 숫자가 없으면
evidence 타입으로 내려간다 (LLM-glue의 honest gap).

### 4.2 reaction — 사람/집단의 반응과 대조
기존 risk predicate(페르소나 이름 붙는 것)와 자연 정합. 귀환 프롬프트는
"실제로 그 사람이 먼저 문제 삼은 것은 무엇이었나요?" — 사람에 대한 평결이
아니라 관찰된 신호를 묻는다.

### 4.3 evidence — 결과 전에 가정의 지지도와 대조
premises-core의 recheck와 동형: linked_premise의 지지 증거가 쌓였는지/약해졌는지.
"몇 달 기다려야 함"이 루프를 죽이는 것을 막는 타입 — handle은
`after_more_evidence` 계열.

### 4.4 standard — 기준 이동과 대조
premises-core의 materiality rule + numeric-drift가 이미 "기준이 움직였는지"를
감지하는 기계다. 재사용: 기준이 명시적(임계값·조건문)이면 standard 타입으로
저장하고, 귀환 시 원 기준을 **먼저 보여준 뒤** "지금도 이 기준으로 보고
있나요?"를 묻는다. 기준 변경은 허용 — 숨기는 것이 문제라는 CODEX 카피 유지:
> 기준이 바뀐 건 나쁜 게 아닙니다. 바뀐 이유를 남겨두면 다음 판단이 더 선명해집니다.

### 4.5 drift — 프레임 이동과 대조 (= 1차 정산)
**이것이 활성화의 지렛대다.** 결과가 도착하지 않아도 성립하는 유일한 타입:
그때의 real_question·lean과 지금의 나를 대조한다. 이미 반쯤 구현됨 —
`lean_after`(WakeReturn 닻 거울: 그대로/바뀜). 확장: 원 프레임(seal 시점의
real_question + 선택된 fork의 decisionLine)을 저장해 귀환 화면이 **반드시 원문을
먼저 보여준다** (CODEX 규칙: "원 프레임 없이 drift를 물으면 안개"). AI 평결 0 유지.

### 4.6 타입 선택 휴리스틱 (결정론)

CODEX의 선택 순서를 유지하되, 입력을 clarify v2가 실제로 생산하는 신호에 묶는다:

```ts
// LLM이 아니라 결정론 함수. clarify v2의 산출물이 입력이다.
function chooseCheckpointType(ctx: {
  returnHandleKind: ReturnHandle['kind'];   // seed 질문의 답에서
  linkedPremise?: PremiseState;             // weakness_check가 승격한 전제
  hasExplicitThresholdOrCondition: boolean; // materiality rule 존재 여부
  primaryRiskIsReaction: boolean;           // risk predicate에 페르소나가 붙었나
}): CheckpointType {
  if (ctx.returnHandleKind === 'date' || ctx.returnHandleKind === 'metric') return 'outcome';
  if (ctx.primaryRiskIsReaction) return 'reaction';
  if (ctx.linkedPremise) return 'evidence';
  if (ctx.hasExplicitThresholdOrCondition) return 'standard';
  return 'drift';   // fallback이 drift인 것이 중요 — outcome 강제가 fake precision의 뿌리
}
```

---

## 5. 수명주기와 소비 계약 — 끊기면 안 되는 와이어 6개

```
[생성] clarify checkpoint_seed (또는 조용한 제안)
   │  W1: seed → seal 승계. seal 시 contract.primary_checkpoint로 저장되는가
[봉인] SealMoment — 사용자가 확인/수정/버림 (버림도 1급 경로)
   │  W2: authorship 기록. ai_suggested가 수정 없이 저장되면 그대로,
   │      한 글자라도 고치면 user_edited로 전환되는가
[대기] due 계산 (§9)
   │  W3: due가 되면 due-strip + statusline + (설정 시) 이메일에 뜨는가
[귀환] 판단 체크포인트 화면 (§7, §8)
   │  W4: 원 판단·원 기준·원 프레임이 화면에 원문 그대로 뜨는가 (창작 금지)
[기록] verdict + AmbiguityRecord + growth note
   │  W5: 기록이 patterns/journal 집계에 실제로 도착하는가 (행수 확인)
[다음] unclear → 다음 손잡이 자동 생성 / settled → 다음 분석에 "참고:" 주입
   │  W6: settled 이력이 이후 세션 프롬프트에 reference-only로 주입되는가
```

각 W는 테스트 하나씩 갖는다 (`src/lib/__tests__/checkpoint-loop-contract.test.ts`).
W3·W5는 실DB 접촉 후 "예상 테이블에 행이 늘었나" 1줄 확인을 출하 체크리스트에
포함한다 (Persistence Declaration 원칙 — UI가 멀쩡한 것과 데이터가 도착한 것은
다른 사실이다).

---

## 6. 품질 게이트 — 막지 말고 벼린다

CODEX §7의 설계(차단이 아니라 조용한 벼림)를 그대로 채택하고 구현 형태만 정한다.

- 위치: seal 직전, `sharpenCheckpoint(checkpoint, context)` — LLM 1콜.
- 출력: `{ quality: 'ready' | 'needs_sharpening', suggested_revision?: string,
  issue?: string }`. CODEX의 5차원 리뷰(observability, judgment_connection,
  discrimination, honesty, burden)는 프롬프트의 내부 사고 지침으로 쓰고,
  출력은 단순하게 유지한다 — 저장할 가치가 있는 것은 제안 1개뿐.
- `needs_sharpening`이어도 **저장은 막지 않는다**. 제안을 보여주고 사용자가
  탭 한 번으로 채택/무시. 무시 이력은 남기지 않는다(벌점 아님).
- `not_worth_tracking` 판정은 **사용자에게 말하지 않는다** — "추적할 가치가
  없다"는 사용자의 결정에 대한 평결이다(스파인). 대신 조용한 제안 모드에서
  체크포인트 자체를 제안하지 않는 것으로 표현된다 (clarify v2 §4.6 게이트).
- LLM 실패 시: 원문 그대로 저장 (honest gap — 벼림 실패가 저장 실패가 되면 안 됨).

CODEX §7.4의 벼림 카피 예시("이 체크포인트는 아직 넓습니다. '반응이 좋다'보다,
어떤 반응이 나오면 판단을 바꿀지 하나만 좁히겠습니다")는 그대로 프롬프트
few-shot으로 쓴다.

---

## 7. 귀환 화면 — 30초 계약

### 7.1 화면 구조 (CODEX §8.1 계승, 확정)

```
판단 체크포인트

그때의 판단:        ← contract에서 원문 (W4 — 창작 금지)
[decisionLine 또는 governing bet 원문]

다시 볼 기준:
[check_prompt 원문]

지금 보기엔 어땠나요?
[대체로 맞았다] [빗나갔다] [섞여 있었다] [아직 판단하기 어렵다]
```

- 탭 4개 + optional 자유 한 줄. 필수 입력 0개.
- 타입별 보조 프롬프트(CODEX §8.2)는 부제 한 줄로만.
- drift 타입이면 첫 블록이 "그때의 프레임" (원 real_question + lean) — §4.5.

### 7.2 verdict 매핑 — expectation 필드로 결정론화 (v2.1에서 재작업)

초판의 매핑 표는 자체 모순이 있었다("맞았다→avoided(risk)"와
"빗나갔다→happened(risk 현실화)"는 risk의 기대 방향을 서로 반대로 가정한다).
근본 원인: 기존 `PredicateVerdict`는 **사건 층위**(일어났다/피했다)이고 화면
4탭은 **판단 층위**(내 예상이 맞았다/빗나갔다)라서, 둘 사이 번역에는 "이
체크포인트는 무엇이 일어나길 기대했나"라는 방향 정보가 필요하다. 그것이
§3.1의 `expectation` 필드다. 매핑은 이제 결정론 순수 함수다:

```ts
function verdictFromTap(tap: Tap, expectation: 'occur' | 'not_occur'): PredicateVerdict {
  switch (tap) {
    case '대체로 맞았다':      return expectation === 'occur' ? 'happened' : 'avoided';
    case '빗나갔다':           return 'missed';   // 판단 층위의 miss — 방향 무관하게 균일
    case '섞여 있었다':        return 'partial';  // + AmbiguityRecord('mixed_signals')
    case '아직 판단하기 어렵다': return 'unknown';  // + AmbiguityRecord + 다음 손잡이 (§8)
  }
}
```

역방향(기존 데이터 표시)도 같은 함수의 역으로 유도 가능해야 한다 — 왕복
테스트를 Phase 1에 포함한다.

**enum 확장은 `'missed'` 하나, 이유가 선명해졌다:** 사건 층위 어휘에는 "예상이
빗나감"의 자리가 원래 없다(사건이 안 일어난 것과 판단이 틀린 것은 다른 사실).
`PredicateVerdict`에 `'missed'` 추가 (types.ts 한 곳, 소비처 grep 전수 —
statusline·patterns·plugin import(`plugin-parse.ts`)·admin 카운터가 verdict를
읽는다). 기존 데이터는 건드리지 않고, `expectation`이 없는 legacy 계약은
'occur'로 읽는다 (Defensive Data Access).

### 7.3 "아직 판단하기 어렵다" 경로 (CODEX §8.3 계승 + 구조화)

후속 질문 **1개만**: 무엇이 부족한가 — 4탭
(`insufficient_data / mixed_signals / low_confidence_interpretation / changed_context`).
그리고 가볍게 닫는다: "좋습니다. 이 판단은 아직 열어둡니다. 다음 손잡이: …"

```ts
// jsonb-nested, 마이그레이션 0
export interface AmbiguityRecord {
  reason: 'insufficient_data' | 'mixed_signals' | 'low_confidence_interpretation'
        | 'changed_context' | 'wrong_checkpoint' | 'not_enough_time';
  note?: string;
  next_handle?: ReturnHandle;   // unclear는 dead end가 아니라 더 가벼운 다음 체크포인트
}
```

`next_handle` 기본 제안은 결정론: 기존 handle의 cadence를 premises-core의
reponder 수학(기본 21일, floor 14, cap 90)으로 연장. 모델이 지어내지 않는다.

---

## 8. 1차 정산이 2차 정산을 판다 — 귀환 경험의 순서

**설계 원칙: 사용자가 처음 돌아왔을 때 요구되는 것이 "현실 보고"면 루프는
죽는다** (현실은 아직 안 왔고, 보고는 숙제다). 첫 귀환은 1차 정산 — 결과 없이
성립하는 대조:

```
1차 (생각↔생각): "그때의 나는 이렇게 봤다. 지금도 그렇게 보이나?"
  → 어떤 순간에도 가능, 30초, 정답 없음, AI 평결 0
  → 이것이 재방문의 온램프 — lean_after / drift 타입의 자리
2차 (생각↔현실): "신호가 도착했다. 기준과 대조하자."
  → due가 실제로 됐을 때만 — 이것이 moat (네이티브 LLM 메모리가 못 하는 것)
```

구현 함의:
- due 전 귀환(사용자가 그냥 들어옴)에도 체크포인트 카드는 1차 정산 모드로
  열린다 — "아직 기준일 전이에요"라고 돌려보내지 않는다.
- 리마인더 이메일·brief의 첫 CTA도 1차 정산 문구("그때의 판단을 다시 볼
  시간")로 — "정산하세요/채점하세요" 금지.
- 1차 정산의 기록(그대로/바뀜 + 한 줄)도 growth note를 낳는다 — 결과가
  없어도 "내 시야가 이동했다"는 것 자체가 판단 데이터다.

---

## 9. Due 계산과 귀환 트리거 — 새 알림 시스템 금지

### 9.1 재사용

- date handle: 기존 check-in cron + due-strip + statusline 그대로.
- evidence/manual handle: premises-core recheck cadence 수학 재사용 —
  `recheckCadenceDays`의 [floor 7, cap 180] 클램프, "제안이지 평결 아님" 주석의
  정신 포함.
- companion-brief: due 체크포인트를 brief에 1건까지만 포함 (이미 ambient 채널 존재).
- clarify의 "모르겠다"가 남긴 `open_question`(reconsider due — premises-core의
  `isDueForReconsider`)도 같은 due 표면에 실릴 수 있다. 단 **하루 1건 상한을
  체크포인트와 공유**한다 — 체크포인트가 due면 체크포인트가 우선, open_question은
  다음 날. 귀환 채널이 두 종류의 넛지로 붐비면 루프가 죽는다. (Phase 4에서 —
  컷라인 밖)

### 9.2 비-날짜 handle의 만기 상한

event/reaction/evidence handle은 auto_due가 불가능하다 → **"영원히 안 due"를
구조로 방지한다**: 모든 비-날짜 handle에 침묵 상한(기본 30일, jsonb에 기록)을
두고, 상한 도달 시 due가 아니라 **soft nudge**로 전환한다 — "이 체크포인트의
신호가 아직인가요? [아직임 — 30일 더] [지금 볼래요] [더 이상 안 봐도 됨]".
"더 이상 안 봐도 됨" = void, 벌점·유감 문구 없음.

### 9.3 스파인 가드

- nudge는 결정을 다시 열지 않는다 — "그때 A로 갔는데 정말 맞았어요?"류 금지.
  손잡이 상태만 묻는다.
- 미정산 개수로 죄책감 조성 금지 ("3건이 밀려 있습니다" ✗ → "다시 볼 판단
  1개" ✓ — 오늘 due인 것 하나만).

---

## 10. 기록 후 능동 피드백 — 창작 금지의 구조화

CODEX §10의 형태(기록됐습니다 / 이번 체크에서 넓어진 시야 / 다음 비슷한
판단에서 먼저 볼 것)를 채택하되, LLM-glue 규칙으로 조인다:

1. **입력 봉쇄:** growth note 프롬프트에는 (a) 원 판단 원문, (b) 방금 기록된
   verdict + ambiguity + 사용자의 한 줄만 주입한다. 세션 히스토리·성격 추정
   금지. 모델이 인용할 수 있는 것이 기록뿐이면 창작 여지가 구조적으로 준다.
2. **어휘 차단:** "당신은 ~한 사람/유형/경향" 패턴을 결정론 validator로 차단
   (clarify v2의 question-validator 재사용 — 같은 금지 목록).
3. **출력 형태:** 대조 1건 + 다음 주의점 1건, 각 1문장. 그 이상은 자르기.
4. **provenance:** growth note는 ai_surfaced 표기 + 사용자가 수정/삭제 가능.
5. **LLM 실패 시:** growth note 생략하고 "기록됐습니다"만 — 빈 자리를 채우지
   않는다 (honest gap).

```ts
export interface GrowthNote {
  scope: 'single_check' | 'emerging_pattern' | 'established_pattern';
  widened_view: string;       // 기록에 근거한 대조 1문장
  future_attention: string;   // 다음 주의점 1문장
  evidence_count: number;     // 이 노트가 딛고 있는 기록 수
}
```

---

## 11. 성장 피드백 티어 — patterns와의 경계

CODEX §11의 티어를 채택한다. 단, **집계 티어(2건+)는 이 시스템이 아니라
`patterns`의 소관이다** — 체크포인트 기록은 patterns가 읽는 데이터를 늘릴
뿐이고, 빈도 언어("최근 몇 번의 판단에서 운영 부담이 뒤늦게 커진 경우가
있었습니다")는 patterns의 sample-size-scaled 문장 규칙을 그대로 탄다.

| 기록 수 | 표면 | 문장 형태 |
|---|---|---|
| 1 | 기록 직후 growth note | 이번 체크의 대조 1건만 |
| 2–4 | patterns | "최근 N개 기록에서 ~한 경우가 있었습니다" (조심스러운 경향) |
| 5+ | patterns | 강점/주의/다음 초점 — 여전히 빈도 언어, 성향 언어 금지 |

미래 세션 주입은 reference-only: "참고: 지난 3회 기록에서 …" — 지시 금지
(LLM Prompt Injection Guidelines 준수).

---

## 12. 구현 계획 — Phase와 컷라인

**컷라인 = Phase 0–2.** 여기까지가 "귀환 루프가 실제로 돈다"이고, 이것이
활성화 절벽에 대한 답이다. 3+는 벼림.

### Phase 0 — 카피 스킨 + primary checkpoint (~2일)

1. `checkpoint-copy.ts` (ko/en) + "정산/계약" 카피 grep 전수 교체 (§3.3)
2. `PrimaryCheckpoint` + `ReturnHandle` 타입 추가 (jsonb-nested, 마이그레이션 0)
3. seal 흐름에서 primary checkpoint 지정: clarify v2 Phase 4의 seed가 있으면
   승계(W1), 없으면 top predicate + 날짜 handle로 자동 구성 (기존 동작 보존)
4. SealMoment에 체크포인트 카드: [이 기준으로 남기기] [수정] [이번엔 남기지 않기]
   — 남기지 않기도 1급 (강요 금지)
5. 테스트: W1, W2 (authorship 전환)

### Phase 1 — 귀환 화면 v2 (~3일)

1. 4탭 verdict + `verdictFromTap` 결정론 매핑 (§7.2) — `PredicateVerdict`에
   `'missed'` 추가 + 소비처 전수 grep (statusline, patterns, plugin import,
   admin). seal 흐름의 `expectation` 채움 로직 포함 (§3.1 — legacy는 'occur')
2. `AmbiguityRecord` + unclear→next_handle 경로 (§7.3)
3. 1차 정산 모드: due 전 진입 시 drift형 대조 화면 (§8) — lean_after 확장
4. 테스트: W4 (원문 렌더), verdict 매핑 **왕복**(tap→verdict→표시 라벨 복원),
   expectation 부재 legacy 계약의 열람, unclear가 다음 손잡이를 낳는지

### Phase 2 — due·트리거 접붙이기 (~2일)

1. 비-날짜 handle의 soft-nudge 상한 (§9.2)
2. due-strip·statusline·이메일·brief가 primary checkpoint를 읽게 (기존
   contract 읽는 자리에 확장 — 새 채널 금지)
3. 테스트: W3 + **실DB 행수 확인 1줄** (settle 후 예상 테이블/컬럼에 기록이
   실제로 도착했나)
4. 출하 후: 창업자 dogfood — seal 1건 + 1차 정산 1건이 실제로 돌아오는지.
   **이 관찰이 Phase 3+ 진행의 게이트다** (CODEX §18의 정신: 루프가 진짜인지
   먼저 증명).

### Phase 3 — 벼림 게이트 + growth note (~3일)

1. `sharpenCheckpoint` (§6) — 차단 아님, 제안만
2. growth note (§10) — 입력 봉쇄 + 어휘 차단 + honest gap
3. 테스트: W5 (patterns 도착), 성향 어휘 차단 픽스처

### Phase 4 — 타입 라우팅 + 이력 주입 (~2일)

1. `chooseCheckpointType` 결정론 함수 (§4.6) — clarify v2 Phase 4와 연결
2. settled 이력의 reference-only 주입 (§11) + W6 테스트
3. plugin/MCP parity: 어휘·seal/settle 페이로드의 primary_checkpoint 승계 —
   드리프트 테스트

---

## 13. CODEX Open Questions 5개 — 전부 결정

| # | 질문 | 결정 |
|---|---|---|
| 1 | standard/drift를 사용자 노출 타입으로? | **내부 전용.** 사용자는 check prompt 문장만 본다. 타입 이름 노출은 분류 학습을 강요한다 — §4 |
| 2 | growth note 즉시 vs /argus:journal? | 즉시 = 이번 기록의 대조 1건만(1문장). 집계는 patterns/log 소관 — §11 |
| 3 | 반복 unclear 시 void 제안 시점? | 같은 체크포인트에서 같은 reason으로 **2회 연속** unclear면 3번째 nudge에 void 옵션을 나란히 제시. 자동 void 금지(사용자의 결정) — §9.2의 soft-nudge 3버튼이 그 자리 |
| 4 | 저장 후 수정 가능? 원 기준 보존은? | 수정 가능. **append-only amend** — premises-core의 amend 상태기계(accept/refine/replace/retire)를 그대로 재사용. 원문은 항상 보존되고 standard check는 원 기준을 보여준다 — §4.4 |
| 5 | 최소 스키마 변경? | 컬럼 추가 0. 전부 `projects.decision_contract` jsonb 내부 (`primary_checkpoint`, `ambiguity`, `growth_note`) + `PredicateVerdict`에 `'missed'` 리터럴 추가 — §3.1, §7.2. schema-drift 테스트는 컬럼 불변이므로 무변경. 단 plugin import 파서(`plugin-parse.ts`)가 새 필드를 관용적으로 통과시키는지 확인 |

---

## 14. Anti-patterns (CODEX 계승 + 2 추가)

CODEX §15의 4개(fake rigor, moralized settling, over-personalized coaching,
ambiguity collapse)를 그대로 유지하고, 이 코드베이스의 역사가 추가하는 2개:

**5. 병렬 정본 (the 8-duplicates trap)**
새 개념이 생길 때마다 새 객체/테이블을 만들면 정본이 사라지고 데이터가
증발한다. 체크포인트는 contract의 스킨이다 — 이 문서 이후에 또 "체크포인트를
확장하는 새 객체"가 필요해 보이면, 먼저 contract에 들어갈 수 없는 이유를
문서로 증명하라.

**6. 조용한 gap-fill (the LLM-glue trap)**
귀환 화면에 원 판단이 없으면 모델이 그럴듯하게 요약해 채우고 싶어진다.
금지 — 원문이 없으면 "원 기록을 찾을 수 없습니다"가 정직한 화면이다.
growth note가 만들어지지 않으면 없는 채로 낸다.

---

## 15. 성공 기준 — 기존 계측기에 배선

CODEX §16의 지표를 채택하되 전부 기존 인프라로 측정한다 (새 대시보드 금지 —
captured data > dashboard):

- seal 시 체크포인트 채택률 / 수정률 / 남기지-않기율 → `user_events`
- due → 귀환율, 1차 정산 진입률 → `user_events` + /admin 카운터
- 정직한 모호함 비율 (unknown+partial / 전체) → verdict 분포
- unclear → next_handle 생성률 (dead-end가 아닌지)
- 30초 완결율 (settle 화면 진입→기록 시간)
- **북극성 (정성):** "이 판단을 다시 봐서, 그때 못 보던 것이 보였나?"

첫 버전이 증명할 것은 하나다 (CODEX 원문 유지):

> 과거의 판단으로 돌아가는 것이 사용자에게 "내 판단이 더 선명해졌다"는 느낌을
> 실제로 만드는가. 만들면 Argus에 진짜 루프가 있는 것이고, 아니면 체크포인트는
> 또 하나의 산출물일 뿐이다.

v2가 더하는 한 줄:

> 그리고 그 첫 귀환은 현실이 도착하기 전에도 성립해야 한다 — 1차 정산이
> 2차 정산을 판다.
