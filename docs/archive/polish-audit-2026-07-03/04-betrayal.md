# 배신 감사 — Argus가 사용자에게 한 약속, 전부 코드로 추적 (2026-07-03)

> 방법: 웹앱·플러그인·크론의 모든 사용자향 약속 문구를 수집하고, 각 약속을 UI 토스트가 아니라
> 실제 저장 경로(localStorage → Supabase upsert → 크론 → 이메일/텔레그램 발송 코드)까지 추적.
> Supabase 실DB(overture-db)에서 SELECT로 행 수·컬럼 실재를 대조 확인. 코드 수정 없음.

## 요약 (5줄)

1. **가장 큰 배신(P0): "계정 완전 삭제 — 모든 데이터 영구 삭제" 약속이 깨져 있다.** 삭제 목록(`USER_DATA_TABLES`)에 최근 추가된 `decision_items`·`review_receipts` 두 테이블이 빠져 있어, 계정을 지워도 검수한 문서의 발췌·판단 기록이 서버에 **주인 없는 고아 데이터로 영원히 남는다**. 개인정보처리방침("즉시 삭제됩니다")까지 어기는 상태. 같은 이유로 "모든 데이터 내보내기"도 이 두 테이블을 빼먹는다.
2. **P1: 삭제 직전 "먼저 내보내기로 백업하세요"라고 권하는데, 그 내보내기 파일을 '백업 가져오기'가 못 읽는다.** 서버 내보내기 형식과 가져오기 파서 형식이 서로 다르다 — 안전망이 안전망이 아니다.
3. **P1: 전제(premise)의 "바뀌면 알림" 종(bell)은 켜는 스위치만 있고 울리는 장치가 어느 표면에도 없다.** 웹앱엔 재확인 코드 호출이 0곳, 크론도 없고, 플러그인 track은 자기 로컬 파일만 본다.
4. **P1: 가이드 FAQ가 "메일·알림은 보내지 않아요"라고 약속하는데, 실제로는 텔레그램 리마인더(실DB 발송 스탬프 확인)와 검수(Companion Brief) 이메일(옵트인 없음)을 보낸다** — 카피와 동작이 양방향으로 모순.
5. **잘 지켜지는 약속도 많다:** 봉인→귀환 텔레그램 푸시(실발송 확인), "그날 프로젝트 페이지에서 먼저 물어요"(due 스트립 실재), 익명 봉인의 정직한 "이 기기에만 저장돼요" 고지, 동기화 실패 배지, localStorage 쓰기 실패 토스트, soft-delete 컬럼 6테이블 전부 실재, 삭제 실패 시 성공으로 속이지 않는 영수증 구조.

---

## 발견 목록 (배신의 크기 = 몇 주 뒤 발견했을 때의 상처 순)

### P0-1. "모든 데이터와 계정을 영구 삭제" — 두 테이블이 살아남는다

**약속:**
- 설정 위험구역: "모든 데이터와 계정을 영구 삭제 — 되돌릴 수 없어요" — `src/app/[locale]/settings/page.tsx:724`
- 삭제 모달: "서버에 저장된 모든 데이터와 계정이 영구 삭제되고, 로그아웃됩니다." — `src/app/[locale]/settings/page.tsx:738`
- **개인정보처리방침**: "회원 탈퇴 시 모든 개인정보와 서비스 데이터가 즉시 삭제됩니다." — `src/app/[locale]/privacy/page.tsx:131`

**실제:** 삭제 API는 `USER_DATA_TABLES` 목록만 돈다(`src/app/api/account/delete/route.ts:42-53`).
그 목록(`src/lib/user-data-tables.ts:16-49`)에는 32개 테이블만 있는데, **실DB에는 user_id를 가진
테이블이 34개다.** 빠진 둘:

- `decision_items` (2026-07-02 병렬 세션이 추가, 실DB에 현재 8행 존재 — SELECT로 확인)
- `review_receipts` (2026-07-01 문서 판단 검수 MVP가 추가 — 검수한 **문서 제목·핵심 질문·발췌·판단 내용**이 `data` jsonb에 통째로 들어감)

