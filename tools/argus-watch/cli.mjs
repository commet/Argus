#!/usr/bin/env node
/**
 * argus-watch — 결정을 입력받는 앱이 아니라, 이미 일어난 대화에서 결정을 알아보는 눈.
 *
 *   scan     이미 나눈 Claude Code 대화에서 결정의 순간을 수확
 *   list     수확된 결정 후보 보기
 *   seal     후보를 반증 가능한 내기로 봉인 (check_by 날짜 포함)
 *   dismiss  "이건 내 결정이 아닌데" — 후보 기각 (기각도 기록됨)
 *   due      check_by가 도래한 내기 — "그래서, 어떻게 됐어요?"
 *   settle   내기 정산: happened | avoided | partial | pending
 *   ledger   원장 전체 보기 (정산 누적 = 자차표의 원료)
 *
 * 모든 데이터는 로컬(.argus/ledger/)에만 머문다. LLM 호출은 headless `claude -p`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseTranscript, segmentTurns, renderSegment, discoverTranscripts } from './lib/transcript.mjs';
import { detectDecisions, draftSeal } from './lib/detect.mjs';
import { pool } from './lib/llm.mjs';
import {
  appendEvent, loadLedger, loadScanState, saveScanState, dueBets, decisionId, ledgerDir, localToday,
} from './lib/ledger.mjs';

const C = {
  dim: s => `\x1b[2m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`, red: s => `\x1b[31m${s}\x1b[0m`,
};
const STAKES_MARK = { high: C.red('●'), medium: C.yellow('●'), low: C.dim('●') };

const repoRoot = findRepoRoot();
const [cmd, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

function findRepoRoot() {
  let d = process.cwd();
  while (d !== '/') {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    d = path.dirname(d);
  }
  return process.cwd();
}
function parseFlags(args) {
  const f = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const k = args[i].slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) { f[k] = args[++i]; }
      else f[k] = true;
    } else f._.push(args[i]);
  }
  return f;
}
const short = (s, n = 72) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// ───────────────────────── commands ─────────────────────────

async function cmdScan() {
  const all = !!flags['all-projects'];
  const sinceDays = flags.since ? Number(flags.since) : null;
  const model = flags.model || 'sonnet';
  const concurrency = flags.concurrency ? Number(flags.concurrency) : 4;
  const files = discoverTranscripts({ all, projectDir: flags.project || process.cwd() })
    .filter(f => !sinceDays || f.mtime > Date.now() - sinceDays * 86400_000);

  if (!files.length) { console.log('읽을 대화 기록이 없어요.'); return; }

  const state = loadScanState(repoRoot);
  const ledger = loadLedger(repoRoot);
  let newDecisions = 0, skippedFiles = 0;

  // collect fresh segments across all changed files
  // resume anchor = USER-turn count: assistant turns can merge across reparses
  // (unstable indices), but USER turns never merge, so their count is stable.
  const jobs = [];
  const prevStates = new Map(); // for restoring state on per-file failure
  for (const { file, project } of files) {
    const stat = fs.statSync(file);
    const prev = state.files[file];
    if (prev && prev.size === stat.size) { skippedFiles++; continue; } // unchanged
    prevStates.set(file, prev);
    const { sessionId, turns } = parseTranscript(file);
    const userIdxs = turns.map((t, i) => (t.role === 'USER' ? i : -1)).filter(i => i >= 0);
    const prevUsers = prev ? (prev.userTurns ?? 0) : 0;
    let fresh = [];
    if (prevUsers === 0) fresh = turns;
    else if (prevUsers < userIdxs.length) {
      // slice from one turn before the first unseen USER turn (assistant context)
      fresh = turns.slice(Math.max(0, userIdxs[prevUsers] - 1));
    }
    if (fresh.some(t => t.role === 'USER')) {
      for (const seg of segmentTurns(fresh)) jobs.push({ file, project, sessionId, seg });
    }
    state.files[file] = { size: stat.size, userTurns: userIdxs.length, scanned_at: new Date().toISOString() };
  }

  if (!jobs.length) {
    saveScanState(repoRoot, state);
    console.log(`살펴봤어요${skippedFiles ? ` (변화 없는 파일 ${skippedFiles}개 건너뜀)` : ''}. 새 대화가 없어요.`);
    return;
  }

  console.log(C.dim(`대화 구간 ${jobs.length}개를 살펴봅니다 (동시 ${concurrency})…`));
  let done = 0;
  const results = await pool(jobs, async (job) => {
    const decisions = await detectDecisions(renderSegment(job.seg), { model });
    done++;
    process.stderr.write(C.dim(`\r  ${done}/${jobs.length} 구간 읽음`));
    return decisions;
  }, concurrency);
  process.stderr.write('\n');

  let failedSegs = 0;
  results.forEach((decisions, i) => {
    const job = jobs[i];
    if (!Array.isArray(decisions)) { failedSegs++; return; }
    for (const d of decisions) {
      const id = decisionId(job.sessionId, d.quote);
      if (ledger.has(id)) continue; // already harvested
      const decided_at = job.seg.find(t => t.role === 'USER')?.ts ?? null;
      appendEvent(repoRoot, { event: 'harvest', id, project: job.project, session: job.sessionId, decided_at, ...d });
      ledger.set(id, { ...d, id, status: 'candidate' });
      newDecisions++;
      console.log(`  ${STAKES_MARK[d.stakes]} ${C.bold(id)} ${short(d.decision)} ${C.dim(`(${d.type})`)}`);
    }
  });
  if (failedSegs) console.log(C.dim(`  (구간 ${failedSegs}개 감지 실패 — 다음 scan에서 재시도돼요)`));
  // restore previous resume anchor for files with failed segments, so failures retry
  if (failedSegs) {
    const failedFiles = new Set(results.map((r, i) => (!Array.isArray(r) ? jobs[i].file : null)).filter(Boolean));
    for (const f of failedFiles) {
      const prev = prevStates.get(f);
      if (prev) state.files[f] = prev; else delete state.files[f];
    }
  }
  saveScanState(repoRoot, state);

  console.log('');
  if (newDecisions === 0) {
    console.log(`살펴봤어요 (구간 ${jobs.length}개${skippedFiles ? `, 변화 없는 파일 ${skippedFiles}개 건너뜀` : ''}). 새로 알아본 결정은 없어요.`);
  } else {
    console.log(`${C.bold(String(newDecisions))}개의 결정을 알아봤어요. ${C.cyan('argus-watch list')}로 보고, ${C.cyan('argus-watch seal <id>')}로 봉인할 수 있어요.`);
  }
}

function cmdList() {
  const ledger = loadLedger(repoRoot);
  const status = flags.status || 'candidate';
  const items = [...ledger.values()].filter(d => status === 'all' || d.status === status);
  if (!items.length) { console.log(status === 'candidate' ? '대기 중인 결정 후보가 없어요.' : `(${status}) 항목이 없어요.`); return; }
  console.log(C.bold(`${statusLabel(status)} ${items.length}건\n`));
  for (const d of items) {
    console.log(`${STAKES_MARK[d.stakes] ?? ''} ${C.bold(d.id)} ${C.dim(`[${d.project ?? '?'} · ${(d.decided_at ?? '').slice(0, 10)}]`)}`);
    console.log(`   ${d.decision}`);
    console.log(`   ${C.dim(`"${short(d.quote, 100)}"`)}`);
    if (d.status === 'sealed' || d.status === 'settled') {
      console.log(`   ${C.cyan('내기:')} ${d.predicate}`);
      console.log(`   ${C.cyan('반증 신호:')} ${d.falsified_if} ${C.dim(`(check_by ${d.check_by})`)}`);
    }
    if (d.status === 'settled') console.log(`   ${C.green(`정산: ${d.outcome}`)} ${d.settle_note ? C.dim(d.settle_note) : ''}`);
    console.log('');
  }
}
function statusLabel(s) {
  return { candidate: '결정 후보', sealed: '봉인된 내기', settled: '정산 완료', dismissed: '기각됨', all: '전체' }[s] ?? s;
}

async function cmdSeal() {
  const id = flags._[0];
  if (!id) { console.error('usage: argus-watch seal <id> [--check-by YYYY-MM-DD]'); process.exit(1); }
  const ledger = loadLedger(repoRoot);
  const d = ledger.get(id);
  if (!d) { console.error(`${id}: 모르는 id예요.`); process.exit(1); }
  if (d.status !== 'candidate') {
    console.error(`${id}: ${statusLabel(d.status)} 상태예요. 봉인은 후보(candidate)만 가능해요. 수정은 amend로.`);
    process.exit(1);
  }

  console.log(C.dim('내기를 초안하는 중…'));
  let draft;
  try {
    draft = await draftSeal(d, null, { model: flags.model || 'sonnet' });
  } catch {
    draft = { predicate: d.decision, falsified_if: '(직접 적어주세요)', check_by: localToday(21) };
  }
  if (flags['check-by']) draft.check_by = flags['check-by'];
  if (flags.predicate) draft.predicate = flags.predicate;
  if (flags['falsified-if']) draft.falsified_if = flags['falsified-if'];

  appendEvent(repoRoot, { event: 'seal', id, ...draft });
  console.log(`${C.green('봉인했어요.')}`);
  console.log(`   ${C.cyan('내기:')} ${draft.predicate}`);
  console.log(`   ${C.cyan('틀렸다면:')} ${draft.falsified_if}`);
  console.log(`   ${C.cyan('확인일:')} ${draft.check_by} — 그날 다시 물어볼게요. ${C.dim('"그래서, 어떻게 됐어요?"')}`);
}

function cmdAmend() {
  const id = flags._[0];
  if (!id) { console.error('usage: argus-watch amend <id> [--predicate ..] [--falsified-if ..] [--check-by ..]'); process.exit(1); }
  const ledger = loadLedger(repoRoot);
  const d = ledger.get(id);
  if (!d || d.status !== 'sealed') { console.error(`${id}: 봉인된 내기가 아니에요.`); process.exit(1); }
  appendEvent(repoRoot, {
    event: 'amend', id,
    predicate: flags.predicate, 'falsified_if': flags['falsified-if'], check_by: flags['check-by'],
  });
  console.log('변침을 기록했어요. (원래 내기도 이력에 남아요 — 조용한 덮어쓰기는 없어요)');
}

function cmdDismiss() {
  const id = flags._[0];
  if (!id) { console.error('usage: argus-watch dismiss <id> [--reason ..]'); process.exit(1); }
  const ledger = loadLedger(repoRoot);
  const d = ledger.get(id);
  if (!d) { console.error(`${id}: 모르는 id예요.`); process.exit(1); }
  if (d.status !== 'candidate') {
    console.error(`${id}: ${statusLabel(d.status)} 상태예요. 기각은 후보(candidate)만 가능해요.`);
    process.exit(1);
  }
  appendEvent(repoRoot, { event: 'dismiss', id, reason: flags.reason });
  console.log('기각했어요. (이것도 감지기 학습 자료가 돼요)');
}

function cmdDue() {
  const ledger = loadLedger(repoRoot);
  const due = dueBets(ledger);
  // --quiet: hook mode (세션 시작 due 인사) — nothing due means say NOTHING.
  // A greeting that fires every session with "없어요" is nagging, not presence.
  if (!due.length) { if (!flags.quiet) console.log('확인일이 된 내기가 없어요.'); return; }
  console.log(C.bold(`그래서, 어떻게 됐어요? — ${due.length}건\n`));
  for (const d of due) {
    console.log(`${STAKES_MARK[d.stakes] ?? ''} ${C.bold(d.id)} ${C.dim(`(check_by ${d.check_by}, ${d.project ?? '?'})`)}`);
    console.log(`   당시 결정: ${d.decision}`);
    console.log(`   내기: ${d.predicate}`);
    console.log(`   틀렸다면: ${d.falsified_if}`);
    console.log(`   → ${C.cyan(`argus-watch settle ${d.id} happened|avoided|partial|pending`)}\n`);
  }
}

/** nudge — Stop-hook mode (세션 끝 수확 제안). Silent by default; speaks ONE
 *  line only when there's something real: transcripts grew past the last scan
 *  (suggest harvest), or sealed bets came due (point at them). Never both —
 *  due wins. No LLM calls; pure file-stat check. */
