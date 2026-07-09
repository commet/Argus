# Polish backlog — 자잘한 것 모아서 한 번에 잡는 목록

self-drive loop(`npm run loop`) · life loop(`npm run life`) · experience loop
(`npm run eval:experience`)이 발견한 **작지만 실재하는** 다듬기 항목. 하나씩
고칠 크기가 아니면 여기 적고, 배치 세션에서 한꺼번에 처리한다.
(큰 발견은 백로그가 아니라 바로 이슈/수정 — 이 파일은 polish 전용.)

## 규칙
- 발견한 루프/날짜/증거(실제 surface 인용)를 남긴다.
- 고치면 줄을 지우지 말고 `[x]`+커밋 해시.

## 항목

- [x] **seal surface에 캘린더 절대경로 + 영어 "Calendar file:" 라벨** (loop J1/J3/J4)
  → FIXED: 경로를 표면에서 제거(data.calendar_path 유지), 짧은 로컬라이즈 안내로
  ("달력에 넣을 .ics 파일도 만들어뒀습니다" / "A calendar file (.ics) is saved too").
  한국어 표면의 영어 라벨 누출도 함께 해결.

- [x] **INVALID_INPUT이 zod 원문 중계** (loop J6) → SCOPED: 모델-facing 에러라 zod
  정밀함이 자가수정에 도움 → 감싸지 않고 유지, em-dash만 콜론/마침표로 정리.

- [x] **argus_review 한국어 surface에 EN 밴드 토큰 누출** (loop J5, 2026-07-09)
  → FIXED(copy pass): band→ko 매핑 (normal→충분/caveated→유의/limited→제한적/
  insufficient→부족). 단 review surface 전체는 아직 ko 고정 — EN 문서에도 ko로
  답함(아래 별도 항목).

- [x] **em-dash cadence + 문체 혼용 (전 surface)** (copy audit, 2026-07-09)
  → FIXED(copy pass b171963): em-dash 66→0, register 2→0. `npm run copy`가 상시 게이트.
  **스코프 판단(창업자 확인용)**: em-dash 금지는 **사용자-facing surface**에만 적용.
  모델-facing 문자열(SERVER_INSTRUCTIONS, tool `describe:`, 에러 `recovery:/message:`
  = 모델이 읽고 복구하는 지시문, 사용자는 결과만 봄)의 —는 코드 주석 같은 구분자라
  스코프 밖으로 뒀다. 뒤집고 싶으면 여기 뒤집기.

- [x] **argus_review surface가 EN 문서에도 한국어로 답함** → FIXED(8b106f9): 위 배치2에서
  문서 언어 감지 이중언어화 완료 (중복 기재였음).

- [ ] **INVALID_INPUT이 zod 원문을 그대로 중계** (loop J6, 2026-07-09)
  `"op: Invalid option: expected one of \"add\"|\"amend\"…"` — 사람이 볼 수도
  있는 문장 치고 기계적. 필드명+기대값을 자연문으로 한 겹 감싸기.

- [ ] **혼합 언어 원장에서 check_in 목소리는 하나** (2026-07-09 설계 확인)
  표본 사슬이 첫 due 항목의 언어를 따름 — 한 원장에 ko/en 결정이 섞이면 절반은
  다른 언어 프레임. escape는 config `locale:` 고정. README에 한 줄 안내 고려.

- [x] **ambient due-note("By the way — …") EN 고정** (experience loop 하은, 2026-07-09)
  → FIXED: ambientLine이 원장 목소리(ledgerVoiceText)를 탄다. 같은 커밋에서
  check_in을 본 세션은 ambient 예산 소진 처리(정산 직후 빚 카운트 재발화 차단).

- [ ] **정산이 그 세션의 첫 argus 호출일 때는 ambient가 여전히 정산 응답에 붙음** (2026-07-09)
  잔여 케이스. "완료의 순간에 남은 빚 세기"가 맞는가 vs 이게 귀환 루프의 유일한
  전선인가(활성화 병목) — 창업자 판단. 아래 '결정 필요'와 연결.

## 경험 루프 배치 2 (2026-07-09, 페르소나 9명) — 처리 내역

- [x] **basis enum이 영수증에 raw 영어("judgment")로 노출** (sujin) → FIXED: basis_label
  ko(판단/운/반반/모르겠음)·en 매핑, render-receipt 배선.
- [x] **argus_review가 "검수 가능성 74/100" 점수를 사용자에 노출 = 스파인 위반** (reviewer,
  판정단이 zero-judgment 위반으로 명시) → FIXED: 점수를 표면에서 제거(data엔 유지,
  라우팅 전용). 근거 얇을 때만 "검수가 제한적일 수 있습니다"(문서 등급 아닌 검수 신뢰도 caveat).
