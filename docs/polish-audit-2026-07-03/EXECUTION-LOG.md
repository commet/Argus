# EXECUTION-LOG — 2026-07-03 폴리시 감사 실행 기록

> 이 파일은 append-only. 각 항목: 무엇을 / 왜 / 어떻게 / 파일 / 검증 / 커밋.

## 웨이브 1 — 신뢰의 응급실

### [P0-1] 계정 삭제·내보내기 테이블 2개 누락 수리

- **무엇을**: `decision_items`·`review_receipts` 두 테이블을 계정 삭제/내보내기 대상 목록에 추가.
- **왜**: 계정을 완전 삭제해도 최근 추가된 두 테이블의 행이 서버에 영원히 남았다(개인정보처리방침 위반). delete/export 라우트 둘 다 `USER_DATA_TABLES` 배열을 순회하므로 목록 한 곳이 진실의 원천.
- **어떻게**:
  1. **병렬 세션 선행 확인**: `git fetch origin main` — main 최신(83a8878)은 이 브랜치의 부모와 동일, 병렬 세션(decision-items)은 아직 main에 두 테이블을 등록하지 않음 → 스킵 조건 미해당, 진행.
  2. **실DB 대조**: overture-db에 `SELECT table_name FROM information_schema.columns WHERE column_name='user_id' ...` 실행 → user-scoped 테이블 34개, 기존 목록 32개 — 누락이 정확히 `decision_items`·`review_receipts` 2개임을 확인.
  3. `src/lib/user-data-tables.ts` `USER_DATA_TABLES`에 알파벳 위치로 2개 추가.
  4. `src/lib/__tests__/erasure-coverage.test.ts` `LIVE_USER_SCOPED_TABLES`에도 동일 2개 추가(이중 목록 둘 다) + 재수집 날짜 주석 2026-06-30 → 2026-07-03 갱신.
  5. CLAUDE.md Schema Sync 절에 규약 4번 추가: "user_id 컬럼이 있는 새 테이블 = user-data-tables.ts + erasure-coverage 테스트 동시 갱신".
- **고아 행 집계 (§3.5-4 프로토콜)**: SELECT만 실행 —
  `review_receipts` 총 0행 / 고아 0행, `decision_items` 총 8행 / 고아 0행 (auth.users 대조).
  **고아 0건 → 삭제 SQL 실행 불필요.** 8행 전부 생존 계정 소유. 청소 없음, DELETE 미실행.
- **파일**: `src/lib/user-data-tables.ts`, `src/lib/__tests__/erasure-coverage.test.ts`, `CLAUDE.md`
- **검증**: `npx vitest run --exclude "**/.claude/**" src/lib/__tests__/erasure-coverage.test.ts` → 3/3 통과 (coverage·stale·no-duplicates 전부).
- **커밋**: (아래 해시)

### [P0-4] 앱 대문 getSession 무타임아웃 — 4초 컷 공용 헬퍼

- **무엇을**: `getSessionWithTimeout(ms=4000)` 공용 헬퍼를 `src/lib/supabase.ts`에 신설하고, 무한 await 가능성이 있던 3곳(앱 부팅 auth.tsx · 계정 내보내기/삭제 bearer() · 공유/이메일 ShareComposer 2개소)을 이 헬퍼로 교체.
- **왜**: 과거 "73초 무한 스피너"(Supabase auth 자물쇠 교착)의 마지막 형제 — llm.ts:465와 supabase.ts getCurrentUserId에는 이미 4초 레이스가 있는데 앱 대문(getSession 첫 호출)에는 없었다. 타임아웃 시 비로그인으로 간주해 화면을 열고, 실제 로그인 상태면 onAuthStateChange가 몇 초 뒤 채워주므로 오판 비용 ≈ 0 (09 S1).
- **어떻게**: llm.ts getAuthHeaders의 Promise.race 패턴을 헬퍼로 추출(주석 취지 이식), 반환형 `Session | null`, 내부 catch로 auth 예외도 null 강등. auth.tsx는 .catch 체인 제거(헬퍼가 throw하지 않음), api-account는 토큰 없으면 기존 그대로 'login-required' throw, ShareComposer는 기존 "인증이 필요해요" 분기 재사용.
- **파일**: `src/lib/supabase.ts`, `src/lib/auth.tsx`, `src/lib/api-account.ts`, `src/components/ui/ShareComposer.tsx`
- **비고**: llm.ts:465의 원본 패턴은 무접촉(웨이브4가 llm.ts를 만짐 — 충돌 회피). 워크트리 node_modules가 미설치 상태여서 tsc가 mammoth/jszip/pdfjs-dist 3건 오류 → `npm install`로 환경 복구(코드 무관, 587 패키지 설치).
- **검증**: `npx tsc --noEmit` → 0 오류.
- **커밋**: (아래 해시)

