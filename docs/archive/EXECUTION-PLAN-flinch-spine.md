# 실행 계획 v2 — 추측항법 여정 이식 (Trial Sail → Seal → Reckoning)

> **지위:** 단일 활성 실행 계획. 2026-06-10 작성, 같은 날 v2 개정(사용자 여정 통합).
> 프레임: `docs/FRAMEWORK-decision-navigation.md` · 방향: `MASTER-DIRECTION-v4.md` §L4 · v5 문서 만들기 금지.
> **실행자:** 저렴한 모델(Sonnet급). 각 작업은 재결정 없이 실행 가능하도록 작성됨. 모르는 게 나오면 멈추고 인간에게 묻는다 — 추측으로 채우지 마라.
> **대원칙: 여정의 뼈대는 살리고 장기를 이식한다.** 기존 5단계 상태머신·스토어·컴포넌트를 삭제하지 않는다. 모든 신규 경로는 flag 뒤.

---

## 0. 설계 요약 (실행자 필독 — 이 절이 모든 작업의 '왜')

**원리 (프레임 §1):** AI가 판정하면 출구가 없다(반대→기각, 동의→고착 64.5%). 출구는 둘: **측정**(기각 불가능한 일어난 일)과 **자기 언어화**(자기 멈칫엔 편향 불가). → **AI의 생성력은 최대로, 판정은 0으로.**

**후보 레버 4종 — Phase 0 백테스트가 승자를 고른다 (사전 선택 금지):**

| 레버 | 부류 | 메커니즘 | 잡는 실패 |
|---|---|---|---|
| A. 과주장 캐스케이드 | 감지형 | 성공 논리를 하중 비트마다 한 칸 과장, 사용자 멈칫=표적 | 추론 사슬의 과신 (약점: 멈칫 감도 의존) |
| B. 차분 생성 | 감지형 | 대안 계획 diff, "이쪽이 아닌 이유 한 줄?" | 고려 안 한 대안 (약점: 축을 AI가 고름) |
| C. 분기 탐침 | 측정형 | 같은 문단을 N개 독립 실행자에 투입(차별화 지시 없음), 결정 필드의 갈림 측정 | **말 안 해서 고정 안 된 판단** |
| D. 하중 탐침 | 측정형 | 문장을 하나씩 빼고 재실행, 결정이 바뀌는데 근거 없는 문장 발화 | **말했는데 근거 없는 하중 주장** |

**활용 가설(여정의 등뼈): 측정(C/D)이 자리를 찾고 → 감지(B형 질문)가 사용자의 말로 바꾸고 → Seal이 잠그고 → Return이 정산한다.**
잔여 사각(정직): 모델이 사용자와 가정을 공유하면 텍스트 레버 전부 실패 — 완화=교차-모델 샘플링, 최종 해소=Return뿐.

**불변 규율 (모든 프롬프트·UI·카피):**
1. 모든 AI 문장은 사용자 문단의 구절을 인용·지목 (논문 Figure 7: Evidence Grounding만이 신뢰·정답 동시 예측).
2. AI 판정·점수·"당신의 사각은 X" 단정 금지. 갈림·하중은 측정치로만 제시.
3. day-1 약속: "사각 찾음" 금지 → "반증 가능한 내기 1개 획득".
4. 탐침이 조용하면 억지 생성 금지 — 침묵 자체가 출력 (→ P1.4).
5. 카피 톤: 기존 해요체 동료 음성 유지. 측정은 헤드라인이 아니라 "진짜로 읽었다"의 증거로만. 감정 축 = **알아봄**("동의는 흔하고 알아봄은 희귀하다")과 **귀환**("그래서, 어떻게 됐어요?"). 점수·등급·칭찬·경고 어휘 금지.

**보존해야 할 기존 강점 (건드리면 안 되는 것):**
- 무인증 한-문장 진입 (workspace 히어로 텍스트박스)
- 스트리밍 분석 극장 (analyzing 단계의 타이머·커서·점진 렌더)
- 질문 루프 UI (`next_question` + options 선택지 구조)
- `DecisionContractCard` + `supabase/migrations/20260608_decision_contract.sql`
- 이번 브랜치의 voyage-state 필터 + reckoning nudges (커밋 `fa78ef8`)
- `signal-recorder.ts`, `version-numbering.ts`, convergence 게이지, 산출물 그릇(OutputSelector)
- 17 에이전트 / boss — 삭제·축소 금지, 위치만 "봉인 이후 opt-in"으로 이동

---

