# ARGUS KEYSTONE — 판단하지 않는 친구의 설계

Date: 2026-07-07
Author: Claude (claude-fable-5)
Status: **정본 (canonical)** — MCP 공개 사이클의 판단 기준 문서
Inputs: 창업자 브리프(`FABLE5-ARGUS-WEBAPP-MCP-DIAGNOSTIC-BRIEF-2026-07-07.md`, 업로드본) + 코드 실검증 + `docs/FABLE5-QUANTUM-UPGRADE-PROMPT-AND-PLAN-2026-07-07.md`(이하 "QUANTUM 문서")
Relationship: QUANTUM 문서를 **폐기하지 않고 재조준한다.** 그 문서의 진단(뺑뺑이의 뿌리)과 Phase들은 유효하다. 이 문서는 브리프의 재프레임 — **이번 공개는 MCP이고 웹앱은 귀환 루프를 완성하는 지지 표면** — 을 받아들여, 우선순위를 "공개 전 반드시"와 "공개 후"로 다시 자르고, 브리프가 의심한 지점들을 코드로 실증한 결과를 더한다. 실행자는 이 문서를 먼저 읽고, QUANTUM 문서를 §8의 매핑표에 따라 참조하라.

이 문서에 구현 코드는 없다. 진단 · 판정 · 설계 · 실행계획뿐이다. 모든 발견은
파일:라인으로 앵커했고, 이번 세션에서 직접 읽어 확인한 것만 "확인됨"으로 표기했다.

---

## §1. 가장 강한 테제

**Argus의 심장은 이미 구조로 강제된다. 남은 공개 리스크는 심장이 아니라 혈관에 있다.**

verdict 도구의 부재, `NO_PRIOR_SEAL` 하드에러, 닫힌 `NEXT_ACTIONS` enum, 드리프트
가드 — 심장(spine)은 검증했고, 진짜다 (`argus-mcp/src/lib/spine.ts` 전문 확인).
그러나 판단이 **표면을 건너는 순간** — 터미널→계정→이메일→귀환 — 세 가지 방식으로
약속이 샌다: ① 건너면서 **정체성이 오염된다** (MCP 판단이 리뷰 아티팩트의 옷을
입고, 지어낸 `stakes: 'medium'`과 강제 한국어를 달고 계정에 도착한다), ② 건너다
**조용히 죽는다** (토큰이 만료되면 봉인은 "성공"하는데 미러는 무언으로 끊긴다),
③ **잘못된 문으로 안내된다** (web-sealed 판단에 `argus_settle`을 제안해 첫
5분에 에러를 보게 만든다). 셋 다 심장이 아니라 배관의 결함이고, 셋 다 Argus
자신의 LLM-glue 불변식("끊긴 와이어는 시끄럽게, 아니면 정직하게")이 예언한
바로 그 부류다. **공개 전에 고칠 것은 기능이 아니라 이 세 혈관이다.**

## §2. "도구이자 친구"의 구조적 정의 — 이 제품의 진짜 사양서

창업자의 바람은 "Argus가 진짜 좋은 도구이자 친구가 되는 것"이다. 이것은 감상이
아니라 **사양으로 번역 가능한 문장**이고, 번역하는 순간 남은 모든 결함이 한 줄에
꿰인다.

> **도구는 부르면 온다. 친구는 약속한 날에 온다.**

"판단하지 않음"은 친구의 필요조건일 뿐 충분조건이 아니다. 판단하지 않는데
돌아오지도 않으면 그것은 친구가 아니라 금고다. 47 opened / 0 settled의 절벽,
local-only 귀환 문제, silent mirror death — 전부 "약속한 날에 오는 능력"의
결함으로 환원된다. 친구의 자격을 다섯 조항으로 명문화한다. **이후 Argus의 모든
표면은 이 다섯 조항으로 심사한다** (Zero-Judgment Gate가 "판단하는가"를 묻는
게이트라면, 이것은 "친구인가"를 묻는 게이트다):

| # | 조항 | 구조적 의미 | 현재 상태 |
|---|---|---|---|
| 우정 1 | **네가 한 말을 그대로 기억한다** | append-only ledger, 정직한 authorship | ✅ 강함 (ledger-replay, `authored` 태그) |
| 우정 2 | **약속한 날에, 먼저, 돌아온다** | check-by → cron/email/check_in → 귀환 화면 | ⚠️ 절반 (배관은 있으나 local-only는 못 돌아오고, 딥링크 미검증) |
| 우정 3 | **너를 평가하지 않는다** | no-verdict 구조 강제 | ✅ MCP 내부 강함 / ⚠️ 웹 구세대 표면(vitality tier) 잔존 |
| 우정 4 | **네 언어로 말한다** | locale brain 일원화 | ⚠️ MCP surfaces는 됨 / 브리지가 전 사용자에게 한국어 강제 주입 |
| 우정 5 | **연결이 끊기면 끊겼다고 말한다** | 미러 실패의 정직한 표면화 | ❌ 데이터 필드에만 속삭임 (`account_sync_reason`) — 사용자는 모른다 |

