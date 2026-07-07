# 00 — MASTER: 완성도·매력도 감사 종합 실행 계획 (2026-07-03)

> **최종 상태: 5회 리뷰 완료, 실행 준비됨** (통합+여정+스파인+기술리스크+실행순서+적대회의).
> **총 항목: P0 8건 · P1 33건(A5·B6·C7·D8·E7) · P2 7묶음**(그중 '다음 단계 후보' 1묶음과 §3.5의 defer 2건은 이번 실행 밖).

> 입력: 11개 감사 보고서 (04-betrayal · 05-subtraction · 02-voice · 09-waiting · 10-worst-day ·
> 06-first-3min · 03-return · 07-signature · 08-treasure + **11-mcp · 12-mcp-deep — argus-mcp 10각도, 1급 표면**).
> 모든 항목에 출처 보고서 + 파일:줄.
> 이 문서는 발견의 나열이 아니라 **판정 결과**다 — 중복은 합쳤고, 충돌은 판정했고, 일부 P0는 강등했고, 일부 제안은 기각했다(§5).
> MCP는 창업자가 "진짜 킥"이라 지목한 표면이라 웹앱과 **동급으로** 이 계획에 짜여 있다 — 별도 트랙이 아니라 같은 컨셉은 같은 날·같은 문안으로 합류시켰다(§2 E묶음, §3).

---

## 1. 전체 요약 (비개발자 창업자용, 14줄)

1. 좋은 소식부터: **의식(봉인·정산·귀환 모달)과 핵심 항해 경로는 이미 상위권 제품 수준**입니다. "그래서, 어떻게 됐어요?"라는 목소리, 취소 가능한 로딩, 정직한 에러 분류 — 9개 감사가 모두 "건드리지 말 것" 목록을 먼저 적었습니다.
2. 나쁜 소식: **가장 아픈 구멍 3개가 전부 "약속과 실제의 어긋남"**입니다. 잘 만든 화면 뒤의 배관이 새고 있어요.
3. 첫째, **계정을 완전 삭제해도 최근 추가된 테이블 2개(검수 기록·결정 항목)가 서버에 영원히 남습니다** — 개인정보처리방침 위반이고, 고치는 건 몇 줄입니다.
4. 둘째, **지금까지 실제 발송된 귀환 알림은 딱 1건인데, 그 1건의 답장 버튼이 죽어 있습니다.** 누르면 아무 일도 안 일어나고, 같은 영어 기계문이 7일마다 다시 옵니다. "정한 날 물어봐 드려요"라는 제품의 단 하나의 약속이 물어놓고 대답을 못 받는 상태예요.
5. 셋째, **돌아온 사용자를 알아보는 화면이 한 곳(/project)뿐인데, 사용자가 실제로 착륙하는 곳(/workspace)은 돌아올 결정을 한 글자도 모릅니다.** 47개 열림 / 0개 정산이라는 깔때기의 정확히 그 지점입니다.
6. 스파인 위반도 하나 라이브입니다: 워크스페이스에 상시 떠 있는 항해장 스트립이 **"판단 품질 점수 · 초보/숙련/마스터 등급 · 하락했습니다"라는 평결**을 사용자에게 직접 말하고 있어요. 문구 수정이 아니라 제거 대상입니다 — 그리고 "개선되고 있습니다"라는 **칭찬도 같은 평결**이라 함께 없앱니다(칭찬을 남기면 침묵이 곧 나쁜 성적표가 됩니다).
7. 그 외 P1은 대부분 "카피와 배선"입니다: 영어 기계문 알림, "실패" 두 글자 에러, "확인 지남 (183일)" 같은 출석부 라벨, 켜는 스위치 없는 이메일 알림, 한 번 실패하면 영영 앰버인 동기화 배지.
8. 매력도 쪽의 두 가지 큰 기회: **봉인을 2.6초 의식(밀랍 인장)으로 승격**하는 것과, **사용자가 직접 쓴 판단 한 줄·정산 서사를 다시 보여주는 "판단 액자"** — 해자라고 부르는 원문이 지금 write-only입니다.
9. 실행 순서는 "신뢰 응급실 → 알림 채널 → 귀환 한 집 → 상태 정직화 → 목소리 일괄 → 의식 → 축적 → 소품·검증"의 **8개 웨이브**입니다 — 사람 손으로는 약 열흘 분량이지만, 이번엔 자율 에이전트가 **한 세션에** 순서대로 실행합니다(리뷰4에서 같은 파일을 만지는 항목끼리 묶어 재배열). 마이그레이션은 사실상 0입니다(전부 기존 데이터로 지음).
10. 기각한 것도 있습니다(§5): 날수를 다시 세는 라벨, 전제 재확인 크론(과발화 위험), 레거시 도구 취소 버튼 배선(강등 예정 화면 과투자), 스트릭·주간 푸시 류 — 절제가 이 제품의 스파인입니다.
11. 터미널 표면(argus-mcp — 창업자가 "진짜 킥"이라 지목)도 같은 그림입니다: **엔진과 가드는 출하 품질**(열기→봉인→2주 뒤 귀환→정산 전 구간을 실제 실행으로 완주 검증, P0 없음)인데, 계정 연동 도구(argus_sync)가 "여기서 정산하라"고 안내하는 동선이 id 불일치로 **100% 실패**합니다 — 이게 MCP의 유일한 P0이고, 잘못된 복구 힌트가 이중 봉인까지 유도합니다.
12. 그리고 MCP에는 웹앱이 가진 세 가지가 같은 자리에서 비어 있습니다: 봉인 순간의 의식(정산 영수증은 아름다운데 봉인은 영어 한 줄), 돌아온 사람 알아보기(닻 거울 없이 곧장 "정산해라"), 한국어 사용자 기본기(아침 9시까지 어제인 시간대, 아무 도구도 안 읽는 언어 설정, 한국어 막연 술어 통과). 전부 웹앱 항목과 **같은 날, 같은 문안으로** 계획에 끼워 넣었습니다.
13. 여정 리뷰(리뷰1)에서 이음새 두 곳을 더 조였습니다: **정산을 마친 화면이 다음 결정으로 가는 손잡이 없이 그냥 닫히던 것**(고리를 닫은 사람이 두 번째 봉인으로 이어질 문이 없음 — P1-A1에 조용한 링크 1개), 그리고 **MCP에서 봉인하고 웹에서 정산하면 터미널이 그걸 영영 모르던 것**(정산 끝난 결정을 계속 "확인할 차례"라고 조르게 됨 — P0-8에 대조 한 줄).
14. 실행 리뷰(리뷰4)에서 전 항목에 작업량 태그(S/M/L)를 달고, 자율 실행에서 뺄 것을 §3.5에 명시했습니다: **백업 역매핑 복원 본체**(복원 버그가 사용자 데이터를 오염시킬 수 있어 이번엔 정직한 안내까지만)와 **이메일 실발송 검증**(헌장 안전경계 — 코드까지만, 발송 확인은 아침에). 큰 항목(봉인 의식·귀환 한 집)은 빼지 않고 **최소 완성선**을 정의해 전부 실행합니다.

---

## 1.5 재정렬 판정 기준

- **P0** = 지금 실사용자에게 닿는 약속 위반·데이터 손실·죽은 핵심 루프·스파인 위반. (매력도 P0는 없다 — 매력은 신뢰 위에만 선다.)
- **P1** = 신뢰를 깎는 카피·배선·상태 거짓말 + 핵심 루프의 매력도(의식·액자·등불).
- **P2** = 소품·정합·선택.
- 원 보고서의 P0 중 2건을 강등했다: **08 P0-1(판단 액자)·08 P0-2(장부 분열)** — 파손이 아니라 기회 손실이고(실DB 피해자 0), P1 최상단으로 내리되 이번 실행 계획 안에는 반드시 포함.
- MCP 감사(11·12)에서 합류한 P0는 1건: **11 P0-1(argus_sync→argus_settle 동선 100% 파손)** → 전체 P0-8. 12는 실제 완주 실행으로 P0 없음을 확인했다("엔진과 가드는 출하 품질" — 그 자체가 보고할 발견). 두 보고서의 중복 발견(locale 죽은 스위치 = 11 P1-4 = 12 P2-4)은 P1-E1 하나로 병합.

---

## 2. 통합 우선순위 실행 계획

### P0 — 8건 (순서 있음: 위에서부터)

작업량 태그(리뷰4): **[S]**=1시간 이내 · **[M]**=반나절 이내 · **[L]**=반나절 초과(분할·최소 완성선 필수). 웨이브 배치는 §3.

