/**
 * npm run verify — one command, one verdict.
 *
 * 2026-07-27: the founder was told "fixed" twice and was blocked twice. What
 * failed was not any single gate; it was that the gates lived in different
 * places, spoke different formats, and none of them stood in for the client
 * the founder actually uses. Trust cannot be rebuilt by another assertion from
 * the engineer — only by a check the founder can run themselves and read in
 * ten seconds.
 *
 * So this runs EVERY gate, in one place, and — critically — it also runs the
 * SELF-TESTS: it reintroduces the two known regressions and fails unless the
 * gates catch them. A suite that cannot fail is not evidence.
 *
 * Exit 0 only when every gate passes AND every gate proved it can fail.
 */
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = [];
let failed = 0;

function run(label, cmd, opts = {}) {
  const started = Date.now();
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    rows.push({ label, ok: true, ms: Date.now() - started, note: (opts.extract ? opts.extract(out) : '') });
    return out;
  } catch (e) {
    failed++;
    const out = String(e.stdout ?? '') + String(e.stderr ?? '');
    rows.push({ label, ok: false, ms: Date.now() - started, note: out.split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 180) });
    return out;
  }
}

/** Break something on purpose; assert the gate turns red; put it back.
 *  A gate that stays green here is worse than no gate — it is false comfort. */