우정 5가 특히 중요하다. 친구가 문자를 씹는 것과, 문자가 안 갔는데 간 줄 아는
것은 다르다. 후자가 신뢰를 죽인다. 지금 Argus는 후자다 (§4 F3).

## §3. 최근 해결 흐름에 대한 판정 — 근본인가, 완화인가, 새 복잡성인가

브리프의 "풀었다고 보는 것들"을 코드로 대조한 판정. (브리프 지시대로 그대로
믿지 않고 검증했다.)

| 해결 주장 | 판정 | 근거 |
|---|---|---|
| verdict 없는 구조 (spine.ts + drift test) | **근본 해결.** 이 제품에서 가장 잘 만든 것 | `NEXT_ACTIONS` 닫힌 enum, `FORBIDDEN_VERDICT_VERBS`, `FORBIDDEN_FORK_KEYS`, `aiVerdict: null` 리터럴까지 — 산문이 아니라 타입이 막는다. 서버 `instructions`도 spine.ts에서만 렌더 |
| `argus_sync`의 `local_id`/`settle_path`/`settled_in_account` | **근본에 근접한 완화, 단 마지막 한 뼘이 빠짐** | 분기 설계와 auto-settle 거부(사용자만이 원장을 닫는다, sync.ts:67-72 주석)는 훌륭하다. 그러나 next_actions가 이 분기를 모른다 (§4 F2) — 구조가 90% 왔는데 마지막 안내판이 옛날 것 |
| web bridge → `review_receipts` 미러 | **작동하는 완화이자 새 복잡성의 시작.** 브리프의 의심이 정확했다 | §4 F1 — 미러가 필드를 지어낸다. "빠르고 실용적" 판단 자체는 옳았고, 테이블 신설 없이 고칠 수 있다 (§6) |
| account deletion/export SSOT (`USER_DATA_TABLES`) | **근본 해결** | `user-data-tables.ts:21,39`에 decision_items·review_receipts 포함 확인. erasure-coverage 테스트 존재 |
| 13개 도구 + resources/prompts + Zod→JSON Schema | **성숙 확인.** "6개 초안" 전제는 낡았다 | `tools/index.ts` 13개 등록, server.ts에 3종 핸들러, top-level title 매핑(컴플라이언스 감사 F3 RESOLVED) 확인 |
| typecheck/test/build 통과 | **기계 검증일 뿐이라는 브리프의 유보가 정확** | 브리지 route.test.ts 8건, push-account.test.ts, loop.test.ts(NO_PRIOR_SEAL) 존재 — 그러나 **표면을 건너는 한 줄짜리 여정 테스트는 없다** (§5 BS-5) |
| 인코딩 mojibake 의심 | **기우.** 파일은 전부 정상 UTF-8 | `file` 검사: README.ko.md, i18n/ko.ts, argus-mcp/README.md 모두 "UTF-8 text". PowerShell 터미널 렌더링 문제(chcp)였을 것. **단, 진짜 voice 문제는 따로 있다** (§4 F1의 강제 한국어) |

종합 판정: **최근 사이클은 증상 치료가 아니었다. 방향도 깊이도 옳았다.** 다만
전부 "표면 하나 안에서의 올바름"이었고, 표면 **사이**의 올바름은 아직 아무도
검증하지 않았다. 그게 공개 전 마지막 일이다.

---

## §4. Top Findings — 공개를 좌우하는 순서로

각 항목: 심각도 · 표면 · 근거 · 메커니즘 · 가장 싼 반증 테스트 · 해결 방향.
**전부 이번 세션에서 코드를 직접 읽어 확인했다.**

### F1 — 브리지가 판단 영수증에 가짜 값을 지어 넣고, 전 세계 사용자에게 한국어를 강제한다
- **심각도: critical (공개 전 필수)** · 표면: web bridge
- 근거: `src/app/api/mcp/seal/route.ts:57-99` (`buildReceipt`)
- 메커니즘: MCP 판단이 계정에 도착할 때 리뷰 아티팩트 스키마(`JudgmentReceipt`)에
  욱여넣어지면서 **존재하지 않는 사실이 생성된다**: `root_mode: 'review'`(리뷰가
  아니다), `profile.stakes: 'medium'`(아무도 stakes를 medium이라 한 적 없다),
  `source_confidence: 0.3`, `reviewability.score: 0`(0점이라는 *점수*가 생긴다 —
  이 값을 언젠가 어떤 UI가 렌더하는 순간 "당신의 판단: 0점"이 된다. 스파인
  위반의 시한폭탄). 그리고 `reasons: ['터미널(MCP)에서 봉인된 예측입니다.']`,
  `routing.disclosure`, `owner: '사용자'`가 **하드코딩 한국어**다 — 영어 사용자의
  영수증에 한국어가 박힌다. MCP 본체는 locale brain(P1-E1)으로 이 문제를 이미
  풀었는데, 브리지가 그 뇌를 안 쓴다. 이것은 Argus 자신의 제1원리 위반이다:
  *"missing input은 정직하게 이름 붙인다(unfilled), 절대 그럴듯한 대체값으로
  메우지 않는다"* — 브리지가 정확히 그 금지된 일(plausible fabrication)을 하고
  있다.
