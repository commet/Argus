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
