# 발행본 MCP 실주행 — 제3자 사용자로 루프 완주 (2026-07-29)

`docs/receipts/2026-07-28-process5-live-walkthrough/`와 같은 장르의 **관찰
기록**이다. 설계 문서가 아니고 처방도 아니다.

- **대상**: npm에 발행된 `argus-decision-mcp@2.0.9` (레포 소스 아님). 빈
  디렉터리에 `npm install`한 실물을 stdio로 직접 구동.
- **관점**: Argus를 처음 쓰는 제3자. 한국어 사용자.
- **레포 기준선**: `origin/main` = `ad62aa6a`.
- **판**: 3차 주행까지 마친 뒤 **전면 재작성**. 이전 판(1·2차 append 형태)은
  `git log`에 남아 있다.

---

## §0. 이 기록을 어떻게 읽어야 하나

**초판에서 나는 두 번 "없다"고 썼고 두 번 다 틀렸다.** 원인은 같다 —
*내가 못 찾은 것*을 *존재하지 않는 것*으로 적었다. 겉에서만 쓰는 방식(그건
UX 관찰에는 맞는 방법이었다)으로 얻은 증거를 가지고 **코드에 대한 주장**을
썼기 때문이다.

그래서 이 판은 규칙을 바꿨다:

> **모든 항목에 `검증` 줄을 붙인다.** 그 줄에 적힌 명령으로 직접 확인했다는
> 뜻이다. 확인하지 못한 것은 "없다"가 아니라 "찾지 못했다"로 쓴다.

전수 재확인 결과 집계 (항목 16개):

| | 개수 |
|---|---|
| 재확인에서 **유지** | 12 |
| **철회** (사실이 아님) | 1 |
| **정정** (현상은 맞고 원인이 틀림) | 1 |
| **오분류** (결함이 아니라 이미 판단된 설계) | 2 |

§4에 넷을 전부 남겼다. 지우지 않는다 — 이 기록을 근거로 짓는 세션이
**어떤 종류의 오류가 섞이는지** 알아야 하기 때문이다.

### 주행의 한계

1. **시간을 조작했다.** 확인일 도래를 보려고 `ledger.jsonl`의 `check_by`를
   직접 수정했다. 사용자 행동이 아니다.
2. **웹앱 화면은 타지 않았다.** 브라우저 확장이 이 기계에 연결돼 있지 않다.
   MCP 표면만이다. 웹앱에 대한 진술은 전부 **코드 확인**이지 실주행이 아니다.
3. **플러그인 표면도 실주행하지 않았다.** 스킬 파일과 문안만 읽었다.

---

## §1. 하나의 패턴 — 지어놓고, 기본값으로 꺼두었다

개별 문제로 보이던 것들이 사실 한 모양이다. **기능은 이미 있다. 기본 상태가
그것을 안 보이게 하거나 무력화한다.** 그래서 코드를 읽으면 "다 있는데"로
보이고, 써 보면 "아무것도 없는데"가 된다. 여섯 건 모두 **각자의 단위
테스트는 초록**이면서 사용자에게 도달하지 않는다.

### 1.1 축적 화면이 만들어지고 문장에는 안 실린다

`argus_patterns` 응답의 `data.wake_text`에 완성된 항해일지가 들어 있다:

```
┌─ ARGUS · 항해일지 ────────── 결정 2 · 확인 대기 1 · 결과 기록 1 ─┐
  ~ 바다 위 · 결과를 기다리는 중 (1)
    "직접 채용하면 3개월 안에 배…"   확인 08-05  ·  hire-vs-agency
  ⚓ 닻 내린 기록 · 현실이 답함 (1)
    빗나감 · "가격을 올려도 첫 달 이탈이 …"   07-29  ·  price-raise
└───────────────────────────────────────── 2026-07-29부터 항해 중 ─┘
```

사용자가 듣는 `surface`는 **`"결과를 기다리는 예측 1건."`** 한 줄이다.
`active`·`all` 두 뷰에서 같았다.

