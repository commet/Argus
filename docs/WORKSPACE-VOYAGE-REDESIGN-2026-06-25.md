# Argus 워크스페이스 항해(Progressive Voyage) 통합 재설계

> 한 문서로 끝내는 진단·재설계. 모든 주장은 실제 코드(`file:line`)에 근거. 스파인(`maximum generation, zero judgment` / 정직한 출처 / 단발 약속 / n=1 해자)을 어기는 제안은 없음.
> 생성: 2026-06-25, 16-agent ultracode 워크플로우(맵 4 → 파트 비평 9 + 교차 2 → 통합 1).

---

## 1. 한 줄 진단

**항해는 "진짜 질문 + 가장 중요한 전제"라는 단 하나의 알맹이를, 사용자가 앞으로 나아갈 때마다 8개의 서로 다른 카드로 다시 그려서 보여주면서, 정작 그 알맹이를 담은 진짜 문서(`AnalysisSnapshot[]`)는 봉인되지도·되돌아오지도·다음 항해로 넘어가지도 않는다.**

즉 사용자는 **표면은 반복**해서 보고(그래서 "뭐가 어떻게 흘러가는지 모르겠다"), **알맹이는 증발**하는 것을 겪는다(그래서 47개 열고 0개 봉인 / 0개 정산). 이 두 문제는 사실 **같은 결함의 양면**이다 — 정본(正本, single source of truth)이 되는 객체가 없으니, UI는 같은 줄을 곳곳에서 다시 만들어내고(중복), 그 객체에 무언가를 붙여 영속·전달할 수도 없다(증발).

지금의 병목은 배포가 아니라 **활성화(activation)**다. 그리고 활성화가 죽는 지점이 정확히 해자가 채워져야 할 지점이다.

---

## 2. 항로 문서(course doc)의 정체 — 창업자 질문에 직답

대상: `AnalysisCard`가 그려주는 진화하는 `AnalysisSnapshot`("우리가 잡은 항로") — `real_question` + `insight` + `hidden_assumptions[]` + `skeleton[]` + `execution_plan`, 그리고 라운드별 "뭐가 바뀌었나" 짝꿍인 `UpdateSummaryChip`.

### 축적되나, 휘발되나? (ground truth)

**둘 다 — 세션 안에서는 축적되지만, 해자 기준으로는 가장 휘발성이 높다.** 이게 핵심 역설이다.

- **축적**: `addSnapshot`이 매 라운드 append (`useProgressiveStore.ts:649-653`), localStorage에 즉시 + Supabase `progressive_sessions.data` jsonb 블롭 안에 통째로 저장 (`:371-380`). 리로드 후에도 살아남는다. 표면적으로는 가장 잘 저장되는 산출물처럼 보인다.
- **휘발**: 그런데 이 내용은 **앞으로 아무것도 전달하지 않는다.**
  - `extractPredicatesFromSession`은 mix / dm_feedback / debate / falsification만 읽고, `real_question` / `hidden_assumptions` / `skeleton`은 **단 한 번도 참조하지 않는다** (`decision-contract.ts:223-281`, grep 0건).
  - `deriveCurrentBearing`은 스냅샷을 **입력으로조차 받지 않는다** ("DERIVED, never stored", `current-bearing.ts:8`, 입력은 mix/final_mix/dm/debate/falsification, `:86-93`).
  - 유일하게 살아남는 흔적은 logbook의 **80자짜리 잘린 waypoint 헤드라인** (`voyage-log.ts:113,128`).
  - 봉인에 닿는 유일한 구조적 통로는 **내용이 아니라 메타데이터**다 — seal 절제 게이트가 마지막 스냅샷의 `stakes`/`reversibility`/`framing_confidence`만 읽는다 (`ProgressiveFlow.tsx:994-998`).

**판정: 사용자가 "내가 잡은 항로"라고 읽는 바로 그 화면이, 실제로 정산되는 것 대비 파이프라인에서 가장 잘 사라지는 물건이다.**

### 무슨 의미인지 / 왜 존재하는지

존재 이유는 정당하다. 이건 제품의 **핵심 가치(frame→fork)가 눈에 보이는 형태로 구현된 곳**이다 — "사용자가 던진 표면 질문"을 "진짜 질문"으로 다시 잡아주고, 사용자가 말하지 않은 전제를 드러낸다. 리프레임 + 전제 거울은 제품이 파는 것 그 자체다. 직업적으로 진짜 일을 한다.

문제는 **라벨의 과대주장**이다. 라운드 0에서는 사용자가 문장 하나 친 게 전부인데, 화면은 "우리가 잡은 항로 / Course we plotted"라고 **공동 저작(we)을 주장**한다 (`AnalysisCard.tsx:71,111`). 같은 부류의 내용을 MirrorBeat는 "AI가 채운 전제"(`ai_surfaced`)로 정직하게 음영 처리하는데, 이 카드는 안 한다.

### 사용자에게 주는 가치 (정직하게)

원리상 가장 방어 가능한 가치(구조화된 거울)지만, **실제로는 세 가지로 깎여서 얇다:**

1. **가시성 역전**: focus 모드(기본값, `ProgressiveFlow.tsx:1024-1025`)에서 이 카드는 `conversing` 동안 `defaultCollapsed`라 `real_question` 한 줄만 보인다 (`:2848`). 가장 공들인 산출물(insight 인용구, 번호 매긴 전제, step-flow, 6종 애니메이션)이 정작 활성화 사용자에게는 거의 안 보인다. (씰 분석에서 나온 "Phase 2가 22:1로 과잉 빌드"의 반복)
2. **중복**: `real_question`이 UpdateSummaryChip(`:96-101`)과 MirrorBeat에도, 최상위 전제가 MirrorBeat에도, 전제가 VoyagePrepSummary에도 다시 나온다. 카드가 3개의 다른 표면과 같은 내용을 두고 경쟁한다. 게다가 카드 안의 정교한 diff(line-through/step 재정렬)는 **라운드를 가로질러서만 작동**하는데, 바로 그 라운드에서 카드는 접혀 있다 — 아무도 안 보는 빌드.
3. **퍼널**: 내용이 영속적으로 아무것도 남기지 않으니, 읽는 사람조차 1회성 통찰만 얻고 복리 자산을 못 얻는다.

### 지금 형식이 맞나?

**절반은 틀렸다.** 진화-diff 문서는 인식(recognition) 표면으로는 아름다운 형식이지만, 자기 패배적으로 배치돼 있다. 두 갈래 중 하나로 정직하게 정해야 한다.

- (A) 카드를 **진짜 인식 표면으로 승격**: diff 라운드 동안 접지 말 것 (diff가 핵심이니까), 또는
- (B) 강등을 받아들이고 **카드 안 diff 기계를 빼버린다** — "뭐가 바뀌었나"는 UpdateSummaryChip이 단독으로 소유하게.

**(B)를 권한다(빼는 쪽).** 카드 안 diff는 접혀 있는 라운드에서만 작동하므로 칩의 ±N/−N과 겹치는 낭비다.

### 나중에 활용 가능한가?

**지금은 거의 불가능(가장 큰 누수).** 가장 풍부한 추론 산출물이 아무것도 적립하지 못한다. 활용하려면:
- 확정된 `real_question`을 프로젝트의 정본 framing으로 앞으로 흘려보내고(bearing이 이걸 읽게),
- 확인된 `hidden_assumptions`를 `extractPredicatesFromSession`의 후보 predicate로 만들고,
- 다음 항해에는 **참고용 빈도 진술로만** 재주입("참고: 비슷한 결정에서 진짜 질문이 X로 드러난 적이 있어요"), 절대 lean/verdict 아님.

