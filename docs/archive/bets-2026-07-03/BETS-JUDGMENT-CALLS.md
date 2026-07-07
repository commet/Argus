# 베팅 대리판단 기록 (BETS-JUDGMENT-CALLS)

_스펙과 실코드가 어긋나거나 재량이 필요했던 지점. 무엇이 애매·나라면 근거·내린
판단·되돌리는 법._

---

## W1 회고 격리 기반

### [항목 11] Persistence 선언의 위치 — CONTRACT 엔트리냐 주석이냐

- **무엇이 애매:** PLAN은 "persistence-contract에 origin 선언 1줄"이라 했다. 그런데
  `persistence-contract.test.ts`의 CONTRACT 리터럴은 타입이
  `Record<keyof typeof STORAGE_KEYS, Decl>` — 즉 **`STORAGE_KEYS` 키만** 항목이 될 수
  있다. `origin`은 새 스토리지 키가 아니라 기존 `decision_contract` jsonb 안의 중첩
  필드라, 여기에 독립 엔트리로 넣으면 "STORAGE_KEYS에 없는 유령 선언" 가드 테스트가
  즉시 실패한다(line 89-91).
- **나라면 근거:** CLAUDE.md Persistence Declaration의 정신은 "이 데이터 서버 가나?"를
  침묵 없이 문서화하는 것이지, 억지로 새 키를 만드는 게 아니다. `origin`은 이미 synced인
  `PROJECTS`(projects 테이블) 계약에 동승하므로, 그 사실을 `PROJECTS` 선언에 부속된
  주석으로 명시하는 게 정직하고 가드도 안 깬다. STORAGE_KEYS/db.ts는 공유 등록부라
  건드리지 않는 게 병렬 세션 규칙에도 맞다.
- **내린 판단:** CONTRACT의 `PROJECTS` 엔트리 위에 origin 거취 주석 3줄을 추가(새 키·마이그
  없음, PROJECTS 동기화의 일부임을 명시). 독립 CONTRACT 엔트리는 만들지 않음.
- **되돌리는 법:** 만약 향후 `origin`을 별도 최상위 컬럼으로 승격한다면(현재 계획엔 없음),
  그때 STORAGE_KEYS/db.ts/schema-drift/CONTRACT에 정식 엔트리로 등록. 지금은 주석 3줄만
  제거하면 원복.

### [스코프] ②(MCP) 이름 대리확정 기록은 ② 웨이브로 이월

- **무엇이 애매:** 오케스트레이터 지시문은 "새 npm 이름 = argus-decision-mcp 대리확정을
  BETS-JUDGMENT-CALLS.md에 근거와 함께 기록"하라고 했다. 동시에 "당신 웨이브 항목만,
  다른 웨이브 금지"라는 구속 규칙이 있다. W1은 ③ bet3의 항목 1·2·9·11(회고 격리)만이다.
- **나라면 근거:** MCP 이름은 `argus-mcp/` 코드에 박는 결정인데, W1은 MCP 코드를 1줄도
  건드리지 않는다. 코드 변경 없이 이름 확정을 여기 못박으면 ② 웨이브가 실제 치환을 하기
  전의 유령 선언이 되고, 되레 ② 담당이 근거 맥락 없이 이 줄만 보게 된다. append-only
  로그이므로 ② 웨이브가 자기 코드 변경과 함께 기록하는 게 추적성이 높다.
- **내린 판단:** MCP 이름 대리확정 기록은 ② 웨이브(bet2)로 이월. W1에서는 이 스코프
  판단만 남긴다. (근거 요약은 보존: 이름 = `argus-decision-mcp`, 계획서 권고, 되돌리기 =
  한 단어 치환, 발사 전 창업자 한마디로 override 가능. 실제 코드 박기·기록은 ② 담당.)
- **되돌리는 법:** ② 웨이브가 이 판단에 이견이면, 코드에 이름 박는 커밋과 함께 이 파일에
  정식 근거를 append하면 된다.

---

## W2 회고 플로우 재량 판단