function cmdNudge() {
  const ledger = loadLedger(repoRoot);
  const due = dueBets(ledger);
  if (due.length) {
    console.log(`그래서, 어떻게 됐어요? — 확인일 된 결정 ${due.length}건: ${C.cyan('argus-watch due')}`);
    return;
  }
  const state = loadScanState(repoRoot);
  const files = discoverTranscripts({ all: false, projectDir: process.cwd() });
  const grown = files.filter(({ file }) => {
    try {
      const prev = state.files[file];
      return !prev || fs.statSync(file).size > prev.size;
    } catch { return false; }
  });
  if (grown.length) {
    console.log(`오늘 대화에 아직 안 거둔 결정이 있을 수 있어요: ${C.cyan('argus-watch scan')}`);
  }
  // nothing new → silence is the output.
}

function cmdSettle() {
  const [id, outcome] = flags._;
  const valid = ['happened', 'avoided', 'partial', 'pending'];
  if (!id || !valid.includes(outcome)) {
    console.error(`usage: argus-watch settle <id> <${valid.join('|')}> [--note ..]`); process.exit(1);
  }
  const ledger = loadLedger(repoRoot);
  const d = ledger.get(id);
  if (!d || d.status !== 'sealed') { console.error(`${id}: 봉인된 내기가 아니에요.`); process.exit(1); }
  if (outcome === 'pending') {
    const next = flags['check-by'] || localToday(14);
    appendEvent(repoRoot, { event: 'amend', id, check_by: next });
    console.log(`아직이군요. ${next}에 다시 물어볼게요.`);
    return;
  }
  appendEvent(repoRoot, { event: 'settle', id, outcome, note: flags.note });
  const settled = [...ledger.values()].filter(x => x.status === 'settled').length + 1;
  console.log(`기록했어요. ${C.dim(`(정산 누적 ${settled}건 — 5건부터 자차표가 의미를 갖기 시작해요)`)}`);
}

