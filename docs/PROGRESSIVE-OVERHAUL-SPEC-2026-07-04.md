# Progressive 대공사 — 실행 스펙 (2026-07-04)

> 코드를 직접 정독해 만든 **실행 가능한 스펙**. 각 항목에 정확한 file:line · 변경 · 검증법.
> 라이브 환경(LLM·auth)이 있는 세션에서 실행 + 흐름으로 검증할 것. 어제 착수분(Q1/Q2)은 이미 커밋됨.

---

## A. 0/5 stall — 깊은 뿌리 (pending 워커가 실행 안 됨)

**이미 이해·부분수정된 것 (커밋 완료):** 크루가 전부 `waiting_input`(AI 없는 판단-크루)이면 `runAllAIWorkers`가
`aiWorkers.length===0`에서 즉시 return(`worker-engine.ts:233`) → 헤더가 "일하고 있어요" 영구 표시.
→ `CrewAtWork.allDone`를 `crewSettled`와 정렬해 수정 완료(`575a6a7`). 흐름 게이트(`crewSettled`)는 이미 통과.

**남은 진짜 버그 (라이브 재현 필요):** 사용자가 본 "중단된 작업(pending) · 다시 실행"은 **AI 워커가 `pending`인데
`onStart`가 안 불린** 경로. deployWorkers는 AI를 `pending`으로 두고(`useProgressiveStore.ts:1229`),
`onDeployWorkers`가 `startWorkerExecution(ws)` 호출(`ProgressiveFlow.tsx:1589`), autoDeploy는 focus+`ready`일 때만
발화(`:1425-1432`). 의심 경로:
1. **리로드 자가치유 부재:** 리로드 시 `migrateWorkers`가 running→pending 리셋하지만(`:430`) autoDeploy는
   `deployPhase==='deployed'`면 재발화 안 함 → pending인데 아무도 안 돌림. "다시 실행" 수동 클릭만이 복구.
2. **실행 레이스:** `startWorkerExecution`이 `workerAbortRef.current?.abort()` 먼저 호출(`:1490`) — 짧은 시간에
   두 번 불리면(effect 중복/StrictMode) 첫 실행이 abort돼 onStart 전에 죽고 pending 잔류 가능.

**제안 수정 (검증형):**
- **A-1 (자가치유):** mount effect 추가 — `deployPhase==='deployed' && !mix && !final_ && workers.some(pending) &&
  orchestration 미실행(workersRef 없음/settled)`이면 **1회 자동 `startWorkerExecution`**. 단 중복 실행 가드
  (`autoResumedRef`)로 레이스 방지. → "리로드하면 다시 실행 눌러야" 제거.
- **A-2 (레이스):** `startWorkerExecution` 진입에 "이미 이 워커셋으로 실행 중" 가드 — 동일 in-flight면 재-abort/재시작 skip.
- **검증:** worker-engine 유닛테스트(all-waiting_input → onStart 0회·클린 resolve) + 스토어 테스트(deployed+pending
  세션 로드 → 자가치유 1회 발화, 중복 미발화). 라이브: focus에서 판단-크루/혼합-크루/리로드 3케이스 완주 확인.

---

## B. 닫는 봉인 = 제대로 된 마감 의식 (지금은 "박스에 버튼")

**현상:** 여는 prior-seal(또는 flinch-seal)이 `decision_contract`를 먼저 만들면, 닫는 `SealMoment`가
`if (contract && scene==='ask') return <DecisionContractCard>`(`SealMoment.tsx:298-300`)로 **곧장 빠져** 봉인 의식
(SealStamp 도장 애니 + 인증서 플레이트, `:386-451`)이 **안 뜬다.** 사용자는 밋밋한 상태 박스만 봄.

**핵심 미해결 질문(라이브 확인):** 여는 prior/flinch가 실제로 `decision_contract`를 쓰는가? (그래야 이 단락이 성립.)
`buildEarlyContract`(여는 rope) / flinch 경로가 계약을 만드는지 grep·트레이스로 확정.