### [재량] settle-align draft를 SettlementModal에 "미리 강조"하는 방식

- **무엇이 애매:** PLAN 항목4 step2는 "settle-align draft만 미리 강조(non-binding,
  verdict_via:'ai_draft' 태깅). 사용자가 탭으로 최종 확정"이라 했다. 그런데 (a)
  `verdict_via`는 코드 어디에도 실재하지 않는 필드(settle-align.ts 주석에만 언급),
  (b) 기존 SettlementModal은 draft를 미리 강조하는 입구가 전혀 없다(순수 수동 탭).
- **나라면 근거:** C5의 핵심 불변식은 "AI 평결을 결론으로 노출 금지 + 사용자가 탭으로
  확정"이다. verdict_via 필드를 새로 도입하면 필드 추가 체크리스트(타입·기본값·프롬프트·
  UI·핸드오프)가 딸려오고 item 5(배지) 웨이브와 표면이 겹친다 = 스코프 크리프. 대신
  SettlementModal에 옵셔널 `draftVerdicts?: Record<id, verdict>` prop을 더해, 해당
  예측의 draft 값에 **점선 링만** 입히고 `p.verdict`는 pending 그대로 두면 — 시각적
  pre-highlight이되 사용자가 눌러야 커밋되므로 비구속이 코드로 강제된다. verdict_via
  태깅의 "정신"(AI가 짚은 건 초안일 뿐)은 점선+안내문구로 정직히 표현.
- **내린 판단:** `verdict_via` 필드 신설 안 함. SettlementModal에 `draftVerdicts` 옵셔널
  prop 추가(점선 초안 링 + "직접 눌러서 확정하세요" 안내 1줄, draftVerdicts 있을 때만
  렌더). /project 정상 정산 경로는 prop 미전달이라 무영향. RetroSeal이 alignOutcome을
  직접 호출해 이 prop을 채운다.
- **되돌리는 법:** verdict_via 태깅을 정식 자차표 격리로 승격하려면(현재는 origin:'retro'가
  이미 회고 전체를 격리하므로 불필요) Predicate에 `verdict_via?` 추가 + summarizeGrades
  분기. 지금은 draftVerdicts prop 3곳(prop 선언·점선 분기·안내문구)만 제거하면 원복.

### [재량] item 8 "첫 봉인자에게 3d 노출"을 상시 동등 칩으로 구현

- **무엇이 애매:** 항목8은 "첫 봉인자에게 '3d' 조용히 노출"이라 했다. "첫 봉인자에게"가
  조건부 노출(봉인 이력 0인 사용자만)을 뜻하는지, 그냥 강조 맥락인지 애매.
- **나라면 근거:** BindCard는 이미 '3d' 포함 4개 칩을 **모든** 사용자에게 상시 노출한다
  (조건부 아님). SealMoment만 3d가 빠져 있었다. 조건부(첫 봉인자만) 노출은 "이 사용자는
  초심자"라는 내부 판정을 UI에 반영하는 셈이라 오히려 스파인상 미묘하고, 순수 동등 칩을
  하나 더 얹는 게 rule4(과잉발화 금지)에 더 부합. "첫 봉인자에게"는 이 옵션이 가장
  가치있는 대상을 설명한 것이지 게이팅 지시가 아니라고 읽었다.
- **내린 판단:** SealMoment INTERVALS에 '3d'를 조건 없이 상시 동등 칩으로 추가(BindCard와
  동형). 재촉·기본선택·긴급 카피 0.
- **되돌리는 법:** 창업자가 "첫 봉인자만"을 원하면, projects 중 decision_contract 보유 수를
  세어 0일 때만 '3d' 칩을 렌더하는 조건을 INTERVALS 렌더 지점에 추가하면 된다(1줄).

---

## W3 회고 배지·가드 재량 판단

### [재량] 항목7 빈 자차표 카피 — page.tsx:500 인라인이 아니라 자립 컴포넌트로

