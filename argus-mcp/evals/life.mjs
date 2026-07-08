/**
 * Life loop — 75 simulated days of cohabitation. Deterministic, no API key.
 *
 *   npm run life
 *
 * The contract loop asks "is each answer correct?"; the experience loop asks
 * "did a persona like it?". THIS loop asks the background-service question
 * neither can: **what is it like to LIVE next to Argus for 75 days** — does it
 * nag, does it stay quiet when nothing is due, does an overdue item escalate
 * with information or just repeat, does the house go silent after everything
 * is settled? A Korean solo founder's calendar is simulated day by day
 * (today_override = the harness owns the clock); every daily glance
 * (argus_check_in + the ambient line on a working call) is recorded and
 * measured for pressure:
 *
 *   - nag streak: max run of consecutive days with the VERBATIM same check_in
 *     line while the user ignores it (repetition without new information)
 *   - quiet quality: on days with nothing due, is the surface actually short
 *     and pressure-free?
 *   - overdue voice: while a contract sits overdue, does the surface carry
 *     growing information (day counts) or a frozen line?
 *   - post-settle silence: after the last item closes, does Argus go quiet
 *     FOREVER (restraint) or keep finding reasons to talk?
 *   - dignity: the 'missed' settle and the days after — verdict-language lint.
 *
 * Findings print as observations (this is an observatory, not a gate).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { detectVerdictLeak } from '../dist/lib/surface-lint.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');

const DAY0 = new Date('2026-07-02T00:00:00Z');
const day = (n) => new Date(DAY0.getTime() + n * 86400000).toISOString().slice(0, 10);

async function main() {
  if (!fs.existsSync(DIST)) execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-life-'));
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  env.ARGUS_DIR = dir;

  const client = new Client({ name: 'argus-life-loop', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));
  const call = async (name, args) => {
    const r = await client.callTool({ name, arguments: { argus_dir: dir, ...args } });
    return r.structuredContent ?? {};
  };

  // ── the user's sparse real actions (a busy founder, not a diarist) ───────
  // d0: one real decision sealed + its living premise + one open question
  await call('argus_seal', { id: 'launch', predicate: '신규 요금제 출시 후 30일 내 이탈률이 지금 수준을 유지한다', check_by: day(30), predicate_owner: 'user', unverified_assumption: '경쟁사가 3분기 안에 가격을 내리지 않는다', today_override: day(0) });
  await call('argus_premises', { id: 'launch', op: 'add', today_override: day(0), premises: [
    { text: '결제사 수수료율이 연말까지 동결된다', kind: 'premise', external: true, load_bearing: true, source: 'user' },
    { text: '엔터프라이즈 플랜을 분리할지 말지', kind: 'open_question', source: 'user', reponder_cadence_days: 21 },
  ] });
  // d3: a second bet
  await call('argus_seal', { id: 'hire', predicate: '개발 리드 채용이 9월 1일 전에 끝난다', check_by: day(61), predicate_owner: 'user', today_override: day(3) });

  const userActs = {
    [day(33)]: async () => call('argus_settle', { id: 'launch', outcome: 'missed', outcome_source: 'user_stated', what_happened: '이탈률이 2%p 올랐다. 요금제 안내 부족이 컸다.', today_override: day(33) }),
    [day(34)]: async () => call('argus_recheck', { id: 'launch', ref: 'P2', finding: '결제사 수수료 동결 공지 확인', source: 'url', source_detail: 'https://pg.example/notice', today_override: day(34) }),
    [day(40)]: async () => call('argus_premises', { id: 'launch', op: 'still_open', ref: 'P3', today_override: day(40) }),
    [day(62)]: async () => call('argus_premises', { id: 'launch', op: 'resolve', ref: 'P3', decision: '분리 안 한다. 볼륨 디스카운트로 간다.', today_override: day(62) }),
    [day(63)]: async () => call('argus_settle', { id: 'hire', outcome: 'held', outcome_source: 'user_stated', what_happened: '8월 중순에 오퍼 수락받았다.', today_override: day(63) }),
  };

  // ── 75 daily glances, recorded ────────────────────────────────────────────
  const days = [];
  for (let n = 1; n <= 75; n++) {
    const d = day(n);
    if (userActs[d]) await userActs[d]();
    const ci = await call('argus_check_in', { today_override: d });
    const bearing = await call('argus_recall', { view: 'bearing', today_override: d });
    days.push({
      n, d,
      surface: String(ci.surface ?? ''),
      due: (ci.data?.due_count ?? 0) + (ci.data?.due_premise_count ?? 0) + (ci.data?.due_open_question_count ?? 0),
      ambient: typeof bearing.data?.due_note === 'string' ? bearing.data.due_note : '',
    });
  }
  await client.close();
  fs.rmSync(dir, { recursive: true, force: true });

  // ── measurements ──────────────────────────────────────────────────────────
  let maxStreak = 0, streak = 0, prev = null, streakEnd = null, run = [];
  for (const x of days) {
    if (x.due > 0 && x.surface === prev) { streak++; run.push(x.n); } else { streak = x.due > 0 ? 1 : 0; run = x.due > 0 ? [x.n] : []; }
    prev = x.due > 0 ? x.surface : null;
    if (streak > maxStreak) { maxStreak = streak; streakEnd = { days: [...run], line: x.surface }; }
  }
  const quietDays = days.filter((x) => x.due === 0);
  const noisyQuiet = quietDays.filter((x) => x.surface.length > 120 || /(!|하세요|해보세요)/.test(x.surface.replace(/argus_\w+/g, '')));
  const overdueWin = days.filter((x) => x.n >= 31 && x.n <= 33).map((x) => x.surface);
  const overdueFrozen = overdueWin.length === 3 && overdueWin[0] === overdueWin[1] && overdueWin[1] === overdueWin[2];
  const postClose = days.filter((x) => x.n >= 64);
  const postCloseTalkative = postClose.filter((x) => x.due > 0 || x.ambient);
  const verdictLeaks = days.map((x) => ({ d: x.d, leak: detectVerdictLeak(x.surface) })).filter((x) => x.leak);

  // ── report (print the actual lines — the loop's whole lesson: READ them) ──
  const pick = (n) => days.find((x) => x.n === n);
  console.log(`\nArgus life loop · 75 days · 2 decisions · 1 premise · 1 open question`);
  console.log(`\n  a quiet day       (d${quietDays[0]?.n ?? '-'}): "${quietDays[0]?.surface ?? ''}"`);
  console.log(`  first premise-due (d21): "${pick(21)?.surface}"`);
  console.log(`  overdue day 1     (d31): "${pick(31)?.surface}"`);
  console.log(`  overdue day 3     (d33 pre-settle): "${pick(33)?.surface}"`);
  console.log(`  after missed      (d35): "${pick(35)?.surface}"`);
  console.log(`  after everything  (d70): "${pick(70)?.surface}"`);
  console.log(`\n  ── pressure measurements ──`);
  console.log(`  identical-line nag streak (max)   : ${maxStreak} day(s) ${maxStreak > 5 ? '← flat repetition, no decay/variation' : ''}`);
  if (maxStreak > 5 && streakEnd) console.log(`    frozen window d${streakEnd.days[0]}–d${streakEnd.days[streakEnd.days.length - 1]}: "${streakEnd.line.slice(0, 200)}"`);
  console.log(`  quiet days                        : ${quietDays.length}/75 · noisy-quiet: ${noisyQuiet.length} ${noisyQuiet.length ? '← pushes action on a quiet day' : '(quiet stays quiet ✓)'}`);
  console.log(`  overdue voice d31→d33             : ${overdueFrozen ? 'FROZEN — same line 3 days, no new information' : 'carries changing information ✓'}`);
  console.log(`  post-close (d64-75) talkative days: ${postCloseTalkative.length}/12 ${postCloseTalkative.length === 0 ? '(the house goes silent ✓)' : '← still finds reasons to talk'}`);
  console.log(`  verdict-language on any day       : ${verdictLeaks.length === 0 ? '0 ✓' : verdictLeaks.map((x) => `${x.d}:"${x.leak}"`).join(' ')}`);
  console.log(`\nObservatory only — record findings in evals/POLISH-BACKLOG.md or fix directly.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