- **검증**: `grep -n "wake_text: wake" argus-mcp/src/tools/recall.ts`
  → `:233`, `:251` 둘 다 `data:` 안에만 있다. `surface`는 별도 변수다.
- **대조군**: `argus_resolve`는 영수증을 `surface`에 실어 보낸다. 같은 성격의
  산출물을 두 도구가 다르게 취급한다.
- **빨간불 조건**: `wake_text`가 있는 응답에서 `surface`가 그 내용을 담지
  않으면 실패하는 테스트.

### 1.2 "다가오는 확인일" 기능이 꺼진 채 출고된다

`argus_check_in`에 `include_upcoming_days`가 있고 실제로 구현돼 있다. 기본값이
**`0`**이라 `upcomingLine`이 빈 문자열이 되고, 봉인 직후 다시 들어온 사용자는
이 문장을 받는다:

```
surface      : "지금 확인할 차례가 된 것은 없습니다."
next_actions : ["stop"]
data.open_predictions : [ 2건 — 문장·확인일 전부 들어 있음 ]
```

같은 상태를 `argus_patterns`는 `"결과를 기다리는 예측 2건."`이라고 말한다.
**세션 시작에 도는 쪽이 "없음"이다.**

- **검증**: `grep -n "include_upcoming_days" argus-mcp/src/tools/check-in.ts`
  → `:72` `.default(0)`. 실주행에서 `upcoming` 키 자체가 응답에 없었다.
- 참고: `surfaces.ts:571`에 `live_no_due(total)` = "계정에 살아 있는 예측
  N개. 확인할 차례가 된 것은 없습니다."가 **이미 있다.** 계정 경로에만 쓰인다.
- **빨간불 조건**: 열린 예측이 있는데 `surface`가 그 존재를 한 번도 언급하지
  않으면 실패하는 테스트.

### 1.3 조기 정산 차단이 정확히 거꾸로 달려 있다

`PREMATURE_SETTLE` 가드는 **있다.** 걸리는 자리가 반대다.
`argus-mcp/src/tools/settle.ts:245~256`:

```js
if (outcome === 'still_pending') {
  if (checkBy && checkBy > today) {
    return toolError({ error_code: 'PREMATURE_SETTLE', … });
  }
  return await deferStillPending({ … });
}
// ↓ held / missed / avoided / partial 은 여기 오는 동안 날짜 검사가 없다
```

실측 — 오늘 `2026-07-29`, 확인일 `2026-09-01` (**34일 전**):

| 정산 시도 | 결과 |
|---|---|
| `still_pending` (= 현실이 아직 답 안 함. **기록을 닫지 않는다**) | `PREMATURE_SETTLE` — 막힘 |
| `held` (= 예측대로 됐다. **닫고 영수증을 낸다**) | **통과** |

닫지 않는 쪽만 막고 닫는 쪽은 통과시킨다. 그리고 막힐 때 나오는 안내가
*"`still_pending`에 `defer_to`로 새 확인일을 전달하면 됩니다"* — 방금 막힌
그 값을 쓰라고 한다.

조기 정산된 영수증에는 두 날짜가 나란히 남지만 **조기라는 표시는 없다**:

```json
{ "check_by": "2026-08-05", "settled_at": "2026-07-29T07:16:15.642Z",
  "outcome": "held", "what_happened": "벌써 됐다" }
```

`argus_patterns view="receipt"`는 이걸 *"예측은 당신이, 답은 현실이 했습니다"*
로 읽어 준다.

- **검증**: `grep -rn "PREMATURE_SETTLE" argus-mcp/src --include=*.ts`
  → 발생 지점은 `settle.ts:252` 하나뿐이고 `still_pending` 분기 안이다.
  라이브 2회 대조(`still_pending` 막힘 / `held` 통과).
- **주의**: `settle.ts:246~248` 주석이 "조기 defer 허용은 상태기계 설계와
  충돌한다 — 1.4.x에서 스파인 검토 후에만"이라고 적고 있다. 즉
  `still_pending` 쪽 차단은 **의도**다. 관찰 대상은 그 의도가 **종결 outcome
  네 개에는 적용되지 않는다**는 점이다.