- **무엇이 애매:** PLAN 항목7은 위치를 "project/page.tsx:500 (`loops===0` 블록)"이라
  못박았다. 그런데 실코드에서 그 자리(500번대)는 자차표가 `<RecordStrip/>`(486)로 이미
  추출돼 있고, RecordStrip은 merged settled === 0이면 **통째 null**을 반환한다. 즉
  page.tsx에 `loops===0` 인라인 블록이 실재하지 않는다(옛 인라인 자차표가 컴포넌트로
  이주됨).
- **나라면 근거:** PLAN 부록의 좌표는 2026-07-03 스냅샷이고, 그 사이/이전 리팩토링으로
  자차표가 컴포넌트화됐다. "loops===0일 때 회고-only 안내"라는 **의도**를 지키되, 그
  판정을 page.tsx 본문에 인라인하면 review 스토어까지 threading해야 하고 RecordStrip의
  null 조건과 두 곳에서 같은 수를 재계산하는 drift 위험이 생긴다. RecordStrip이 이미
  자립 컴포넌트인 패턴을 그대로 따라 `RetroOnlyNotice`를 만들어 RecordStrip 직후에 두면,
  같은 스토어·같은 merged 수 계산을 한 곳에 캡슐화하고 page.tsx는 한 줄만 는다.
- **내린 판단:** 신규 `src/components/ui/RetroOnlyNotice.tsx` 자립 컴포넌트로 구현하고
  `project/page.tsx`의 `<RecordStrip/>` 직후에 배치. RecordStrip의 null 조건(merged
  settled===0)과 **동일한 수**를 계산하고, 정산된 retro 계약이 있을 때만 렌더. 실 고리가
  하나라도 닫히면 null(RecordStrip에 위임).
- **되돌리는 법:** 창업자가 인라인을 원하면 RetroOnlyNotice 내용을 page.tsx의 RecordStrip
  자리로 옮기고 review 스토어를 threading. 지금은 import 1줄 + JSX 1줄 제거하면 원복.

### [재량] C4 완료-화면 안내 위치 — RetroSeal이 아니라 SettlementModal done 블록

- **무엇이 애매:** C4는 "회고만 한 사용자엔 완료 화면에서만 '연습 고리를 닫아봤어요 —
  실제 기록은 진짜 봉인부터' 별도 안내"라 했다. 완료 화면이 RetroSeal의 자체 종료 UI인지
  SettlementModal의 done 블록인지 스펙이 명시하지 않음.
- **나라면 근거:** RetroSeal step3은 SettlementModal을 **직접 렌더**하고 그 자체 종료
  화면이 없다(정산 완료=SettlementModal의 allResolved done 블록). done 블록은 이미
  판단액자·record 카운트·3고리 의식을 그리는 "완료 화면"의 정본이다. 회고 안내를 여기
  `isRetro` 분기로 넣으면 (a) 실계약 카운트 문장을 retro에서 정확히 대체할 수 있고(같은
  자리), (b) /project에서 옛 retro 계약을 다시 열어 정산해도 동일하게 뜬다(RetroSeal
  밖에서도 일관). RetroSeal에 별도 종료 화면을 새로 만들면 done 블록과 중복.
- **내린 판단:** SettlementModal done 블록에서 `isRetro`면 실카운트 문장(`!isRetro &&
  record`)을 C4 안내 문장으로 대체. 회상편향 태생인 회고엔 운/위험 카운트 절대 안 붙임(C4).
- **되돌리는 법:** RetroSeal 자체 종료 화면을 원하면 SettlementModal에 `onSettled`
  콜백을 더해 RetroSeal이 4번째 스텝을 그리게 하고 done 블록의 isRetro 분기를 제거.

---

## W4 — 함대 해도

### [재량] ChartPlate coordinate에서 배 카운트(`N 6`) 제거

- **무엇이 애매:** ChartPlate는 우상단 장식용 `coordinate` prop(해도 좌표 명칭)을 받는다.
  처음엔 `N ${ships.length}`로 배 수를 넣었는데, B3(b)는 "카운트 배지 절대 금지"라 했다.
  해도 좌표는 장식이지 배지인가?