### [P0-3] NavigatorStrip 점수·등급·평결 노출 제거 (스파인 규칙2 위반 라이브)

- **무엇을**: 워크스페이스 상시 스트립에서 사용자를 향한 평결 렌더 전부 제거 — '판단 품질' 점수(/100), 초보/숙련/마스터 등급(TierProgress 진행바), 점수 추이 차트(DQSparkline)+향상/하락 트렌드 라벨. 인사이트 생성부에서 평결 계열 4종 생성 자체 제거(1안): dqDeclining("하락했습니다")·dqImproving("개선되고 있습니다" — 칭찬도 같은 평결)·overrideLow("비판적으로 검토하면" 훈계)·assumptionEngage("~해보세요" 지시형 코칭)·synthesize.overrideHigh/Low(인물평·훈계).
- **왜**: 헌법 규칙2 "사용자에 대한 uncalibrated 점수/등급 노출 금지" 라이브 위반. 칭찬을 남기면 침묵이 곧 나쁜 성적표가 되므로 개선/하락 대칭 제거. 데이터(buildLearningCurve·DQ 내부 계산)는 내부 라우팅용으로 유지 — 렌더만 제거.
- **어떻게**:
  - `NavigatorStrip.tsx`: DQSparkline·TierProgress 컴포넌트, TREND_COLOR/TREND_KEY, Learning Curve 섹션, 단일 DQ 점수 섹션 삭제. Axis Fingerprint(탐색된 관점 — 내용 커버리지 관찰)와 빈도-사실 인사이트는 유지. 재도입 금지 주석 박제.
  - `navigator.ts`: override_rate_low 분기(:231-240), assumptionEngage 분기, getRefineCoaching의 DQ 트렌드 블록 전체, getSynthesizeCoaching의 override 분기 삭제 — 각 자리에 제거 사유 주석.
  - i18n Clean Removal (ko/en 대칭): assumptionEngage(+Detail)·dqImproving·dqDeclining·biggestGain·biggestDrop·synthesize.overrideHigh/Low·overrideLowMessage(+Detail)·trendImproving/Stable/Declining/NoData·dqTrend·dqScore·avgSuffix·tierBeginner/Skilled/Master 제거. demoAllDoubted는 평결 절("— 비판적 관점이 강합니다")만 잘라 사실 진술로("전제 {total}개를 모두 의심하셨습니다").
  - 테스트 단언 뒤집기: navigator-content(하락 경고 2건→부재 1건, assumptionEngage 존재→부재, 회복 positive→부재), navigator-simulation(:563-577 상승 코칭 2건→부재 1건), 두 파일 t() 픽스처의 dq 키 4종 제거. navigator-content:1172의 기존 부재 단언은 그대로 유효.
  - NavigatorStrip 소비처 grep: workspace/page.tsx 1곳뿐 확인(렌더 유지 — 스트립 자체는 남고 내용만 정화).
