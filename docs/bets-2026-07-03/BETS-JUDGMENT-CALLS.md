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