- **나라면 근거:** 거울 조항의 핵심은 구도가 스코어보드로 안 읽히게 하는 것. 우상단에 배
  수를 숫자로 못박으면(장식이든) 양(量)을 강조하는 신호가 되어 "몇 개 쌓았나" 성적표 프레임을
  살짝 연다. 배들은 이미 자기 수만큼 보이므로 좌표에 카운트를 중복할 실익도 없다. 안전 우선.
- **내린 판단:** coordinate prop 자체를 빼서 카운트를 화면에서 제거. label(`함대 · FLEET`)만
  남김. (좌측 각인의 `N주째`는 B1이 명시한 순수 경과 사실이라 유지 — 카운트가 아니라 경과일.)
- **되돌리는 법:** 카운트가 아닌 중립 좌표(예: 고정 위경도 문자열)를 coordinate로 넣으면
  장식성을 되살릴 수 있음. 배 수 노출은 스파인상 재도입 비권장.

### [재량] 접기 상태를 localStorage가 아니라 useState로 — 새 키 0

- **무엇이 애매:** B3(d) 접기 토글의 상태 거취. 영속화하면 공유 등록부(STORAGE_KEYS +
  persistence-contract)에 새 키를 등록해야 한다(병렬 세션 규칙: 끝에 append만).
- **나라면 근거:** 접기는 세션 내 UI 편의일 뿐 사용자 입력/행동 데이터가 아니다(Persistence
  Declaration 원칙의 "새 사용자 입력/행동 데이터"에 해당 안 됨). 병렬 세션이 공유 등록부를
  동시에 건드리는 상황에서 불필요한 append는 충돌 표면만 늘린다. 기본 펼침(collapsed=false)이라
  새로고침해도 정보가 사라지지 않음.
- **내린 판단:** `useState(false)` 로컬 상태로만. STORAGE_KEYS/persistence-contract 무변경.
- **되돌리는 법:** 접기 선호를 기억시키려면 `argus:fleet-collapsed`를 STORAGE_KEYS+
  persistence-contract(localOnly, UI 선호)로 등록하고 getStorage/setStorage 배선.

### [스코프] 실 dogfood 렌더 육안 검수 미실행 — 창업자 버튼(§6-2)

- **무엇이 애매:** B1 경계검증에 "dogfood 계정 렌더 육안(preview 가능하면)". 콜드 프리뷰엔
  auth/시드 데이터가 없어 FleetChart가 정확히 null 렌더(2척 미만)라, 서버를 띄워도 컴포넌트가
  안 보인다.
- **나라면 근거:** PLAN §6-2가 "함대 해도가 실제로 아름다운가"는 창업자 눈으로만 최종 판정
  이라 명시(실사용자 최종 검수 원칙). preview는 "가능하면" 항목. jsdom 가드 테스트가 실제 렌더
  출력(SVG 수·순서·크기·스파인 문자열)을 스크린샷보다 강하게 검증한다.
- **내린 판단:** 빈 데이터로 서버를 띄우는 대신 jsdom 렌더 테스트로 대체 검증. 실 dogfood
  육안은 창업자 버튼으로 이월.
- **되돌리는 법:** 창업자가 봉인 2+ dogfood 계정으로 로그인해 /project를 열면 실렌더 확인 가능.

---

## W5 항해일지·인용벽 재량 판단 — 2026-07-03

### 1. 회고(origin:'retro') 계약을 항해일지에서 제외
- **애매한 점:** B4 스펙은 "봉인·변침·정산 이벤트를 시간순 원장으로"만 말하고 회고 계약의
  거취를 명시하지 않는다. 항해일지는 자차표 aggregate가 아니라 이벤트 연대기라, 회고를 넣어도
  카운트 격리 불변식(W1 summarizeRecord)은 직접 위반하지 않는다.
