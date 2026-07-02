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

---

## 웨이브 3 — 귀환 한 집 (W3)

### [P0-6①+④] Header 목적지 고정 + /project 검수 합류 + dueCount 공용 훅

- **무엇을**: "돌아올 것"의 정의를 공용 훅 `useDueCount`(src/hooks/useDueCount.ts) 하나로 모았다 — 프로젝트 계약 due(contractStatus.checkInDue) + 검수 영수증 due(summarizeReceipt.urgent) 합산. Header 배지·/project 스트립·워크스페이스 등불 셋이 전부 이 훅을 읽는다(Single Source — 두 화면 드리프트 방지). Header의 `dueTarget` 분기(검수만 due면 /tools/review로 보내던 것)를 삭제하고 항상 `/project`로 고정. /project due 스트립에 검수 due 영수증을 같은 앰버 톤 칩(FileText 아이콘)으로 합류시키고 클릭 시 `/tools/review`로(ReceiptList가 urgent 최상단 정렬이라 목적지에서 길 안 잃음). 스트립의 N도 합산 숫자로.
- **왜**: 귀환의 모이는 항구는 /project 하나(§5-11 — 새 정산 UI 금지, 정산 종착지는 기존 두 표면). 돌아온 사용자가 착륙하는 곳마다 다른 숫자·다른 목적지를 보면 47/0 깔때기의 정확히 그 지점이 갈라진다.
- **구현 메모**: 훅은 의도적으로 무메모 계산(Header의 기존 주석 계승 — memo가 Date.now()를 얼려 자정 넘긴 탭이 어제 카운트를 유지하던 문제). /project의 정렬 useMemo는 due id 문자열 키(dueKey)로 안정화.
- **파일**: `src/hooks/useDueCount.ts`(신설), `src/components/layout/Header.tsx`, `src/app/[locale]/project/page.tsx`
- **검증**: tsc 0. **커밋**: 314a5bc

### [P0-6②] 워크스페이스 착륙 등불 — 당일 스누즈, 영구 dismiss 금지

- **무엇을**: /workspace 착륙(HeroFlow idle) 입력 카드 바로 위에 due 스트립 한 줄 — "⚓ 그래서, 어떻게 됐어요? — 돌아올 결정 N건" + [지금 답하기 → /project] + [나중에 할게요]. /project due 스트립과 동일 앰버 계열(두 화면이 같은 사건을 같은 얼굴로).
- **스누즈 계약(리뷰5 반영)**: [나중에 할게요]는 `argus:lantern-snooze`에 **로컬 날짜**(localYMD — contractStatus와 같은 로컬 자정 기준)를 기록하는 **당일 스누즈** — 다음날 재렌더. 영구 dismiss로 구현 금지(등불이 영영 꺼지면 귀환 고리 자멸). 03 원 스펙의 sessionStorage 안이 아니라 마스터의 localStorage 날짜 안을 따름.
- **절제 계약(§4)**: due 0건이면 렌더 0(부재 통보 금지) · 부재-길이 인사("오랜만이에요") 없음 — 게이트를 순수 함수 `shouldShowLantern`(src/lib/lantern.ts)으로 빼서 **테스트로 고정**(due 0 → 항상 false, 스누즈는 당일만, 옛 스누즈 무효).
- **Persistence 선언**: `STORAGE_KEYS.LANTERN_SNOOZE` 등록(끝 append) + persistence-contract CONTRACT에 localOnly 선언(끝 append — 병렬 세션 규칙 준수).
- **파일**: `src/lib/storage.ts`, `src/lib/lantern.ts`(신설), `src/lib/__tests__/lantern.test.ts`(신설), `src/lib/__tests__/persistence-contract.test.ts`, `src/app/[locale]/workspace/page.tsx`
- **검증**: tsc 0 · lantern 4/4 + persistence-contract 4/4 통과.
- **커밋**: f314095

### [P0-6③] 완료 화면 귀환 재구성 — 날짜 앵커

- **무엇을**: ProgressiveFlow complete 씬에서 계약이 due면 ① 헤드라인을 "돌아오셨네요 — {날짜}에 물어보기로 한 게 있어요"로 교체(check_in_at을 locale 날짜로 포맷 — **날짜 앵커**; 날짜가 없는 구계약은 날짜절 없는 사실문으로 폴백) ② SealMoment(→DecisionContractCard due 상태) 블록을 FinalCard **위**로 이동(정산 질문이 접힌 문서 아래 숨지 않게), due 아니면 기존 순서 유지.
- **스파인(리뷰2 판정 준수)**: "돌아오셨네요"는 부재 길이를 집계하지 않는 날짜-앵커 사실 진술이라 §5-16 금지(부재-길이 인사)에 안 걸림 — 감정 수사·"N일 만이에요" 류는 넣지 않았다.
- **파일**: `src/components/workspace/progressive/ProgressiveFlow.tsx`
- **검증**: tsc 0. **커밋**: 61a68f0

### [P0-7] 워크스페이스 옆길 칩 4개 제거 + /boss Header 이사

- **무엇을**: idle 입력창 아래 /agents·/boss·/teams·/guide 칩 블록 전체 삭제. /boss만 Header utilityItems(더보기 메뉴)에 한 줄 추가(UserCheck 아이콘, "보고 상대 설정"). teams·guide는 이미 더보기에 있어 순수 중복이었고, /agents는 항해 중 크루가 이미 보임(VoyageMapRail/CrewAtWork)이라 별도 문 불요(05 S1 권고대로 더보기에도 안 넣음). 라우트는 전부 유지(§5-4 — 북마크·옛 세션 보존).
- **Clean Removal**: Bot·Users·BookOpen import 제거(grep 전수 — UserCheck는 레거시 스텝 아이콘으로 잔존 사용이라 유지).
- **파일**: `src/app/[locale]/workspace/page.tsx`, `src/components/layout/Header.tsx`
- **검증**: tsc 0. **커밋**: 9f9e1fd

### [P1-A4] 대문 축적 신호 — VoyageEta 칩 + 축적 한 줄 + due 최상단

- **무엇을**: "이어서 작업" 각 행에 `<VoyageEta contract={p.decision_contract} showArrived />`(컴포넌트 주석이 애초에 약속한 사용처 — 도착 예정 D-N / 지금 정산 / 도착 완료), due 프로젝트를 목록 최상단 정렬(/project와 같은 due-first 규칙 — 4번째 이후로 접힌 due가 떠오름), 섹션 헤더 N개 카운터 옆에 축적 한 줄: 정산≥1이면 "⚓ 닫은 고리 N개", forming(봉인≥1·정산 0)이면 "⚓ 봉인 N개 — 첫 확인일이 오면 기록이 시작돼요". 전부 summarizeRecord(기존 단일 소스) 기반 사실 서술, 점수·판정 0.
- **범위 가드(리뷰5)**: 전부 기존 행·기존 헤더 내부 — 새 섹션·새 칩 블록 0(P0-7의 뺄셈과 상쇄 안 됨). 08 S3의 2번 항목(FolderOpen→금색 깃발 교체)은 마스터 §2 스펙 문면에 없어 구현하지 않음(JUDGMENT-CALLS 기록).
- **파일**: `src/app/[locale]/workspace/page.tsx` (HeroFlow props에 decision_contract 추가)
- **검증**: tsc 0. **커밋**: 315cc6a

### [P1-E1] [MCP] locale 한 뇌 — surfaces.ts {ko,en} 사전 뼈대 (최소 범위)

- **무엇을**: `argus-mcp/src/lib/surfaces.ts` 신설 — `SurfaceStrings` 인터페이스(ko/en 키 드리프트를 타입으로 차단) + `SURFACES: Record<'ko'|'en', SurfaceStrings>` + `surfaceLocale(dir)`(config.yaml의 locale만 읽는 결정론적 해석 — env 스니핑은 init의 detectLocale이 config에 쓸 때만) + `surfacesFor(dir)`. 죽은 스위치 소생: argus_config의 locale이 이제 실제로 check_in·sync의 출력을 바꾼다.
- **최소 범위(리뷰4 준수)**: 편입한 것 = E3 check_in 문자열 전부 + 이미 갈라진 목소리였던 sync surface(한국어 하드코딩 → ko 원문 보존 + en 신규 저술). 13개 도구 전면 이주 아님 — 파일 헤더에 점진 편입 정책 주석 박제(도구를 고칠 때 편입, E2/E7이 자기 문자열 추가). **review 코어 8파일 무접촉**(drift 가드 대상 — tools/review.ts surface도 이번엔 보류, JUDGMENT-CALLS 기록).
- **테스트 계약(리뷰3 준수)**: en 기존 문구 byte 보존(loop.test 'Nothing is due. Nothing to nudge.' 등 기존 단언 무수정 통과). sync는 dir/config 없는 호출이 base 'en'이 되므로 해당 단언 2건을 en으로 갱신 + ko config로 한국어가 나오는 신규 테스트 1건(스위치 소생 증명).
- **파일**: `argus-mcp/src/lib/surfaces.ts`(신설), `argus-mcp/src/tools/sync.ts`, `argus-mcp/src/tools/__tests__/sync.test.ts`
- **검증**: MCP tsc 0 · sync 8/8.
- **커밋**: 6d34dbd

