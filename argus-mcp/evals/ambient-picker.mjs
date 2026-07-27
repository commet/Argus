/**
 * OUT-OF-BAND ASK — driven for real, against the real server.
 *
 *   node evals/ambient-picker.mjs
 *
 * WHY THIS EXISTS (audit 2026-07-28): ambient elicitation is the one Argus
 * surface that appears when the user did not ask for anything. It fires from a
 * timer, outside any tool call, straight into the user's screen while they are
 * doing their own work. It is therefore the surface with the highest cost when
 * it is wrong — and it was the only picker with NO eval at all. Unit tests
 * covered the gate logic with a stubbed elicitor; nothing drove the real server
 * over a real MCP connection and watched what actually arrives.
 *
 * Everything below is a promise the founder can be held to:
 *
 *   O1 IT ONLY SPEAKS WHEN THERE IS SOMETHING  — zero due ⇒ zero asks. An empty
 *      nudge is not expressible.
 *   O2 THE MUTE IS REAL                        — `ambient_mute: true` silences it.
 *   O3 THE FORM IS SPINE-SAFE                  — outcome only. No crux, no fork,
 *      no options, no lean in the prose.
 *   O4 AN ANSWER IS ACTUALLY RECORDED          — accepting really writes the
 *      settle, through the real handler, with the user's own words.
 *   O5 THE USER LEARNS WHAT HAPPENED           — an out-of-band answer gets a
 *      confirmation on the next tool result. Answering into a void is not a
 *      feature; before this, success and failure looked identical (silence).
 *   O6 A DECLINE WRITES NOTHING                — and does not re-ask.
 *   O7 A BLANK NARRATION FABRICATES NOTHING    — outcome picked, no words ⇒ no
 *      record, and the user is told why rather than left guessing.
 *   O8 A QUESTION NOBODY SAW COSTS NOTHING     — a host that declares elicitation
 *      then rejects it must not burn the 4-hour cooldown.
 *
 * Exit non-zero on any violation. CI gate.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');
const T0 = '2026-07-02';
const LATER = '2026-07-20'; // past the check-by below, so the bet is overdue

let violations = [];
let checks = 0;
function ok(id, cond, detail) {
  checks++;
  if (cond) { console.log(`  ok   ${id}`); return true; }
  console.log(`  FAIL ${id} ${detail ?? ''}`);
  violations.push(`${id}: ${detail ?? ''}`.trim());
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One server process, one sitting. `answer` receives the elicit params and
 * returns an ElicitResult (or throws, to model a host that declared the
 * capability and then refuses it).
 */
async function sitting({ dir, answer, muted = false }) {
  fs.mkdirSync(dir, { recursive: true });
  if (muted) {
    fs.mkdirSync(path.join(dir), { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.yaml'), 'ambient_mute: true\n', 'utf8');
  }
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  env.ARGUS_DIR = dir;
  env.NODE_ENV = 'test';
  env.ARGUS_AMBIENT_DELAY_MS = '40';      // fire almost immediately after quiet
  env.ARGUS_AMBIENT_ASK_TIMEOUT_MS = '4000';
  const asks = [];
  const client = new Client({ name: 'ambient-eval', version: '1' }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    asks.push(req.params);
    return answer(req.params, asks.length);
  });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));
  const call = async (n, args) => {
    const r = await client.callTool({ name: n, arguments: { argus_dir: dir, ...args } });
    return r.structuredContent ?? {};
  };
  return { client, asks, call, close: () => client.close() };
}

/** Seal a bet that is already overdue at LATER, WITHOUT spending the ambient
 *  budget (argus_check_in would). The seal itself arms the debounce timer. */
async function seedOverdue(call) {
  await call('argus_predict', {
    id: 'amb', predicate: '리뉴얼 후 첫 달 재구매율이 20%를 넘는다',
    check_by: '2026-07-10', predicate_owner: 'user', today_override: T0,
  });
  // A second call at the LATER clock so the ambient timer fires with a today
  // that makes the bet overdue (the timer reads the last call's today_override).
  await call('argus_patterns', { view: 'all', today_override: LATER });
}

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-ambient-'));
if (process.env.AMBIENT_SKIP_BUILD !== '1') execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
console.log('Argus out-of-band ask — driven against the real server\n');