| # | 항목 | 무엇을 하나 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|---|
| **P0-1** | **계정 삭제·내보내기 테이블 2개 누락** | **[S]** `USER_DATA_TABLES`에 `decision_items`·`review_receipts` 추가(한 곳 고치면 삭제·내보내기 동시 수리 — delete/export 라우트 둘 다 이 배열을 순회함을 실코드 확인, 리뷰3) + erasure-coverage 테스트 스냅샷 갱신 — **이중 목록임에 주의(리뷰3)**: `LIVE_USER_SCOPED_TABLES`(erasure-coverage.test.ts:23-33)와 `USER_DATA_TABLES` **둘 다** 갱신해야 가드가 통과한다(한쪽만 고치면 그 테스트 자신이 막아줌). **선행 확인**: `decision_items`는 병렬 세션(2026-07-02) 소유 테이블 — 적용 전 main 최신화 후 이미 등록돼 있으면 스킵(중복은 has-no-duplicates 단언이 잡음) + 고아 행 1회 청소 SQL + CLAUDE.md Schema Sync 절에 체크리스트 1줄 | 04 P0-1/P0-2 (04 S1) + 리뷰3 | `src/lib/user-data-tables.ts:16-49`, `src/app/api/account/delete/route.ts:42-53`, `src/app/api/account/export/route.ts:38-41`, `src/lib/__tests__/erasure-coverage.test.ts:23-33` |
| **P0-2** | **텔레그램 귀환 정산의 죽은 버튼 + 두 뇌 + 반쪽 정산** | **[M]** ① 웹훅에 `stl1|` 콜백·토큰 답장 분기 배선(파서는 이미 완성돼 있고 테스트만 import) ② checkin-due가 telegram_decisions 미러 있으면 건너뛰기(이중 발송 차단) ③ `handleSettle`이 web-source 행이면 projects.decision_contract도 함께 닫기 ④ 카피를 seal-core의 한국어 한 뇌로("그래서, 어떻게 됐어요?") — 02 P0-1과 같은 수술 부위이므로 한 커밋 | 03 P0-1/P0-3 + 02 P0-1 (03 S1·S2, 02 S1) | `src/app/api/telegram/webhook/route.ts:629-670,499-554`, `src/lib/telegram-settlement.ts:26-29,50-89`, `src/app/api/cron/checkin-due/route.ts:130-159`, `src/lib/seal-core.ts:163-199` |
| **P0-3** | **NavigatorStrip 점수·등급·평결 노출 제거** (스파인 규칙2 위반 라이브) | **[M]** '판단 품질' 점수·초보/숙련/마스터 등급·**등급 진행바(TierProgress)·점수 추이 차트** 렌더 제거(데이터는 내부 유지). 인사이트는 **평결 계열 전부** 대상 — "하락했습니다"(dqDeclining)뿐 아니라 **"개선되고 있습니다"(dqImproving, navigator.ts:679)도 같은 평결(칭찬도 규칙2 위반)**, "비판적으로 검토하면"(훈계), "가정 평가를 더 적극적으로 해보세요"(지시형 코칭, ko.ts:81-82) 포함 — **생성 자체 제거가 1안**(빈도-사실 문안 교체는 2안, 채택 조건은 §4). i18n 키 Clean Removal은 **ko.ts와 en.ts 대칭 키 동시 제거**(en.ts:103-106,148,253,259-261) + biggestGain/biggestDrop(ko.ts:112-113)·trend 라벨(ko.ts:153-155)·dqScore(ko.ts:267)까지 grep 전수. **테스트 갱신 구체화(리뷰3)**: `navigator-content.test.ts:1172`가 dqImproving/dqDeclining 메시지의 **존재**를 단언 — 1안 채택 시 이 단언을 부재 단언으로 뒤집고 navigator-simulation의 동일 픽스처(:97-98)도 갱신. NavigatorStrip 참조는 workspace/page.tsx 1곳뿐(전수 grep으로 확인 — Clean Removal 간단) | 02 P0-3/P1-1 (02 S3) + 리뷰2·3 | `src/components/workspace/NavigatorStrip.tsx:165-190,294,320`, `src/lib/navigator.ts:236,679,692`, `src/lib/i18n/ko.ts:74,81-82,110-113,119-120,146-147,153-155,267,273-275`, `en.ts` 대칭 |
| **P0-4** | **앱 대문 getSession 무타임아웃** | **[S]** 4초 레이스 컷(기존 llm.ts:465 패턴 복제) — `getSessionWithTimeout()` 공용 헬퍼로 auth.tsx·api-account bearer()·ShareComposer 3곳 공유. 과거 "73초 무한 스피너"의 마지막 형제 | 09 P0-1 (09 S1) | `src/lib/auth.tsx:70-77`, `src/lib/api-account.ts:8-13`, `src/components/ui/ShareComposer.tsx:225,305` |
| **P0-5** | **세션 만료 삼중 침묵** | **[M]** `argus:knew-you` 로컬 플래그(STORAGE_KEYS 등록) → 만료 시 토스트 1회("로그인이 잠시 풀렸어요 — 작업은 이 기기에 저장되고 있어요") + "무료 체험" 오인 분기 수리 + AuthGuard 귀환자 문안 + SyncStatus 로그인 게이트 밖으로 | 10 P0-1/P2-1 (10 S1) | `src/lib/auth.tsx:79-97`, `src/lib/db.ts:218`, `src/components/layout/Header.tsx:279-281`, `src/lib/llm.ts:81`, `src/app/[locale]/workspace/page.tsx:645-652`, `src/components/layout/AuthGuard.tsx:29-33` |
| **P0-6** | **귀환 항구 한 집 + 착륙 등불** (4개 보고서 합류점) | **[L — 3커밋 분할: ①+④(훅)=M, ②=S, ③=S]** ① Header due 배지 목적지를 `/project`로 고정 + /project가 useReviewStore를 읽어 검수 due 합산 — 검수 due는 같은 스트립에 동일 앰버 톤 칩(FileText 아이콘)으로 렌더, **클릭 시 `/tools/review`로**(ReceiptList가 urgent 최상단 정렬이라 목적지에서 길 안 잃음, 05 S2 세부) ② /workspace 착륙에 due 스트립 한 줄("⚓ 그래서, 어떻게 됐어요? — 돌아올 결정 N건" + [지금 답하기][나중에 할게요], due 0이면 렌더 0. **[나중에 할게요]는 당일 스누즈**(리뷰5): `argus:lantern-snooze`에 로컬 날짜 기록, 다음날 재렌더 — 영구 dismiss로 구현 금지(등불이 영영 꺼지면 귀환 고리 자멸), [지금 답하기] 목적지는 `/project`) ③ 완료 화면이 due면 헤드라인 교체("돌아오셨네요 — {날짜}에 물어보기로 한 게 있어요" — **날짜 앵커 필수, 부재 길이 집계("오랜만이에요"·"N일 만이에요") 금지**, 리뷰2)+정산 카드 최상단 ④ dueCount 계산(**프로젝트 due + 검수 due 합산**)을 공용 훅으로(두 화면 드리프트 방지 — Header·/project·등불 셋 다 이 훅) | 05 P0-2 + 03 P0-2 + 10 P1-3 (05 S2, 03 S3, 10 S4) | `src/components/layout/Header.tsx:83-86`, `src/app/[locale]/project/page.tsx:260-266,478-505`, `src/app/[locale]/workspace/page.tsx:562,703-758`, `ProgressiveFlow.tsx:3171-3223` |
| **P0-7** | **워크스페이스 옆길 칩 4개 제거** | **[S]** 입력창 아래 /agents·/boss·/teams·/guide 칩 블록 삭제(teams·guide는 Header 더보기와 순수 중복), /boss만 Header 더보기로 이사. 라우트는 전부 유지 | 05 P0-1/P1-4 (05 S1) | `src/app/[locale]/workspace/page.tsx:627-643`, `Header.tsx:46-51` |
| **P0-8** | **[MCP] argus_sync→argus_settle 동선 100% 파손** — sync가 "여기서 정산하라"며 계정 행 id를 주는데, MCP 봉인은 서버에 `mcp_` 접두사로 저장되어 그 id로 settle하면 항상 `NO_PRIOR_SEAL`; 복구 힌트("seal부터 하라")를 따르면 **이중 봉인** | **[M — ①②③ 먼저 한 커밋, ④ 역대조는 이어서]** ① sync 응답 receipt마다 `local_id`(`mcp_` 접두사 벗긴 값, 웹 봉인이면 null)·`settle_path` 필드 추가 ② surface 교체: "이 터미널에서 봉인한 것은 local_id로 argus_settle, 웹에서 봉인한 것은 웹 대시보드에서 정산하세요" ③ `NO_PRIOR_SEAL` recovery에 mcp_ 접두사/웹 봉인 분기 한 줄 ④ **역방향 대조(리뷰1)**: sync pull이 로컬 원장(replayLedger)과 계정 state를 대조 — `mcp_` 행이 계정에서 settled인데 로컬 원장은 sealed면 receipt에 `settled_in_account:true` + surface 한 줄("웹에서 이미 정산된 것 K건 — 로컬 원장에도 남기려면 argus_settle로 같은 outcome을 기록하세요"). **로컬 자동 정산은 금지**(사용자 확언 없는 대리 기록) — 이게 없으면 E3 닻 거울·E7 항적이 이미 정산한 결정을 계속 due로 인용한다. 전부 argus-mcp/ 내부 — 웹앱 무접촉. **회귀 가드(리뷰3)**: `argus-mcp/src/tools/__tests__/sync.test.ts`·`schema-validation.test.ts`가 sync 응답 형태를 단언 — receipt 필드 추가(local_id·settle_path·settled_in_account) 시 두 테스트 갱신 동반 | 11 P0-1 (11 S1) + 리뷰1·3 | `argus-mcp/src/tools/sync.ts:27-29,62,71-78`, `src/app/api/mcp/seal/route.ts:53`(읽기만), `argus-mcp/src/lib/resolve-contract.ts:22-34`, `state-machine.ts:71-77`, `ledger-replay.ts:240-246`(읽기 재사용) |