### [P1-E3] [MCP] check_in 닻 거울 — "그래서, 어떻게 됐어요?" 계열

- **무엇을**: due 항목마다 `sealed_at`(receipt.created_at 날짜)·`days_since_seal`·`your_words_then`(receipt.human_judgment — skipped·부재면 필드 자체 생략, 빈 인용 지어내지 않음)을 추가. surface는 가장 오래된 due 1건의 거울로 리드: en "N day(s) since you sealed — your words then: '…' All that's left is to record what reality did (argus_settle)." / ko "봉인 후 N일 — 그때 당신은 이렇게 적었습니다: '…' 현실이 어떻게 답했는지만 기록하면 됩니다 (argus_settle)." 나머지 due는 data로만(surface 비대화 방지). 인용은 200자 클립(전체는 data에).
- **스파인(§4 E3 행 준수)**: 인식은 날짜 산수만 — 환영 인사·감정 표현 0(테스트로 welcome-greeting 부재 단언). due 0건 침묵("Nothing to nudge.") 현행 유지. 인용은 기계 평결이 아니라 사용자 자신의 문장(1차 정산: 생각↔생각).
- **웹앱 문안 계열 일치**: 같은 웨이브의 웹 등불("그래서, 어떻게 됐어요?")과 같은 컨셉 — 부록의 두 표면 문안 계약대로 웹앱 커밋(등불) 먼저, MCP가 같은 취지로 이식.
- **파일**: `argus-mcp/src/tools/check-in.ts`, `argus-mcp/src/tools/__tests__/loop.test.ts`(신규 3건: 거울 왕복·skipped 폴백·ko locale)
- **검증**: MCP tsc 0 · 전체 17파일 171/171 통과. 함정 하나 잡음: receipt.created_at은 실제 벽시계라 테스트의 sealed_at 하드코딩이 비결정적 → 파생 산술 단언으로 교정.
- **커밋**: dd0ee2a

### 웨이브 3 경계 검증 (완료)

- 웹앱: `npx tsc --noEmit` 0 · lantern + persistence-contract + schema-drift 3파일 30/30 통과.
- **등불 due 0 렌더 0**: 게이트가 순수 함수(shouldShowLantern)로 분리돼 있고 lantern.test.ts가 due 0 → false(스누즈 상태 무관 4케이스)를 단언 — 렌더 조건은 `{lanternOn && …}` 단일 게이트라 due 0이면 DOM에 아무것도 없음.
- MCP: `cd argus-mcp && npm run typecheck` 0 · `npm test` 17파일 171/171 통과.
- 한국어 mojibake 육안 확인(등불·축적 한 줄·돌아오셨네요·surfaces.ts ko 사전 — 전부 정상).
- 커밋: P0-6①=314a5bc · P0-6②=f314095 · P0-6③=61a68f0 · P0-7=9f9e1fd · P1-A4=315cc6a · P1-E1=6d34dbd · P1-E3=dd0ee2a.

---

## 웨이브 4 — 상태 정직화 (P0-5 → C1 · C2·C3 · C4 · C7 · C6최소 · C5)

### [P0-5 + P1-C1] 세션 만료 삼중 침묵 + SyncStatus 양방향 정직화 (한 커밋 — 마스터 지시)

- **무엇을**: ① `argus:knew-you` 로컬 플래그(부울 1개, 개인정보 0) — STORAGE_KEYS 끝에 append + persistence-contract CONTRACT에 localOnly 선언(공유 등록부 append-only 규칙 준수). `clearAllStorage()`가 STORAGE_KEYS 전체를 지우므로 **명시적 로그아웃은 플래그가 먼저 지워져 만료로 오인되지 않음**(별도 코드 없이 구조로 성립). ② auth.tsx onAuthStateChange: 세션 있으면 플래그 '1', 세션이 null로 떨어졌는데 플래그가 남아 있으면 `argus:session-expired` CustomEvent 1회 발신. ③ 신규 `SessionExpiredToast`(StorageErrorToast 패턴): "로그인이 잠시 풀렸어요. 작업은 이 기기에 계속 저장되고 있어요 — 다시 로그인하면 클라우드 백업이 이어져요." + [다시 로그인](`/login?redirect=현재경로`). 탭 세션당 1회(sessionStorage dedupe — 지속 상태는 앰버 배지가 담당), /login 위에서는 미표시. ④ "무료 체험" 오인 수리: workspace/page.tsx·ProgressiveFlow.tsx의 LOGIN_REQUIRED 카드가 `user || hasKnownUser()`면 "로그인이 잠시 풀렸어요 / 적어주신 내용은 그대로 있어요" + [다시 로그인하고 이어가기]로 분기 — 진짜 익명에게만 기존 "무료 체험" 유지. ⑤ AuthGuard 귀환자 분기("다시 오셨네요 — 로그인만 다시 해주세요"). ⑥ errorDisplay.authFailed ko/en 재작성(막힘은 배의 사정 + 작업물 보존 사실 + 손잡이).
- **P1-C1**: `reportSyncSuccess()`를 **sync-health.ts에 신설**(마스터 리뷰3 지시 — db.ts diff 최소화), db.ts는 syncToSupabase·upsertToSupabase 성공 분기에 `else { reportSyncSuccess(); }` 1줄씩 + import 1줄만. SyncStatus 초기 상태 `'idle'`(배지 미렌더) — 초록 "동기화됨"은 실제 성공 이벤트 후에만. 온라인 복귀도 'synced'가 아니라 'idle'로(확인 안 한 초록 금지). 로그인 게이트 밖으로: 로그아웃+knew-you=앰버 "이 기기에만 저장 중", 첫 방문 익명=무배지(소음 금지), 오프라인=전원 표시. RateLimitBadge는 user 게이트 유지.
- **main 최신화 확인**: `git fetch origin main` — origin/main이 브랜치 베이스(83a8878) 그대로, 병렬 세션 드리프트 0. db.ts는 HEAD와 main 간 diff 없음을 확인 후 최소 diff로 진행.
- **왜**: 만료가 ①백업 중단 무표시 ②회원을 "무료 체험" 취급 ③신규자용 카피 — 삼중으로 침묵/거짓이었다(10 P0-1). SyncStatus는 무근거 초록(낙관 기본값)과 영구 앰버(성공 이벤트 발신자 부재) 양방향 부정직(09 P1-4).
- **파일**: `src/lib/storage.ts`, `src/lib/__tests__/persistence-contract.test.ts`, `src/lib/auth.tsx`(hasKnownUser export), `src/components/ui/SessionExpiredToast.tsx`(신설), `src/components/ui/SyncStatus.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/AuthGuard.tsx`, `src/app/[locale]/workspace/page.tsx`, `src/components/workspace/progressive/ProgressiveFlow.tsx`, `src/lib/i18n/ko.ts`·`en.ts`, `src/lib/sync-health.ts`, `src/lib/db.ts`
- **검증**: tsc 0 · persistence-contract + db.test 14/14 · 한국어 mojibake 검사(U+FFFD 0) 통과.
- **커밋**: cf44598

### [P1-C7] 삭제 tombstone 전파 — 기기 간 삭제 + 영구 헛 push 루프 봉합

- **무엇을**: loadAndMergeUncached가 원격 응답에서 deleted_at 행을 **필터 전에** 수집(`tombstoned` Set — 추가 쿼리 0)하고, merge 결과에서 유령을 **localOnly 계산 앞에서** 제거. 이 한 수술로 ① 다른 기기에서 삭제한 행의 로컬 유령 사본이 다음 로드 때 사라지고 ② 그 유령이 localOnly로 분류돼 **매 로드마다 재-upsert되던 영구 헛 push 루프**(리뷰3 실배관 확인 — upsert payload에 deleted_at이 없어 서버는 삭제 유지, push만 무한 반복)가 같이 끊긴다. ③ deleted_at 컬럼 없는 테이블은 undefined → 산 것으로 취급(하위호환 자동 안전, 스키마 검사 불필요). 이 기기에서 방금 만들어 업로드 전인 항목은 tombstone에 없어 안전. 서버 삭제가 한 번이라도 성공했다면 "실패한 삭제 부활"(04 P2-3)도 자가 치유.
- **구현 제약 4개(리뷰3) 전부 이행**: ①필터 전 수집 ②localOnly 계산 앞 제거 ③하위호환 ④db.test.ts 회귀 테스트("tombstone 행은 로컬에서 제거되고 재푸시되지 않는다" — tombstone이 로컬보다 최신이어도 merge로 부활하지 않음 + 진짜 오프라인 생성 항목은 여전히 업로드됨 단언 포함).
- **파일**: `src/lib/db.ts`(loadAndMergeUncached), `src/lib/__tests__/db.test.ts`(loadAndMerge tombstone describe 신설 — supabase from/select/eq/order/upsert 체인 mock)
- **검증**: db.test 11/11 (신규 1건 포함) · tsc 0.
- **커밋**: 0847c09

