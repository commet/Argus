# Fable5 판단 시스템 철학 기반 구현 보고서

Date: 2026-07-26
Status: F0–F4 implemented and released on 2026-07-27 KST.

## 1. 구현 정본과 제품 결론

구현 지시는 다음 두 문서를 정본으로 삼았다.

- `Argus-codex-docs/docs/MASTER-FABLE5-DIRECTION-AND-IMPLEMENTATION-2026-07-26.md`
- `Argus-codex-docs/docs/PHILOSOPHY-FOUNDATIONS-EASY-2026-07-26.md`

앞선 설계와 충돌하는 부분은 마스터 문서를 우선했다. 이 승인 사실과 F0–F4
exit 증거는 `docs/ARGUS-BLUEPRINT.md` §9.10에 등록했다.

구현의 결론은 세 문장이다.

1. Argus는 사람의 판단력을 채점하지 않는다.
2. 사용자가 남긴 문장을 현실에서 다시 확인할 수 있는 작은 실험으로 만든다.
3. AI의 제안, 사용자의 채택, 현실의 관찰을 섞지 않고 두 시점의 원문을 보존한다.

## 2. 사용자가 실제로 겪는 새 흐름

### 봉인

사용자는 자기 문장을 남기고, Argus는 그 문장이 다음 중 무엇인지 도출한다.

- 어떤 일이 일어날지 확인하는 문장
- 내가 무엇을 하겠다는 문장
- 지금 유지할 기준을 밝히는 문장
- 나중 확인 없이 그저 남겨 두는 기록

화면에는 내부 이름인 prediction / commitment / declaration / witness를 그대로
내보내지 않는다. 사용자는 자동 도출을 바꿀 수 있고, 바꾼 사실은 과거 값을
덮지 않고 정정 이력으로 남는다.

AI가 먼저 쓴 문장은 제안일 뿐이다. 사용자가 명시적으로 채택해야만 정본이 되며,
그때도 `AI 제안 → 사용자가 그대로/고쳐 채택` 족보가 남는다. 단순 기록을 고르면
날짜, 알림, 재개봉 제안이 생기지 않는다.

### 귀환

귀환은 날짜 알림 하나가 아니다. 사용자는 다음을 함께 둘 수 있다.

- 다시 볼 사건: 예) 최종 서면 제안서가 도착함
- 사건을 감지하지 못했을 때의 fallback 날짜

플러그인은 대화에서 그 사건의 표현이 등장하면 한 세션에 한 번만 정산을
제안한다. 자동으로 결과를 기록하지 않고, 사용자의 답이 필요하면 그 자리에서
정직하게 멈춘다. 단순 기록은 이 감지 대상에서 제외된다.

### 정산

정산 화면은 선택지보다 먼저 처음 봉인한 문장을 보여준다. 이후 사용자가 문장을
수정했으면 첫 봉인문과 현재 문장을 나란히 구분한다. 종류별로 맞는 최대 다섯
선택지만 보여 주며, 확인할 수 없음과 질문 자체가 더는 중요하지 않음도 정상
응답으로 받는다.

그 뒤 “그때의 기준을 지금도 유지하는가”를 한 번만 더 묻는다. 저장되는 것은
하나의 적중/실패 verdict가 아니라 다음 세 축이다.

- 현실에서 실제로 확인된 것
- 지금의 약속·기준이 유지/수정/철회되었는지
- 처음 질문이 여전히 유효/좁아짐/재구성/무의미/판정 불가인지

과거 봉인문은 바뀌지 않는다. 사용자가 최종 문장이나 종류를 나중에 고치면
수정 이벤트가 덧붙고, 처음 발화와 첫 봉인문은 계속 열람할 수 있다.

### 기억 먼저 실험

사용자가 원할 때만 원문을 보기 전 당시 기준을 기억해 볼 수 있다. 입력한 메모는
기본적으로 브라우저 상태에만 머물며 닫으면 사라진다. 사용자가 “이 메모도 이번
귀환 기록에 남기기”를 직접 체크한 경우에만 해당 정산에 저장한다.

