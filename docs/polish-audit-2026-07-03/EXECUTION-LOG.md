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