### [P1-C2 + P1-C3] LLM 총예산 180초 + 재시도 가시화 + 오프라인 정직화 (둘 다 llm.ts — 한 자리)

- **무엇을(C2)**: fetchWithRetry에 벽시계 데드라인 `TOTAL_BUDGET_MS=180_000` — 시도당 120초 상한은 있었지만 4시도+백오프가 8분 넘게 쌓일 수 있었다. 재시도 진입 시(attempt>0) 예산 초과면 network/retryable로 즉시 종료(스펙 문안 그대로). + `argus:llm-retry` CustomEvent를 **3곳 모두**의 대기 직전에 발신(상태코드 재시도·하드캡 타임아웃 재시도·네트워크 오류 재시도 — 스펙은 1곳 지목이지만 나머지 두 대기도 같은 침묵이라 동일 처리). ProgressiveFlow가 이벤트를 받아 PhaseStatusBar substage에 "일시적인 오류가 있어 다시 시도하는 중 (2/3)…" 표시 — 기계 상태 사실만.
- **무엇을(C3)**: ① fetchWithRetry 시작부에 `navigator.onLine === false` 선검사(Single Source — 모든 비스트리밍 호출부가 이 관문 통과): 오프라인이면 헛 재시도 ~7초 대신 0ms에 "지금 오프라인이에요. 적어주신 내용은 이 기기에 그대로 있어요 — 연결이 돌아오면 다시 시도해 주세요." ② workspace 네트워크 분기 문구를 "연결이 끊겼거나 불안정해요 — 적어주신 내용은 그대로 있어요…"로 교체(작업물 보존 고지 추가). ③ ProgressiveFlow 에러 배너에 [다시 시도] 버튼 — 재진입 안전한 핸들러만 `retryRef`에 자기 자신을 보관(onAnswer는 catch에서 rollbackAnswer로 되돌리므로 안전 확인 후 배선, runMixCore·onDM·onDeepen·onMore·onFinalize 동일; onTest는 실패 시 스스로 finalize로 폴백하는 구조라 불필요). 쿼터 에러는 재시도가 못 고치므로 기존 Settings 링크 유지, 버튼 미표시.
- **왜**: 비스트리밍 호출은 총예산이 없고 재시도가 침묵해 "멈춘 스피너"로 읽혔다(09 P1-3). 오프라인 제출은 "불안정" + 헛 재시도 + "작업물 안전" 미고지 삼중 부정직(10 P1-4).
- **파일**: `src/lib/llm.ts`, `src/components/workspace/progressive/ProgressiveFlow.tsx`(retryRef+이벤트 소비+배너 버튼), `src/app/[locale]/workspace/page.tsx`(문구)
- **검증**: tsc 0 · llm 4개 스위트 56/56 통과.
- **커밋**: 8f6f2c7

### [P1-C4] OAuth 콜백 10초 타임아웃 + 텔레그램 연결 try/catch (영구 스피너 2곳 수리)

- **무엇을**: ① auth/callback의 `exchangeCodeForSession`을 10초 Promise.race로 — 왕복이 걸리면 "로그인 중..."이 영원했다. 타임아웃 시 기존 `?error=auth_failed` 경로 재사용(로그인 페이지가 이미 표시). ② useTelegramStore.startConnect 본문 try/catch — fetch가 throw하면 호출부의 setPending(false)를 건너뛰어 버튼이 영구 스피너였다. `{ok:false, error:'network'}` 리턴값으로 전환. ③ settings TelegramBlock의 setPending(false)를 finally로 이동 + network 분기 문구("연결을 시작하지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요").
- **파일**: `src/app/[locale]/auth/callback/page.tsx`, `src/stores/useTelegramStore.ts`, `src/app/[locale]/settings/page.tsx`
- **검증**: tsc 0.
- **커밋**: 4ff4b1d

### [P1-C6 — 최소 버전] 백업 왕복 정직화: 서버 내보내기 형식 감지 + 삭제 모달 카피 + 의심 문형 제거

- **무엇을**: ① handleImport가 서버 내보내기 형식(`{exported_at, tables}` — /api/account/export의 실제 형태를 코드로 확인)을 감지하면 "서버 내보내기 파일이에요. 이 파일은 보관용 사본이고, 앱으로 되돌리는 복원은 아직 지원하지 않아요. 복원하려면 로그아웃 상태에서 만든 백업 파일을 사용하세요."(04 S2 최소 스펙 문안 그대로) — 기존엔 "가져올 수 있는 데이터가 없습니다"로 조용히 죽었다. ② 삭제 모달의 "먼저 내보내기로 백업하세요"에 "(사본은 열람용이에요 — 앱으로 자동 복원되지는 않아요.)" 고지 — 삭제 직전이 이 사실이 가장 중요한 순간. ③ 의심 문형 3곳 제거(02 P1-7): 10MB 초과·기록 없음·JSON 아님 — 전부 "올바른지 확인해주세요"(사용자 의심) → 배의 사정 + "파일은 지우지 말고 보관해 주세요" 문형으로.
- **defer 준수(§3.5-1)**: 역매핑 복원 본체는 구현하지 않음 — 복원 버그는 로컬 데이터를 **덮어쓰는** 유일한 실패 모드라 자율 세션 밖. 최소 버전으로 04 S2의 신뢰 목표(왕복이 조용히 실패하는 거짓말 제거)는 달성.
- **파일**: `src/app/[locale]/settings/page.tsx`
- **검증**: tsc 0 · mojibake 0.
- **커밋**: 72fd4b5

### [P1-C5] 레거시 LoadingSteps 가짜 진행 정직화

- **무엇을**: 공유 부품 LoadingSteps(Reframe/Rehearse/Synthesize 3도구 공용) 한 곳 수리 — ① 실제 경과초 표시("N초 경과" — 이 화면에서 유일하게 연출이 아닌 숫자) ② 마지막 단계에서 10초 이상 머물면 "아직 진행 중이에요 — 단계 표시는 대략적인 안내예요"(연출이 거짓말로 넘어가는 순간을 스스로 고백) ③ `argus:llm-retry` 수신해 재시도 상태 표시(09 S6-3 선택 항목 — C2와 같은 이벤트라 비용 0). 취소 배선(AbortController)은 §5-3 기각대로 **하지 않음** — 강등 예정 화면 과투자, 180초 총예산이 상한 담당.
- **주의**: 09 S6-1의 "새로고침해도 입력은 남아 있어요" 약속 문구는 넣지 않음 — 3개 도구 모두의 마운트 고아 복구 실재를 검증해야 참말이 되는데(스펙 스스로 "확인 후" 조건), 마스터 정본(§2 P1-C5)의 문면은 "경과초 + 대략적 안내"까지라 정본을 따름. 확인 안 한 약속은 쓰지 않는다(목소리 원칙4).
- **파일**: `src/components/ui/LoadingSteps.tsx`
- **검증**: tsc 0 · mojibake 0.
- **커밋**: 2df8d2b

### 웨이브 4 경계 검증 (완료)

- `npx tsc --noEmit` 0 (커밋마다 + 최종 1회).
- `npx vitest run --exclude "**/.claude/**"` — db.test.ts 11/11(**tombstone 회귀 신규 1건 포함**) + persistence-contract 4/4(KNEW_YOU 선언 포함) + llm-network-simulation·llm-simulation 등 68/68. llm 4개 스위트 별도 실행 56/56.
- 한국어 문자열 파일 mojibake 검사(U+FFFD 카운트): ko.ts·SessionExpiredToast·workspace·AuthGuard·settings·LoadingSteps 전부 0.
- 변경 파일(SyncStatus·LoadingSteps·useTelegramStore·auth·sync-health)을 참조하는 기존 테스트 없음을 grep으로 확인 — 회귀 표면 없음.
- 커밋: P0-5+P1-C1=cf44598 · P1-C7=0847c09 · P1-C2+C3=8f6f2c7 · P1-C4=4ff4b1d · P1-C6최소=72fd4b5 · P1-C5=2df8d2b · docs=71f20e2. push 완료(origin/claude/pensive-almeida-9d3f27).

## 웨이브 5 — 목소리 대청소 (P1-D1~D8 · P1-B4 · P1-B6 · P2 카피 소품 · P1-E5 · P1-E6 · MCP 소품 목소리분)