### P1 — 신뢰 배관 + 핵심 매력 (묶음별)

**A. 보물·의식 (원 08 P0 2건을 여기 최상단으로 강등)**

| # | 항목 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|
| P1-A1 | **[M]** **판단 액자 + 재봉인 온램프** — 봉인 한 줄(human_judgment)과 정산 서사(what_happened)를 검증 카드+정산 완료 화면에 세리프 인용으로 영구 전시 (마이그 0, "봉인 당시 / 돌아와서" 라벨, 해설 금지). 서사 없는 정산(텔레그램 버튼 정산 등 what_happened 부재)은 봉인 인용만 렌더 — 빈 자리를 지어내지 않는다. **봉인 인용 자체가 없으면(human_judgment는 optional — SealMoment:183 스킵 봉인·judgment_receipt 없는 구버전 계약) 액자 블록 미렌더**(빈 액자·placeholder 금지 — Defensive Data Access). 액자의 1급 인용은 **사용자 타이핑 전용 필드인 human_judgment만** — predicates의 `authored:'ai_surfaced'` 문장을 액자로 승격하지 않는다(리뷰2, 헌법 규칙1). **+ 정산 완료 화면("고리를 닫았어요", SettlementModal:330-364) 하단에 다음 손잡이 1개(리뷰1)**: 남은 due 있으면 "다음 확인할 것 N건"(사실 — 스트립이 이미 보여주는 수), 없으면 "새 결정 적기 → 워크스페이스" 조용한 링크. 자동 이동·모달 연쇄 금지 — 지금은 [확인]으로 그냥 닫혀 두 번째 봉인으로 가는 문이 0이다(1차 정산이 2차를 판다는 테제의 마지막 배선) | 08 P0-1→강등 (08 S1) + 리뷰1 | `src/components/projects/DecisionContractCard.tsx:299-339`, `src/stores/types.ts:607-616`, `SettlementModal.tsx:87-100,330-364` |
| P1-A2 | **[M]** **자차표 한 뇌** — `RecordStrip` 공용 컴포넌트 + `summarizeReviewRecord` 합산(표시 계층만, 테이블 통합 금지). /project·/tools/review·/workspace 3곳 배치. 텔레그램 record-core와 숫자 일치 교차 테스트 1개 | 08 P0-2→강등 + P2-2 (08 S2·S8) | `src/lib/decision-contract.ts:649-666`, `src/components/review/ReceiptList.tsx:53`, `src/lib/record-core.ts:12-18` |
| P1-A3 | **[L — 최소 완성선: 07 S1(키프레임)→S2(인장)→S3(장면)→S4(증서)가 한 몸으로 필수, S5(검수 미니어처)·S6(위계 중립화+active:scale)는 독립 소커밋으로 이어서. 시각 검증은 preview 스크린샷, 불가 환경이면 클래스·reduced-motion 단위 테스트로 갈음]** **봉인 의식 2.6초** — seal-* 키프레임(압인+쿵+잉크 링+날짜 쓰임) + SealStamp SVG + AnimatePresence 장면 전환 + 봉인 증서 플레이트(Graticule 질감+사용자 한 줄 인용) + 검수 초록 성공 배지→증서 미니어처 + 문서완성 금색 중립화(위계 역전 수리) + 버튼 active:scale. 모든 봉인 동일 1회·탭 스킵·reduced-motion 정지. **승계 주의(07 P2-3, 리뷰5)**: 다크 모드 금 그라디언트 위 흰 글자 대비 문제가 기존에 있음 — 새 인장·증서의 금색 위 텍스트는 고정 잉크색으로(과거 확정 교훈: 골드 그라디언트 배경엔 고정 텍스트색) | 07 P1-1~4, P2-1~2 (07 S1~S6) | `SealMoment.tsx:151-211,278,337-446`, `src/app/globals.css:2983`, `ReviewFlow.tsx:297-306,368-372`, `ProgressiveFlow.tsx:3168`, `CurrentBearingCard.tsx:150` |
| P1-A4 | **[S]** **대문 축적 신호** — "이어서 작업"에 VoyageEta 칩(주석이 약속한 사용처) + due 프로젝트 최상단 정렬 + 섹션 헤더 축적 한 줄(forming: "봉인 2개 — 첫 확인일이 오면 기록이 시작돼요"). **범위 가드(리뷰5)**: 전부 기존 행·기존 헤더 **내부**에만 — 새 섹션·새 칩 블록 추가 금지(P0-7이 같은 화면에서 실행하는 뺄셈과 상쇄되지 않도록) | 03 S4 + 08 P1-1/P1-2 (08 S3) | `workspace/page.tsx:703-758`, `src/components/workspace/VoyageEta.tsx:5-7`, `project/page.tsx:268-273` |
| P1-A5 | **[S]** **3고리 의식** — SETTLED_THRESHOLD=3 최초 도달 시 정산 완료 화면 한 줄+금색 실선 1회("세 번째 고리를 닫았어요… 여전히 점수는 아니에요"), 이후 이탤릭 자리를 사실 각인("기록 시작 {날짜}")으로 | 08 P1-3 (08 S5) | `src/lib/calibration-disclosure.ts:18`, `project/page.tsx:469-473`, `SettlementModal.tsx` |

**B. 알림·귀환 채널 정직화**

| # | 항목 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|
| P1-B1 | **[S]** **재알림 3회 상한 + "그만 물어봐 주세요" 버튼** — reminder_count(jsonb 내부, 마이그 0), 봇 키보드 5번째 버튼(mute — 웹 due 표면은 유지, 리마인더만 정지) | 10 P1-2 + 03 S1-4 (10 S3) | `checkin-due/route.ts:107,132`, `telegram-settlement.ts:57-68,122-130` |
| P1-B2 | **[M — 2조각 실행(리뷰4): 크론·본문·링크 분기 조각은 웨이브2, SealMoment 체크박스 조각은 웨이브6 — P1-A3이 같은 파일 같은 구간(:337-446 ↔ :365-389)을 만지므로 의식 커밋 직후에]** **이메일 귀환로 일괄** — SealMoment에 옵트인 체크박스("그날 이메일로도 물어봐 주세요") + 본문 한국어화(locale 분기) + 링크 `?from=checkin` → 로그아웃 기기 빈 화면 분기("봉인할 때 쓴 계정으로 로그인하면 바로 보여요"). 배치(리뷰1): 체크박스는 기존 .ics 버튼(SealMoment:383-389)과 같은 "돌아오는 길" 한 묶음으로 — 봉인 직후가 귀환 채널을 고르는 유일한 순간. 익명 사용자는 기존 로그인 CTA(SealMoment:365-377)가 그 자리를 이미 담당(새 채널 만들지 않음, §5-5) | 04 P2-1 + 02 P0-2 + 03 P1-1 (03 S5, 02 S2, 04 S7) + 리뷰1 | `SealMoment.tsx:365-389,493-497`, `src/lib/checkin-reminder.ts:36-43`, `checkin-due/route.ts:105-128`, `project/page.tsx:429-444` |
| P1-B3 | **[S]** **검수 이메일(Companion Brief) 사전 고지** — SealModal에 한 줄("확인일이 오면 이 예측을 이메일로 돌려드려요 — 그 외 메일은 없어요") + 발송 메일 하단 수신 중단 안내 | 04 P1-4 (04 S5) | `src/components/review/SealModal.tsx:65-70`, `src/lib/companion-brief.ts` |
| P1-B4 | **[S]** **가이드 FAQ 약속 정합** — "메일·알림은 보내지 않아요" 거짓을 SealMoment:496 문장으로 교체(두 표면 문장 복사 일치) | 04 P1-3 + 02 P1-4 (02 S5) | `src/app/[locale]/guide/page.tsx:124,155`, `SealMoment.tsx:496` |
| P1-B5 | **[S]** **전제 벨 정직화(단기만)** — 툴팁을 "주시 표시 켜짐 — 자동 알림은 아직 준비 중이에요"로 축소(또는 벨 숨김). 장기 재확인 크론은 §5에서 보류 | 04 P1-2 (04 S3 단기) | `src/components/projects/DecisionItemsCard.tsx:201`, `src/lib/premise-drift.ts:63,108` |
| P1-B6 | **[S]** **지각 라벨 전멸** — "확인 지남 (N일)"·"기한 지남"·"확인일이 지났습니다" → **"확인할 차례"** 계열로 통일(날수 집계 금지 — 02의 "현실이 N일째 기다려요" 문안은 기각, §5). 웹 표면 OVERDUE 수입 금지 주석 박제 | 10 P1-1 + 03 P1-2 vs 02 P2-1 **충돌 판정: 10/03 승** (10 S2, 03 S6) | `src/lib/review/status.ts:105-106`, `ReceiptList.tsx:117`, `src/app/[locale]/import/page.tsx:241,262` |

**C. 기다림·상태 정직화**

