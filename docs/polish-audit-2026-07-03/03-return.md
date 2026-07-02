# 03 — 두 번째 방문 감사: "2주 뒤에 돌아오고 싶어지는 이유"

> 감사 방식: 귀환 경로 전부를 코드로 추적(이메일 크론, 텔레그램 크론 2개, 웹훅, 헤더 배지,
> /project 정산 진입점, 워크스페이스 착륙 화면, 플러그인 statusline) + 실DB(overture-db) 대조.
> 추측 없음 — 모든 발견에 파일:줄 인용.

## 요약 (5줄)

1. **가장 잘 만든 귀환 알림의 답장 버튼이 전부 죽어 있다.** 웹에서 봉인한 결정의 텔레그램 리마인더(checkin-due 크론)가 보내는 "Happened/Avoided/Partial/Still pending" 버튼의 콜백(`stl1|…`)을 받아주는 코드가 웹훅에 없다 — 눌러도 아무 일도 안 일어난다. 실DB 확인: 이 리마인더가 실제 1건 발송됐다(즉, 이미 한 명이 죽은 버튼을 받았다).
2. **돌아온 사용자의 첫 3초가 비어 있다.** 주 출입구인 /workspace는 due를 한 글자도 모른다 — 착륙 화면(이어서 작업 목록 포함)에 due 표시 0, 봉인된 프로젝트로 바로 착륙하면 2주 전에 본 "최종 문서가 완성됐어요"가 다시 나온다. 귀환을 알아보는 화면은 /project 하나뿐(거기는 모범).
3. **텔레그램에 두 개의 뇌가 산다.** 웹 봉인이 telegram_decisions로 미러링되면(정상 설계) 만기일에 따뜻한 한국어 알림(telegram-reminders)과 영어 기계문 알림(checkin-due)이 같은 결정에 대해 둘 다 나가고, 한쪽에서 정산해도 다른 쪽(웹 계약)은 안 닫힌다.
4. **이메일 귀환은 서류상으로만 존재한다.** 크론·발송 코드·본문 전부 실재하지만 옵트인(`email_reminder`)을 켜는 UI가 없어 실DB 옵트인 0건·발송 0건. 본문도 영어다. (04-배신·02-목소리 발견 재확인 — 여전히 그대로.)
5. 처방: 죽은 버튼부터 살리고(스펙 S1), 워크스페이스 착륙에 "등불 한 줄"을 달아(S3) 3초 안에 ①뭘 봉인해뒀는지 ②지금 뭘 하면 되는지 보이게 한다. 모든 귀환 경로의 종착지는 이미 약속된 항구(/project)로 통일한다.

---

## 현재 귀환 경로 전수 지도 (연결 상태 실측)

