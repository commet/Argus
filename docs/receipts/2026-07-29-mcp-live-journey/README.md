# 발행본 MCP 실주행 — 제3자 사용자로 루프 완주 (2026-07-29)

`docs/receipts/2026-07-28-process5-live-walkthrough/`와 같은 장르의 **관찰
기록**이다. 설계 문서가 아니고 처방도 아니다 — 무엇을 보았는지와 어디를 보면
되는지만 적는다. 판단과 우선순위는 읽는 세션·창업자의 몫이다.

- **대상**: npm에 발행된 `argus-decision-mcp@2.0.9` (레포 소스 아님).
  빈 디렉터리에 `npm install`한 실물을 stdio로 직접 구동.
- **관점**: Argus를 처음 쓰는 제3자. 한국어 사용자.
- **완주 범위**: 첫 실행 → 결정 열기 → 전제 기록 → 봉인 → 확인일 도래 →
  정산 → 축적 조회 → 전제 교정 시도.
- **레포 기준선**: `origin/main` = `0ca1d8c8` 시점.

## 0. 정직 고지 — 이 기록의 한계

1. **시간을 조작했다.** 확인일 도래를 보려고 `ledger.jsonl`과 세션 파일의
   `check_by`를 하루 앞으로 직접 수정했다. 사용자 행동이 아니다. 그래서
   §2의 영수증에 "확인일이 저장일보다 앞선" 모순이 보이는데, **그건 내
   조작의 흔적이지 제품 결함이 아니다.**
2. **아래 여러 항목은 내가 인자를 틀려서 만났다.** 그럼에도 적은 이유는,
   *모델이 그렇게 틀리도록 유도되는 구조*라면 그것 자체가 관찰 대상이기
   때문이다. 각 항목에 "내 실수인가/구조인가"를 명시했다.
3. **웹앱은 타지 않았다.** 이 데스크탑에 브라우저 확장이 연결돼 있지 않아
   `argus.voyage` 화면은 이 주행의 범위 밖이다. MCP 표면만이다.

## 1. 관찰 목록

| # | 관찰 | 성격 |
|---|---|---|
| 1 | 축적 화면(`wake_text`)이 만들어지고 surface에 안 실린다 | 구조 |
| 2 | 정산 직후 전제 교정이 `DECISION_CLOSED`로 막힌다 | 구조 |
| 3 | 봉인 뒤 `check_in`이 "확인할 것 없음 · stop"이라 답한다 | 구조 |
| 4 | 첫 실행 문장만 영어다 | 구조 |
| 5 | enum 거절 에러가 산문 칸의 존재를 안 알린다 (3곳) | 구조 (내 실수에서 발견) |
| 6 | 검증 실패한 호출이 원장에 이미 쓰고 실패한다 | 구조 (내 실수에서 발견) |
| 7 | ~~전제 `ref`를 얻을 도구가 없다~~ | **철회 — §1.7 참조** |
| 8 | 달력 파일 경로가 문장에 없다 | 문안 |

2차 주행(같은 날, 아래 §4)에서 8건 추가. 목록은 §4.1에 있다.

---

### 1. 축적 화면이 만들어지는데 사용자에게 안 간다

`argus_patterns` 호출 결과. `data.wake_text`에 완성된 항해일지가 들어 있다:

```
┌─ ARGUS · 항해일지 ────────── 결정 2 · 확인 대기 1 · 결과 기록 1 ─┐

  ~ 바다 위 · 결과를 기다리는 중 (1)
    "직접 채용하면 3개월 안에 배…"   확인 08-05  ·  hire-vs-agency

  ⚓ 닻 내린 기록 · 현실이 답함 (1)
    빗나감 · "가격을 올려도 첫 달 이탈이 …"   07-29  ·  price-raise

└───────────────────────────────────────── 2026-07-29부터 항해 중 ─┘
```

같은 응답의 `surface`는 **`"결과를 기다리는 예측 1건."`** 한 줄이다. 정산을
완주해도 그 완주가 사용자에게 도달하지 않는다.

- **코드**: `argus-mcp/src/tools/recall.ts:233`, `:251` — `wake`를 `data`에만
  싣고 `surface`는 따로 만든다. 렌더러는 `lib/render-receipt.ts:138`
  (`renderWake`), 조립은 `lib/surfaces.ts:200`.
- **대조군**: `argus_resolve`는 영수증을 `surface`에 실어 보낸다. 두 도구가
  같은 성격의 산출물을 다르게 취급한다.
