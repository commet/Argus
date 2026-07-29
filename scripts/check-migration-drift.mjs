/**
 * 마이그레이션 ↔ 실DB 온디맨드 대조 — 배포 후·마이그레이션 후 실행.
 * (check-erasure-coverage.mjs / check-schema-drift.mjs 의 자매 스크립트, 같은 규약.)
 *
 * 막는 부류: **`supabase/migrations/` 에 파일이 있다 ≠ 프로덕션에 적용됐다.**
 * CI는 실DB에 접속할 수 없으므로 이 방향을 구조적으로 못 본다. 파일은 리포에 있고,
 * 테스트는 파일을 읽어 초록이 나고, 실DB에는 그 객체가 없다 — 세 곳이 서로를 확인해
 * 주지 않는다.
 *
 * 실사례 2건:
 *   - `deep_judgment_usage` (2026-07-27~28): 표가 목록에만 있고 실DB에 없어
 *     /api/account/delete 가 모든 사용자에게 500. 계정 삭제 전체가 멈췄다.
 *   - `record_share_if_allowed` (2026-07-11~29, **18일**): 공유 레이트리미터 RPC가
 *     실DB에 없어 `recordAndCheckShare` 가 503으로 fail-closed. 공유 링크·이메일·
 *     텔레그램·팀 초대 **4개 표면이 전부 죽어 있었고**, 코드도 테스트도 정상이었다.
 *     (fail-closed 자체는 옳은 설계다 — 문제는 그 상태가 아무에게도 안 보였다는 것.)
 *
 * 사용법:
 *   1) `node scripts/check-migration-drift.mjs --sql` 로 대조용 SQL을 출력해
 *      Supabase MCP(execute_sql)로 실행하고 결과를 JSON 파일로 저장한다.
 *   2) `node scripts/check-migration-drift.mjs <그 JSON 경로>`
 *
 * 출력:
 *   🔴 마이그레이션이 선언했는데 실DB에 없음 = 그 기능은 지금 죽어 있다 — 즉시 적용
 *   🟡 실DB에만 있고 마이그레이션에 없음     = 대시보드로 직접 만든 것 — 파일로 내려라
 *   exit 1 if 🔴 or 구조 오류, else 0
 *
 * 한계(정직하게): 이 스크립트는 **객체의 존재**만 본다. 같은 이름의 함수 본문이
 * 리포와 실DB에서 갈라진 경우(예: 대시보드에서 직접 수정)는 못 본다. 정책(RLS)도
 * 이름 대조만 하며 조건식은 보지 않는다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'supabase/migrations');

/** 마이그레이션이 선언하는 테이블·함수 이름을 모은다 (주석 제거 후). */
function declared() {
  const tables = new Set();
  const functions = new Set();
  const policies = new Set(); // "table.policy"
  const dropped = new Set();

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8').replace(/--[^\n]*/g, '');
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?/gi)) {
      tables.add(m[1]);
    }
    for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)/gi)) {
      functions.add(m[1]);
    }
    // Policies matter as much as functions: the 2026-07-19 team migration exists to
    // REPLACE permissive dashboard-era policies with an audited set. If only the
    // tables landed, authz silently stays on the old rules and nothing looks wrong.
    for (const m of sql.matchAll(/CREATE\s+POLICY\s+"?(\w+)"?\s+ON\s+(?:public\.)?"?(\w+)"?/gi)) {
      policies.add(`${m[2]}.${m[1]}`);
    }
    for (const m of sql.matchAll(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?\s+ON\s+(?:public\.)?"?(\w+)"?/gi)) {
      dropped.add(`${m[2]}.${m[1]}`);
    }
    for (const m of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?/gi)) {
      dropped.add(m[1]);
    }
    for (const m of sql.matchAll(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)/gi)) {
      dropped.add(m[1]);
    }
  }
  return {
    tables: [...tables].filter((t) => !dropped.has(t)).sort(),
    functions: [...functions].filter((f) => !dropped.has(f)).sort(),
    // A policy dropped by a LATER migration than the one that created it is fine;
    // this coarse filter only removes ones dropped anywhere. Coarse on purpose —
    // a false 🔴 costs a look, a false ✅ costs a silent authz gap.
    policies: [...policies].filter((p) => !dropped.has(p)).sort(),
  };
}