더 아픈 부분: 삭제 라우트는 행 삭제가 다 끝난 뒤 auth 계정(identity)을 지운다
(`src/app/api/account/delete/route.ts:57-66`). 빠진 두 테이블의 행은 **계정이 사라진 뒤에도 남고,
주인이 없어져서 본인이 다시 로그인해 지울 방법조차 없다.** 몇 주 뒤 "내 문서 내용이 아직
서버에 있냐"는 질문을 받으면 답은 "네, 그리고 당신은 그걸 지울 수단이 없습니다"가 된다.

**가드가 왜 못 잡았나:** `src/lib/__tests__/erasure-coverage.test.ts:23-33`의
`LIVE_USER_SCOPED_TABLES`가 2026-06-30에 손으로 뜬 스냅샷이라, 그 뒤(07-01, 07-02) 추가된 두
테이블은 **양쪽 목록에서 동시에 빠져 테스트가 초록불**이다. 테스트 주석(16-21행)이 스스로
"이 방식의 알려진 한계"라고 적어둔 바로 그 구멍이 다시 뚫렸다.

### P0-2. "서버에 저장된 모든 데이터를 JSON 한 파일로" — 같은 두 테이블이 빠진다

**약속:** "서버에 저장된 모든 데이터를 JSON 한 파일로" — `src/app/[locale]/settings/page.tsx:633`,
클라이언트 주석 "guarantee COMPLETE export" — `src/lib/api-account.ts:3-4`

**실제:** 내보내기 라우트도 같은 `USER_DATA_TABLES`를 돈다(`src/app/api/account/export/route.ts:38-41`).
검수 기록(review_receipts)과 결정 항목(decision_items)은 **"모든 데이터" 파일에 담기지 않는다.**
사용자가 백업이라 믿고 계정을 지우면(P0-1과 결합) 그 데이터는 백업에도 없고 지워지지도 않은,
최악의 조합이 된다.

### P1-1. "백업 가져오기 — 내보낸 JSON 파일에서 복원" — 그 파일을 못 읽는다

**약속:**
- "백업 가져오기 / 내보낸 JSON 파일에서 복원" — `src/app/[locale]/settings/page.tsx:644-645`
- 삭제 모달이 직접 권함: "필요하면 먼저 '내보내기'로 백업하세요." — `src/app/[locale]/settings/page.tsx:743`

**실제:** 로그인 사용자의 내보내기는 서버 형식 `{ exported_at, user, tables: { projects: [...] } }`
(`src/app/api/account/export/route.ts:31-41`)인데, 가져오기 파서는 **최상위 키가 localStorage 키
(`sot_projects` 등)와 일치하는 항목만** 복원한다(`src/app/[locale]/settings/page.tsx:99-113`).
서버 내보내기 파일을 넣으면 `exported_at`/`user`/`tables` 어느 것도 매칭이 안 돼 무조건
**"가져올 수 있는 데이터가 없습니다"**(112행)가 뜬다.

**배신의 순간:** 계정 삭제 전 앱이 시키는 대로 백업한 사용자가, 삭제 후 복원하려는 바로 그
순간 — 되돌릴 수 없는 일이 이미 벌어진 뒤에 — 백업이 안 열린다는 걸 알게 된다.

### P1-2. "바뀌면 알림 켜짐" — 종은 있는데 종지기가 없다

**약속:** 전제 항목의 벨 토글, 툴팁 "바뀌면 알림 켜짐" — `src/components/projects/DecisionItemsCard.tsx:201`
(켜면 `on_change` 모드로 저장되고 `external:true`로 승격 — `src/stores/useDecisionItemsStore.ts:98-103`)

**실제:** 알림을 실제로 울릴 수 있는 함수들(`evaluateDrift`/`shouldFireAlert` —
`src/lib/premise-drift.ts:63,108`, `monitoredPremises` — `src/lib/decision-items.ts:283`)의
**런타임 호출처가 웹앱에 한 곳도 없다** (전부 `__tests__`에서만 import — grep으로 확인).
재확인 크론도 없다(`vercel.json` crons 5종에 해당 없음). 플러그인의 `/argus:track`은 자기
로컬 파일 `.argus/items.jsonl`만 읽으므로(`argus-plugin-v2/skills/track/SKILL.md` Storage 절)
웹앱에서 켠 벨과 연결되지 않는다.

**배신의 순간:** "기준금리 3.5%" 같은 근거 전제에 벨을 켜둔 사용자 — 금리가 바뀌어도 영원히
조용하다. 몇 주 뒤 "알림 켜놨는데 왜 아무 말 없었어?"가 정확히 이 감사가 찾으라는 상처다.