// ── O1 · nothing due ⇒ never asks ───────────────────────────────────────────
{
  console.log('■ O1 due 0건이면 아예 묻지 않는다');
  const dir = path.join(base, 'o1');
  const s = await sitting({ dir, answer: () => ({ action: 'accept', content: { outcome: 'held' } }) });
  await s.call('argus_predict', { id: 'future', predicate: '연말까지 신규 채널 3개를 연다', check_by: '2026-12-31', predicate_owner: 'user', today_override: T0 });
  await s.call('argus_patterns', { view: 'all', today_override: T0 });
  await sleep(500);
  ok('O1 아무것도 due가 아니면 물음 0건', s.asks.length === 0, `asks=${s.asks.length}`);
  await s.close();
}

// ── O2 · the mute is real ───────────────────────────────────────────────────
{
  console.log('■ O2 ambient_mute: true면 침묵한다');
  const dir = path.join(base, 'o2');
  const s = await sitting({ dir, muted: true, answer: () => ({ action: 'accept', content: { outcome: 'held' } }) });
  await seedOverdue(s.call);
  await sleep(500);
  ok('O2 mute면 물음 0건', s.asks.length === 0, `asks=${s.asks.length}`);
  await s.close();
}

// ── O3/O4/O5 · the ask, the record, and the confirmation back ───────────────
{
  console.log('■ O3·O4·O5 물음의 형태 · 실제 기록 · 사용자에게 돌아오는 확인');
  const dir = path.join(base, 'o345');
  const s = await sitting({
    dir,
    answer: (p, n) => (n === 1
      ? { action: 'accept', content: { outcome: 'missed' } }
      : { action: 'accept', content: { what_happened: '재구매율 13%에서 멈췄다. 쿠폰 의존이 컸다.' } }),
  });
  await seedOverdue(s.call);
  await sleep(900);

  ok('O3 due가 있으면 실제로 물어본다', s.asks.length >= 1, `asks=${s.asks.length}`);
  if (s.asks.length >= 1) {
    const first = s.asks[0];
    const props = first.requestedSchema?.properties ?? {};
    const keys = Object.keys(props);
    // Spine: the ONE structured pick allowed out of band is reality, not a fork.
    ok('O3 물음은 결과 하나뿐이다 (크럭스도 포크도 아니다)', keys.length === 1 && keys[0] === 'outcome', keys.join(','));
    ok('O3 필수 필드가 없다 (Accept를 폼이 막지 않는다)', !first.requestedSchema?.required?.length, JSON.stringify(first.requestedSchema?.required));
    ok('O3 사용자의 예측을 그대로 되비춘다', String(first.message).includes('재구매율'), String(first.message).slice(0, 120));
    // No lean, no recommendation, no two-pole framing in the prose.
    ok('O3 문구에 방향성이 없다', !/should|추천|권장|~하는 게|더 나은|낫습니다/.test(String(first.message)), String(first.message).slice(0, 160));
    ok('O3 빠져나갈 문을 먼저 준다', /닫아도|Dismiss|조르지|no re-asking/i.test(String(first.message)), String(first.message).slice(0, 160));
  }
  ok('O4 서술까지 두 번 물어본다', s.asks.length >= 2, `asks=${s.asks.length}`);

  // O5b — the confirmation belongs to the ledger it was answered for. A session
  // can move between projects, and A's prediction surfacing during B's work is
  // not a confirmation, it is another room's business leaking in.
  const otherDir = path.join(base, 'o345-other');
  fs.mkdirSync(otherDir, { recursive: true });
  const elsewhere = await s.call('argus_patterns', { argus_dir: otherDir, view: 'all', today_override: LATER });
  ok('O5b 다른 프로젝트 작업 중에는 그 확인이 새지 않는다',
    !/아까 답해주신|Recorded the answer/.test(String(elsewhere.surface ?? '')), String(elsewhere.surface).slice(0, 180));

  // O4 — it really landed in the ledger, with the user's own words.
  const rec = await s.call('argus_patterns', { view: 'all', today_override: LATER });
  const row = (rec.data?.contracts ?? []).find((c) => c.id === 'amb');
  ok('O4 밖에서 받은 답이 실제로 기록됐다', row?.status === 'settled' && row?.outcome === 'missed', JSON.stringify(row).slice(0, 200));

  // O5 — and the user finds out, on the next thing they do.
  const next = await s.call('argus_patterns', { view: 'all', today_override: LATER });
  const surfaces = [rec.surface, next.surface].map((x) => String(x ?? '')).join(' ');
  ok('O5 다음 도구 결과에 확인 한 줄이 붙는다', /기록했습니다|Recorded the answer/.test(surfaces), surfaces.slice(0, 220));
  ok('O5 확인은 한 번만 붙는다 (같은 말을 두 번 하지 않는다)',
    (surfaces.match(/아까 답해주신/g) || []).length <= 1, surfaces.slice(0, 220));
  await s.close();
}