| # | 항목 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|
| P1-C1 | **[S]** **SyncStatus 양방향 정직화** — `reportSyncSuccess()` 신설+db.ts 성공 분기에서 발신, 초기 상태 'idle'(배지 미표시), P0-5의 knew-you 앰버 상태와 한 커밋. **병렬 세션 주의(리뷰3)**: db.ts는 공유 등록부 4개 중 하나 — 함수 신설은 sync-health.ts에 두고 db.ts 쪽 diff는 성공 분기 호출 1줄씩으로 최소화, 적용 전 main 최신화 | 09 P1-4 + 10 P2-1 (09 S5 + 10 S1b) + 리뷰3 | `src/components/ui/SyncStatus.tsx:16`, `src/lib/sync-health.ts:34-38`, `src/lib/db.ts:174,227` |
| P1-C2 | **[M]** **LLM 총예산 180초 + 재시도 이벤트** — fetchWithRetry에 벽시계 데드라인, `argus:llm-retry` 이벤트 → PhaseStatusBar substage("다시 시도하는 중 2/3") | 09 P1-3 (09 S4) | `src/lib/llm.ts:167-249` |
| P1-C3 | **[S]** **오프라인 정직화** — `navigator.onLine` 선검사(fetchWithRetry 시작부 = Single Source, 헛 재시도 7초 제거) + "적어주신 내용은 그대로 있어요" 고지 + ProgressiveFlow 에러 배너에 재시도 버튼 | 10 P1-4 (10 S5) | `llm.ts:241-246`, `workspace/page.tsx:658,667`, `ProgressiveFlow.tsx:2434-2452` |
| P1-C4 | **[S]** OAuth 콜백 10초 타임아웃 + 텔레그램 연결 try/catch(영구 스피너 수리) | 09 P1-1/P1-2 (09 S2·S3) | `auth/callback/page.tsx:25`, `useTelegramStore.ts:64-76`, `settings/page.tsx:830-845` |
| P1-C5 | **[S]** 레거시 LoadingSteps 가짜 진행 정직화 — 경과초 + "단계 표시는 대략적 안내" (취소 배선은 §5에서 기각) | 09 P1-5 (09 S6) | `src/components/ui/LoadingSteps.tsx:14-19` |
| P1-C6 | **[이번 실행은 S — 최소 버전만, 역매핑 복원 본체는 §3.5-1 defer]** 백업 왕복 수리 — 서버 내보내기 형식 감지 → 역매핑 복원(최소 스펙: 정직한 안내) + 삭제 모달 카피 + 의심 문형 제거 | 04 P1-1 + 02 P1-7 (04 S2) | `settings/page.tsx:91-122,743` |
| P1-C7 | **[M]** 삭제 tombstone 전파 — loadAndMerge가 deleted_at 행으로 로컬 유령 사본 제거(기기 간 삭제 전파 + 부활 자가치유). **구현 제약(리뷰3 — 실배관 확인)**: 현재 db.ts:130이 tombstone 행을 fetch 후 클라이언트에서 필터 → 걸러진 id가 remoteIds에 빠져 **로컬 유령이 localOnly로 분류돼 매 로드마다 재-upsert되는 루프가 현존**(upsert payload에 deleted_at이 없어 서버 삭제 상태는 유지되지만 헛 push가 영구 반복). 수리는 ① tombstone id를 **필터 전** 응답에서 수집(추가 쿼리 불필요) ② 로컬/merged에서 유령 제거를 **localOnly 계산 앞**에 배치(제거+재푸시 차단이 한 수술) ③ deleted_at 컬럼 없는 테이블은 select('*')가 undefined 반환 → 산 것으로 취급되어 하위호환 자동 안전(스키마 검사 불필요) ④ db.test.ts에 "tombstone 행은 재푸시되지 않는다" 회귀 테스트 1개 | 04 P1-5/P2-3 (04 S6) + 리뷰3 | `src/lib/db.ts:111-151,130,137-143` |

**D. 목소리·언어 일괄 (한 스윕)**

