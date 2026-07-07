# MCP 서버(argus-mcp) 완성도·매력도 감사 — 2026-07-03

> 읽기 전용 감사. 코드는 한 줄도 고치지 않았고, 아래 모든 발견은 실제 코드에서 파일:줄번호로 확인한 것만 적었다.

## 요약 (5줄)

1. **뼈대는 약속대로다.** seal은 진짜 3곳(원장 ledger.jsonl + 영수증 receipt.json + bearing 파일)에 저장되고, settle은 seal 없으면 하드에러(`NO_PRIOR_SEAL`)가 나며, 판결 도구는 정말로 없다 — 청사진(B1~B3)이 코드에 그대로 박혀 있고 테스트로 고정돼 있다.
2. **가장 큰 배신은 argus_sync다.** "계정 판단을 끌어와 **여기서 정산하라**"고 약속하지만, 끌어온 id(`mcp_` 접두사 붙음 / 웹앱 발행 id)로 argus_settle을 부르면 100% `NO_PRIOR_SEAL` 에러가 난다. 약속한 동선이 구조적으로 막혀 있다 (P0).
3. **조용한 배신 3건**: `argus_check_in`의 `include_upcoming_days` 인자는 받기만 하고 무시된다, `argus_config`의 locale 설정은 아무 도구도 읽지 않는 죽은 스위치다, 계정 동기화 실패 시 사용자에게 한 마디도 안 한다("이메일 오겠지"라고 믿게 방치).
4. **목소리가 두 언어로 갈라져 있다.** seal/settle/open은 영어, sync/review는 한국어 하드코딩 — 같은 서버의 도구인데 톤이 다른 사람이다. 또 restraint 응답이 내부 enum(`"reversible_low_stakes" case`)을 그대로 사람 문장에 노출한다.
5. **웹앱-MCP 드리프트 가드는 실재하고 통과한다.** review 코어 8개 파일을 직접 diff로 대조해 byte-단위 동일(`.js` import 차이만) 확인했고, 가드 테스트(`review-mcp-drift.test.ts`)도 존재한다. outcome 어휘 차이(held↔happened)는 다리(route.ts)에서 매핑돼 있다.

---

## 발견 목록

### P0 — 약속이 구조적으로 깨지는 곳

**P0-1. argus_sync가 안내하는 정산 동선이 항상 실패한다.**
- 약속: `argus-mcp/src/tools/sync.ts:27-29` — "Pull your Argus account receipts … **so you can settle here**", `sync.ts:62` surface — "정산은 argus_settle로."
- 실제: sync가 돌려주는 id는 계정 DB의 행 id다 (`src/app/api/mcp/receipts/route.ts:56` `id: r.id`). MCP에서 봉인한 것은 서버가 `mcp_` 접두사를 붙여 저장하므로(`src/app/api/mcp/seal/route.ts:52-54` `rowId = 'mcp_' + id`) 로컬 원장의 id와 **다르다**. 그 id로 argus_settle을 부르면 `resolveContract`가 로컬 원장에서 못 찾고(`argus-mcp/src/lib/resolve-contract.ts:22-34`) → `guardTransition`이 `NO_PRIOR_SEAL`로 하드에러(`argus-mcp/src/lib/state-machine.ts:71-77`).
- 더 나쁜 건 복구 힌트다: "Call argus_seal … first" — 모델이 이 말을 따르면 **같은 예측이 다른 id로 이중 봉인**된다.
- 웹앱에서 봉인한 영수증은 접두사를 벗겨도 로컬 seal이 아예 없어 MCP 정산이 원천 불가능하다. 즉 "여기서 정산"은 (a) 같은 기계에서 MCP로 봉인한 것 + (b) 접두사를 사람이 벗겨낸 경우에만 우연히 된다.

### P1 — 조용히 삼켜지거나 무시되는 곳

