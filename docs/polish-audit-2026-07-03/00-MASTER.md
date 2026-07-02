# 00 — MASTER: 완성도·매력도 감사 종합 실행 계획 (2026-07-03)

> 입력: 9개 감사 보고서 (04-betrayal · 05-subtraction · 02-voice · 09-waiting · 10-worst-day ·
> 06-first-3min · 03-return · 07-signature · 08-treasure). 모든 항목에 출처 보고서 + 파일:줄.
> 이 문서는 발견의 나열이 아니라 **판정 결과**다 — 중복은 합쳤고, 충돌은 판정했고, 일부 P0는 강등했고, 일부 제안은 기각했다(§5).

---

## 1. 전체 요약 (비개발자 창업자용, 10줄)

1. 좋은 소식부터: **의식(봉인·정산·귀환 모달)과 핵심 항해 경로는 이미 상위권 제품 수준**입니다. "그래서, 어떻게 됐어요?"라는 목소리, 취소 가능한 로딩, 정직한 에러 분류 — 9개 감사가 모두 "건드리지 말 것" 목록을 먼저 적었습니다.
2. 나쁜 소식: **가장 아픈 구멍 3개가 전부 "약속과 실제의 어긋남"**입니다. 잘 만든 화면 뒤의 배관이 새고 있어요.
3. 첫째, **계정을 완전 삭제해도 최근 추가된 테이블 2개(검수 기록·결정 항목)가 서버에 영원히 남습니다** — 개인정보처리방침 위반이고, 고치는 건 몇 줄입니다.
4. 둘째, **지금까지 실제 발송된 귀환 알림은 딱 1건인데, 그 1건의 답장 버튼이 죽어 있습니다.** 누르면 아무 일도 안 일어나고, 같은 영어 기계문이 7일마다 다시 옵니다. "정한 날 물어봐 드려요"라는 제품의 단 하나의 약속이 물어놓고 대답을 못 받는 상태예요.
5. 셋째, **돌아온 사용자를 알아보는 화면이 한 곳(/project)뿐인데, 사용자가 실제로 착륙하는 곳(/workspace)은 돌아올 결정을 한 글자도 모릅니다.** 47개 열림 / 0개 정산이라는 깔때기의 정확히 그 지점입니다.
6. 스파인 위반도 하나 라이브입니다: 워크스페이스에 상시 떠 있는 항해장 스트립이 **"판단 품질 점수 · 초보/숙련/마스터 등급 · 하락했습니다"라는 평결**을 사용자에게 직접 말하고 있어요. 문구 수정이 아니라 제거 대상입니다.
7. 그 외 P1은 대부분 "카피와 배선"입니다: 영어 기계문 알림, "실패" 두 글자 에러, "확인 지남 (183일)" 같은 출석부 라벨, 켜는 스위치 없는 이메일 알림, 한 번 실패하면 영영 앰버인 동기화 배지.
8. 매력도 쪽의 두 가지 큰 기회: **봉인을 2.6초 의식(밀랍 인장)으로 승격**하는 것과, **사용자가 직접 쓴 판단 한 줄·정산 서사를 다시 보여주는 "판단 액자"** — 해자라고 부르는 원문이 지금 write-only입니다.
9. 실행 순서는 "신뢰 수리(1~3일) → 귀환 한 집(2~3일) → 목소리 일괄(1~2일) → 의식과 보물(2~3일)" — 약 열흘 분량이며, 마이그레이션은 사실상 0입니다(전부 기존 데이터로 지음).
10. 기각한 것도 있습니다(§5): 날수를 다시 세는 라벨, 전제 재확인 크론(과발화 위험), 레거시 도구 취소 버튼 배선(강등 예정 화면 과투자), 스트릭·주간 푸시 류 — 절제가 이 제품의 스파인입니다.

---

## 1.5 재정렬 판정 기준

- **P0** = 지금 실사용자에게 닿는 약속 위반·데이터 손실·죽은 핵심 루프·스파인 위반. (매력도 P0는 없다 — 매력은 신뢰 위에만 선다.)
- **P1** = 신뢰를 깎는 카피·배선·상태 거짓말 + 핵심 루프의 매력도(의식·액자·등불).
- **P2** = 소품·정합·선택.
- 원 보고서의 P0 중 2건을 강등했다: **08 P0-1(판단 액자)·08 P0-2(장부 분열)** — 파손이 아니라 기회 손실이고(실DB 피해자 0), P1 최상단으로 내리되 열흘 계획 안에는 반드시 포함.