- **빨간불 조건**: `check_by > today`인데 종결 outcome 정산이 성공하면
  실패하는 테스트. (혹은 성공시키되 영수증에 조기 여부가 남는지 보는 테스트.)

### 1.4 전제 지켜보기 스위치가 조용히 무효다

`premises[].monitoring_enabled`의 기본값은 **`true`**이고 원장에도 `true`로
기록된다. 그런데 판정 함수는 `external === true`를 요구하고, `external`의
기본값은 **`false`**다. 결과: 조회하면 `monitored: false`, 사용자는
**"0건 추적 중"**을 듣는다.

```json
원장 : {"event":"premise_add","load_bearing":true,"monitoring_enabled":true,"external":false}
조회 : {"ref":"P1","load_bearing":true,"monitored":false}
문장 : "이 결정에 전제 1건이 있습니다. 0건 추적 중, 0건 재확인 차례."
```

- **검증**: `sed -n '183,189p' argus-mcp/src/lib/premises-core.ts`
  → `isMonitored`는 `kind==='premise' && status==='active' && external &&
  load_bearing && monitoring_enabled !== false`.
- **핵심**: 이 의존 관계는 **내부 도구에는 적혀 있고 공개 도구에서는 빠졌다.**
  `argus-mcp/src/tools/premises.ts:63` describe에는
  `"external + load_bearing arms re-checking"`이 있는데,
  공개 스키마 `argus-mcp/src/tools/public-tools.ts:29`의 한국어 describe는
  "외부 현실에서 나중에 다시 확인할 수 있는 사실인지 표시합니다"뿐이다.
  모델은 공개 도구만 본다.
- **빨간불 조건**: `monitoring_enabled:true`로 기록됐는데 `monitored:false`로
  읽히는 조합이 생기면 실패하거나, 최소한 그 사실을 문장에 담게 하는 테스트.

### 1.5 계정·웹앱 안내가 이미 연결한 사람에게만 뜬다

```js
const accountHint = accountCredentialStatus() === 'ok' ? S.account_hint : '';
```

연결 안 한 사람(`no_token`)에게는 빈 문자열이다. 그리고 그 상태의 침묵은
명시된 설계다 (`argus-mcp/src/lib/surfaces.ts:304`):

```
/** account-sync voice (3-state): success speaks, no_token stays silent. */
```

- **검증**: `grep -n -A2 "const accountHint" argus-mcp/src/tools/check-in.ts`
  → `:291~293`. 실주행 봉인 응답: `account_synced:false, reason:"no_token"`.
- **온램프가 반대 방향이다**: 초대는 이미 들어온 사람에게만 보인다.

### 1.6 웹앱 주소가 사용자 문안에 없다

- **검증**: `grep -c "argus\.voyage" argus-mcp/src/lib/surfaces.ts
  argus-mcp/src/lib/localize-result.ts` → **`0`, `0`**.
  `argus-mcp/src` 전체에서 `argus.voyage`가 나오는 곳은 API 기본값
  (`a0/account-connect.ts:10`, `a0/account-credentials.ts:120`), 텔레메트리
  (`lib/telemetry.ts:130`), 아이콘 URL(`tools/index.ts:30~31`)이다.
  플러그인 쪽도 `argus-plugin-v2/scripts/push-webapp.js`의 기본 URL뿐이다.
- 즉 **사용자에게 나가는 문장 중 주소를 말하는 것을 찾지 못했다.**

> **창업자 진술 (2026-07-29, 이 기록을 읽고):** 침묵은 웹앱 미공개 때문이지만,
> **처음 쓰는 사람에게 웹앱의 존재와 주소를 알리고 가입으로 잇는 것은 원래
> 하기로 한 것.** 따라서 §1.5·§1.6은 "설계대로"가 아니라 **미시공**으로
> 읽어야 한다. 이 줄은 관찰이 아니라 창업자 진술이며, 시공 범위는 BLUEPRINT
> 공정 규약을 따를 것.