- **파일**: `src/components/workspace/NavigatorStrip.tsx`, `src/lib/navigator.ts`, `src/lib/i18n/ko.ts`, `src/lib/i18n/en.ts`, `src/lib/__tests__/navigator-content.test.ts`, `src/lib/__tests__/navigator-simulation.test.ts`
- **검증**: navigator-content + navigator-simulation + navigator 3파일 95/95 통과 · `npx tsc --noEmit` 0 · 제거 어휘 잔존 grep 0(주석 제외) · ko.ts 한국어 UTF-8 정상 확인.
- **커밋**: (아래 해시)

### [P0-8] [MCP] argus_sync → argus_settle 동선 100% 파손 봉합 (①②③ 한 커밋 → ④ 역대조)

- **무엇을**: sync가 "정산은 argus_settle로"라며 계정 행 id(`mcp_` 접두사)를 그대로 주는데, 로컬 원장은 접두사 없는 id만 알아서 그 id로 settle하면 항상 NO_PRIOR_SEAL — 게다가 복구 힌트("seal부터 하라")를 따르면 이중 봉인. 이 유일한 MCP P0를 4단계로 봉합.
- **어떻게**:
  - **① (커밋1)** sync 응답 receipt마다 `local_id`(`mcp_` 벗긴 값, 웹 봉인이면 null)·`settle_path`("argus_settle (use local_id)" | "webapp") 추가 + 도구 description에 라우팅 규칙 명시.
  - **② (커밋1)** surface 교체: "이 터미널에서 봉인한 것은 local_id로 argus_settle, 웹에서 봉인한 것은 웹 대시보드에서 정산하세요."
  - **③ (커밋1)** state-machine.ts NO_PRIOR_SEAL recovery에 mcp_ 접두사/웹 봉인 분기 한 줄 — 에러 자체가 이중 봉인을 더는 유도하지 않음.
  - **④ (커밋2)** 역방향 대조: sync에 optional `argus_dir` 입력 추가(없으면 ARGUS_DIR env, 둘 다 없으면 대조 조용히 생략 — 기존 무인자 호출 하위호환), replayLedger로 로컬 원장을 읽어 `mcp_` 행이 계정에서 settled인데 로컬은 sealed면 receipt에 `settled_in_account:true` + surface "웹에서 이미 정산된 것 K건 — 로컬 원장에도 남기려면 argus_settle로 같은 outcome을 기록하세요." **로컬 자동 정산은 구현하지 않음**(§4 채택 조건 — 사용자 확언 없는 대리 기록 금지, 표시+안내까지만). 이게 없으면 E3 닻 거울·E7 항적이 이미 정산한 결정을 계속 due로 인용.
  - **회귀 가드**: sync.test.ts에 local_id/settle_path 단언 1건 + ④ 긍정/부재 2건(실제 tmpArgusDir 봉인으로 로컬 원장 구성, no-dir 시 조용한 강등) 추가. schema-validation은 optional 필드라 기존 단언 그대로 통과.
