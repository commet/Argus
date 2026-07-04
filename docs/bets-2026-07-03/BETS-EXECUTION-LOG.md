# 베팅 실행 로그 (BETS-EXECUTION-LOG)

_각 웨이브가 완료한 항목을 append. 무엇을·왜·어떻게·파일·검증·커밋._

---

## W1 회고 격리 기반 (③ bet3 항목 1, 2, 11 + 경계검증 9)

### [항목 1] DecisionContract에 `origin?: 'retro'` 필드 추가

- **무엇:** `DecisionContract` 인터페이스에 `origin?: 'retro'` 옵셔널 필드를 추가했다.
- **왜:** 베팅③(회고 봉인)은 "이미 결과를 아는 지난 결정"을 첫 세션에 봉인→정산까지
  완주시켜, 진짜 정산(2~3주 대기)을 당장 맛보게 한다. 이 연습 계약을 진짜 계약과
  구분하려면 표식이 필요하다. `origin === 'retro'`가 그 표식이며, 자차표 집계에서
  격리하는 유일한 근거가 된다(항목 2).
- **어떻게:** `JudgmentReceipt` 필드 바로 아래에 필드 1줄 + 주석. 값은 리터럴 `'retro'`
  하나만(정상 계약은 필드 부재 = undefined). 단일 `decision_contract` jsonb 컬럼 안에
  중첩되므로 **마이그레이션 0**, schema-drift 불변(컬럼 추가 아님).
- **파일:** `src/stores/types.ts` (`DecisionContract` 인터페이스, line 654 근처).
- **검증:** `tsc --noEmit` 0 에러. schema-drift.test 615 통과(단일 jsonb 컬럼 유지 확인).

### [항목 2·C1·P0] `summarizeRecord` 회고 격리 필터

- **무엇:** `summarizeRecord` 루프에 `if (c.origin === 'retro') continue;` 1줄을 추가해
  회고 계약을 자차표 집계에서 완전히 제외했다.
- **왜:** 이게 이 웨이브의 최대 위험(P0). 회고 정확도는 회상편향이 태생적이라, 회고
  연습이 `loops/betsHeld/risksAvoided`에 집계되면 진짜 성적표를 조용히 부풀린다 =
  goalpost-guard 불변식 위반(CLAUDE.md 규칙2, 사용자에 대한 평결 금지). `summarizeRecord`가
  자차표의 **유일한** 집계원(project record strip + SettlementModal 둘 다 이 함수를 읽음)
  이라 한 곳만 막으면 모든 표면이 동시에 격리된다.
- **어떻게:** `allGraded` 게이트 직후, `rec.loops++` 직전에 origin 필터를 넣어 회고
  계약이 어떤 필드에도(loops·betsHeld·risksAvoided·betsBroke·risksHappened·goodOutcomesOnLuck)
  기여하지 못하게 했다. 근거 주석 동봉.
- **파일:** `src/lib/decision-contract.ts` (`summarizeRecord`, line 656 근처).
- **검증:** retro-isolation.test 3건 통과(정상 계약 집계·회고 완전 제외·회고가 실계약
  집계를 안 늘림). tsc 0.

### [항목 11] Persistence 선언

- **무엇:** `persistence-contract.test.ts`의 CONTRACT에서 `PROJECTS` 항목 위에 `origin`
  필드의 거취를 선언하는 주석 3줄을 추가했다.
- **왜:** CLAUDE.md Persistence Declaration 원칙 — 새 사용자 행동 데이터는 거취를
  선언한다. `origin`은 새 `STORAGE_KEYS` 키가 아니라 단일 `decision_contract` jsonb
  안에 실려 이미 synced인 `PROJECTS`(→ projects 테이블) 계약에 동승한다. 새 키·마이그
  없음을 명시해, 나중에 "이 필드 서버 가나?" 하는 침묵의 구멍을 막는다.
- **어떻게:** CONTRACT 리터럴은 `STORAGE_KEYS` 키만 순회하므로 `origin`은 별도 엔트리가
  아니라 `PROJECTS` 선언에 부속된 문서 주석으로 기록. (STORAGE_KEYS/db.ts는 건드리지
  않음 — 공유 등록부 append-only 규칙 준수, 여기선 append도 불필요.)
- **파일:** `src/lib/__tests__/persistence-contract.test.ts` (CONTRACT, PROJECTS 위).
- **검증:** persistence-contract.test 통과(무선언 키·유령 선언 가드 무변).

### [항목 9] retro-격리 가드 테스트 (경계 검증)

- **무엇:** 신규 `src/lib/__tests__/retro-isolation.test.ts` — 회고 격리 불변식의 가드.
- **왜:** C1이 P0라서 회귀 방지가 필수. 필터가 삭제되면 연습 고리가 성적표를 부풀리는
  게 조용히 되살아난다. 이 테스트가 그 회귀를 빌드 단계에서 잡는다.
