/**
 * 스키마 드리프트 온디맨드 대조 — 마이그레이션 후 실행.
 *
 * src/lib/__tests__/schema-drift.test.ts 의 TABLE_COLUMNS 는 "실DB 컬럼의
 * 손복사본"이다. 테스트(CI)는 실DB에 접속하면 안 되므로(오프라인·service key
 * 노출 금지) 그 손복사본이 *실DB와 실제로 맞는지*는 이 스크립트로 대조한다.
 * 손복사본이 실DB와 어긋나면 PGRST204(행 전체 거부) 부류를 가드가 못 잡는다.
 *
 * 사용법:
 *   1) Claude/Supabase MCP 로 list_tables(verbose, schema=public) 결과를
 *      JSON 파일로 저장한다. (Argus의 Supabase public 스키마 대상)
 *   2) node scripts/check-schema-drift.mjs <그 JSON 경로>
 *
 * 출력:
 *   🔴 매니페스트에만 있고 실DB엔 없음  = 거짓 안전(가드가 못 막음) — 위험, 고쳐라
 *   🟡 실DB에만 있고 매니페스트 누락     = 가드 과엄격(신규 필드가 막힘) — 갱신 권장
 *   exit 1 if 🔴 or 구조 오류, else 0
 */
import { readFileSync } from 'node:fs';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('사용법: node scripts/check-schema-drift.mjs <list_tables-결과.json>');
  process.exit(2);
}

// MCP list_tables 결과는 [{ type:'text', text:'<JSON 문자열>' }] 형태(이중 인코딩)거나
// 직접 {tables:[...]} 일 수 있다 — 둘 다 받는다.
const rawFile = JSON.parse(readFileSync(jsonPath, 'utf8'));
const payload = Array.isArray(rawFile) && rawFile[0]?.text
  ? JSON.parse(rawFile[0].text)
  : rawFile;

const db = {};
for (const t of payload.tables ?? []) {
  db[t.name.replace(/^public\./, '')] = new Set(t.columns.map((c) => c.name));
}

const src = readFileSync(new URL('../src/lib/__tests__/schema-drift.test.ts', import.meta.url), 'utf8');
const block = src.slice(src.indexOf('const TABLE_COLUMNS'), src.indexOf('const LOCAL_ONLY'));
const man = {};
for (const m of block.matchAll(/(\w+):\s*\[([\s\S]*?)\]/g)) {
  man[m[1]] = new Set([...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

// schema-drift.test.ts 가 검증하는 동기화 테이블 목록과 동일하게 유지.
const SYNC = [
  'projects', 'personas', 'reframe_items', 'recast_items', 'synthesize_items',
  'plugin_decisions', 'plugin_bearings', 'agents', 'agent_chains', 'agent_activities',
  'feedback_records', 'judgment_records', 'accuracy_ratings', 'quality_signals',
  'outcome_records', 'retrospective_answers', 'decision_quality_scores',
];

let danger = 0;
for (const t of SYNC) {
  if (!db[t]) { console.log(`❌ ${t}: 실DB에 테이블 없음`); danger++; continue; }
  if (!man[t]) { console.log(`❌ ${t}: 매니페스트에 없음`); danger++; continue; }
  const manOnly = [...man[t]].filter((c) => !db[t].has(c));
  const dbOnly = [...db[t]].filter((c) => !man[t].has(c));
  if (manOnly.length) { console.log(`🔴 ${t}: 매니페스트에만(실DB엔 없음) = ${manOnly.join(', ')}`); danger++; }
  if (dbOnly.length) { console.log(`🟡 ${t}: 실DB에만(매니페스트 누락) = ${dbOnly.join(', ')}`); }
}

console.log(danger ? `\n=== 위험(🔴/❌) ${danger}건 — 고쳐라 ===` : '\n=== 🔴 위험 0건 — 손복사본이 실DB와 일치 ===');
process.exit(danger ? 1 : 0);