- **빨간불 조건**: `wake_text`가 존재하는 응답에서 `surface`가 그 내용을
  담지 않으면 실패하는 테스트. 현재 그런 가드는 없다 (CLAUDE.md
  "Type the verbs" / 소비 계약의 미적용 지점).

### 2. 영수증을 읽는 순간 전제를 고칠 수 없다

정산 영수증이 사용자에게 보여주는 줄:

```
  검증 안 된 전제: 지금 쓰는 사람들은 가격이 두 배가 돼도
  대부분 남는다
```

이 문장의 출처는 `ai_surfaced`다 — **AI가 쓴 문장**이다. 이어서
`argus_capture action="amend_context"`로 교정을 시도하면:

```
[실패] DECISION_CLOSED: 닫힌 결정이라 더 진행할 수 없습니다.
[복구안내] 필요하면 새 id로 다시 여세요. 닫힌 기록은 그대로 남습니다.
```

`settle` 이후 결정이 닫히고 교정 경로도 함께 닫힌다. 새 id로 열면 그 교정은
원래 기록에 붙지 않는다.

- **코드**: `argus-mcp/src/lib/state-machine.ts:166` (닫힌 결정의 모든 이벤트
  거부), 진입점 `argus-mcp/src/tools/amend-dismiss.ts:44`.
- **설계 의도와의 관계**: 닫힌 기록을 되열지 않는 것은 원장 무결성 규약으로
  보인다(`state-machine.ts:125` 주석). 반면 CLAUDE.md 스파인 1항은
  provenance 태깅과 함께 **사용자의 교정 여지**를 요구한다. 둘 중 무엇이
  우선인지는 이 기록이 정할 문제가 아니다 — 다만 **사용자가 교정하고 싶어질
  가능성이 가장 높은 시점이 유일하게 막힌 시점**이라는 사실만 남긴다.
- **빨간불 조건**: `ai_surfaced` 전제가 실린 영수증을 낸 뒤, 그 전제에 대한
  사용자 교정이 어떤 경로로든 원래 기록에 도달하는지 확인하는 여정 테스트.

### 3. 봉인해두고 다시 오면 "확인할 것 없음 · stop"

봉인 직후 `argus_check_in`:

- `surface`: `"지금 확인할 차례가 된 것은 없습니다."`
- `next_actions`: `["stop"]`
- 같은 응답 `data.open_predictions`: **2건** (문장·`check_by` 전부 포함)

```json
[{"id":"price-raise","predicate":"가격을 올려도 첫 달 이탈이 10%를 넘지 않는다","check_by":"2026-07-30"},
 {"id":"hire-vs-agency","predicate":"직접 채용하면 3개월 안에 배포 주기가 2주에서 1주로 줄어든다","check_by":"2026-08-05"}]
```

`argus_patterns`는 같은 상태를 `"결과를 기다리는 예측 2건."`이라고 말한다.
**두 도구가 같은 상태를 다르게 서술하고, 세션 시작에 도는 쪽이 "없음"이다.**

- **코드**: `argus-mcp/src/lib/surfaces.ts:546` (`nothing_due`). 바로 아래
  `:571`에 `live_no_due: (total) => '계정에 살아 있는 예측 N개. 확인할 차례가
  된 것은 없습니다.'`가 **이미 존재한다** — 계정 연동 경로에만 쓰이는 것으로
  보인다. 로컬 경로에는 그 문안이 닿지 않는다.

### 4. 한국어 사용자가 보는 첫 문장이 영어

설치 직후 첫 `argus_check_in`:

```
Just talk through a decision you're weighing.
I'll follow along, and if something is worth checking later I'll note it.
Nothing is tracked yet.
```

이후 모든 문장은 한국어로 나온다(입력에서 언어를 잡는 구조로 보인다).
**입력이 아직 없는 첫 화면만 기본값 영어로 떨어진다.**

- **코드**: `argus-mcp/src/lib/surfaces.ts:378` (`first_run`).
- 공정 1 exit가 "ko 영수증 전문 한국어"를 요구했는데, 그 관문이 **영수증만**
  덮고 첫 화면은 안 덮는다.

### 5. enum 거절 에러가 "당신 문장을 넣을 칸"을 안 알려준다

세 곳에서 같은 모양을 만났다. 셋 다 **내가 산문을 enum 칸에 넣어서** 난 것이다.