- **어떻게:** `summarizeRecord`에 (a) 정상 settled 계약 → loops/betsHeld/risksAvoided
  집계 확인, (b) 동일 계약에 `origin:'retro'`만 붙였을 때 6개 필드 전부 0, (c) 실계약
  + 회고계약 동시 투입 시 결과가 실계약-only와 `toEqual` — 세 단언. 픽스처는 held bet
  (source `governing_idea`) + avoided risk를 grade해 `allGraded=true`인 진짜 닫힌 고리.
- **파일:** `src/lib/__tests__/retro-isolation.test.ts` (신규).
- **검증:** vitest 3/3 통과. tsc 0.

**W1 종합 검증:** `npx tsc --noEmit` 0 에러 · retro-isolation/decision-contract/
record-disclosure/persistence-contract 27/27 통과 · schema-drift+mojibake-guard 615/615
통과 · 한국어 문자열 mojibake 없음(grep 확인). 마이그레이션 0.

**커밋:** `fda2948` — feat(bet3): isolate retrospective seals from the cross-project
record (W1). (9 files, 항목 1·2·9·11 + 두 로그 + PLAN 3건 최초 트래킹.)

---

## W2 회고 플로우 (③ 항목 3·4·8)

### [항목 4] RetroSeal 3스텝 컴포넌트 (신규)

- **무엇:** 신규 `src/components/workspace/RetroSeal.tsx` — 지난 결정 하나로 봉인→정산
  고리를 첫 세션에 완주하게 하는 3스텝 컴포넌트. HeroFlow 내부에서 렌더(새 라우트 없음).
- **왜:** 병목이 "47 열림 / 0 정산"이라, 진짜 moat인 정산을 2~3주 안 기다리고 첫 세션에
  맛보게 하는 게 목적(PLAN §0). 이미 결과를 아는 지난 결정을 써서 즉시 정산까지 간다.
- **어떻게 (3스텝):**
  1. **lean:** 지난 결정+그때 내 판단 한 줄 → `buildEarlyContract`의 lean 경로로 봉인
     (`authored:'user'` — 진짜 자기 말, 가짜 소유권 아님). `check_in_at`=오늘로 심어
     `contractStatus.checkInDue`가 로컬 자정 기준 즉시 참. `origin:'retro'` 박아 자차표
     완전 격리(W1의 summarizeRecord 필터가 잡음). `judgment_receipt.human_judgment`에
     lean 저장 → 판단 액자 "봉인 당시" 인용.
  2. **outcome:** 어떻게 됐는지 한 문단 → 기존 `alignOutcome`(settle-align) 재사용해
     non-binding draft만 산출. 문단은 `judgment_receipt.what_happened`로 저장(판단 액자
     "돌아와서"). LLM 실패는 조용히 삼키고 수동 탭으로 폴백(C5·방어적 접근).
  3. **settle:** 기존 `<SettlementModal>`을 직접 렌더. 사용자가 발생/회피/부분 자기채점 +
     판단 액자(그때↔실제). draft는 점선 pre-highlight로만 전달, 절대 선택 안 됨(C5).
- **스파인:** lean=사용자 본인 말(rule1), AI draft는 미리 강조만·최종은 사용자 탭(rule2·C5),
  진입은 데모 동급 옵션·그만두기 상시(rule4). 모든 텍스트 JSX auto-escape.
- **파일:** `src/components/workspace/RetroSeal.tsx` (신규), `src/components/projects/
  SettlementModal.tsx` (`draftVerdicts?` 옵셔널 prop 추가 — 점선 초안 링, 비구속).
- **검증:** tsc 0. settle-align/retro-isolation/settlement-modal-freeform/decision-contract
  25/25 통과. `check_in_at`=오늘 → checkInDue 즉시 참(decision-contract.ts:534 로컬 date
  경계, 코드 확인). SettlementModal은 checkInDue 게이트 없이 넘긴 project를 바로 렌더 =
  즉시 오픈 보장.

### [항목 3] 회고 봉인 진입 카드 (워크스페이스 빈 상태)

- **무엇:** `workspace/page.tsx` 빈 상태(`projects.length === 0`) 데모 시나리오 섹션
  아래에 회고 진입 카드 1개 + HeroPhase에 `'retro'` 추가 + phase==='retro'일 때 RetroSeal
  전체화면 렌더(demoScenario early-return과 동형).
- **왜:** 회고 플로우로 들어가는 조용한 문. 데모 동급 옵션이며 강제 아님(PLAN 1-A) —
  주 입력(무엇이 상황인가요?)이 항상 메인 문이고, 이 카드는 데모 옆 절제된 선택지.
- **어떻게:** 데모 grid 직후 `projects.length === 0`에서만 카드 렌더(귀환 사용자는 자기
  기록이 있으므로 제외). 클릭 → `setPhase('retro')`. `--bp-*` 안 씀(버튼 배경 금물 규칙),
  기존 --accent/--surface 토큰만. `History` 아이콘은 기존 import 재사용.
- **파일:** `src/app/[locale]/workspace/page.tsx` (import·HeroPhase·retro early-return·카드).
- **검증:** tsc 0. 빈 상태에서만 노출, 새 결정/데모 상시 도달(로치모텔 없음).