const SQL = `-- check-migration-drift.mjs 대조용. 결과를 JSON으로 저장해 스크립트에 넘겨라.
SELECT 'table' AS kind, table_name AS name
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'function', p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
UNION ALL
SELECT 'policy', tablename || '.' || policyname
  FROM pg_policies WHERE schemaname = 'public'
 ORDER BY 1, 2;`;

if (process.argv[2] === '--sql') {
  console.log(SQL);
  process.exit(0);
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('사용법: node scripts/check-migration-drift.mjs <execute_sql-결과.json>');
  console.error('        node scripts/check-migration-drift.mjs --sql   (대조용 SQL 출력)');
  process.exit(2);
}

// MCP 결과는 [{ type:'text', text:'<JSON 문자열>' }] (이중 인코딩)이거나 그냥 배열이다.
function parseLive(raw) {
  let data = JSON.parse(raw);
  if (Array.isArray(data) && data[0] && typeof data[0].text === 'string') {
    const inner = data[0].text.match(/\[[\s\S]*\]/);
    if (!inner) throw new Error('MCP 결과 안에서 JSON 배열을 찾지 못했다');
    data = JSON.parse(inner[0]);
  }
  if (typeof data === 'string') data = JSON.parse(data);
  if (!Array.isArray(data)) throw new Error('배열이 아니다');
  return data;
}

let live;
try {
  live = parseLive(readFileSync(jsonPath, 'utf8'));
} catch (err) {
  console.error(`🔴 결과 JSON을 읽지 못했다: ${err.message}`);
  process.exit(2);
}

const liveTables = new Set(live.filter((r) => r.kind === 'table').map((r) => r.name));
const liveFunctions = new Set(live.filter((r) => r.kind === 'function').map((r) => r.name));
const livePolicies = new Set(live.filter((r) => r.kind === 'policy').map((r) => r.name));

if (liveTables.size === 0 || liveFunctions.size === 0) {
  console.error('🔴 실DB 결과가 비어 있다 — 잘못된 SQL이거나 잘못된 파일. 빈손 통과를 막는다.');
  process.exit(2);
}

const d = declared();
const missingTables = d.tables.filter((t) => !liveTables.has(t));
const missingFunctions = d.functions.filter((f) => !liveFunctions.has(f));
const missingPolicies = livePolicies.size ? d.policies.filter((p) => !livePolicies.has(p)) : [];

console.log(`마이그레이션 선언: 표 ${d.tables.length}개 · 함수 ${d.functions.length}개 · 정책 ${d.policies.length}개`);
console.log(`실DB:              표 ${liveTables.size}개 · 함수 ${liveFunctions.size}개 · 정책 ${livePolicies.size}개`);
if (!livePolicies.size) console.log('(정책 대조 건너뜀 — 결과 JSON에 policy 행이 없다. --sql 을 다시 받아 실행하라)');
console.log('');

let risky = 0;
for (const t of missingTables) {
  console.log(`🔴 표 미적용: ${t} — 이 표를 읽는 모든 코드가 "relation does not exist"를 받는다`);
  risky++;
}
for (const f of missingFunctions) {
  console.log(`🔴 함수 미적용: ${f} — 이 RPC를 부르는 경로는 지금 실패한다(대개 조용히)`);
  risky++;
}
for (const p of missingPolicies) {
  console.log(`🔴 정책 미적용: ${p} — 이 표의 authz는 마이그레이션이 아니라 옛 규칙으로 돈다`);
  risky++;
}

if (!risky) console.log('✅ 마이그레이션이 선언한 표·함수·정책이 전부 실DB에 있다.');
console.log('');
console.log('참고: 이 대조는 객체의 존재만 본다. 같은 이름의 함수 본문이 갈라진 경우와');
console.log('      RLS 정책의 조건식은 보지 않는다 — 그건 사람이 읽어야 한다.');

process.exit(risky ? 1 : 0);