### [P1-D1] 토막 에러 9곳 + ErrorBoundary + 공용 사전 — "{어디가} 막혔어요 — 작업물은 그대로 — 손잡이 하나" 패턴 통일

- **무엇을**: ① ProgressiveFlow의 명사형 토막 fallback 9곳("초안 생성 실패"·"DM 피드백 실패"·"심화 검토 실패"·"실패"(두 글자)·"최종본 실패"·"수정 요청 실패"·"재분석 실패"·"전환 실패"×2)을 02 S4 제안 문안 계열로 교체 — err.message 우선 구조는 유지, fallback만 교체. ② ErrorBoundary 관공서 말투("문제가 발생했습니다")를 error.tsx의 암초 목소리로("여기서 암초에 걸렸어요 / 이 구역만 잠깐 멈춘 거예요. 작업 내용은 이 브라우저에 그대로 남아 있어요."). ③ 공용 사전 ko.ts/en.ts: common.error·rateLimit.exceeded·errorDisplay.unknown/generic·progressive.sendFailed·quickChat.failure — 02 P1-5 표 문안 그대로. ④ ShareComposer 링크/전송 토막 4곳, workspace:463 합쇼체 이질 문장. 전부 ko/en 대칭.
- **왜**: 최상급(암초 404/500)과 최하급("실패" 두 글자)이 공존 — 사용자가 20분 쏟은 뒤 만나는 문장이 가장 차가웠다(02 P1-2/P1-3/P1-5). localStorage-first라 "작업물은 그대로"가 참말인 제품에서 그 말을 안 하고 있었다.
- **파일**: `src/components/workspace/progressive/ProgressiveFlow.tsx`, `src/components/layout/ErrorBoundary.tsx`, `src/components/ui/ShareComposer.tsx`, `src/app/[locale]/workspace/page.tsx`, `src/lib/i18n/ko.ts`, `src/lib/i18n/en.ts`
- **검증**: tsc 0 · mojibake 0 (웨이브 경계에서 카피 테스트 일괄 재실행 예정).
- **커밋**: f935fa6

### [P1-D6] 귀환 항구·빈 화면 카피 — 부재 통보("~없습니다") → 모항 문안 (02 기준 채택)

- **무엇을**: ① /project 헤더 부제 2곳 "사고 프로세스의 전체 여정을 한눈에 확인합니다" → "떠난 결정과 돌아올 결정을 한눈에." ② 빈 화면 "아직 프로젝트가 없습니다 / 4단계 프로세스…" → "아직 항해 전이에요 / 워크스페이스에서 첫 결정을 적으면, 여기가 그 결정이 돌아올 모항이 돼요. 확인일이 오면 이 페이지가 먼저 물어요 — 그래서, 어떻게 됐어요?" ③ 검색 빈결과 "일치하는 프로젝트가 없습니다." → "그 이름의 항해는 안 보여요 — 철자를 바꾸거나 필터를 '전체'로 돌려보세요." ④ ReceiptList 빈 화면(10 S6a 문안: "…봉인한 판단은 확인일에 여기로 돌아와요") ⑤ import 빈 화면(10 S6b: "플러그인·텔레그램에서 봉인한 결정이 이 계정으로 모여요"). "4단계 프로세스" 어휘 이 커밋에서 소멸 확인(잔여 grep 2건은 recast 예시·내부 eval 설명 — 무관 문맥).
- **왜**: 귀환 항구의 첫 문장이 부재 통보면 "돌아온 사람을 알아봐주는" 목소리가 죽는다(02 P1-6, 05 P2-7, 10 P2-2 — 취지 동일, 02 기준).
- **파일**: `src/app/[locale]/project/page.tsx`, `src/components/review/ReceiptList.tsx`, `src/app/[locale]/import/page.tsx`
- **검증**: tsc 0 · mojibake 0 (3파일 U+FFFD 카운트 0).
- **커밋**: 02cc83d

### [P1-B6] 지각 라벨 전멸 — "확인 지남 (N일)" 계열 → "확인할 차례" 계열

- **무엇을**: ① `review/status.ts` due 라벨의 날수 분기 삭제 — "확인 지남 (N일)" → "확인할 차례"(같은 파일 :72의 기존 좋은 톤으로 통일). `days_until`은 정렬용 내부 유지(사실은 남고 판정만 뺌 — 확인 날짜는 ReceiptList가 계속 보여줌). ② `import/page.tsx` 배지 "기한 지남" → "확인할 차례", 안내문 "확인일이 지났습니다. 실제로 어떻게 됐나요?" → "그래서, 어떻게 됐어요? 지금 기록해도, 나중에 해도 돼요."(10 S2b 문안 그대로) ③ OVERDUE 수입 금지 주석 박제: "웹앱 사용자 표면에는 지각 집계(OVERDUE/N일 지남)를 쓰지 않는다 — 플러그인 statusline은 개발자 표면이라 예외"(§5-6 판정 그대로 — 플러그인 statusline은 무접촉). ④ status.test.ts에 부재 단언 추가(라벨에 날수·"지남" 부재).
- **왜**: 날짜라는 사실은 이미 화면에 있으므로 날수 집계는 순수한 죄책감 장치 — 사용자에 대한 평결(스파인 규칙2). 02의 "현실이 N일째 기다려요" 문안은 §5-1 기각 판정 준수(온기로 포장해도 집계는 집계).
- **파일**: `src/lib/review/status.ts`, `src/app/[locale]/import/page.tsx`, `src/lib/review/__tests__/status.test.ts`
- **검증**: tsc 0 · status.test 통과 · mojibake 0.
- **커밋**: 00833cc

### [P1-B4] 가이드 FAQ 약속 정합 — "메일·알림은 보내지 않아요" 거짓 제거

- **무엇을**: guide FAQ ko(:124)·en(:155)의 "메일·알림은 보내지 않아요"(실제로는 텔레그램 연결 사용자에게 확인일 메시지가 감 — 적게 약속하는 것도 약속 위반)를 SealMoment:496의 정직한 문장으로 교체("정한 날짜에 프로젝트 페이지에 오시면 제가 먼저 물어요. 텔레그램을 연결해 두셨다면 그날 메시지로도 가볍게 알려드려요 — 광고성 메일은 보내지 않아요."). 두 표면(guide ↔ SealMoment)에 "알림 채널이 늘면 두 곳을 같이 고친다" parity 주석을 양쪽에 박제(02 S5 지시).
- **왜**: 같은 약속이 두 화면에서 다른 말을 하면 안 된다(목소리 원칙4: 약속은 실제 동작만큼만 — 숨기지도, 부풀리지도 않기).
- **파일**: `src/app/[locale]/guide/page.tsx`, `src/components/workspace/progressive/SealMoment.tsx`
- **검증**: tsc 0 · mojibake 0.
- **커밋**: 45ae842

### [P1-D2] 용어 통일 — KO "현재 방위" + 갈래 칩 "지금 가는 갈래" 개명

- **무엇을**: ① 결과 카드 눈썹·복사 aria-label(CurrentBearingCard) "현재 항로" → "현재 방위" ② DecisionReplayTimeline 라벨 동일 ③ manifest 설명 "현재 항로 한 화면" → "현재 방위 한 화면" ④ 갈래 전환 칩(workspace:152) "현재 항로 · 총 N개" → "지금 가는 갈래 · 총 N개"(+동음이의 해소 주석, EN도 Current course→Current branch). 커밋 후 `현재 항로` 전수 grep 0건.
- **왜**: 랜딩 영상·3단계 안내·가이드·내보내기 전부 "현재 방위"를 가르치는데 정작 도착지 카드가 "현재 항로"였고, 같은 말이 갈래 전환 칩에서 전혀 다른 뜻으로 이중 사용(06 P1-1). EN은 이미 통일돼 있어 KO만 수술.
- **재량 판단**: 06 S1-6의 부제 교체는 미실행 — 현행 부제("이 결정이 지금 향하는 방향입니다…")가 이미 제안 문안과 같은 취지의 다리이고, 마스터 §2 P1-D2 문면(정본)의 대상은 카드·타임라인·manifest·갈래 칩 4곳. JUDGMENT-CALLS W5-1.
- **파일**: `src/components/workspace/progressive/CurrentBearingCard.tsx`, `DecisionReplayTimeline.tsx`, `src/app/manifest.ts`, `src/app/[locale]/workspace/page.tsx`
- **검증**: tsc 0 (JSX 속성 자리 주석 오류 1회 즉시 수정) · mojibake 0.
- **커밋**: 6b84284

### [P1-D3] 히어로 기대설정 1줄 — 30초 실측 조건 이행 후 시간절 유지