### [항목 8] SealMoment '3d' 확인일 순수 동등 옵션 노출

- **무엇:** `SealMoment.tsx`의 `INTERVALS`에 `'3d'`(3일 뒤) 칩 추가.
- **왜:** [1-B] 첫 봉인자가 2주를 기다리다 안 돌아오는 걸 막되, 재촉 없이 정산을 더 빨리
  맛볼 수 있게. 짧은 확인일이 필요한 결정용 순수 동등 옵션.
- **어떻게:** BindCard는 이미 4개(3d 포함)를 모두에게 노출 중이나 SealMoment INTERVALS는
  1w/2w/1m만 있었다 → `'3d'` 칩 1개 추가. 다른 칩과 완전 동일한 중립 date chip, 재촉
  어휘·긴급 카피·기본 선택 0. 먼 지평(2w/1m) 그대로, 인위적 단축 없음(가짜 정산 방지).
  `CheckInInterval`·`CHECK_IN_MS`에 `'3d'` 실재(types.ts:596, decision-contract.ts:60).
- **파일:** `src/components/workspace/progressive/SealMoment.tsx` (INTERVALS 1줄 + 근거 주석).
- **검증:** tsc 0. 근거는 순수 동등 옵션(rule4 거울조항 — 과잉발화 아님).

---

## W3 회고 배지·가드 (③ 항목 5·6·7·9·10)

### [항목 5·C2] 「연습·회고」 배지 3표면 (SealMoment·SettlementModal·판단액자)

- **무엇:** `origin === 'retro'`인 계약을 보여주는 3표면 모두에 상시 「연습 · 회고」
  배지를 노출. 공유 컴포넌트 신규 `RetroBadge.tsx` 하나로 3표면의 shade를 단일화.
- **왜:** C2(정직 provenance, rule1) — 회고(연습)임을 절대 숨기지 않는다. 봉인증서·
  정산모달·판단액자 어디서 보든 "이건 결과 알고 되짚은 연습"이라고 조용히 표시해야
  진짜 봉인(눈먼)으로 오인되지 않는다.
- **어떻게:** 신규 `src/components/projects/RetroBadge.tsx` — `ai_surfaced` 배지와
  **동일 shade**(text-tertiary + subtle border, 색·강조 0, History 아이콘). 점수·%·
  등급·비교 문구 0(스파인). 세 표면 배선:
  - **SealMoment(봉인증서):** 증서 플레이트 헤더에 `contract?.origin === 'retro'`일 때 렌더.
  - **SettlementModal(정산모달):** `isRetro = contract?.origin === 'retro'` 파생, 정산
    의식 헤더에 렌더.
  - **JudgmentFrame(판단액자):** `retro?: boolean` prop 신설, SettlementModal이
    `retro={isRetro}` 전달, 액자 상단에 렌더.
- **스파인:** provenance 태그는 조용한 사실 1개 — 평결·경보·칭찬 아님(CLAUDE.md 규칙2).
  단일 컴포넌트라 3표면 drift 불가(Single Source of Truth).
- **파일:** `RetroBadge.tsx`(신규), `SealMoment.tsx`, `SettlementModal.tsx`, `JudgmentFrame.tsx`.
- **검증:** tsc 0. retro-isolation.test에 3표면 배지 커버리지 4건 추가(항목9) 통과.

### [항목 6·C3] 실전 온램프 텍스트 링크 (회고 완료 화면)

- **무엇:** 회고 정산이 닫히면(SettlementModal done 화면) 실전 온램프 텍스트 링크 1개
  ("이제 진짜 — 결과를 아직 모르는 결정 하나 걸어볼까요?") → 새(눈먼) 결정 시작.
- **왜:** C3(절제, rule4) — 연습을 닫은 직후가 진짜를 걸어볼 유일한 문. 단, 조름·버튼
  승격·자동 네비 금지. 텍스트 링크 하나만.
- **어떻게:** SettlementModal에 `onRealSeal?: () => void` 옵셔널 prop 신설. `isRetro &&
  onRealSeal`일 때 done 화면의 재봉인 온램프를 이 링크로 **대체**(중복 문 방지). RetroSeal이
  `onRealSeal`을 SettlementModal에 배선, 워크스페이스가 `setCurrentProjectId(null)` +
  `setPhase('idle')`(메인 입력=새 결정)으로 처리. 정상 /project 정산은 prop 미전달 →
  기존 온램프 그대로.
- **파일:** `SettlementModal.tsx`, `RetroSeal.tsx`, `workspace/page.tsx`.
- **검증:** tsc 0. prop 미전달 시 기존 done 화면 무변(settlement-modal 테스트 통과).

### [항목 7·C4] 빈 자차표 안내 카피 (회고만 한 사용자)

- **무엇:** 신규 `RetroOnlyNotice.tsx` — 실 record가 0(RecordStrip null)인데 정산한
  회고가 있을 때만 뜨는 안내 스트립. `/project` 자차표 자리(RecordStrip 아래)에 배치.
