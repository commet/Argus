#!/usr/bin/env node
/**
 * 도달성 래칫 — 진입점에서 못 닿는 소스 파일이 **늘지 않게** 막는다.
 *
 * 왜 필요했나 (2026-08-19): 아무도 이걸 재고 있지 않아서 앱 존에 13,697줄,
 * MIT 존에 1,400줄이 조용히 쌓였다. 커버리지 래칫과 같은 방식으로 잠근다 —
 * 기준선(`reachability-baseline.json`)보다 늘면 실패, 줄면 갱신하라고 말한다.
 *
 * 이 스크립트를 만들다 두 번 틀렸고, 그 둘이 여기 설계로 들어가 있다:
 *
 *  1. **Next 규약 파일은 최상위에도 있다.** `src/app/opengraph-image.tsx` 를
 *     죽었다고 판정했었다. ROOT_PATTERNS 가 `app/` 바로 밑도 본다.
 *  2. **존 경계를 넘는 소비가 있다.** 웹 앱의 `src/lib/decision-kernel.ts` 가
 *     `argus-mcp/dist/v3/reducer.js` 를 쓴다. MCP 서버 진입점만 루트로 잡으면
 *     v3 전체(1,600줄)가 죽은 것으로 보이고, 지웠으면 웹 빌드가 죽었다.
 *     그래서 **다른 존에서 들어오는 import 도 루트로 넣는다.**
 *
 * 도달 불가 ≠ 삭제 대상이다. 창업자 봉인이 존치를 명시한 것(`src/lib/cognition/`)
 * 도 여기 잡힌다. 이 게이트가 말하는 것은 "늘었다" 하나뿐이고, 무엇을 지울지는
 * `docs/ARGUS-MAP-2026-08-19.md` 가 판정한다.
 *
 *   node scripts/check-reachability.mjs            # 검사 (CI)
 *   node scripts/check-reachability.mjs --update   # 기준선 갱신 (줄었을 때만)
 *   node scripts/check-reachability.mjs --list     # 현재 도달 불가 전체 출력
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(REPO, 'scripts', 'reachability-baseline.json');

/** 검사하는 존. `roots` 는 그 존 자체의 진입점 정규식. */
const ZONES = [
  {
    name: 'app',
    dir: 'src',
    exts: /\.(ts|tsx)$/,
    roots: [
      // Next App Router 규약 파일. `app/` 바로 밑에도 하위 라우트에도 똑같이 있다 —
      // 두 목록으로 쓰면 반드시 갈라진다 (실수 1·3이 정확히 그것이었다). 하나로 쓴다.
      /^src\/app\/(?:.*\/)?(page|layout|route|template|error|loading|not-found|default|global-error|sitemap|robots|opengraph-image|twitter-image|icon|apple-icon|manifest)\.tsx?$/,
      /^src\/(proxy|middleware|instrumentation)\.ts$/,
    ],
  },
  {
    name: 'mcp',
    dir: 'argus-mcp/src',
    exts: /\.ts$/,
    roots: [
      /^argus-mcp\/src\/(index|server|cli)\.ts$/,
      // vitest 설정이 부르는 것 — import 그래프에는 안 보인다
      /^argus-mcp\/src\/test-(setup|global-setup)\.ts$/,
    ],
  },
];

const isTest = (p) => /__tests__|\.test\.tsx?$|\.spec\.tsx?$|test-helpers|fixtures?\//.test(p);

/**
 * 앰비언트 타입 선언은 import 되지 않는다 — tsconfig 의 include 가 집는다.
 * 도달성으로 재면 언제나 "죽은" 것으로 보이는데, 그건 이 도구의 눈이 닿지 않는
 * 것이지 죽은 게 아니다. (위양성 4호. 앞의 셋은 docs/ARGUS-MAP §0.)
 */
const isAmbient = (p) => /\.d\.ts$/.test(p);

function walk(dir, exts, out = []) {
  let entries;
  try { entries = fs.readdirSync(path.join(REPO, dir), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(rel, exts, out); }
    else if (exts.test(e.name)) out.push(rel);
  }
  return out;
}

/**
 * import 문자열을 저장소 상대 경로로 푼다.
 * `dist/` 를 가리키는 존 간 import 는 대응하는 `src/` 로 되돌린다 — 소비는
 * 빌드 산출물을 통해 일어나지만 살아 있는 것은 소스이기 때문이다.
 */