---

## 2. 통합 우선순위 실행 계획

### P0 — 7건 (순서 있음: 위에서부터)

| # | 항목 | 무엇을 하나 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|---|
| **P0-1** | **계정 삭제·내보내기 테이블 2개 누락** | `USER_DATA_TABLES`에 `decision_items`·`review_receipts` 추가(한 곳 고치면 삭제·내보내기 동시 수리) + erasure-coverage 테스트 스냅샷 갱신 + 고아 행 1회 청소 SQL + CLAUDE.md Schema Sync 절에 체크리스트 1줄 | 04 P0-1/P0-2 (04 S1) | `src/lib/user-data-tables.ts:16-49`, `src/app/api/account/delete/route.ts:42-53`, `src/app/api/account/export/route.ts:38-41`, `src/lib/__tests__/erasure-coverage.test.ts:23-33` |
| **P0-2** | **텔레그램 귀환 정산의 죽은 버튼 + 두 뇌 + 반쪽 정산** | ① 웹훅에 `stl1|` 콜백·토큰 답장 분기 배선(파서는 이미 완성돼 있고 테스트만 import) ② checkin-due가 telegram_decisions 미러 있으면 건너뛰기(이중 발송 차단) ③ `handleSettle`이 web-source 행이면 projects.decision_contract도 함께 닫기 ④ 카피를 seal-core의 한국어 한 뇌로("그래서, 어떻게 됐어요?") — 02 P0-1과 같은 수술 부위이므로 한 커밋 | 03 P0-1/P0-3 + 02 P0-1 (03 S1·S2, 02 S1) | `src/app/api/telegram/webhook/route.ts:629-670,499-554`, `src/lib/telegram-settlement.ts:26-29,50-89`, `src/app/api/cron/checkin-due/route.ts:130-159`, `src/lib/seal-core.ts:163-199` |
| **P0-3** | **NavigatorStrip 점수·등급·평결 노출 제거** (스파인 규칙2 위반 라이브) | '판단 품질' 점수·초보/숙련/마스터 등급 렌더 제거(데이터는 내부 유지), "하락했습니다"·"비판적으로 검토하면" 인사이트는 **생성 자체 제거가 1안**(빈도-사실 문안 교체는 2안), i18n 키 Clean Removal | 02 P0-3/P1-1 (02 S3) | `src/components/workspace/NavigatorStrip.tsx:167,320`, `src/lib/navigator.ts:236,692`, `src/lib/i18n/ko.ts:74,111,119-120,146-147,273-275` |
| **P0-4** | **앱 대문 getSession 무타임아웃** | 4초 레이스 컷(기존 llm.ts:465 패턴 복제) — `getSessionWithTimeout()` 공용 헬퍼로 auth.tsx·api-account bearer()·ShareComposer 3곳 공유. 과거 "73초 무한 스피너"의 마지막 형제 | 09 P0-1 (09 S1) | `src/lib/auth.tsx:70-77`, `src/lib/api-account.ts:8-13`, `src/components/ui/ShareComposer.tsx:225,305` |
| **P0-5** | **세션 만료 삼중 침묵** | `argus:knew-you` 로컬 플래그(STORAGE_KEYS 등록) → 만료 시 토스트 1회("로그인이 잠시 풀렸어요 — 작업은 이 기기에 저장되고 있어요") + "무료 체험" 오인 분기 수리 + AuthGuard 귀환자 문안 + SyncStatus 로그인 게이트 밖으로 | 10 P0-1/P2-1 (10 S1) | `src/lib/auth.tsx:79-97`, `src/lib/db.ts:218`, `src/components/layout/Header.tsx:279-281`, `src/lib/llm.ts:81`, `src/app/[locale]/workspace/page.tsx:645-652`, `src/components/layout/AuthGuard.tsx:29-33` |
| **P0-6** | **귀환 항구 한 집 + 착륙 등불** (4개 보고서 합류점) | ① Header due 배지 목적지를 `/project`로 고정 + /project가 useReviewStore를 읽어 검수 due 합산 ② /workspace 착륙에 due 스트립 한 줄("⚓ 그래서, 어떻게 됐어요? — 돌아올 결정 N건" + [지금 답하기][나중에 할게요], due 0이면 렌더 0) ③ 완료 화면이 due면 헤드라인 교체("돌아오셨네요")+정산 카드 최상단 ④ dueCount 계산을 공용 훅으로(두 화면 드리프트 방지) | 05 P0-2 + 03 P0-2 + 10 P1-3 (05 S2, 03 S3, 10 S4) | `src/components/layout/Header.tsx:83-86`, `src/app/[locale]/project/page.tsx:260-266,478-505`, `src/app/[locale]/workspace/page.tsx:562,703-758`, `ProgressiveFlow.tsx:3171-3223` |
| **P0-7** | **워크스페이스 옆길 칩 4개 제거** | 입력창 아래 /agents·/boss·/teams·/guide 칩 블록 삭제(teams·guide는 Header 더보기와 순수 중복), /boss만 Header 더보기로 이사. 라우트는 전부 유지 | 05 P0-1/P1-4 (05 S1) | `src/app/[locale]/workspace/page.tsx:627-643`, `Header.tsx:46-51` |

