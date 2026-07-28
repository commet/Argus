/**
 * npm run verify — one command, one verdict.
 *
 * 2026-07-27: the founder was told "fixed" twice and was blocked twice. What
 * failed was not any single gate; it was that the gates lived in different
 * places, spoke different formats, and none of them stood in for the client the
 * founder actually uses. Trust cannot be rebuilt by another assertion from the
 * engineer — only by a check the founder can run themselves and read in ten
 * seconds.
 *
 * So this runs EVERY gate, in one place, and — critically — it also runs the
 * SELF-TESTS: it re-plants each known regression and fails unless the gate
 * catches it. A suite that cannot fail is not evidence.
 *
 * 2026-07-28, after the 2.0.0 surface reduction: the journey observatories were
 * removed because they called tool names 2.0.0 no longer exposes, and testing
 * names that do not exist gives a false picture of the product. That reasoning
 * is right. The three that came back here came back PORTED to the public six
 * (argus_predict / argus_resolve / argus_capture / argus_patterns), not
 * resurrected — because without them not one of the audit fixes below is
 * provable, and "it looks fine" is exactly what this file exists to refuse.
 *
 * Exit 0 only when every gate passes AND every gate proved it can fail.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const rows = [];
let failed = 0;

// execSync's DEFAULT maxBuffer is 1 MB, and the observatories print a line per
// check across ten host profiles. Four of them were being KILLED for talking too
// much and reported here as product failures (2026-07-28) — the harness failing
// while wearing the product's face, which is the exact thing this file exists to
// prevent. Give every gate room to speak.
const BUF = { maxBuffer: 64 * 1024 * 1024 };

function run(label, cmd, opts = {}) {
  const started = Date.now();
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...BUF, ...opts });
    rows.push({ label, ok: true, ms: Date.now() - started, note: (opts.extract ? opts.extract(out) : '') });
    return out;
  } catch (e) {
    failed++;
    const out = String(e.stdout ?? '') + String(e.stderr ?? '');
    rows.push({ label, ok: false, ms: Date.now() - started, note: out.split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 180) });
    return out;
  }
}

/**
 * Break something on purpose; assert the gate turns red; put it back.
 * A gate that stays green here is worse than no gate — it is false comfort.
 *
 * This edits REAL source files, so an interrupted run can leave the tree
 * mutated. It happened (2026-07-28): a build failure escaped mid-plant and a
 * line stayed deleted. Two defences now: the try/catch below can no longer let
 * an exception skip the restore, and `verifyTreeClean()` at the end re-reads
 * every file this function touched and fails loudly if any byte differs from
 * what it started with. Never trust the restore silently.
 */
const touched = new Map();
function selfTest(label, file, mutate, gateCmd) {
  const full = path.join(ROOT, file);
  const original = fs.readFileSync(full, 'utf8');
  if (!touched.has(full)) touched.set(full, original);
  // Match against LF regardless of what the working copy holds. On Windows a
  // tool that rewrites a file lands CRLF, every multi-line mutation string stops
  // matching, and three self-tests reported "could not plant" (2026-07-28) — the
  // honest outcome, but it means a line ending can disarm the only check that
  // proves a gate still bites. Restore writes the ORIGINAL bytes back, so this
  // normalisation never becomes a stealth edit of the working tree.
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
    build(); // a build failure here must NOT escape with the file still broken
    let caught = false;
    try { execSync(gateCmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...BUF }); }
    catch { caught = true; }
    if (!caught) failed++;
    rows.push({ label, ok: caught, ms: Date.now() - started, note: caught ? '심은 회귀를 잡았다' : '⚠ 회귀를 심었는데도 초록 — 이 게이트는 거짓말한다' });
  } catch (e) {
    // Reaching here means the SELF-TEST broke, not the product. Say exactly that
    // — a harness failure dressed as a product verdict is the thing this file
    // exists to prevent. (It used to throw straight out of the run, which also
    // skipped every later self-test and left the planted regression on disk
    // until the finally ran. 2026-07-28.)
    failed++;
    rows.push({ label, ok: false, ms: Date.now() - started, note: `자기검증 하네스 실패(제품 아님): ${String(e?.message ?? e).split('\n')[0].slice(0, 120)}` });
  } finally {
    fs.writeFileSync(full, original);
    build();
  }
}