function resolveSpec(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.posix.join('src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  else return null;
  base = base.replace(/\.js$/, '');
  base = base.replace(/^argus-mcp\/dist\//, 'argus-mcp/src/');
  for (const c of [base + '.ts', base + '.tsx', path.posix.join(base, 'index.ts'), path.posix.join(base, 'index.tsx'), base]) {
    try { if (fs.statSync(path.join(REPO, c)).isFile()) return c; } catch { /* 다음 후보 */ }
  }
  return null;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

// ── 전 존의 파일과 간선을 한 번에 만든다 (존 간 소비를 보려면 통합 그래프가 필요) ──
const allFiles = [];
for (const z of ZONES) allFiles.push(...walk(z.dir, z.exts));
const fileSet = new Set(allFiles);

const edges = new Map();
for (const f of allFiles) {
  const src = fs.readFileSync(path.join(REPO, f), 'utf8');
  const out = new Set();
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) {
    const r = resolveSpec(f, m[1] || m[2] || m[3]);
    if (r && fileSet.has(r)) out.add(r);
  }
  edges.set(f, out);
}

const zoneOf = (f) => ZONES.find((z) => f.startsWith(z.dir + '/'))?.name;

function unreachableIn(zone) {
  const own = allFiles.filter((f) => zoneOf(f) === zone.name);
  const roots = new Set(own.filter((f) => zone.roots.some((r) => r.test(f))));

  // 실수 2: 다른 존(테스트 아닌 파일)에서 들어오는 import 도 진입점이다.
  for (const f of allFiles) {
    if (zoneOf(f) === zone.name || isTest(f)) continue;
    for (const n of edges.get(f) || []) if (zoneOf(n) === zone.name) roots.add(n);
  }

  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const n of edges.get(f) || []) if (!seen.has(n)) stack.push(n);
  }
  return own.filter((f) => !isTest(f) && !isAmbient(f) && !seen.has(f)).sort();
}

const current = {};
for (const z of ZONES) current[z.name] = unreachableIn(z);

const lines = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').split('\n').length;

if (process.argv.includes('--list')) {
  for (const z of ZONES) {
    const list = current[z.name];
    console.log(`\n═══ ${z.name} — 도달 불가 ${list.length}파일 / ${list.reduce((s, p) => s + lines(p), 0)}줄 ═══`);
    for (const p of list.map((p) => ({ p, l: lines(p) })).sort((a, b) => b.l - a.l)) {
      console.log(String(p.l).padStart(6), p.p);
    }
  }
  process.exit(0);
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  for (const z of ZONES) console.log(`${z.name}: ${current[z.name].length}파일 기준선 기록`);
  process.exit(0);
}

let baseline;
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); }
catch {
  console.error('기준선이 없다. `node scripts/check-reachability.mjs --update` 로 만든다.');
  process.exit(2);
}

let failed = false;
for (const z of ZONES) {
  const was = new Set(baseline[z.name] || []);
  const now = current[z.name];
  const added = now.filter((p) => !was.has(p));
  const gone = [...was].filter((p) => !now.includes(p));

  if (added.length) {
    failed = true;
    console.error(`\n❌ ${z.name}: 진입점에서 못 닿는 파일이 ${added.length}개 늘었다.`);
    for (const p of added) console.error(`   + ${p} (${lines(p)}줄)`);
    console.error(
      '\n   이 파일들은 지금 아무도 부르지 않는다. 셋 중 하나를 한다:\n' +
      '     (a) 소비처를 잇는다 — 만든 이유가 있었을 것이다\n' +
      '     (b) 지운다\n' +
      '     (c) 의도한 라이브러리라면 docs/ARGUS-MAP 에 근거를 적고 --update\n' +
      '   근거 없이 기준선만 올리지 않는다. 그러면 이 게이트는 없는 것과 같다.',
    );
  }
  if (gone.length) {
    console.log(`\n✅ ${z.name}: ${gone.length}개가 정리됐다. --update 로 기준선을 조인다.`);
    for (const p of gone) console.log(`   - ${p}`);
  }
  if (!added.length && !gone.length) {
    const l = now.reduce((s, p) => s + lines(p), 0);
    console.log(`✅ ${z.name}: 도달 불가 ${now.length}파일 / ${l}줄 — 기준선 그대로`);
  }
}

process.exit(failed ? 1 : 0);