| 넣으려던 값 | 거절 메시지가 알려준 것 | 실제 정답 |
|---|---|---|
| 실제로 일어난 일(산문) | `outcome: 가능: held·avoided·partial·still_pending·missed` | `what_happened` (별도 칸, 600자) |
| 전제 교정 문장(산문) | `amendment: 가능: accept·refine·replace·retire` | `amendment:"replace"` + `text` |
| `"ai_surfaced"` | `source: 가능: url·user_stated·host_reported` | `premises[].source` |

설계 자체는 일관된다 — 기계 분류는 enum, 사람 말은 별도 칸. **관찰 대상은
에러가 enum만 나열하고 산문 칸을 가리키지 않는다는 점이다.**

특히 첫 줄이 문제될 수 있다. 확인일 화면이 사용자를 이렇게 초대한다:

> 저장한 예측 1건이 확인일을 지났습니다. **실제로 어떻게 됐는지 알려주시면
> 남겨드릴게요.**

초대에 응해 사용자 문장을 넣으면 "그 값은 안 됩니다, 5개 중 고르세요"가
돌아온다. 이때 모델의 최단 복구는 **사용자 문장을 버리고 `missed`로 뭉개는
것**이다 — 사용자의 말이 기계 분류로 대체되는 경로가 열려 있다.

세 번째 줄(`source`)은 별도로 주의할 값이 있다: **같은 도구 안에 이름이 같고
허용값이 다른 `source`가 둘 있다.** 최상위 `source`(`url·user_stated·
host_reported`)와 `premises[].source`(`user_stated·ai_surfaced`). 서버가
모델에게 주는 지시문은 *"label it ai_surfaced"*라고 적고 있어서, 최상위
`source`를 집은 모델은 **"ai_surfaced는 허용되지 않는 값"이라는 (그 자리에서는
맞지만 전체로는 틀린) 안내**를 받는다.

- 이어지는 재시도에서 `PROVENANCE_REQUIRED`를 또 만난다: `ai_surfaced`에는
  `ai_original`이 필수인데 스키마 `required`에는 `source`만 있다(런타임 검증).
  결과적으로 **전제 1건을 기록하는 데 왕복 3회**가 든다.

### 6. 검증 실패한 호출이 원장에 이미 쓰고 나서 실패한다

§5의 `PROVENANCE_REQUIRED`로 **실패한** 호출인데, 원장에는 남았다:

```
06:10:03  gate_input  price-raise   ← 실패한 호출
06:10:03  harvest     price-raise   ← 실패한 호출
06:10:54  gate_input  price-raise   ← 성공한 호출
06:10:54  harvest     price-raise   ← 성공한 호출
```