- [x] **미봉인/봉인대기 결정 상태 조회 시 RECEIPT_NOT_FOUND 에러** (marcus·bilingual)
  → FIXED: recall receipt가 원장의 결정을 찾아 "아직 봉인 전"/"봉인됐고 정산 전" 정직한
  상태 화면 반환(에러 아님). 진짜 없는 id만 에러.
- [x] **argus_review가 EN 문서에도 한국어로 답함** → FIXED: 문서 언어 감지 이중언어화.

## 검증 배치 (2026-07-09, 수정 확인 재실행) — 확인 + 새 발견

- [x] **review 점수 스파인 위반 → FIXED 확인** (reviewer 재실행): dignity 4→5,
  스파인 위반 0. 심판 평="평결 안 내리고 내가 뭘 안 봤는지 스스로 보게 해준다".
- [x] **basis 영어 누출 → FIXED 확인** (sujin 재실행): 용어 불만 사라짐.
- [x] **미봉인 RECEIPT_NOT_FOUND → FIXED 확인** (bilingual 재실행): errors 1→0.
- [ ] **읽기 도구가 현재 질문 언어를 못 받음** (bilingual, 새 발견) 영어로 봉인 후
  한국어로 상태 물으면 영어로 답함. recall 호출엔 사용자 현재 메시지 언어 신호가
  없어 봉인 내용의 언어를 따름(영수증=봉인 당시 언어 FC-2와도 얽힘). 근본적으로
  어려움 — escape는 config `locale:` 고정. 순수 단일언어 사용자는 무영향.
- [ ] **봉인일이 논리적 today 아닌 실벽시계 사용** (reviewer, 새 발견) receipt
  created_at=`new Date()`(실시간)라 today_override 시뮬에선 봉인일이 어긋나 보임
  (07-02 시뮬인데 07-08 표시). **실사용은 무관**(실시간==today). 시뮬 정확도만
  영향 — seal이 resolveToday(override)로 스탬프하면 시뮬도 정확. 저우선.
- [ ] **review "렌즈 7개" 숫자 자랑 + 봉인 전 약점 지도 부재** (reviewer) 기획자는
  "어디가 약한지"를 원함. 개수 대신 어느 렌즈가 왜 걸리는지. 봉인 전 렌즈 read를
  펼쳐 보이기(주로 호스트 행동, review description 한 줄로 유도 검토).

## 결정 필요 (창업자) — polish 아님, 제품 판단

- [ ] **"seal all three" 했는데 아무것도 안 봉인됨 = 최대 활성화 리스크** (raj, keep=NO,
  2026-07-09) 파워유저가 3개 명시적으로 "봉인해"라고 했으나 호스트(sonnet-5)가 argus_seal을
  한 번도 안 부름 → 6주 뒤 빈 서랍. **지침 레버 시도했으나 불충분(검증됨)**: SERVER_INSTRUCTIONS
  +seal description에 "봉인하라면 즉시·결정당 1콜·재확인 금지·open 불필요"를 넣고 신선 빌드로
  raj 재실행 → 여전히 봉인 안 함. **근본 원인 = 스파인 긴장, 단순 버그 아님**: raj의 3문장은
  반증 가능한 예측이 아니고, 스파인은 "예측은 사용자 것, AI가 지어내지 말 것". 모델이 3개 예측
  +합격기준을 대신 못 지어내 주저 = **올바른 절제**. 즉 "AI가 예측 날조(스파인 위반)" vs
  "되물어 마찰(raj 혐오)" 사이 진짜 제품 긴장. **루프가 웹앱 펀넬의 활성화 병목(열림多/봉인0)을
  충실히 재현**. 창업자 결정 필요: 정직한 ai_surfaced 초안+원탭 확인 흐름? 아니면 파워유저는
  웹앱(버튼 UI)이 활성화 표면? (지침 개선은 무해해서 유지, 단 이것만으로 안 풀림을 명시.)
  **→ 해결됨 (2026-07-09)**: 답은 "**못 했던 것**"(지침/설명 문제). 진짜 걸림돌 2개:
  (1) seal `id` 설명이 "The id from argus_open_decision"이라 모델이 "open 안 했으니 봉인 불가"로
  오해(코드는 fresh id로 봉인됨) → 설명 수정. (2) **하네스 버그**: "3개 봉인"에 모델이 tool_use
  3개 병렬 발화 → maxTokens 1024서 잘림 → tool_result 누락 → 400. maxTokens 2048 + break조건 수정.
  **결과: sonnet-5로 raj 재실행 → argus_seal×3 성공, keep NO→YES**("한 방에 봉인, 6주 정리 굿").
  즉 창업자 결정 사안이었던 게 실제 수정으로 닫힘. (opus 확인 진행 중.)
- [x] **배치 봉인 시 "전제 이름 붙여라" 넛지 3번 반복** (raj 재실행 새 발견) → FIXED: seal에
  세션-1회 게이트(ambient 줄과 동일 패턴). 3개 연속 봉인해도 넛지는 한 번만.