function cmdLedger() {
  const ledger = loadLedger(repoRoot);
  const all = [...ledger.values()];
  if (!all.length) { console.log(`원장이 비어 있어요. ${C.cyan('argus-watch scan')}부터.`); return; }
  const by = s => all.filter(d => d.status === s);
  console.log(C.bold('— 항해 원장 —\n'));
  console.log(`  후보 ${by('candidate').length} · 봉인 ${by('sealed').length} · 정산 ${by('settled').length} · 기각 ${by('dismissed').length}`);
  const settled = by('settled');
  if (settled.length) {
    const o = k => settled.filter(d => d.outcome === k).length;
    console.log(`\n  정산 결과: 발생 ${o('happened')} · 회피 ${o('avoided')} · 부분 ${o('partial')}`);
    if (settled.length >= 5) {
      const wrong = o('avoided');
      console.log(C.dim(`\n  자차표 초기 신호: ${settled.length}번의 내기 중 ${wrong}번, 예측과 다른 곳에 도착했어요.`));
      console.log(C.dim('  (종류별 편차 분석은 정산이 더 쌓이면 — 데이터 없는 자차표는 빈 거울이라)'));
    } else {
      console.log(C.dim(`\n  자차표까지 ${5 - settled.length}건 남았어요.`));
    }
  }
  console.log(C.dim(`\n  원장 위치: ${ledgerDir(repoRoot)} (로컬 전용)`));
}