- **무엇을**: SirenHero WRITE 문 하단(⏎ 힌트 줄 아래)에 마르지널리아 1줄 — KO "로그인 없이 무료 · 30초 안팎이면 첫 읽기가 와요 · 내용은 분석에만 쓰여요" / EN 대응. --bp-ink-soft 12px, 골드 0 (히어로 골드 1회 원칙 유지).
- **30초 실측(리뷰5 정직성 조건)**: ① Supabase 텔레메트리로 먼저 시도 — llm_usage 이벤트에 duration 없음 + first_analysis_start와 같은 세션의 llm_usage 0건이라 측정 불가 ② 스펙 처방대로 스모크 실행: 실제 첫 읽기 호출을 그대로 재현(`buildInitialAnalysisPrompt(ko)` + maxTokens 2000 + stream)해 프로덕션 https://argus.voyage/api/llm 에 3회 발사. 결과 = 첫 스트리밍 토큰 ~2.8초, 첫 읽기 완주 16.2초(계측 run)·~30초(1회차 테스트 총시간) → "30초 안팎" 참말 판정, 시간절 유지. 측정 근거를 코드 주석에 박제. (부수: 익명 무료 쿼터 3회 소모 — 스펙이 처방한 스모크.)
- **부수 효과**: SirenHero 헤더 주석의 "marginal privacy note" 드리프트(06 P2-8)가 이 줄 추가로 다시 참이 됨.
- **파일**: `src/components/landing/SirenHero.tsx`
- **검증**: tsc 0 · mojibake 0.
- **커밋**: 27dce7e

### [P1-D4] BindCard 첫 만남 다리 2줄 — SPINE INVARIANTS 무접촉

- **무엇을**: ① 진행 신호 — 버튼 영역 아래 조용한 상태 줄 "적어주신 내용은 그동안 뒤에서 이미 읽고 있어요 — 이 다음 화면에서 결과가 나와요."(기계 상태 서술만, 스피너 없음 — buffered 설계 유지) ② 은유 다리 — 부제 앞에 반 문장 결합 "세이렌 앞에서 몸을 묶은 오디세우스처럼 — 듣기 전에 내 판단을 한 줄 남겨두는 거예요." ③ 버튼 "묶고 계속"은 06 S3-3 최소 변경 권고대로 유지. SPINE INVARIANTS(스킵 지배·프리필 금지·포크 금지, :16-21) 코드 무접촉 — 카피 추가만.
- **왜**: "읽어봐 주세요"를 누른 사람이 읽기가 진행 중이라는 신호 0 + 무설명 밧줄 은유의 이중 공백(06 P1-3).
- **파일**: `src/components/workspace/progressive/BindCard.tsx`
- **검증**: tsc 0 · mojibake 0 · BindCard 참조 테스트 없음 확인.
- **커밋**: 7bb7dd6

### [P1-D5] 봉인 버튼 곁 캡션 — 47/0 지점에 SealModal 반 토막 이식

- **무엇을**: ① CurrentBearingCard 봉인 버튼 행 아래(canSeal일 때만) "봉인 = 이 결정을 여기 남겨두고, 정한 날에 '그래서, 어떻게 됐어요?'를 물어드리는 거예요." ② ReceiptView "후속 예측 봉인하기" 버튼 위 "봉인하면 확인일에 현실과 대조해요"(기존 "(현실 기록)" 괄호 문법과 동일 결).
- **왜**: '봉인'은 일상어에서 "잠근다/못 바꾼다" 어감이라 조심스러운 사람일수록 안 누르는데, 이 버튼이 정확히 47 열림/0 봉인 깔때기의 그 지점(06 P1-4).
- **파일**: `src/components/workspace/progressive/CurrentBearingCard.tsx`, `src/components/review/ReceiptView.tsx`
- **검증**: tsc 0 · mojibake 0.
- **커밋**: 8b44a1b

### [P1-D6·P1-B6·P1-B4] — 이전 세션에서 커밋 완료 (02cc83d·00833cc·45ae842), 이번 세션은 로그만 보완

### [P1-D7] 레거시 문 봉쇄 + 가이드 항해 4박자

- **무엇을**: ① guide "고급 — 단계별로 직접 사용" details 블록(LegacyChip 4개 + ?step= 설명) 전체 삭제 + LegacyChip 헬퍼·Settings2 import Clean Removal(grep 전수 0건) — 라우트는 전부 유지(§5-4), 새 유입 광고만 중단, 자리 주석 박제 ② quickStartSteps를 항해 4박자(05 S4 문안)로 교체: 적는다 → 밧줄 묶는다 → 갈리는 자리를 본다 → 정한 날 돌아와 답한다 (기존 4줄은 밧줄·귀환 박자가 빠진 구형 흐름이었음).
- **재량 판단 2건**: (a) 레벨/XP 블록은 감사 시점과 달리 이미 접힌 details("선원 성장 시스템 (선택)")로 강등돼 있어 05 S4의 "삭제하거나 접힘 강등" 조건 기충족 — 무접촉. (b) NextStepGuide 링크 교체 안 함 — 사용처 전수 grep 결과 ReframeStep/RecastStep/RehearseStep(레거시 스텝 컴포넌트)에서만 렌더 = 스펙 자신의 조건 "레거시 전용이면 그대로 두는 것도 가능 / 레거시 안에서는 레거시 링크 허용" 적용. JUDGMENT-CALLS W5-2.
- **파일**: `src/app/[locale]/guide/page.tsx`
- **검증**: tsc 0 · LegacyChip grep 0 · mojibake 0.
- **커밋**: a2126fc

### [P1-D8] /design/* 비공개화

- **무엇을**: public-paths.ts PUBLIC_PATHS에서 '/design' 제거(사유 주석 박제) → AuthGuard 뒤로. 라우트 자체는 유지(내부 레퍼런스 가치). Header/LayoutShell의 /design 분기는 05 S5 지시대로 무접촉("그대로 둬도 무해"). /design을 단언하는 테스트 없음 확인.
- **파일**: `src/lib/public-paths.ts`
- **검증**: tsc 0 · public 관련 테스트 통과.
- **커밋**: 033cdd9

### [P2 카피 소품 묶음] 일괄 스윕

- **무엇을**: ① "지금 내 lean"→"지금 내 예상"(SealModal), "내 lean"→"내 예상"(ReceiptView) ② 검수 버튼 "내 항로"→"내 검수 기록", "← 내 판단 항로"→"← 내 검수 기록"(ReviewFlow — '항로'는 항해 표면에 보존) ③ ko.ts demo.analysisDone 'Analysis done'→'분석 끝'(소비처 grep 0 = dead key — 주석 박제하고 값만 수리) ④ "Settings에서"→"설정에서" 5곳(workspace 3 + ProgressiveFlow 2, KO만 — EN은 Settings 유지) ⑤ UnlockToast "{역할} 해금!"→"새 선원이 승선했어요 — {역할}"(EN "came aboard") ⑥ common.loading '로딩 중...'→'펼치는 중...', workspace 스피너 "워크스페이스 준비 중..."→"항해 준비 중..." ⑦ Slack 토막 3키 ko/en 온기 보강(failed·sendFailed·loadFailed) ⑧ llm.ts 맨몸 서버 에러 3곳(529 과부하·5xx "서버 오류 (N)"·차단기)을 10 S7 문안으로 — llm-network-simulation.test.ts 단언 동반 갱신 ⑨ KO 로케일 모노 마이크로라벨 한국어 우선: 히어로 "LOG ENTRY·"→"기록 ·", "ON FILE·"→"서류 ·"(2곳) + workspace ON FILE 행(EN은 전부 원형 유지 — 정체성 모노 활자 보존).
- **파일**: `SealModal.tsx`, `ReceiptView.tsx`, `ReviewFlow.tsx`, `ko.ts`, `en.ts`, `workspace/page.tsx`, `ProgressiveFlow.tsx`, `UnlockToast.tsx`, `SirenHero.tsx`, `llm.ts`, `llm-network-simulation.test.ts`
- **검증**: tsc 0 · llm 스위트 53/53 · sed 치환부 육안 재확인(UTF-8 무손상) · mojibake 0.
- **커밋**: 46c5f3f

### [P1-E5] MCP 한국어 검증기 2건 — 회귀 테스트 동반

- **무엇을**: ① validate-crux LEAN 정규식의 `i('| w)?d`(맨몸 단어 "id"까지 매칭 — "Will the user id migration finish before Q3?"가 CRUX_CARRIES_LEAN 오발) → `i'd|i would`로 분해 ② validate-seal에 VIBE_KO 추가(12 §3.4 정규식 그대로 — 한글에는 \b가 안 통해 무경계) + 매칭 시 ko 에러 문안("이건 기분이지 확인 가능한 예측이 아닙니다…(휴리스틱 — 놓칠 수 있음)"). 두 건 모두 weak:true 유지 — 하드 게이트 승격 금지(§5-14) 준수. ③ 신규 `argus-mcp/src/lib/__tests__/validators.test.ts` 6건: user-id 통과 회귀 + I'd/I would 여전히 검거 + 한국어 vibe 검거(weak·ko 문안) + 정상 한국어 술어 통과 + 영어 vibe 유지.
- **파일**: `argus-mcp/src/lib/validate-crux.ts`, `validate-seal.ts`, `__tests__/validators.test.ts`(신규)
- **검증**: MCP tsc 0 · validators 6/6 · 전체 177/177 (기존 171 + 신규 6).
- **커밋**: 1626946