### P1 — 신뢰 배관 + 핵심 매력 (묶음별)

**A. 보물·의식 (원 08 P0 2건을 여기 최상단으로 강등)**

| # | 항목 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|
| P1-A1 | **판단 액자** — 봉인 한 줄(human_judgment)과 정산 서사(what_happened)를 검증 카드+정산 완료 화면에 세리프 인용으로 영구 전시 (마이그 0, "봉인 당시 / 돌아와서" 라벨, 해설 금지) | 08 P0-1→강등 (08 S1) | `src/components/projects/DecisionContractCard.tsx:299-339`, `src/stores/types.ts:607-616`, `SettlementModal.tsx:87-100` |
| P1-A2 | **자차표 한 뇌** — `RecordStrip` 공용 컴포넌트 + `summarizeReviewRecord` 합산(표시 계층만, 테이블 통합 금지). /project·/tools/review·/workspace 3곳 배치. 텔레그램 record-core와 숫자 일치 교차 테스트 1개 | 08 P0-2→강등 + P2-2 (08 S2·S8) | `src/lib/decision-contract.ts:649-666`, `src/components/review/ReceiptList.tsx:53`, `src/lib/record-core.ts:12-18` |
| P1-A3 | **봉인 의식 2.6초** — seal-* 키프레임(압인+쿵+잉크 링+날짜 쓰임) + SealStamp SVG + AnimatePresence 장면 전환 + 봉인 증서 플레이트(Graticule 질감+사용자 한 줄 인용) + 검수 초록 성공 배지→증서 미니어처 + 문서완성 금색 중립화(위계 역전 수리) + 버튼 active:scale. 모든 봉인 동일 1회·탭 스킵·reduced-motion 정지 | 07 P1-1~4, P2-1~2 (07 S1~S6) | `SealMoment.tsx:151-211,278,337-446`, `src/app/globals.css:2983`, `ReviewFlow.tsx:297-306,368-372`, `ProgressiveFlow.tsx:3168`, `CurrentBearingCard.tsx:150` |
| P1-A4 | **대문 축적 신호** — "이어서 작업"에 VoyageEta 칩(주석이 약속한 사용처) + due 프로젝트 최상단 정렬 + 섹션 헤더 축적 한 줄(forming: "봉인 2개 — 첫 확인일이 오면 기록이 시작돼요") | 03 S4 + 08 P1-1/P1-2 (08 S3) | `workspace/page.tsx:703-758`, `src/components/workspace/VoyageEta.tsx:5-7`, `project/page.tsx:268-273` |
| P1-A5 | **3고리 의식** — SETTLED_THRESHOLD=3 최초 도달 시 정산 완료 화면 한 줄+금색 실선 1회("세 번째 고리를 닫았어요… 여전히 점수는 아니에요"), 이후 이탤릭 자리를 사실 각인("기록 시작 {날짜}")으로 | 08 P1-3 (08 S5) | `src/lib/calibration-disclosure.ts:18`, `project/page.tsx:469-473`, `SettlementModal.tsx` |

**B. 알림·귀환 채널 정직화**