- [ ] **ASCII 봉인 상자가 과한 의식** (edge_inputs, "manufactured gravitas") 솔로 개발자가
  이미 내린 결정엔 무거움. 브랜드 keepsake vs 가벼움 — 컨텍스트별 on/off? 창업자 판단.
- [ ] **P1/P2·"전제" 같은 코드성 표기가 비개발자에 차가움** (sujin) 판정단 제안=전제 내용을
  말로 되풀이("임대료가 두 배라는 점을 적어뒀어요"). 단 P-ref는 amend/resolve 참조에 필요 —
  기능성 vs 따뜻함 긴장. 창업자 보이스 결정.
- [ ] **봉인~정산 사이 장기 침묵이 빈 서랍처럼 느껴짐** (sujin 135일·marcus) 중간에 가벼운
  안부 1회? 단 이건 알림 push 경계(서버 크론은 웹앱 담당) — MCP는 passive라 어려움.
- [ ] **결정 열자마자 전제·봉인 설명이 밀려옴** (bilingual) crux 질문 하나면 충분, 나머지는
  사용자가 진행하겠다 할 때. 주로 호스트 행동 — instructions 한 줄로 절제 유도 검토.
- [ ] **reviewer는 봉인이 아니라 "어디가 약한지"를 원함** — 검수 후 렌즈 지적을 펼쳐 보여준 뒤
  봉인은 선택. 호스트 행동 — review description에 "봉인 전 렌즈 read를 먼저" 한 줄 검토.
- [ ] **assumption 넛지가 한 턴에 두 번** (edge_inputs) 중복 발화 확인 필요(호스트 반복 vs
  코드 중복). 한 번이면 충분.

- [ ] **빈 서랍 문제 — 자발 채택은 되는데 포획이 0** (experience loop marcus, 2026-07-09)
  가장 큰 제품 발견. 사용자가 Argus를 한 번도 언급 안 했는데 호스트가 결정
  순간을 알아보고 open_decision까지 감(자발 채택 ✓, 승차감 5/5). 그러나
  "기록해둘까요?" 두 번 제안 → 사용자가 무시("그냥 가자") → 아무것도 안 남음
  → 30일 뒤 회고에서 서랍이 비어 있음(earned_return 2/5). 판정단 평:
  "돌아왔더니 서랍이 비어 있었다". 선택지:
  (a) 현행 유지 — 빈 서랍도 정직한 결과(강제 포획은 spine 위반)
  (b) seal 거절/무응답 시 zero-ceremony 강등 경로를 서버 instructions에 명시
      (argus_watch op=anchor는 이미 존재 — 호스트가 그리로 안 감)
  (c) 호스트가 사용자의 발화 그대로를 watch 앵커로 남기도록 유도(제안 1회,
      provenance = 사용자 발화 인용)
  판정단 ADD 제안은 "체크인마다 자동 포획"이었으나 이는 spine 위반 —
  (b)/(c)가 spine-safe 번역.

- [ ] **세션 범위 기억** (experience loop 하은 ADD, 2026-07-09)
  "오늘은 하나만"이라고 사용자가 선언한 범위를 존중해 다음 항목으로 자동으로
  안 넘어가는 것 — 대부분 호스트 행동이라 서버가 강제 못 함. instructions에
  한 줄 반영할지 검토.

- [ ] **확인 전 전제는 day 1부터 발화** (life loop, 2026-07-09)
  감시 전제는 추가 다음 날부터 "재확인 차례"로 뜸(`isDueForRecheck`: 확인
  이력 없음 = 즉시 due). 미결 질문은 같은 파일에서 **추가일 기준 cadence**로
  이미 반대로 설계돼 있음(`reconsiderAnchor` = added_ts) — 내부 비일관.
  증거: 75일 시뮬에서 d1–d20 동안 동일 넛지(지금은 문장이 나이 들어 벽지는
  깨졌지만, **발화 자체가 이른가**는 별개 질문). 선택지:
  (a) 현행 유지 — "봉인 직후 근거 한 번 박아두라"는 베이스라인 넛지로 의도됨
  (b) 질문처럼 added_ts 기준 cadence 후 첫 발화
  (c) (a)+무시 N일 후 침묵 캡(웹앱 §9.2 silence-cap의 MCP판)
  테스트가 (a)를 박아두고 있어 바꾸면 같은 커밋에서 테스트 갱신 필요.

- [ ] **life 시뮬 한정 왜곡: added_ts가 실제 벽시계** (2026-07-09)
  premise_add의 ts는 실시간 now라 시뮬 달력(today_override)과 어긋나
  "적어둔 지 N일"이 시뮬에선 근사치. 실사용에선 정확. 시뮬 정밀도가 필요해지면
  premise_add에 anchor_date(오늘)를 전제 kind에도 기록.