| # | 경로 | 상태 | 근거 |
|---|------|------|------|
| 1 | **텔레그램 — 텔레그램에서 봉인한 결정** (telegram-reminders 크론) | ✅ 작동 (따뜻한 한국어, 1회만 질문, 버튼 정산 작동) | `src/app/api/cron/telegram-reminders/route.ts:51-77`, 버튼 처리 `src/app/api/telegram/webhook/route.ts:666-667` → `handleSettle` :499-554 |
| 2 | **텔레그램 — 웹에서 봉인한 결정** (checkin-due 크론의 텔레그램 다리) | ⚠️ 발송은 되나(실DB 1건) **버튼·답장 전부 죽음** + 영어 기계문 + 7일마다 무한 반복 | 발송 `src/app/api/cron/checkin-due/route.ts:130-159`, 죽은 버튼 아래 P0-1 |
| 3 | **이메일** (checkin-due 크론의 이메일 다리) | ❌ 죽은 기능 — 옵트인 UI 없음, 실DB 옵트인 0·발송 0, 본문 영어 | `src/app/api/cron/checkin-due/route.ts:105-107`, `src/stores/types.ts:630`(타입에만 존재), 본문 `src/lib/checkin-reminder.ts:36-43` |
| 4 | **이메일 — 검수(Companion Brief)** | ✅ 코드는 모범(따뜻한 한국어·주1회 상한) / 데이터 0 — review_receipts 0행이라 보낼 게 없음 | `src/app/api/cron/companion-brief/route.ts:67-74`, 카피 `src/lib/companion-brief.ts:44-76`, 실DB receipts=0 |
| 5 | **헤더 골드 배지** (프로젝트 due + 검수 due 합산, 익명 포함) | ✅ 작동 — 단, 목적지가 조건 분기(/project vs /tools/review)로 갈라짐(05-뺄셈 P0 기재) | `src/components/layout/Header.tsx:66-86, 197-206` |
| 6 | **/project — 약속된 항구** | ✅ 모범 — due 스트립 + 카드 앰버 테두리 + 프로젝트 열면 정산 모달이 먼저 물음 | 스트립 `src/app/[locale]/project/page.tsx:478-505`, 자동 모달 :109-119, :838-846 |
| 7 | **/workspace — 주 출입구** | ❌ 귀환 인식 0 — due를 읽는 코드 자체가 없음 | `contractStatus`/`checkInDue` grep 0회 (`src/app/[locale]/workspace/page.tsx` 전체), 이어서 작업 목록 :703-758 |
| 8 | **랜딩(/)** | ❌ 인식 0 — 로그인 사용자에게도 마케팅 화면 + "워크스페이스 →" 링크뿐 | `src/components/landing/LandingHeader.tsx:98-112` |
| 9 | **.ics 캘린더 약속** | ✅ 작동 (사용자 소유 리마인더, /project로 안내) | `src/components/workspace/progressive/SealMoment.tsx:247-273` |
| 10 | **플러그인 statusline** | ✅ 작동 (OVERDUE 최우선 위계, 로컬 원장 기반) — 개발자 표면으로 유지(10-최악의날 권고 동의) | `argus-plugin-v2/statusline/index.js:6-13` |

실DB 스냅샷 (2026-07-03, overture-db):
계약 6건(전부 확인일 있음) · 이메일 옵트인 0 · 이메일 발송 0 · 텔레그램(웹 계약) 발송 1 ·
정산 완료 3 · telegram_decisions 봉인 1(리마인드 0) · review_receipts 0.
**즉, 지금까지 실제로 발송된 귀환 알림은 단 1건이고, 그 1건이 아래 P0-1의 죽은 버튼 메시지다.**

---

## 발견 목록 (심각도순)

### P0-1. 귀환 알림의 정산 버튼·답장이 전부 죽어 있다 (보내는 쪽만 있고 받는 쪽이 없음)

- **무엇**: checkin-due 크론이 웹 봉인 계약의 만기일에 텔레그램으로 보내는 메시지에는
  4개 버튼(콜백 `stl1|h|…` 형식, `src/lib/telegram-settlement.ts:50-69`)과
  "reply with: happened / avoided / partial / still pending" 안내(:87), `ARGUS_SETTLE:…` 토큰(:88)이 붙는다.
  그런데 텔레그램 웹훅의 콜백 분기(`src/app/api/telegram/webhook/route.ts:629-670`)는
  `rf:` `rh:` `sl:` `st:` `rc:` 만 처리한다 — **`stl1|`/`stl|` 분기가 없다.**
  메시지 쪽도 `/settle` 명령·토큰 답장 파싱이 없다(웹훅 파일에서 `ARGUS_SETTLE`/`parseSettlementIntent` 출현 0회).
  받는 쪽 로직(`parseSettlementIntent`, `applyTelegramSettlement`,
  `src/lib/telegram-settlement.ts:92-167`)은 완성돼 있고 한국어 답장까지 수용하지만(:26-29)
  **테스트 파일 말고는 아무도 import하지 않는다** (`src/lib/__tests__/telegram-settlement.test.ts`가 유일한 소비자).
- **사용자 체감**: 만기일 아침, 봉인한 결정에 대해 "Tap a button"이라는 메시지가 온다.
  버튼을 누르면 스피너만 사라지고(`answerCallback`, webhook:624) **아무 응답이 없다.**
  안내대로 "happened"라고 답장해도 봇은 그걸 새 고민으로 알고 리프레임을 시작한다.
  게다가 이 메시지는 7일마다 다시 온다(`RESEND_DUP_WINDOW_MS`, checkin-due:28,132).
  "정한 날 돌아와 물어요"라는 제품의 단 하나의 약속이, 물어놓고 대답을 못 받는 상태다.
