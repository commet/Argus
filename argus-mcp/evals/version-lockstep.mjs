/**
 * ONE RELEASE, FIVE FILES THAT MUST AGREE.
 *
 *   node evals/version-lockstep.mjs
 *
 * WHY (2026-07-28). A release moves the server version in five hand-kept
 * places, and nothing compared them:
 *
 *   argus-mcp/package.json              what npm publishes
 *   argus-mcp/server.json               what the MCP registry records
 *   argus-plugin-v2/.mcp.json           the `npx argus-decision-mcp@X` PIN
 *   argus-plugin-v2/.claude-plugin/…    the plugin's own version
 *   .claude-plugin/marketplace.json     twice, in two objects
 *
 * The pin is the dangerous one. If it lags, every user of the new plugin keeps
 * launching the OLD server — silently, because both halves are internally
 * consistent and nothing errors. That is how a fix can be written, tested,
 * merged and published while every real user still runs the version without it.
 *
 * The plugin version and the server version move together by convention here
 * (3.0.4 ⇄ 2.0.4: same patch line), so the check is: all three server-version
 * files identical, both marketplace entries identical to the plugin manifest,
 * and the pin equal to the published package version.
 *
 * Exit non-zero on any mismatch. CI gate, costs milliseconds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const violations = [];
let checks = 0;
const ok = (id, cond, detail) => {
  checks++;
  if (!cond) violations.push(`${id}: ${detail}`);
};

const pkg = read('argus-mcp/package.json');
const server = read('argus-mcp/server.json');
const plugin = read('argus-plugin-v2/.claude-plugin/plugin.json');
const mcpJson = read('argus-plugin-v2/.mcp.json');
const market = read('.claude-plugin/marketplace.json');

const SERVER_V = pkg.version;
ok('V1 server.json = package.json', server.version === SERVER_V, `${server.version} vs ${SERVER_V}`);

// server.json carries the version twice (top level + the package entry)
for (const [i, p] of (server.packages ?? []).entries()) {
  ok(`V2 server.json packages[${i}].version`, p.version === SERVER_V, `${p.version} vs ${SERVER_V}`);
  if (p.identifier) ok(`V2 server.json packages[${i}].identifier`, p.identifier === pkg.name, `${p.identifier} vs ${pkg.name}`);
}

// THE PIN — the one that decides which server a real user actually runs
const spec = (mcpJson.mcpServers?.['argus-decision']?.args ?? []).find(
  (a) => typeof a === 'string' && a.startsWith(`${pkg.name}@`));
ok('V3 .mcp.json이 서버를 핀으로 잡는다', typeof spec === 'string', JSON.stringify(mcpJson.mcpServers));
if (spec) {
  const pinned = spec.slice(pkg.name.length + 1);
  ok('V3 핀 = 배포되는 버전', pinned === SERVER_V,
    `플러그인이 ${pinned}을 띄우는데 배포되는 것은 ${SERVER_V} — 사용자는 고친 것을 못 받습니다`);
  ok('V3 핀이 범위가 아니라 정확한 버전', /^\d+\.\d+\.\d+$/.test(pinned), pinned);
}

// the marketplace speaks for the plugin in two places
ok('V4 marketplace.metadata = plugin.json', market.metadata?.version === plugin.version,
  `${market.metadata?.version} vs ${plugin.version}`);
for (const [i, p] of (market.plugins ?? []).entries()) {
  ok(`V4 marketplace.plugins[${i}].version`, p.version === plugin.version, `${p.version} vs ${plugin.version}`);
}

// convention: the plugin's patch line tracks the server's
const patch = (v) => v.split('.').slice(1).join('.');
ok('V5 플러그인과 서버가 같은 패치 라인', patch(plugin.version) === patch(SERVER_V),
  `플러그인 ${plugin.version} / 서버 ${SERVER_V}`);

/**
 * V6 — 문서에 적힌 핀. 다섯 파일이 서로 일치해도, 사람이 복사하는 줄이 틀리면
 * 그 사람에게 제품은 없다.
 *
 * 2026-07-29에 실제로 그랬다: README의 설치 블록이 `argus-decision-mcp@2.0.0`을
 * 시키고 있었는데 2.0.0은 **npm에 올라간 적이 없다.** 그대로 따라 하면
 * `No matching version found`로 서버가 아예 뜨지 않는다 — 손으로 설정하는 모든
 * 사용자(Codex 포함)의 정문이 그 줄이다. 이 게이트가 다섯 곳만 보고 문서를 안
 * 봤기 때문에 조용히 흘렀다.
 */
const DOC_PINS = ['argus-mcp/README.md'];
const pinRe = new RegExp(`${pkg.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}@([0-9]+\\.[0-9]+\\.[0-9]+|[^\\s"'\`)\\]]+)`, 'g');
for (const rel of DOC_PINS) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const found = [...text.matchAll(pinRe)].map((m) => m[1]);
  ok(`V6 ${rel}에 설치 핀이 있다`, found.length > 0, '설치 예시에 버전 핀이 없다');
  for (const v of new Set(found)) {
    ok(`V6 ${rel} 핀 ${v} = 배포 버전`, v === SERVER_V,
      `문서가 ${v}을 시키는데 배포되는 것은 ${SERVER_V} — 이 줄을 복사한 사람은 다른 서버를 받거나(구버전) 아무것도 못 받습니다(미발행)`);
  }
}

const label = `${checks} checks · ${violations.length} violations`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log(`✅ ${label} — 서버 ${SERVER_V} · 플러그인 ${plugin.version}, 다섯 파일 + 문서의 설치 핀이 일치합니다.`);
