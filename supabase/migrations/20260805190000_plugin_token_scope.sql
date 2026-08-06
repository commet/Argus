-- PAT 범위. 원격 OAuth 커넥터(마이그레이션 20260805170000)가 생기면서 **제3자가
-- 동의 클릭 하나로 PAT 을 받아 가는 경로**가 처음 열렸다. 그 전까지 발급 경로는
-- 둘 다 사용자 손 안에 있었다 — 설정 화면(브라우저 세션 필수)과 로컬 CLI 의
-- loopback 흐름(같은 기기 필수). 그래서 "PAT = 계정 전체"가 문제가 되지 않았다.
--
-- 동의 화면은 "결정을 기록한다"고 적는데, 범위가 없으면 같은 토큰으로
-- /api/plugin/ingest(파일 적재)와 /api/mcp/seal(영수증 변경)까지 열린다.
-- 화면의 문장과 토큰의 실제 권한이 다르면 그 문장은 거짓말이다.
--
-- 호환: NULL = argus.full 로 읽는다 (src/lib/plugin-token-auth.ts scopeAllows).
-- 컬럼을 추가한 순간 유효한 CLI 토큰이 전부 죽으면 안 되므로, 좁히기는 새로
-- 발급되는 토큰부터 적용된다. 이 컬럼은 nullable 이고 라이브 테이블에 안전하다.

ALTER TABLE public.plugin_tokens
  ADD COLUMN IF NOT EXISTS scope text;

COMMENT ON COLUMN public.plugin_tokens.scope IS
  'argus.full = 계정 전체(사용자 직접 발급·로컬 CLI). argus.decisions = 원격 MCP 결정 표면만. NULL = 컬럼 이전 토큰, full 로 취급.';