- **실증**: 실DB `telegram_reminder_sent_at` 스탬프 1건 — 이 죽은 메시지가 이미 실사용자(창업자 dogfood)에게 나갔다.

### P0-2. 돌아온 첫 3초 — 주 출입구(/workspace)가 귀환을 전혀 모른다

2주 뒤에 돌아온 사용자가 밟는 문은 셋인데, 그중 둘이 캄캄하다:

- **(a) /workspace 착륙(HeroFlow)**: due 개념이 파일에 존재하지 않는다
  (`src/app/[locale]/workspace/page.tsx`에서 `checkInDue`/`contractStatus` 검색 0회).
  "이어서 작업" 목록(:703-758)은 updated_at 순 정렬 + "N일 전"만 보여준다 —
  봉인해 둔 결정과 그냥 만지작거린 프로젝트가 똑같이 생겼고, **due인 프로젝트가 3번째 밖이면 접혀서 아예 안 보인다**(:709 `slice(0, 3)`).
  참고: `VoyageEta` 컴포넌트 주석(:5-6)은 "workspace home 이어서 작업"에서 쓰인다고 적어놨지만
  실제 사용처는 /project 카드 한 곳뿐이다(`src/app/[locale]/project/page.tsx:630`) — 주석 드리프트이자, 원래 설계가 여기 붙으려 했다는 증거.
- **(b) /workspace 착륙(봉인된 프로젝트로 직행)**: `currentProjectId`가 영속이라(workspace:1024-1028 주석)
  돌아온 사용자는 마지막 프로젝트의 완료 화면으로 바로 떨어진다. 그 화면의 첫 문장은
  **"최종 문서가 완성됐어요"**(`src/components/workspace/progressive/ProgressiveFlow.tsx:3171-3174`) —
  2주 전에 이미 본 문장이다. 정산 카드(SealMoment→DecisionContractCard의 due 상태
  "물어볼 게 N개 있어요", `src/components/projects/DecisionContractCard.tsx:355-357`)는
  FinalCard·현재 방위 카드 아래, 화면 서너 스크롤 밑에 깔려 있다(ProgressiveFlow:3179-3223 순서).
  봉인 때 한 약속은 "프로젝트 페이지에 **오시면 제가 먼저 물어요**"(SealMoment:350)인데,
  먼저 묻는 화면은 /project뿐이고 워크스페이스는 침묵한다.
- **(c) 랜딩(/)**: 로그인된 귀환자에게도 마케팅 캔버스 그대로. LandingHeader의 유일한 앱 링크
  "워크스페이스 →"(LandingHeader.tsx:100-112)에 due 표시가 없다.

밝은 문은 /project 하나: due 스트립(project/page.tsx:478-505) + 열면 정산 모달이 먼저 묻는 구조(:109-119)는 이미 모범.
문제는 **사용자를 그 문 앞까지 데려다주는 것이 헤더의 14px 골드 점 하나뿐**이라는 것(Header.tsx:197-206).

### P0-3. 텔레그램의 두 뇌 — 같은 결정에 알림 2번, 정산은 반쪽

- **이중 발송**: 텔레그램을 연결한 사용자가 웹에서 봉인하면 `syncSealToTelegram`이
  telegram_decisions에 미러 행을 만든다(SealMoment.tsx:187-200, `src/app/api/decisions/telegram-sync/route.ts:98-110` — 설계 의도).
  만기일(두 크론 모두 매일 0시 UTC, vercel.json:12-22)에:
  - telegram-reminders가 미러 행을 읽고 **따뜻한 한국어**("그래서, 어떻게 됐어요?")를 1회 보낸다(telegram-reminders:66-77).
  - checkin-due가 projects.decision_contract를 읽고 **영어 기계문 + 원시 토큰**을 또 보낸다 — 미러 행의 존재를 확인하는 코드가 없다(checkin-due:130-159에 telegram_decisions 조회 없음). 이쪽은 7일마다 반복.
  같은 아침, 같은 결정, 두 말투, 두 벌의 버튼(한 벌은 작동, 한 벌은 죽음).