- 가장 싼 반증: MCP로 봉인 → `review_receipts.data`를 SELECT → `stakes`,
  `score`, `reasons` 필드를 육안 확인. 5분.
- 해결 방향 (§6의 미러 계약): 지어낸 필드를 **명시적 부재**로 바꾼다 —
  `root_mode`(또는 신설 discriminator `kind`)를 `'judgment'`로, 점수·stakes류는
  null/omit로, 한국어 문자열은 브리지 렌더 시점이 아니라 **표시 시점에**
  locale로 (또는 payload에 MCP config locale을 실어 보낸다). 테이블 신설 불요.

### F2 — sync가 web-sealed 판단에도 `argus_settle`을 제안한다: 첫 5분의 보장된 에러
- **심각도: critical (공개 전 필수)** · 표면: MCP
- 근거: `argus-mcp/src/tools/sync.ts:101` — `next_actions: dueCount > 0 ?
  ['argus_settle', 'stop'] : ['stop']`. dueCount는 web-sealed(local_id: null)를
  포함한 **전체** due 개수다.
- 메커니즘: 웹에서 봉인하고 터미널에서 sync한 사용자(가장 자연스러운 듀얼
  사용자)의 due 항목이 전부 web-sealed일 때, host는 `argus_settle`을 제안받고
  → 실행하면 `NO_PRIOR_SEAL` 하드에러. 에러 자체는 스파인의 자랑이지만, **제품이
  스스로 안내한 길 끝의 에러**는 사용자에겐 그냥 고장이다. 브리프의 질문
  ("next_actions가 web-only receipt와 같이 나올 때 host가 잘못 유도하지
  않는가?")에 대한 답은 **"유도한다"**다. description의 산문("web-sealed는
  웹에서")은 방어가 아니다 — Argus 원칙: 산문이 아니라 구조가 막아야 한다.
- 가장 싼 반증: due가 web-sealed 1건뿐인 fixture로 sync 호출 → next_actions에
  argus_settle이 포함되는지 assert. 테스트 1개.
- 해결 방향: next_actions를 **local로 settle 가능한 due가 있을 때만**
  `argus_settle`로. web-sealed만 due면 `stop`(+ surface에 "웹 대시보드에서" 한
  줄). settle 도구 자체에도: `NO_PRIOR_SEAL`이고 해당 id가 계정에 존재하면
  recovery 문구에 "이 판단은 웹에서 봉인됨 — 웹에서 정산하라"를 넣는 것까지
  가면 완결.

### F3 — 조용한 미러 죽음: 토큰이 만료되면 봉인은 "성공"하고 우정 5가 깨진다
- **심각도: high (공개 전 강력 권고)** · 표면: MCP + web bridge
- 근거: `argus-mcp/src/tools/seal.ts:155-156` — 실패 시 `account_synced: false`
  + `account_sync_reason`이 **data 필드에만** 실린다. surface(사람이 읽는 문장)
  에는 없다. `push-account.ts:118` — `http_401`(만료 토큰)도 같은 경로.
  plugin-token expiry는 최근 도입됐다(2026-07-06 커밋) — 만료는 이제 반드시
  일어나는 미래다.
- 메커니즘: 토큰 만료 → 이후 모든 봉인이 로컬엔 성공, 계정 미러는 무언 실패 →
  사용자의 항구와 이메일 귀환이 **그 시점부터 조용히 멈춘다** → check-by 날에
  아무도 안 온다. **"약속한 날에 돌아온다"는 제품의 핵심 약속이, 사용자가
  인지할 수 없는 방식으로 파기된다.** LLM-glue 불변식의 네트워크판: 끊긴
  와이어가 시끄럽지도 정직하지도 않다. (host가 data JSON을 성실히 낭독해 주길
  기대하는 것은 방어가 아니다 — surface가 정본 채널이다.)
- 가장 싼 반증: 만료 토큰 mock으로 seal → 반환된 surface 문자열에 실패 언급이
  있는지 assert. 현재는 없다(확인됨).
- 해결 방향: `synced:false && reason !== 'no_token'`일 때 surface에 정확히 한 줄
  — "봉인은 로컬에 완료. 계정 미러는 실패({reason}) — 귀환 알림이 멈춰 있다.
  argus.voyage/import에서 토큰 갱신." no_token(의도된 local-only)은 지금처럼
  침묵 유지(절제). check_in에도 같은 검사 1회(원장에 mirror-실패 마크가 있으면
  집계 라인에 한 줄) — 단 nudge 아님, 사실 보고만.

### F4 — canonical Judgment object의 부재가 아니라, **미러 계약의 부재**가 문제다
- **심각도: high (설계 결정 — §6에서 해소)** · 표면: 전체
- 근거: MCP ledger(정본, append-only) / `review_receipts`(웹 미러) /
  `projects.decision_contract`(웹 자생 판단) / telegram·email·cron의 파생 행 —
  브리프 의심 #1 그대로.
- 메커니즘: 지금 구조는 사실 "운 좋게 이어 붙인 것"이 아니라 **암묵적으로 이미
  옳은 모델**을 갖고 있다: 판단마다 집(home)이 하나 있고(터미널 봉인 = MCP
  ledger, 웹 봉인 = 웹 store) 나머지는 미러다. sync.ts의 auto-settle 거부가
  그 증거다 — 원장의 주인은 사용자라는 감각이 코드에 있다. 문제는 이 모델이
  **어디에도 선언되어 있지 않아서**, 브리지 같은 새 배관이 미러의 의무(지어내지
  않는다, 출신을 밝힌다, 실패를 알린다)를 모른 채 지어졌다는 것. F1·F3은 별개
  버그가 아니라 **선언되지 않은 계약의 두 증상**이다.
- 해결 방향: §6의 "한 집, N개의 거울" 계약을 명문화하고 세 의무를 테스트로
  고정. `judgment_receipts` 테이블 신설은 **하지 않는다** (§7 Q1).

### F5 — 활성화 절벽의 진짜 위치: seal의 "부탁"이 무겁다
- **심각도: high (공개 직후 최우선 관찰 대상)** · 표면: MCP + webapp
- 근거: 퍼널 47 opened / 0 sealed / 0 settled. `argus_seal`은 predicate +
  pass_condition + fail_condition + check_by를 요구한다. open_decision의
  restraint gate(열 필요조차 없으면 열지 않음)는 확인됨 — 진입은 절제되어 있다.
  절벽은 열린 뒤 봉인 사이에 있다.
- 메커니즘: 사용자에게 "반증 가능한 예측을 문장으로 쓰라"는 요구는 이 제품의
  본질이자 최대 마찰이다. 본질이므로 없앨 수 없고, 없애면 안 된다. 그러나
  **host가 초안을 잡고 사용자가 고치는** 흐름(서버 instructions에 이미 있다:
  "the user corrects what you drafted — their edit is part of the record")이
  실제 host에서 그렇게 굴러가는지는 아무도 본 적 없다.
- 가장 싼 반증: 실호스트(Claude Desktop/Code) 신선 세션 3회 — "이직 고민"류
  결정 하나를 open→seal까지. 몇 턴 걸리는지, host가 초안을 잡는지, 사용자가
  뭘 타이핑해야 하는지 기록. **코드가 아니라 관찰이다. Wave 0의 핵심.**
- 해결 방향(관찰 후): seal 실패/포기 지점에 따라 — open_decision surface의
  코칭 문구 조정이거나, seal의 optional 필드 완화이거나, 아무것도 아닐 수 있다.
  관찰 전 수정 금지 (over-fire).

### F6 — 웹 구세대 표면의 verdict 어휘 잔존: vitality tier가 아직 살아 있다
- **심각도: medium (공개 전 landing 경로만, 나머지는 공개 후)** · 표면: webapp
- 근거: `src/lib/judgment-vitality.ts:534-548` — tier `'alive' | 'coasting' |
  'performing' | 'dead'`, `rigidity_score`, `vitality_score`.
  `RehearseStep.tsx:33`이 lazy-load(확인됨). CLAUDE.md 규칙 2("uncalibrated
  score/tier를 사용자에게 노출 금지 — internal-routing-only or remove")의
  경계선 위에 있다.
- 메커니즘: MCP 공개로 유입된 사용자가 웹앱을 둘러보다 구세대 표면(rehearse/
  synthesize 도구, boss)에서 점수·등급·"improving" 언어를 만나면, README가
  한 약속("The model never graded you")이 **같은 브랜드 안에서** 배신된다.
  브리프 의심 #4 그대로.
- 가장 싼 반증: `grep -rn "tier\|score\|improving" src/components/workspace/
  Rehearse* Synthesize*` + 해당 화면 렌더 확인. i18n 사전 grep(이번 세션 1차
  스캔에서 en.ts:93 "accuracy is improving" 1건 — 이건 페르소나 정확도라
  사용자-평가는 아님. 전수 스캔은 Wave 0).
- 해결 방향: 공개 경로(landing→harbor→return)에서 구세대 표면을 내비게이션
  강등(QUANTUM Phase 1이 이미 이 일을 한다). vitality tier는 렌더 여부를 확인해
  사용자 노출이면 제거, 내부면 주석으로 internal-only 선언 + drift 테스트.

### F7 — check-by의 시간대: "약속한 날"이 어느 시간대의 날인가
- **심각도: medium (공개 전 확인, 수정은 필요시)** · 표면: MCP + cron
- 근거: check_by는 날짜 문자열, due 판정은 `resolve-today.ts` + 웹 cron.
  MCP는 사용자 로컬에서 돌고 cron은 서버(UTC 추정)에서 돈다.
- 메커니즘: KST 사용자의 "7월 28일"이 UTC cron에게는 27일 15:00 이후다. 하루
  이르거나 늦은 귀환 이메일은 사소해 보이지만, **이 제품의 유일한 약속이
  "그 날짜에 돌아온다"이므로** 다른 제품의 같은 버그보다 신뢰 비용이 크다
  (우정 2). 브리프에 없던 항목이다.
- 가장 싼 반증: resolve-today의 타임존 소스 확인 + cron due 쿼리의 날짜 비교
  기준 확인. 데스크 체크 30분.
- 해결 방향: 판정 결과에 따라 — 최소한 "due = check_by 날짜의 로컬 자정 이후"
  규약을 한 곳에 문서화하고 cron이 그 규약을 따르는지 테스트.

---

## §5. Blind Spots — 브리프에도 없는, 못 봤을 가능성이 큰 것 5+

**BS-1. `mcp_` prefix의 기기 간 id 충돌.** `rowId = mcp_${id}`이고 id는 사용자
공간 문자열(`[A-Za-z0-9._-]{1,128}`)이다. 한 계정에 두 대의 기계(회사/집)가
각자 ledger를 갖고 같은 id를 만들면 계정 미러가 **서로를 upsert로 덮어쓴다**
— 다른 결정의 영수증이 소리 없이 바뀐다. 확인: ledger의 id 생성 규칙
(`open-decision.ts`의 id 소스)이 충돌 저항적인지(ULID류인지 슬러그인지) +
`api/mcp/seal`의 upsert 충돌 시맨틱. 슬러그면 Wave 1, ULID면 해당 없음.

**BS-2. 계정 미러의 归属: 토큰이 사람이 아니라 기계를 가리킨다.** ARGUS_TOKEN을
팀원과 공유하거나 잘못된 계정의 토큰을 넣으면, 내 판단이 남의 항구에 꽂힌다.
경고도 확인도 없다. 확인: `argus_config`/init에 "이 토큰은 누구 계정인가"를
보여주는 수단이 있는가 (없다면 sync 첫 호출 surface에 계정 식별자 한 줄이 최소
개선). 판단 데이터는 일기장급 민감도라, 오배송 1건이 제품 신뢰를 끝낸다.

**BS-3. 영수증의 시효 — settle 없이 영원히 sealed인 판단의 무게.** check-by가
지나도 사용자가 안 돌아오면 receipt는 영원히 due다. due 47개가 쌓인 항구는
돌아오고 싶은 곳이 아니라 **밀린 숙제함**이다(우정 2의 그림자: 친구는 빚
독촉을 하지 않는다). 이미 `dismiss` 도구와 침묵 상한 설계가 있지만, **대량
due의 UX**(예: "이 중 이미 마음이 떠난 것들을 한 번에 놓아주기")는 어느 문서에도
없다. 확인: due 20+개 fixture로 check_in/sync/항구 화면이 각각 어떻게 보이는지.
공개 후 첫 달의 실제 상태일 가능성이 높다.

**BS-4. npm 공급망 표면.** 공개 = `npx -y argus-decision-mcp`를 낯선 사람들이
실행한다는 뜻. (a) npm 계정 2FA/publish 토큰 관리, (b) `npm pack` 산출물에
불필요 파일이 없는지(files 필드), (c) install 스크립트 부재 확인, (d) 의존성
락과 provenance(`npm publish --provenance`) — 이 리포는 커밋 서명 문서
(COMMIT-SIGNING.md)까지 있는 팀이니 여기까지 갖추면 일관된다. 확인:
`argus-mcp/package.json` files/scripts 필드 + npm 계정 설정. 코드 결함이
아니라 운영 결함이 공개 제품을 죽이는 고전 경로.

**BS-5. 표면을 건너는 단 하나의 여정 테스트가 없다.** 브리프 의심 #7의 확정판.
존재하는 테스트는 전부 한 표면 안이다(route.test.ts 8건 = 브리지 안,
loop.test.ts = MCP 안, push-account.test.ts = 클라이언트 안). **"터미널에서
봉인 → 계정 행 → due 계산 → cron 선택 → sync 왕복 → 로컬 settle"을 한 파일에서
잇는 테스트가 0건이다.** QUANTUM Phase 2.4가 이미 이걸 주문했고, 이 문서에서
Wave 0의 첫 항목으로 승격한다. 이것이 없으면 F1~F3을 고쳐도 재발을 못 막는다.

**BS-6. (보너스) 공개일의 되돌림 계획.** npm은 unpublish가 사실상 안 된다
(72시간/의존성 제약). 첫 주에 F1급 결함이 발견되면 무엇을 하나 — deprecate
메시지? 긴급 patch 버전? README 상단 공지? 1문단이면 되지만 지금 정해야 한다.

---

## §6. 근본 설계 — "한 집, N개의 거울" (canonical Judgment와 미러 계약)

브리프가 물은 "canonical object가 흐린가"에 대한 답: **흐리지 않다. 선언이
안 됐을 뿐이다.** 코드에 이미 있는 암묵 모델을 그대로 명문화하면 된다. 새
객체도, 새 테이블도, lifecycle reducer 신설도 필요 없다 — 과설계 금지 지시를
따른다.

### 6.1 선언

> **모든 판단(Judgment)은 정확히 하나의 집(home)을 갖는다.**
> - 터미널에서 봉인된 판단의 집 = MCP append-only ledger (`.argus/`)
> - 웹에서 봉인된 판단의 집 = 웹 store (`projects.decision_contract` /
>   decision_items)
>
> **집만이 상태를 바꾼다.** seal/settle/amend/dismiss는 집에서만 일어난다.
> (sync.ts가 이미 이 원칙을 지킨다 — auto-settle 거부.)
>
> **나머지 모든 표현은 거울(mirror)이다**: `review_receipts`의 mcp_* 행,
> 이메일, statusline, telegram, 항구 화면, sync 응답. 거울은 세 가지 의무를
> 진다:
> 1. **지어내지 않는다** — 집이 단언하지 않은 필드는 비워 두거나 생략한다.
>    "모름"을 그럴듯한 기본값(medium, 0.3, score 0)으로 메우지 않는다.
> 2. **출신을 밝힌다** — 어느 집의 거울인지(kind/source), 어떤 경로로 왔는지
>    (provenance)를 기계가 읽을 수 있게 남긴다.
> 3. **깨지면 깨졌다고 말한다** — 거울 갱신 실패는 집의 성공과 별개로,
>    사람이 읽는 채널(surface)에 1회 표면화된다.

이 세 의무가 F1(의무 1 위반), F4(계약 미선언), F3(의무 3 위반)을 한 번에
설명하고 한 번에 고친다. CLAUDE.md에 이 선언을 "Principle: One Home, N
Mirrors"로 추가하는 것이 Wave 1의 문서 작업이다 (QUANTUM Phase 5의 Reality
Gate와 함께).

### 6.2 `review_receipts` 처분 (브리프 자유판단 문항 1에 대한 답)

**공개 전 테이블 신설은 하지 않는다.** 근거: (a) 이 리포의 스키마 사고사(史)는
전부 "새 테이블/컬럼과 주변 기계(erasure, export, sync, drift test)의 미동기"
에서 왔다 — 공개 직전이 가장 위험한 타이밍이다. (b) 문제는 테이블이 아니라
지어낸 값이다. 처방:
- `data` jsonb 안에 discriminator 1개(`kind: 'judgment'`) + 지어낸 필드 제거
  (마이그레이션 불요 — lean_after 선례).
- 웹 UI에서 receipt를 렌더하는 모든 곳이 `kind==='judgment'`일 때 리뷰 전용
  필드(reviewability 등)를 **읽지 않는지** 소비 계약 테스트로 고정.
- 공개 후, 리뷰와 판단의 시맨틱이 실사용에서 더 갈라지면 그때 분리를 재론한다
  — 그 결정은 현실 데이터가 내린다(Reality Gate).

## §7. 브리프의 자유판단 6문항 — 독립 판정

| # | 질문 | 판정 |
|---|---|---|
| Q1 | review_receipts 계속? 별도 judgment_receipts? | **계속 + 미러 계약 적용** (§6.2). 신설은 공개 후 재론 |
| Q2 | 도구 13개 적절? | **13개 유지, 표면은 5개로 말한다.** 도구 제거는 공개 직전 churn 위험 대비 이득이 없다. 대신 README·init이 core loop를 5개(open→seal→check_in→settle→sync)로 소개하고 premises/recheck/recall/amend/dismiss/config는 "깊이" 섹션으로. verdict의 부재가 제품이므로 개수는 걱정거리가 아니다 — **첫 인상에서 13개를 다 설명하려는 유혹만 끊으면 된다** |
| Q3 | living premises는 headline인가 depth인가? | **depth다.** headline은 영수증과 "AI VERDICT NONE" 하나로 충분하다. premises는 "영수증의 가장 중요한 줄이 살아있다"는 두 번째 만남의 감동으로 남긴다. 서버 instructions의 "On trivial decisions, skip premises entirely"가 이미 옳은 자세다. `apply_to_matching`류 고급 기능은 문서에서 언급 자체를 뒤로 (기능 제거는 불요) |
| Q4 | local-only 귀환: honest disclosure로 충분? | **불충분하다. 단, 답은 서버가 아니라 파일이다.** 최소 개선 = **seal 시 .ics(캘린더) 파일 생성**: 네트워크 0, 의존성 0(ics는 텍스트 포맷), 프라이버시 보존, 그리고 사용자의 기존 귀환 인프라(자기 캘린더)에 업힌다. "친구가 못 오면 약속을 네 달력에 적어 준다" — 우정 2의 local-only 버전. check_in 습관(세션 시작 시 1회)은 이미 instructions에 있다. calendar export가 브리프가 나열한 4개 옵션(calendar/ritual/host prompt/web onboarding) 중 유일하게 local-only의 프라이버시 약속을 깨지 않으면서 시간을 이기는 옵션이다 |
| Q5 | 웹앱: MCP dashboard로 단순화 vs voyage 방향 유지? | **공개 사이클에서 웹앱의 정체는 "항구"다** — landing / token / due·receipts / 귀환 화면. QUANTUM Phase 1(항구 홈 승격)이 정확히 이 일이며 유지한다. voyage/logbook/fleet은 삭제하지 않되 공개 경로에서 안 보이게(강등). 웹앱을 "MCP를 흐리는 존재"로 만들지 않는 가장 싼 방법은 기능 제거가 아니라 **경로에서 치우는 것**이다 |
| Q6 | Korean/English voice 정책? | **영수증 반경(receipt-adjacent)만 공개 전 일원화, 나머지는 공개 후.** MCP surfaces는 locale brain으로 이미 됐다. 공개 전 필수는 F1의 브리지 한국어 제거와 receipt/sync/error/token-setup 문구의 locale 준수 — 즉 **신뢰가 걸린 문장들만.** 웹 전체 voice 정리는 공개 후 (브리프의 인코딩 걱정은 기우로 판명, §3) |

---

## §8. 실행계획 — Wave 0/1/2/3

QUANTUM 문서 Phase와의 관계 (실행자는 두 문서를 이 표로 잇는다):

| QUANTUM Phase | 이 문서에서의 처분 |
|---|---|
| Phase 0 (계기판 완성) | **Wave 1로 유지** — 퍼널에 mcp 표면 분해 포함 |
| Phase 1 (항구 홈 승격) | **Wave 1로 유지** — "웹앱 = 항구" 판정(§7 Q5)의 실행 |
| Phase 2 (MCP↔웹 브리지) | **Wave 0~1로 승격·확장** — F1·F2·F3 수정이 추가됨 |
| Phase 3 (귀환 30초) | **Wave 1~2 분할** — 이메일 딥링크는 Wave 1, 나머지 Wave 2 |
| Phase 4 (영수증=자산) | **Wave 2 유지** |
| Phase 5 (Reality Gate) | **Wave 1 유지** + §6.1 미러 계약 선언 추가 |

### Wave 0 — 결론을 확정하는 검증 (코드 수정 없음, 1~2일)
모든 항목은 "관찰 기록"이 산출물이다. 수정 금지 — 관찰이 Wave 1의 범위를 정한다.

1. **여정 관찰 3회 (F5):** 실호스트 신선 세션에서 open→seal→(시간 조작)→
   check_in→settle 완주. 턴 수, host의 초안 품질, 사용자 타이핑량, 걸린 시간
   기록. + 브리프 e2e 목록 5개 시나리오(local-only 완주 / token 완주 /
   web-sealed sync 오유도 / settled_in_account 표시 / erasure 포함)를 손으로
   1회씩.
2. **F1 실증 5분:** MCP 봉인 → review_receipts.data SELECT → 지어낸 필드 목록
   확정 (Wave 1의 수정 명세가 된다).
3. **F7 데스크 체크:** resolve-today + cron due 쿼리의 시간대 규약 판정.
4. **F6 렌더 확인:** vitality tier의 사용자 노출 여부 + i18n verdict-어휘 전수
   grep (`score|tier|grade|improving|declining|mastery|잘했|못했|점수|등급`).
5. **BS-1/BS-2/BS-4 확인:** id 생성 규칙, 토큰-계정 식별 수단, npm 패키징
   위생(files 필드, 2FA, provenance).
6. **BS-5 착수:** cross-surface 여정 테스트의 뼈대만 (fixture 설계 — 구현은
   Wave 1).

### Wave 1 — 공개 전 반드시 (3~5일)
겨냥: 첫 사용자의 첫 5분과 첫 귀환이 약속대로 굴러가는 것. 전부 §4·§5에서
근거 확정된 항목이다.

1. **F1 수정:** 브리지 de-fabrication + kind discriminator + 한국어 하드코딩
   제거 (§6.2). 소비 계약 테스트 포함.
2. **F2 수정:** sync next_actions의 local-settleable 분기 + settle의
   web-sealed recovery 문구. 반증 테스트 그대로 회귀 테스트로.
3. **F3 수정:** 미러 실패의 surface 1줄 (no_token 제외). check_in 집계에 1줄.
4. **BS-5 완성:** 표면 횡단 여정 테스트를 CI에 (QUANTUM Phase 2.4 명세 재사용
   — seal→route→review_receipts→useDueCount→cron 쿼리→sync→settle).
5. **QUANTUM Phase 0+1 실행:** 계기판 returned 단계·표면 분해 + 항구 홈 승격
   + `/import` 한 화면화 (MCP 사용자의 토큰 온보딩이 공개 경로의 일부이므로
   Wave 1이다).
6. **이메일 딥링크 (Phase 3의 선두 항목):** check-in 메일 CTA → 해당 결정의
   귀환 화면 1클릭.
7. **문서·계약 선언:** CLAUDE.md에 "One Home, N Mirrors"(§6.1) + Reality
   Gate(QUANTUM Phase 5). README/init의 "core 5 + depth 8" 재서술 (§7 Q2·Q3).
8. **BS-4 위생 + BS-6 되돌림 계획 1문단.**
9. **F6 중 landing 경로만:** 공개 유입 동선에서 구세대 표면 강등 (Phase 1에
   포함됨). vitality tier가 사용자 노출로 판명되면 노출 지점만 제거.

### Wave 2 — 공개 직후 (관찰과 병행, 1~2주)
1. **.ics calendar export (§7 Q4):** local-only 사용자의 귀환 수단. seal 성공
   surface에 파일 경로 한 줄.
2. **QUANTUM Phase 3 잔여:** 귀환 30초 계약 테스트, growth note validator,
   "아직 모르겠다" 경로 확인.
3. **QUANTUM Phase 4:** 영수증 공유 페이지 + OG 이미지 (증폭기).
4. **F5 대응:** Wave 0 관찰 + 실사용 퍼널이 가리키는 seal 마찰 지점 1개만 수정.
5. **BS-3 대응:** 대량 due의 놓아주기 UX — 실제로 due가 쌓이기 시작하면.
6. **웹 voice 전수 정리 (§7 Q6 후반).**

### Wave 3 — 보류 또는 버림
- Streamable HTTP + OAuth 원격 전송 (창업자 결정 대기 — 변동 없음)
- judgment_receipts 테이블 분리 (현실 데이터가 요구할 때)
- 에이전트 아키텍처 F1~F4 트랙 (별도 대기 — 이번 공개와 무관)
- premises 고급 기능(apply_to_matching) 홍보 (기능은 두되 문서에서 뒤로)
- plugin-v2 관련 일체 (브리프 지시: 참고물로만)
- 새 MCP 도구, 새 알림 채널, 게이미피케이션류 일체

## §9. 사람(창업자)이 결정해야 할 것 — 코드가 아닌 제품 판단

1. **공개일 기준 "지원 선언" 문장:** local-only의 한계(스스로 깨어나지 못함)를
   README에서 어느 강도로 말할 것인가 — Wave 2의 .ics가 나가기 전 공개라면
   "check_in 습관 + 곧 캘린더 내보내기"까지 약속할 것인지. (약속은 곧 부채다.)
2. **토큰 만료 주기와 갱신 UX의 톤:** 보안(짧은 만료) vs 우정 5(미러가 자주
   끊김). F3 수정이 실패를 정직하게 만들지만, 만료 주기 자체는 제품 판단이다.
3. **공개 채널과 첫 100명:** npm 공개만인가, HN/디렉토리 제출인가 — 퍼널
   계기판(Wave 1-5)이 읽을 대상이 있어야 Reality Gate가 작동한다.
4. **BS-2의 심각도 판정:** 토큰 오배송(남의 계정에 내 판단) 시나리오를 공개
   전에 막을 것인가(계정 식별자 표시 1줄), 감수할 것인가.
5. **웹앱 구세대 도구의 장기 거취:** 이번엔 강등으로 충분하지만, "Argus = 판단
   영수증"으로 브랜드가 잡힌 뒤에도 rehearse/boss류를 유지할 것인가 — 현실
   데이터가 쌓인 뒤(Reality Gate) 다시 물을 질문이라는 데 동의하는지.

## §10. 이 문서 자신의 봉인

이 문서도 Argus 방식으로 끝낸다.

> **예측:** Wave 0~1을 완료하고 공개하면, 공개 후 30일 안에 팀 외부인 최소
> 1명이 "터미널 봉인 → (미러) → check-by 도착 → 귀환(이메일 또는 check_in) →
> settle"을 외부 개입 없이 완주하고, 그 여정이 계기판에 표면별 행으로 남는다.
> **check-by: 공개일 + 30일.**
> **pass:** 위 여정 1건 이상 — Argus는 도구를 넘어 최소 1명에게 "약속한 날에
> 온 친구"였다.
> **fail이면:** 혈관이 아니라 심장의 문제 — 즉 "판단 영수증"이라는 가치 제안
> 자체가 첫 사용자에게 닿지 않는다는 뜻이다. 그때의 다음 작업은 코드가 아니라
> 완주 실패 지점의 사용자 5명과의 대화이고, 그 사실을 알려 주는 것이 바로
> 이번에 심는 계기판이다.
>
> AI VERDICT ON THIS PLAN ·································· NONE
> 이 계획을 채점하는 것도 모델이 아니라 현실이다.

---

부록 — 이번 세션에서 직접 읽어 확인한 것: `argus-mcp/src/lib/spine.ts`(전문) ·
`argus-mcp/src/tools/sync.ts`(전문) · `argus-mcp/src/tools/{index,seal,open-decision,
check-in}.ts`(부분) · `argus-mcp/src/lib/push-account.ts`(부분) ·
`src/app/api/mcp/seal/route.ts`(buildReceipt 전문) · `src/lib/judgment-vitality.ts`
(시그니처) · `src/lib/user-data-tables.ts` · 파일 인코딩(`file`) ·
테스트 존재(route.test 8건, push-account, loop, integration-simulation) ·
i18n 1차 grep. 나머지 주장은 "확인" 지시가 붙은 Wave 0 항목이다.