### P1-3. 가이드 FAQ "메일·알림은 보내지 않아요" — 실제로는 둘 다 보낸다

**약속:** "'물어봐 준다'는 게 어떻게 오나요?" → "정한 날짜에 프로젝트 페이지에 오시면 제가 먼저
물어요 — **메일·알림은 보내지 않아요.**" — `src/app/[locale]/guide/page.tsx:123-125`

**실제:**
- 텔레그램 연결 사용자에겐 확인일에 텔레그램 메시지를 **실제로 보낸다** — `src/app/api/cron/checkin-due/route.ts:130-159` + `src/app/api/cron/telegram-reminders/route.ts:51-77`. 실DB에서 발송 스탬프 확인: projects 행 `telegram_reminder_sent_at = 2026-07-02T00:01:38Z` (봉인일 06-27 계약). 봉인 화면은 이걸 정직하게 고지한다(`SealMoment.tsx:496`) — **가이드만 낡았다.**
- 문서 검수(Review)에서 예측을 봉인하면 확인일에 **이메일**(Companion Brief)이 온다 — `src/app/api/cron/companion-brief/route.ts:108-137`. (아래 P1-4)

같은 제품의 두 문서가 서로 반대 약속을 하고 있어, 어느 쪽을 믿은 사용자든 한 번은 배신당한다.

### P1-4. Companion Brief 이메일 — 옵트인도, 사전 고지도 없이 발송된다

**약속(제품 불변식):** checkin-due 크론은 "explicit opt-in… the product's **'no emails unless
you ask'** promise" 원칙을 명시하고 `email_reminder === true`인 계약만 이메일한다 —
`src/app/api/cron/checkin-due/route.ts:18-21,105-107`.

**실제:** Companion Brief 크론은 **아무 옵트인 조건 없이**, 확인일이 온 미정산 검수 예측이 있는
모든 로그인 사용자에게 이메일을 보낸다(`src/app/api/cron/companion-brief/route.ts:67-74,108-125`
— 필터는 날짜·재발송 간격뿐). 검수 봉인 모달 어디에도 "이메일이 갑니다"라는 문구가 없다
(`src/components/review/SealModal.tsx:65-70`은 "확인일에 당신이 정산합니다"까지만).
MCP 경로는 설정 페이지에서 고지되지만(`settings/page.tsx:934` "봉인한 예측이 이메일과
대시보드로 돌아옵니다" — 이 약속 자체는 `api/mcp/seal/route.ts:180-202` → `review_receipts` →
companion-brief로 구조가 실제 연결돼 있음을 확인), **웹앱 검수 사용자는 예고 없는 이메일을 받는다.**

### P1-5. 삭제가 다른 기기로 전파되지 않는다 — 폰에서 지운 프로젝트가 노트북에 영원히 남는다

**약속(암묵):** 삭제하면 사라진다. 로그인하면 "이제 어디서나 이어서"(AccountSyncToast) — 기기 간
같은 상태여야 한다.

**실제:** 기기 A에서 삭제하면 로컬 제거 + 서버 `deleted_at` 마킹(soft-delete)까지는 정상
(`src/stores/createItemStore.ts:69-83`, `src/lib/db.ts:243-261`; 6개 대상 테이블 모두 `deleted_at`
컬럼 실재 — 실DB SELECT로 확인). 그런데 기기 B의 `loadAndMerge`는 삭제된 원격 행을 **무덤비석
(tombstone)으로 쓰지 않고 그냥 걸러버린다**(`src/lib/db.ts:130` `.filter((r) => !r.deleted_at)`).
결과: 기기 B의 localStorage 사본은 병합에서 "로컬 전용"으로 살아남아 화면에 계속 보이고
(131-138행), 매 로드마다 서버로 재-upsert까지 시도한다(139-144행; `deleted_at` 필드가 없으니
서버 행은 삭제 상태 유지 — 서버 부활은 없지만 **기기 B에선 영원히 안 지워진다**).
같은 메커니즘으로, 삭제 순간 오프라인이었다면(soft-delete 요청 실패) 같은 기기에서도 다음
로드 때 원격 행이 되살아온다(배지는 켜지지만 항목은 부활).

### P2-1. `email_reminder` — 이메일 리마인더 기능이 통째로 죽은 코드다