## 3. 보존하는 데이터 D1–D12

| ID | 보존 내용 | 구현 |
|---|---|---|
| D1 | 사용자 문장 원문 | 봉인 statement와 웹 predicate 원문 |
| D2 | 문장 종류와 도출 경로 | `kind`, `kind_evidence` |
| D3 | 작성 주체·권한 원천 | semantic authority / predicate attribution |
| D4 | AI 제안 채택 족보 | `adoption_lineage`, proposal ref + adoption mode |
| D5 | 재검토 조건 원문 | `review_condition` |
| D6 | 사건 기반 귀환 핸들 | `return_event` / `event_trigger` |
| D7 | 날짜 fallback | `check_in_at` / `fallback_review_at` |
| D8 | 구조화 전 첫 발화 | `origin_utterance` |
| D9 | 봉인 뒤 정정·개정 이력 | kind corrections / statement revisions |
| D10 | 조건 답변 여부 | answered / skipped / not_asked |
| D11 | 현실 관찰 출처 | user_report / system_receipt / ai_analysis |
| D12 | 그때와 지금의 기준 원문 | 첫 봉인문 + 귀환의 present standard |

합산 점수, 적중률, 승률, 사람에 대한 능력·성향 평결은 신규 저장하지 않는다.
과거 호환 데이터는 삭제·내보내기를 위해 읽을 수 있지만 제품 투영과 프롬프트에서
격리한다.

## 4. 표면별 구현

### 웹앱

- `SealMoment`: 네 종류 도출/수정, 원 발화, 검토 조건 상태, 사건+fallback 저장.
- `FoundationDecisionRecordCard`: 최종 문장과 종류의 사후 수정, append-only 이력,
  AI 제안 채택 족보, witness 전환 시 귀환 제거.
- `FoundationSettlementModal`: 원문-먼저, 종류별 선택지, moot/판정 불가,
  현재 기준 한 질문, 기억 먼저 opt-in.
- `RecordStrip`, `Logbook`, Telegram record: 기록 수와 귀환 수만 표시.
- `JudgmentGraph`: held/broke/mixed 누적을 제거하고 중립 `revisited` 수만 표시.
- `decision-quality`와 calibration gate: 신규 저장을 제거하고 정확도 표면을 영구 폐쇄.

### MCP

- semantic v3 event 모델을 wire rename 없이 정본 reducer로 사용.
- `argus_record`를 환경 플래그 뒤 파일럿이 아닌 정식 공개 도구로 전환.
- seal / kind correction / statement revision / observation / defer / resolve / close / read.
- 명시적 human authorization 없이는 AI proposal을 봉인할 수 없음.
- witness는 return contract와 due projection을 만들지 않음.
- 현실·약속·질문 유효성 세 축을 분리해 저장.
- legacy `track_record` wire는 중립 귀환 inventory로만 투영.
- wake/continuity의 결과별 누적을 제거.

### Claude/Codex 플러그인

- `record`: 네 종류, 도출 근거, 원 발화, 조건 상태, 사건+fallback, 채택 족보.
- `correct-kind`, `revise`: append-only 사후 수정.
- `journal`: 시간순 기록만, 결과별 합계 없음.
- `resolve`: 세 축과 현재 기준을 기록하며 신규 foundation 기록에는 legacy
  `--outcome` 입력을 거부.
- `sense-signal`: 대화 사건 감지, 레코드별·세션별 한 번 제안, 자동 정산 없음,
  witness 침묵.
- clarify/review는 AI의 early lean을 조용히 사용자 판단으로 올리지 않음.

## 5. 데이터베이스와 호환성

마이그레이션:
`supabase/migrations/20260726120000_decision_foundation_contract.sql`

기존 `projects.decision_contract jsonb`를 대이주하지 않는다. 대신 foundation
필드가 있는 신규 JSON에만 다음 DB constraint를 적용한다.