같은 결정이 두 번 기록됐다. 사용자에게 보이는 집계(`argus_patterns`의 "예측
N건")는 `seal` 기준이라 어긋나지 않았지만, 원장 자체에는 중복이 남는다.

- **코드**: `argus-mcp/src/tools/open-decision.ts:104` — `harvest` append가
  전제 처리보다 **먼저** 실행된다. 바로 위 주석(`:95~99`)은 "게이트와 무관하게
  기록한다"는 의도를 명시하는데, 그 의도는 **게이트**를 대상으로 한 것이고
  **인자 검증 실패**는 고려 범위 밖으로 보인다.

### 7. ~~전제 `ref`를 얻을 도구가 없다~~ — **철회 (2차 주행에서 반증)**

> **이 항목은 틀렸다.** `argus_patterns view="decision_context" id=<id>`가
> `ref`(`"P1"`)와 `premise_id`(`"p_ykj1rf"`)를 포함한 전제 목록을 돌려준다.
> 나는 `argus_patterns`의 인자 스키마를 확인하지 않고 "나열해 주는 도구가
> 없다"고 적었다. 이 항목을 근거로 새 조회 경로를 짓지 말 것.
>
> **다만 §2는 그대로 유효하다** — `ref`를 얻어도 정산 후에는
> `DECISION_CLOSED`라 쓸 수 없다. 교정이 막히는 원인은 조회 부재가 아니라
> 상태 전이 규칙이다.
>
> 원래 서술은 기록으로 남긴다:



전제 교정에는 `ref`(예: `p_ykj1rf`)가 필요하다. 이 id는 전제를 만든 그 응답의
`data`에만 있다. 공개 도구 6개(`argus_capture`/`predict`/`check_in`/`resolve`/
`patterns`/`settings`) 중 **전제를 나열해 주는 것이 없다.** `check_in`이 돌려주는
전제는 `due_premises`(재확인일이 도래한 것)뿐이다.

결과: 다음 세션에 와서 "그 전제 틀렸어"라고 하면, 모델이 `ref`를 얻을 경로가
없다. §2와 합치면 **교정 창구는 (a) 같은 대화 안에서 (b) 정산 전에만** 열린다.

### 8. 달력 파일을 어디 저장했는지 문장에 없다

> 예측을 저장했습니다. … **달력 앱에 넣을 알림 파일도 함께 저장했습니다.**

경로는 `data.calendar_path`에만 있고 `surface`에 없다. 사용자는 파일을 못 찾는다.
실제로는 `<argus_dir>/calendar/<id>.ics`에 정상 생성되며, 내용도 올바른
VCALENDAR였다(`VALARM` 포함).

---

## 2. 잘 작동한 것 (대조군)

관찰이 결함 목록으로만 읽히지 않도록, 같은 주행에서 확인된 것도 남긴다.

- **영수증.** 정산 결과가 이렇게 나온다:

```
  내가 예측한 것                               (저장일)
    "가격을 올려도 첫 달 이탈이 10%를 넘지 않는다"
  실제로 일어난 일                             (확인일)
    올리고 첫 달에 18% 빠졌다. 예상보다 훨씬 컸다.

  이 판단을 내린 사람: 나 (모델 아님)
  검증 안 된 전제: …
  ───────────────────────────────────────────
  AI VERDICT ON THIS DECISION ············  NONE
  모델은 당신을 채점하지 않았습니다. 현실이 답했습니다.
```

  **빗나간 예측을 기록했는데 기분이 나쁘지 않았다.** 이 표면은 의도대로 작동한다.

- **에러 복구 안내가 스파인을 지킨다.** 모든 검증 실패에
  `"사용자가 정해야 할 값은 추측하지 마세요"`가 붙는다. 모델이 사용자 대신
  칸을 채우는 것을 구조가 막는다. (§5의 문제는 이것과 별개로, *어느 칸이
  사람 말 칸인지*를 안 알려준다는 것이다.)

- **기록이 실제로 디스크에 도착한다.** `ledger/ledger.jsonl`,
  `sessions/<id>/receipt.json`, `calendar/<id>.ics`, `current_bearing.json`
  전부 생성됐고, 건너뛴 칸은 `"(skipped)"`로 정직하게 남았으며
  `ai_verdict`는 `null`이었다.

## 3. 재현 방법

```bash
mkdir journey-probe && cd journey-probe && npm init -y
npm install argus-decision-mcp@2.0.9

# stdio로 직접 구동 — initialize → notifications/initialized → tools/call
# argus_dir는 반드시 OS 네이티브 절대경로로 준다.
# (Windows에서 /c/Users/... 형태의 POSIX 경로를 주면 C:\c\Users\... 아래에
#  조용히 생성된다 — 이 주행에서 실제로 겪었고, 도구는 성공을 보고했다.)
```

호출 순서: `argus_check_in` → `argus_capture(action:"open", premises:[…])`
→ `argus_predict` → `argus_check_in` → `argus_resolve(outcome, what_happened)`
→ `argus_patterns`.

확인일 도래는 `check_by`가 미래여야 하므로(`BAD_CHECK_BY`는 오늘도 거부),
루프의 후반부를 한 세션에서 보려면 원장의 `check_by`를 과거로 옮겨야 한다.

---

## 4. 2차 주행 — 스파인·경계·에러 경로 (같은 날)

1차가 정상 여정이었다면 2차는 **억제 게이트가 실제로 억제하는지**와
**경계·실패 경로**를 봤다. 같은 발행본 2.0.9, 같은 방식.

### 4.1 추가 관찰

| # | 관찰 | 성격 |
|---|---|---|
| N1 | 확인일 **전**에도 정산이 통과하고, 조기 정산 표시가 없다 | 구조 |
| N2 | `low_stakes` 문안이 코드 주석의 자기 계약(지시 금지)을 위반 | 문안·스파인 |
| N3 | `leave_coda`가 문맥 무관하게 붙어 사실과 어긋난다 | 문안 |
| N4 | `monitoring_enabled`가 조용히 무효인 설정 | 구조 |
| N5 | `reconfirm`이 사용자가 쓴 적 없는 값을 확인하라 한다 | 문안 |
| N6 | 에러 복구 안내에 내부 배관(`mcp_` 접두사)이 샌다 | 문안 |
| N7 | `integrity`가 무결성이 아니라 파싱 계수기다 | 이름 |
| N8 | `decision_context` 문장의 정보량이 낮다 | 문안 |

### N1. 확인일 전에도 정산이 통과한다

`hire-vs-agency`의 `check_by`는 `2026-08-05`인데, `2026-07-29`에
`argus_resolve`를 호출하니 **7일 일찍 통과**했고 영수증까지 발급됐다.
영수증에 두 날짜가 나란히 남지만 조기 정산이라는 표시는 없다:

```json
{ "check_by": "2026-08-05", "settled_at": "2026-07-29T07:16:15.642Z",
  "outcome": "held", "what_happened": "벌써 됐다", "assumption_held": true }
```

`argus_patterns view="receipt"`는 이걸 이렇게 읽어 준다:

> 예측: "…". 현실: "벌써 됐다" (예측대로). 채점은 없습니다.
> **예측은 당신이, 답은 현실이 했습니다.**

- **불일치**: `argus_check_in`은 같은 순간 "확인할 차례가 된 것은 없습니다"라고
  답한다. 두 도구가 *도래(due)* 개념을 공유하지 않는다.
- **왜 걸리는가**: 조기 정산 자체를 막는 게 옳은지는 이 기록이 정할 일이
  아니다(사용자가 결과를 일찍 알 수도 있다). 다만 **조기인지 아닌지 구분이
  기록에 남지 않는다**는 사실은 남긴다 — "현실이 답했다"가 제품의 유일한
  검증 근거인데, 답하기 전에 적힌 것과 뒤에 적힌 것이 같은 모양이다.
- **빨간불 조건**: `settled_at < check_by`인 영수증이 그 사실을 담지 않으면
  실패하는 테스트.

### N2. `low_stakes` 문안이 자기 계약을 위반한다

`argus-mcp/src/tools/open-decision.ts:120~125` 주석이 억제 문장의 계약을
직접 적어 두었다:

> the line ENDS by naming the option and returning the handle —
> **never a directive ("leave it") issued in the user's stead**

그런데 여섯 개 이유 문자열 중 `low_stakes` 하나만 권고형이다:

| 이유 | EN (`surfaces.ts:475~480`) | KO (`:642~647`) |
|---|---|---|
| vent | This reads like something to say out loud… | 이건 소리 내어 말할 일이지… |
| factual | This is a question with an answer… | 이건 답이 있는 질문이지… |
| already_closed | You already made this call… | 이미 내린 결정입니다… |
| flat | The options are close to even… | 선택지가 거의 대등합니다… |
| reversible_low_stakes | Cheap to undo and little at stake. | 되돌리기 쉽고 크게 걸린 것도 없는 결정입니다. |
| **low_stakes** | **…so the steady move is to leave it as is.** | **…그대로 두는 편이 무난합니다.** |

나머지 다섯은 순수 서술이고 이것만 "무난하다 / the steady move"라고 **권한다.**
두 로케일 모두 같다.

배정도 봐야 한다. `reversible_low_stakes`가 따로 있으므로 `low_stakes`는
**걸린 것은 작지만 되돌리기 어려운** 쪽에 배정된다. 실측(`stakes:"low"`,
`reversibility:"one_way_door"`, "손목에 문신을 할지")에서 나온 문장:

> 걸린 것이 별로 없습니다. 그대로 두는 편이 무난합니다. 그대로 두는 것도
> 여전히 진짜 선택지입니다.

되돌릴 수 없는 행동에 대해 권고가 나가고, 같은 말이 두 번 나간다.

### N3. `leave_coda`가 문맥과 무관하게 붙는다

`open-decision.ts:127`이 비발화 이유 전부에 `T.leave_coda`를 무조건 이어
붙인다. `already_decided:true` + "이미 계약서에 서명했다. 사무실을 강남으로
옮기기로 했다"에 대해 나온 문장:

> 이미 내린 결정입니다. Argus는 이걸 다시 열지 않습니다.
> **그대로 두는 것도 여전히 진짜 선택지입니다.**

계약서에 이미 서명한 사람에게 "현상 유지도 진짜 선택지"라고 말한다. 앞 문장이
"다시 열지 않는다"고 해놓고 뒤 문장이 선택지를 제시한다.

### N4. `monitoring_enabled`가 조용히 무효인 설정

`premises[].monitoring_enabled`의 스키마 기본값은 **`true`**이고, 원장에도
`true`로 기록된다:

```json
{"event":"premise_add","premise_id":"p_ykj1rf","load_bearing":true,
 "monitoring_enabled":true,"external":false,"source":"ai_surfaced"}
```

그런데 `isMonitored`(`argus-mcp/src/lib/premises-core.ts:184`)는
`p.external === true`를 요구하고, `external`의 기본값은 `false`다. 그래서
조회하면 `monitored: false`로 나오고, 사용자는 이렇게 듣는다:

> 이 결정에 전제 1건이 있습니다. **0건 추적 중**, 0건 재확인 차례.

모델은 켰다고 믿고, 원장에는 켜졌다고 적히고, 화면은 꺼졌다고 말한다.
(`isMonitored`의 정의 자체는 의도된 것으로 보인다 — 문제는 **기본값 `true`가
조건을 만족시키지 못한 채 참으로 기록된다**는 점이다.)

### N5. `reconfirm`이 사용자가 쓴 적 없는 값을 확인하라 한다

`stakes:"high"` + `reversibility:"easily_reversible"`에서 나오는 문장
(`surfaces.ts:652`):

> 신호가 서로 어긋납니다 (걸린 것은 큰데 되돌리기는 쉽습니다).
> 더 나아가기 전에 **이 둘을 다시 짚어 보세요.**

`stakes`·`reversibility`는 사용자 발화가 아니라 **모델이 채운 도구 인자**다.
사용자는 그 두 단어를 말한 적이 없는데 그것을 재확인하라는 지시를 받는다.

### N6. 에러 복구 안내에 내부 배관이 샌다

`NO_PRIOR_SEAL`의 복구 안내:

> argus_predict로 … 먼저 저장하세요.
> **(id가 argus_settings sync에서 온 "mcp_" 접두사라면 접두사를 뗀 id를 쓰세요.)**

서버가 호스트에 주는 지시문은 *"Internal ids and errors are plumbing;
recover quietly"*인데, 에러 문안이 id 접두사 규칙을 노출한다.

### N7. `integrity`가 무결성이 아니라 파싱 계수기다

`argus_check_in`의 `data.integrity`는 `{dropped_lines, skipped_unknown}`뿐이다.
§0에서 밝혔듯 나는 `ledger.jsonl`의 `check_by`를 손으로 고쳤는데, 그 뒤에도
`{"dropped_lines":0,"skipped_unknown":0}`이었다. 줄이 깨졌는지만 세고 내용
정합성은 보지 않는다. 이름이 보증 범위보다 넓게 읽힌다.

(원장 변조 방지가 이 제품의 위협 모델에 들어가는지는 별개 문제다. 여기서는
**이름과 실제 보증 범위가 어긋난다**는 것만 적는다.)

### N8. `decision_context` 문장의 정보량이 낮다

> 이 결정에 전제 1건이 있습니다. 0건 추적 중, 0건 재확인 차례.

숫자 셋 중 둘이 0이고, "추적"과 "재확인"이 무엇인지 설명이 없다. 전제 문장
자체는 `data.premises[].text`에 있으나 문장에는 실리지 않는다 (§1.1과 같은
모양).

### 4.2 2차 주행에서 잘 작동한 것

- **억제 게이트가 실제로 억제한다.** 사소·되돌리기 쉬움·이미 결정함·평평함
  네 경우 모두 `fork_emitted: false`, `crux_question: null`로 통과했고 갈림길을
  만들어내지 않았다. CLAUDE.md 미러 조항(과다발화 금지)이 코드에서 지켜진다.
  (문제는 §N2·N3의 **문안**이지 게이트의 판정이 아니다.)
- **동시성이 견고하다.** 서로 다른 프로세스 8개가 같은 `argus_dir`에 동시에
  봉인 → 8/8 성공, 원장 16줄, JSON 파싱 실패 0줄, seal 유실 0건.
  병렬 세션을 실제로 굴리는 환경에서 중요한 성질이다.
- **상태 전이 가드가 정확하다.** 없는 id 정산 → `NO_PRIOR_SEAL`,
  이미 정산한 것 재정산 → `ALREADY_SETTLED`, 같은 결정 2회 봉인 →
  `ILLEGAL_TRANSITION`. 전부 조용히 성공하지 않고 제대로 막았다.

---

*이 기록은 판정이 아니다. 각 항목의 "빨간불 조건"이 채워지기 전까지, 어느
것도 exit 체크를 대신하지 않는다. 그리고 §1.7이 보여주듯 **이 기록 자체도
틀릴 수 있다** — 항목을 근거로 짓기 전에 해당 코드를 직접 확인할 것.*