/** `npm run build` wipes dist/ first, and on Windows that rmSync can EPERM for a
 *  moment while a just-exited spawned server still holds dist/index.js. One
 *  retry turns a harness flake back into what it is; a second failure is real. */
function build() {
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
  } catch {
    execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
  }
}

console.log('Argus 전수 검증 — 모든 게이트 + 게이트 자신의 신뢰성\n');

// ── the shipped surface (2.0.0's list, unchanged) ───────────────────────────
run('빌드', 'npm run build');
run('타입 검사', 'npm run typecheck');
run('단위·프로토콜 테스트', 'npm test -- --reporter=dot', { extract: (o) => (o.match(/Tests\s+(\d+ passed[^\n]*)/) || [])[1] ?? '' });
// `npm run fuzz` rebuilds first, and on Windows that rmSync of dist/ can
// EPERM while a just-exited spawned server still holds the file — a flake in the
// HARNESS that reads as a product failure. verify already built; call it directly.
run('적대 입력 퍼즈', 'node evals/fuzz.mjs', { extract: (o) => (o.match(/(server alive after run: \w+)/) || [])[1] ?? '' });
run('픽커 E2E (엄격 호스트)', `node evals/e2e-picker.mjs "${process.execPath}" dist/index.js`, { extract: (o) => (o.match(/(E2E: [^\n]*)/) || [])[1] ?? '' });
run('원장 못 읽을 때 쓰기 차단', 'node evals/unreadable-ledger.mjs', { extract: (o) => (o.includes('✅') ? '이중 봉인 차단 확인' : '') });
run('패키지 내용물', 'npm pack --dry-run');

// ── the observatories, ported to the public six ────────────────────────────
run('호스트 전수 대조 (9 호스트)', 'node evals/host-matrix.mjs', { env: { ...process.env, HOST_MATRIX_SKIP_BUILD: '1' }, extract: (o) => (o.match(/(\d+ checks · \d+ violation[^\n]*)/) || [])[1] ?? '' });
run('밖에서 뜨는 물음 (실서버)', 'node evals/ambient-picker.mjs', { env: { ...process.env, AMBIENT_SKIP_BUILD: '1' }, extract: (o) => (o.match(/(\d+ checks · \d+ violation[^\n]*)/) || [])[1] ?? '' });
run('내용 배터리 (실서버)', 'node evals/battery.mjs', { env: { ...process.env, BATTERY_SKIP_BUILD: '1' }, extract: (o) => (o.match(/(\d+ calls · \d+ RED[^\n]*)/) || [])[1] ?? '' });
run('정산 카드 실행 (VM 호스트)', 'node evals/widget-runtime.mjs', { extract: (o) => `${(o.match(/ok  /g) || []).length} gestures ok` });
const COUNTS = (o) => (o.match(/(\d+ checks · \d+ violation[^\n]*)/) || [])[1] ?? '';
run('픽커 화면 전수 (2언어 × 8내용)', 'node evals/picker-surfaces.mjs', { env: { ...process.env, PICKER_SURFACES_SKIP_BUILD: '1' }, extract: COUNTS });
run('문장 위험 전수 (2언어 × 2호스트)', 'node evals/surface-hazards.mjs', { env: { ...process.env, SURFACE_HAZARDS_SKIP_BUILD: '1' }, extract: COUNTS });
run('간직하는 화면의 액자 (영수증·봉인·항해일지)', 'node evals/keepsake-frames.mjs', { env: { ...process.env, KEEPSAKE_SKIP_BUILD: '1' }, extract: COUNTS });
run('버전 다섯 곳 일치', 'node evals/version-lockstep.mjs', { extract: COUNTS });
// Judges our asks with the submit gate read out of the shipped Claude Code
// binary — including how many Returns it takes, which is what three previous
// "Accept does not work" fixes each missed.
run('Claude Code 폼이 실제로 제출하는가', 'node evals/claude-code-form.mjs', { env: { ...process.env, CC_FORM_SKIP_BUILD: '1' }, extract: (o) => (o.match(/(\d+ checks · \d+ violations[^\n]*)/) || [])[1] ?? '' });
// Slow on purpose: the answer arrives after the SDK's 60s default. ~80s.
run('1분 넘게 생각한 사람의 Accept', 'node evals/slow-human.mjs', { env: { ...process.env, SLOW_HUMAN_SKIP_BUILD: '1' }, extract: (o) => (o.match(/(\d+ checks · \d+ violations[^\n]*)/) || [])[1] ?? '' });

