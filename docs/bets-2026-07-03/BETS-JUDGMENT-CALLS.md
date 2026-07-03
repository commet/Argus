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