**P1-1. `include_upcoming_days`는 광고만 하고 무시된다.**
- `argus-mcp/src/tools/check-in.ts:12`에서 "Also list contracts due within N days"라고 선언하고 기본값까지 두지만, 핸들러(`check-in.ts:23-75`) 어디에도 이 값을 읽는 곳이 없다. `upcoming` 필드도 응답에 없다. LLM이 `include_upcoming_days: 7`로 부르면 조용히 0일 결과를 받고, 사용자는 "다가오는 게 없다"고 잘못 믿는다. (청사진 §2.4는 `upcoming` 출력을 명시했다.)

**P1-2. 계정 동기화 실패가 무언(無言)이다.**
- `argus-mcp/src/tools/seal.ts:122` — 성공하면 "Synced to your account — you'll get an email"이라 말하지만, **토큰을 설정해 놓고 실패하면**(네트워크/토큰 만료/서버 5xx) surface에 아무 말이 없다. `data.account_synced: false`만 남고 실패 이유(`sync.reason`, `push-account.ts:98-101`)는 응답에 실리지도 않는다. 사용자는 이메일이 올 거라 믿고 떠난다 — check-by 날 리마인더가 안 오는 최악의 침묵. settle 쪽(`settle.ts:112`)도 동일.

**P1-3. crux 검증기가 "id"라는 단어에 오발한다.**
- `argus-mcp/src/lib/validate-crux.ts:19`의 LEAN 정규식 `i('| w)?d`는 "I'd"를 잡으려는 의도지만 **일반 단어 "id"도 매치**한다 (node로 재현 확인: "Will the user id migration finish before Q3?" → true). 소프트웨어 결정 질문에 "id"는 흔한 단어라, 멀쩡한 중립 질문이 "당신 질문에 평결이 숨어 있다"(CRUX_CARRIES_LEAN)는 죄인 취급 에러를 받는다. 최악의 날 각도에서 가장 억울한 에러.

**P1-4. `argus_config`의 locale은 죽은 설정이다.**
- `argus-mcp/src/tools/init-config.ts:70-77`이 "Read or update non-spine settings (locale …)"이라 약속하고 ko/en을 저장하지만, **그 값을 읽어 출력 언어를 바꾸는 도구가 하나도 없다** (grep으로 확인: `detectLocale`은 config 생성 시 1회 쓰기만). 실제 출력 언어는 도구별 하드코딩이다 — seal/settle/open/check_in/recall은 영어(`seal.ts:126`, `check-in.ts:51`), sync/review는 한국어(`sync.ts:62-63`, `review.ts:173`). locale을 en으로 바꿔도 sync는 한국어로 말하고, ko로 바꿔도 영수증은 영어다.

### P2 — 다듬을 곳

**P2-1. restraint 응답이 내부 enum을 사람 문장에 노출.**
- `argus-mcp/src/tools/open-decision.ts:78` — `This looks like a "reversible_low_stakes" case.` 스네이크케이스 내부 사유 코드가 그대로 나온다. "도착과 알아봄"의 목소리가 아니라 로그 메시지다.

**P2-2. 죽은 코드: `falsifiability_note`.**
- `argus-mcp/src/tools/seal.ts:136` — `vErr ? 'weak heuristic passed' : undefined`인데 이 지점에서 `vErr`는 항상 null(참이면 51행에서 이미 반환). 항상 undefined인 필드.

**P2-3. 영수증 없이 정산되면 빈 따옴표가 인쇄된다.**
- 영수증 파일이 유실/손상되면 `writeSettleReceipt`가 `predicate: '', check_by: ''`로 재생성(`argus-mcp/src/lib/receipt.ts:96-101`) → 렌더에 `YOU PREDICTED ""   (check-by )`가 찍힌다(`render-receipt.ts:51`). 원장에는 predicate가 살아 있으므로(`settle.ts:40`의 `current.predicate`) 폴백으로 채울 수 있다.