- **반쪽 정산**: 작동하는 쪽 버튼(`st:`)으로 정산하면 `handleSettle`이 **telegram_decisions만** 갱신한다(webhook:536-538).
  원본인 projects.decision_contract는 그대로 열려 있어서 — 웹 헤더 배지는 계속 켜져 있고,
  /project는 계속 "물어볼 게 N개 있어요"라고 묻고, checkin-due의 영어 메시지도 7일 뒤 또 온다.
  **사용자는 분명히 대답했는데 제품이 못 알아듣는다.** 이것이 신뢰를 깎는 최악의 형태다.

### P1-1. 이메일 귀환로는 서류상 존재 (옵트인 UI 부재 · 발송 0 · 본문 영어) — 재확인

- `email_reminder`는 타입(`src/stores/types.ts:630`)과 크론 게이트(checkin-due:105-107)에만 있고,
  이를 켜는 UI가 웹앱 어디에도 없다(grep 결과: 타입 1곳 + 크론 2곳이 전부). 실DB 옵트인 0, `reminder_sent_at` 0.
  (04-배신 P2와 동일 — 이 감사 시점에도 미수리.)
- 본문은 제목만 한국어, 본문 전체 영어("So, how did it go?" / "Return and settle",
  `src/lib/checkin-reminder.ts:36-43`). (02-목소리 P0-② 동일.)
- 링크는 `/project`(checkin-due:113)로 정확한 항구를 가리키지만, **로그아웃 상태의 기기**(모바일 메일앱→브라우저가 흔함)에서 열면
  localStorage가 비어 있어 "아직 프로젝트가 없습니다"+신규자 안내(project/page.tsx:429-444)가 뜬다 —
  10-최악의날 P0(삼중 침묵)과 같은 계열의 배신.

### P1-2. 검수(리뷰) 귀환로 — 크론은 모범인데 /project 항구에서 안 보임 + 지각 라벨 잔존

- Companion Brief는 카피·상한(주 1회) 모두 모범(`src/lib/companion-brief.ts:44-76`)이나 실DB review_receipts 0행 — 아직 한 번도 일한 적 없음(정상: 데이터 대기).
- 헤더 배지의 목적지 분기(Header.tsx:86: 프로젝트 due 있으면 /project, 아니면 /tools/review)와
  /project가 useReviewStore를 안 읽는 문제는 05-뺄셈 P0-2에 스펙이 이미 있으므로 여기선 중복 제안하지 않고 **그 스펙의 채택을 전제**로 한다.
- 지각을 세는 라벨 "확인 지남 (N일)"이 아직 살아 있다(`src/lib/review/status.ts:105-106`).
  같은 파일의 기본 라벨은 이미 "확인할 차례"(:72)로 고쳐졌는데 연체 가산 분기만 남았다. (10-최악의날 P1 일부 잔존.)

### P2-1. 죽은 귀환 부품 2개 — WakeReturn·DecisionReplayTimeline이 어디에도 연결 안 됨

- `WakeReturn.tsx`(1차 정산 — "닻 거울" 끝화면 블록)와 `DecisionReplayTimeline.tsx`는
  export만 있고 **프로덕션 import 0건**이다(전 소스 grep: 정의 파일 + 타임라인의 테스트만 검출).
  둘 다 "돌아왔을 때 그때의 생각을 다시 보여준다"는 이 감사의 주제 그 자체를 위해 만든 부품 —
  만들고 배선을 안 한 상태다.

### P2-2. 소소한 정합 어긋남

- `VoyageEta` 주석이 실제로는 없는 워크스페이스 사용처를 주장(위 P0-2(a) — S4로 주석과 현실을 일치시킴).
- checkin-due의 텔레그램 다리는 연결 안 된 사용자에 대해 매일 재시도한다(스탬프를 delivered>0에서만 찍음, checkin-due:154-158) — 무해하지만 로그 소음.
- 랜딩 "워크스페이스 →"에 귀환 신호 없음(LandingHeader.tsx:100-112) — S7(선택).