---

## §2. 스파인에 닿는 관찰

### 2.1 영수증을 읽는 순간 전제를 고칠 수 없다

영수증이 사용자에게 보여주는 줄:

> **검증 안 된 전제:** 지금 쓰는 사람들은 가격이 두 배가 돼도 대부분 남는다

이 문장의 출처는 `ai_surfaced` — **AI가 쓴 문장**이다. 이어서 교정을 시도하면:

```
[실패] DECISION_CLOSED: 닫힌 결정이라 더 진행할 수 없습니다.
[복구안내] 필요하면 새 id로 다시 여세요. 닫힌 기록은 그대로 남습니다.
```

- **검증**: `grep -rn "DECISION_CLOSED" argus-mcp/src --include=*.ts`
  → 상태기계 `lib/state-machine.ts:166`이 닫힌 결정의 모든 이벤트를 거부.
  진입점 `tools/amend-dismiss.ts:44`. 라이브 재현 1회.
- **참조는 얻을 수 있다**: `argus_patterns view="decision_context" id=<id>`가
  `ref:"P1"`, `premise_id:"p_ykj1rf"`를 돌려준다 (§4에서 철회한 항목 참조).
  막히는 원인은 조회 부재가 아니라 **상태 전이 규칙**이다.
- **긴장 관계**: 닫힌 기록을 되열지 않는 것은 원장 무결성 규약으로 보인다
  (`state-machine.ts:125` 주석). CLAUDE.md 스파인 1항은 provenance 태깅과
  함께 **사용자의 교정 여지**를 요구한다. 무엇이 우선인지는 이 기록이 정할
  문제가 아니다 — **사용자가 교정하고 싶어질 가능성이 가장 높은 시점이 유일하게
  막힌 시점**이라는 사실만 남긴다.
- **빨간불 조건**: `ai_surfaced` 전제가 실린 영수증을 낸 뒤, 그 전제에 대한
  사용자 교정이 어떤 경로로든 원래 기록에 도달하는지 확인하는 여정 테스트.

### 2.2 억제 문안 하나가 코드의 자기 계약을 어긴다

`argus-mcp/src/tools/open-decision.ts:122~124` 주석이 계약을 직접 적어 두었다
(문구가 줄바꿈으로 갈라져 있어 `grep "never a directive"`로는 안 잡힌다):

> the line ENDS by naming the option and returning the handle —
> **never a directive ("leave it") issued in the user's stead**

여섯 이유 문자열 중 `low_stakes` 하나만 권고형이다:

| 이유 | EN (`surfaces.ts:475~480`) | KO (`:642~647`) |
|---|---|---|
| vent / factual / already_closed / flat / reversible_low_stakes | 전부 순수 서술 | 전부 순수 서술 |
| **low_stakes** | **…so the steady move is to leave it as is.** | **…그대로 두는 편이 무난합니다.** |

배정도 봐야 한다. `argus-mcp/src/lib/overfire-gate.ts:47~55`:

```js
if (s.reversibility === 'easily_reversible' && s.stakes !== 'high')
  return { reason: 'reversible_low_stakes', … };   // 되돌리기 쉬운 쪽은 여기서 빠짐
if (s.stakes === 'trivial' || s.stakes === 'low')
  return { reason: 'low_stakes', … };              // ← 남는 건 "되돌리기 어려운" 쪽
```

즉 `low_stakes`는 **걸린 것은 작지만 되돌리기 어려운** 결정에 배정된다.
실측(`stakes:"low"`, `reversibility:"one_way_door"`, "손목에 문신을 할지"):

> 걸린 것이 별로 없습니다. **그대로 두는 편이 무난합니다.** 그대로 두는 것도
> 여전히 진짜 선택지입니다.

되돌릴 수 없는 행동에 권고가 나가고, 같은 말이 두 번 나간다.