**P2-4. 애노테이션 거짓말: settle/dismiss가 `idempotentHint: true`.**
- `argus-mcp/src/tools/settle.ts:33`, `amend-dismiss.ts:71` — 두 번째 호출은 같은 결과가 아니라 `ALREADY_SETTLED`/`DECISION_CLOSED` 에러다. 힌트를 믿고 재시도하는 호스트에게 거짓 신호.

**P2-5. 서버 버전 드리프트.**
- `argus-mcp/src/server.ts:30` `version: '1.0.0'` vs `package.json` `1.3.0`. 호스트 진단 화면에 옛 버전이 보인다.

**P2-6. gate_input이 "첫 사용" 인사를 지운다.**
- 원장 replay가 gate_input 이벤트에도 `ids.add(id)`를 한다(`argus-mcp/src/lib/ledger-replay.ts:97-99`). restraint로 끝난(봉인 0건) 사용자도 `ids.size > 0`이 되어 recall/init의 첫-사용 안내문(`recall.ts:98-100`, `init-config.ts:53-58`)이 안 나온다.

**P2-7. README 도구표에 argus_amend/argus_dismiss가 없다.**
- `argus-mcp/README.md:86-97` 표는 11개만 싣고 있는데 실제 등록은 13개(`src/tools/index.ts:15`). 첫 3분에 LLM/사람이 "날짜를 고치려면?"의 답을 표에서 못 찾는다.

**P2-8. 원장 손상이 숫자로만 보고된다.**
- 손상 라인은 `integrity.dropped_lines`로 세지만(`ledger-replay.ts:94`) 사람 문장(surface)으로는 어떤 도구도 알려주지 않는다(`check-in.ts:69`의 data 속에만). "저장소 손상 시 복구 경로 안내"가 없는 셈 — 죄인 취급은 없지만 침묵이다.

**P2-9. 기다림: seal/settle이 네트워크에 최대 5초 잡혀 있다.**
- 토큰 설정 시 `pushToAccount`가 인라인 await(타임아웃 5초, `push-account.ts:43`) — 로컬 봉인은 이미 끝났는데 응답이 5초 늦을 수 있고 진행 표시는 없다. MCP progress notification 미사용. (허용 범위지만, 실패 무언(P1-2)과 합치면 5초 기다리고도 아무 말 없는 경험.)

### 잘 지켜진 약속 (확인 완료)

- **seal 저장 실체**: 원장 append(`seal.ts:106` → `.argus/ledger.jsonl`, O_APPEND 원자 append `ledger-append.ts:58`), 영수증(`seal.ts:62` → `sessions/{id}/receipt.json`), bearing(`seal.ts:72`). 디렉터리 없으면 자동 생성(`atomic-write.ts:6`) — init 없이도 첫 도구가 막히지 않는다.
- **settle의 하드 게이트**: `state-machine.ts:71-77` + 골대이동 차단(`GOALPOST_MOVED`, :87-89) + 정산 후 재오픈 불가(:102-104). 청사진 §3.2 그대로.
- **에러가 안 삼켜짐**: 모든 핸들러 예외가 typed 에러 봉투로 반환되고(`errors.ts:12-24`), 디스패처 최후 가드(`server.ts:116-123`)는 stderr에 로깅. 도구 호출 직렬화로 원장 레이스 차단(`server.ts:77-85`).
- **웹앱 연결(쓰기 방향)**: 토큰 설정 시 seal이 `review_receipts`에 착지해 웹앱 Active Course와 Companion Brief 이메일에 잡힌다(`src/app/api/mcp/seal/route.ts:180-202`).
- **드리프트 가드 실재**: review 코어 8파일 webapp↔MCP byte-동일 (직접 diff로 검증), 가드 테스트 `src/lib/__tests__/review-mcp-drift.test.ts:15-31`. outcome 어휘(held/still_pending ↔ happened/unclear)는 다리에서 매핑(`seal/route.ts:46-51`) — 의도된 번역, 드리프트 아님.
- **첫 3분**: 도구 description이 seal/settle을 쓸 때마다 괄호로 풀어 쓴다(예: `seal.ts:36` "predicate + check-by date"). `argus_dir` 생략 시 에러 문구가 정확히 다음 행동을 알려준다(`argus-dir.ts:53-55`).