**제안 (내가 고른 최선안):** 닫는 순간을 **"prior를 최종 결정으로 봉인(augment)하는 의식"**으로 만든다.
- `SealMoment`에 `closing?: boolean` prop 추가(닿기 단계에서 true). `closing && contract && 새 predicate 있음`이면
  300줄 즉시-delegate 대신 **ASK/ceremony 경로**로: `seal()`은 이미 `existing → augmentContract`(`:188-190`) 지원 →
  `sealing`(도장) → `sealed`(인증서)까지 재생. 즉 **여는 봉인과 대칭인 닫는 봉인**.
- 닫힘 완료(augment된 계약) 후 리로드 = 계약이 최종 predicate 보유 → 그때는 `DecisionContractCard`(WAITING) 정상.
- **회귀 위험(반드시 검증):** "이미 닫힌 계약 리로드"가 의식을 재생하면 안 됨 → 구분 신호 필요. 후보: augment 시
  `contract.closed_at`(신규 필드) 스탬프 → `closing && !contract.closed_at`일 때만 의식. `closed_at` 있으면 카드.
- **검증:** SealMoment 로직 유닛테스트(closing+prior+predicates → scene 'sealing' 진입; closed_at 있으면 카드).
  라이브: 여는 봉인→…→닫는 봉인이 도장 의식으로 마감되는지, 리로드 시 카드로 가는지.

---

## C. 정보구조 대공사 — "안 읽는다" (가장 큰 레버)

**세 가지 접근 검토:**
- **접근1 — 기본 접힘 disclosure:** 무거운 블록(통합분석 벽, 5단계 계획, 전문)을 2~3줄 요약 + "자세히"로.
  구조 변경 최소·저위험. `MixPreview.tsx`엔 이미 "전문 보기" 확장 패턴 있음(`:75,94`) — 이를 통합분석/리포트에 확장.
- **접근2 — 페이즈 재분할:** 과부하된 듣기(팀분석+초안+CEO검토+flinch)를 별 스텝으로 쪼갬. 한 화면=한 일.
  재아키텍처. 효과 크지만 위험·범위 큼.
- **접근3 — 가치 우선 재배치 + 고정 요약 1개:** 상단에 질문+방향 요약 고정(페이즈마다 반복 제거), 고가치 상호작용
  (CEO검토·flinch봉인)을 위로, 분석 벽을 아래·접힘.

**내가 고른 최선안 = 접근1 + 접근3 먼저 (저위험·최대 체감), 접근2는 후속.**
이유: 사용자 최대 고통은 "길어서 안 읽힘"이고, 그건 페이즈 구조가 아니라 *한 화면의 밀도*에서 옴. 접힘+가치우선+
반복제거는 렌더 로컬 변경으로 큰 체감 개선을 주면서 흐름 로직(위험)을 안 건드림. 페이즈 재분할(접근2)은 그다음.

**실행 슬라이스 (검증형, 순서대로):**
1. **통합분석/워커 리포트 기본 접힘:** `CrewAtWork`(이미 아코디언 `expandedId` 있음 `:53`)를 기본 요약만; 리드 통합분석
   (`민재`)은 핵심 발견 3줄 + "자세히". → 수학 벽 제거. 렌더 테스트로 "기본 접힘, 클릭 시 확장" 고정.
2. **전문(초안) 인라인 펼침 제거:** `MixPreview`의 전문 보기를 기본 접힘 유지(현재 확장형이면). 최종 문서는 "요약 카드 +
   전문 보기" 2단.
3. **페이즈 반복 제거:** 방향·답변 pill·5단계를 매 페이즈 재출력하는 곳 찾아 상단 고정 요약 1개로. (`ProgressiveFlow`
   렌더에서 반복 블록 식별 — grep `우리가 잡은 항로`/`5단계 계획`.)
4. **로딩=풀콘텐츠 → 스켈레톤:** reframe에서 한 것과 동일 패턴을 듣기 로딩에 적용.
- **모바일 우선**으로 각 슬라이스 검증(벽 문제는 모바일에서 배가).