| # | 항목 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|
| P1-D1 | **[M]** 토막 에러 9곳+ErrorBoundary+공용 사전 — "{어디가} 막혔어요 — 작업물은 그대로 — 손잡이 하나" 패턴 통일 | 02 P1-2/P1-3/P1-5 (02 S4) | `ProgressiveFlow.tsx:1998-3018`, `ErrorBoundary.tsx:49-54`, `ko.ts:9,48,174-175,285,301` |
| P1-D2 | **[S]** 용어 통일: KO "현재 방위"로 (카드·타임라인·manifest), 갈래 칩은 "지금 가는 갈래"로 개명(동음이의 해소) | 06 P1-1 (06 S1) | `CurrentBearingCard.tsx:101,112`, `DecisionReplayTimeline.tsx:120`, `workspace/page.tsx:148`, `src/app/manifest.ts:7` |
| P1-D3 | **[S]** 히어로 기대설정 1줄 — "로그인 없이 무료 · 30초 **안팎**이면 첫 읽기가 와요 · 내용은 분석에만 쓰여요". **정직성 조건(리뷰5)**: "30초"는 06의 제안치일 뿐 실측 근거가 없다 — 구현 시 스모크 1회로 첫 스트리밍 토큰 도달을 재고, 30초 안팎이 아니면 시간절만 뺀다("첫 읽기가 바로 시작돼요" — 목소리 원칙4: 약속은 실제 동작만큼만) | 06 P1-2 (06 S2) | `SirenHero.tsx:328-355` |
| P1-D4 | **[S]** BindCard 다리 2줄 — 진행 신호("뒤에서 이미 읽고 있어요") + 오디세우스 반 문장 (SPINE INVARIANTS 무접촉) | 06 P1-3 (06 S3) | `BindCard.tsx:103,110-113,169` |
| P1-D5 | **[S]** 봉인 버튼 곁 캡션 — "봉인 = 정한 날에 「그래서, 어떻게 됐어요?」를 물어드리는 거예요" (SealModal:67 반 토막 이식, 47/0 지점) | 06 P1-4 (06 S4) | `CurrentBearingCard.tsx:134-158`, `ReceiptView.tsx:240` |
| P1-D6 | **[S]** 귀환 항구·빈 화면 카피 — "4단계 프로세스" 소멸, "~없습니다" 부재 통보 → 모항 문안 (02·05·10 세 보고서 문안 취지 동일 — 02 기준 채택) | 02 P1-6 + 05 P2-7 + 10 P2-2 (02 S6, 10 S6) | `project/page.tsx:400,420,431-433,550`, `ReceiptList.tsx:81-86`, `import/page.tsx:227` |
| P1-D7 | **[S]** 레거시 문 봉쇄 + 가이드 재작성 — guide LegacyChip 삭제·NextStepGuide 링크 교체(레거시 프로젝트 안에서만 허용)·레벨/XP 문단을 항해 4박자로 교체 | 05 P1-3/P1-5 + 02 P2-3 (05 S3·S4) | `guide/page.tsx:331-364,445-448`, `NextStepGuide.tsx:32,42,65` |
| P1-D8 | **[S]** /design/* 2개 비공개화 (고아 라우트, 링크 0건) | 05 P1-6 (05 S5) | `src/lib/public-paths.ts:17` |

**E. MCP 1급 표면 (창업자: "argus-mcp가 진짜 킥") — 전부 argus-mcp/ 내부, 웹앱 공유 등록부 4개 무접촉 = 병렬 세션 안전. 웹앱 합류점은 굵게.**

| # | 항목 | 출처 (스펙) | 핵심 파일:줄 |
|---|---|---|---|
| P1-E1 | **[M — 최소 범위(리뷰4): 신규 렌더(E2·E3·E7)가 쓸 문자열 + 이미 갈라진 목소리의 surface만 사전에 편입. 13개 도구 전 문자열의 전면 이주가 아님 — 나머지는 도구를 고칠 때마다 점진 편입]** **locale 한 뇌** — surface/렌더 문자열을 `argus-mcp/src/lib/surfaces.ts` 한 파일의 `{ko,en}` 사전으로 모으고 각 도구가 `readConfig(dir).locale`로 선택 (Single Source of Truth for Prompts의 MCP 동형). 죽은 스위치 소생(11 P1-4 = 12 P2-4 동일 발견 병합) + 갈라진 목소리 통일(seal/settle/open 영어 ↔ sync/review 한국어 하드코딩). **E2·E3·E7 렌더의 선행 의존**. **범위 제약(리뷰3)**: ① `argus-mcp/src/lib/review/*` 8파일은 웹앱과 byte-단위 drift 가드(`review-mcp-drift.test.ts`) 대상 — locale 이사에서 **무접촉**(tools/review.ts:173의 surface는 도구 파일이라 안전; 코어 render/prompts의 문자열을 옮기고 싶으면 이번 계획 밖) ② MCP 테스트가 surface **내용**을 단언함(`loop.test.ts:99` `toContain('skipped')`, `integration-simulation.test.ts:23` 금지어 정규식) — en 기존 문구를 기본 보존하고, 바꾸는 문장은 해당 테스트 갱신 동반 | 11 P1-4 (11 S5) + 12 P2-4 병합 + 리뷰3 | `argus-mcp/src/lib/locale.ts:4`, `src/tools/init-config.ts:70-77`, `seal.ts:126`, `sync.ts:62-63`, `review.ts:173` |
| P1-E2 | **[M]** **seal_text 봉인 확인문** — `renderSeal(receipt, locale)` 신설, seal 성공 `data.seal_text`(필드 설명에 "사용자에게 그대로 보여줄 것")로 반환: 사용자 술어 인용 블록 + "이 문장은 당신의 것입니다"(provenance 사실 진술) + 봉인/현실의 답 날짜 2행 + "기록될 것은 평가가 아니라 실제로 일어난 일". ai_surfaced면 소유 줄 정직 분기("Argus가 초안한 문장 — 아직 당신이 확언하지 않았습니다"), 그대로 봉인 가능(게이트 금지). **웹앱 P1-A3 봉인 증서 플레이트와 같은 의식의 텍스트 판 — 인용·날짜·"평가 아님" 문장의 취지를 두 표면 동일 문안 계열로** (7~8일차 동시 구현) | 12 P1-1 (12 §3.1) | `argus-mcp/src/tools/seal.ts:124-127`, `src/lib/render-receipt.ts` |
| P1-E3 | **[S]** **check_in 닻 거울** — due 항목에 `sealed_at`·`days_since_seal`·`your_words_then`(receipt.human_judgment, skipped면 생략) 추가 + surface "봉인 후 N일 — 그때 당신은 이렇게 적었습니다: '…' 현실이 어떻게 답했는지만 기록하면 됩니다 (argus_settle)". 여러 건이면 가장 오래된 1건만 surface, 나머지는 data. **웹앱 P0-6 등불·WakeReturn 닻 거울과 같은 컨셉, "그래서, 어떻게 됐어요?" 문안 계열 공유** (3일차 동시). 환영 인사 금지 — 인식은 날짜 산수로만, due 0건 문구 현행 유지("Nothing to nudge.") | 12 P1-2 (12 §3.2) | `argus-mcp/src/tools/check-in.ts:30-37,58`, `src/lib/receipt.ts` |
| P1-E4 | **[M]** **동기화 실패 발화 + upcoming 이행** — ① seal/settle syncLine 3-상태화(성공 / no_token 침묵 / 실패: "Account sync didn't go through — {reason}. Your seal is safe locally; the email reminder won't fire until it syncs. Try argus_sync later.") + `data.account_sync_reason` ② `include_upcoming_days`를 진짜 구현(`data.upcoming[]` + surface "다가오는 것 K건(참고용)") — 안 하기로 하면 스키마에서 삭제(받고 버리는 인자 금지) ③ (리뷰1) check_in이 due 0건인데 `ARGUS_TOKEN`이 설정돼 있으면 surface 끝에 정적 한 줄("Nothing due locally. Judgments sealed in your account: argus_sync shows them.") — **네트워크 호출 없이 문장만**(웹에서 봉인하고 터미널로 귀환한 사용자가 "아무것도 없다"로 오독하는 것 방지, check_in의 로컬 결정성은 유지). **웹앱 P1-B2·B3와 같은 "알림 약속 정직화"** — "이메일 오겠지"라고 믿게 방치하는 최악의 침묵 봉합 | 11 P1-2/P1-1 (11 S3·S2) + 리뷰1 | `argus-mcp/src/tools/seal.ts:122`, `settle.ts:112`, `check-in.ts:12,23-75,48-55`, `src/lib/push-account.ts:98-101` |
| P1-E5 | **[S]** **한국어 검증기 2건** — ① crux LEAN 정규식 `i('| w)?d` → `i'd|i would` 분해("user id" 오발로 멀쩡한 중립 질문이 CRUX_CARRIES_LEAN 죄인 취급 — 회귀 테스트: "Will the user id migration finish before Q3?" 통과) ② `VIBE_KO` 한국어 막연 술어 패턴 추가("잘 될 것 같다 아마도"가 봉인+축하까지 통과, 실측) + 에러 문안 ko 분기. 두 건 모두 weak 휴리스틱 지위 유지 — 하드 게이트 승격 금지(§5) | 11 P1-3 (11 S4) + 12 P1-4 (12 §3.4) | `argus-mcp/src/lib/validate-crux.ts:19`, `validate-seal.ts:20` |
| P1-E6 | **[S]** **ARGUS_TZ 가시화** — README 설치 예시 env에 `"ARGUS_TZ": "Asia/Seoul"` + 한 줄("미설정 시 UTC — 한국 사용자는 오전 9시까지 어제로 계산") + `argus_init` data에 `today`·`tz` 노출(설치 직후 어긋남 자가 발견). 기본값 UTC는 유지(§5) — 문서화+가시화만 | 12 P1-3 (12 §3.3) | `argus-mcp/src/lib/resolve-today.ts:19`, `README.md`(설치 스니펫), `src/tools/init-config.ts` |
| P1-E7 | **[M]** **wake_text 항적 렌더** — `renderWake(contracts, stats, today, locale)`를 recall view=bearing/contracts data에 반환: check_by 오름차순, 기한지남→대기중→정산됨 3그룹, 그룹당 5줄+`(+N)` 접기, 마지막 줄 "기록 시작 YYYY-MM-DD 부터"(가장 오래된 ledger ts). 개수·사실·시간축만 — %·등급·streak 금지를 spine-drift.test 단언으로 고정. JSON 측도 정렬+60건 truncate. **지각 어휘 거취(리뷰2)**: "확인일 지남 (N) · N일 경과"는 §5-6의 개발자-표면 판정(플러그인 statusline OVERDUE와 동일 지위)을 따라 **터미널에서 허용** — P1-B6의 전멸 대상은 웹 표면뿐이고, 이 어휘의 웹 수입 금지는 그대로 유지. **웹앱 P1-A4 대문 축적 신호와 같은 "축적이 보이는 풍경"** (9일차 동시) | 12 P2-1 (12 §3.5) | `argus-mcp/src/tools/recall.ts:97,105`, `src/lib/render-receipt.ts`, `src/**/spine-drift.test.ts` |

### P2 — 소품 (묶어서 처리)

각 묶음 = S~M. 웨이브 8에서 일괄 처리하되 묶음끼리 독립 — 세션 시간이 모자라면 **아래 표의 뒤 묶음부터 자른다**(카피 소품이 효과 대비 가장 싸므로 맨 먼저).

| 묶음 | 항목들 | 출처 |
|---|---|---|
| 카피 소품 | "내 lean"→"내 예상"(SealModal:105, ReceiptView:354) · 검수 버튼 "내 항로"→"내 검수 기록"(ReviewFlow:499,325) · Analysis done→분석 끝(ko.ts:186) · "Settings에서"→"설정에서"(workspace:664-685) · "해금!"→"새 선원이 승선했어요"(UnlockToast:47) · 로딩 문구(ko.ts:8) · Slack 토막(ko.ts:228-239) · 맨몸 "서버 오류 (500)"·차단기 문구(llm.ts:91,106,143) · KO 로케일에서 "LOG ENTRY"/"ON FILE" 병기 순서 뒤집기 — 한국어 앞, 모노 영문 뒤(SirenHero:278,395, workspace:610 — 06 P2-6, 리뷰5 편입) | 06 S5·S7, 02 S7, 10 S7, 06 P2-6 |
| 대기 소품 | 문구 없는 원 2곳에 "세션을 확인하는 중이에요"(AuthGuard:71, login:112) · fetch 타임아웃 공용 헬퍼 `timeoutSignal()` 9곳(api-account·ShareComposer·Slack·Telegram·토큰) · email/send maxDuration | 09 S7·S8 |
| 화면 소품 | 프로젝트명 title 속성(workspace:139) · due 칩 truncate(project:486-501) · 검수 concern 칩 min-h(ReviewFlow:566-578) · 필터/검색 7개 이상일 때만(project:508-545) · 설정 섹션 재배치(settings:175-182 — 구체 스펙(리뷰5): 순서·접기만 손댐, API 키/AI 엔진·연동/데이터를 앞으로, 오디오 앰비언트(:523-524)·Slack(:557-607)·Labs(:663-683)는 접힌 상태 기본 — 05 S8) | 05 S7·S8, 05 §4 |
| 정합 소품 | 이주 토스트 push 검증(AccountSyncToast:52 + account-migration) · 랜딩 헤더 골드 점(03 S7 스스로 "선택" 판정 — 시간 부족 시 이 묶음에서 첫 번째로 자름) · SirenHero 주석 드리프트 · OutputSelector "항해일지"→"이 항해 돌아보기" | 04 S8, 03 S7, 06 S8, 08 P2-3 |
| MCP 소품 | restraint 사유 enum→사람 문장 사전(`REASON_LINE`, "reversible_low_stakes" case 노출 수리 — 문장 끝은 "leave it as is stays a real option"형 핸들 반환) · 죽은 `falsifiability_note` 삭제 · settle/dismiss `idempotentHint:false`(현행은 거짓 신호) · server.ts 버전을 package.json에서(1.0.0↔1.3.0 드리프트) · gate_input replay가 첫-사용 인사 지우는 것 수리 · README 도구표에 argus_amend/argus_dismiss 2행(13개 중 11개만 실림) · 원장 `dropped_lines>0`이면 surface 한 줄 고지+백업 안내 · 영수증 유실 시 원장 predicate/check_by 폴백(빈 따옴표 인쇄 수리) · render-receipt 술어 줄 wrap(CJK 폭) · SERVER_INSTRUCTIONS에 `related_to`·`broken_premise_ref` 안내 2줄(축적의 알맹이가 옵션 인자인데 미안내) | 11 P2-1~P2-8 (11 S6·S7) + 12 P2-2/P2-3 (12 §3.6) |
| 거취 판정 | **WakeReturn·DecisionReplayTimeline** (프로덕션 import 0): 08 S6 연대기·03 S8 항적 블록에서 재사용 판정 먼저, 불가면 Clean Removal 삭제. bp-seal-stamp 죽은 CSS는 랜딩 자산으로 보존(07 지시) | 03 P2-1 + 08 P2-1 |
| 다음 단계 후보 | 함대 해도(ChartPlate 부활, 08 S4 — 조건부: 난파 강조 금지·2개 미만 미렌더·접기) · 교차-결정 항해일지(08 S6) — 이번 실행 뒤로(§3.5-3) | 08 S4·S6 |

---

## 3. 구현 순서 (1세션 자율 실행 — 8웨이브, 리뷰4 재배열)

이 계획은 자율 에이전트가 **한 세션(밤샘)에** 순서대로 실행한다 — 원래의 "N일차"는 사람-손 어림이었고, 실행 단위는 웨이브다. 재배열 원칙(리뷰4): ① P0 먼저(신뢰 응급실)는 유지 ② **같은 파일을 만지는 항목은 같은 웨이브에** — 원 10일 계획은 workspace/page.tsx를 4번(1·3·4·5일차), SealMoment.tsx를 2번(6·7일차) 다른 날에 열었다; 한 세션에선 한 번 연 파일에서 그 파일의 일을 끝내는 게 충돌·재독해 비용을 줄인다 ③ **검증을 마지막에 몰지 않는다** — 웨이브 경계마다 tsc + 해당 영역 테스트(중간 실패를 그 웨이브 안에서 잡음), 전체 스위트·스모크는 웨이브 8. MCP 항목은 전부 `argus-mcp/` 내부라 웹앱 파일과 충돌 0 — 같은 컨셉 웹앱 항목과 같은 웨이브에 배치, 문안 확정은 웹앱 커밋에서 먼저 하고 MCP가 같은 취지로 이식한다(기존 원칙 유지).

```
웨이브1 [신뢰의 응급실 — 전부 독립, 서로 파일 겹침 0]
        P0-1[S] 테이블 2개 추가(+고아 행 SELECT 집계 — 실행 판단은 §3.5-4)
        P0-4[S] getSession 4초 컷 헬퍼
        P0-3[M] NavigatorStrip 제거/내부화 (테스트 단언 뒤집기 동반)
        P0-8[M] [MCP] sync→settle 동선 봉합 (①②③ 한 커밋 → ④ 역대조 이어서)
        ✓ 경계 검증: tsc + erasure-coverage·navigator-content/simulation + MCP sync 테스트