## 여정 매핑 (목표 상태 — 각 Phase가 이 표의 한 행을 이식한다)

| # | 현 단계 (`progressive-engine.ts` STAGE_PHASES) | 이식 후 | 담당 Phase |
|---|---|---|---|
| 1 | 입력 | 그대로 | — |
| 2 | `analyzing` 분석 | **시험 항해 (Trial Sail)** — 실행자 N명 생중계 → 갈림·용골 발견 | P1 |
| 3 | `conversing` 질문 | **키잡이 질문** — 측정된 갈림이 질문이 됨, 갈림 수 = 역방향 수렴 게이지 | P2 |
| 4 | (없음) | **봉인 (Seal)** — 내기 1–3개 + check_by, 터미널 순간 | P3 |
| 5 | `complete` 산출물 | **출항** — 산출물 = 봉인된 판단의 운반 그릇 | P3 |
| 6 | `mixing`·`dm_feedback` | **opt-in 심화** — "이 내기를 팀이 검증하게 하기" | P3 |
| 7 | (씨앗: reckoning nudges) | **귀환 (Reckoning)** — check_by 정산 "그래서, 어떻게 됐어요?" | P4 |
| 8 | (씨앗: patterns) | **자차표 (Ledger)** — 정산 누적 후 | P5 |

---

## Phase 0 — 레버 백테스트 (웹앱 변경 없음 · 인간 모집 없음) — **모든 코드의 선행 게이트**

### P0.1 백테스트 픽스처 [S]
- 결과를 아는 "결정 전 문단" ≥10개: `.argus/sessions/`, docs/ 과거 결정(오케스트라→항해 피벗, 플러그인 v1→v2 등), 공개 포스트모템 2–3건.
- `scripts/flinch-eval/fixtures/*.json` — `{ paragraph, actual_outcome, actual_failure_point, specificity: "vague"|"specific" }`.
- **수용:** ≥10개, failure_point 각 한 문장, specificity 라벨링 완료.

### P0.2 레버 4종 프롬프트 v1 [M]
- `scripts/flinch-eval/levers/{a,b,c,d}.ts` + 러너 `scripts/flinch-eval/run.ts` (API 직접 호출, `src/` 미접촉).
- A: `{ beats: [{claim, quoted_anchor, overreach_level}](3–4), fallback_ai_pick }`
- B: `{ alt_plan_summary, diff_axis, diff_table(≤3행) }`
- C: `{ samples: N×{week1_action, key_resource, success_test, purpose_reading}, forks: [{field, variants, cause_quote, flipped_user_claim}] }`
  - N=3–5 병렬, 저렴 모델, 가능하면 교차-모델 혼합. 갈림 판정은 결정-관련 필드만(의미 클러스터링). **`flipped_user_claim`(그 갈림에 따라 참/거짓이 바뀌는 사용자 문장 인용) 없는 갈림은 버림** — "뻔한 갈림" 방지.
  - `purpose_reading` = "이 브리프가 누구의 어떤 문제를 푸는가" — 목적 해석의 갈림도 같은 배치에서 측정 (기존 reframe의 측정형 재유도).
- D: `{ ablations: [{removed_sentence, decision_shift, evidence_in_text|null}], findings: shift 있고 evidence null인 것만 }`
  - 문장별 제거 × 샘플 2–3 다수결. 근거 있는 하중 문장은 정상 — 침묵.
- **수용:** 픽스처 전부 스키마 유효 + 모든 주장에 인용 앵커.

### P0.3 스왑 테스트 [S]
- 문단 A의 출력을 문단 B에 붙여 양쪽 다 그럴듯하면 불합격. LLM-judge는 위치 무작위화.
- **수용:** 레버별 스왑 통과율.

### P0.4 헤드투헤드 [M]
- A·B·C·D·`/blindspot`의 발견이 actual_failure_point를 포함하는지 블라인드 채점(채점자에 레버 은닉).
- 구체성별 분해 — 예측: vague에서 C, specific에서 B·D 강세. 상관 확인 시 갈림-수 기반 기계 라우팅 정당화.
- **수용:** 5열 비교표(적중률·스왑 통과율·지연·토큰 비용·구체성 분해).

### 🚪 GATE G0
- 승자 = 적중률 > blindspot 베이스라인 **그리고** 스왑 ≥80%. 복수면 조합(측정→감지) 검토.
- **이하 Phase 1–3은 측정형(C/D) 통과를 가정해 작성됨.** A/B가 단독 승자면: 여정 뼈대는 동일, 2단계의 내용물만 승자 레버로 교체하고 P1.1/P2.1을 그에 맞게 재작성(인간에게 보고 후).
- 전부 베이스라인 이하 → **중지, 인간 보고. 코드 쓰지 마라.** (§7 내기 1)