---

## D. 선원 배치(deployWorkers) UX + 배선 — ultracode 워크플로우 결과 (2026-07-04)

7-에이전트 워크플로우(조사 3 + 설계 3 + 심사 1)로 다각도 감사. 채택 설계 = 접근3(목적-우선 카드) 뼈대 +
접근1(provenance 태그·assignment_reason) + 접근2의 경계 문장, 전부 `CrewAtWork.tsx` 안(새 화면/게이팅 변경 없음).

**핵심 감사 발견:** focus 모드(기본)는 설명형 `TeamDeployBanner`를 스킵 → 사용자는 `CrewAtWork`(기본 접힘)의
이모지 아바타 + "선원들이 일하고 있어요 0/N"만 봄(낯설다). 그리고 `ai_scope/self_scope`(AI/사람 분담)가
**AI 프롬프트에 미주입**(장식) — `buildWorkerTaskPrompt`에 scope 파라미터 없음, mix에도 미전달.

**✅ 구현·검증·푸시 완료:**
- UI(`CrewAtWork.tsx`, `a65f839`): 항상 보이는 오리엔팅 줄 + "이게 뭐예요?" 큐 + 목적 리드인(AI가 대신 봐요/
  이건 당신이 정해요/사람에게 물어봐요) + self_scope "당신이 정해요: …" + assignment_reason "↳ …" + 정의를
  프라이버시 recap으로 강등. **시드 세션으로 라이브 렌더 검증**(전 항목 렌더, 옛 묻힌 정의 제거).
- 배선 A(`bf332b0`): `ai_scope/self_scope`를 `buildWorkerTaskPrompt` 유저 프롬프트에 주입 + 두 호출부
  (worker-engine, agent-planner) 전달. **AI가 실제로 분담 경계를 봄.** 유닛테스트로 주입/미주입(무-fabrication) 고정.

**남은 배선 (다음 세션, 스파인 안전):**
- **배선 B (mix 반영):** `mixableWorkerResults`(useProgressiveStore.ts ~1812-1820)의 `base`에 `self_scope`(있으면
  `user_decision`)를 추가하고, `buildMixPrompt`(progressive-prompts.ts ~438)의 workerResults 타입에 `selfScope?`를
  받아 해당 섹션을 "이 부분은 사용자가 소유한 판단에 기댐: {selfScope}"로 태깅 → 초안이 사람-판단 경계를 반영,
  provenance 정직 유지. 유닛테스트로 mix 입력에 selfScope 포함 확인.
- **배선 C (칩 영속, 선택):** `WorkerCard.tsx:420`의 decision 칩 클릭이 `setInputVal(opt)`만 해서 자유텍스트와
  구분 안 됨(편집 시 유실). 기존 `user_decision`(types.ts:136) 필드에 선택을 별도 저장.
- **ai_scope UI 클로즈(이제 정직):** 배선 A가 들어갔으니 카드에 "AI가 봐요: {ai_scope}"를 추가해도 과-claim 아님.
  `CrewAtWork` 카드에 `at==='ai' && w.ai_scope` 가드로 한 줄 추가 + 시드 재검증.

**미해결(라이브 필요):** LLM 로컬 503이라 "AI가 scope대로 *더 나은* 산출을 내는가"는 런타임 검증 불가 —
프롬프트가 scope를 담는다는 사실(정직성 핵심)만 유닛테스트로 확정. 배포 환경에서 산출 품질 확인 권장.

## 실행 원칙 (이 스펙 전체)
- 각 슬라이스는 **독립 커밋 + tsc/eslint/테스트 통과 후 push.**
- 흐름 로직(봉인 라우팅·워커 실행)은 **라이브 재현으로 검증한 뒤에만** 변경. 눈 감고 지르지 않는다(하자보수 금지).
- 1차 근거 우선 — 이 스펙도 기성 계획이 아니라 오늘 코드 정독에서 나옴. `ARGUS-2.0-PLAN`은 F13(seal-flush)·F10 등
  사실 보강 각주로만.