웨이브2 [알림 채널 한 뇌 — checkin-due·telegram 파일군 한 자리]
        P0-2[M] 웹훅 배선 → 이중발송 차단 → 양방향 정산 → 한국어 카피
        └→ P1-B1[S] 재알림 상한+mute 버튼 (같은 파일, 바로 이어서)
        P1-B2[M]의 크론 조각: 본문 한국어화 + ?from=checkin 링크 + project 분기
          (SealMoment 체크박스 조각은 웨이브6으로 — A3와 같은 파일·같은 구간이라 분리, P1-B2 태그 참조)
        P1-B3[S] 검수 이메일 사전 고지 · P1-B5[S] 벨 카피 축소 (같은 "알림 약속" 테마)
        P1-E4[M] [MCP] 동기화 실패 발화 + upcoming (병렬)
        ✓ 경계 검증: checkin-reminder·telegram-settlement 테스트 (실발송은 금지 — §3.5-2)

웨이브3 [귀환 한 집 + 워크스페이스 파일군 — workspace/page.tsx를 여는 김에 전부]
        P0-6①[M] Header 목적지 고정 + /project 검수 합류 (dueCount 공용 훅 추출)
        └→ P0-6②[S] workspace 등불 스트립 (훅 재사용)
            └→ P0-6③[S] 완료 화면 재구성
        P0-7[S] 옆길 칩 제거 · P1-A4[S] VoyageEta 칩+축적 한 줄 (같은 파일군 — 여기로 이동)
        P1-E1[M] [MCP] locale 사전(surfaces.ts) 뼈대(최소 범위) ── E2·E3·E7 렌더의 선행 의존
        └→ P1-E3[S] [MCP] check_in 닻 거울 (웹앱 등불과 같은 웨이브 — "그래서, 어떻게 됐어요?" 문안 계열 일치)
        ✓ 경계 검증: tsc + 등불 due 0 렌더 0 확인

웨이브4 [상태 정직화 — P0-5가 선행]
        P0-5[M] knew-you 플래그 + 만료 토스트 + 무료체험 분기 + AuthGuard
        └→ P1-C1[S] SyncStatus 개편 (knew-you 상태 필요 · db.ts는 main 최신화+최소 diff)
        P1-C2[M]·P1-C3[S] (둘 다 llm.ts — 한 자리에서) · P1-C4[S] 콜백/텔레그램 (독립)
        P1-C7[M] tombstone 전파 (db.ts — C1과 같은 웨이브에서 main 최신화 1회로 처리)
        P1-C6[S — 최소 버전만, §3.5-1] 백업 정직 안내 + 삭제 모달 카피 · P1-C5[S] LoadingSteps 정직화
        ✓ 경계 검증: db.test.ts(tombstone 회귀 포함) + tsc

웨이브5 [목소리 대청소 — 카피만, 파일 겹침 커도 충돌 성질 아님]
        P1-D1[M] 에러 패턴 · P1-D6 빈 화면 · P1-B4 FAQ 정합 · P1-B6 지각 라벨
        P1-D2 용어 통일 · P1-D3~D5 첫 3분 다리 · P1-D7 레거시 봉쇄 · P1-D8 /design 비공개
        P2 카피 소품 일괄 (같은 ko.ts/컴포넌트 스윕에 편승 — 별도 웨이브보다 싸다)
        P1-E5[S] [MCP] 검증기 2건 · P1-E6[S] ARGUS_TZ · MCP 소품 목소리분(REASON_LINE 등)
        ✓ 경계 검증: seal-core·review/status·record-core 등 카피 테스트 + mojibake 육안 1회

웨이브6 [의식 — SealMoment·SettlementModal 파일군. 순서 고정: CSS → 인장 → 장면 → 증서]
        P1-A3[L] 봉인 의식 (07 S1→S2→S3→S4 = 최소 완성선 한 몸, S5·S6 독립 소커밋으로 이어서)
        └→ P1-B2의 SealMoment 체크박스 조각 (같은 파일 :365-389 — 의식 커밋 직후)
        └→ P1-A1[M] 판단 액자 + 재봉인 온램프 (증서의 세리프 인용 register 재사용)
        └→ P1-E2[M] [MCP] seal_text (증서 문안 확정 직후 같은 취지로 이식 — 두 표면 동시)
        ✓ 경계 검증: tsc + preview 스크린샷(불가 시 클래스·reduced-motion 단위 테스트로 갈음, P1-A3 태그)

웨이브7 [보물 합산 — SettlementModal 재개봉 1회는 의존(A5←A2)이 우선이라 허용]
        P1-A2[M] RecordStrip 한 뇌 (+ 숫자 일치 교차 테스트)
        └→ P1-A5[S] 3고리 의식 (RecordStrip 카운트 필요)
        P1-E7[M] [MCP] wake_text 항적 렌더 (웹앱 축적 신호와 같은 웨이브 + spine-drift 단언 추가)
        ✓ 경계 검증: record-core 숫자 일치 + MCP spine-drift

웨이브8 [소품 잔여·거취·최종 검증]
        P2 잔여 일괄 (묶음 독립 — 시간 부족 시 뒤에서부터 자름) · MCP 소품 잔여
        WakeReturn/ReplayTimeline 거취 판정 (import 0 확인됨 — 삭제는 기계적, 시간 되면)
        최종: tsc 0 + npx vitest --exclude "**/.claude/**" 전체
        MCP 검증: cd argus-mcp && npm run typecheck && npm test + 도구 직접 호출 스모크
        (init→open→seal→check_in(today_override)→settle→recall 완주 — 12 §1의 7-호출 시나리오 재현)
        (Persistence 원칙: 실주행 후 "예상 테이블 행수 늘었나" 확인 — 특히 P0-2 정산 전파,
         P0-8은 sync가 준 local_id로 settle이 실제로 통하는지 왕복 확인
         + 교차 여정 2건: MCP 봉인→웹 정산→sync에 settled_in_account 표시되는지(P0-8④),
           웹 봉인→터미널 check_in due 0 힌트→argus_sync에 due로 뜨는지(P1-E4③))

이후    함대 해도(08 S4) · 교차-결정 항해일지(08 S6) · 이메일/전제 크론 장기안 · MCP progress notification(11 P2-9)
        · P1-C6 역매핑 복원 본체 (§3.5-1)
