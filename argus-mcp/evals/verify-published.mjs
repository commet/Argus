/**
 * POST-PUBLISH: does the package a real user downloads carry the fix?
 *
 *   node evals/verify-published.mjs 2.0.4
 *
 * Run this after every release, before telling anyone it shipped.
 *
 * "The workflow said success" is the workflow's opinion about its own run. This
 * fetches the tarball from the registry the way `npx` would, installs what a
 * user's resolve would install, runs THAT server, and drives the interaction
 * that was broken three times: read a prediction, press Accept once, and check
 * the ledger actually holds it.
 *
 * It is deliberately checkable against a KNOWN-BAD release — the same script on
 * 2.0.2 fails four of its eight checks, including "확인창에 입력칸이 없다", which
 * is the defect itself. A post-publish check that cannot fail on the broken
 * build proves nothing about the good one.
 *
 * The BUNDLE_MARKERS below are release-specific: they name the fixes this
 * release is supposed to carry. Update them when the next release fixes
 * something new, or they quietly degrade into "the file is not empty".
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * What THIS release is supposed to contain, as symbols that survive bundling.
 * Keep it short and keep it current: each line is a fix someone was blocked by.
 * A marker that stops being meaningful should be replaced, not deleted, or this
 * check decays into "the bundle parsed".
 */