- **나라면 근거:** CLAUDE.md 스파인 + W1~W3의 일관된 선택 = 축적의 얼굴은 "눈먼 결정의 기록".
  회고는 이미 3표면(RetroBadge/온램프/안내)에서 독립 렌더된다. 항해일지에 회고 봉인/정산 줄을
  섞으면 "가설 적중 N" 같은 후견 카운트가 실 기록 옆에 나란히 놓여 사후편향 카운트가 성적표로
  읽힐 위험(거울 조항). FleetChart도 같은 이유로 봉인 계약만(contractSealed) 렌더한다.
- **내린 판단:** `origin !== 'retro'` 필터로 항해일지 전면 제외(이벤트·인용벽 둘 다). W1 격리와 동형.
- **되돌리는 법:** Logbook.tsx의 `.filter((p) => ... p.decision_contract.origin !== 'retro')`에서
  origin 조건만 빼면 회고도 포함(단 스파인 재검토 필요).

### 2. 항해일지 접기 기본값 = true (그리드 아래 접힌 보조 뷰)
- **애매한 점:** B4 "그리드 아래 접힌 섹션" — 초기 상태가 접힘인지 펼침인지 미명시.
- **나라면 근거:** "접힌 섹션"의 문자 그대로 + 감사 08이 항해일지를 "보조 뷰"로 규정. 대문에서
  자차표/함대 해도가 1차 표면이고 항해일지는 파고들 사람용. FleetChart는 접기 기본 false(1차),
  항해일지는 true(2차)로 위계를 코드로 구분.
- **내린 판단:** `useState(true)`(접힘 시작). 새 localStorage 키 없음(세션 로컬 UI 상태).
- **되돌리는 법:** `useState(true)` → `useState(false)`.

### 3. fleet-chart 가드 regex를 같은 웨이브에서 갱신
- **애매한 점:** B6가 함대 해도 각인 어휘를 `첫 항해 {날짜} · N주째` → `... · 오늘로 N주째`로
  바꾸자 W4가 심은 fleet-chart 스파인 sweep 테스트(`/첫 항해 ... · \d+주째/`)가 깨짐.
- **나라면 근거:** B6 스펙("오늘로 N주째")이 정본이고 어휘 변경은 의도된 것. 가드가 옛 어휘를
  고집하면 스펙과 어긋난다. 웨이브 경계 규칙: "웨이브 경계 검증 실패 시 그 웨이브 안에서 수리."
  B6가 유발한 실패이므로 W5 안에서 가드를 새 어휘로 추종(트리를 깨진 채 안 넘김).
- **내린 판단:** 가드 regex를 `/첫 항해 2026-01-05 · 오늘로 \d+주째/`로 갱신. 스파인 의미(순수 경과
  사실)는 불변 — 어휘만 정본에 맞춤.
- **되돌리는 법:** B6를 되돌리면(공유 함수의 "오늘로 " 제거) 가드도 원복.

### 4. 정산 줄에 카운트 버킷이 0일 때 폴백 = "고리를 닫음"
- **애매한 점:** date-only outcome_note 정산처럼 predicate 카운트가 전부 0인 정산 이벤트의 줄 문구.
- **나라면 근거:** 빈 문자열이면 "M/D 정산 — " 뒤가 비어 깨진 줄. 스파인상 점수·평가 금지라
  중립 사실만 허용. "고리를 닫음"(loop closed)은 순수 사실.
- **내린 판단:** `settleCountsLine`이 parts 비면 `고리를 닫음`/`loop closed` 반환.
- **되돌리는 법:** settleCountsLine의 `if (parts.length === 0)` 분기 제거(빈 줄 위험 감수).

---

## W6 (② MCP 유통 코드준비, 페이즈1~3)

### 1. 새 npm 이름 = `argus-decision-mcp` 대리확정
- **애매한 점:** bet2 PLAN 페이즈0(0.1)은 이름 확정을 "⚠️ 창업자 결정(브랜드 판단)"으로
  두고, 확정 전 페이즈1~5 착수 금지라 못박음. 그런데 W6 웨이브 지시는 페이즈1~3(이름 치환)을
  당장 실행하라 요구 — 이름이 없으면 실행 불가.