// ─────────────────────── push to webapp ───────────────────────
// The plugin's results live in local .argus/ files. `connect` saves a personal
// access token (issued in the webapp's Settings) once; `push` ships the ledger
// + voyage bearings to the webapp so every web channel (Slack/Telegram/email)
// can share them — instead of hand-uploading JSON through the /import page.

function pushConfigFile() { return path.join(ledgerDir(repoRoot), 'push.json'); }

function loadPushConfig() {
  // Precedence: flags > env > saved config file. (.argus/ledger/ is gitignored,
  // so the saved token never lands in version control.)
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(pushConfigFile(), 'utf8')); } catch { /* none */ }
  return {
    token: flags.token || process.env.ARGUS_PUSH_TOKEN || cfg.token || null,
    url: (flags.url || process.env.ARGUS_PUSH_URL || cfg.url || 'https://argus.voyage').replace(/\/$/, ''),
  };
}

function cmdConnect() {
  const token = flags.token || flags._[0];
  if (!token) {
    console.error('usage: argus-watch connect --token <argus_pat_…> [--url https://argus.voyage]');
    console.error('토큰은 웹앱 설정 → 연동 & 데이터 → "플러그인 푸시 토큰"에서 발급해요.');
    process.exit(1);
  }
  const url = (flags.url || process.env.ARGUS_PUSH_URL || 'https://argus.voyage').replace(/\/$/, '');
  fs.mkdirSync(ledgerDir(repoRoot), { recursive: true });
  fs.writeFileSync(pushConfigFile(), JSON.stringify({ token, url }, null, 2));
  console.log(`${C.green('연결됐어요.')} 이제 ${C.cyan('argus-watch push')}로 결과를 웹앱에 보낼 수 있어요.`);
  console.log(C.dim(`   (토큰은 ${pushConfigFile()} 에 저장 — gitignored)`));
}