- 네 종류 외 값 거부
- kind evidence / origin utterance / review status 형식 확인
- score / accuracy_score / hit_rate / win_rate / overall_dq 키 거부
- witness의 날짜·주기·checkpoint·사건 귀환 거부

constraint는 `NOT VALID`로 추가해 기존 레코드를 깨지 않는다. 새 테이블·컬럼·
localStorage 키를 만들지 않았으므로 TABLE_COLUMNS, persistence key, user-data
table, erasure 목록의 신규 항목은 없다. 중첩 데이터는 기존 project 삭제 경로로
함께 삭제된다.

## 6. 안전 불변식과 기계 가드

- AI proposal only → judgment 0
- human authorization seal → authority receipt 필수
- kind 정정·문장 수정 → 이전 이벤트 byte 보존
- witness → date/reminder/checkpoint/event/due 0
- foundation DB JSON → score-shaped key 거부
- 처음 봉인한 문장 → 최신 수정문보다 먼저 표시
- 기억 메모 → opt-in 없이는 저장 필드 0
- 세 표면 kind derivation → 동일 한국어/영어 fixture
- Blueprint F0–F4 `[x]` 수 → 실제 증거 파일 수와 동일

## 7. 대표 수용 사례

1. “이 오퍼를 받아도 될지 모르겠어”를 첫 발화 그대로 저장한다.
2. 사용자가 “역할과 의사결정권이 문서에 남을 때만 수락한다”로 고쳐 채택한다.
3. AI 제안 원본, 사용자 수정 채택, 최종 문장을 분리해 남긴다.
4. “최종 서면 오퍼 도착” 사건과 fallback 날짜를 봉인한다.
5. 대화에서 “오퍼 받았어”가 나오면 정산을 한 번 제안한다.
6. 처음 봉인문을 먼저 보여 주고 사용자가 현실의 답과 현재 기준을 남긴다.
7. 현실 not_met, 기준 same, 질문 narrowed를 서로 합치지 않고 보존한다.
8. 재협상 후 새 문장을 successor로 봉인해도 과거 기록은 바뀌지 않는다.

이 시나리오는 `data/contracts/judgment-foundation-conformance.json`과 웹/MCP/
플러그인 테스트의 공통 기준이다.

## 8. 배포·관찰·되돌리기

배포 순서는 DB constraint 적용 → 웹 배포 → MCP/플러그인 패키지 검증이다.
constraint가 `NOT VALID`라 기존 행을 소급 차단하지 않으며, 웹의 새 JSON 쓰기가
잘못되면 DB에서 즉시 실패한다.

배포 후 관찰할 것은 점수가 아니다.

- kind 자동 도출을 사용자가 얼마나 자주 고치는가
- witness/declaration도 실제로 봉인되는가
- 사건 기반 대화 귀환이 날짜 알림보다 먼저 작동하는가
- 검토 조건을 건너뛰는 비율이 과도하지 않은가
- moot/판정 불가가 현실적인 탈출구로 사용되는가

되돌릴 때는 UI를 이전 버전으로 되돌릴 수 있다. DB constraint 제거는 별도
마이그레이션으로만 수행하며, 이미 기록된 foundation JSON과 append-only 이벤트를
삭제하거나 과거 문장으로 덮어쓰지 않는다.

## 9. PR 리트머스 자답

1. **오스틴:** prediction / commitment / declaration / witness별로 허용된 질문만
   사용한다. 사람에게 맞음·틀림·능력 점수를 붙이지 않는다.
2. **브랜덤:** human-authored, machine-proposed + human-adopted,
   external-observation의 권한 원천과 채택 족보를 보존한다.
3. **엘스터:** 결과를 본 뒤에도 과거 봉인 이벤트를 수정하지 않는다. 모든
   정정·문장 개정·귀환은 새 이벤트나 배열 항목으로 덧붙인다.