---

## Phase 1 — 시험 항해: `analyzing` 단계 이식 (flag 뒤)

### P1.0 플래그 [S]
- `useSettingsStore`에 `trialSailEnabled: boolean` (기본 false) + URL `?trial=1` 오버라이드. 신규 경로 전체가 이 플래그 하나로 켜지고 꺼진다.
- **수용:** off 시 기존 경로 픽셀 단위 무변화.

### P1.1 탐침 엔진 [M]
- 신규 `src/lib/probe-engine.ts`: `runDivergenceProbe(paragraph, opts)` + `runAblationProbe(paragraph, opts)` — P0 승자 프롬프트를 그대로 이식(재발명 금지).
- 신규 API 라우트 `src/app/api/probe/route.ts` — 스트리밍: 각 실행자 샘플이 도착하는 대로 emit(극장 효과), 갈림 집계는 전체 도착 후.
- 재사용: `src/lib/llm.ts` 호출 패턴, `sanitizeForPrompt()` + `<user-data>` 태그(CLAUDE.md 보안 규칙), 기존 rate-limit 경로.
- 상태는 신규 소형 스토어 `src/stores/useProbeStore.ts`에 — **`useProgressiveStore`(1807줄, L2 분해 진행 중)를 건드리지 마라.**
- **수용:** 문단 POST → 첫 샘플 스트림 <15초, 전체 갈림 집계 <60초, 비용 로그 출력.

### P1.2 시험 항해 UI [M]
- 신규 `src/components/workspace/voyage/TrialSail.tsx` — flag on일 때 analyzing 단계의 콘텐츠를 대체(컨테이너·타이머·스트리밍 어포던스는 기존 것 재사용).
- 렌더 순서: ① "당신의 브리프를 실행자 {N}명에게 그대로 줬어요" 한 줄 → ② 실행자 카드 N개가 도착 순으로 채워짐(week1_action 중심) → ③ 갈림 콜아웃: 갈린 필드 + 원인 구절 인용 + `flipped_user_claim` ("이 선택에 따라 '{인용}'이 참도 거짓도 됩니다") → ④ 용골 발견(D): "이 문장을 빼봤더니 계획이 {shift}로 바뀌어요. 그런데 문단 안에 이 문장의 근거가 없어요."
- 카피 톤: §0 규율 5. 판정 어휘 금지 — "문제", "위험", "잘못" 대신 "갈렸어요", "비어 있어요", "혼자 받치고 있어요".
- **수용:** 데모 시나리오 3종에서 ①→④ 렌더, 모든 콜아웃에 사용자 문장 인용 존재.

### P1.3 목적-수준 갈림 [S]
- C의 `purpose_reading` 갈림을 별도 섹션 최상단에: "실행자들이 이 브리프의 *목적*을 다르게 읽었어요 — {변형들}. 어느 쪽인가요?" (기존 reframe의 측정형 대체. 기존 reframe 코드는 삭제하지 않음 — flag off 경로에서 계속 사용.)
- **수용:** purpose fork 존재 시 최상단 렌더, 부재 시 섹션 미출력.

### P1.4 침묵 모드 [S]
- forks==0 && keel findings==0 → "고정된 브리프" 카드: "실행자 {N}명이 같은 곳으로 갔어요. 브리프는 고정됐습니다. 남은 위험은 텍스트 밖에 있고 — 그건 내기로만 잡혀요." + 곧바로 봉인 CTA.
- **수용:** 매우 구체적인 픽스처 입력 시 이 카드가 뜨고 P3로 직행 가능.

### P1.5 신호 기록 [S]
- `src/lib/signal-recorder.ts`에 추가: `trial_sail_shown{forkCount,keelCount}`, `fork_viewed`, `silence_shown`. 기존 경로 이벤트는 유지(A/B 비교용).
- **수용:** flag on/off 양쪽 모두 이벤트 적재.

### 🚪 GATE G1a — 창업자 dogfood: 본인 실제 결정 3건에서 시험 항해가 "뻔하지 않은" 갈림/용골을 ≥1개씩 냈는가. 아니면 P2 진행 전 프롬프트 보정.

---

## Phase 2 — 키잡이 질문: `conversing` 단계 이식