### 이 산출물의 최종 판정 + 재설계

**RESHAPE (재설계) — 죽이지 말고, 정본으로 승격하거나 diff를 빼라.**

1. (P1) 카드 안 diff 기계 **제거**, UpdateSummaryChip을 "뭐가 바뀌었나"의 단독 소유자로.
2. (P1·해자) 확정 `real_question` + 확인 전제를 contract/bearing으로 전달 (5절의 Bearing Ledger에 흡수).
3. (P2·스파인) AI 저작 음영 처리 또는 eyebrow를 사용자가 답한 후에만 "우리가 잡은 항로"로 — 라운드 0은 "AI의 첫 읽기"로.
4. (P2·스파인 보호) `framing_confidence`/`convergence_score`/`request_type`/`frame_status`를 이 표면에 **계속 노출하지 말 것** (현재 미노출 — 가드 주석으로 보호).

---

## 3. 토큰 한도 — 근본 해법

### 한도만 올리면 되나? — 아니오. 그런데 한 줄을 안 올리면 다른 모든 게 무효다.

**먼저 알아야 할 키스톤(앞선 맵들이 놓친 것):** 서버가 모든 요청을 **4096 토큰으로 하드캡**한다 — `llm-validation.ts:8` `MAX_TOKENS_CAP = 4096`, `normalizeMaxTokens`가 `Math.min(raw || 2000, 4096)` (`:33-34`), 라우트가 매 요청에 적용 (`route.ts:137`).

결과:
- 엔진이 선언한 `maxTokens: 4000`(runMix/runDeepening/runFinal/runNavigatorRevision)은 **이미 천장**이다.
- "적응형 예산"이나 "1.5배 재시도"는 **사망 상태**다 — `4000 × 1.5 = 6000`이 조용히 4096으로 깎여 사실상 +2%.

**그래서 한도 인상은 "충분조건"은 아니지만 "필수 전제"다.** 캡을 sonnet-4-6/haiku-4-5의 스트리밍 천장인 **64K로 먼저 올려야** 나머지(적응형 예산·재시도)가 비로소 가능해진다. 단 한도를 올린다고 truncation이 사라지진 않는다 — 구조화 출력조차 truncation을 막지 못한다(Anthropic 문서 명시: `stop_reason: max_tokens`면 출력이 잘릴 수 있음). 한도는 *빈도*를 줄이고, 진짜 해법은 **예방 + 탐지 + 복구**의 층위다.

### 층위 전략 (싼 것 → 깊은 것)

**0. 캡 인상 (전제, ~0 위험)** — `MAX_TOKENS_CAP`을 64K로. SDK는 이미 스트리밍 지원.

**1. 예방 — 프롬프트 배열 캡 (오늘 출하, ~0 비용)** — 구조화 출력 스키마는 `maxItems`를 지원하지 않으므로 **프롬프트 텍스트로** 강제: runMix "섹션 최대 6, 문장 ≤6", runDeepening `execution_plan.steps` "≤5", skeleton "정확히 5". 출력이 작아지면 truncation 빈도가 즉시 떨어진다.

**2. 탐지 — `stop_reason: max_tokens` 노출 (키스톤)** — 지금 라우트는 `content_block_delta`/`text_delta`만 전달하고 `stop_reason`을 실어나르는 `message_delta`를 **버린다** (`route.ts:171-176`). 그래서 클라이언트는 깨끗한 종료와 잘림을 구별 못 한다. 3점 수정: 라우트에서 `message_delta.stop_reason` 전달 → `callLLMStream`에서 포착(`llm.ts:830-849`) → `callLLMStreamThenParse`의 `onComplete`로 전달(`:918`). **이게 없으면 모든 적응형 복구가 장님이다.**

**3. 예방(구조) — 구조화 출력 (`output_config.format`)** — 서버 전용 변경(`route.ts:159-164/207`). `text_delta`로 그대로 스트리밍되므로 기존 전달·파싱이 한 글자도 안 바뀐다(forced tool use는 `input_json_delta`라 재작성 필요 — 피할 것). markdown fence/prose-wrap/wrong-type/missing-field 실패류를 죽인다. `repairTruncatedJSON`은 방어선으로 유지.

**4. 복구 — 죽은 재시도 갭 메우기** — 교정-재시도 루프는 **non-stream `callLLMJson`에만** 있고(`llm.ts:584-621`), 프로덕션 경로는 항상 `onToken`을 넘겨 stream 경로를 타므로 **자동 재시도가 실 경로에서 죽어 있다.** `callLLMStreamThenParse`에서 `stop_reason==='max_tokens'` 또는 `parse_failure`면 1회 재시도(캡 인상 후 `min(maxTokens×1.5, cap)`). 단 sonnet-4-6는 assistant prefill이 400이므로 "부분에서 이어쓰기" 불가 — 새 요청으로 재생성.

**5. 정직한 부분 수용 + UX 수선** — 재시도 후에도 잘리면, 복구된 스냅샷을 쓰되 **`incomplete` 태그**를 달고 "결과가 일부만 생성됐어요 — 다시 생성" + **진짜 Retry 버튼**. 그리고 **타이핑한 답을 `rollbackAnswer` 너머로 보존** (아래 참조).

**6. 섹션 분할 생성** — 데이터가 잔여 truncation을 보일 때만, 그리고 repair가 못 살리는 3개(`runMix`/`runFinalDeliverable`/`runNavigatorRevision`)에 한해서만.

### `repairTruncatedJSON`은 충분한가? — 아니오

좋은 최후 방어선이지만 1차 방어로는 부족하다. (a) **첫 필드 값 안에서 잘리면 전체 손실(null 반환)** — `{"insight":"긴 텍스트가 잘림…`는 콤마/닫힌 컨테이너/배열-문자열이 없어 `cut=-1` → null (`:270`). 가장 큰 단일 문자열 응답(`runNavigatorRevision.revised_text`, `runLeadSynthesis.integrated_analysis`)이 정확히 이 모양이라 **복구 불가**. (b) **성공해도 내용이 아니라 구조만** 복구 — 잘린 내용은 영영 사라지고 사용자에겐 완성처럼 보인다.

### "5케이스로 충분했나 / 사용자가 당황 안 하고 이어갈 수 있나" — 쉬운 말로

- **충분치 않았다.** 한국어는 토큰이 빽빽해서 같은 4000 한도라도 실제론 2~3배 빨리 차서 더 자주 잘린다(엔진 주석 `:636-639`). 무거운 호출(runMix가 모든 워커 결과를 먹음)일수록 위험. 5케이스로는 이 빈도가 안 잡힌다 — **잘림을 "탐지"하는 계측(층위 2)부터 넣어야** 실제로 얼마나 자주 잘리는지 숫자가 보인다.
- **지금은 당황한다.** 깊이 질문 턴에서 답이 깨지면, 사용자가 친 답이 롤백되며(`rollbackAnswer`, `ProgressiveFlow.tsx:1758`) `QuestionCard`의 로컬 `useState('')`(`:33`)가 빈 채로 리마운트돼 **단답형은 다시 타이핑**해야 한다. 에러 화면은 **닫기만 되는 배너**(`:2365-2388`)라 Retry가 없다. 47명 열고 0명 봉인하는 그 활성화 절벽에 정확히 이 막다른 길이 있다.
- **이어갈 수 있게 하려면**: (1) 타이핑한 답을 `question.id`로 키한 ref/store에 올려 보존, (2) 닫기-전용 배너를 **Retry 버튼**으로 교체(이미 `:3316-3328` 수정 모달에 패턴 존재), (3) 부분 생성 시 `incomplete` 표시. 이 셋은 단순 하드닝이 아니라 **스파인 정렬**이다(잘린 문서를 완성처럼 내미는 건 정직한-출처 위반, 막다른 길+답 분실은 해자가 의존하는 바로 그 퍼널 단계).