---

## 구현 스펙

우선순위 순. S1·S2가 "알림을 신뢰할 수 있게", S3·S4가 "돌아온 3초"를 만든다.

### S1 (P0-1·P0-3 수리) — 텔레그램 정산의 뇌를 하나로: 받는 쪽을 배선하고, 보내는 쪽을 한 벌로

**1단계 — 죽은 버튼 살리기.** `src/app/api/telegram/webhook/route.ts`의 콜백 분기(:629-670) 맨 앞에 추가:

```
stl1| / stl| 콜백 → parseSettlementIntent({ callbackData: data })
  → admin으로 projects에서 id=projectId 행 로드, user_id === userId 검증 (소유 확인)
  → applyTelegramSettlement(contract, intent, Date.now())
  → projects.decision_contract 갱신
  → 미러 행 동기화: telegram_decisions에서 id=projectId 행이 있으면 함께
    settled(또는 pending이면 check_by 연장 + reminded_at=null) 처리
  → 확인 답장(기존 handleSettle의 한국어 어휘 재사용):
    정산 시   "기록했어요 — {잘 됨/안 됨/반반}. 고리를 닫았어요."
    아직이면  "알겠어요. {새 날짜}에 다시 물어볼게요."
```
메시지 핸들러에도 `parseSettlementIntent({ text, replyText: reply_to_message?.text })`를
리프레임 분기보다 먼저 시도(토큰 답장·`/settle` 명령 수용 — 파서는 이미 한국어까지 완비, telegram-settlement.ts:26-29).

**2단계 — 이중 발송 차단.** `src/app/api/cron/checkin-due/route.ts`의 telegramDue 계산(:130-132)에 조건 추가:
해당 프로젝트 id로 telegram_decisions에 `status='sealed'` 행이 존재하면 **건너뛴다**
(따뜻한 telegram-reminders 크론이 그 결정의 담당). checkin-due의 텔레그램 다리는
"미러가 없는 옛 계약"의 안전망으로만 남긴다.

**3단계 — 남는 발송의 카피를 한국어 한 뇌로.** `settlementReminderText`(telegram-settlement.ts:81-89)를
seal-core의 정산 질문 문형으로 교체(02-목소리 S1과 동일 방향 — 두 감사가 같은 수술 부위):

```
그래서, 어떻게 됐어요?

「{프로젝트명}」 — 봉인할 때 이날 물어봐 달라고 하셨어요.
확인할 것: {predicate 앞 220자}

아래 버튼으로 답하거나, 이 메시지에 답장해 주세요.
(버튼: 그렇게 됐어요 / 피했어요 / 반반이에요 / 아직이에요)
```
원시 토큰(`ARGUS_SETTLE:…`)은 본문 노출 대신 답장 매칭용으로만 유지하려면 접는 위치(마지막 줄 code)로 두되, 버튼이 살아나면 사실상 안 쓰인다.

**4단계 — 반복 상한.** 같은 파일의 7일 재발송(:28,132)에 상한 3회를 추가(계약에 `reminder_count` 증가 저장),
3회째 문안 끝에 "이 알림은 이번이 마지막이에요. 언제든 프로젝트 페이지에서 답할 수 있어요." 한 줄.
(10-최악의날 S 스펙과 동일 — 탈출구 있는 절제.)

### S2 (P0-3 반쪽 정산 수리) — 텔레그램에서 답하면 웹도 닫힌다

`handleSettle`(webhook:499-554)에서 대상 행의 `source === 'web'`이면(telegram-sync가 심는 값, telegram-sync:102)
telegram_decisions 갱신에 이어 **projects.decision_contract도 같은 verdict로 갱신**한다
(행 id = projectId 이므로 조인 없이 바로 가능; `applyTelegramSettlement` 재사용).
"아직" 연장도 동일하게 양쪽에 반영(amendCheckIn). 이걸로 배지·/project·이메일·재알림이 전부 한 번에 꺼진다.