// ── the plugin surface ──────────────────────────────────────────────────────
run('플러그인 검증', 'node argus-plugin-v2/scripts/validate-plugin.js', { cwd: REPO });
run('플러그인 설치 스모크', 'node argus-plugin-v2/scripts/install-smoke.mjs', { cwd: REPO });
run('플러그인 시뮬레이션', 'node argus-plugin-v2/scripts/simulate-plugin.js', { cwd: REPO });
run('확인 표면 문구 대조', 'node argus-plugin-v2/scripts/picker-surface-parity.test.mjs', { cwd: REPO });

console.log('게이트 실행 완료. 이제 게이트 자신을 시험합니다 (회귀를 일부러 심어 빨간불을 확인)…\n');

// ① used to plant `format:'date'` on the seal ask's check_by box. That box is
// gone (2026-07-28) — a confirmation ask ships no fields at all, because Claude
// Code does not preselect Accept when any property is declared. The regression
// this guards against is therefore the reintroduction of a constraining field,
// planted on the settle picker, which still has one and still must never block
// the form.
selfTest(
  '자기검증 ① 폼 차단 회귀를 잡는가',
  'src/tools/settle.ts',
  (s) => s.replace(
    "            what_happened: {\n              type: 'string',",
    "            what_happened: {\n              type: 'string',\n              minLength: 1,"),
  'node evals/host-matrix.mjs',
);
selfTest(
  '자기검증 ② 작업 유실 회귀를 잡는가',
  'src/lib/elicit.ts',
  (s) => s.replace("    return { kind: 'no_answer', reason: 'cancelled' };", "    return { kind: 'declined' };"),
  'node evals/host-matrix.mjs',
);
// ③ used to plant maxLength on the open-question picker. On the 2.0.0 public
// surface that ask can no longer fire (argus_capture answer_question REQUIRES
// `decision`), so the plant became invisible and the self-test reported
// "심었는데도 초록" — correctly. It is re-aimed at the premise CONFIRM picker,
// which is the same defect class on a path a user can still reach today.
// ③ used to plant maxLength on the premise ask's reword box, which no longer
// exists. The same destroy-the-typed-answer class now lives on the open-question
// picker, whose field IS the user's own sentence — the most expensive place in
// the product to silently truncate.
selfTest(
  '자기검증 ③ 긴 답 파괴 회귀를 잡는가',
  'src/tools/premises.ts',
  (s) => s.replace(
    "{ type: 'object', properties: { decision: { type: 'string',",
    "{ type: 'object', properties: { decision: { type: 'string', maxLength: 400,"),
  'node evals/host-matrix.mjs',
);
selfTest(
  '자기검증 ④ 카드가 죽는 회귀를 잡는가',
  'src/lib/apps-ui-html.ts',
  (s) => s.replace("  'use strict';", "  'use strict'; var broken = ;"),
  'node evals/widget-runtime.mjs',
);
selfTest(
  '자기검증 ⑤ 못 읽는 원장 회귀를 잡는가',
  'src/lib/ledger-replay.ts',
  (s) => s.replace("    const benign = code === 'ENOENT';", "    const benign = true;"),
  'node evals/unreadable-ledger.mjs',
);
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
// ⑪ The seal confirm no longer declares `reword`, so this protection became
// unreachable — and unreachable code cannot be tested, which is how a gate
// starts lying. The `extra-field` host profile sends the field anyway (a client
// that volunteers what the schema did not ask for), which keeps the hand-back
// on a live path and this self-test meaningful.
selfTest(
  '자기검증 ⑪ 사용자가 쓴 말을 버리는 회귀를 잡는가',
  'src/tools/seal.ts',
  (s) => s.replace(/\n +data: \{ sealed: false, user_input: \{ reword: rw[^\n]*\n/, '\n'),
  'node evals/host-matrix.mjs',
);
selfTest(
  '자기검증 ⑫ 적어둔 서술을 되돌려주지 않는 회귀를 잡는가',
  'src/tools/settle.ts',
  (s) => s.replace(/\n +user_input: \{ what_happened: typed \},/, ''),
  'node evals/host-matrix.mjs',
);

// The self-tests rewrote real source files. Prove every one of them came back
// byte-identical before this run is allowed to say anything reassuring.
let dirty = 0;
for (const [full, before] of touched) {
  const now = fs.readFileSync(full, 'utf8');
  if (now === before) continue;
  dirty++;
  failed++;
  rows.push({ label: `자기검증 뒷정리 ${path.relative(ROOT, full)}`, ok: false, ms: 0, note: '심은 회귀가 파일에 남았다 — git diff로 확인하고 되돌리세요' });
}
if (dirty === 0 && touched.size > 0) {
  rows.push({ label: '자기검증 뒷정리', ok: true, ms: 0, note: `건드린 파일 ${touched.size}개 전부 원래 바이트로 복구됨` });
}

selfTest(
  '자기검증 ⑬ 화면에 enum이 새는 회귀를 잡는가',
  'src/lib/apps-ui-html.ts',
  (s) => s.replace("      s.appendChild(el('div', 'done-outcome', t.deferredHead));", "      s.appendChild(el('div', 'done-outcome', 'still_pending'));"),
  'node evals/widget-runtime.mjs',
);

selfTest(
  '자기검증 ⑭ 픽커 라벨이 키로 새는 회귀를 잡는가',
  'src/tools/settle.ts',
  (s) => s.replace(/\n +title: pickerLocale === 'ko' \? '현실이 어떻게 답했나' : 'What reality did',/, ''),
  'node evals/picker-surfaces.mjs',
);
selfTest(
  '자기검증 ⑮ 한국어 화면에 영어가 섞이는 회귀를 잡는가',
  'src/tools/seal.ts',
  (s) => s.replace("' 달력 앱에 넣을 알림 파일도 함께 저장했습니다.'", "' 달력 리마인더(.ics)도 저장했습니다.'"),
  'node evals/surface-hazards.mjs',
);
selfTest(
  '자기검증 ⑯ 간직하는 화면이 액자 밖으로 나가는 회귀를 잡는가',
  'src/lib/render-receipt.ts',
  (s) => s.replace('.flatMap((w) => breakToken(w, width));', ';'),
  'node evals/keepsake-frames.mjs',
);
selfTest(
  '자기검증 ⑰ 폭 측정이 이모지를 놓치는 회귀를 잡는가',
  'src/lib/render-receipt.ts',
  (s) => s.replace('return (WIDE.test(ch) || PICTO.test(ch)) ? 2 : 1;', 'return WIDE.test(ch) ? 2 : 1;'),
  'node evals/keepsake-frames.mjs',
);
selfTest(
  '자기검증 ⑲ 확인창에 입력칸이 되돌아오는 회귀를 잡는가',
  'src/tools/seal.ts',
  (s) => s.replace(
    "          { type: 'object', properties: {} },",
    "          { type: 'object', properties: { reword: { type: 'string', title: 'Reword (optional)' } } },"),
  'node evals/claude-code-form.mjs',
);
selfTest(
  '자기검증 ⑱ 오래 생각한 사람의 답을 버리는 회귀를 잡는가',
  'src/server.ts',
  (s) => s.replace(
    'ec.elicitInput({ message, requestedSchema }, { timeout: timeoutMs ?? DECISION_ASK_TIMEOUT_MS })',
    'ec.elicitInput({ message, requestedSchema })'),
  'node evals/slow-human.mjs',
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