// ── O6 · a decline writes nothing ───────────────────────────────────────────
{
  console.log('■ O6 거절하면 아무것도 쓰지 않는다');
  const dir = path.join(base, 'o6');
  const s = await sitting({ dir, answer: () => ({ action: 'decline' }) });
  await seedOverdue(s.call);
  await sleep(700);
  ok('O6 한 번만 묻고 다시 조르지 않는다', s.asks.length === 1, `asks=${s.asks.length}`);
  const rec = await s.call('argus_patterns', { view: 'all', today_override: LATER });
  const row = (rec.data?.contracts ?? []).find((c) => c.id === 'amb');
  ok('O6 거절은 기록을 남기지 않는다', row?.status === 'sealed' && !row?.outcome, JSON.stringify(row).slice(0, 160));
  ok('O6 거절에는 확인 줄도 붙지 않는다', !/아까 답해주신/.test(String(rec.surface ?? '')), String(rec.surface).slice(0, 160));
  await s.close();
}

// ── O7 · outcome picked, narration blank ⇒ nothing invented ─────────────────
{
  console.log('■ O7 결과만 고르고 서술을 비우면 — 날조하지 않고, 그 사실을 알려준다');
  const dir = path.join(base, 'o7');
  const s = await sitting({
    dir,
    answer: (p, n) => (n === 1 ? { action: 'accept', content: { outcome: 'held' } } : { action: 'accept', content: {} }),
  });
  await seedOverdue(s.call);
  await sleep(900);
  const rec = await s.call('argus_patterns', { view: 'all', today_override: LATER });
  const row = (rec.data?.contracts ?? []).find((c) => c.id === 'amb');
  ok('O7 현실 서술 없이는 종결 정산을 쓰지 않는다', row?.status === 'sealed' && !row?.outcome, JSON.stringify(row).slice(0, 160));
  ok('O7 사용자의 클릭이 허공으로 사라지지 않는다', /못 받았습니다|never arrived/.test(String(rec.surface ?? '')), String(rec.surface).slice(0, 220));
  await s.close();
}

// ── O8 · a question nobody saw must not cost the 4-hour cooldown ────────────
{
  console.log('■ O8 아무도 못 본 물음은 쿨다운을 쓰지 않는다');
  const dir = path.join(base, 'o8');
  const s = await sitting({ dir, answer: () => { throw new Error('elicitation declared but not implemented'); } });
  await seedOverdue(s.call);
  await sleep(700);
  ok('O8 시도는 했다', s.asks.length >= 1, `asks=${s.asks.length}`);
  const statePath = path.join(dir, 'ambient-elicit-state.json');
  const st = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : null;
  ok('O8 쿨다운이 되돌려진다 (다음 세션에서 다시 물을 수 있다)',
    st === null || typeof st.last_fired_at !== 'number',
    `state=${JSON.stringify(st)}`);
  const rec = await s.call('argus_patterns', { view: 'all', today_override: LATER });
  const row = (rec.data?.contracts ?? []).find((c) => c.id === 'amb');
  ok('O8 닿지 못한 물음이 기록을 만들지 않는다', row?.status === 'sealed' && !row?.outcome, JSON.stringify(row).slice(0, 160));
  await s.close();
}

fs.rmSync(base, { recursive: true, force: true });
console.log(`\n── ${checks} checks · ${violations.length} violation(s) ──`);
if (violations.length) {
  for (const v of violations) console.log('  ✗ ' + v);
  console.log('\n밖에서 뜨는 물음은 사용자가 부르지 않은 유일한 표면입니다. 여기 위반은 그대로 방해입니다.');
  process.exit(1);
}
console.log('부르지 않은 물음: 침묵할 때 침묵하고, 답을 받으면 기록하고, 그 결과를 돌려줍니다.');