| # | 항목 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|
| P1-B1 | **재알림 3회 상한 + "그만 물어봐 주세요" 버튼** — reminder_count(jsonb 내부, 마이그 0), 봇 키보드 5번째 버튼(mute — 웹 due 표면은 유지, 리마인더만 정지) | 10 P1-2 + 03 S1-4 (10 S3) | `checkin-due/route.ts:107,132`, `telegram-settlement.ts:57-68,122-130` |
| P1-B2 | **이메일 귀환로 일괄** — SealMoment에 옵트인 체크박스("그날 이메일로도 물어봐 주세요") + 본문 한국어화(locale 분기) + 링크 `?from=checkin` → 로그아웃 기기 빈 화면 분기("봉인할 때 쓴 계정으로 로그인하면 바로 보여요") | 04 P2-1 + 02 P0-2 + 03 P1-1 (03 S5, 02 S2, 04 S7) | `SealMoment.tsx:493-497`, `src/lib/checkin-reminder.ts:36-43`, `checkin-due/route.ts:105-128`, `project/page.tsx:429-444` |
| P1-B3 | **검수 이메일(Companion Brief) 사전 고지** — SealModal에 한 줄("확인일이 오면 이 예측을 이메일로 돌려드려요 — 그 외 메일은 없어요") + 발송 메일 하단 수신 중단 안내 | 04 P1-4 (04 S5) | `src/components/review/SealModal.tsx:65-70`, `src/lib/companion-brief.ts` |
| P1-B4 | **가이드 FAQ 약속 정합** — "메일·알림은 보내지 않아요" 거짓을 SealMoment:496 문장으로 교체(두 표면 문장 복사 일치) | 04 P1-3 + 02 P1-4 (02 S5) | `src/app/[locale]/guide/page.tsx:124,155`, `SealMoment.tsx:496` |
| P1-B5 | **전제 벨 정직화(단기만)** — 툴팁을 "주시 표시 켜짐 — 자동 알림은 아직 준비 중이에요"로 축소(또는 벨 숨김). 장기 재확인 크론은 §5에서 보류 | 04 P1-2 (04 S3 단기) | `src/components/projects/DecisionItemsCard.tsx:201`, `src/lib/premise-drift.ts:63,108` |
| P1-B6 | **지각 라벨 전멸** — "확인 지남 (N일)"·"기한 지남"·"확인일이 지났습니다" → **"확인할 차례"** 계열로 통일(날수 집계 금지 — 02의 "현실이 N일째 기다려요" 문안은 기각, §5). 웹 표면 OVERDUE 수입 금지 주석 박제 | 10 P1-1 + 03 P1-2 vs 02 P2-1 **충돌 판정: 10/03 승** (10 S2, 03 S6) | `src/lib/review/status.ts:105-106`, `ReceiptList.tsx:117`, `src/app/[locale]/import/page.tsx:241,262` |

**C. 기다림·상태 정직화**

| # | 항목 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|
| P1-C1 | **SyncStatus 양방향 정직화** — `reportSyncSuccess()` 신설+db.ts 성공 분기에서 발신, 초기 상태 'idle'(배지 미표시), P0-5의 knew-you 앰버 상태와 한 커밋 | 09 P1-4 + 10 P2-1 (09 S5 + 10 S1b) | `src/components/ui/SyncStatus.tsx:16`, `src/lib/sync-health.ts:34-38`, `src/lib/db.ts:174,227` |
| P1-C2 | **LLM 총예산 180초 + 재시도 이벤트** — fetchWithRetry에 벽시계 데드라인, `argus:llm-retry` 이벤트 → PhaseStatusBar substage("다시 시도하는 중 2/3") | 09 P1-3 (09 S4) | `src/lib/llm.ts:167-249` |
| P1-C3 | **오프라인 정직화** — `navigator.onLine` 선검사(fetchWithRetry 시작부 = Single Source, 헛 재시도 7초 제거) + "적어주신 내용은 그대로 있어요" 고지 + ProgressiveFlow 에러 배너에 재시도 버튼 | 10 P1-4 (10 S5) | `llm.ts:241-246`, `workspace/page.tsx:658,667`, `ProgressiveFlow.tsx:2434-2452` |
| P1-C4 | OAuth 콜백 10초 타임아웃 + 텔레그램 연결 try/catch(영구 스피너 수리) | 09 P1-1/P1-2 (09 S2·S3) | `auth/callback/page.tsx:25`, `useTelegramStore.ts:64-76`, `settings/page.tsx:830-845` |
| P1-C5 | 레거시 LoadingSteps 가짜 진행 정직화 — 경과초 + "단계 표시는 대략적 안내" (취소 배선은 §5에서 기각) | 09 P1-5 (09 S6) | `src/components/ui/LoadingSteps.tsx:14-19` |
| P1-C6 | 백업 왕복 수리 — 서버 내보내기 형식 감지 → 역매핑 복원(최소 스펙: 정직한 안내) + 삭제 모달 카피 + 의심 문형 제거 | 04 P1-1 + 02 P1-7 (04 S2) | `settings/page.tsx:91-122,743` |
| P1-C7 | 삭제 tombstone 전파 — loadAndMerge가 deleted_at 행으로 로컬 유령 사본 제거(기기 간 삭제 전파 + 부활 자가치유) | 04 P1-5/P2-3 (04 S6) | `src/lib/db.ts:111-151,130` |

