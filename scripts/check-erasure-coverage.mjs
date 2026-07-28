/**
 * 계정 삭제·내보내기 커버리지 온디맨드 대조 — 마이그레이션 후 실행.
 * (scripts/check-schema-drift.mjs 의 자매 스크립트. 같은 규약·같은 출력 어휘.)
 *
 * src/lib/user-data-tables.ts 의 USER_DATA_TABLES 는 "실DB user-scoped 테이블의
 * 손복사본"이다. CI(erasure-coverage.test.ts)는 실DB에 접속할 수 없으므로
 * 두 방향 중 하나만 오프라인으로 막을 수 있다:
 *
 *   ✅ 마이그레이션에 있는데 목록에 없음  → erasure-coverage.test.ts 가 기계로 잡음
 *   ❌ 목록에 있는데 실DB에 없음          → CI가 구조적으로 못 봄. 이 스크립트의 몫.
 *
 * 두 번째가 왜 위험한가 (2026-07-28 실사례): deep_judgment_usage 가 목록에 올라간 채
 * 마이그레이션이 프로덕션에 적용되지 않아, /api/account/delete 의 루프가 PostgREST
 * "relation does not exist" 에러를 받고 hadError=true → **auth 신원 삭제가 통째로
 * 차단**됐다. 사용자는 500을 받고 계정이 남는다. 게다가 목록에 없는 테이블
 * (mcp_account_authorizations 등)은 신원 삭제의 CASCADE 에 의존하므로, 그 CASCADE
 * 조차 영영 발화하지 않는다. 목록의 거짓 항목 하나가 삭제 전체를 멈춘다.
 *
 * 사용법:
 *   1) Supabase MCP 로 아래 SQL 을 실행하고 결과를 JSON 파일로 저장한다.
 *
 *        SELECT c.table_name
 *        FROM information_schema.columns c
 *        JOIN information_schema.tables t
 *          ON t.table_schema='public' AND t.table_name=c.table_name
 *         AND t.table_type='BASE TABLE'
 *        WHERE c.table_schema='public' AND c.column_name='user_id'
 *        ORDER BY 1;
 *
 *   2) node scripts/check-erasure-coverage.mjs <그 JSON 경로>
 *
 * 출력:
 *   🔴 목록에만 있고 실DB엔 없음  = 계정 삭제가 500으로 멈춘다 — 위험, 즉시 고쳐라
 *   🟡 실DB에만 있고 목록 누락    = 그 테이블은 내보내기에서 빠진다 — 갱신 권장
 *   exit 1 if 🔴 or 구조 오류, else 0
 */
import { readFileSync } from 'node:fs';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('사용법: node scripts/check-erasure-coverage.mjs <execute_sql-결과.json>');
  process.exit(2);
}

// MCP 결과는 [{ type:'text', text:'<JSON 문자열>' }] (이중 인코딩)이거나 그냥 배열일
// 수 있고, {result:'...<untrusted-data-…>[…]</…>…'} 래퍼로 올 수도 있다 — 전부 받는다.
function parsePayload(raw) {
  if (typeof raw === 'string') {
    const fenced = raw.match(/\[[\s\S]*\]/);
    if (!fenced) throw new Error('JSON 배열을 찾지 못했다');
    return JSON.parse(fenced[0]);
  }
  if (Array.isArray(raw)) {
    return raw[0]?.text ? parsePayload(raw[0].text) : raw;
  }
  if (raw && typeof raw === 'object') {
    if (typeof raw.result === 'string') return parsePayload(raw.result);
    if (Array.isArray(raw.rows)) return raw.rows;
  }
  throw new Error('알 수 없는 입력 형태');
}

let rows;
try {
  rows = parsePayload(JSON.parse(readFileSync(jsonPath, 'utf8')));
} catch {
  // 파일이 순수 JSON이 아니라 MCP 응답 텍스트 그대로일 수도 있다.
  rows = parsePayload(readFileSync(jsonPath, 'utf8'));
}

const live = new Set(
  rows.map((r) => (typeof r === 'string' ? r : r.table_name ?? r.name)).filter(Boolean),
);
if (!live.size) {
  console.error('❌ 입력에서 테이블을 하나도 읽지 못했다 — SQL 결과가 맞는지 확인하라');
  process.exit(2);
}

// user-data-tables.ts 에서 목록을 읽는다 (TS import 없이 소스 파싱 — 스크립트는 node 전용).
const src = readFileSync(new URL('../src/lib/user-data-tables.ts', import.meta.url), 'utf8');
const block = src.slice(src.indexOf('export const USER_DATA_TABLES'), src.indexOf('] as const'));
const listed = [...block.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
if (listed.length < 20) {
  console.error(`❌ USER_DATA_TABLES 파싱 실패 (${listed.length}개만 읽힘)`);
  process.exit(2);
}

const listedOnly = listed.filter((t) => !live.has(t));
const liveOnly = [...live].filter((t) => !listed.includes(t)).sort();

for (const t of listedOnly) {
  console.log(`🔴 ${t}: 목록에 있으나 실DB에 없음 — 계정 삭제가 이 테이블에서 500으로 멈춘다`);
}
for (const t of liveOnly) {
  console.log(`🟡 ${t}: 실DB에 있으나 목록 누락 — 내보내기에서 빠지고, 삭제는 CASCADE 운에 맡겨진다`);
}

console.log(
  `\n대조: 실DB user-scoped ${live.size}개 / 목록 ${listed.length}개`
  + (listedOnly.length ? `\n=== 🔴 위험 ${listedOnly.length}건 — 고쳐라 ===` : '\n=== 🔴 위험 0건 ==='),
);
process.exit(listedOnly.length ? 1 : 0);
