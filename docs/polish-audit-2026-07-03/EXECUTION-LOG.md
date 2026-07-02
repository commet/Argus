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