- **검증**: 위 두 `sed`/`grep` + 라이브 4시나리오(사소·이미결정·중대하나
  되돌리기쉬움·사소하나 되돌리기어려움).
- **빨간불 조건**: 억제 이유 문자열에 권고형 술어가 들어가면 실패하는 문안
  validator. (레포에 이미 `notification-copy-validator.test.ts` 선례가 있다.)

### 2.3 코다가 문맥과 무관하게 붙는다

- **검증**: `grep -n "leave_coda" argus-mcp/src/tools/open-decision.ts`
  → `:127` 한 곳. 비발화 분기 전체에 무조건 이어 붙는다.

`already_decided:true` + "이미 계약서에 서명했다. 사무실을 강남으로 옮기기로
했다"에 대해 나온 문장:

> 이미 내린 결정입니다. Argus는 이걸 다시 열지 않습니다.
> **그대로 두는 것도 여전히 진짜 선택지입니다.**

앞 문장이 "다시 열지 않는다"고 해놓고 뒤 문장이 선택지를 제시한다.

### 2.4 사용자가 쓴 적 없는 값을 확인하라고 한다

`stakes:"high"` + `reversibility:"easily_reversible"`에서 (`surfaces.ts:652`):

> 신호가 서로 어긋납니다 (걸린 것은 큰데 되돌리기는 쉽습니다).
> 더 나아가기 전에 **이 둘을 다시 짚어 보세요.**

`stakes`·`reversibility`는 사용자 발화가 아니라 **모델이 채운 도구 인자**다.

### 2.5 검증 실패한 호출이 원장에 이미 쓰고 실패한다

`PROVENANCE_REQUIRED`로 **실패한** 호출인데 원장에 남았다:

```
06:10:03  gate_input  price-raise   ← 실패한 호출
06:10:03  harvest     price-raise   ← 실패한 호출
06:10:54  gate_input  price-raise   ← 성공한 호출
06:10:54  harvest     price-raise   ← 성공한 호출
```

- **검증**: `sed -n '95,110p' argus-mcp/src/tools/open-decision.ts`
  → `harvest` append가 `:104`, 전제 처리보다 **먼저**다. 바로 위 `:95~99`
  주석은 "게이트와 무관하게 기록한다"는 의도를 적고 있는데, 그 의도의 대상은
  **게이트**이고 **인자 검증 실패**는 고려 범위 밖으로 보인다.
- 사용자 집계(`seal` 기준)는 어긋나지 않았다. 원장에만 중복이 남는다.

---

## §3. 말 — 감이 아니라 숫자로

두 문안 파일의 한국어 문장을 전부 뽑아 도구명·파라미터 문법·경로·환경변수가
섞였는지 셌다. **결과가 내 예상과 반대였다.**

| 대상 | 개수 | 개발자 말이 섞인 것 |
|---|---|---|
| 에러의 `message` (사용자가 보는 줄) | 48 | **2건 (4%)** |
| 에러의 `recovery` (모델에게 주는 줄) | 48 | 33건 (69%) |
| `surface` (사용자에게 나가는 문장) | 90 | **11건 (12%)** |

**에러 문안 설계는 좋다.** 사용자 줄과 모델 줄이 갈라져 있고 사용자 줄은 거의
사람 말이다. (오염 2건: `BAD_CHECK_BY`의 `YYYY-MM-DD`, `ARGUS_DIR_INVALID`의
`argus_dir / ARGUS_DIR`.)

**다만 `recovery`가 모델용이라는 표시가 없다.** 실패 응답에서 `message`와
`recovery`가 같은 층에 나란히 있어, 호스트/모델이 통째로 옮기면 69%가 그대로
새어 나간다.

### 3.1 문제가 몰린 곳 — `surface` 11건, 그중 8건이 같은 것을 시킨다