### [P1-E6] ARGUS_TZ 가시화 — 기본값 UTC 유지, 문서화+노출만

- **무엇을**: ① README 설치 스니펫 env에 `"ARGUS_TZ": "Asia/Seoul"` + 정직 한 줄("미설정 = UTC — 한국 사용자는 오전 9시(KST)까지 어제로 계산") ② argus_init 응답 data에 `today`·`tz`(`'UTC (set ARGUS_TZ to change)'` 형) 노출 — 설치 직후 "오늘이 어제네?"를 스스로 발견. 기본값 변경 없음(§5-13, 청사진 M4 결정성 논거 유지).
- **파일**: `argus-mcp/README.md`, `argus-mcp/src/tools/init-config.ts`
- **검증**: MCP tsc 0 · 전체 177/177 (스키마 테스트 무영향 확인).
- **커밋**: d633aef

### [MCP 소품 목소리분] REASON_LINE + 원장 손상 발화

- **무엇을**: ① open_decision restraint surface의 내부 enum 노출(`This looks like a "reversible_low_stakes" case.`) → REASON_LINE 사전(11 S6 문안 그대로, 6사유)으로 사람 문장화, 모든 문장 끝은 "Leaving it as is stays a real option."(§4 계약: 핸들 반환, 지시 금지). overfire 게이트의 crux 생성 前 실행 구조(open-decision.ts:59) 무접촉. 'flat'은 현행 게이트가 안 내지만 전방 호환으로 사전에 유지. ② check_in에 원장 손상 고지: `integrity.dropped_lines > 0`이면 surface 한 줄("원장에서 읽지 못한 줄 N개…append-only라 나머지는 안전…ledger.jsonl 백업") — 숫자로만 세고 침묵하던 것(11 P2-8)을 발화. surfaces.ts {ko,en} 사전 경유(P1-E1 구조 재사용, 타입 패리티 강제).
- **범위 판단**: MCP 소품 10건 중 "목소리분"은 이 2건으로 판정 — 나머지(idempotentHint·server 버전·README 도구표·영수증 폴백·wrap·gate_input·SERVER_INSTRUCTIONS 2줄)는 구조/정합 소품이라 웨이브8 "MCP 소품 잔여" 소관. JUDGMENT-CALLS W5-3.
- **파일**: `argus-mcp/src/tools/open-decision.ts`, `check-in.ts`, `src/lib/surfaces.ts`
- **검증**: MCP tsc 0 · 전체 177/177 · restraint surface를 단언하는 기존 테스트 없음 grep 확인 · mojibake 0.
- **커밋**: 063b684

### 웨이브 5 경계 검증 (완료)

- 웹앱 `npx tsc --noEmit` 0 (커밋마다 + 최종 1회).
- 카피 테스트 일괄: seal-core·record-core·checkin-reminder·telegram-settlement·navigator-content·navigator-simulation·review/status·llm-network-simulation·llm-simulation·persistence-contract = **10파일 181/181 통과** (`--exclude "**/.claude/**"`).
- MCP: `npm run typecheck` 0 + `npx vitest run` **18파일 177/177** (신규 validators 6건 포함).
- mojibake: 이 웨이브에서 바뀐 전 파일(웹 17 + MCP 8) U+FFFD 스캔 0건 + sed 치환부("설정에서" 5곳) 육안 재확인.
- 커밋: D2=6b84284 · D3=27dce7e · D4=7bb7dd6 · D5=8b44a1b · D7=a2126fc · D8=033cdd9 · P2카피=46c5f3f · E5=1626946 · E6=d633aef · MCP목소리=063b684 (+이전 세션분 D1=f935fa6 · D6=02cc83d · B6=00833cc · B4=45ae842).

---

## 웨이브 6 — 봉인 의식 (P1-A3 → P1-B2 조각 → P1-A1 → P1-E2)

### [P1-A3] 봉인 의식 2.6초 — S1~S4 한 몸 커밋 + S5·S6 독립 소커밋

- **무엇을**: 봉인이 "상태 갱신"(한 프레임 카드 스왑)이던 것을 항해의 종막 의식으로 승격.
  - **S1 (globals.css)**: `seal-press`(압인, 오버슈트 이징)·`seal-thud`(카드가 2px 받아내는 소리 없는 쿵)·`seal-ink-ring`(먹 번짐 1회)·`seal-line-write`(날짜 문장이 왼→오로 쓰임)·`seal-glint-app`(안착 후 광택 숨 하나) 키프레임을 앱 애니메이션 구역(voyage-* 옆)에 추가. `prefers-reduced-motion` 블록이 5종 전부 정지 + line-write는 `clip-path:none`으로 최종 프레임 고정. 네임스페이스는 `seal-*`만 — `bp-seal-stamp`(랜딩 자산)는 07 지시대로 무접촉 보존.
  - **S2 (SealStamp.tsx 신규)**: 76px 이중 링 잉크 인장 SVG — 상단 호 ARGUS, 하단 호 확인일(tabular-nums), 중앙 앵커 글리프(lucide 경로), -8° 고정 회전, 전부 `var(--accent)` 앱 토큰. 인장에는 이름과 날짜뿐 — 평가 어휘 0 (테스트로 고정). `animate` prop이 압인+잉크 링을 게이트.
  - **S3 (SealMoment 장면 전환)**: `justSealed:boolean` → `scene:'ask'|'sealing'|'sealed'` 상태기계. seal()/manualSeal()이 스토어 갱신 직후 'sealing' 진입, 1700ms 후 'sealed' 크로스페이드(타이머 cleanup 포함). `useReducedMotion()`이면 의식 장면을 아예 건너뛰고 곧장 'sealed'. ASK/SEALING/SEALED를 하나의 `AnimatePresence mode="wait"` 아래 keyed motion.div로 — ASK 카드가 220ms에 눌리며 퇴장(scale 0.985). 'sealing' 장면은 어디를 눌러도(또는 Enter/Space) 즉시 스킵(role="button"+aria-label 건너뛰기). 재봉인(sealed 서랍의 "이대로 다시 약속")은 의식 재생 없이 증서에 머무름 — 의식은 세션당 1회.
  - **S4 (봉인 증서)**: SEALED 화면을 두 층으로 — 위 = 증서 플레이트(Graticule 0.05 격자 질감 + 정지 인장 + "항해 기록 — 봉인"·봉인일 라벨 + 프로젝트명 + **사용자의 human_judgment 세리프 인용**(스크린샷의 심장) + 경계선 위 "이 판단의 답은 이제 현실만 갖고 있어요 — {날짜}, 「그래서, 어떻게 됐어요?」"), 아래 = 기존 행동 요소 전부(문안 무변경: 확인 문장 2줄·로그인 CTA·프로젝트 링크·.ics·손보기 서랍) 0.25s 늦게 등장. human_judgment 없으면 대표 술어를 "AI가 대신 적어둔 확인 질문" 라벨과 함께(정직 표기, 무단 승격 금지) — 둘 다 없으면 인용부 미렌더.
  - **S5 (검수 정합, 독립 커밋 479c05f)**: ReviewFlow 초록 success 카드 → elevated + 44px 정지 인장 + accent 라벨(문안 유지). SealModal "봉인하기"가 즉시 닫히는 대신 480ms 인장 압인 재생 후 커밋(reduced-motion이면 즉시, 언마운트 시 타이머 cleanup, 압인 중 backdrop/취소 잠금) + active:scale-[0.96].
  - **S6 (위계 수리, 독립 커밋 6fcc5d8)**: ProgressiveFlow "문서 완성" 금색 원 → 중립(`--surface-2` + accent 체크) — 금색과 인장은 이 화면에서 봉인만 갖는다. SealMoment 금색 봉인 버튼 2개(주 ASK + 수동 복구)에 active:scale-[0.96] 이식(CurrentBearingCard 기존 패턴).
