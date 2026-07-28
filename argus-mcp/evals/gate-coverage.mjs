/**
 * WHO GUARDS THE GATES.
 *
 *   node evals/gate-coverage.mjs
 *
 * 2026-07-29. In one night, six of this repo's own gates turned out to be green
 * while measuring nothing:
 *
 *   1. a bundle marker written in source form that esbuild's quote normalisation
 *      made permanently unmatchable — it reported a SHIPPED fix as missing
 *   2. a self-test mutation whose anchor no longer existed, so it could not
 *      plant the regression it claimed to prove
 *   3. a gate with no registered failure signature, which threw and took the
 *      whole verify with it
 *   4. a red light that only meant "the CLI is not installed here"
 *   5. a yellow that fired on every single run because the SCENARIO was wrong,
 *      training everyone to scroll past yellows
 *   6. a failure report that printed vitest's source context instead of the
 *      assertion, so the failure named a line without saying anything about it
 *
 * Every one is the same disease as the product bug that started the
 * investigation: something that looks green while measuring nothing. Individual
 * self-tests catch a gate that stopped biting. NOTHING caught a gate that was
 * never proven to bite at all.
 *
 * This file is that check. It is deliberately structural, not behavioural: it
 * reads verify-all.mjs and asserts, for every gate that runs, that some
 * self-test plants a regression into it. A gate nobody has ever seen fail is an
 * opinion, not evidence.
 *
 * It also names the reverse — an eval file sitting in the directory that verify
 * never runs. A dead gate is worse than no gate: it reads as coverage.
 *
 * WAIVERS are explicit and each carries its reason. "It is hard to mutate" is
 * not a reason; "this gate asserts a property of the environment rather than of
 * our source" is.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERIFY = fs.readFileSync(path.join(HERE, 'verify-all.mjs'), 'utf8');

/**
 * Gates that legitimately have no planted regression, each with the reason it
 * cannot have one. Keep this list short and argued; it is the escape hatch that
 * would let this whole check rot.
 */
const WAIVED = new Map([
  ['fuzz', 'adversarial input generator — asserts the server survives arbitrary input, so there is no single source line whose removal makes it fail'],
  ['version-lockstep', 'compares version strings ACROSS files; a mutation to any one of them is what it detects, and verify already re-runs it after every self-test restores the tree'],
  ['package-executable', 'asserts a property of the npm tarball produced by packing, not of a source line'],
  ['verify-published', 'checks an already-published release; it cannot run before publish and is deliberately outside verify-all'],
  ['gate-coverage', 'this file — it reads verify-all.mjs rather than the product, and its own failure mode is checked by the waiver audit below'],
  ['e2e-picker', 'HAS a self-test (㉖); listed here only because its command is built with a template literal and the scan below already resolves it'],
  ['verify-all', 'the orchestrator itself — it runs the gates, it is not one'],

  // NOT GATES. Each of these was flagged by this file on its first run, which is
  // the point: they sat in evals/ looking like coverage. Saying what they ARE is
  // the fix, and it has to be said out loud rather than by omission.
  ['anthropic', 'a shared Messages-API client used BY the LLM-judged reviews below — a library, not a check'],
  ['copy-audit', 'LLM-JUDGED prose review. Costs money and needs an API key, so it cannot sit in verify; run by hand with `npm run copy`. Its verdicts are opinions about writing, not pass/fail facts'],
  ['architecture-review', 'LLM-JUDGED structural review, same reasoning as copy-audit — a second opinion for a human to weigh, never a merge gate'],
  ['codex-elicit-wire-probe', 'an INVESTIGATION tool: a bare MCP server that echoes back whatever elicitation result a host returns. Used to read a real Codex on the wire; asserts nothing'],
  ['discover', 'investigation harness for reading what a host actually receives — superseded as a GATE by host-matrix and picker-surfaces, kept because it is the quickest way to look at raw payloads'],
  ['live-roundtrip', 'talks to a REAL published server over the network; deliberately outside verify for the same reason as verify-published'],

  // ⚠ 이 하나만 성격이 애매하다 — 창업자 확인 대상.
  ['elicit', 'has an `npm run elicit` script but its job (does the one interactive surface work?) is now covered by e2e-picker + host-matrix + claude-code-form. Kept as a waiver rather than deleted because deleting another track\'s harness at 6am is not my call — see the handoff'],
]);

