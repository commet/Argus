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
통과 · 한국어 문자열 mojibake 없음(grep 확인). 마이그레이션 0. 커밋 해시는 push 후 이 줄
아래에 기재.