`DecisionContract.email_reminder`(`src/stores/types.ts:630`)를 **true로 만드는 UI가 웹앱에 한 곳도
없다** (전체 grep: types.ts 선언 + checkin-due 크론 참조 2곳뿐). 실DB의 봉인 계약 6건 전부
`email_reminder = null` (SELECT로 확인). 사용자에게 한 약속을 어긴 건 아니지만(약속한 적이 없음),
checkin-due 크론의 이메일 절반(`route.ts:105-127`)은 영원히 실행되지 않는 코드다. 봉인 화면이
"광고성 메일은 보내지 않아요"라고 하면서 정작 원하는 사람이 켤 방법도 없는 상태.

### P2-2. "결정 N건을 계정에 저장했어요" — 저장 성공을 확인하지 않고 말한다

로그인 직후 토스트가 "결정 N건을 계정에 저장했어요 — 이제 어디서나 이어서"라고 단정한다
(`src/components/ui/AccountSyncToast.tsx:52`). 그런데 N은 **로컬에 있던 프로젝트 개수**이지 실제로
서버에 도착한 개수가 아니다(`src/lib/account-migration.ts:56-65,107` — `loadAndMerge`의 push 실패는
throw하지 않고 배지만 켠다, `db.ts:139-144`). 업로드가 전부 실패해도(예: 스키마 드리프트
PGRST204) 토스트 문구는 동일하다. SyncStatus 배지가 별도로 실패를 알리긴 하므로 P2.

### P2-3. soft-delete 실패에 재시도가 없다 — 배지 한 번 켜지고 끝

`softDeleteFromSupabase` 실패 시 `reportSyncFailure`로 배지만 켜고(`src/lib/db.ts:254-257`),
로컬은 이미 지워진 상태라 재시도 큐가 없다. 다음 `loadAndMerge`에서 살아있는 원격 행이 로컬로
되돌아온다(`db.ts:127-131` 병합). "삭제했는데 다시 나타났다"는 P1-5의 단일 기기 변형.

---

## 지켜지고 있는 약속 (확인 완료 — 손대지 말 것)

| 약속 | 근거 |
|---|---|
| "그날 프로젝트 페이지에 오시면 제가 먼저 물어요" | due 스트립 + 정산 모달 실재 — `src/app/[locale]/project/page.tsx:259-283,478-486` |
| "텔레그램 연결 시 그날 메시지로 알려드려요" | 크론 2종 + **실DB 발송 스탬프**(`telegram_reminder_sent_at` 2026-07-02) 확인 |
| 익명 봉인의 정직성: "이 기기에만 저장돼요" | `SealMoment.tsx:501-505` — 거짓 약속 대신 진실 + 탈출구 |
| 로그인 시 로컬 작업이 계정으로 이주 | `src/lib/account-migration.ts` (projects 포함 12키 + progressive_sessions 특수형) |
| 동기화 실패가 보인다 | `db.ts`의 모든 쓰기 경로가 `reportSyncFailure` 호출 → SyncStatus 배지; 익명은 "이 기기에 저장됨 · 백업 보류" 정직 표기(`SyncStatus.tsx:98`) |
| localStorage 쓰기 실패가 보인다 | `storage.ts:50-64` → StorageErrorToast (Header에 전역 마운트) |
| 삭제 실패를 성공으로 속이지 않는다 | 영수증 구조, 부분 실패 시 identity 보존 + throw — `db.ts:303-328`, delete route 55-69행 |
| 공개 링크 "취소하면 즉시 열람 불가" | `shared_links` 행 삭제 → `/d/[token]` 즉시 404 경로 |
| MCP 토큰: "봉인한 예측이 이메일과 대시보드로 돌아옵니다" | `api/mcp/seal` → `review_receipts` upsert → companion-brief 크론 → Active Course. 구조 연결 확인 (단, P1-4의 옵트인 문제는 공유) |
| 보스 "로그인하면 영구 저장" | 보스→agent 저장, agents는 `loadAndMerge`가 로컬 전용분을 push — `useAgentStore.ts:394-421` |
| soft-delete가 서버 no-op이 아님 | 6개 대상 테이블 모두 `deleted_at` 컬럼 실재 (실DB information_schema 대조) |

---

## 구현 스펙

