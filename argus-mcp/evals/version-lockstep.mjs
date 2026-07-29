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
const lock = read('argus-mcp/package-lock.json');
const server = read('argus-mcp/server.json');
const plugin = read('argus-plugin-v2/.claude-plugin/plugin.json');
const mcpJson = read('argus-plugin-v2/.mcp.json');
const market = read('.claude-plugin/marketplace.json');

const SERVER_V = pkg.version;
const escapedPackage = pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
ok('V0 package-lock root = package.json', lock.version === SERVER_V, `${lock.version} vs ${SERVER_V}`);
ok('V0 package-lock package = package.json', lock.packages?.['']?.version === SERVER_V,
  `${lock.packages?.['']?.version} vs ${SERVER_V}`);
ok('V1 server.json = package.json', server.version === SERVER_V, `${server.version} vs ${SERVER_V}`);

// server.json carries the version twice (top level + the package entry)
for (const [i, p] of (server.packages ?? []).entries()) {
  ok(`V2 server.json packages[${i}].version`, p.version === SERVER_V, `${p.version} vs ${SERVER_V}`);
  if (p.identifier) ok(`V2 server.json packages[${i}].identifier`, p.identifier === pkg.name, `${p.identifier} vs ${pkg.name}`);
}

// THE PIN — the one that decides which server a real user actually runs
const spec = (mcpJson.mcpServers?.['argus-decision']?.args ?? []).find(
  (a) => typeof a === 'string' && a.includes(`${pkg.name}@`));
ok('V3 .mcp.json이 서버를 핀으로 잡는다', typeof spec === 'string', JSON.stringify(mcpJson.mcpServers));
if (spec) {
  const pinned = new RegExp(`${escapedPackage}@(\\d+\\.\\d+\\.\\d+)`).exec(spec)?.[1] ?? '';
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

// Plugin-only UX cleanup must not force an unrelated npm release. The two
// products have independent semver lines; their contract is the exact MCP pin,
// already checked above, plus internally consistent marketplace metadata.
ok('V5 plugin version is clean semver', /^\d+\.\d+\.\d+$/.test(plugin.version), plugin.version);

// The manifests can agree while the command a person copies still launches an
// old or nonexistent server. Keep the public install pin in the same gate.
const DOC_PINS = ['argus-mcp/README.md'];
const pinRe = new RegExp(`${escapedPackage}@([^\\s"'()\`\\]]+)`, 'g');
for (const rel of DOC_PINS) {
  const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const found = [...body.matchAll(pinRe)].map((match) => match[1]);
  ok(`V6 ${rel}에 설치 핀이 있다`, found.length > 0, '설치 예시에 버전 핀이 없다');
  for (const version of new Set(found)) {
    ok(`V6 ${rel} 핀 ${version} = 배포 버전`, version === SERVER_V,
      `문서 ${version} vs 배포 ${SERVER_V}`);
  }
}

const label = `${checks} checks · ${violations.length} violations`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log(`✅ ${label} — 서버 ${SERVER_V} · 플러그인 ${plugin.version}, manifest와 공개 설치 핀이 일치합니다.`);