---

## 4. 각 파트 철학적·기능적 재평가

각 파트: 존재 이유 / 가치(theater면 theater라고) / 형식 / 지속성 / 연결 → **KEEP / RESHAPE / CUT**.

### 4.1 BIND — 출항 전 밧줄 묶기 (`BindCard.tsx`) → **RESHAPE (P0 다운스트림)**

- **존재 이유**: 두 일. (1) 즉시 — 반-앵커링: AI 답이 덮어쓰기 전에 사용자의 *AI 이전 판단*을 잡는다. 분석을 병렬 발사하되 **버퍼링**(`page.tsx:319-327`)하므로 lean이 진짜로 "노래(Siren) 이전"이다. 메타포가 기능적으로 정확. (2) 지연 — 중도 이탈에도 살아남는 해자 흡입구: `buildEarlyContract`가 OPEN 시점에 `projects.decision_contract`를 심는다(`page.tsx:398-404`). MOAT 맵 기준 **중도 이탈을 견디는 유일한 해자 경로(Break A)**.
- **가치(정직하게)**: theater 아님 — 진짜 일이 있다. 그러나 **간판 약속이 미실현**. "나중에 그게 진짜 내 판단이었는지 같이 맞춰볼 수 있어요"(`:124-125`)는 확인일 복귀+정산을 요구하는데, 복귀 트리거가 없어(Break B) 사실상 모든 사용자에게 미배달. 오늘 실제 배달되는 건 LISTEN 동안 떠 있는 "내가 기운 쪽" 칩(`ProgressiveFlow.tsx:2418-2429`) 하나뿐.
- **형식**: 대체로 맞음. 단 **가치 제공 전에 퍼널 맨 위에서 무조건 발사**되고(`page.tsx:327`), primary CTA가 작성 전까지 disabled(`:197-202`), skip은 작은 텍스트 링크로 강등(`:207-213`). no-forced-typing 플로어는 지킴(skip 1탭, 0행, 주석 `:23-27`이 의도적 플립 선언). 하지만 답만 원하는 사용자에겐 게이트처럼 읽힘.
- **지속성**: **가장 강함** — 유일한 `authored:'user'` predicate. 충돌 시 user_lean이 항상 이김(`augmentContract`, `decision-contract.ts:388-402`). 단 *다음 항해 생성*으로는 전달 안 됨(Break C).
- **연결**: 앞 — hero submit 버퍼링에 전적으로 의존. 뒤 — lean 칩(median 사용자에게 유일하게 보상되는 연결) + 늦은 SealMoment AUGMENT(거의 아무도 도달 못 함).
- **권고**: (P0) 다운스트림 복귀 트리거를 고치거나, 그때까지 `:124-125` 카피의 과약속을 완화. (P1) `bind_resolved` 텔레메트리(`page.tsx:361`)로 blocking write-default vs 가벼운 inline을 A/B. (P2) customDate tz 버그 수정(`new Date(string).toISOString()`이 음수 오프셋에서 하루 당겨짐, `:85` → `new Date(y,m-1,d)`).

### 4.2 항로 문서 / AnalysisCard → **RESHAPE** — 2절 참조 (P1 diff 제거, P1 해자 전달, P2 출처 음영).

### 4.3 MirrorBeat — "AI가 채운 전제" (`ProgressiveFlow.tsx:768`) → **RESHAPE (P1)**

- **존재 이유**: frame→fork 핵심 명제를 맨 앞으로 가져온 곳. 출처 태그 + 전제 진술 + 중립 크럭스 "정말 맞나요?"(`:794`). 답을 기록 안 함(`:766-767`) — no-chat 불변식 준수. theater 아님, 스파인의 중심 동작.
- **가치(정직하게)**: **얇고 부분적으로 좌초.** 인식이 막다른 길이다. 전제가 틀렸다고 깨달아도 focus 모드(기본)에서 할 수 있는 건 "확인했어요"(`:803`)뿐 — 프레임 교정 경로(FramingConfirmation "다시 정의")는 focus에서 스킵(`:2853-2857`). 의심을 띄우고 좌초시킨다.
- **형식**: 마이크로 폼은 스파인-깨끗하고 우아. 두 문제: (1) "아니요"에 행동할 핸들이 없음(미러 절은 "전제 1개 + 핸들 반환"을 요구). (2) 아래 질문을 dim+blur+lock(`:2547-2548`)하는 건 자기가 non-blocking이라 부르는 인사이트(`:765`)치고 과한 마찰.
- **지속성**: 휘발 — `mirrorSeen`은 컴포넌트 로컬 `useState`(`:1043`), 리로드 시 재출현. 띄운 전제는 스냅샷에 살지만 봉인에 안 닿음(Break C). **사용자가 정밀검토하라고 받은 그 전제가 증발한다.**
- **연결**: 앞 — 스트림 분석. 뒤(런 내 온전) — VoyagePrepSummary가 같은 `hidden_assumptions[0]` 재노출(`:639`), Falsification이 `weakest_assumption`에 ladder 고정. 뒤(끊김) — 봉인은 mix/dm/falsification에서 추출, 미러 전제 아님.
- **권고**: (P1) 저비중 두 번째 액션 "아니요 — 다시 정의"를 기존 reframe 경로에 연결(둘 다 중립, 엔진 가중 없음). (P1) **leverage 랭킹 수정** — 지금 `hidden_assumptions[0]`을 임의 순서로 집고(`:2531`) "load-bearing"이라 주장(`:2518`)하지만 프롬프트는 순서를 지시 안 함(`progressive-prompts.ts:118-129`). 가장 load-bearing 우선 정렬, 또는 Falsification이 쓰는 `weakest_assumption`을 먹여 미러=ladder=봉인 predicate로 통일. (P2) seal에서 미러 전제를 `ai_surfaced` governing predicate로. (P2) blur/lock 제거.

### 4.4 Q&A 심화 루프 (`QuestionCard` + `runDeepening` + convergence) → **RESHAPE (P0 해자 / P1 진행표시)**

- **존재 이유**: 메타-튜닝 코어. 크루/초안에 컴퓨트 쓰기 전에 *프레임*을 2~3턴으로 날카롭게. 선택한 옵션이 스냅샷을 패치(`applySnapshotPatch`)하고 `decision_line`이 라운드 간 sticky(`:1703-1708`). 옛 엔진의 "구조적 효과 없는 일반 후속질문" 실패(`question-types.ts:5-6`)를 고치려 존재. 진짜 일.
- **가치(정직하게)**: 보이는 곳에선 진짜(질문 분모 "2/3", 상시 탈출 "그만 묻고 초안"). 단 **측정된 수렴은 기본값에서 안 보이고 일부는 조작.** ConvergenceStatus/QuestionDiff가 `showRecord` 뒤(`:2810,:2887`) — focus 기본에선 수렴 미터를 영영 못 봄. 숫자 자체도 theater: 한국어 단어겹침(`progressive-convergence.ts:14-23`) + 모델 self-confidence 30%(`:88-89`).
- **형식**: 두 축에서 틀림. 정직한 신호(분모+칩)는 기본-ON이라 좋지만, *측정* 신호는 토글 뒤+거짓 정밀. 게다가 max-round fallback이 `"(명확도: ${score}%)"`를 사용자 카피에 하드코딩(`progressive-engine.ts:697-698`) — **미보정 점수 노출(스파인 위반)**, ConvergenceStatus가 바로 이걸 없애려 재작성됐는데 엔진은 안 됨.
- **지속성**: 출력 전체가 세션 블롭에 축적되지만 해자 기준 가장 휘발(Break C). is_converged는 내부 라우팅 전용(`:680,687`).
- **연결**: 앞 — MirrorBeat(인식)는 루프(심화) 위. 둘이 "전제 명명"을 중복하면 안 됨 — MirrorBeat가 소유. 뒤 — `!curQ` → shouldMix → VoyagePrepSummary; is_converged가 mix 자동진행 결정. 에러 경로 인접 — typed-upgrade swap과 input 보존이 같은 QuestionCard 생명주기.
- **권고**: (P1·스파인) **수렴 숫자 일체 미노출** — is_converged는 내부 유지, `%`/rounds-left/`(명확도: N%)` 삭제. 분모+칩이 정직한 진행을 운반. (P1) QuestionDiff의 탈숫자 "질문이 바뀌었어요"를 `conversing` 기본값으로(토글 밖). (P1) **typed-upgrade 레이스 제거** — 구조적 fork/weakness 질문이 일반 질문보다 5~10초 늦게 도착(`progressive-engine.ts:750-757`)해 빠른 답변자는 효과 없는 질문에 커밋. 분석 스트림에 합치거나 "정교하게 다듬는 중"으로 잠깐 보류. (P0) **converged real_question + 잔존 hidden_assumptions를 predicate 후보로 + 다음 항해 참고-주입**(5절 Ledger). (P2) clarity 계산에서 self-confidence 제거.