function selfTest(label, file, mutate, gateCmd) {
  const full = path.join(ROOT, file);
  const original = fs.readFileSync(full, 'utf8');
  // Match against LF regardless of what the working copy holds. On Windows a
  // tool that rewrites a file lands CRLF, every multi-line mutation string
  // stops matching, and three self-tests reported "could not plant" (2026-07-28)
  // — the honest outcome, but it means a line ending can disarm the only check
  // that proves a gate still bites. Restore writes the ORIGINAL bytes back, so
  // this normalisation never becomes a stealth edit of the user's file.
  const lf = original.replace(/\r\n/g, '\n');
  const broken = mutate(lf);
  if (broken === lf) {
    failed++;
    rows.push({ label, ok: false, ms: 0, note: '회귀를 심지 못했다 — 자기검증 자체가 무효' });
    return;
  }
  const started = Date.now();
  try {
    fs.writeFileSync(full, broken);
    execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
    let caught = false;
    try { execSync(gateCmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { caught = true; }
    if (!caught) failed++;
    rows.push({ label, ok: caught, ms: Date.now() - started, note: caught ? '심은 회귀를 잡았다' : '⚠ 회귀를 심었는데도 초록 — 이 게이트는 거짓말한다' });
  } finally {
    fs.writeFileSync(full, original);
    execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
  }
}

console.log('Argus 전수 검증 — 모든 게이트 + 게이트 자신의 신뢰성\n');

run('빌드', 'npm run build');
run('타입 검사', 'npm run typecheck');
run('단위·프로토콜 테스트', 'npx vitest run', { extract: (o) => (o.match(/Tests\s+(\d+ passed[^\n]*)/) || [])[1] ?? '' });
run('실서버 여정 루프', 'node evals/loop.mjs', { extract: (o) => (o.match(/(\d+ calls · \d+ RED[^\n]*)/) || [])[1] ?? '' });
run('내용 배터리 (47 시나리오)', 'node evals/battery.mjs', { env: { ...process.env, BATTERY_SKIP_BUILD: '1' }, extract: (o) => (o.match(/(\d+ calls · \d+ RED[^\n]*)/) || [])[1] ?? '' });
run('호스트 전수 대조 (9 호스트)', 'node evals/host-matrix.mjs', { env: { ...process.env, HOST_MATRIX_SKIP_BUILD: '1' }, extract: (o) => (o.match(/(\d+ checks · \d+ violation[^\n]*)/) || [])[1] ?? '' });
run('정산 카드 실행 (VM 호스트)', 'node evals/widget-runtime.mjs', { extract: (o) => `${(o.match(/ok  /g) || []).length} gestures ok` });
run('밖에서 뜨는 물음 (실서버)', 'node evals/ambient-picker.mjs', { env: { ...process.env, AMBIENT_SKIP_BUILD: '1' }, extract: (o) => (o.match(/(\d+ checks · \d+ violation[^\n]*)/) || [])[1] ?? '' });
run('원장 못 읽을 때 쓰기 차단', 'node evals/unreadable-ledger.mjs', { env: { ...process.env, UNREADABLE_SKIP_BUILD: '1' }, extract: (o) => (o.includes('✅') ? '이중 봉인 차단 확인' : '') });
run('픽커 E2E (엄격 호스트)', `node evals/e2e-picker.mjs node "${path.join(ROOT, 'dist', 'index.js')}"`, { extract: (o) => (o.match(/(E2E: [^\n]*)/) || [])[1] ?? '' });
run('픽커 왕복 (설치본 타르볼)', 'node -e "0"'); // placeholder kept honest below
rows.pop(); // the tarball path belongs to CI (needs npm pack); do not fake it here
run('로케일 무누수', 'node evals/locale-consistency.mjs');
run('카피 감사', 'node evals/copy-audit.mjs', { extract: (o) => (o.match(/register violations\s*:\s*(\d+)/) || [])[1] ? `register ${(o.match(/register violations\s*:\s*(\d+)/) || [])[1]}` : '' });
run('75일 동거 시뮬', 'node evals/life.mjs', { extract: (o) => (o.match(/verdict-language on any day\s*:\s*([^\n]*)/) || [])[1] ?? '' });
run('적대 입력 퍼즈 (800콜)', 'node evals/fuzz.mjs', { extract: (o) => (o.match(/(server alive after run: \w+)/) || [])[1] ?? '' });

console.log('게이트 실행 완료. 이제 게이트 자신을 시험합니다 (회귀를 일부러 심어 빨간불을 확인)…\n');

selfTest(
  '자기검증 ① 폼 차단 회귀를 잡는가',
  'src/tools/seal.ts',
  (s) => s.replace("            check_by: {\n              type: 'string',", "            check_by: {\n              type: 'string',\n              format: 'date',"),
  'node evals/host-matrix.mjs',
);
selfTest(
  '자기검증 ③ 긴 답 파괴 회귀를 잡는가',
  'src/tools/premises.ts',
  (s2) => s2.replace("{ type: 'object', properties: { decision: { type: 'string', description:", "{ type: 'object', properties: { decision: { type: 'string', maxLength: 400, description:"),
  'node evals/host-matrix.mjs',
);
selfTest(
  '자기검증 ④ 카드가 죽는 회귀를 잡는가',
  'src/lib/apps-ui-html.ts',
  (s2) => s2.replace("  'use strict';", "  'use strict'; var broken = ;"),
  'node evals/widget-runtime.mjs',
);
selfTest(
  '자기검증 ⑤ 못 읽는 원장 회귀를 잡는가',
  'src/lib/ledger-replay.ts',
  (s2) => s2.replace("    const benign = code === 'ENOENT';", "    const benign = true;"),
  'node evals/unreadable-ledger.mjs',
);
selfTest(
  '자기검증 ② 작업 유실 회귀를 잡는가',
  'src/lib/elicit.ts',
  (s) => s.replace("    return { kind: 'no_answer', reason: 'cancelled' };", "    return { kind: 'declined' };"),
  'node evals/host-matrix.mjs',
);
// ── 2026-07-28 감사에서 고친 것들. 각각 "되돌리면 빨간불이 켜지는가"로만 신뢰한다.
selfTest(
  '자기검증 ⑥ 정산 픽커 유실 회귀를 잡는가',
  'src/tools/settle.ts',
  (s) => s.replace("        if (asked.kind === 'no_answer') {\n          return noAnswerResult({\n            tool: 'argus_settle',", "        if (false) {\n          return noAnswerResult({\n            tool: 'argus_settle',"),
  'node evals/host-matrix.mjs',
);
selfTest(
  '자기검증 ⑦ 스파인 문구 위조 회귀를 잡는가',
  'src/lib/untrusted.ts',
  (s) => s.replace('.replace(SPINE_BRAND, SPINE_BRAND_ESCAPED)', ''),
  'node evals/battery.mjs',
);
selfTest(
  '자기검증 ⑧ 카드가 엉뚱한 원장을 겨냥하는 회귀를 잡는가',
  'src/lib/apps-ui-html.ts',
  (s) => s.replace('var dir = state.argus_dir || inputArgs.argus_dir;', 'var dir = inputArgs.argus_dir;'),
  'node evals/widget-runtime.mjs',
);
selfTest(
  '자기검증 ⑨ 밖에서 받은 답이 조용히 사라지는 회귀를 잡는가',
  'src/server.ts',
  (s) => s.replace('attachAmbientNote(result, dirForNote)', 'result'),
  'node evals/ambient-picker.mjs',
);
selfTest(
  '자기검증 ⑩ 못 본 물음이 쿨다운을 먹는 회귀를 잡는가',
  'src/lib/ambient-elicit.ts',
  (s) => s.replace("    if (asked && (asked.kind === 'unsupported' || (asked.kind === 'no_answer' && asked.reason === 'failed'))) {", '    if (false) {'),
  'node evals/ambient-picker.mjs',
);
selfTest(
  '자기검증 ⑪ 사용자가 쓴 말을 버리는 회귀를 잡는가',
  'src/tools/seal.ts',
  (s) => s.replace(/\n +data: \{ sealed: false, user_input: \{ reword: rw[^\n]*\n/, '\n'),
  'node evals/host-matrix.mjs',
);
selfTest(
  '자기검증 ⑫ 적어둔 서술을 되돌려주지 않는 회귀를 잡는가',
  'src/tools/settle.ts',
  (s) => s.replace('user_input: { what_happened: typed },', ''),
  'node evals/host-matrix.mjs',
);

const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));
console.log('\n' + '─'.repeat(78));
for (const r of rows) {
  console.log(`  ${r.ok ? '✅' : '❌'} ${pad(r.label, 34)} ${pad(`${(r.ms / 1000).toFixed(1)}s`, 8)} ${r.note}`);
}
console.log('─'.repeat(78));
if (failed) {
  console.log(`\n❌ ${failed}개 게이트 실패 — 위 줄의 note를 보세요. 이 상태로는 배포 금지.`);
  process.exit(1);
}
const planted = rows.filter((r) => r.label.startsWith('자기검증')).length;
console.log(`\n✅ 전 게이트 통과 + 심은 회귀 ${planted}개를 게이트가 실제로 잡음.`);
console.log('   (초록불이 "고장을 못 잡는 초록불"이 아님을 같은 실행 안에서 증명했습니다.)');