const violations = [];
let checks = 0;
const ok = (label, cond, detail = '') => {
  checks += 1;
  if (!cond) violations.push(`${label}: ${String(detail).slice(0, 260)}`);
};

/** Every `node evals/<name>.mjs` that verify RUNS as a baseline gate. */
function gatesRun() {
  const found = new Set();
  for (const m of VERIFY.matchAll(/^run\(([\s\S]*?)\n?\);?$/gm)) {
    const hit = /evals\/([a-z0-9-]+)\.mjs/.exec(m[1]);
    if (hit) found.add(hit[1]);
  }
  // run(...) calls that fit on one line are the common shape
  for (const m of VERIFY.matchAll(/run\([^\n]*evals\/([a-z0-9-]+)\.mjs/g)) found.add(m[1]);
  return found;
}

/** Every `node evals/<name>.mjs` that some selfTest PLANTS a regression into. */
function gatesWithSelfTest() {
  const found = new Set();
  for (const block of VERIFY.split('selfTest(').slice(1)) {
    // the gate command is the 4th argument; take the first eval it names
    const hit = /evals\/([a-z0-9-]+)\.mjs/.exec(block.slice(0, 1200));
    if (hit) found.add(hit[1]);
  }
  return found;
}

const run = gatesRun();
const proven = gatesWithSelfTest();

ok('G0 verify가 게이트를 실제로 돌린다', run.size >= 8, `발견된 게이트 ${run.size}개 — 스캐너가 깨졌을 수 있다`);
ok('G0 자기검증이 실제로 존재한다', proven.size >= 8, `자기검증 대상 ${proven.size}개`);

for (const gate of [...run].sort()) {
  if (WAIVED.has(gate)) continue;
  ok(`G1 ${gate} — 이 게이트가 무는지 증명한 자기검증이 있다`,
    proven.has(gate),
    '이 게이트는 한 번도 빨간불이 된 적이 없다. 결함을 심어 빨간불을 확인하는 selfTest를 추가하거나, WAIVED에 이유와 함께 등록할 것');
}

// 반대 방향 — 파일은 있는데 verify가 안 도는 게이트.
const onDisk = fs.readdirSync(HERE)
  .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
  .map((f) => f.replace(/\.mjs$/, ''));
for (const gate of onDisk.sort()) {
  if (WAIVED.has(gate)) continue;
  ok(`G2 ${gate} — verify가 이 파일을 실제로 돌린다`,
    run.has(gate) || proven.has(gate),
    'evals/에 있는데 아무도 실행하지 않는다. 죽은 게이트는 없는 게이트보다 나쁘다 — 커버리지로 읽히기 때문이다. 돌리거나, 지우거나, WAIVED에 이유를 적을 것');
}

// 면제 목록 자체가 썩지 않게: 존재하지 않는 파일을 면제하고 있으면 그것도 위반.
for (const gate of WAIVED.keys()) {
  ok(`G3 면제 ${gate} — 그 파일이 실재한다`,
    fs.existsSync(path.join(HERE, `${gate}.mjs`)),
    '없는 게이트를 면제하고 있다 — 면제 목록이 낡았다');
}

const label = `${checks} checks · ${violations.length} violations · 게이트 ${run.size}개 중 ${proven.size}개가 무는 것이 증명됨`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('\n초록불은 "우리가 검사할 생각을 한 것"만 통과했다는 뜻입니다. 검사한 적 없는 게이트는 의견이지 증거가 아닙니다.');
  process.exit(1);
}
console.log(`✅ ${label} — 도는 게이트 전부가 "빨간불이 될 수 있음"을 증명했습니다.`);