- **왜:** C4 — 회고는 자차표에서 격리(C1)되므로 회고만 한 사용자는 RecordStrip이 통째
  사라진다. 그 빈칸이 "고리 닫았는데 왜 아무것도 없지?"라는 배신감으로 읽히지 않게,
  "연습 고리는 여기 안 쌓임 + 실 기록은 진짜 봉인부터" 한 줄로 정직하게 잇는다.
- **어떻게:** RecordStrip의 null 조건(merged settled === 0)과 **같은 수**를 계산해
  실 record가 0일 때만 렌더, 정산된 회고 계약(origin==='retro' + 전 predicate resolved)이
  있어야 렌더. 실 고리가 하나라도 닫히면 RecordStrip이 이어받고 이 스트립은 null.
  카운트·점수 0(스파인). project/page.tsx:486(RecordStrip) 직후 배치.
- **파일:** `src/components/ui/RetroOnlyNotice.tsx`(신규), `project/page.tsx`.
- **검증:** tsc 0. 실 record>0 시 null(RecordStrip에 위임), 회고 정산 전엔 null.

### [항목 10·활성화 계측] retro_settled · first_real_seal_after_retro

- **무엇:** 회고→실봉인 전환 퍼널 2 이벤트. `retro_settled`(회고 고리 정산 완료),
  `first_real_seal_after_retro`(회고 이후 첫 진짜 봉인). +부수 `retro_seal_started`
  (W2 기존)·`retro_to_real_onramp_clicked`(온램프 클릭).
- **왜:** "3분 완주=병목 해소" 주장의 유일한 실증 신호. 계측 없으면 회고가 종착역인지
  온램프인지 실DB에서 판독 불가(창업자 버튼 §6-3).
- **어떻게:** 신규 STORAGE_KEY `RETRO_SETTLED`(`argus:retro-settled`, 부울 1개) 등록
  (STORAGE_KEYS + persistence-contract localOnly 선언). SettlementModal이 `isRetro &&
  allResolved`에서 플래그 set + `track('retro_settled')`(기기당 1회). SealMoment의 두
  실봉인 경로(seal·manualSeal 첫 봉인)가 플래그를 **소비**(consume-and-clear)해
  `track('first_real_seal_after_retro')`를 정확히 1회 발화. 회고 계약은 SealMoment를
  거치지 않으므로(RetroSeal이 직접 buildEarlyContract) retro-vs-real 오발화 없음.
- **파일:** `storage.ts`(키), `persistence-contract.test.ts`(선언), `SettlementModal.tsx`
  (retro_settled), `SealMoment.tsx`(first_real_seal_after_retro helper + 2경로 호출),
  `RetroSeal.tsx`(retro_to_real_onramp_clicked).
- **검증:** tsc 0. persistence-contract 테스트 통과(새 키 선언·우회키 가드 무변 —
  `argus:` 콜론 키는 sot_/argus_ 스네이크 정규식 밖).

### [항목 9·C1/C2 가드] retro-격리 테스트 확장 (3표면 배지 커버리지)

- **무엇:** 기존 `retro-isolation.test.ts`(W1의 summarizeRecord 격리 3건)에 「연습·회고」
  배지 3표면 소스레벨 커버리지 4건 추가.
- **왜:** C2 회귀 방지 — 어느 표면이 배지를 떨어뜨리면 회고가 진짜로 오인된다.
  enum-literal-copy류 소스 검사로 각 표면이 (a) RetroBadge를 렌더하고 (b)
  origin==='retro'(또는 isRetro/retro 파생)로 게이트하는지 강제.
- **어떻게:** RetroBadge 존재·문구·무평결 검사 + SealMoment/SettlementModal/JudgmentFrame
  각각 소스 grep. JudgmentFrame은 prop 게이트 + SettlementModal의 `retro={isRetro}` 배선까지 확인.
- **파일:** `src/lib/__tests__/retro-isolation.test.ts`.
- **검증:** vitest 11/11 통과(W1 격리 3 + W3 배지 4 + describe 헤더).

**W3 종합 검증:** `npx tsc --noEmit` 0 에러 · retro-isolation 11/11 · persistence-contract
통과 · decision-contract/schema-drift/components 117/117 · mojibake-guard+record-disclosure
599/599 · 한국어 mojibake 없음. 마이그레이션 0(origin은 W1의 jsonb 확장, 새 컬럼 0).

---

## W4 — 함대 해도 (bet1 §2 · B1/B2/B3) · 커밋 a180ecf

### [항목 B1] S4 함대 해도 (최소형) — 신규 FleetChart.tsx + /project 배치

- **무엇:** 봉인한(decision_contract 있는) 프로젝트들을 한 폭의 ChartPlate 해도 위에
  VoyageShip(size 34)으로 늘어놓는 신규 컴포넌트. 봉인일(created_at) 오름차순 점선 항로.
  상태=기존 `getVoyageState` 그대로, verified만 VoyageShip 자체 규칙으로 금색 깃발.
  배 클릭=`onSelect(id)`(page가 `setCurrentProjectId` 배선). hover/aria=이름+봉인일.
  좌측 각인 `첫 항해 {날짜} · N주째`(순수 경과 사실). `/project` 목록 상단, RecordStrip·
  RetroOnlyNotice 아래에 mount(`projects.length>0` 브랜치, 봉인 목록만).