### 4.5 팀/크루 — 워커 배치+리포트 → **RESHAPE→CUT (P0 계측 후 P1 축소)**

- **존재 이유**: 스냅샷 `execution_plan.steps`를 전문 분석으로 분해해 초안을 풍부하게. 듣기/Listen의 화신 — 귀먹은 노잡이가 노 젓고 묶인 선장이 듣는다. 엔진은 진짜 일(병렬, 모델 라우팅, 품질 게이트). **그러나 화면에 있는 깊은 이유는 "팀이 검토했다"는 *연출된 정당성*** — 제품 명제가 "팔지 말라"고 한 바로 그 멀티-에이전트 본능.
- **가치(정직하게)**: 기본 경로에선 **얇음~theater.** focus 기본에서 크루가 자동 배치+자동 승인(`:1337-1359`)되어 **사용자는 아무것도 안 한다** — 스트림 꼬리 몇 초 구경. 정교한 리뷰 장치(stepper/dot/재배정/평점/HitReactionBar)는 "열어보기" 토글 뒤(`CrewAtWork.tsx:72-79`)라 퍼널상 거의 아무도 안 엶. 봉인 직전에 3 병렬 sonnet + lead + navigator + debate(`:1819-1899`)의 대기·토큰을 47/0 퍼널에서 태운다.
- **형식**: 기본 경로는 theater임을 정직히 인정(주석 "founder: 진행 막대 수준"). 진짜 문제는 **이중 유지보수** — 99% 기본용 자동승인 연출 + ~0명용 P0급 숨은 리뷰 표면을 둘 다 짊어진다.
- **지속성**: 세션 블롭에만(triple-laundered: 워커→runMix→key_assumptions→predicate). 평점은 에이전트 XP/레벨링 로컬 스토어로 — 사용자 비가시, seal/settle과 무관. **다음 항해 생성으로 전달 0.**
- **연결**: 앞 — shouldMix 게이트, 스냅샷 소비. 뒤 — runMix→DM→Falsification→Seal. 크루 비용 전체가 거의 아무도 안 오는 유일한 해자-충전 순간 직전에 지불됨.
- **권고**: (P0·계측 우선) "열어보기" 오픈율 + 크루→mix 기여를 **먼저 측정**(CLAUDE.md: "UI 멀쩡 ≠ 데이터 도착"). (P1) 기본 크루를 정직한 한 줄+라이브 꼬리로 축소하고, 숨은 grading stepper를 TrialSail처럼 **플래그-오프**. (P1) **stakes/reversibility 크기 다이얼** — sealGate가 이미 읽는 값으로 가역/저위험은 1~2명으로 제한, lead+debate+navigator 스킵(미러 절 과잉발사 + runMix payload 축소 동시 해결). (P2) 남긴다면 KEPT 워커당 출처-태그 핵심발견 1개를 bearing/contract에 적립.

### 4.6 초안/Mix → 최종 (VoyagePrep → runMix/MixPreview → Falsification → runFinal/FinalCard) → **KEEP (구조), RESHAPE (해자 누수)**