```

핵심 의존 사슬 5개: ① dueCount 훅 → 등불 → 완료 화면 (웨이브3 내부), ② knew-you → SyncStatus/분기들 (웨이브4 내부), ③ 의식 register → 판단 액자 → seal_text 이식 (웨이브6 내부), ④ **P1-E1 locale 사전 → E3 닻 거울·E2 seal_text·E7 wake_text** (ko/en 렌더 분기 공급 — 웨이브3에 뼈대만 먼저), ⑤ **P1-A2 RecordStrip → P1-A5 3고리** (카운트 소스 — 웨이브7 내부. A5를 웨이브6의 SettlementModal 작업에 합치지 않은 이유: 이 의존이 파일 묶음보다 우선). 나머지는 전부 독립이라 순서 조정 자유.

### 3.5 이번 실행에서 뺄 것 (defer — 리뷰4)

창업자 지시가 "큰 것도 일단 실행"이므로, defer 기준은 크기가 아니라 **자율 세션이 검증할 수 없거나 실패가 사용자 데이터를 다치게 하는 것**뿐이다. L 항목(P1-A3 봉인 의식·P0-6 귀환 한 집)은 빼지 않고 최소 완성선을 정의해 전부 실행한다.

1. **P1-C6 백업 역매핑 복원 본체 — defer.** 이번 실행은 최소 버전(서버 내보내기 형식 감지 + "이 파일은 서버 내보내기 형식이라 아직 이 화면에선 복원되지 않아요" 정직 안내 + 삭제 모달 카피 + 의심 문형 제거)까지. 역매핑 복원 로직 자체를 미루는 이유: 복원 버그는 잘못 매핑된 필드로 로컬 데이터를 **덮어쓰는** 유일한 항목이고(다른 항목은 전부 표시·카피·추가), 실사용 백업 파일의 형식 다양성을 자율 세션이 재현·검증할 수 없다. 최소 버전만으로도 04 S2의 신뢰 목표(왕복이 조용히 실패하는 거짓말 제거)는 달성된다.
2. **이메일 실발송 검증(P1-B2·B3·Companion Brief 경로) — 실행 밖.** 코드 구현+단위 테스트까지만 — 실발송 트리거는 헌장 안전경계("외부 발송 금지"). EXECUTION-LOG에 "아침에 창업자가 확인할 것" 항목으로 남긴다.
3. **P2 '다음 단계 후보'(함대 해도·교차-결정 항해일지) — 원 판정 유지(실행 밖).**
4. **P0-1 고아 행 청소 SQL의 실행 여부는 집계 후 판단.** SELECT 집계는 실행하고 행수를 기록한다. 대상이 명백한 고아(삭제된 계정의 잔존 행)이고 소량이면 삭제 실행, 집계가 크거나 귀속이 애매하면 SQL만 남기고 JUDGMENT-CALLS.md로 — 되돌릴 수 없는 삭제는 대리판단의 경계 사안.

---

## 4. 스파인 위험 목록 (긴장이 있는 제안 — 정직하게)

zero-judgment 스파인과 **긴장이 0인 척하지 않는다.** 아래는 채택하되 조건을 계약으로 붙인 것들이다.

| 제안 | 긴장 지점 | 채택 조건 (위반 시 그 부분만 철회) |
|---|---|---|
| P0-6 워크스페이스 등불 + P0-2 재알림 | 귀환 표면 확대 = 개입 확대로 흐를 수 있음. "정한 날의 이행"과 "조르기"의 경계 | due 0건이면 렌더 0 · "나중에 할게요" 1탭 dismiss · 재알림 3회 상한+mute 버튼(현행 무한 반복이 오히려 거울 조항 위반이었음) · "오랜만이에요" 류 부재-길이 인사 금지(부재 집계도 출석부다 — 10 S4). **P0-6③ "돌아오셨네요" 헤드라인은 이 금지에 안 걸린다(리뷰2)**: 부재 길이를 집계하지 않는 날짜-앵커 사실 진술("{날짜}에 물어보기로 한 게 있어요")이기 때문 — 단 감정 수사·길이 언급이 붙는 순간 금지 대상으로 전환 |
| P1-A3 봉인 의식 | 금색 의식이 verdict-by-styling으로 읽힐 위험 · 의식 강요 | 모든 봉인에 내용·방향 무관 동일 1회 · 어디든 탭 = 즉시 스킵 · reduced-motion 정지 프레임 · 거절 경로 무의식·무변경 · BindCard(dominant skip)에는 절대 안 얹음 · 레지스터 계약(--bp-* 금지) 무접촉을 테스트로 확인 |
| P1-A5 3고리 의식 | "축하"가 평결로 넘어갈 위험 | 문턱=제품이 이미 성문화한 표본 크기 상수(dim9) · "여전히 점수는 아니에요" 문장 내장 · 로컬 플래그로 평생 1회 · 사용자 평가 어휘("잘하고 있어요") 금지 · **"점수는 아니에요"는 기록의 성질 서술(dim9 자기 정직)까지만 — "우리는 판단하지 않아요" 류 제품 무결 선언으로 확장 금지(§5-10, 스파인은 주장이 아니라 점근선)** |
| 함대 해도 (P2 후보) | 난파/표류 배 전시가 실패 판정으로 읽힘 | **조건부 통과**: 기존 카드 vignette과 동일 시각 강도만 · 별도 강조 금지(숨기면 트로피 케이스, 울리면 판정) · 2척 미만 미렌더 · 접기 탈출구 |
| P0-3 Navigator 대체 문안 | "기록만 해둘게요" 등 관찰 진술도 인물평으로 반 발짝이면 넘어감 | 1안은 **인사이트 생성 자체 제거** · 2안(빈도-사실 교체)을 쓰려면 헌법 규칙2의 조건을 전부 충족해야 한다(리뷰2): (a) **표본 크기 명시**("최근 N건 중 M건" — "절반 이상" 류 비율 어림 금지) (b) 표본 미달(원 데이터 3건 미만)이면 생성 금지 (c) **지시형 조언 문장("~해보세요" 류 코칭) 금지** — 관찰+해석 반환("마지막 문장은 당신 것이에요")까지만 (d) 칭찬·질책 방향 모두 금지(개선/하락 대칭) |
| P1-D4 오디세우스 다리 | 은유 설명이 BindCard의 의도된 가벼움을 무겁게 만들 위험 | SPINE INVARIANTS(스킵 지배·프리필 금지·포크 금지, BindCard:16-21) 코드 무접촉 · 반 문장 한도 |
| P1-A1 판단 액자 | 두 인용의 diff를 제품이 해설하면 그 순간 판정이 됨 | 원문 인용+날짜 스탬프만 · 요약·평가·해설 문장 절대 금지 · AI 유래 예측은 "AI가 대신 적어둔 확인 질문" 라벨로 provenance 구분 |
| P1-A1 재봉인 온램프 | "새 결정 적기" 손잡이가 engagement 제조로 흐를 위험 | 조용한 텍스트 링크 1개뿐(버튼 위계 승격 금지) · 자동 이동·연쇄 모달·"다음 결정은 뭔가요?" 류 유도 질문 금지 · 남은 due 표기는 개수 사실만 — 정산 직후는 사용자가 이미 능동적으로 와 있는 순간이라 문을 보여주는 것이지 열어젖히는 게 아니다 |
| P0-8④ 두 표면 정산 대조 | 웹 정산을 로컬 원장에 자동 기록하면 사용자 확언 없는 대리 정산(append-only 원장에 기계 유래 outcome) | 표시(`settled_in_account:true`)+사실 문장까지만 · 로컬 기록은 사용자가 argus_settle로 직접 · outcome을 대신 채워 넣지 않는다 |
| P1-B5 전제 벨 (장기안) | 재확인 크론은 구조적 과발화 위험(드리프트 알림 남발) | 이번 계획에서 **보류**(§5) — 단기 카피 축소만. 장기 구현 시 사실 진술만+인앱 배지만+높은 발화 문턱 유지 |
| P1-E2 seal_text | "이 문장은 당신의 것입니다"가 거짓 소유 서사가 될 위험 (헌법 규칙1) | provenance **사실 진술**로만 — `predicate_owner:'ai_surfaced'`면 "Argus가 초안한 문장 — 아직 당신이 확언하지 않았습니다"로 정직 분기 · 강제 타이핑 게이트 금지(그대로 봉인 가능해야 함) · 이모지 0·과장 0, "닻 내림"이 유일한 세계관 장식 |
| P1-E3 닻 거울 | "그때 당신은 이렇게 적었습니다"가 tired-user에게 죄책감 압박이 될 위험 | 인용은 기계 평결이 아니라 사용자 자신의 문장(1차 정산: 생각↔생각 — 제품의 존재 이유) · "돌아오셨군요" 류 환영 인사·감정 표현·부재-길이 인사 금지, 인식은 날짜 산수(사실)로만 · due 0건이면 현행 침묵("Nothing to nudge.") 유지 |
| P1-E7 wake_text | 정산됨 그룹의 held/avoided 나열이 성적표로 읽힐 위험 | **개수 나열만**(`held 1 · avoided 1 · partial 1`) — 적중률 %·"1/3" 비율·등급·streak·"잘하고 있다" 금지, `spine-drift.test.ts`에 "wake_text에 %/tier/score 부재" 단언으로 고정 · 상태 단어는 사용자가 고른 outcome(user_stated)이라 표시해도 판결 아님 · track_record 한 줄에 새 의미 언어 추가 금지 |
| MCP 소품 REASON_LINE | restraint 사유 문장이 지시("두어라")로 넘어갈 위험 | 문장 끝을 옵션 명명으로 고정("Leaving it as is stays a real option" — 핸들을 사용자에게 반환) · overfire 게이트가 crux 생성 **전** 실행되는 현행 구조(open-decision.ts:59) 무접촉 |

공통 바닥: 어떤 신규 문장도 점수·등급·백분율·타인 비교·칭찬/질책을 도입하지 않는다. **지시형 코칭 문장("~해보세요"·"~하면 더 나은 결과를")도 신규 도입 금지** — 손잡이는 버튼/링크로 제공하고 문장으로 등 떠밀지 않는다(리뷰2 — P0-3이 제거하는 패턴을 다른 자리에서 되살리지 않기). 이 계획의 P0-3은 스파인 위반의 **제거**이고, 나머지는 전부 사실 서술·탈출구 추가·개입 상한 방향이다. (헌법 규칙3 "검증은 채팅이 아님"은 전 항목 점검 결과 위반 제안 0건 — 리뷰2에서 확인만 기록.)

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
11. **검수 due를 워크스페이스 등불에서 별도 정산 UI로 처리 — 기각.** 새 정산 UI를 만들지 않는다. 귀환의 **모이는 항구는 /project 하나**이고, 정산의 종착지는 기존 표면 둘뿐 — 프로젝트 결정은 /project의 기존 자동 모달, 검수 영수증은 기존 /tools/review(ReceiptList) (03 S3 원칙 = 05 S2 원칙 — P0-6①의 검수 칩→/tools/review 라우팅과 모순 아님, 리뷰5 문면 정리).
12. **테이블·타입 통합으로 장부 4개를 물리적으로 합치기 — 기각 (08 S2).** 표시 계층 합산이면 충분. 병렬 세션 조율 규칙(공유 등록부 append만·기존 테이블 ALTER 금지) 준수.
13. **[MCP] 기본 시간대를 Asia/Seoul로 변경 — 기각 (12 §3.3 스스로 비권고).** 청사진 M4의 결정성 논거(UTC 기본) 유지. 문서화 + `argus_init`의 today/tz 가시화(P1-E6)까지만.
14. **[MCP] vibe/crux 휴리스틱을 하드 게이트로 승격 — 금지 (12 §3.4).** `weak:true`와 "휴리스틱 — 놓칠 수 있음" 문구 유지. 봉인을 막는 마찰 게이트는 헌법 위반(정직 표기 > 강제 게이트) — 청사진 m3의 정직성 보존.
15. **[MCP] track_record에 새 의미 언어 추가 — 기각 (12 §3.5).** 현행 한 줄 + 이미 구현된 전제 귀속 문장(broken_premise_ref가 들어올 때)이 최대 심화. wake_text는 개수·사실·시간축만.
16. **[MCP] "돌아오셨군요" 류 환영 인사 — 금지 (12 §3.2).** 단, 범위를 정확히(리뷰2): **헌법 차원 금지는 부재-길이 집계 인사**("오랜만이에요"·"N일 만이에요" — 부재 집계도 출석부다, 10 S4)이고, 환영 인사 자체의 금지는 **MCP 터미널의 register 절제 판정**(12 §3.2의 표면별 선택)이다. 그래서 웹앱 P0-6③의 날짜-앵커 "돌아오셨네요"(길이 미집계)와 충돌하지 않는다 — 이 조항을 근거로 P0-6③을 "고치지" 말 것. MCP의 인식은 "봉인 후 N일" 날짜 산수로만.
17. **[MCP] progress notification 도입(5초 인라인 sync 대기) — 보류 (11 P2-9).** 허용 범위의 대기이고, 진짜 문제였던 "5초 기다리고도 실패를 안 알림"은 P1-E4가 봉합. notification은 실수요 신호 후에.
18. **[MCP] check_in의 계정 자동 조회 · 웹 정산의 로컬 원장 자동 반영 — 기각 (리뷰1).** check_in은 로컬 결정성(오프라인·즉답)을 지킨다 — 계정 대조는 argus_sync 한 곳의 일(P0-8④)이고, check_in에는 토큰 존재 시 정적 힌트 한 줄(P1-E4③)까지만. 웹에서 정산된 outcome을 로컬 원장에 자동 append하는 것은 사용자 확언 없는 대리 정산이라 금지 — 표시+안내 문장까지만.
19. **정산 완료 화면의 자동 연쇄(다음 due 모달 자동 오픈, 워크스페이스 자동 이동) — 기각 (리뷰1).** 재봉인 온램프는 조용한 링크 1개(P1-A1)로 충분 — 고리를 닫은 직후는 제품이 제일 조르고 싶은 순간이라 절제가 제일 필요한 순간이다.
20. **익명 봉인자용 새 알림 채널(브라우저 푸시 등) — 기각 (리뷰1).** 익명 사용자의 귀환로는 .ics + 봉인 직후 로그인 CTA(이미 구현됨)가 전부이고 그걸로 충분 — §5-5의 원칙(귀환의 유일한 정당한 트리거는 사용자가 정한 날짜) 그대로.

---

## 부록 — 회귀 가드 공통 사항

- 카피 변경이 걸리는 테스트: `checkin-reminder` · `telegram-settlement`(키보드 5버튼) · `seal-core` · `navigator-content` · `navigator-simulation` · `review/status` · `record-core`. 실행은 항상 `npx vitest --exclude "**/.claude/**"` (중첩 워크트리 유령 실패 — 단 vitest.config.ts:21이 이미 `**/.claude/worktrees/**`를 제외하므로 config 경유 실행도 안전함을 확인, 리뷰3. 플래그는 이중 안전벨트로 유지).
- **argus-mcp 검증은 별도 2단**: `cd argus-mcp && npm run typecheck && npm test` (자체 vitest — 웹앱 러너와 분리돼 있어 중첩 워크트리 이슈 없음). 새 렌더(seal_text·wake_text)의 금지 어휘(%·tier·score·streak)는 `spine-drift.test.ts`에 단언 추가. 웹앱↔MCP review 코어 8파일은 `src/lib/__tests__/review-mcp-drift.test.ts`가 이미 지킴 — 코어를 고치면 **양쪽 동시 커밋**(verbatim 이식) 원칙.
- MCP 항목은 전부 `argus-mcp/` 내부 — 병렬 세션 공유 등록부 4개(db.ts·storage.ts·schema-drift·persistence-contract) 무접촉. P0-8이 참조하는 `src/app/api/mcp/*`는 읽기만 한다(수정은 argus-mcp 쪽).
- 두 표면 문안 일치 계약: 봉인 의식(웹앱 07 S4 증서 ↔ MCP seal_text)·귀환 문안("그래서, 어떻게 됐어요?" — seal-core ↔ check_in 닻 거울)은 웹앱 커밋에서 문안을 먼저 확정하고 MCP가 같은 취지로 이식한다 — 같은 컨셉, 같은 문안 계열, 같은 시각 언어(인용 블록·날짜 2행·"평가 아님" 문장).
- 새 localStorage 키(`argus:knew-you`, `argus:third-loop-seen`, `argus:lantern-snooze`)는 STORAGE_KEYS 등록 + persistence-contract CONTRACT에 localOnly 선언. **두 파일 모두 병렬 세션 공유 등록부(storage.ts·persistence-contract.test.ts) — 끝에 append만, 기존 항목 재정렬·수정 금지**(리뷰3). db.ts를 만지는 유일한 항목은 P1-C1·P1-C7 — 둘 다 적용 전 main 최신화 + 최소 diff.
- **"마이그 0" 주장 검증 통과(리뷰3)**: reminder/email 계열 필드는 이미 `projects.decision_contract` jsonb 내부에서 운용 중(checkin-due/route.ts:105-155의 `email_reminder`·`reminder_sent_at`·`telegram_reminder_sent_at` 실확인 — `reminder_count`·옵트인도 같은 자리), JudgmentReceipt는 types.ts:610-618에 실재(human_judgment·what_happened 포함). 동기화 인터페이스 **최상위** 필드를 추가하는 항목 0건 → PGRST204(행 전체 거부) 위험 없음. 단 jsonb 내부 필드 추가도 구버전 데이터엔 부재하므로 읽기는 전부 `c.reminder_count ?? 0` 식 폴백(Defensive Data Access).
- SealMoment.tsx 등 한국어 문자열 파일은 mojibake-guard 감시 대상 — UTF-8 보존 (MCP surfaces.ts의 한국어 사전도 동일 주의).
- **사용자 원문 인용 전시(리뷰2, XSS 헌법)**: 판단 액자(human_judgment·what_happened)·RecordStrip·seal_text/wake_text의 술어 인용 등 신규 인용 렌더는 전부 **JSX 텍스트 노드/plain text로만** — `dangerouslySetInnerHTML`·markdown 렌더러 도입 금지. 인용을 받는 입력(예: SealMoment humanJudgment)의 기존 `maxLength` 계약 유지.
- 새 CSS 클래스는 앱 네임스페이스(`seal-*`)만 — design-register-contract(--bp-* 랜딩 밖 금지) 무접촉.
- 마이그레이션 필요 항목: **0건** (reminder_count·email_reminder·judgment_receipt 전부 기존 jsonb 내부, MCP 항목은 전부 로컬 파일/텍스트 렌더). Supabase 기존 테이블 ALTER 없음.