```
[account_hint]     … argus_settings action=sync로 가져올 수 있습니다.
[settled_on_web]   … argus_settings action=sync에 import_settlements:true를 주면 …
[push_up_failed]   … 나중에 argus_settings action=sync를 다시 실행하세요.
[import_failed]    … .argus 폴더에 쓸 수 있는지 확인한 뒤 argus_settings action=sync를 …
[sync_failed] ×4   … 나중에 argus_settings action=sync를 시도하세요.
```

여기서 볼 것은 어휘가 아니라 **수신자**다.

- **MCP 사용자에게**: `argus_settings`는 MCP 도구라 **사용자가 칠 수 없다.**
  모델만 부를 수 있다. 그런데 문장은 사용자에게 "실행하세요"라고 한다.
- **플러그인 사용자에게**: 칠 수 있는 명령이 **있는데 이름이 다르다.**
  `argus-plugin-v2/skills/sync/SKILL.md`가 실재한다 (`/argus:sync`).

그리고 이게 오류라는 근거가 같은 파일 안에 있다 — **대조군**:

- `grep -c "/argus:connect" argus-mcp/src/lib/surfaces.ts` → **4**
  (예: "터미널에서 `npx argus-decision-mcp connect`로 다시 연결하세요
  **(플러그인은 /argus:connect)**")
- `action=sync` 문안 중 `/argus:sync`를 병기한 것 → **0**

즉 이 레포는 **두 표면을 병기하는 관행을 이미 갖고 있고**, sync 계열에만
적용되지 않았다.

나머지 3건: `reconsider_more`의 `(argus_capture)`, `promoted`의
`argus_predict로 저장하세요`, `truncation`의 `limit을 올리거나 due_only로
좁히세요`.

- **빨간불 조건**: `surface` 문자열에 `argus_[a-z_]+`나 `action=` 같은
  파라미터 문법이 들어가면 실패하는 테스트. (`recovery`는 제외 — 모델용이 맞다.)

### 3.2 같은 것을 두 가지로 부른다

| 개념 | 표현 A | 표현 B |
|---|---|---|
| 누가 판단했나 | "이 판단을 내린 사람: 나 (모델 아님)" | "나. (모델이 아니라)" |
| 확인일이 된 예측 | "결과를 기록할 예측 N건" | "저장한 예측 N건이 확인일을 지났습니다" |
| 저장된 예측 | "저장한 예측" | "확인 대기" |

### 3.3 정보량이 낮은 문장

> 이 결정에 전제 1건이 있습니다. 0건 추적 중, 0건 재확인 차례.

숫자 셋 중 둘이 0이고, "추적"과 "재확인"이 무엇인지 설명이 없다. 전제 문장
자체는 `data.premises[].text`에 있으나 문장에는 실리지 않는다 (§1.1과 같은 모양).

---

## §4. 틀렸던 것 — 지우지 않고 남긴다

### 4.1 철회 — 사실이 아니었다

**"전제 `ref`를 얻을 도구가 없다"** → **틀렸다.**
`argus_patterns view="decision_context" id=<id>`가 `ref`와 `premise_id`를
포함한 목록을 돌려준다. 나는 `argus_patterns`의 인자 스키마를 열어보지 않고
단정했다. **§2.1은 그대로 유효하다** — 원인이 조회 부재가 아니라 상태 전이일
뿐이다.

### 4.2 정정 — 현상은 맞고 원인이 틀렸다

**"조기 정산을 막는 가드가 없다"** → **가드는 있다. 방향이 반대다.** §1.3으로
다시 썼다. 관찰("34일 전인데 정산이 통과했다")은 맞았고, 원인 진단이 틀렸다.

### 4.3 오분류 — 결함이 아니라 이미 판단된 설계

둘 다 코드 주석에 판단 근거가 남아 있는데 내가 찾지 않고 새 발견처럼 적었다.

**(a) 첫 문장이 영어인 것.** `argus-mcp/src/lib/surfaces.ts:26~29`:

> Locale resolution is CONFIG-ONLY and deterministic … **No config → 'en'**
> (the MCP's base voice), so tests and fresh dirs behave the same on every machine.

기계마다 같게 동작시키기 위한 **의도된 트레이드오프**다. 남는 관찰은 좁다 —
한국어 사용자의 **첫 문장은 영어, 두 번째부터 한국어**로 바뀐다. 그 교환이
맞는지는 제품 판단이지 결함이 아니다.

**(b) 달력 파일 경로를 문장에 안 넣은 것.** `argus-mcp/src/tools/seal.ts:347~352`:

> dumping the absolute path — and the English label "Calendar file:" — into a
> one-line surface was noise, and broke the Korean voice (copy-audit / loop
> find). Mention it briefly, localized; keep the path in data.

**이미 문안 감사를 거쳐 내린 결정**이다. 남는 관찰은 "사용자가 파일을 찾을
경로가 문장에 없다" 하나뿐이고, 그건 이미 저울질된 비용이다.

---

## §5. 잘 작동하는 것 (대조군)

이 기록이 결함 목록으로만 읽히면 판단이 왜곡된다.

- **영수증.** `AI VERDICT ON THIS DECISION ······ NONE` / "모델은 당신을
  채점하지 않았습니다. 현실이 답했습니다." 빗나간 예측을 기록했는데 기분이
  나쁘지 않았다. 의도대로 작동한다.
- **억제 게이트가 실제로 억제한다.** 사소·되돌리기 쉬움·이미 결정함·평평함
  네 경우 모두 `fork_emitted:false`, `crux_question:null`. 갈림길을 지어내지
  않는다. §2.2의 문제는 **문안**이지 게이트의 판정이 아니다.
- **동시성이 견고하다.** 서로 다른 프로세스 8개가 같은 `argus_dir`에 동시
  봉인 → 8/8 성공, 원장 16줄, JSON 파싱 실패 0, seal 유실 0.
- **상태 전이 가드가 정확하다.** 없는 id 정산 → `NO_PRIOR_SEAL`, 재정산 →
  `ALREADY_SETTLED`, 이중 봉인 → `ILLEGAL_TRANSITION`. 조용히 성공하지 않는다.
- **에러 복구 안내가 스파인을 지킨다.** 모든 검증 실패에 "사용자가 정해야 할
  값은 추측하지 마세요"가 붙는다.
- **기록이 실제로 디스크에 도착한다.** 원장·영수증·`.ics`·`current_bearing`
  전부 생성됐고, 건너뛴 칸은 `"(skipped)"`로 남았으며 `ai_verdict`는 `null`이었다.

---

## §6. 재현

```bash
mkdir journey-probe && cd journey-probe && npm init -y
npm install argus-decision-mcp@2.0.9
# stdio: initialize → notifications/initialized → tools/call
# argus_dir는 OS 네이티브 절대경로. Windows에서 /c/Users/... 형태의 POSIX
# 경로를 주면 C:\c\Users\... 아래에 조용히 생성되고 도구는 성공을 보고한다.
```

호출 순서: `argus_check_in` → `argus_capture(action:"open", premises:[…])` →
`argus_predict` → `argus_check_in` → `argus_resolve(outcome, what_happened)` →
`argus_patterns(view:"active"|"all"|"decision_context"|"receipt")`.

`check_by`는 오늘도 거부되므로(`BAD_CHECK_BY`), 루프 후반부를 한 세션에서
보려면 원장의 `check_by`를 과거로 옮겨야 한다.

문안 전수 측정은 `localize-result.ts`와 `surfaces.ts`에서 한국어 리터럴을
뽑아 `argus_[a-z_]+` / `action=` / `.argus` / `${…}` 패턴을 세면 재현된다.

---

*이 기록은 판정이 아니다. 각 항목의 "빨간불 조건"이 채워지기 전까지 어느
것도 exit 체크를 대신하지 않는다. 그리고 §4가 보여주듯 **이 기록도 틀린다** —
16개 중 4개가 재확인에서 뒤집혔다. 항목을 근거로 짓기 전에 `검증` 줄의 명령을
직접 돌려볼 것.*