---

## 구현 스펙 (정확한 문안 포함)

### S1. argus_sync ↔ argus_settle 동선 봉합 (P0-1)
`argus-mcp/src/tools/sync.ts` 응답의 각 receipt에 두 필드를 추가:
- `local_id`: id가 `mcp_`로 시작하면 접두사를 벗긴 값, 아니면 null.
- `settle_path`: `local_id`가 있으면 `"argus_settle (use local_id)"`, 없으면 `"webapp"`.

surface 문안 교체 (`sync.ts:62-63`):
```
현재: "계정에 살아 있는 판단 N개 · 확인할 차례 M개. 정산은 argus_settle로."
제안: "계정에 살아 있는 판단 N개 · 확인할 차례 M개. 이 터미널에서 봉인한 것은 local_id로 argus_settle, 웹에서 봉인한 것은 웹 대시보드에서 정산하세요."
```
그리고 `NO_PRIOR_SEAL`의 recovery(`state-machine.ts:75`)에 한 줄 추가:
```
"Call argus_seal … first. (If this id came from argus_sync and starts with 'mcp_', use the id without that prefix; a web-sealed prediction settles in the web app.)"
```

### S2. include_upcoming_days 구현 또는 제거 (P1-1)
가장 정직한 최소 수정: `check-in.ts` 핸들러에서 `check_by <= addDays(today, N)`인 sealed 계약을 `data.upcoming[]`으로 반환하고 surface에 "다가오는 것 K건(참고용)"을 덧붙인다. 구현하지 않기로 하면 스키마에서 **삭제**한다 — 받고 버리는 인자는 두지 않는다.