- **§4 채택 조건 이행**: 동일 1회(내용·방향 무관 같은 재생 — 인장은 이름+날짜뿐) · 탭 스킵(+키보드) · reduced-motion 정지 프레임 · 거절 경로 무의식·무변경(dismissed 분기 무접촉) · BindCard 무접촉 · `seal-*` 네임스페이스만(design-register-contract 통과) · 금색 위 텍스트는 기존 버튼의 고정 white 유지, 신규 요소는 금 그라디언트 배경 자체를 안 씀(인장 = accent 스트로크).
- **왜**: 07 감사 — 제품 어원의 동작이 목록 새로고침과 같은 렌더였고, 사용자가 쓴 한 줄이 봉인 순간 화면에서 증발했으며, 문서 완성이 봉인보다 화려한 위계 역전.
- **시각 검증 갈음**: preview 대신 신규 `src/lib/__tests__/seal-ceremony.test.ts` 6건 — 키프레임 5종 존재 + reduced-motion 전멸 + clip-path:none + 탭 스킵 존재 + bp-* 누출 0 + ai_surfaced 정직 라벨 + 인장 평가어휘 0. (P1-A3 태그의 명시 대체 경로)
- **파일**: `src/app/globals.css`, `src/components/workspace/progressive/SealStamp.tsx`(신규), `SealMoment.tsx`, `ProgressiveFlow.tsx`, `src/components/review/ReviewFlow.tsx`, `SealModal.tsx`, `src/lib/__tests__/seal-ceremony.test.ts`(신규)
- **검증**: tsc 0 · seal-ceremony + mojibake-guard + design-register-contract 599/599 통과 (mojibake 픽스처 4문장 전부 보존 확인).
- **커밋**: S1~S4=`af6d7ce` · S5=`479c05f` · S6=`6fcc5d8`

### [P1-B2 조각] SealMoment 이메일 옵트인 체크박스 — 돌아오는 길 묶음

- **무엇을**: 봉인 증서의 "돌아오는 길" 묶음(.ics 버튼 행 바로 아래)에 로그인 사용자 전용 체크박스 "그날 이메일로도 물어봐 주세요 ({email})" — 기존 `decision_contract.email_reminder` jsonb 플래그(checkin-due 크론이 이미 게이트)를 켜는 유일한 UI. 익명은 기존 로그인 CTA가 그 자리 담당(§5-20 신규 채널 금지). 웨이브2가 만든 크론 조각(한국어 본문·?from=checkin)과 이제 한 몸. 발송 트리거 없음 — 플래그 쓰기뿐.
- **왜 지금**: 웨이브2에서 이 조각만 W6으로 보류(P1-A3이 같은 파일 :365-389 구간을 만지므로) — 의식 커밋 직후 실행하라는 웨이브 정의 그대로.
- **파일**: `src/components/workspace/progressive/SealMoment.tsx`
- **검증**: tsc 0 · seal-ceremony·mojibake 597/597.
- **커밋**: ccef1aa

### [P1-A1] 판단 액자 + 재봉인 온램프

- **무엇을**:
  - **JudgmentFrame 신규 컴포넌트**(`src/components/projects/JudgmentFrame.tsx`) — write-only였던 사용자 자신의 두 문장(봉인 때 `human_judgment`, 정산 때 `what_happened`)을 봉인 증서와 같은 register(Graticule 미세 격자 + 세리프 인용)로 영구 전시. "봉인 당시 — {날짜}" / "돌아와서 — {날짜}" 라벨 + 원문 인용 + 날짜 스탬프**만** — 요약·평가·해설 문장 0(두 인용의 diff를 읽는 것은 사용자 몫, 해설하는 순간 판정). 인용은 전부 JSX 텍스트 노드(auto-escape, XSS 부록 준수).
  - **스파인 계약 이행**: 1급 인용은 human_judgment(사용자 타이핑 전용 필드)만 — `authored:'ai_surfaced'` 술어의 액자 승격 없음. human_judgment 부재(스킵 봉인·레거시 계약) → 액자 블록 전체 미렌더(빈 액자·placeholder 금지). what_happened 부재(텔레그램 버튼 정산 등) → 봉인 인용만. SettlementModal 쪽은 **저장된** what_happened만 각인(미저장 초안은 액자에 안 걸림).
  - **배치 2곳**: ① DecisionContractCard "검증된 항해" 카드(PredicateList 위) ② SettlementModal "고리를 닫았어요" 완료 화면(닫는 순간 = 액자가 걸리는 순간).
  - **재봉인 온램프(리뷰1)**: 정산 완료 화면 하단, [확인] 버튼 옆에 조용한 텍스트 링크 1개 — 남은 due>0이면 "다음 확인할 것 N건 →"(모달 닫기 — 스트립이 바로 뒤에 있음), 0이면 "새 결정 적기 →"(/workspace LocaleLink). N은 **부모(/project)의 useDueCount 수를 prop(`remainingDue`)으로 내려받음** — 모달이 자체 due 산수를 갖지 않아 스트립과 드리프트 불가. 버튼 위계 승격·자동 이동·연쇄 모달 없음(§5-19).
- **검증**: tsc 0 · settlement-modal-freeform(기존 컴포넌트 테스트, 신규 prop 옵셔널이라 무수정 통과)·mojibake·seal-ceremony 599/599 → 이후 4파일 601/601 · **preview 실기동 확인**: dev 서버 + localStorage 시드(graded 계약 + judgment_receipt)로 /ko/project 상세 진입 → `봉인 당시`·`돌아와서`·두 인용 원문 전부 DOM 렌더 확인(스크린샷 도구는 30s 타임아웃 — 기존 확정 사실이라 eval 검증으로 갈음).
- **커밋**: 68b6477

### [P1-E2] MCP seal_text — 봉인 확인문 (웹 증서의 텍스트 판)

- **무엇을**: `renderSeal()` 신설(`argus-mcp/src/lib/render-receipt.ts`) → argus_seal 성공 envelope의 `data.seal_text`. 도구 description에 "show it to the user verbatim" 명시(12 §3.1의 필드 설명 요구). 구성 = 술어 인용 블록(wrap, 이어지는 줄 들여쓰기) + **provenance 사실 진술 분기**(user → "이 문장은 당신의 것입니다." / ai_surfaced → "Argus가 초안한 문장입니다 — 아직 당신이 확언하지 않았습니다." — 거짓 소유 서사 금지, 강제 타이핑 게이트 없음: 그대로 봉인 가능) + 봉인/현실의 답 날짜 2행(N일 뒤 diff는 `resolveToday` 결과로 계산 — 벽시계 새로 안 읽음) + "기록될 것은 평가가 아니라 — 실제로 일어난 일입니다" 마무리(웹 증서 P1-A3 S4와 같은 문안 계열, 같은 세션 이식 — 두 표면 문안 계약 이행). 이모지 0, "닻 내림/anchor down"이 유일한 장식.
  - locale은 웨이브3의 P1-E1 구조 그대로: surfaces.ts에 `seal` 섹션 {ko,en} 추가(타입 패리티 강제) + `surfaceLocale(dir)` 선택. review 코어 8파일 무접촉.
  - ai_surfaced 소유줄이 길어 provenance 태그와 붙는 시각 결함을 스모크에서 발견 → 간격 로직 수정. tsx 스모크로 ko/en 실렌더 육안 확인(박스 정렬 OK).
- **회귀 가드**: spine-drift.test.ts에 renderSeal 단언 3건 추가 — ① 4조합(ko/en × user/ai) 전부 %·tier·score·streak·점수·등급·연속 부재 ② 두 소유 분기의 정직성(user 문장이 ai 분기에 누출되지 않음, ko/en) ③ 인용·날짜 2행·day diff·"평가가 아니라" 존재.
- **검증**: MCP `npm run typecheck` 0 · `npx vitest run` **18파일 180/180**(기존 177 + 신규 3).
- **커밋**: f5e0a5c

### 웨이브 6 경계 검증 (완료)

- 웹앱 `npx tsc --noEmit` 0 (커밋마다 실행).
- 웹 테스트: seal-ceremony(신규 6건)·mojibake-guard·design-register-contract·settlement-modal-freeform = **4파일 601/601**.
- MCP: `npm run typecheck` 0 + 전체 **18파일 180/180**.
- **preview 시도 결과**: dev 서버 기동 성공, `preview_screenshot`은 30s 타임아웃 반복(과거 세션에서도 확정된 환경 한계 — MEMORY "preview_screenshot 타임아웃→eval로 검증") → 태그의 대체 경로 이행: ① eval로 seal-* 애니메이션 5종이 **서빙된 CSS에 실재**(computed animationName/duration 확인: press 0.56s·thud 0.18s·ink 0.7s·write 0.7s·glint 4.8s) ② 판단 액자 실DOM 렌더(위 A1 항목) ③ 클래스·reduced-motion 단위 테스트(seal-ceremony.test.ts).
- mojibake: 이번 웨이브 접촉 한국어 파일 8개 U+FFFD 스캔 0건 + mojibake-guard 픽스처(SealMoment 4문장) 보존 통과.
- 커밋: A3(S1~S4)=af6d7ce · A3(S5)=479c05f · A3(S6)=6fcc5d8 · B2조각=ccef1aa · A1=68b6477 · E2=f5e0a5c

## 웨이브 7 — 보물 합산 (P1-A2 → P1-A5 · P1-E7)