- **나라면 근거:** PLAN이 이미 `argus-decision-mcp`를 1순위로 강력 권고하고(§채택A) 근거를
  실측으로 못박음: (a) 실측 사용가능 E404, (b) 무스코프라 조직생성/`--access` 실수 함정 없음,
  (c) `argus` 단독은 디렉토리에서 이미 경합(ironclawdevs27/argus) → 검색 변별 유리,
  (d) verdict/판정 암시 이름은 Zero-Judgment 스파인 위반이라 금지. 창업자 과거 패턴(비개발자,
  함정 회피 우선)과 정합. 되돌리기 비용이 극히 낮음(한 단어 치환).
- **내린 판단:** `argus-decision-mcp`로 코드 전체에 박음(package.json name/bin/mcpName,
  server.ts, README, server.json, PUBLISH.md). 단 npm publish/login·mcp-publisher·데모녹화·
  awesome PR = 비가역 외부행위라 **파일 작성까지만**, 실행은 창업자 버튼(PLAN §6).
- **되돌리는 법:** 창업자가 다른 이름을 말하면 전 파일에서 `argus-decision-mcp` → 새 이름
  일괄 치환(sed 한 줄). 발사 전이면 무비용 override.

### 2. tsconfig exclude 경로가 PLAN과 실제 디스크가 어긋남
- **애매한 점:** PLAN 1.9는 exclude에 `src/lib/test-helpers.ts`를 적었으나, 실제 파일은
  `src/test-helpers.ts`(lib 하위 아님)에 있음.
- **나라면 근거:** 목적은 "dist에서 테스트 헬퍼 제거". PLAN의 경로는 오기이고 실제 경로가 정본.
  test-helpers는 `__tests__/*` 테스트에서만 import됨(grep 확인) → 제외 안전.
- **내린 판단:** exclude를 실제 경로 `src/test-helpers.ts`로 씀(+`src/**/__tests__/**`,
  `src/**/*.test.ts`). 빌드 후 `find dist -name "*.test.js" -o -name "*test-helpers*"` = 0건 확인.
- **되돌리는 법:** exclude 배열 원복(테스트파일 dist 재유입 감수).

### 3. 사용자향 grep에 남은 `argus-mcp`는 전부 의도된 잔존(디렉토리 경로 or 회피설명)
- **애매한 점:** 경계검증 "사용자향에 옛이름 0건" 규칙 vs PUBLISH.md/package.json/server.json에
  남은 `argus-mcp` 문자열.
- **나라면 근거:** PLAN §3.1이 "설치명령·매니페스트는 필수 치환, 그 외는 선택"으로 구분. 남은 건
  두 종류뿐: (a) PUBLISH.md가 "`argus-mcp`는 타인 소유라 못 쓴다"고 **설명하는 문장**(치환하면
  문서가 뜻을 잃음), (b) repo 서브폴더 **경로** `argus-mcp/`(package.json directory,
  server.json subfolder, PUBLISH cd 경로 — 폴더명이 실제로 그러함). 설치명령·npm identifier·
  mcpName·server name은 전부 `argus-decision-mcp`로 치환 확인됨.
- **내린 판단:** 잔존 유지. 침해 대상(install command / manifest identifier)은 0건임을 별도 grep으로
  확증(README 0건, package.json name/bin/mcpName·server.json name/identifier 전부 신이름).
- **되돌리는 법:** 폴더를 실제로 리네임하면 경로 잔존도 사라지나, 이는 웨이브 밖(대규모 이동).

### 4. package-lock.json name/bin 동기화
- **애매한 점:** 공유 등록부 append-only 규칙 밖의 파일이나, package.json name 변경 시 lockfile
  루트 name/bin이 stale → 창업자 런북의 `npm ci`가 mismatch로 실패할 위험.
- **나라면 근거:** lockfile은 자동생성 산출물(공유 등록부 4종에 해당 없음). `npm install
  --package-lock-only`로 name/bin만 동기(의존성 churn 0 — diff 5줄 확인). 발사 위생의 일부.