- **왜:** 감사 08의 잔여 조각 S4. Argus의 얼굴=축적인데 쌓인 배를 한 장에 보여주는 화면이
  없었다. ChartPlate는 프로덕션 import 0곳(부활 대상), VoyageShip·getVoyageState는 기존
  단일 뇌 — 새 그림/팔레트 0개, 100% 기존 잉크 자산 합성.
- **어떻게:** ChartPlate `!py-0`로 중앙정렬 컬럼을 풀폭 밴드로 덮음. 점선 항로=정적 SVG rule.
  각 배는 `role="listitem"` 버튼(shrink-0, 가로 스크롤 overflow-x-auto)이라 모바일 겹침 없음.
- **파일:** 신규 `src/components/projects/FleetChart.tsx`, `src/app/[locale]/project/page.tsx`(import+mount).
- **검증:** tsc 0. fleet-chart 가드 7/7(순서·크기·클릭·스파인).

### [항목 B2] 함대 해도 파생 캐시

- **무엇:** `ships` 배열을 `useMemo`로 파생 캐시. 의존=projects + 5개 원장(reframe/recast/
  synthesize/feedback/progressive). `getVoyageState`는 저장 안 하는 파생 상태라 매 렌더 N개
  재계산 → 원장이 실제로 바뀔 때만 재빌드.
- **왜:** project/page.tsx의 `projectMetricsMap`과 동일 신호 파생을 한 뇌로 복제(드리프트 방지).
- **어떻게:** 봉인 안 된 프로젝트는 `continue`로 제외(축적 얼굴=봉인 기록만). 정렬은
  created_at 오름차순 단 하나.
- **파일:** `FleetChart.tsx` 내부.
- **검증:** tsc 0. (memo 의존은 projectMetricsMap과 동형).

### [항목 B3] S4 합성-레벨 판정 게이트 (거울 조항) — 코드로 못박음

- **무엇:** (a) 2척 미만 `return null`. (b) 정렬키=created_at 단 하나, 상태별 그룹핑/재정렬/
  카운트 배지 0(ChartPlate coordinate의 `N {count}`도 스코어보드 오독 우려로 제거). (c) rigOf
  무변경·per-ship 확대/흐림/강조 0(모두 동일 size 34). (d) 접기 토글(useState only, 새 키 0).
  (e) VoyageShip이 글로벌 `prefers-reduced-motion` 일시정지 상속 + 항로선은 정적. (f) 배에 CTA
  버튼 0 — 클릭=프로젝트 열기만.
- **왜:** 한 폭에 난파·verified를 나란히 놓은 "구도 자체"가 성적표로 읽힐 수 있다(honest
  provenance는 필요조건이지 충분조건 아님). rigOf 보존만으로 이 공간적 판정을 못 막으므로
  코드 게이트로 명문화.
- **어떻게:** 위 6조를 컴포넌트에 내장 + 가드 테스트로 회귀 봉인.
- **파일:** `FleetChart.tsx`, 신규 `src/components/projects/__tests__/fleet-chart.test.tsx`.
- **검증:** fleet-chart 7/7 — 2척 문턱·오름차순 유일 정렬·상태 무그룹핑·균일 배 크기·
  클릭열기(중첩 CTA 0)·스파인 sweep(%/점수/등급/tier/streak/비교 0, 허용된 N주째 사실만).

**W4 종합 검증:** `npx tsc --noEmit` 0 에러 · fleet-chart 7/7 · retro-isolation + record-summary
+ projects 스위트 25/25(회귀 0) · 한국어 mojibake 없음(첫 항해/함대/펼치기/접기 확인) ·
마이그레이션 0 · 새 localStorage 키 0(접기=useState). 실 dogfood 렌더는 창업자 버튼(§6-2).

---

## W5 항해일지·인용벽 (B4~B8) — 2026-07-03 · 커밋 3ae3ff9

### [B6] 형태2 기념일 각인 확장 — 순수 경과 사실, 연속성 조건 0
- **무엇:** `src/lib/record-summary.ts`에 `firstVoyageInscription(since, now, locale)` 신설.
  `첫 항해 {날짜} · 오늘로 N주째`(en: `First voyage {date} · week N today`)를 반환.
- **왜:** B6 스펙이 `recordStartDate`(기존 순수 날짜 사실)의 경과일 파생을 "오늘로 N주째"로
  확장하라고 지시. 스트릭·연속성·푸시 절대 금지 — 빈 구간(몇 주 봉인 없음)에도 동일 문자열이
  렌더돼야 "유지 실패"로 안 읽힘. 그래서 함수는 `since`와 `now`만 받는 순수 경과 계산이고,
  연속성 상태를 어디서도 참조하지 않는다. `since` 없으면 undefined(각인 안 함).