### S3 (P0-2 — 돌아온 3초의 핵심) — 워크스페이스 착륙 등불

**(a) HeroFlow 등불 스트립.** `src/app/[locale]/workspace/page.tsx`의 HeroFlow 입력 카드(:562) **바로 위**에,
due인 계약이 있을 때만 렌더:

```tsx
// projects에서 dueProjects 계산 — /project와 동일식 (project/page.tsx:260-265 재사용,
// lib/decision-contract의 contractStatus 그대로)
```
```
⚓ 그래서, 어떻게 됐어요? — 「{첫 due 프로젝트명}」{N>1 ? ` 외 ${N-1}건` : ''}
{check_in_at 날짜}에 물어봐 달라고 하셨어요.
[지금 답하기]   [나중에 할게요]
```
- "지금 답하기" → `setCurrentProjectId(p.id)` + `/project`로 이동 —
  기존 자동 정산 모달(project/page.tsx:109-119)이 그대로 먼저 묻는다. 새 정산 UI를 만들지 않는다.
- "나중에 할게요" → 이번 세션 dismiss(sessionStorage). 판정·죄책감 어휘 금지 — 다음 방문에 같은 톤으로 다시.
- 스타일은 /project due 스트립(앰버 보더, project/page.tsx:479)과 동일 계열로 — 두 화면이 같은 사건을 같은 얼굴로 말하게.
- 6개월 만의 귀환자 인식 문장(10-최악의날 S 스펙 "오랜만이에요")과 이 스트립은 같은 자리 —
  due가 있으면 이 스트립이, due 없이 오래 비웠으면 그쪽 한 줄이 우선.

**(b) 완료 화면의 귀환 재구성.** `ProgressiveFlow.tsx` complete 씬에서
`contractProject.decision_contract`가 due면(이미 갖고 있는 데이터, :1007-1014 주석 참조):
1. 완성 헤드라인(:3171-3174)을 교체:
   - 기존: "최종 문서가 완성됐어요"
   - due일 때: **"돌아오셨네요 — {check_in_at 날짜}에 물어보기로 한 게 있어요."**
2. `SealMoment`(→DecisionContractCard due 상태) 블록을 FinalCard **위**로 올린다(:3179와 :3221의 순서 교환, due일 때만).
   DecisionContractCard의 due 카피("물어볼 게 N개 있어요 / 그때 이렇게 예측했죠. 실제로는 어땠나요?",
   DecisionContractCard.tsx:355-362)는 이미 완벽 — 위치만 첫 화면으로.

이 두 개로 "3초 안에 ①뭘 봉인해뒀는지(프로젝트명+날짜+그때의 예측) ②지금 뭘 하면 되는지(답하기 버튼)"가
주 출입구 양쪽 착륙 지점에서 성립한다.

### S4 (P1) — "이어서 작업" 목록에 항해 상태 칩

HeroFlow의 프로젝트 행(:736-745)에 `<VoyageEta contract={p.decision_contract} />` 한 줄 추가
(컴포넌트 주석이 애초에 약속한 사용처 — VoyageEta.tsx:5-6). due 프로젝트는 목록 정렬 최상단으로
(project/page.tsx:268-273의 due-first 정렬식 재사용). 이걸로 4번째 이후로 접힌 due 프로젝트도 떠오른다.
"도착 예정 D-N" 카운트다운은 아직 만기 전인 재방문자에게도 "여기 돌아올 약속이 자라고 있다"를 보여주는, 두 번째 방문의 당김줄이다.

### S5 (P1-1) — 이메일 귀환로: 켜는 스위치를 달거나, 다리를 접거나

권고는 **켜기**(이미 다 지어져 있으므로):
1. SealMoment의 봉인 확인 화면(:379-390, .ics 버튼 옆)에 체크 한 줄 —
   로그인 사용자에게만: `☐ 그날 이메일로도 물어봐 주세요 ({user.email})`
   → 체크 시 `decision_contract.email_reminder = true` 저장. (04-배신 S 스펙과 동일 — 같은 수술 부위.)