- **내린 판단:** lockfile 재생성. diff는 정확히 name×2 + bin키 1 = 5줄, 의존성 무변경.
- **되돌리는 법:** git checkout package-lock.json(발사 시 npm ci 실패 감수).

## W7 — 최종 검증

### 재량 1: FleetChart 가 retro 계약을 배로 그리는 것 — 스코프 밖으로 판단
- **무엇이 애매:** W1/bet3의 회고-격리 불변식은 "retro 를 모든 record 표면에서
  격리"인데, W4의 FleetChart(축적의 얼굴·bet1)는 `contractSealed` 만 게이트하고
  `origin === 'retro'` 필터가 없어 회고 연습 봉인도 실항해와 동일한 배로 해도에
  올라온다. 이걸 W7에서 고쳐야 하는가?
- **나라면 근거:** (a) 회고-격리 불변식의 정본 범위는 `summarizeRecord`(자차표 **카운트**)
  이고 — bet3 PLAN 43/149줄이 명시 — FleetChart 는 카운트/점수/평결을 0 표시하고
  배를 위치로만 그림(카운트 표면 아님). (b) bet1 PLAN B1~B8 스펙은 "프로젝트별
  VoyageShip"에 `contractSealed` 게이트만 규정, retro 필터를 요구하지 않음. (c) W7
  명령은 "신규 구현 금지, 최종 검증만" — FleetChart 에 retro 필터를 새로 넣는 건
  검증이 아니라 신규 구현이고 bet1 스펙에도 없는 확장. (d) 다만 FleetChart 는
  "축적의 얼굴"이라 회고 배가 실항해처럼 보이는 건 불변식 **정신**과는 마찰이 있음 —
  숨기지 않고 기록해 창업자/후속 웨이브 판단에 넘김.
- **내린 판단:** W7에서 **구현하지 않음**(검증 웨이브 스코프 밖 + 스펙 미요구). 대신
  이 마찰을 명시 기록. 후속 조치 후보 = FleetChart 배 loop(line 133 `!contractSealed`
  continue 옆)에 `|| p.decision_contract?.origin === 'retro'` 를 추가해 회고 배를
  해도에서 빼거나, RetroBadge 를 배 툴팁에 붙이는 것. 창업자/bet 소유 웨이브 결정 사항.
- **되돌리는 법:** 위 한 줄을 추가(제외) 또는 미추가(현행 유지) — 어느 쪽도 1줄.

### 재량 2: design-register 가드 실패 = 목록추가 vs 토큰교체
- **무엇이 애매:** FleetChart/Logbook 이 `--bp-ink*` material 토큰을 써서
  design-register-contract 테스트가 실패. (a) 두 파일을 앱 토큰(`--text-*`/`--surface`)으로
  교체할지 (b) MATERIAL_SANCTIONED 에 등재할지.
- **나라면 근거:** 테스트 파일 자체가 정규 경로를 문서화함(32~43줄): "MATERIAL 토큰은
  landing 밖에서도 sanctioned 목록 파일엔 허용 — 새 consumer 는 의도적 행위, 사유와
  함께 추가하거나 앱 토큰 사용". 두 컴포넌트는 이미 sanctioned 인 project 페이지 위
  ChartPlate 레지스터에 얹히는 해도-언어라 material 차용이 **의도**(W4/W5 로그가 --bp-*
  의도 사용 명시). ceremony(gold/seal) 는 0(같은 테스트의 ceremony 단언 통과). 토큰
  교체는 W4/W5 의 디자인 의도를 사후 뒤집는 신규 구현이고, 등재는 가드 갱신(정규 경로).
- **내린 판단:** MATERIAL_SANCTIONED 에 두 파일 + 사유 주석 등재. 가드 목록 갱신이지
  프로덕션 코드 변경 아님.
- **되돌리는 법:** 목록에서 두 줄 제거(그러면 테스트가 다시 offender 로 검출 → 토큰
  교체 강제).