- **어떻게:** `Math.max(0, Math.floor((now-then)/주ms))`. 같은 날 봉인=`0주째`.
  `FleetChart.tsx`가 인라인 `weeksSince`+인라인 문자열을 이 공유 함수로 교체 —
  "오늘로 N주째" 어휘가 항해일지와 함대 해도에서 단일 뇌(드리프트 불가).
- **파일:** record-summary.ts(+firstVoyageInscription), FleetChart.tsx(공유 함수 사용, weeksSince 제거).
- **검증:** tsc 0. fleet-chart 가드의 각인 regex를 새 어휘(`오늘로 \d+주째`)로 갱신(같은 웨이브
  경계 — B6가 어휘를 바꿨으니 가드가 추종). 7/7.

### [B4] S6 항해일지 — 교차-결정 세로 원장 (신규 컴포넌트)
- **무엇:** 신규 `src/components/projects/Logbook.tsx`. `contract.created_at`(봉인)·
  `history[]`(변침)·`graded_at`(정산)을 시간순 병합한 세로 원장(최신 위). 한 줄:
  `M/D 봉인 — 「프로젝트명」` / `M/D 변침 — 확인일 {날짜}로` / `M/D 정산 — 가설 적중 2 · 위험 비켜감 1 · 그중 운 1`.
- **왜:** bet1 PLAN B4 — 봉인·변침·정산 이벤트를 다시 보여주는 화면 부재(감사 S6 잔여).
  `/project` 그리드 아래 접힌 보조 뷰, 새 라우트 금지.
- **어떻게:** ChartPlate(라벨 `항해일지 · LOGBOOK`) 위 `<ol>` 단일 세로 컬럼. 정산 카운트는
  `summarizeGrades`(자차표와 동일 뇌)로 파생 — 총합·점수 아님, 순수 카운트. 이벤트 2개 미만이면
  스스로 미렌더. 접기 기본 true(보조 뷰). **회고(origin:'retro') 계약 전면 제외** — 축적의 얼굴은
  눈먼 결정의 기록이고 회고는 W1 불변식으로 record 전 표면에서 격리됨. project/page.tsx 그리드 직후 mount.
- **파일:** Logbook.tsx(신규), project/page.tsx(import+mount).

### [B5] "문장만 보기" 토글 = 인용벽 흡수
- **무엇:** Logbook 내부 `문장만 보기` 토글. 켜면 이벤트 원장을 숨기고 각 결정의 `JudgmentFrame`
  (봉인 문장/돌아온 문장)만 봉인일 역순 세리프 누적.
- **왜:** 제안2 형태1(인용벽)을 별도 컴포넌트로 신설하면 CLAUDE.md 단일소스 위반→드리프트.
  그래서 S6 필터로 흡수, `JudgmentFrame`(기존 = 유일 원문 인용 렌더 경로) 재사용.
- **어떻게:** `quoteFrames` = human_judgment 있는 계약만(JudgmentFrame 자체 규칙). 액자 2개 미만이면
  토글 자체를 안 보임(canShowQuotes). JudgmentFrame이 JSX 텍스트노드로 렌더=React 자동 이스케이프
  (XSS 방어 상속). retro=미전달(기본 real).
- **파일:** Logbook.tsx.

### [B7] OutputSelector 어휘 좁힘 (이미 트리에 반영됨)
- **확인:** OutputSelector.tsx:219가 이미 `이 항해 돌아보기`/`Look back on this voyage`
  (레거시 `항해일지 · 되돌아보기` → 좁힘). src/에 구 라벨 리터럴 0건(docs만 잔존). 추가 변경 불요.

### [B8] 드리프트 가드 — 항해일지 카운트 = RecordStrip = 텔레그램 숫자
- **무엇:** 신규 `src/lib/__tests__/logbook-drift.test.ts`. 하나의 픽스처(실 계약 2 + 회고 1)에서
  (a) Logbook의 계약별 정산 카운트(summarizeGrades) 합 == summarizeRecord 총합(RecordStrip이 렌더),
  (b) 텔레그램 recordSummaryMarkdown의 정산 완료 숫자 == 닫은 고리 수. 회고 루프는 전 표면에서 제외.
  스파인 sweep: Logbook 정산 줄에 %/점수/등급/tier/streak/비교 0.
- **왜:** bet1 PLAN B8 — 문장은 표면별로 달라도 숫자는 한 뇌.
- **어떻게:** Logbook의 `settleCountsLine`을 export해 렌더 없이 순수 검증. 픽스처는 betsHeld 2/
  risksAvoided 1/betsBroke 1/risksHappened 1/goodOutcomesOnLuck 1(실측으로 기대값 교정). 5 단언.
- **파일:** logbook-drift.test.ts(신규), Logbook.tsx(settleCountsLine export).

### W5 종합 검증 (경계)
- `npx tsc --noEmit` 0 에러.
- vitest(--exclude .claude): logbook-drift 5/5 · record-summary 9/9 · fleet-chart 7/7 ·
  schema-drift + persistence-contract 통과 = 5 파일 47/47(회귀 0).