2. 본문 한국어화(`renderCheckInReminderEmail`, checkin-reminder.ts:36-43):
   - 제목(이미 한국어, checkin-due:119) 유지: "그래서, 어떻게 됐어요? — {프로젝트명}"
   - 본문: "「{프로젝트명}」, 봉인할 때 오늘 물어봐 달라고 하셨어요." / lean 있으면 "출항 때 당신의 한 줄: **{lean}**" /
     버튼 "돌아가서 답하기" / 푸터 "이 결정을 봉인할 때 이메일 알림을 켜서 받는 메일이에요."
3. 링크에 `?from=checkin`을 붙이고, /project 빈 화면(:429-444)이 이 파라미터를 보면 신규자 카피 대신:
   **"봉인해 둔 결정이 이 기기엔 없어요. 봉인할 때 쓴 계정으로 로그인하면 바로 보여요."** + [로그인] 버튼.
   (10-최악의날 `argus:knew-you` 스펙과 합류 가능 — 어느 쪽이든 하나만 있으면 됨.)

당장 UI를 안 달 거라면 크론의 이메일 다리(checkin-due:105-128)에 주석으로 "옵트인 UI 미출시 — 죽은 다리"를 박제해
다음 감사가 같은 발견을 반복하지 않게 한다.

### S6 (P1-2) — 지각 라벨 마무리

`src/lib/review/status.ts:106`의 `` `확인 지남 (${-days_until}일)` `` →
**"확인할 차례예요"** (일수 미표기 — 지각을 세지 않는다는 원칙은 이미 SettlementModal이 지키는 것과 동일).
정렬은 이미 days 기반이라(:127-137) 라벨에서 숫자를 빼도 순서 정보는 잃지 않는다.

### S7 (P2, 선택) — 랜딩의 조용한 인식

LandingHeader "워크스페이스 →"(:100-112)에 due>0일 때만 골드 점 하나(숫자 없이).
헤더 배지 계산(Header.tsx:66-83)을 훅으로 추출해 공유. 마케팅 캔버스의 물성을 해치지 않는 최소 신호.

### S8 (P2-1) — 죽은 부품 결정

WakeReturn·DecisionReplayTimeline은 (a) SettlementModal의 "고리를 닫았어요" 화면(SettlementModal.tsx:341)에
항적 블록으로 배선하거나 (b) 삭제한다. 이번 스프린트 범위 밖이면 파일 상단에
"미배선 — 2026-07-03 감사에서 확인" 주석만이라도. (Clean Removal 원칙: 반쯤 존재하는 코드가 제일 비싸다.)

---

## 스파인 충돌 검토

- **S1~S3의 알림·등불은 개입 제조가 아닌가?** 아니다 — 전부 **사용자가 봉인할 때 스스로 정한 날짜의 이행**이다.
  "정한 날 물어봐 주세요"에 "네"라고 한 사람에게 그날 묻는 것은 절제 위반이 아니라 약속 이행.
  단, S1-4의 반복 상한(3회)과 S3의 "나중에 할게요" 탈출구가 절제의 짝이다 — 상한 없는 재알림(현재 상태)이 오히려 mirror-clause 위반이었다.
- **정산 문면**: 모든 신규 카피는 사실 서술("물어보기로 한 게 있어요")과 질문("어떻게 됐어요?")만 —
  verdict·점수·재촉("놓치셨어요", "N일 지남") 없음. S6은 판정 어휘를 오히려 제거.
- **provenance**: S1의 텔레그램 정산은 사용자가 직접 누른 버튼/답장만 기록 — AI가 결과를 추정해 채우는 경로 없음.
  "아직"은 연장으로만 처리(변침도 기록, 기존 handleSettle과 동일 규칙).
- **02-목소리와의 정합**: S1-3·S5-2의 문안은 기준음 "그래서, 어떻게 됐어요?"(seal-core)로 통일 — 두 뇌 문제의 카피 측면 해소.
- **05-뺄셈과의 정합**: 귀환 항구는 /project 하나로 수렴(S3a·S5-3 모두 /project행). /tools/review due의 /project 표면화는 05의 스펙을 따른다.
- 충돌 없음.