/** Collect current_bearing.json files anywhere under .argus/sessions/. */
function findBearingFiles() {
  const root = path.join(repoRoot, '.argus', 'sessions');
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (e.name === 'current_bearing.json') found.push(full);
    }
  };
  walk(root, 0);
  return found;
}

async function cmdPush() {
  const { token, url } = loadPushConfig();
  if (!token) {
    console.error('아직 연결되지 않았어요. 먼저:');
    console.error(`  ${C.cyan('argus-watch connect --token <argus_pat_…>')}`);
    console.error('  (토큰은 웹앱 설정 → 연동 & 데이터에서 발급)');
    process.exit(1);
  }

  const files = [];
  const ledgerPath = path.join(ledgerDir(repoRoot), 'ledger.jsonl');
  if (fs.existsSync(ledgerPath)) {
    files.push({ name: 'ledger.jsonl', content: fs.readFileSync(ledgerPath, 'utf8') });
  }
  for (const bp of findBearingFiles()) {
    files.push({ name: path.relative(repoRoot, bp), content: fs.readFileSync(bp, 'utf8') });
  }

  if (!files.length) {
    console.log('보낼 게 없어요 — 아직 봉인된 결정도, 항해 기록(current_bearing.json)도 없어요.');
    return;
  }

  console.log(C.dim(`${files.length}개 파일을 ${url} 로 보내는 중…`));
  let res, data;
  try {
    res = await fetch(`${url}/api/plugin/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ files }),
    });
    data = await res.json().catch(() => ({}));
  } catch (err) {
    console.error(C.red(`전송 실패: ${err.message}`));
    process.exit(1);
  }

  if (!res.ok) {
    console.error(C.red(`전송 실패 (${res.status}): ${data.error || '알 수 없는 오류'}`));
    if (res.status === 401) console.error('토큰이 만료/무효일 수 있어요. 설정에서 새로 발급하고 다시 connect 하세요.');
    process.exit(1);
  }

  const s = data.summary || {};
  console.log(`${C.green('보냈어요.')} 결정 ${s.decisions?.written ?? 0}건 · 항해 기록 ${s.bearings?.written ?? 0}건이 웹앱에 도착했어요.`);
  if (s.skipped?.length) console.log(C.dim(`   건너뜀: ${s.skipped.length}개 (형식 불일치)`));
  console.log(C.dim(`   웹앱에서 열어보기: ${url}/import`));
}

// ───────────────────────── main ─────────────────────────

const HELP = `argus-watch — 이미 일어난 대화에서 결정을 알아보는 눈

  scan [--all-projects] [--project dir] [--since days] [--model m]
  list [--status candidate|sealed|settled|dismissed|all]
  seal <id> [--check-by YYYY-MM-DD] [--predicate ..] [--falsified-if ..]
  amend <id> [--predicate ..] [--falsified-if ..] [--check-by ..]
  dismiss <id> [--reason ..]
  due [--quiet]
  nudge                  (훅용 — 새 결정 후보·확인일 있을 때만 한 줄, 아니면 침묵)
  settle <id> <happened|avoided|partial|pending> [--note ..]
  ledger
  connect --token <argus_pat_…> [--url ..]   웹앱 푸시 토큰 저장 (설정에서 발급)
  push                                        결정·항해 기록을 웹앱으로 전송

데이터는 .argus/ledger/ (로컬 전용, git 제외)에만 저장돼요.
push는 명시적으로 실행할 때만 선택한 결과를 웹앱(본인 계정)으로 보냅니다.`;

const commands = {
  scan: cmdScan, list: cmdList, seal: cmdSeal, amend: cmdAmend,
  dismiss: cmdDismiss, due: cmdDue, nudge: cmdNudge, settle: cmdSettle, ledger: cmdLedger,
  connect: cmdConnect, push: cmdPush,
};
if (!cmd || !commands[cmd]) { console.log(HELP); process.exit(cmd ? 1 : 0); }
await commands[cmd]();