- **존재 이유**: 사용자가 진짜 원해서 온 것을 배달 — "생각을 문서 언어로 번역". 가장 검증된 JTBD.
- **가치(정직하게)**: 진짜이고 즉시적. 봉인 못 하는 47명에게 **구체적 가치를 주는 유일한 파트.** collapse-by-default는 좋은 절제(MixPreview body 닫힘 `:23-26`, FinalCard가 bearing과 중복이라 접음 — 스스로 "앱 최악의 중복"이라 인정 `FinalCard.tsx:38-41`). 긴장: **가장 강한 독립 가치 + 가장 약한 해자 기여.**
- **형식**: 보기보다 괜찮음. dual-render지만 둘 다 접히고, DM 수정이 없으면 runFinal이 2번째 LLM 호출을 **건너뜀**(`engine:1162-1167`) — 흔한 focus 경로는 1회 생성. 개념적 문제: 같은 결정이 3개 표현(course doc/긴 문서/bearing)으로, 긴 문서만이 압축도·전달도 안 함.
- **지속성**: 블롭에 동기화. 전달은 손실적 — `extractPredicatesFromSession`이 `final_mix ?? mix → key_assumptions`만(`ai_surfaced` 태그 정직, `:253`). `executive_summary`/`sections`/**`next_steps[]`는 아무것도 안 먹임.**
- **연결**: 앞 — VoyagePrepSummary 동의 게이트. 뒤 — exec_summary→bearing seed, key_assumptions→봉인 predicate. prose body/next_steps는 여기서 멈춤.
- **권고**: (P1·해자) **`next_steps[]`를 seal에서 후보 predicate로** — 가장 구체적·날짜형이라 가장 자연스러운 정산 대상인데 봉인 직전에 버려짐(`ai_surfaced` 태그). (P1·스파인) runMix/runFinal에 `stop_reason` 노출 + 잘리면 `incomplete` 태그(완성처럼 내밀지 말 것). (P2·스파인) 사용자 노트를 별도 출처 블록으로 — 지금 "초안에 반드시 반영하세요"(`runMix:835-837`)로 AI 산문에 경계 없이 섞여 사용자/기계 텍스트 구분 불가. (P2) dual-render를 **제거하지 말 것** — 측정 후 정직한 프레이밍을 데이터에 맞춰라(투기적 절단 금지).

### 4.7 이해관계자/DM 피드백 (리허설) → **RESHAPE (P1 출처/과잉발사)**

- **존재 이유**: 완성 초안을 진짜 사람에게 내기 전에 *하나의 책임 좌석*에 외재화. 핵심 동작은 프롬프트 — 모든 우려를 좌석의 *목적함수*(계약/사람/매출/컴플라이언스)에 고정, 일반 우려를 큰 목소리로 재진술 금지(`review-prompt.ts:182`). 진짜 anti-theater 가드. boss 경로는 프로필 인물 시뮬(`runBossDMFeedback:1070`).
- **가치(정직하게)**: 이중. boss 경로는 진짜이며 복리(`observation-engine.ts:313`). 일반 "의사결정권자" fallback은 얇음(자가검토와 겹침). focus 기본에서 **opt-in**(primary는 flinch ladder, 리뷰는 secondary `:2959-2960`)이고 늦게 와서 거의 아무도 도달 못 함. first_reaction/good_parts는 안심 theater로 아무것도 안 먹임.
- **형식**: 가치 대비 과잉 빌드. apply/skip 토글은 진짜 가역 행위지만, **무한 펄스 골드글로우 CTA**(`DMFeedback.tsx:143-144`)는 "engagement 밀지 말라"는 절제 절을 스침.
- **지속성**: concern.text+severity만 risk predicate로 전달. approval_condition/would_ask는 증발. boss 경로만 observation 복리.
- **연결**: 앞 — MixPreview 분기. 뒤 — onFinalize=onTest로 flinch 통과; concern이 risk predicate로 계속.
- **권고**: (P1·스파인) DM concern risk predicate에 `authored:'ai_surfaced'` 태그(`decision-contract.ts:264-266`) — 지금 무태그라 기계 시뮬 위험이 사용자 저작인 양 해자에 들어가 calibration 오염. (P1·스파인) **"더 볼 거 없음" 게이트** — 스키마가 항상 "우려 1-2개"(`:153`) 강제, `concerns:[]` 허용 + "이 자리에서 더 볼 건 없어요" 빈 상태. (P2·해자) approval_condition을 SealMoment에 opt-in predicate로, boss 경로의 would_ask를 같은 reviewer로 다음 항해 framing에. (P2) 펄스 글로우 제거 + good_parts 한 줄로.

### 4.8 Falsification / Seal / Decision Contract → **KEEP (폼·스파인) + RESHAPE (배치·전달, P0)**

- **존재 이유**: Falsification은 *유도 엔진* — 성공-주장 ladder를 부풀려 사용자가 안 믿기 시작하는 줄을 탭(flinch)→load-bearing 전제 격리→자기 말로 재진술(`real_bet`). "검증=단발 약속, 채팅 아님" 불변식의 구현. SealMoment는 *해자 흡입 밸브* — `projects.decision_contract`를 쓰는 유일한 신뢰 경로.
- **가치(정직하게)**: Falsification은 진짜 인지 가치(flinch 메커닉이 우수)지만 ~8분 지점 + 필수 + 부담. SealMoment 가치는 **거의 전부 지연·미실현** — 0 sealed/settled, 복귀 트리거 없음("제가 알림을 보내진 않아요" `SealMoment.tsx:409`). 오늘 실가치는 다운로드된 `.ics` 정도.
- **형식**: 유도 폼은 좋음. 배치·순서가 가치를 죽임 — 둘 다 긴 완성 문서 *아래*에 종착(testing `:2992`, seal `:3129`), 퍼널 최악 지점에, **두 개의 분리된 커밋 비트**("이대로 정하고 마무리" `Falsification:228` → "네 물어봐 주세요" `SealMoment:455`)가 FinalCard를 사이에 두고 책꽂이처럼.
- **지속성**: falsification→predicate는 전달됨. seal→`projects.decision_contract`는 **동기화·영속이지만 write-only**(Break C). `summarizeGrades`가 정밀한 calibration을 만들고 trophy-counter로 죽음.
- **연결**: 앞 — MixPreview/DM→onTest. 뒤(데이터, 올바름) — flinch가 seal predicate 소스. 뒤(서사, 희석) — bet 커밋→문서 읽기→다시 체크 약속. 앞으로(끊김) — settled가 다음 항해 생성으로 안 돌아감.
- **스파인**: **이 파트가 스파인을 제대로 한 모범** — flinch 크럭스가 중립 질문(`:202`), 이전 verdict/fork-stakes가 launder 불가 lean으로 제거됨(주석 `:192-200`, rounds 5-8 판정), believe-all이 `claims[0]`(최소 방어 신념) 선택(`:72`), skip이 `real_bet_authored:'ai_surfaced'` 태그(`:242`). SealMoment도 user_lean `authored:'user'`, null 렌더, 절제 게이트.
- **권고**: (P0·해자) **settled를 다음 항해로 참고-전달**(5절). (P0) **BIND 초기 rope를 1차 영속 적립으로** — buildEarlyContract를 OPEN에서 주력으로, 늦은 seal은 augment-only(Break A: 거의 아무도 안 오는 끝이 아니라 이탈 *이전*에 적립). (P0) **복귀 트리거**(checkin-due cron 존재, opt-in 이메일 유지, /project 복귀 표면) — settle은 가장 안 남는 행동이자 결속 제약. (P1) flinch-commit과 seal-ask를 **하나의 종막으로 융합** 또는 최소한 Falsification을 SealMoment와 같은 stakes/reversibility로 게이트(가역/일상은 full ladder 스킵). (P2) ladder가 예측이 아니라 가설임을 명확히(novice 절반이 AI 예보로 오독, 주석 `:116-118`).

### 4.9 Settlement / Current Bearing / Patterns (닿기+피드포워드) → **RESHAPE (P0 해자 / P1 patterns·배치)**

- **존재 이유**: 제품 명제가 현금화되는 곳. CurrentBearing=사용자가 실제로 간직하는 1화면 오리엔테이션("Surface Principle"). SettlementModal=복귀 절반("그래서 어떻게 됐어요?") — GTM 감사가 *네이티브 LLM 메모리에도 살아남는 유일한 해자*로 지목. patterns=n개 닫힌 고리를 정직한 빈도 진술로.
- **가치(정직하게)**: CurrentBearing은 런 내 진짜 가치(깔끔·캡·복사 가능). SettlementModal은 **잘 만들어졌고 스파인-깨끗**(과거 예측을 체크하지 너를 체크하지 않음 `:213`, 운-승리/실력-승리 분리 `:260-294`, R17). 그러나 0 settled라 `summarizeRecord`가 loops:0 → 마무리 보상·기록 줄·/project 자차표가 사실상 안 그려짐. **patterns는 webapp 사용자에게 죽었다** — `SKILL.md:24`가 webapp이 안 쓰는 `.argus/journal.md`를 읽어 항상 "데이터 부족" 분기.
- **형식**: CurrentBearing 카드 폼은 맞지만 **배치가 자기가 인용한 원칙과 모순** — FinalCard *아래*에 앉음(`CurrentBearingCard.tsx:7-9`). 압축 bearing이 그것이 대체할 긴 리포트 밑에 출하됨. patterns 형식은 webapp에 근본적으로 틀림(CLI 시대 필드 파싱).
- **지속성**: CurrentBearing=휘발/derived(`:8`). settled record=동기화·영속(`projects.decision_contract`)이지만 **전달=NO**(context-builder에 decision_contract 참조 0, ProgressiveFlow에 context-builder 참조 0). 세 trophy-counter만 읽음.
- **연결**: 앞 — SealMoment 생산(+알림 불가 Break B). 뒤 — /project strip + DecisionContractCard. 빠진 가장 중요한 엣지 — settled→다음 항해 first analysis(없음).
- **스파인**: SettlementModal은 모범. 두 플래그: (P2) CurrentBearing status 칩("진행/근거 먼저")이 무태그 기계-판정(`current-bearing.ts:191`, blocked는 항상 false라 fork/lean은 아님) → `ai_surfaced` 태그 권장. (P2) patterns의 "thinking profile" 산문(`SKILL.md:100-101`)·"넌 늘 X를 놓친다"는 빈도 너머 *네가 누구인가* 특성화 → webapp 배선 전에 빈도-only로 강등/삭제.
- **권고**: (P0·해자) **settled-record 리더를 ProgressiveFlow first analysis에 배선** — summarizeRecord 출력을 참고-빈도 진술로 주입, patterns 샘플크기 티어(`SKILL.md:166-180`) 준수, 절대 verdict/lean 아님. (P1) patterns를 현실과 화해 — webapp pattern view를 decision_contract 위에 짓거나, 정직하게 plugin-only로 범위 축소("항상 데이터 부족" 표면을 남기지 말 것). (P1) **CurrentBearingCard를 FinalCard 위로** 올리거나 긴 리포트를 bearing 밑에 접어라.

---

## 5. 전체 연결 — 이상적 정보 구조

### 핵심 발견 한 문장

항해에는 **콘텐츠가 하나**("진짜 질문 + load-bearing 전제")인데, 사용자가 전진할 때마다 **8개의 다른 chrome으로 재렌더**되고, **그 콘텐츠를 담은 실제 추론 산출물(`AnalysisSnapshot[]`)은 봉인·복귀·전달되지 않는다.** 표면 반복 + 알맹이 증발 = "흐름을 모르겠다" + "0 sealed/settled" 둘 다의 뿌리.

### 합쳐야 할 중복

`snapshot.real_question`(가장 중요한 한 줄)이 **최소 8곳**에서 *새* 초점 요소로 — 각자 다른 카드·eyebrow·메타포로:

| # | 표면 | 같은 줄에 붙이는 라벨 | file:line |
|---|---|---|---|
| 1 | 분석 스트림 헤드라인 | (스트리밍) | `ProgressiveFlow.tsx:391` |
| 2 | AnalysisCard | the real question | `AnalysisCard.tsx:74,143` |
| 3 | UpdateSummaryChip | prev vs new | `UpdateSummaryChip.tsx:86,100` |
| 4 | QuestionDiff | before/after | `ProgressiveFlow.tsx:2813` |
| 5 | VoyagePrepSummary | "정한 방향" | `ProgressiveFlow.tsx:688-691` |
| 6 | MixPreview/FinalCard | executive_summary | `MixPreview/FinalCard` |
| 7 | CurrentBearingCard | current_course.summary | `current-bearing.ts:178-215` |
| 8 | SealMoment | governing_idea predicate | `decision-contract.ts:223-281` |

이건 "일관된 강화"가 아니다. **각각이 다른 소스(snapshot/mix/final_mix/predicate/bearing)에서 줄을 재유도**하므로 **서로 어긋날 수 있고 실제로 어긋난다**(snapshot의 real_question은 contract 경로에서 통째로 빠지고, bearing은 snapshot을 안 읽음). 사용자는 "진짜 질문"을 다섯 번, 다섯 가지로 살짝 다르게 보면서 어느 게 정본인지 모른다. **정본 없는 중복은 진행이 아니라 헛바퀴로 읽힌다.** 최악은 VoyagePrepSummary→MixPreview→FinalCard 트리플(같은 결정을 세 단계에 걸쳐 전 화면 재진술).

`hidden_assumptions[0]`도 같다: MirrorBeat "AI가 채운 전제" → VoyagePrep "전제 조건" → AnalysisCard 목록 → Falsification `surfaced_constraint` → bearing `fog_or_reef` → SealMoment `risk` predicate.

### 앞으로 배선해야 할 막다른 길

- **course doc**: 가장 풍부 + 가장 휘발, 구조적 소비자 없음, 80자 헤드라인만 생존.
- **CurrentBearing**: derived-never-stored, 영속 신원 없음(링크·버전·diff 불가).
- **MirrorBeat**: 아무것도 포착 안 함 — 최고-의미 비트가 흔적 없음, 같은 전제가 Falsification에서 차갑게 재등장.
- **settled grades (가장 깊은 막다른 길, Break C)**: `summarizeGrades`가 깨끗한 calibration 만들고 counts strip만 읽음. ProgressiveFlow는 context-builder를 import조차 안 하고, context-builder는 decision_contract 참조 0.
- **patterns**: webapp이 안 쓰는 파일을 읽음(Break D).

데이터 흐름: **런 내 풍부하게 축적 → seal에서 얇은 predicate로 붕괴 → write-only → 리로드 시 표면 재유도 → 생성으로 재진입 없음.** 복리여야 할 모든 화살표가 종착점.

### 첫 방문자가 부딪는 서사 단절

1. **상태기계 2개, 보이지 않는 인계** — `page.tsx`(idle→…→ready)와 ProgressiveFlow(analyzing→…→complete) 사이 `setPhase('ready')`(`page.tsx:411`)가 전체 UI를 교체. 유일한 연속 골격 VoyagePhaseRail이 ProgressiveFlow 안에만 살아(`:2320`) BIND의 가장 중요한 순간(rope, 크루 등장)에 깜빡인다.
2. **BIND 보상 없음** — lean 칩은 user_lean predicate가 있어야 뜨고 buildEarlyContract는 기본 null. "아직 모르겠어요"를 누른 다수에겐 rope 의식이 LISTEN으로 이어지는 실을 안 남김 → 과속방지턱.
3. **전진이 제자리로 보임** — §중복 때문에 MirrorBeat→VoyagePrep→MixPreview→Final→Bearing 각각이 "진짜 질문+전제" 재제시. 정제 vs 막힘 구별 불가. 기본-ON 누적 카운터 없음.
4. **봉인이 완성 문서 아래 도착** — SealMoment가 complete에서 FinalCard+Bearing *아래*(`:3087,3110,3129`). 해자-충전 행동에 닿을 땐 이미 "가져가실 것"을 받음 → 봉인이 선택적 에필로그로 읽힘. 퍼널이 정확히 여기서 죽는다(47→0).
5. **조용한 truncation이 보이지 않게 서사를 깸**(3절).

### 단 하나의 최고-레버리지 구조 변경 — "Bearing Ledger"

**course doc을 일시적 단계별 렌더에서 → 하나의 영속·누적·복귀 가능한 산출물("Bearing Ledger")로 승격하고, 모든 단계 UI를 그 한 객체의 *임시 편집기*로 만든다 (내용 재진술이 아니라).**

이게 가독성(§중복·§단절)과 해자(§막다른 길)를 동시에 고친다 — 중복과 증발은 같은 결함이니까(정본 객체가 없어서 곳곳에서 재유도=중복, 붙일 데가 없어서 영속·전달 불가=증발).

구체적으로:

- **bearing을 영속화** — 세션 블롭에 넣어(schema-drift 노출 없음, 싸다) 리로드 후 신원 보존. 이미 올바른 모양(`current_course.summary`, `why_this_course[]`, `fog_or_reef`, `road_not_taken[]`, `next_helm`, `contract_seed`, `current-bearing.ts:68-83`). 바꿀 건: 매 표면에서 재유도하지 말고 **한 번 계산·영속·각 단계가 in-place 변형**(이미 있는 `updateLatestSnapshot` 패턴 `:659-664`을 bearing으로 들어올림).
- **`real_question`을 한 곳에서** — bearing의 `current_course.summary`가 정본. VoyagePrepSummary/MixPreview/FinalCard 헤더/bearing 카드/seal predicate가 *같은 필드를 읽음*. 8개 재진술이 **사용자가 날카로워지는 걸 지켜보는 한 줄**로 붕괴 — 중복이 진짜 같은 객체일 때만 강화가 된다.
- **각 단계 UI = ledger에 대한 diff** — MirrorBeat가 띄운 전제를 `fog_or_reef`에 *씀*(ai_surfaced), Q&A가 `current_course.summary`를 *갱신*, 크루가 `why_this_course[]`를 *추가*, falsification이 `contract_seed`를 *채움*. UpdateSummaryChip이 **전진의 기본 척추**가 됨(토글 뒤 추가가 아니라).
- **ledger를 봉인** — 지금 `extractPredicatesFromSession`이 스냅샷을 버리는 대신, 영속 bearing의 `contract_seed`(이미 falsifiable 후보 타입 `:77`)를 SealMoment가 봉인. **화면의 것 = 봉인되는 것** — "사용자가 항로로 읽은 표면 ≠ 봉인되는 것" 갭이 닫힌다.
- **settled ledger를 되먹임(Break C — 해자)** — 다음 항해 first analysis에 과거 settled bearing을 **참고-빈도 진술로만** 주입("참고: 과거 N건 중 high-confidence였던 베팅이 어긋난 비율 …"), 샘플크기 스케일, 절대 verdict/lean 아님. context-builder에 decision_contract 리더 하나 배선 + `runInitialAnalysis`에서 호출. 이 한 가닥이 contract 컬럼을 trophy에서 calibration 루프로 바꾼다.

### 왜 최고 레버리지인가 + 퍼널 현실

- **사용자에게 하나의 멘탈 모델**: "살아있는 bearing이 있다 → 항해가 날카롭게 한다 → 봉인한다 → 현실이 채점한다 → 다음엔 기억한다." 8개 카드 + 2개 상태기계를 하나의 연속 객체로.
- **이탈도 가치를 적립**: 라운드 1부터 누적되는 영속 bearing이면 Q&A에서 그만둔 사람도 (부분) bearing + contract_seed를 남김(Break A). 해자 흡입구가 파이프라인 완주에 묶이지 않음 — **47/0의 핵심 치료.**
- **스파인 정렬**: bearing은 불확실성을 퍼뜨리지 않고 명명(`:18`), `fog_or_reef`는 중립 질문, 출처 태그 보존, 되먹임은 참고-빈도(verdict 아님). seal은 단발 약속 유지, 검증을 채팅으로 만들지 않음.
- 큰 리팩터(섹션 분할·구조화 출력) 불필요 — 이건 IA/데이터-수명 변경: 한 객체 영속화 + 모든 읽기를 그 객체로 + 되먹임 엣지 하나.

**가장 작은 첫 칼**: bearing을 세션 블롭에 영속화 + VoyagePrep/MixPreview/FinalCard/SealMoment가 "진짜 질문"을 `bearing.current_course.summary` 단일 소스로 읽기 + `bearing.contract_seed`를 봉인. 이것만으로 §중복 붕괴 + course doc에 영속 신원 + 봉인=읽기 일치 — 교차-항해 되먹임을 건드리기 전에.

---

## 6. 우선순위 실행 계획

> 순서: P0 = 활성화 잠금해제 + 토큰 막다른 길 제거 + 항로문서 혼란 해소. 증분 출하 가능하게 배열. **빼는 것 우선.**

### P0 — 지금 (활성화 절벽 + 토큰 데드엔드 + 정본 혼란)

| # | 변경 | 왜 | Effort | 파일 |
|---|---|---|---|---|
| P0-1 | `MAX_TOKENS_CAP` 4096 → 64K | 적응형 예산·재시도를 잠금해제하는 단 한 줄. 이게 없으면 모든 토큰 복구가 무효 | S | `llm-validation.ts:8,33` |
| P0-2 | `message_delta.stop_reason` 전달·포착·노출 | 잘림을 *아는* 키스톤. 없으면 모든 복구가 장님 | S | `route.ts:171-178,214`; `llm.ts:830-849,890,918` |
| P0-3 | 스트림 경로 자동 재시도 + 타이핑 답 보존 + Retry 버튼(닫기-전용 배너 교체) | 47/0 절벽의 막다른 길+답 분실 직격. 죽은 재시도 부활 | M | `llm.ts:908-932`; `ProgressiveFlow.tsx:1751-1765,2365-2388`; `QuestionCard.tsx:33` |
| P0-4 | **Bearing을 세션 블롭에 영속화 + "진짜 질문"을 `bearing.current_course.summary` 단일 소스로 + `bearing.contract_seed` 봉인** | §중복 붕괴 + course doc 영속 신원 + 봉인=읽기 일치. 가독성+해자 동시 | M | `current-bearing.ts:68-93,178-215`; `useProgressiveStore.ts:659-664`; `ProgressiveFlow.tsx:691,1002-1011,2779,2956,3087,3110,3129`; `SealMoment.tsx:160-199` |
| P0-5 | **settled-record 리더를 context-builder에 + ProgressiveFlow first analysis에 참고-빈도 주입** | Break C — 해자 루프 봉합. 네이티브 LLM 메모리에도 살아남는 유일한 해자 | M | `context-builder.ts:23-60`; `decision-contract.ts:553-630`; `progressive-engine.ts:runInitialAnalysis` |
| P0-6 | **복귀 트리거 가동**(checkin-due cron + opt-in 이메일 + /project 복귀 표면) + 미도달 시 BIND 카피 과약속 완화 | Break B — 0 settled의 원인은 outbound 채널 부재. settle은 결속 제약 | L | `SealMoment.tsx:409,417`; `api/cron/checkin-due/route.ts`; `BindCard.tsx:124-125` |
| P0-7 | 프롬프트 배열 캡(runMix 섹션/문장, runDeepening steps, skeleton) | ~0 비용 즉시 truncation 빈도 ↓. 스키마가 못 하니 프롬프트로 | S | `progressive-engine.ts` build*Prompt |
| P0-8 | 크루 "열어보기" 오픈율 + 크루→mix 기여 계측 | "UI 멀쩡 ≠ 데이터 도착". 큰 절단 전에 숫자부터 | S | `CrewAtWork.tsx`; signal-recorder |

### P1 — 다음 (절제 정렬 + 스파인 출처 + 진행 가시성)

| # | 변경 | 왜 | Effort | 파일 |
|---|---|---|---|---|
| P1-1 | 수렴 숫자 일체 미노출(`%`/rounds-left/`(명확도: N%)` 삭제, is_converged 내부 유지) | 미보정 점수 노출 = 스파인 위반. 거짓 정밀 제거 | S | `progressive-engine.ts:697-698`; convergence UI gate |
| P1-2 | AnalysisCard 안 diff 기계 제거, UpdateSummaryChip이 "뭐가 바뀌었나" 단독 소유 + QuestionDiff 기본-ON | 접힌 라운드에서만 작동하는 낭비 제거. 전진의 펄프 가시화 | S | `AnalysisCard.tsx`; `ProgressiveFlow.tsx:2810,2887` |
| P1-3 | 크루를 정직한 한 줄+라이브 꼬리로 축소, 숨은 grading stepper 플래그-오프(계측이 정당화하면만) | "멀티-에이전트 팔지 말라" + ~0명용 P0급 표면 유지비 제거 | M | `ProgressiveFlow.tsx:2653-2732`; `CrewAtWork.tsx:72-79` |
| P1-4 | stakes/reversibility 크루 크기 다이얼(가역/저위험 1~2명, lead+debate+navigator 스킵) | 미러 절 과잉발사 + runMix payload 축소 | M | `ProgressiveFlow.tsx:994-998,1318` |
| P1-5 | DM concern risk predicate에 `ai_surfaced` 태그 + "더 볼 거 없음" 게이트(`concerns:[]` 허용) | 정직한-출처 구멍 + 과잉발사(우려 강제) | S/M | `decision-contract.ts:264-266`; `review-prompt.ts:153` |
| P1-6 | `next_steps[]`를 seal 후보 predicate로(ai_surfaced) | 가장 정산 가능한 콘텐츠가 봉인 직전 증발 | M | `decision-contract.ts:223-281` |
| P1-7 | runMix/runFinal `stop_reason` 노출 + 잘리면 `incomplete` 태그 | 잘린 문서를 완성처럼 = 정직한-출처 위반 | M | `route.ts`; `progressive-engine.ts:846,1178` |
| P1-8 | 구조화 출력(`output_config.format`) 서버 적용 | fence/prose/wrong-type/missing-field 실패류 제거(text-delta 그대로) | M | `route.ts:159-164,207` |
| P1-9 | MirrorBeat: "아니요—다시 정의" 저비중 액션 + leverage 랭킹(또는 weakest_assumption 통일) | 핸들 반환(미러 절) + which-gate 과잉발사 수정 | S/M | `ProgressiveFlow.tsx:768,2531`; `progressive-prompts.ts:118-129` |
| P1-10 | CurrentBearingCard를 FinalCard 위로(또는 리포트 접기) + patterns를 webapp 현실과 화해 | Surface Principle 준수 + "항상 데이터 부족" 죽은 표면 제거 | S/M | `CurrentBearingCard.tsx:7-9`; `patterns/SKILL.md:24` |
| P1-11 | 적응형 예산 + 1.5배 재시도(P0-1/P0-2 후) | 캡 인상이 비로소 의미를 갖는 복구층 | M | `llm.ts:908-932` |
| P1-12 | `bind_resolved` 텔레메트리로 blocking vs inline A/B | write-default는 창업자 베팅, 데이터로 검증 | M | `BindCard.tsx`; `page.tsx:361` |

### P2 — 그 다음 (출처 하드닝 + 정리 + 작은 정직)

| # | 변경 | 왜 | Effort | 파일 |
|---|---|---|---|---|
| P2-1 | AnalysisCard AI 저작 음영/eyebrow를 답 후에만 "우리가 잡은 항로" | 정직한-출처(공동저작 과대주장), 게이트 추가 금지 | S | `AnalysisCard.tsx:71,111` |
| P2-2 | 사용자 노트를 별도 출처 블록으로(AI 산문 혼입 방지) | 사용자/기계 텍스트 경계 복원 | S | `progressive-engine.ts:835-837` |
| P2-3 | DM 펄스 글로우 제거 + good_parts 한 줄 | "engagement 밀지 말라" 절제 절 | S | `DMFeedback.tsx:143-144` |
| P2-4 | flinch-commit + seal-ask 융합(또는 Falsification stakes 게이트) | 활성화 절벽의 중복 의식 제거(미러 절) | M | `ProgressiveFlow.tsx:2992,3129` |
| P2-5 | bearing status 칩 `ai_surfaced` 태그 + 영속 카피 정정 | 무태그 기계-판정 + 과대 영속 약속 | S | `current-bearing.ts:191`; `CurrentBearingCard.tsx:108` |
| P2-6 | patterns "thinking profile"/"넌 늘 X 놓친다"를 빈도-only로 강등 | who-you-are verdict가 webapp으로 새지 않게 | S | `patterns/SKILL.md:100-101,166-180` |
| P2-7 | ladder "가설이지 예보 아님" 어포던스 + 이해도 측정 | novice 절반 오독(주석 `:116-118`) | S | `Falsification.tsx:116-118` |
| P2-8 | customDate를 로컬 자정으로 파싱 | 음수 오프셋 tz에서 하루 당겨짐 | S | `BindCard.tsx:85` |
| P2-9 | 섹션 분할 생성(데이터가 잔여 truncation 보이면, 3개만) | repair가 못 살리는 단일 거대 문자열 | L | `progressive-engine.ts:846,1178,1447` |

### 추가할 테스트 (P0/P1과 함께)

- SSE `stop_reason` 전파(현재 0 커버리지, 최고 레버리지): truncated 스트림 mock → degrade 케이스 resolve, loss 케이스 reject→retry.
- `repairTruncatedJSON`: 첫 필드 문자열 잘림(현 null 회귀-핀), 콤마 후 부분, 중첩 `}]}`, 미닫힘 fence, surrogate split.
- 재시도: 1차 truncated/2차 complete → 정확히 1회 재시도; `end_turn`엔 재시도 없음.
- 입력 보존: 단답형 타이핑 후 에러 경로 강제 → draft 생존.
- `MAX_TOKENS_CAP` 가드: 64K 요청이 4096으로 안 깎임(§0 회귀 핀).

---

## 7. 스파인 점검

제안 전체를 zero-judgment / 정직한-출처 / 절제(under-fire) / 단발-약속에 비춰 확인.

**zero-judgment (verdict·엔진가중 fork·disclaimed lean 금지)**
- Bearing Ledger의 되먹임은 **참고-빈도 진술로만**("과거 N건 중 어긋난 비율"), 샘플크기 스케일, 절대 lean/verdict 아님 — 준수.
- 수렴 숫자 **삭제**(노출이 아니라 제거)는 미보정 점수를 사용자에게 verdict로 내미는 위반을 *없앤다* — 강화.
- bearing status 칩은 단일-축 readiness(blocked 항상 false)지 양극 fork 아님 + `ai_surfaced` 태그 권고 — 준수.
- DM "더 볼 거 없음" 게이트, 크루 stakes 다이얼은 **과잉발사를 줄이는** 절제 방향 — 미러 절 정렬.
- MirrorBeat "아니요—다시 정의"는 중립 두 옵션(인식 vs 재정의), 엔진 가중 없음 — 준수.

**정직한-출처 (기계 텍스트 태그, 사용자 필드 무단상속 금지, 마찰 탈출 유지)**
- `next_steps`·DM concern·미러 전제를 predicate화할 때 전부 `ai_surfaced` 태그 — 준수. BIND user_lean은 `authored:'user'` 유지, 충돌 시 항상 승리.
- `incomplete` 태그 + Retry는 "잘린 문서를 완성처럼"을 고침 — 강화.
- 사용자 노트 별도 블록, AnalysisCard 저작 음영은 공동저작 과대주장 수선 — 강화. 모두 **음영/태그로 고치지 게이트 추가 안 함**(skip/use-as-is 탈출 보존).

**단발-약속 (검증=채팅 아님)**
- Falsification/Seal의 단발 커밋 성격 유지. 융합(P2-4)은 두 비트를 하나의 *모션*으로 합칠 뿐 채팅으로 만들지 않음 — 준수.

**호출할 긴장 3가지 (정직하게)**
1. **BIND 무조건 발사 (구조적 한계)**: stakes/reversibility가 아직 버퍼라 가역/일상 결정에 절제 게이트를 *적용 불가*. 가볍고 skip 가능이라 full ceremony는 아니므로 위반은 아니지만, under-fire 기본이 **구조적으로 강제 불가능한 유일한 곳**. P1-12 A/B로 데이터 기반 판단 권고.
2. **Bearing 되먹임의 잔여 lean (불가피)**: `value ∝ leverage ∝ tilt` — 가장 load-bearing 전제는 본질적으로 flip을 가장 가리킨다. 빈도-only로 음영해도 0이 되진 않음. CLAUDE.md대로 **제품 수준에서 "faint lean을 알려진 한계로 명시"**, "우리는 판단 안 한다"고 쓰지 말 것 — 본 문서의 모든 되먹임 카피에 이 원칙 적용.
3. **크루 절단의 서사 비용**: "팀이 검토했다"는 정당성 연출을 줄이면 일부 사용자에겐 신뢰감이 준다. 그래서 **계측(P0-8) 먼저, 절단 나중** — 투기적 절단 금지(절제는 사용자 개입 여부 판단에도 적용).

**결론**: 제안된 변경 중 zero-judgment / 정직한-출처 / 절제 / 단발-약속을 **위반하는 것은 없다.** 다수는 스파인을 *강화*한다(점수 삭제, incomplete 태그, ai_surfaced 일관화, 과잉발사 게이트). 긴장 3개는 모두 "알려진 한계로 명시 + 데이터로 결정"으로 관리되며, 어느 것도 룰 위반이 아니라 **점근선(asymptote)을 제품 수준에서 정직하게 공개**하는 문제다.