### P2.1 갈림→질문 컴파일러 [M]
- 신규 `src/lib/fork-to-question.ts`: fork → 기존 질문 타입(`FlowQuestion`: text + options) **기계적 변환** — LLM 판단 없음(포매팅 호출만 허용).
  - text = "{fork.field}: {원인 구절 인용} — 어느 쪽이 당신 뜻인가요?"
  - options = 실행자들이 실제 고른 변형들 + "직접 쓸게요"(자유 입력).
- 우선순위: purpose fork → flipped_user_claim 강도순. **한 번에 1문항, 세션당 최대 3문항** (질문 피로 한도).
- **수용:** fork 입력 → 유효 FlowQuestion 출력 단위 테스트(LLM 없이 결정적), 4번째 질문이 생성되지 않음.

### P2.2 해소 루프 + 역수렴 게이지 [M]
- 답변 → 작업 브리프에 한 줄 병합("단, 10명은 헤비유저 기준") → 갈린 필드만 경량 재탐침 → 갈림 수 감소를 게이지로: **"갈림 3 → 1"** (기존 convergence 게이지 컴포넌트 재활용 — 채워지는 방향만 반대).
- 재탐침 비용 가드: 세션당 재탐침 최대 2회.
- **수용:** 질문 답변 후 갈림 수가 줄어드는 게 화면에서 보임, 재탐침 3회째 시도가 차단됨.

### P2.3 감지형 마무리 질문 [S] (B 레버의 자리 — G0에서 B 생존 시에만)
- 갈림이 모두 해소되고 D 발견도 없을 때 한 번만: 대안 diff 1장 + "이쪽이 아닌 이유 한 줄?" — 기각 한 줄을 봉인 초안의 재료로 저장.
- **수용:** 조건 미충족 시 절대 미출력.

### P2.4 신호 기록 [S]
- `fork_resolved{field, via: option|freetext}`, `reprobe_run`, `rejection_line_written`.

### 🚪 GATE G1b — dogfood 5건 완주(질문 ≤3개에서 갈림 0 또는 한도 도달). 중앙값 질문 수 >3이면 컴파일러 우선순위 보정.

---

## Phase 3 — 봉인과 출항: 터미널 순간 재배선

### P3.1 봉인 초안기 [M]
- 신규 `src/lib/seal-drafter.ts`: 입력 = 해소된 갈림 + 미해소 갈림 + D 발견 + (있으면) 기각 한 줄 → 출력 = 내기 초안 1–3개 `{ predicate, falsified_if_signal, check_by_suggestion }`.
- 기계적 템플릿 우선: 해소된 갈림 → "{선택}으로 간다. {반대 신호}가 {기간} 내 보이면 {대안}이었던 것." / D 발견 → "{하중 문장}이 참이라는 데 건다. 확인 방법: {…}". LLM은 문장 다듬기만.
- **수용:** 갈림·발견 0개여도(침묵 모드) 사용자 결과 주장에서 내기 1개가 초안됨.

### P3.2 봉인 UI [S]
- **기존 `DecisionContractCard` + `20260608_decision_contract.sql` 재사용. 새 테이블·새 카드 금지.** 초안 편집 가능, check_by 날짜 선택, "봉인" 액션 → 세션 상태 `sealed`.
- **수용:** 봉인된 내기가 기존 decision_contract 경로로 저장(`db.ts` 경유 — 직접 insert 금지, CLAUDE.md).

### P3.3 여정 재배선 [M]
- flag on 시: `conversing` 완료 → **`sealing`(신규 논리 단계, 기존 STAGE_PHASES 배열은 미수정** — 신규 경로의 분기로 처리) → `complete`.
- `mixing`·`dm_feedback`은 봉인 카드 하단의 opt-in 두 개로 이동: "이 내기를 팀이 검증하게 하기"(→기존 mixing), "이해관계자라면 어디를 찌를까"(→기존 dm_feedback/boss). **미선택 시 멀티에이전트 호출 0.**
- **수용:** opt-in 미선택 완주 시 API 호출 로그에 team/boss 호출 부재.

### P3.4 산출물 = 운반 그릇 [S]
- `OutputSelector` 유지. 각 산출물 머리에 봉인된 내기 블록 삽입("이 문서가 깔고 있는 내기"). 산출물 라벨의 음악 메타포(파트보/총보/셋리스트)를 항해 어휘로 교체 — Philosophy v2 §224-232에 이미 정의된 어휘 사용(항해일지/선원 지시서/전체 해도/점검표 + 판단 근거서). i18n 키 함께 수정, `grep -r "파트보\|총보\|셋리스트" src/` 0건 확인.
- **수용:** 5종 산출물 전부 머리에 내기 블록, 음악 메타포 grep 0건.