### [P1-A2] 자차표 한 뇌 — RecordStrip 공용 컴포넌트 + 검수 합산

- **무엇을**:
  - **`src/lib/record-summary.ts` 신설** — 자차표 표시 계층의 단일 두뇌. `summarizeReviewRecord(receipts)`(useReviewStore.settleFollowup가 쓰는 sealed_at/settled_at/outcome 필드 기준, 08 S2-1) + `recordStripLine`(스트립 문장 — 0인 절은 생략, 얇은 기록을 0으로 부풀리지 않음) + `recordCompactLine`(워크스페이스 헤더 초압축형 — W3의 P1-A4가 만든 문장을 이 두뇌로 이사) + `recordStartDate`(기록 시작 각인 — 날짜 사실, 기간 아님) + `shouldShowThirdLoop`(A5 게이트). **테이블·타입 통합 없음**(§5-12: 표시 계층 합산만, 병렬 세션 등록부 무접촉).
  - **`<RecordStrip/>` 신설·3곳 배치**: ① /project 목록(기존 인라인 스트립을 컴포넌트로 추출·교체) ② /tools/review 목록 상단(ReceiptList 헤더 아래 — ON FILE 문으로 들어온 코호트가 처음으로 합산됨) ③ /workspace 헤더 한 줄(recordCompactLine 경유 — 같은 두뇌, 드리프트 불가). 마운트 시 두 스토어 load(로컬 우선 멱등 머지)로 어느 문으로 들어와도 양쪽 절반이 로딩됨.
  - **dim9 게이트는 병합 카운트에**: recordDisclosure를 (project loops + review settled) 합산 수에 적용 — 검수 정산 몇 건이 문턱을 우회해 "기록" 주장을 밀수하지 못함. 문턱 아래는 기존 이탤릭("아직 확정된 기록은 아님"), 이상은 사실 각인("기록 시작 YYYY-MM-DD" — A5 스펙의 이탤릭 자리 교체 조각).
  - **텔레그램 어휘 통일(08 S2-5)**: record-core.ts 정산 결과 줄 "잘됨/안됨" → "적중/빗나감"(웹 "적중한 가설/빗나간 가설" 계열과 동일 단어족). 장기 통합 TODO 주석 박제. 정산 **답변 버튼**("✅ 잘 됐어요")은 W2의 정산 질문 카피라 무접촉.
  - **교차 테스트(08 S8)**: 신규 `src/lib/__tests__/record-summary.test.ts` — 같은 가짜 데이터에서 웹 스트립 문장과 텔레그램 마크다운의 **숫자**가 일치해야 통과(정산 자릿수 추출 비교 + ReviewRecordCounts를 RecordCounts 자리에 그대로 넘기는 호출 자체가 형태 계약 증명). 양쪽 다 % 부재 단언(스파인).
- **파일**: `src/lib/record-summary.ts`(신규), `src/components/ui/RecordStrip.tsx`(신규), `src/lib/record-core.ts`, `src/app/[locale]/project/page.tsx`, `src/app/[locale]/workspace/page.tsx`, `src/components/review/ReceiptList.tsx`, `src/lib/__tests__/record-summary.test.ts`(신규), `record-core.test.ts`
- **검증**: tsc 0 · record-summary(신규 12)+record-core+record-disclosure+predicate-basis+sanitize-injection 5파일 37/37 · mojibake-guard 594/594 + 접촉 한국어 파일 7개 U+FFFD 0.
- **커밋**: a08220d

### [P1-A5] 3고리 의식 — 문턱의 순간에 조용한 한 줄

- **무엇을**:
  - 정산 모달 완료 화면("고리를 닫았어요")에서 **병합 정산 수가 SETTLED_THRESHOLD(3)에 처음 도달하는 정확히 그 순간** 1회: 금색 실선(2초 draw, `prefers-reduced-motion`이면 정지 — framer useReducedMotion) + 한 줄 **"세 번째 고리를 닫았어요. 이제 이 기록의 빈도가 의미를 갖기 시작해요 — 여전히 점수는 아니에요."** 점수-부정을 문장 안에 내장(§4 채택 조건). 사용자 평가 어휘 0 · "우리는 판단하지 않아요" 류 무결 선언 확장 0(§5-10).
  - **평생 1회**: `argus:third-loop-seen` 로컬 플래그 — STORAGE_KEYS·persistence-contract CONTRACT **둘 다 끝에 append만**(localOnly 사유 기재, 병렬 세션 규칙). 게이트는 `shouldShowThirdLoop`의 **엄격 동치**(=== 3): 이 기능 이전에 이미 문턱을 넘은 사용자가 5번째 고리에서 뒤늦은 "세 번째" 인사를 받지 않음 — 단위 테스트 고정.
  - 이탤릭 자리→사실 각인 교체는 A2의 RecordStrip에서 이행됨(위 항목).
- **파일**: `src/components/projects/SettlementModal.tsx`, `src/lib/storage.ts`, `src/lib/__tests__/persistence-contract.test.ts`
- **검증**: tsc 0 · persistence-contract+record-summary+settlement-modal-freeform+mojibake 4파일 609/609 · 접촉 파일 U+FFFD 0.
- **커밋**: ded4078

### [P1-E7] MCP wake_text — 항적 렌더 (축적이 보이는 구조)

- **무엇을**:
  - **`renderWake(contracts, stats, today, locale, recordSince?)`** 신설(render-receipt.ts) → `argus_recall view=bearing`/`view=contracts`의 `data.wake_text`. 구조 = 12 §3.5 목표 출력 그대로: 3그룹(확인일 지남 → 현실을 기다리는 중 → 정산됨), 그룹 내 check_by 오름차순, 그룹당 5줄+`… (+N)` 접기(check_in TOP=5 관례), 헤더 카운트(`결정 N · 봉인 중 M · 정산 K`), 마지막 줄 `기록 시작 YYYY-MM-DD 부터`(가장 오래된 원장 이벤트 ts). 빈 그룹은 통째로 생략(속 빈 프레임 금지), 봉인·정산 0건이면 wake_text 자체 미부착. 스모크 실렌더로 ko/en 육안 확인(스펙 목표 출력과 동형).
  - **원장 fold 최소 확장(전부 additive optional)**: `LedgerState.oldest_ts`(ISO 사전순 min) + `ContractEntry.settled_on`(settle 이벤트 ts 날짜 — 정산됨 줄의 날짜 칸). 기존 리터럴·테스트 무수정 호환.
  - **문자열은 surfaces.ts `{ko,en}` wake 섹션**(P1-E1 구조 — 타입 패리티가 두 목소리 드리프트를 컴파일에서 막음).
  - **JSON 측도 정직(12 §3.6)**: bearing `open`·contracts 배열 check_by 오름차순 정렬(기한 지난 건이 8월 계약 사이에 묻히던 실측 수리) + contracts 60건 컷 & `truncated: N`.
  - **spine-drift.test 단언 추가(마스터 부록 요구)**: 신규 5테스트 — ①ko/en 전부 %·비율(`\d/\d`)·tier·score·streak·점수·등급·연속·적중률 부재 ②정산 헤더는 개수 나열만(`held 1 · avoided 1 · partial 1` — user_stated outcome 단어라 판결 아님) ③3그룹+접기+`← argus_settle` 핸들+기록 시작 ④check_by 정렬 ⑤빈 그룹 소멸.
  - **지각 어휘 거취**: "확인일 지남 (N) · N일 경과"는 §5-6 개발자-표면 판정대로 터미널 허용 — surfaces.ts 주석에 "웹 수입 금지" 박제(P1-B6과 짝).
- **파일**: `argus-mcp/src/lib/render-receipt.ts`, `surfaces.ts`, `ledger-replay.ts`, `src/tools/recall.ts`, `src/lib/__tests__/spine-drift.test.ts`
- **검증**: MCP `npm run typecheck` 0 · 전체 **18파일 185/185**(기존 180 + 신규 5) · 스모크 실렌더 ko/en.
- **커밋**: dc3fabd

### 웨이브 7 경계 검증 (완료)

- 웹앱 `npx tsc --noEmit` 0 (커밋마다).
- record-core 숫자 일치: record-summary.test.ts CROSS 테스트(같은 데이터 → 웹 스트립·텔레그램 마크다운 자릿수 동일) 통과 — record-summary·record-core·record-disclosure·persistence-contract·mojibake·seal-ceremony·projects 컴포넌트 = **7파일 624/624**.
- MCP: `npm run typecheck` 0 + spine-drift 13/13 (전체 스위트 185/185는 커밋 직전 실행).
- mojibake: 접촉 한국어 파일(record-core·record-summary·RecordStrip·SettlementModal·storage·persistence-contract 등) U+FFFD 스캔 0건.
- 커밋: A2=a08220d · A5=ded4078 · E7=dc3fabd
