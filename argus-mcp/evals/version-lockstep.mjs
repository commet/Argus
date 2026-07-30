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

// WHICH SERVER A REAL USER ACTUALLY RUNS.
//
// This check used to demand an EXACT PIN, and the reasoning was sound at the
// time: a plugin that names `@^1` launched a build from twelve days earlier
// while every repo gate stayed green, so the fix was to name one immutable
// version. The cost of that fix was that the version froze there until a person
// edited it — and on 2026-07-29 the founder's Codex and the plugin were pinned
// to two DIFFERENT versions, neither of them the current release.
//
// The premise was then measured rather than argued. Same spec string twice,
// with the npx cache holding an older build that the spec still allowed:
//
//     argus-decision-mcp           → launched the current release
//     argus-decision-mcp@^2.0.0    → launched the stale cached build
//
// So a RANGE freezes and a BARE NAME does not: npx must resolve a bare name
// against the registry, while a range is satisfied by whatever is already in
// the cache. The original incident was a range, and pinning fixed it by
// accident — dropping the version entirely fixes it on purpose, and installs
// stop needing maintenance.
//
// Hence the inversion: no version at all, and a range is now the failure.
const spec = (mcpJson.mcpServers?.['argus-decision']?.args ?? []).find(
  (a) => typeof a === 'string' && a.includes(pkg.name));
ok('V3 .mcp.json이 서버를 띄운다', typeof spec === 'string', JSON.stringify(mcpJson.mcpServers));
if (spec) {
  const versioned = new RegExp(`${escapedPackage}@([^\\s"'()\`\\]]+)`).exec(spec)?.[1] ?? '';
  ok('V3 플러그인이 버전을 박지 않는다 (설치 한 번으로 계속 최신)',
    versioned === '',
    `${versioned}에 고정돼 있다 — 이 플러그인을 깐 사람은 새 서버를 영영 못 받는다`);
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
// The command a person COPIES is its own failure surface, independent of the
// manifests. It has been wrong twice in different ways: it once named an
// unpublished 2.0.0 (`No matching version found` — the front door, dead, for
// every hand-configured host), and it later named a real version that went
// stale the moment the next release shipped.
//
// Same inversion as V3, and for the same measured reason. Install lines carry
// no version; a range in one is a hard failure because it is the form that
// silently freezes.
const DOC_LINES = ['argus-mcp/README.md'];
const specRe = new RegExp(`${escapedPackage}@([^\\s"'()\`\\]]+)`, 'g');
for (const rel of DOC_LINES) {
  const body = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  // The prose deliberately shows `@^2.0.0` and `@2.0.12` as the two forms NOT to
  // use, so only look at lines a reader would copy: fenced commands and JSON args.
  const copyable = body.split('\n').filter((l) => /^(codex mcp add|npx |claude mcp add)/.test(l.trim())
    || /"args"\s*:/.test(l));
  const found = copyable.flatMap((l) => [...l.matchAll(specRe)].map((m) => m[1]));
  ok(`V6 ${rel} 설치 줄에 버전이 없다`, found.length === 0,
    `복사되는 줄이 ${found.join(' · ')}에 고정한다 — 따라 한 사람은 거기서 멈춘다`);
}

const label = `${checks} checks · ${violations.length} violations`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log(`✅ ${label} — 서버 ${SERVER_V} · 플러그인 ${plugin.version}, manifest와 공개 설치 핀이 일치합니다.`);