### S1 (P0-1, P0-2 동시 해결) — 두 테이블을 삭제·내보내기 목록에 추가

1. `src/lib/user-data-tables.ts`의 `USER_DATA_TABLES` 배열에 `'decision_items'`, `'review_receipts'`
   를 알파벳 위치에 추가 (delete/export 라우트는 이 목록을 돌므로 이 한 곳이면 둘 다 고쳐진다).
2. `src/lib/__tests__/erasure-coverage.test.ts`의 `LIVE_USER_SCOPED_TABLES`에도 같은 두 항목 추가,
   주석의 재수집 날짜를 2026-07-03으로 갱신.
3. **고아 데이터 청소(1회성):** 이미 탈퇴한 계정의 잔존 행이 있는지 확인 —
   `SELECT count(*) FROM review_receipts r WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id);`
   (decision_items 동일). 있으면 창업자가 직접 삭제. (감사 시점 기준 review_receipts 0행,
   decision_items 8행 — 8행의 주인 계정 생존 여부만 확인하면 됨.)
4. **재발 방지(권장):** 새 user-scoped 테이블 마이그레이션 시 두 목록 갱신을 체크리스트化 —
   CLAUDE.md의 Schema Sync 절에 "user_id 컬럼이 있는 새 테이블 = user-data-tables.ts +
   erasure-coverage 테스트 동시 갱신" 한 줄 추가.

### S2 (P1-1) — 서버 내보내기 파일을 가져오기가 읽게 하거나, 최소한 정직하게 거절

`src/app/[locale]/settings/page.tsx`의 `handleImport`(91-122행)에 분기 추가:

- `data.tables && data.exported_at`이면 서버 형식으로 판단, 테이블→로컬키 역매핑으로 복원:
  `projects→sot_projects, personas→sot_personas, reframe_items→sot_reframe_list,
  recast_items→sot_recast_list, synthesize_items→sot_synthesize_list,
  judgment_records→sot_judgments, feedback_records→sot_feedback_history,
  accuracy_ratings→sot_accuracy_ratings, decision_quality_scores→sot_dq_scores,
  outcome_records→sot_outcome_records, retrospective_answers→sot_retrospective_answers,
  quality_signals→sot_quality_signals, decision_items→sot_decision_items,
  review_receipts→sot_review_receipts` (receipts는 row.data를 꺼내 배열로),
  나머지 테이블(연동·토큰·이벤트)은 건너뛰고 개수만 안내.
- 역매핑 구현이 무겁다면 **최소 스펙**: 서버 형식 감지 시 정확한 안내 —
  **"서버 내보내기 파일이에요. 이 파일은 보관용 사본이고, 앱으로 되돌리는 복원은 아직 지원하지
  않아요. 복원하려면 로그아웃 상태에서 만든 백업 파일을 사용하세요."**
- 삭제 모달(743행) 카피도 그에 맞게: 복원 미지원을 유지한다면
  **"필요하면 먼저 '내보내기'로 사본을 받아두세요. (사본은 열람용이에요 — 앱으로 자동 복원되지는 않아요.)"**

### S3 (P1-2) — 벨을 정직하게: 확인 장치가 생길 때까지 약속을 줄인다

단기(카피 수정만, 스파인의 '절제' 방향):
- `src/components/projects/DecisionItemsCard.tsx:201` 툴팁을
  **"주시 표시 켜짐 — 자동 알림은 아직 준비 중이에요"** / off는 "주시 꺼짐"으로.
- 또는 벨 아이콘을 웹앱에서 숨기고 데이터 모델만 유지(플러그인·후속 크론 대비).

장기(진짜 이행): `/api/cron/premise-recheck` 신설 — `monitoredPremises`
(`src/lib/decision-items.ts:283`)로 대상 선별 → 웹검색 재확인 → `evaluateDrift`/`shouldFireAlert`
(`src/lib/premise-drift.ts`) 통과분만 프로젝트 페이지 인앱 배지로 노출(이메일 아님 — P1-4 교훈).
비용·과발화 위험이 있으니 단기 카피 수정을 먼저 배포할 것.

### S4 (P1-3) — 가이드 FAQ 카피 교정

`src/app/[locale]/guide/page.tsx:124`를 실제 동작과 일치시킨다:

