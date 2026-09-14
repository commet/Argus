#!/usr/bin/env node
/**
 * 런타임 순환 import 래칫 — 진짜 고리가 **늘지 않게** 막는다.
 *
 * 왜 이 게이트가 필요한가: 순환이 있으면 "누가 먼저인지" 읽어서 알 수 없다.
 * 그건 `docs/ARGUS-CORE.md` 가 세운 단 하나의 규칙 — *위는 아래를 알고 아래는
 * 위를 모른다* — 이 그 자리에서 깨졌다는 뜻이다.
 *
 * **타입 순환과 런타임 순환을 반드시 가른다.** `import type {...}` 은 컴파일에서
 * 지워지므로 런타임 고리가 아니다. 2026-08-19 첫 측정에서 둘을 합쳐 세면 19개,
 * 가르면 3개였다 — 합쳐 세는 순간 숫자가 6배로 부풀고 아무도 그 목록을 안 본다.
 * 과장된 경보는 꺼진 경보와 같다.
 *
 *   node scripts/check-cycles.mjs            # 검사 (CI)
 *   node scripts/check-cycles.mjs --update   # 기준선 갱신 (줄었을 때만)
 *   node scripts/check-cycles.mjs --list     # 타입 순환까지 전부 출력
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(REPO, 'scripts', 'cycles-baseline.json');
const rel = (p) => path.relative(REPO, p).replace(/\\/g, '/');

const files = [];
(function walk(d) {
  let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of es) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|\.git|\.next|dist|coverage)$/.test(e.name)) walk(p); }
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) files.push(rel(p));
  }
})(REPO);

const keep = files.filter((p) => !p.startsWith('docs/'));
const src = new Map();
for (const p of keep) { try { src.set(p, fs.readFileSync(path.join(REPO, p), 'utf8')); } catch { /* 읽을 수 없으면 간선 없음 */ } }

function resolveSpec(from, spec) {
  let b;
  if (spec.startsWith('@/')) b = path.posix.join('src', spec.slice(2));
  else if (spec.startsWith('.')) b = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  b = b.replace(/\.js$/, '').replace(/^argus-mcp\/dist\//, 'argus-mcp/src/');
  for (const c of [b, b + '.ts', b + '.tsx', b + '.mjs', b + '.js',
                   b + '/index.ts', b + '/index.tsx', b + '/index.mjs', b + '/index.js']) {
    if (src.has(c)) return c;
  }
  return null;
}

const RE = /(?:^|\n)\s*(import|export)(\s+type)?\s([^;]*?)from\s*['"]([^'"]+)['"]/g;
const valueEdges = new Map();
const allEdges = new Map();
for (const p of keep) {
  const v = new Set(); const a = new Set(); let m; RE.lastIndex = 0;
  while ((m = RE.exec(src.get(p) || ''))) {
    const r = resolveSpec(p, m[4]);
    if (!r) continue;
    a.add(r);
    // `import type X` 와 `import { type X }` 는 지워진다. 섞인 형태
    // (`import { type A, b }`)는 값을 가져오므로 보수적으로 값으로 센다.
    const typeOnly = !!m[2] || /^\s*\{\s*type\s[^,}]*\}\s*$/.test(m[3]);
    if (!typeOnly) v.add(r);
  }
  valueEdges.set(p, v);
  allEdges.set(p, a);
}

function findCycles(graph) {
  const out = []; const color = new Map(); const stack = [];
  const dfs = (u) => {
    color.set(u, 1); stack.push(u);
    for (const v of graph.get(u) || []) {
      if (color.get(v) === 1) { const i = stack.indexOf(v); out.push(stack.slice(i).concat(v)); }
      else if (!color.has(v)) dfs(v);
    }
    stack.pop(); color.set(u, 2);
  };
  for (const p of keep) if (!color.has(p)) dfs(p);
  return out;
}

/** 고리를 진입 순서와 무관한 이름으로 — 같은 고리를 두 번 세지 않는다. */
const keyOf = (cycle) => {
  const ring = cycle.slice(0, -1);
  const i = ring.indexOf([...ring].sort()[0]);
  return ring.slice(i).concat(ring.slice(0, i)).join(' → ');
};

const runtime = [...new Set(findCycles(valueEdges).map(keyOf))].sort();

if (process.argv.includes('--list')) {
  const typed = [...new Set(findCycles(allEdges).map(keyOf))].sort();
  console.log(`런타임(값) 순환 ${runtime.length} · 타입 포함 ${typed.length}\n`);
  console.log('── 런타임 ──');
  for (const c of runtime) console.log('  ' + c);
  console.log('\n── 타입만 (컴파일에서 지워진다, 참고용) ──');
  for (const c of typed.filter((t) => !runtime.includes(t))) console.log('  ' + c);
  process.exit(0);
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify({ runtime }, null, 2) + '\n');
  console.log(`런타임 순환 ${runtime.length}개 기준선 기록`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
catch {
  console.error('기준선이 없다. `node scripts/check-cycles.mjs --update` 로 만든다.');
  process.exit(2);
}

const was = new Set(baseline.runtime || []);
const added = runtime.filter((c) => !was.has(c));
const gone = [...was].filter((c) => !runtime.includes(c));

if (added.length) {
  console.error(`\n❌ 런타임 순환 import 가 ${added.length}개 늘었다.\n`);
  for (const c of added) console.error('   + ' + c);
  console.error(
    '\n   순환이 있으면 "누가 먼저인지"를 읽어서 알 수 없다 — docs/ARGUS-CORE.md §2\n' +
    '   의 단 하나의 규칙(위는 아래를 알고 아래는 위를 모른다)이 그 자리에서 깨진다.\n' +
    '   고치는 법: 공유하는 것을 아래층 모듈로 빼거나, 타입만 필요하면\n' +
    '   `import type` 으로 바꾼다 (그건 컴파일에서 지워지므로 고리가 아니다).',
  );
  process.exit(1);
}
if (gone.length) {
  console.log(`\n✅ 런타임 순환 ${gone.length}개가 풀렸다. --update 로 기준선을 조인다.`);
  for (const c of gone) console.log('   - ' + c);
} else {
  console.log(`✅ 런타임 순환 ${runtime.length}개 — 기준선 그대로`);
}
process.exit(0);