- **파일**: `argus-mcp/src/tools/sync.ts`, `argus-mcp/src/lib/state-machine.ts`, `argus-mcp/src/tools/__tests__/sync.test.ts` (+ package-lock 버전 드리프트 정리 1.0.0→1.3.0). 전부 argus-mcp/ 내부 — 웹앱 무접촉(src/app/api/mcp/*는 읽기만).
- **검증**: MCP `npm run typecheck` 0 · 전체 스위트 17파일 164/164 통과 (sync 7/7, schema-validation, state-machine, integration-simulation 포함).
- **커밋**: 커밋1 9e825fe, 커밋2 (아래 해시)

### 웨이브 1 경계 검증 (완료)

- 웹앱: `npx tsc --noEmit` → 0 오류.
- 웹앱 테스트: erasure-coverage + navigator-content + navigator-simulation + navigator → 4파일 98/98 통과.
- MCP: `cd argus-mcp && npm run typecheck` → 0 · `npm test` → 17파일 164/164 통과 (sync·schema-validation 포함).
- 커밋: P0-1=5d5dead · P0-4=41019b0 · P0-3=f80de8c · P0-8=9e825fe+fadfc09. push 완료.

---

## 웨이브 2 — 알림 채널 한 뇌 (W2)

### [P0-2] 텔레그램 귀환 정산의 죽은 버튼 + 두 뇌 + 반쪽 정산 (한 커밋)

- **무엇을**: 지금까지 실발송된 유일한 귀환 알림(checkin-due 크론의 웹 계약 리마인더)의 답장 버튼이 죽어 있었다 — `stl1|`/`stl|` 콜백과 `ARGUS_SETTLE:` 토큰 답장을 받는 분기가 웹훅에 아예 없었음(파서 `parseSettlementIntent`는 한국어까지 완비된 채 미배선). 게다가 카피는 차가운 영어 기계문("Argus check-in"), 미러 행이 있으면 두 크론이 같은 결정을 이중 발송, 텔레그램 네이티브 정산은 웹 계약을 안 닫는 반쪽 정산.
- **왜**: "정한 날 물어봐 드려요"는 이 제품의 단 하나의 약속인데, 물어놓고 대답을 못 받는 상태(03 P0-1). 귀환 순간의 목소리가 자동응답기(02 P0-1). 같은 수술 부위라 한 커밋.
- **어떻게**:
  - **① 배선**: webhook 콜백 분기 맨 앞에 `parseSettlementIntent({callbackData})` → `handleContractSettlement()` 신설(소유 검증 → `applyTelegramSettlement` → projects.decision_contract 갱신 → telegram_decisions 미러 행 동기(정산이면 settled, 아직이면 check_by 연장+reminded_at=null) → 한국어 확인 답장 "기록했어요 — {잘 됨/안 됨/반반}. 고리를 닫았어요." / "알겠어요. {날짜}에 다시 물어볼게요."). 메시지 핸들러에도 슬래시 무시·리프레임 분기 **앞**에 `parseSettlementIntent({text, replyText})` 시도(토큰 답장·/settle 명령 수용) — 일반 메시지는 null 반환으로 무접촉.
  - **② 이중 발송 차단**: checkin-due의 telegramDue에 "telegram_decisions에 같은 id의 sealed 행이 존재하면 건너뜀" 가드 — 미러 있는 결정은 따뜻한 telegram-reminders 크론(1회 발송)이 담당, 이 다리는 미러 없는 레거시 계약의 안전망으로만.
  - **③ 양방향 정산**: `handleSettle`(네이티브 st: 콜백)이 `source==='web'` 행이면 `bridgeWebContract()`로 projects.decision_contract도 함께 닫기/연장(연장은 텔레그램 행과 같은 2주 — applyTelegramSettlement의 1주 기본 대신 amendCheckIn '2w'). 실패해도 텔레그램 쪽 답은 이미 착지(best-effort + console.error).
  - **④ 한국어 한 뇌**: `settlementReminderText`/`settlementReplyMarkup`에 locale 인자, ko 문안은 seal-core 결("그래서, 어떻게 됐어요?" / 「{프로젝트}」 — 봉인할 때 이날 물어봐 달라고 하셨어요 / 확인할 것: {predicate} / 아직 모르겠으면 "아직"도 답이에요), 버튼은 seal-core settleKeyboard 어휘(✅ 잘 됐어요/✋ 안 됐어요/〰 반반/⏳ 아직). 원시 토큰은 답장 매칭용으로 마지막 줄 `<code>`로 강등. locale 판정은 `detectSettlementLocale()`(프로젝트명+predicate 한글 검사)로 공용화 — checkin-due가 사용.
- **파일**: `src/lib/telegram-settlement.ts`, `src/app/api/telegram/webhook/route.ts`, `src/app/api/cron/checkin-due/route.ts`, `src/lib/__tests__/telegram-settlement.test.ts`
- **검증**: tsc 0 · telegram-settlement+checkin-reminder 17/17 통과(한국어 문안·토큰 잔존·구 기계문 부재 단언 추가). 실발송 없음(코드+테스트만).
- **커밋**: f40a43d

### [P1-B1] 재알림 3회 상한 + "그만 물어봐 주세요" 버튼

- **무엇을**: checkin-due의 7일 무한 재발송에 상한 3회(`reminder_count`, decision_contract jsonb 내부 — 마이그 0)를 달고, 봇 키보드에 5번째 버튼 "🌙 그만 물어봐 주세요"(mute)를 추가.
- **왜**: 무한 반복 알림이야말로 거울 조항(개입 여부를 대신 판단) 위반 — 이 항목은 개입 축소 방향(10 S3). 웹 due 표면은 유지하고 리마인더만 정지.
- **어떻게**: `REMINDER_MAX_SENDS=3`을 checkin-reminder.ts에 성문화. 크론은 count>=3이면 해당 계약 건너뜀, 발송된 웨이브마다(채널 무관 1회) +1, 3번째 웨이브 문안 끝에 정직한 마지막 고지("이제 조용히 열어둘게요…" — 10 S3 문안). mute는 `applyTelegramSettlement`에서 reminder_count를 상한으로 세팅(check_in_at·predicate 무접촉 = 아무것도 정산 안 됨), 웹훅은 미러 행도 안 건드리고 "알겠어요, 더 묻지 않을게요…" 응답. 콜백 코드 'u'(stl1)·'mute'(stl 레거시).
- **파일**: `src/stores/types.ts`(reminder_count 필드 — jsonb 내부라 PGRST204 무관), `src/lib/checkin-reminder.ts`, `src/lib/telegram-settlement.ts`, `src/app/api/telegram/webhook/route.ts`, `src/app/api/cron/checkin-due/route.ts`, 테스트.
- **검증**: 키보드 5버튼 단언(부록 회귀 가드)·mute 무정산 단언·마지막 웨이브 문안 단언 추가, 20/20 통과 · tsc 0.
- **커밋**: 0afd4dc

### [P1-B2 크론 조각] 이메일 귀환로 — 본문 한국어화 + ?from=checkin + 로그아웃 분기

- **무엇을**: 한국어 제목("그래서, 어떻게 됐어요? — {프로젝트}")에 영어 본문이 오던 귀환 이메일을 locale 분기로 한 목소리화(02 P0-2 제안 문안 그대로: "맞았는지 틀렸는지는 제가 정하지 않아요 — 어땠는지만, 1분이면 기록할 수 있어요" / "그때 적어둔 방향" / [돌아와서 정산하기] / "직접 켜둔 1회성 알림이에요"). 링크에 `?from=checkin`을 달고, /project 빈 화면이 이 파라미터를 보면 신규자 카피 대신 "봉인해 둔 결정이 이 기기엔 없어요. 봉인할 때 쓴 계정으로 로그인하면 바로 보여요." + [로그인 → /login?redirect=/project].
- **주의**: SealMoment 옵트인 체크박스 조각은 웨이브6 소관(P1-A3과 같은 파일 구간)이라 여기서 안 건드림. locale 판정은 P0-2의 `detectSettlementLocale` 재사용(02 S1 "같은 locale 판정 재사용"). en 본문·기존 XSS 이스케이프 테스트 보존(locale 기본값 'en').
- **파일**: `src/lib/checkin-reminder.ts`, `src/app/api/cron/checkin-due/route.ts`, `src/app/[locale]/project/page.tsx`, `src/lib/__tests__/checkin-reminder.test.ts`.
- **검증**: ko 본문·마지막 웨이브 고지 단언 추가 21/21 통과 · tsc 0 · 한국어 UTF-8 확인.
- **커밋**: e6ee219
- **⚠️ 아침에 창업자가 확인할 것(§3.5-2)**: 이메일 실발송 검증은 헌장 안전경계로 이번 실행 밖 — 옵트인 UI(웨이브6 체크박스)까지 붙은 뒤 실계약 1건으로 수신·링크 동작(로그아웃 기기에서 ?from=checkin 분기)을 눈으로 확인할 것.

### [P1-B3] 검수 이메일(Companion Brief) 사전 고지 + 수신 중단 안내

- **무엇을**: SealModal 설명문 아래 한 줄("확인일이 오면 이 예측을 이메일로 돌려드려요 — 정산을 위한 한 통이고, 그 외 메일은 없어요") + Companion Brief 본문 하단 수신 중단 안내("더 받고 싶지 않으면 이 메일에 답장으로 알려주세요 — 바로 멈출게요").
- **왜**: "no emails unless you ask"의 최소 이행(04 S5) — 보내기 전에 말하고, 메일 자체에 출구를 싣는다.
- **파일**: `src/components/review/SealModal.tsx`, `src/lib/companion-brief.ts`, `src/lib/__tests__/companion-brief.test.ts`(옵트아웃 단언 1건 추가).
- **검증**: companion-brief 7/7 통과 · tsc 0. **커밋**: e475366

### [P1-B5] 전제 벨 정직화 (단기만)

- **무엇을**: DecisionItemsCard 벨 툴팁 "바뀌면 알림 켜짐" → "주시 표시 켜짐 — 자동 알림은 아직 준비 중이에요" / off "주시 꺼짐" (en 대칭). premise-drift.ts 헤더에 정직성 노트 박제(재확인 크론 부재 사실 + 크론을 지으면 같은 커밋에서 약속 복원하라는 지시 + §5-2 보류 근거).
- **왜**: 크론이 없는데 "알림"을 약속하는 벨은 약속-실제 어긋남(04 P1-2). 장기 크론은 §5-2에서 보류(과발화 위험).
- **파일**: `src/components/projects/DecisionItemsCard.tsx`, `src/lib/premise-drift.ts`. **검증**: tsc 0. **커밋**: 09f948c

### [P1-E4] [MCP] 동기화 실패 발화 + upcoming 이행 + 계정 힌트

- **무엇을**: ① seal/settle의 syncLine 3-상태화 — 성공은 말하고, no_token은 침묵(선택된 기본값이지 실패가 아님), 토큰 있는 실패는 반드시 발화("Account sync didn't go through — {reason}. … the email reminder won't fire until it syncs. Try argus_sync later.") + `data.account_sync_reason`. settle도 동일 패턴(계정이 계속 due로 조를 수 있음을 고지). ② `include_upcoming_days`를 진짜 구현 — sealed 계약 중 today<check_by<=today+N을 `data.upcoming[]`으로, surface에 "K coming due within N day(s) — informational, nothing to settle yet." ③ due 0건 + ARGUS_TOKEN 설정 시 surface 끝에 정적 한 줄("This reads the local ledger only — judgments sealed in your account: argus_sync shows them.") — 네트워크 호출 0(테스트로 fetch 미호출 단언), check_in의 로컬 결정성 유지(§5-18).
- **파일**: `argus-mcp/src/tools/seal.ts`, `settle.ts`, `check-in.ts` + loop/integration-simulation 테스트. 전부 argus-mcp/ 내부 — 웹앱 무접촉.
- **검증**: MCP typecheck 0 · 17파일 167/167 통과(신규: upcoming 왕복, 토큰 힌트+무네트워크, http_500 실패 발화 seal/settle).
- **커밋**: 9f3829f

### 웨이브 2 경계 검증 (완료)

- 웹앱: `npx tsc --noEmit` 0 · telegram-settlement + checkin-reminder + companion-brief 3파일 28/28 통과.
- MCP: `cd argus-mcp && npm run typecheck` 0 · `npm test` 17파일 167/167 통과.
- 실발송 0건 확인: checkin-due는 CRON_SECRET 게이트 뒤(호출 안 함), Resend/Telegram API는 코드·테스트에서 실호출 없음(테스트는 fetch mock).
- 한국어 문자열 mojibake 육안 확인(그만 물어봐 주세요·주시 표시·봉인해 둔 결정이 — 전부 정상).
- 커밋: P0-2=f40a43d · P1-B1=0afd4dc · P1-B2크론조각=e6ee219 · P1-B3=e475366 · P1-B5=09f948c · P1-E4=9f3829f.
