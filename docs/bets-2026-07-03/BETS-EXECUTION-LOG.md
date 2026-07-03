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