- XSS: Logbook `dangerouslySetInnerHTML` 0건 — 프로젝트명·인용 전부 JSX 텍스트노드(자동 이스케이프),
  인용벽은 JudgmentFrame 기존 방어 상속.
- 한국어 mojibake 없음(봉인/변침/정산/항해일지/문장만 보기/오늘로 확인).
- 마이그레이션 0(기존 decision_contract jsonb 필드만 판독) · 새 localStorage 키 0(접기/토글=useState).
- 실 dogfood 렌더 육안(2척+ 계정으로 항해일지·인용벽 확인)은 창업자 버튼(§6-2).

---

## W6 — ② MCP 유통 코드준비 (페이즈1~3, 이름=argus-decision-mcp)

### 페이즈1 — 이름 치환 + 발사 위생
- **무엇:** npm 패키지 이름을 타인 소유 `argus-mcp` → 사용가능 `argus-decision-mcp`로 전면 치환
  하고, dist에서 테스트 산출물을 제거.
- **왜:** npm의 `argus-mcp`는 이미 타인(adesmet, playwright 도구) 소유라 우리가 publish 불가
  (403). README 옛 설치명령을 그대로 실행하면 **남의 패키지가 깔림** → 첫인상 파탄. PLAN이
  지목한 BLOCKER. 또 dist에 테스트 18파일이 실려 README의 "grep dist/ — no verdict tool"
  자기증명이 오염됨.
- **어떻게:**
  - `package.json`: `name` → argus-decision-mcp, `version` 1.3.0 → **1.0.0 리셋**(옛 서사 폐기),
    `bin` 키 → argus-decision-mcp, `mcpName: io.github.commet/argus-decision-mcp` 신설,
    `author`(commet)·`homepage`(argus.voyage)·`repository`(github+directory)·`bugs` 보강.
  - `src/server.ts:42`: 서버 식별자 name → argus-decision-mcp(호스트에 뜨는 이름).
  - `README.md`: 제목(1)·설치명령 2줄(52,62) 치환. README 내 `argus-mcp` **0건** 확인.
  - `CONTRIBUTING.md:1`: 프로젝트명 제목 치환(기여자향).
  - `tsconfig.json`: exclude 추가(`src/**/__tests__/**`,`src/**/*.test.ts`,`src/test-helpers.ts`
    — PLAN의 `src/lib/test-helpers.ts`는 오기, 실경로로 교정).
  - `package-lock.json`: `npm install --package-lock-only`로 name/bin 동기(의존성 churn 0).
- **파일:** argus-mcp/package.json · src/server.ts · README.md · CONTRIBUTING.md · tsconfig.json ·
  package-lock.json.
- **검증:** `rm -rf dist && npm run build` → `find dist -name "*.test.js" -o -name "*test-helpers*"`
  = **0건**. tsc 0 · npm test **185/185**(18파일). 사용자향 install/identifier grep: README 0건,
  package.json name/bin/mcpName·server.json name/identifier 전부 신이름.

### 페이즈2 — PUBLISH.md 전면 재작성
- **무엇:** 옛 런북(1.2.1 tolerant-replay FIRST → 1.3.0 서사)을 폐기하고 새 이름·1.0.0·
  clean-install 왕복 런북으로 교체.
- **왜:** 옛 런북은 "우리가 1.0.0~1.2.0을 게시했다"를 전제하나 그건 **adesmet 소유** = 허구.
  그대로 따르면 `npm publish` 403. 손상될 공유 ledger 0건이라 "tolerant-replay FIRST" Step도 무의미.
- **어떻게:** 이름 변경 이유(실측)·버전 lockstep 규칙(package.json/server.json/git tag 동일 커밋)·
  npm login·build/test/publish(무스코프=`--access` 불필요)·**빈 폴더 clean-install 왕복**(우리
  서버가 뜨는가·AI VERDICT NONE 확인)·mcp-publisher(선택). 전 스텝을 창업자 버튼으로 명시.
- **파일:** argus-mcp/PUBLISH.md(전면 재작성).
- **검증:** 남은 `argus-mcp` 문자열은 (a)"타인 소유라 못 쓴다" 설명 문장, (b)repo 서브폴더 경로뿐
  — 설치명령·매니페스트 침해 0.

### 페이즈3 — server.json 신규(공식 MCP 레지스트리)
- **무엇:** `argus-mcp/server.json` 신규 작성. Smithery/mcp.so/glama가 크롤링하는 단일 원천.
- **왜:** 레지스트리 미노출(WebSearch 확인). server.json 등재 1회로 다수 디렉토리 자동 노출.
- **어떻게:** 현행 MCP 레지스트리 스키마(2025-12-11, WebFetch로 실물 검증) 준수 —
  `name: io.github.commet/argus-decision-mcp`·description·version 1.0.0·repository(github,
  subfolder argus-mcp)·websiteUrl·`packages[{registryType:npm, identifier:argus-decision-mcp,
  version:1.0.0, transport:stdio, environmentVariables:ARGUS_DIR/ARGUS_TOKEN(secret)/ARGUS_TZ}]`.
  packages identifier가 신이름을 가리키는지 재확인. 스파인: description은 "AI VERDICT NONE=모델이
  채점 안 함, 현실이 함"을 **루프의 사실**로만(우월성 주장 0, 뱃지 프레임 미상속).