const BUNDLE_MARKERS = [
  ['10분 타임아웃이 담겨 있다 (2.0.4)', 'DECISION_ASK_TIMEOUT_MS'],
  ['이모지 폭 측정이 담겨 있다 (2.0.4)', 'Extended_Pictographic'],
  ['답한 시각 기록이 담겨 있다 (2.0.4)', 'answeredAt'],
  // 2.0.5 — provenance rides the seal event itself. Its absence is exactly how
  // 2.0.4 shipped: main carried the fix, the published build did not, and both
  // called themselves 2.0.4 because the version gate only compares version
  // strings to each other. This marker is what makes that visible next time.
  ["봉인 이벤트가 출처를 싣는다 (2.0.5)", /predicate_owner:\s*[A-Za-z0-9_$]*\[['"]predicate_owner['"]\]/],
  // npm 2.0.5 was cut before PR #318 merged. It has the provenance fix above,
  // but its elicitation adapter does not consult the host capability and is
  // therefore not the verified picker build. This exact branch is present in
  // 2.0.6 and absent from the immutable 2.0.5 tarball.
  ['host capability is checked before elicitation (2.0.6)', 'if (!_elicit || !canElicit())'],
];

const markerMatches = (bundle, marker) => (
  marker instanceof RegExp ? marker.test(bundle) : bundle.includes(marker)
);

// Catch an impossible marker before it can be misreported as a publish failure.
// A local dist is optional for post-publish use, but CI builds it first.
const localEntry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');
if (fs.existsSync(localEntry)) {
  const localBundle = fs.readFileSync(localEntry, 'utf8');
  const impossible = BUNDLE_MARKERS
    .filter(([, marker]) => !markerMatches(localBundle, marker))
    .map(([label]) => label);
  if (impossible.length) {
    console.error(`릴리스 마커 자체가 현재 빌드와 맞지 않습니다: ${impossible.join(', ')}`);
    process.exit(1);
  }
}

const VERSION = process.argv[2] ?? '2.0.4';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pubcheck-'));

if (!/^\d+\.\d+\.\d+$/.test(VERSION)) {
  console.error(`버전 형식이 아닙니다: ${VERSION}`);
  process.exit(1);
}
console.log(`레지스트리에서 argus-decision-mcp@${VERSION} 내려받는 중…`);
// execFileSync with an argument array — no shell, so the version string cannot
// become a command even if it ever came from somewhere less trusted. On Windows
// `npm` is a .cmd shim that execFile cannot launch, so call npm's own entry
// script with the node binary already running this file.
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
execFileSync(process.execPath, [npmCli, 'pack', `argus-decision-mcp@${VERSION}`, '--prefer-online'], { cwd: work, stdio: 'pipe' });
const tgz = fs.readdirSync(work).find((f) => f.endsWith('.tgz'));
const tarListing = execFileSync('tar', ['-tvzf', tgz], { cwd: work, encoding: 'utf8' });
execFileSync('tar', ['xzf', tgz], { cwd: work, stdio: 'pipe' });
const pkgDir = path.join(work, 'package');
const entry = path.join(pkgDir, 'dist', 'index.js');

// `npm pack` ships the published files only — no node_modules — and the server
// imports the MCP SDK at runtime. Install exactly what a user's `npx` would
// resolve, or the process exits on its first import and the failure looks like
// a broken release instead of a missing dependency.
console.log('런타임 의존성 설치 중 (npx가 하는 것과 같은 해석)…');
execFileSync(process.execPath, [npmCli, 'install', '--omit=dev', '--no-audit', '--no-fund'],
  { cwd: pkgDir, stdio: 'pipe' });

const declared = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;
const bundle = fs.readFileSync(entry, 'utf8');

const fails = [];
const check = (name, cond, detail) => {
  console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` — ${detail}`}`);
  if (!cond) fails.push(name);
};

check(`버전이 ${VERSION}`, declared === VERSION, `실제 ${declared}`);
check('npm bin이 POSIX에서 실행 가능하다 (2.0.7)',
  /^-rwx[^\r\n]*package\/dist\/index\.js$/m.test(tarListing),
  'tar header의 package/dist/index.js에 실행 비트가 없음');
for (const [label, marker] of BUNDLE_MARKERS) {
  check(label, markerMatches(bundle, marker), `번들에 ${marker} 없음`);
}

// ── drive the real downloaded server ────────────────────────────────────────
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pubrun-'));
const env = { ...process.env, ARGUS_DIR: dir, NODE_ENV: 'test' };
delete env.ARGUS_TOKEN;

let sealSchema = null;
const client = new Client({ name: 'pubcheck', version: '1' }, { capabilities: { elicitation: {} } });
client.setRequestHandler(ElicitRequestSchema, async (req) => {
  sealSchema = req.params.requestedSchema;
  return { action: 'accept', content: {} };   // one keypress, nothing typed
});
await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env }));

const res = await client.callTool({
  name: 'argus_predict',
  arguments: {
    argus_dir: dir, id: 'pub-1',
    predicate: 'the published build records with a single keypress',
    check_by: '2026-12-31', predicate_owner: 'ai_surfaced', confirm_draft: true,
  },
}, undefined, { timeout: 60_000 });

const sc = res.structuredContent ?? {};
check('확인창이 실제로 떴다', Boolean(sealSchema), JSON.stringify(sc).slice(0, 120));
check('확인창에 입력칸이 없다',
  sealSchema && Object.keys(sealSchema.properties ?? {}).length === 0,
  JSON.stringify(sealSchema));
check('그대로 Accept가 기록됐다', sc?.data?.sealed !== false && sc?.data?.choice !== 'no_answer',
  `choice=${sc?.data?.choice} surface=${String(sc?.surface).slice(0, 70)}`);

const back = await client.callTool({ name: 'argus_patterns', arguments: { argus_dir: dir, view: 'all' } });
check('되읽으면 기록이 남아 있다', JSON.stringify(back.structuredContent ?? {}).includes('pub-1'));

await client.close();
fs.rmSync(work, { recursive: true, force: true });
fs.rmSync(dir, { recursive: true, force: true });

console.log('');
if (fails.length) {
  console.error(`❌ 배포본 검증 실패 ${fails.length}건: ${fails.join(', ')}`);
  process.exit(1);
}
console.log(`✅ npm의 ${VERSION}가 오늘 수정을 담고 있고, 확인창이 한 번의 Accept로 기록됩니다.`);