**"정한 날짜에 프로젝트 페이지에 오시면 제가 먼저 물어요. 텔레그램을 연결해 두셨다면 그날
메시지로도 가볍게 알려드려요. 문서 검수에서 예측을 봉인한 경우엔 확인일에 이메일로
돌아와요 — 광고성 메일은 없어요."** (영문도 동일 취지로.)

### S5 (P1-4) — 검수 봉인 모달에 이메일 고지 한 줄

`src/components/review/SealModal.tsx:65-70`의 설명문 아래에 추가:

**"확인일이 오면 이 예측을 이메일로 돌려드려요 — 정산을 위한 한 통이고, 그 외 메일은 없어요."**

(이상적으로는 체크박스 옵트인 + `review_receipts`에 `email_opt_out` 반영이지만, 고지 한 줄이
"no emails unless you ask"의 최소 이행이다. 발송 이메일 하단에 수신 중단 안내(reply로 요청)
문구도 `src/lib/companion-brief.ts` 템플릿에 추가 권장.)

### S6 (P1-5, P2-3) — 삭제 전파: 원격 tombstone을 로컬 제거에 사용

`src/lib/db.ts` `loadAndMergeUncached`(111-151행) 수정:
1. 원격 SELECT 결과에서 `deleted_at`이 있는 행의 id 집합(tombstones)을 만든다.
2. `mergeByTimestamp` 후, tombstone id에 해당하는 항목을 merged에서 제거하고 나서
   `setStorage`/localOnly push를 수행한다. (이러면 기기 B의 유령 사본이 다음 로드 때 사라지고,
   P2-3의 "실패한 삭제 부활"도 서버 삭제가 한 번이라도 성공했다면 자가 치유된다.)
3. 주의: "이 기기에서 방금 만들어 아직 업로드 전인 항목"은 tombstone에 없으니 안전. 과거에
   삭제했다가 같은 id로 부활시키는 흐름(재봉인 등)은 현재 없음(신규 id 생성)이라 충돌 없음.

### S7 (P2-1) — email_reminder: 켜는 스위치를 달거나 필드를 걷어낸다

봉인 화면 채널 고지 문단(`SealMoment.tsx:493-497`) 아래에 체크박스 1개:
**"확인일에 이메일로도 물어봐 주세요 (선택)"** → 체크 시 `decision_contract.email_reminder = true`
로 seal 시 저장(`seal()` 174-186행에서 next에 병합). 크론은 이미 완성돼 있으므로 이 스위치
하나로 기능 전체가 살아난다. 당장 안 달 거면 types.ts:630 필드에 "UI 미구현 — 켜는 곳 없음"
주석이라도 남겨 다음 감사가 헛추적하지 않게 할 것.

### S8 (P2-2) — 이주 토스트 문구를 검증 가능한 수준으로

`src/lib/account-migration.ts`에서 push 실패 여부(예: `getSyncFailureCount()` 전후 비교)를 보고,
실패가 있으면 이벤트 detail에 `partial: true`를 실어 `AccountSyncToast.tsx:52` 문구를
**"결정 N건을 계정으로 옮기는 중이에요 — 상태는 상단 동기화 표시에서 확인돼요."**로 바꾼다.
전부 성공 시 기존 문구 유지.

---

## 스파인 충돌 검토 (maximum generation, zero judgment)

- **S1·S2·S6·S8**: 데이터 무결성/정직성 수리 — 판단·평결과 무관, 충돌 없음.
- **S3(벨 카피 축소)**: 스파인의 미러 조항(과발화 금지)과 정확히 같은 방향 — 지키지 못할 개입을
  약속하지 않는 것 자체가 절제다. 장기안(재확인 크론)을 만들 때는 드리프트 결과를 **사실 진술**
  ("기준금리가 3.5%→4.5%로 바뀌었어요")로만 표기하고 "그러니 결정을 바꾸세요" 류 문장을 절대
  붙이지 말 것(`premise-drift.ts`의 높은 발화 문턱 유지).
- **S4·S5·S7(채널 고지/옵트인)**: 봉인 화면의 기존 원칙("Channel disclosure BEFORE consent",
  `SealMoment.tsx:493`)을 다른 표면으로 확장하는 것 — 정직한 출처 표기 원칙과 동일 계열, 충돌 없음.
- 이 보고서의 어떤 수정안도 사용자에 대한 점수·평결·기울인 조언을 새로 노출하지 않는다.