### S3. 동기화 실패를 말하게 하기 (P1-2)
`seal.ts:122` syncLine 삼항을 3-상태로:
```ts
const syncLine = sync.synced
  ? ' Synced to your account — you\'ll get an email when it comes due.'
  : sync.reason === 'no_token' ? ''
  : ` (Account sync didn\'t go through — ${sync.reason}. Your seal is safe locally; the email reminder won\'t fire until it syncs. Try argus_sync later.)`;
```
`data`에 `account_sync_reason: sync.reason`도 싣는다. settle도 동일 패턴.

### S4. crux 정규식 수정 (P1-3)
`validate-crux.ts:19`의 `i('| w)?d`를 `i'd|i would`로 분해:
```ts
const LEAN = /\b(you should|i'd|i would|the (stronger|better|safer|smarter) (case|choice|option|move|bet)|most (teams|people|founders)|the right (call|move|choice)|go with|lean(s)? toward|my (recommendation|advice|take)|honestly,? (i|you)|if i were you)\b/i;
```
회귀 테스트: `"Will the user id migration finish before Q3?"` → 통과해야 함.

### S5. locale을 진짜로 만들거나 정직하게 좁히기 (P1-4)
빠른 길(권장): surface 문자열을 `lib/surfaces.ts` 한 파일의 `{ko, en}` 사전으로 모으고, 각 도구가 `readConfig(dir).locale`로 골라 쓴다(스파인 원칙 "Single Source of Truth for Prompts"와 동형). 당장 못 하면 `argus_config` description에서 locale을 빼고 스키마에서 제거 — 죽은 스위치를 광고하지 않는다.

### S6. 목소리 다듬기 (P2-1)
`open-decision.ts:78` 사유 코드를 사람 말로 매핑:
```ts
const REASON_LINE: Record<string, string> = {
  vent: 'This reads like something to say out loud, not a fork to force.',
  factual: 'This is a question with an answer, not a decision to open.',
  already_closed: 'You already made this call. Argus does not reopen it.',
  flat: 'The options are close to even — no load-bearing question to manufacture.',
  reversible_low_stakes: 'Cheap to undo and little at stake — trying it IS the test.',
  low_stakes: 'Little rides on this — the steady move is to leave it as is.',
};
surface: `${REASON_LINE[gate.reason] ?? 'No fork to manufacture here.'} Leaving it as is stays a real option.`
```

### S7. 소소한 수선 (P2-2~P2-8)
- `seal.ts:136` 죽은 `falsifiability_note` 삭제.
- `settle.ts`에서 `writeSettleReceipt` 호출 시 receipt이 null이면 `current.predicate`/`current.check_by`를 base에 주입(`receipt.ts:96-101` 폴백 확장).
- `settle.ts:33`·`amend-dismiss.ts:71` `idempotentHint: false`로.
- `server.ts:30` 버전을 package.json에서 읽거나 1.3.0으로.
- `ledger-replay.ts:98` `ids.add(id)`를 gate_input이 아닌 이벤트에만.
- README 표에 `argus_amend`(check-by 전 날짜/예측 수정)·`argus_dismiss`(정산 없이 닫기 — 평결 없음) 두 행 추가.
- `check_in`: `integrity.dropped_lines > 0`이면 surface에 한 줄 — "원장에서 읽지 못한 줄이 N개 있습니다(크래시 흔적일 수 있음). 기록은 append-only라 나머지는 안전합니다 — ledger.jsonl을 백업해 두세요."

---

## 스파인 충돌 검토 (zero-judgment 게이트)

| 검토 항목 | 판정 | 근거 |
|---|---|---|
| 평결 도구 부재 | ✅ 유지 | `tools/index.ts:15` 13개 중 verdict/grade/score 없음, `spine-drift.test.ts:11-17`이 CI 고정 |
| 영수증 AI 판결 0 | ✅ 유지 | `receipt.ts:44` `ai_verdict: null` 리터럴, `render-receipt.ts:56-57` "The model never graded you. Reality did." |
| track record에 점수/등급 노출 금지 | ✅ 유지 | `recall.ts:131` `judgment_tier: null, judgment_score: null` + 표본 경고(:135) |
| ai_surfaced 정직 표기 | ✅ 유지 | crux(`open-decision.ts:112`), premise `source`/`ai_original`(`premises.ts:37-38`), predicate_owner(`seal.ts:24`) |
| 절제 기본값(mirror clause) | ✅ 유지 | overfire 게이트가 crux 생성 **전에** 실행(`open-decision.ts:59`), restraint 시 질문 자체를 안 만든다(:75-83) |
| **이번 감사 제안이 스파인을 건드리나** | 아니오 | S1~S7 전부 정직성(약속≠행동 봉합)·목소리·복구 경로 수정이다. 유일한 주의: S6의 restraint 문안은 "leave it as is stays a real option"으로 끝나 **핸들을 사용자에게 돌려준다** — 지시("두어라")가 아니라 옵션 명명으로 유지했다. S3의 실패 고지도 판단이 아니라 사실 보고다. |
| 잔여 기운 공개 | ✅ 유지 | `open-decision.ts:118` lean_disclosure, README:145-151 "asymptote, disclosed — not a badge" — "우리는 판단 안 한다" 금지 규칙 준수 |

한 가지 경계 관찰: `open-decision.ts:78`의 현재 문구 "The steady move is to **leave it as is**"는 개입-여부 판단을 서버가 대신하는 것처럼 읽힐 수 있으나, 이는 스트레스 테스트가 검증한 under-fire 기본값(restraint)의 사양 그대로이며(옵션 반환 + fork 미제조), 위반이 아니다. S6 문안은 이 성격을 더 분명히 한다.