4. **듀이·포퍼:** 결론은 현실 관찰 또는 사용자의 현재 답에서만 온다. AI 분석은
   출처가 표시된 제안·관찰이며 현실의 답처럼 승격되지 않는다.

## 10. 출시 검증과 버전

이번 시공은 세 표면의 같은 의미를 다음 버전으로 함께 배포한다.

- 웹앱: 이 커밋의 프로덕션 배포
- MCP: `argus-decision-mcp@1.13.0`
- Claude/Codex 플러그인: `2.19.0`
- 플러그인의 MCP 설치 핀: `argus-decision-mcp@1.13.0`

출시 전 검증 결과:

- 웹 프로덕션 빌드: 85개 라우트 생성 성공
- 웹 회귀 시험: 317개 파일, 3,735개 시험 통과, 10개 명시적 skip
- MCP 회귀 시험: 113개 파일, 1,100개 시험 통과
- 플러그인: ledger 51개, sense 21개, 공통 kind fixture 1개, signal 64개 통과
- 정책 게이트: gate 29개, static eval 16개 통과
- 패키지: MCP build, typecheck, registry metadata, `npm pack --dry-run` 통과
- 보안: 웹과 MCP의 production dependency 취약점 0개. 웹 개발 의존성에는
  ESLint 10으로의 강제 major upgrade 없이는 닫히지 않는 high 9개가 남아 있으며
  production bundle에는 포함되지 않는다. MCP 전체 dependency 취약점은 0개다.
- 브라우저 QA: 한국어·영어, 데스크톱·모바일 첫 화면에서 핵심 문장과 CTA가
  viewport 안에 유지됨을 확인했다. 입력한 판단이 베이스라인과 작업공간까지 이어지고,
  가이드의 봉인→귀환→원문 우선→현재 답 흐름도 실제 렌더링으로 확인했다.

Windows에서 전수 시험의 worker fork가 종료 시 간헐적으로 자원 고갈을 일으키는
문제도 제품 실패와 구분해 방치하지 않았다. 웹 전수 시험은 단일 worker, MCP는 최대
2개 worker로 고정해 assertion뿐 아니라 시험 프로세스 종료까지 반복 가능하게 만들었다.

## 11. 실제 배포 기록

- 구현 PR: [#296](https://github.com/commet/Argus/pull/296)
- main merge commit: `9e4b682d205b8317ecb635d3cd8a5077d2a6c4c5`
- main CI: 설치 tarball E2E를 포함한 모든 단계 통과
- 운영 DB: `_argus_semantic_idem_fingerprint(jsonb)` 갱신과
  `projects_decision_contract_foundation_shape` constraint 적용 완료
- DB 확인: constraint는 의도대로 `convalidated = false`라서 기존 행은 소급
  차단하지 않고 신규 foundation write만 검사한다.
- 웹 production: Vercel이 merge commit 배포를 완료했고
  `https://argus.voyage/ko`, `/en`, `/ko/guide`, `/en/guide`가 모두 HTTP 200으로
  응답했다.
- npm: `argus-decision-mcp@1.13.0`이 `latest`로 공개됐고 GitHub Actions
  provenance가 붙었다.
- MCP Registry: `io.github.commet/argus-decision-mcp` version `1.13.0` 등록 완료
- 플러그인: main marketplace의 `2.19.0`과 정확한 MCP `1.13.0` 핀이 함께 배포됐다.

운영 DB의 과거 migration history와 저장소의 오래된 로컬 파일 목록이 이미 어긋나
표준 `supabase db push`는 신규 migration 전에 차단됐다. 이 출시에서는 과거 이력을
임의 repair하거나 local-only migration을 일괄 적용하지 않았다. 전체 신규 SQL을 먼저
운영 연결의 transaction 안에서 실행 후 rollback해 검증하고, 같은 idempotent SQL 한
개만 Management API로 적용한 뒤 함수와 constraint를 각각 조회했다. 이 history drift
자체는 별도 복구 작업으로 다뤄야 하며, 이번 판단 기록 데이터의 의미를 바꾸지는 않는다.