**D. 목소리·언어 일괄 (한 스윕)**

| # | 항목 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|
| P1-D1 | 토막 에러 9곳+ErrorBoundary+공용 사전 — "{어디가} 막혔어요 — 작업물은 그대로 — 손잡이 하나" 패턴 통일 | 02 P1-2/P1-3/P1-5 (02 S4) | `ProgressiveFlow.tsx:1998-3018`, `ErrorBoundary.tsx:49-54`, `ko.ts:9,48,174-175,285,301` |
| P1-D2 | 용어 통일: KO "현재 방위"로 (카드·타임라인·manifest), 갈래 칩은 "지금 가는 갈래"로 개명(동음이의 해소) | 06 P1-1 (06 S1) | `CurrentBearingCard.tsx:101,112`, `DecisionReplayTimeline.tsx:120`, `workspace/page.tsx:148`, `src/app/manifest.ts:7` |
| P1-D3 | 히어로 기대설정 1줄 — "로그인 없이 무료 · 30초 **안팎**이면 첫 읽기가 와요 · 내용은 분석에만 쓰여요" | 06 P1-2 (06 S2) | `SirenHero.tsx:328-355` |
| P1-D4 | BindCard 다리 2줄 — 진행 신호("뒤에서 이미 읽고 있어요") + 오디세우스 반 문장 (SPINE INVARIANTS 무접촉) | 06 P1-3 (06 S3) | `BindCard.tsx:103,110-113,169` |
| P1-D5 | 봉인 버튼 곁 캡션 — "봉인 = 정한 날에 「그래서, 어떻게 됐어요?」를 물어드리는 거예요" (SealModal:67 반 토막 이식, 47/0 지점) | 06 P1-4 (06 S4) | `CurrentBearingCard.tsx:134-158`, `ReceiptView.tsx:240` |
| P1-D6 | 귀환 항구·빈 화면 카피 — "4단계 프로세스" 소멸, "~없습니다" 부재 통보 → 모항 문안 (02·05·10 세 보고서 문안 취지 동일 — 02 기준 채택) | 02 P1-6 + 05 P2-7 + 10 P2-2 (02 S6, 10 S6) | `project/page.tsx:400,420,431-433,550`, `ReceiptList.tsx:81-86`, `import/page.tsx:227` |
| P1-D7 | 레거시 문 봉쇄 + 가이드 재작성 — guide LegacyChip 삭제·NextStepGuide 링크 교체(레거시 프로젝트 안에서만 허용)·레벨/XP 문단을 항해 4박자로 교체 | 05 P1-3/P1-5 + 02 P2-3 (05 S3·S4) | `guide/page.tsx:331-364,445-448`, `NextStepGuide.tsx:32,42,65` |
| P1-D8 | /design/* 2개 비공개화 (고아 라우트, 링크 0건) | 05 P1-6 (05 S5) | `src/lib/public-paths.ts:17` |

### P2 — 소품 (묶어서 처리)

| 묶음 | 항목들 | 출처 |
|---|---|---|
| 카피 소품 | "내 lean"→"내 예상"(SealModal:105, ReceiptView:354) · 검수 버튼 "내 항로"→"내 검수 기록"(ReviewFlow:499,325) · Analysis done→분석 끝(ko.ts:186) · "Settings에서"→"설정에서"(workspace:664-685) · "해금!"→"새 선원이 승선했어요"(UnlockToast:47) · 로딩 문구(ko.ts:8) · Slack 토막(ko.ts:228-239) · 맨몸 "서버 오류 (500)"·차단기 문구(llm.ts:91,106,143) | 06 S5·S7, 02 S7, 10 S7 |
| 대기 소품 | 문구 없는 원 2곳에 "세션을 확인하는 중이에요"(AuthGuard:71, login:112) · fetch 타임아웃 공용 헬퍼 `timeoutSignal()` 9곳(api-account·ShareComposer·Slack·Telegram·토큰) · email/send maxDuration | 09 S7·S8 |
| 화면 소품 | 프로젝트명 title 속성(workspace:139) · due 칩 truncate(project:486-501) · 검수 concern 칩 min-h(ReviewFlow:566-578) · 필터/검색 7개 이상일 때만(project:508-545) · 설정 섹션 재배치(settings:175-182) | 05 S7·S8, 05 §4 |
| 정합 소품 | 이주 토스트 push 검증(AccountSyncToast:52 + account-migration) · 랜딩 헤더 골드 점(선택) · SirenHero 주석 드리프트 · OutputSelector "항해일지"→"이 항해 돌아보기" | 04 S8, 03 S7, 06 S8, 08 P2-3 |
| 거취 판정 | **WakeReturn·DecisionReplayTimeline** (프로덕션 import 0): 08 S6 연대기·03 S8 항적 블록에서 재사용 판정 먼저, 불가면 Clean Removal 삭제. bp-seal-stamp 죽은 CSS는 랜딩 자산으로 보존(07 지시) | 03 P2-1 + 08 P2-1 |
| 다음 단계 후보 | 함대 해도(ChartPlate 부활, 08 S4 — 조건부: 난파 강조 금지·2개 미만 미렌더·접기) · 교차-결정 항해일지(08 S6) — 열흘 계획 뒤로 | 08 S4·S6 |

---

## 3. 구현 순서 제안 (의존관계 포함)

```
1일차   [신뢰의 응급실 — 전부 독립, 오늘 끝남]
        P0-1 테이블 2개 추가(+고아 청소 SQL) ── 독립
        P0-4 getSession 4초 컷 헬퍼 ────────── 독립
        P0-7 옆길 칩 제거 ─────────────────── 독립
        P0-3 NavigatorStrip 제거/내부화 ────── 독립 (테스트 갱신 동반)

2일차   [알림 채널 한 뇌 — 한 파일군, 한 커밋 흐름]
        P0-2 웹훅 배선 → 이중발송 차단 → 양방향 정산 → 한국어 카피
        └→ P1-B1 재알림 상한+mute 버튼 (같은 파일, 바로 이어서)

3일차   [귀환 한 집 — 순서 의존]
        P0-6① Header 목적지 고정 + /project 검수 합류 (dueCount 공용 훅 추출)
        └→ P0-6② workspace 등불 스트립 (훅 재사용)
            └→ P0-6③ 완료 화면 재구성 · P1-A4 VoyageEta 칩+축적 한 줄

4일차   [상태 정직화 — P0-5가 선행]
        P0-5 knew-you 플래그 + 만료 토스트 + 무료체험 분기 + AuthGuard
        └→ P1-C1 SyncStatus 개편 (knew-you 상태 필요)
        P1-C2 LLM 총예산 · P1-C3 오프라인 · P1-C4 콜백/텔레그램 (독립 병렬)

5일차   [목소리 대청소 — 카피만, 병렬 가능]
        P1-D1 에러 패턴 · P1-D6 빈 화면 · P1-B4 FAQ 정합 · P1-B6 지각 라벨
        P1-D2 용어 통일 · P1-D3~D5 첫 3분 다리 · P2 카피 소품 일괄
        (회귀: checkin-reminder·telegram-settlement·seal-core·navigator-content·status 테스트 갱신,
         vitest --exclude "**/.claude/**")

6일차   [배관 잔여]
        P1-C6 백업 왕복 · P1-C7 tombstone · P1-B2 이메일 옵트인 일괄 · P1-B3 검수 이메일 고지
        P1-B5 벨 카피 축소 · P1-C5 LoadingSteps · P1-D7 레거시 봉쇄 · P1-D8 /design 비공개

7~8일차 [의식 — 순서 고정: CSS → 인장 → 장면 → 증서 → 검수 → 위계]
        P1-A3 봉인 의식 (07 S1→S2→S3→S4가 한 몸, S5·S6 독립 커밋)
        └→ P1-A1 판단 액자 (증서의 세리프 인용 register 재사용 — 의식 뒤가 효율적)

9일차   [보물 합산]
        P1-A2 RecordStrip 한 뇌 (+ 숫자 일치 교차 테스트)
        └→ P1-A5 3고리 의식 (RecordStrip 필요)

10일차  [소품·거취·검증]
        P2 잔여 일괄 · WakeReturn/ReplayTimeline 거취 판정 · tsc 0 + 전체 vitest + 실주행
        (Persistence 원칙: 실주행 후 "예상 테이블 행수 늘었나" 확인 — 특히 P0-2 정산 전파)

이후    함대 해도(08 S4) · 교차-결정 항해일지(08 S6) · 이메일/전제 크론 장기안
```

핵심 의존 사슬 3개: ① dueCount 훅 → 등불 → 칩 (3일차 내부), ② knew-you → SyncStatus/분기들 (4일차 내부), ③ 의식 register → 판단 액자 (7~9일차). 나머지는 전부 독립이라 순서 조정 자유.

---

## 4. 스파인 위험 목록 (긴장이 있는 제안 — 정직하게)

zero-judgment 스파인과 **긴장이 0인 척하지 않는다.** 아래는 채택하되 조건을 계약으로 붙인 것들이다.

| 제안 | 긴장 지점 | 채택 조건 (위반 시 그 부분만 철회) |
|---|---|---|
| P0-6 워크스페이스 등불 + P0-2 재알림 | 귀환 표면 확대 = 개입 확대로 흐를 수 있음. "정한 날의 이행"과 "조르기"의 경계 | due 0건이면 렌더 0 · "나중에 할게요" 1탭 dismiss · 재알림 3회 상한+mute 버튼(현행 무한 반복이 오히려 거울 조항 위반이었음) · "오랜만이에요" 류 부재-길이 인사 금지(부재 집계도 출석부다 — 10 S4) |
| P1-A3 봉인 의식 | 금색 의식이 verdict-by-styling으로 읽힐 위험 · 의식 강요 | 모든 봉인에 내용·방향 무관 동일 1회 · 어디든 탭 = 즉시 스킵 · reduced-motion 정지 프레임 · 거절 경로 무의식·무변경 · BindCard(dominant skip)에는 절대 안 얹음 · 레지스터 계약(--bp-* 금지) 무접촉을 테스트로 확인 |
| P1-A5 3고리 의식 | "축하"가 평결로 넘어갈 위험 | 문턱=제품이 이미 성문화한 표본 크기 상수(dim9) · "여전히 점수는 아니에요" 문장 내장 · 로컬 플래그로 평생 1회 · 사용자 평가 어휘("잘하고 있어요") 금지 |
| 함대 해도 (P2 후보) | 난파/표류 배 전시가 실패 판정으로 읽힘 | **조건부 통과**: 기존 카드 vignette과 동일 시각 강도만 · 별도 강조 금지(숨기면 트로피 케이스, 울리면 판정) · 2척 미만 미렌더 · 접기 탈출구 |
| P0-3 Navigator 대체 문안 | "기록만 해둘게요" 등 관찰 진술도 인물평으로 반 발짝이면 넘어감 | 1안은 **인사이트 생성 자체 제거** · 대체 시 빈도-사실+해석 반환("마지막 문장은 당신 것이에요")까지만 |
| P1-D4 오디세우스 다리 | 은유 설명이 BindCard의 의도된 가벼움을 무겁게 만들 위험 | SPINE INVARIANTS(스킵 지배·프리필 금지·포크 금지, BindCard:16-21) 코드 무접촉 · 반 문장 한도 |
| P1-A1 판단 액자 | 두 인용의 diff를 제품이 해설하면 그 순간 판정이 됨 | 원문 인용+날짜 스탬프만 · 요약·평가·해설 문장 절대 금지 · AI 유래 예측은 "AI가 대신 적어둔 확인 질문" 라벨로 provenance 구분 |
| P1-B5 전제 벨 (장기안) | 재확인 크론은 구조적 과발화 위험(드리프트 알림 남발) | 이번 계획에서 **보류**(§5) — 단기 카피 축소만. 장기 구현 시 사실 진술만+인앱 배지만+높은 발화 문턱 유지 |

공통 바닥: 어떤 신규 문장도 점수·등급·백분율·타인 비교·칭찬/질책을 도입하지 않는다. 이 계획의 P0-3은 스파인 위반의 **제거**이고, 나머지는 전부 사실 서술·탈출구 추가·개입 상한 방향이다.

---

## 5. 하지 말 것 (보고서가 제안했거나 유혹적이지만 기각)

1. **"현실이 3일째 기다려요" 라벨 (02 P2-1 문안) — 기각.** 온기로 포장해도 날수 집계는 집계다. 10·03의 "확인할 차례"가 승리 판정 (P1-B6에 반영).
2. **전제 재확인 크론(premise-recheck) 지금 구현 (04 S3 장기안) — 보류.** 비용·과발화 위험 대비 사용자 0명이 기다리는 기능. 벨 카피 축소(정직화)가 먼저고, 크론은 실수요 신호 후에.
3. **레거시 도구 4종에 AbortController 취소 배선 (09가 스스로 비권고) — 기각.** 강등 예정 화면에 화면당 수술은 과투자. LLM 총예산 180초(P1-C2)가 상한을 만드는 것으로 갈음.
4. **/tools/reframe 등 4개 독립 페이지·/agents·/boss 라우트 삭제 — 금지.** 북마크·옛 세션·`?reviewer=` 핸드오프·저장 데이터가 실존. 새 유입만 끊는다(05 S3 원칙: 레거시 안에서는 레거시 링크 허용).
5. **스트릭("연속 N일")·주간 요약 푸시·리더보드 — 명시적 비권고 (08).** 축적의 아름다움은 화면이 자라는 것이지 개입 빈도를 늘리는 게 아니다. 귀환의 유일한 정당한 트리거는 사용자가 봉인 때 정한 날짜.
6. **플러그인 statusline의 빨간 OVERDUE 순화 — 기각 (02·10·03 일치).** 개발자 표면의 의도된 정직한 신호. 단 이 어휘를 웹앱으로 수입하는 것은 금지(주석 박제, P1-B6).
7. **bp-seal-stamp 죽은 CSS 삭제 — 지금 하지 말 것 (07).** 랜딩용 자산으로 보존, 별도 청소 건으로만 기록.
8. **recastSystemPrompt / RecastStep 프롬프트 "중복 통일" — 금지.** CLAUDE.md가 박제한 의도적 비위반(두 뇌가 맞는 설계). 이번 카피 스윕에서 건드리지 않는다.
9. **commonThemes 채우기("패턴" 실체 만들기) — 기각 (08 S7).** 표본 미달 상태에서 테마를 지어내는 것이 정확히 Barnum 함정. 카피를 실체에 맞춘다("패턴"→"기록"). 빈도-서술 패턴은 settled≥3 이후 RecordStrip 확장으로만.
10. **강제 타이핑 게이트·"우리는 판단하지 않아요" 절대 선언 — 헌법 차원 금지.** 마찰 탈출구(스킵/그대로 쓰기)는 어떤 수리에서도 보존, 무결 주장 대신 한계 고지.
11. **검수 due를 워크스페이스 등불에서 별도 정산 UI로 처리 — 기각.** 새 정산 UI를 만들지 않는다. 모든 귀환 동선의 종착지는 /project의 기존 자동 모달 하나 (03 S3 원칙 = 05 S2 원칙).
12. **테이블·타입 통합으로 장부 4개를 물리적으로 합치기 — 기각 (08 S2).** 표시 계층 합산이면 충분. 병렬 세션 조율 규칙(공유 등록부 append만·기존 테이블 ALTER 금지) 준수.

---

## 부록 — 회귀 가드 공통 사항

- 카피 변경이 걸리는 테스트: `checkin-reminder` · `telegram-settlement`(키보드 5버튼) · `seal-core` · `navigator-content` · `navigator-simulation` · `review/status` · `record-core`. 실행은 항상 `npx vitest --exclude "**/.claude/**"` (중첩 워크트리 유령 실패).
- 새 localStorage 키(`argus:knew-you`, `argus:third-loop-seen`, 등불 dismiss)는 STORAGE_KEYS 등록 + persistence-contract CONTRACT에 localOnly 선언.
- SealMoment.tsx 등 한국어 문자열 파일은 mojibake-guard 감시 대상 — UTF-8 보존.
- 새 CSS 클래스는 앱 네임스페이스(`seal-*`)만 — design-register-contract(--bp-* 랜딩 밖 금지) 무접촉.
- 마이그레이션 필요 항목: **0건** (reminder_count·email_reminder·judgment_receipt 전부 기존 jsonb 내부). Supabase 기존 테이블 ALTER 없음.