- **파일:** argus-mcp/server.json(신규).
- **검증:** node로 JSON 파싱 유효. mcp-publisher login/publish는 창업자 버튼(비가역 외부공개).

### 경계검증 종합
- `cd argus-mcp && npm run build && npm test` = tsc 0 · 185/185.
- `find dist -name "*.test.js" -o -name "*test-helpers*"` = 0건.
- 사용자향 설치명령/매니페스트 식별자에 옛이름 argus-mcp = 0건(잔존은 회피설명+폴더경로만).
- 마이그레이션 0(argus-mcp는 파일기반, DB 무관) · 새 localStorage 키 0 · 한국어 문자열 무관.
- 스킵(창업자 버튼, 비가역 외부행위): npm login/publish·mcp-publisher login/publish·
  clean-install 실측 왕복·30초 데모녹화·awesome-mcp-servers PR. PLAN §6 명시.

## 최종 검증 (W7)

전체 세 베팅 통합 최종 검증. 신규 구현 없이 검증만 수행하되, 웨이브 경계
검증 실패 1건을 W7 안에서 수리함.

### 검증 결과 요약
1. **웹앱 `npx tsc --noEmit`** = **0 에러**.
2. **웹앱 `npx vitest run --exclude "**/.claude/**"` 전체** = **181 파일 / 2611 테스트 전부 통과**.
   - (jsdom "Not implemented: Window's scrollTo()" 는 정보성 stderr 한 줄일 뿐 실패 아님.)
3. **`cd argus-mcp && npm run typecheck`** = **0 에러**, **`npm test`** = **18 파일 / 185 테스트 전부 통과**.
4. **MCP 사용자향 옛이름(argus-mcp) 0건 재확인** — package.json name/bin/mcpName,
   README 제목·설치명령 2줄, server.ts 서버식별자, server.json name/identifier 모두
   `argus-decision-mcp` / `io.github.commet/argus-decision-mcp`. 잔존하는 `argus-mcp`
   문자열은 (a) 내부 회피설명 주석(log.ts stderr·ledger-replay·surfaces·eval fixture·
   CHANGELOG 이력 — PLAN §3.1 선택항목이라 유지) + (b) package.json `directory` /
   server.json `subfolder` 의 **GitHub 저장소 하위폴더 경로**(폴더명이 실제로
   `argus-mcp/` 이므로 정확한 값)뿐. 사용자향/설치향 표면엔 0건.
5. **회고 격리 수동확인** — `summarizeRecord`(decision-contract.ts:662)에
   `if (c.origin === 'retro') continue;` 가 `rec.loops++` 및 모든 grade 집계 **앞**에
   위치. 이 함수가 자차표의 유일 집계원(project/page.tsx strip · SettlementModal ·
   RecordStrip · RetroOnlyNotice 전부 이 함수 경유). Logbook 은 별도로 line 108에서
   `origin !== 'retro'` 필터. retro 계약이 어떤 record-count loop에도 들어가지 않음을
   소스로 확인.

### 수리한 웨이브 경계 실패 (W7 내 수선)
- **증상:** `src/lib/__tests__/design-register-contract.test.ts` 의 "material bp tokens
  outside landing appear only in sanctioned files" 단언 실패. W4/W5가 만든
  `components/projects/FleetChart.tsx` · `components/projects/Logbook.tsx` 가 `--bp-ink` /
  `--bp-ink-soft`(MATERIAL 토큰)를 쓰는데 `MATERIAL_SANCTIONED` 목록에 없어 offender로
  검출됨.
- **원인 판단:** 두 파일 모두 CEREMONY 토큰(`--bp-gold`/`--bp-azure`/seal-stamp/
  bp-btn-primary)은 0(같은 파일의 ceremony 단언은 통과). 순수 material 차용이며,
  이미 sanctioned 인 project 페이지 위에 얹히는 해도-언어 표면(ChartPlate/VoyageElements와
  동일 레지스터). 테스트가 문서화한 정규 경로 = "새 consumer는 의도적 행위, MATERIAL_SANCTIONED에
  사유와 함께 추가".
- **수리:** `MATERIAL_SANCTIONED` 에 두 파일 + 사유 주석 추가(신규 구현 아님, 가드 목록
  갱신). 파일: `src/lib/__tests__/design-register-contract.test.ts` (+6줄).
- **검증:** design-register-contract 2/2 통과 → 전체 2611/2611 통과. 회귀 0.
- **커밋:** (아래 해시)

### 스킵(창업자 버튼 — 비가역 외부행위)
검증 웨이브 범위 밖: npm login/publish, mcp-publisher login/publish, clean-install
실측 왕복, 데모 녹화, awesome-mcp-servers PR, 실 dogfood 육안, 실DB 행수 판독.
전부 각 PLAN §6 창업자 버튼.