### P3.5 변침 기록 (amend) [S]
- check_by 전 내기 수정 시: 덮어쓰기 금지 — `version-numbering.ts` 패턴으로 수정 이력 행 추가(원문 보존).
- **수용:** 수정 후에도 원래 predicate가 조회 가능.

### 🚪 GATE G2 — 창업자 본인 실제 결정 5건이 봉인까지 완주 + 그중 ≥3건이 "내기를 수정하고 싶어짐"(관여 신호). 아니면 §7 내기 2 발동.

---

## Phase 4 — 귀환 (Reckoning): "그래서, 어떻게 됐어요?"

### P4.1 정산 표면 [M]
- **이번 브랜치의 voyage-state 필터 + reckoning nudge(커밋 `fa78ef8`)를 확장** — 신규 구축 금지, 기존 nudge에 정산 모달 연결: check_by 도래 내기 목록 → "그래서, 어떻게 됐어요?" → [발생 / 회피 / 부분 / 아직] → 결과 기록(decision_contract 스키마의 결과 필드 — 부재 시 컬럼 1개 마이그레이션).
- **수용:** check_by 지난 내기가 /project에서 눈에 띄고 3탭으로 정산됨.

### P4.2 콘시어지 프로토콜 [인간 — 자동화 금지]
- 본인 내기 포함, 정산 누적 5건까지 수동. 외부 사용자 투입 시점·방식은 인간이 별도 결정 — **이 계획의 게이트가 아님** (retention 논지는 미검증으로 남음을 정직 표기).

### P4.3 귀환 자동화 [M — 착수 조건: 정산 누적 ≥5건]
- Resend(기존 의존성) 이메일: 제목 "그래서, 어떻게 됐어요? — {predicate 요약}". 본문 3탭 딥링크.

## Phase 5 — 자차표 [착수 조건: 사용자당 정산 ≥5건]
- patterns 표면 확장: "이 종류의 결정에서 {N}번 중 {M}번, 같은 방향으로 기울었어요." 그 전에 만들지 마라 — 데이터 없는 자차표는 빈 거울이다.

---

## 6. 부수 작업

- **H1 [S]:** 루트 클러터(`shot*.mjs`, `*-shot.mjs`, `val-*.png`, `voyage*.png`, `dev.log`) 정리 + `.gitignore`.
- **H2 [S]:** `ARGUS-REPO-MAP.md` canonical 문구 v4와 정합 + 사실 오류 2건(3D demo·e2e 부재) 수정; stale 문서 SUPERSEDED 배너.
- **카피 팩 [S]:** 신규 경로 문자열 전체를 §0 규율 5의 톤으로 — 피치/태그라인 원전은 `FRAMEWORK-decision-navigation.md` §7.
- **플러그인 트랙 [기록만]:** clarify→시험 항해 이식, contract_seed→Seal 정합은 웹 G2 통과 후 별도 계획. 지금 하지 마라.
- **보류 유지:** legacy `/tools/*` 차단은 G2 후.

## 7. 이 계획 자체의 봉인 (check_by는 착수 시 인간 기입)

| # | 반증 가능한 예측 | check_by | 틀렸을 때 (미리 결정) |
|---|---|---|---|
| 1 | 레버 4종 중 무엇도 백테스트에서 blindspot을 못 넘으면, 첫-턴 거울 가설은 비싼 재포장이다 | ____ | Phase 1 착수 금지, 인간 보고 |
| 2 | 창업자 본인이 실제 결정 5건에 안 쓰게 되면, 외부 사용자도 안 쓴다 | ____ | 폴리시 추가 금지 → 마찰 지점 1개 식별 후에만 재시도 |
| 3 | 본인 내기 정산 시점에 정산할 동기가 없으면 Return 논지가 약하다 | ____ | Phase 4.3·5 동결, 첫-턴 단독 가치로 재구성 |
| 4 | 키잡이 질문 중앙값이 3을 넘으면 사용자는 답하다 떠난다 | ____ | 질문 한도 2로 축소 + 갈림 우선순위 재보정 |

---
*개정 이력: v1 — 레버 중재 + 인간 모집 게이트(폐기). v1.1 — 분기·하중 탐침 추가, 인간 게이트 제거. v2(현재) — 사용자 여정 통합: analyzing→시험 항해, conversing→키잡이 질문, 봉인 터미널, mixing/dm_feedback opt-in화, reckoning nudge 확장, 카피 톤 규율(알아봄·귀환) 추가.*
