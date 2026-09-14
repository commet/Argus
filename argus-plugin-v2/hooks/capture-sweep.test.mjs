#!/usr/bin/env node
/**
 * capture-sweep.js (Stop 훅 — 대화 수집 자동 기동) 실호출 테스트.
 *
 * 고정하는 계약 (하나라도 깨지면 N6 은 "손으로 쳐야 도는 기능"으로 돌아간다):
 *  1. 동의(opt-in)가 있고 오늘 안 돌았으면 → 엔진의 `capture-drain` 을 부른다
 *  2. 인자가 정확하다 — 작업 공간의 .argus · 플러그인 데이터 자리 · 오늘 날짜
 *  3. 동의 없음 · 오늘 이미 돎 · 데이터 자리 없음 · 저장소 밖 → **안 부른다**
 *  4. 어느 경우에도 stdout 은 완전히 비어 있다 (수집은 조용한 일이다)
 *  5. 어느 경우에도 exit 0 (훅이 세션을 세금으로 만들지 않는다)
 *  6. 기동 실패는 조용히 삼키지 않고 상태 파일에 남는다
 *  7. 훅은 기다리지 않는다 — 엔진이 느려도 훅은 즉시 끝난다
 *
 * Run: node argus-plugin-v2/hooks/capture-sweep.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const DIR = dirname(fileURLToPath(import.meta.url));
const HOOK = join(DIR, 'capture-sweep.js');
const today = () => {
  const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function tmp(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }

/** 엔진 대역 — 받은 인자를 파일로 떨궈서 "정말 불렸나"를 증거로 남긴다. */
function fakeEngine(recordTo, { sleepMs = 0 } = {}) {
  const dir = tmp('argus-fake-engine-');
  const file = join(dir, 'engine.mjs');
  writeFileSync(file, [
    '#!/usr/bin/env node',
    "import { writeFileSync } from 'node:fs';",
    sleepMs ? `await new Promise((r) => setTimeout(r, ${sleepMs}));` : '',
    `writeFileSync(${JSON.stringify(recordTo)}, JSON.stringify(process.argv.slice(2)));`,
  ].join('\n'), 'utf8');
  chmodSync(file, 0o755);
  return file;
}

/** 훅이 돌 수 있는 최소 세계: 저장소 · 홈 · 플러그인 데이터 자리. */
function world({ optIn = true, ranToday = false } = {}) {
  const repo = tmp('argus-sweep-repo-');
  mkdirSync(join(repo, '.git'), { recursive: true });
  mkdirSync(join(repo, '.argus'), { recursive: true });
  const home = tmp('argus-sweep-home-');
  if (optIn) writeFileSync(join(home, 'config.json'), JSON.stringify({ harvest: { opt_in: true } }));
  const dataDir = tmp('argus-sweep-data-');
  if (ranToday) writeFileSync(join(dataDir, 'harvest-last-run.json'), JSON.stringify({ date: today() }));
  return { repo, home, dataDir };
}

function runHook({ repo, home, dataDir, bin }, { withData = true } = {}) {
  const env = { ...process.env, ARGUS_HOME: home };
  if (withData) env.CLAUDE_PLUGIN_DATA = dataDir; else delete env.CLAUDE_PLUGIN_DATA;
  if (bin) env.ARGUS_MCP_BIN = bin; else delete env.ARGUS_MCP_BIN;
  const started = Date.now();
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: 's1', transcript_path: join(repo, 't.jsonl'), cwd: repo, hook_event_name: 'Stop' }),
    encoding: 'utf8', env,
  });
  assert.equal(r.status, 0, `훅은 언제나 0으로 끝나야 한다 (stderr: ${r.stderr})`);
  assert.equal(r.stdout, '', `훅은 아무것도 출력하지 않아야 한다 (실제: ${JSON.stringify(r.stdout)})`);
  return { elapsed: Date.now() - started };
}

/** 떼어낸 자식이 파일을 남길 때까지 기다린다 (없으면 false). */
function waitFor(file, ms = 4000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (existsSync(file)) return true;
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},40)']); // ~40ms 대기
  }
  return existsSync(file);
}

let failures = 0;
function testCase(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL ${name}\n       ${error.message}`); }
}

console.log('capture-sweep (Stop 훅 — 대화 수집 자동 기동)');

testCase('동의가 있고 오늘 안 돌았으면 capture-drain 을 부른다 — 인자까지 정확히', () => {
  const w = world();
  const record = join(w.dataDir, 'engine-argv.json');
  runHook({ ...w, bin: fakeEngine(record) });
  assert.ok(waitFor(record), '엔진이 불리지 않았다');
  const argv = JSON.parse(readFileSync(record, 'utf8'));
  assert.equal(argv[0], 'capture-drain');
  assert.equal(argv[argv.indexOf('--argus-dir') + 1], join(w.repo, '.argus'));
  assert.equal(argv[argv.indexOf('--data-dir') + 1], w.dataDir);
  assert.equal(argv[argv.indexOf('--today') + 1], today());
});

testCase('동의가 없으면 부르지 않는다 (수집은 명시 동의 위에서만 돈다)', () => {
  const w = world({ optIn: false });
  const record = join(w.dataDir, 'engine-argv.json');
  runHook({ ...w, bin: fakeEngine(record) });
  assert.equal(existsSync(record), false, '동의 없이 엔진이 불렸다');
});

testCase('오늘 이미 돌았으면 프로세스조차 띄우지 않는다 (Stop 은 턴마다 온다)', () => {
  const w = world({ ranToday: true });
  const record = join(w.dataDir, 'engine-argv.json');
  runHook({ ...w, bin: fakeEngine(record) });
  assert.equal(existsSync(record), false, '하루 한 번 규율이 깨졌다');
});

testCase('플러그인 데이터 자리가 없으면 침묵한다 (비울 큐가 없다)', () => {
  const w = world();
  const record = join(w.dataDir, 'engine-argv.json');
  runHook({ ...w, bin: fakeEngine(record) }, { withData: false });
  assert.equal(existsSync(record), false);
});

testCase('저장소 밖에서는 부르지 않는다', () => {
  const w = world();
  const outside = tmp('argus-sweep-outside-');
  const record = join(w.dataDir, 'engine-argv.json');
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: 's1', cwd: outside, hook_event_name: 'Stop' }),
    encoding: 'utf8',
    env: { ...process.env, ARGUS_HOME: w.home, CLAUDE_PLUGIN_DATA: w.dataDir, ARGUS_MCP_BIN: fakeEngine(record) },
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(existsSync(record), false);
});

testCase('기동에 실패하면 조용히 넘어가지 않고 상태 파일에 남는다', () => {
  const w = world();
  runHook({ ...w, bin: join(w.repo, 'does-not-exist-engine') });
  const statePath = join(w.dataDir, 'capture-sweep-state.json');
  assert.ok(waitFor(statePath), '상태 파일이 없다');
  // spawn 의 error 는 비동기로 온다 — 잠깐 더 기다렸다가 읽는다.
  let state = JSON.parse(readFileSync(statePath, 'utf8'));
  for (let i = 0; i < 40 && !state.last_error; i += 1) {
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},40)']);
    state = JSON.parse(readFileSync(statePath, 'utf8'));
  }
  assert.ok(state.last_error, '기동 실패가 어디에도 안 남았다');
});

testCase('엔진이 느려도 훅은 기다리지 않는다 (5초 예산을 먹지 않는다)', () => {
  const w = world();
  const record = join(w.dataDir, 'engine-argv.json');
  const { elapsed } = runHook({ ...w, bin: fakeEngine(record, { sleepMs: 3000 }) });
  assert.ok(elapsed < 2000, `훅이 엔진을 기다렸다 (${elapsed}ms)`);
  assert.ok(waitFor(record, 6000), '떼어낸 엔진이 끝내 돌지 않았다');
});

testCase('훅이 hooks.json 의 Stop 에 실제로 걸려 있다 (안 걸린 훅은 안 도는 훅이다)', () => {
  const cfg = JSON.parse(readFileSync(join(DIR, 'hooks.json'), 'utf8'));
  const stop = (cfg.hooks && cfg.hooks.Stop) || [];
  const commands = stop.flatMap((entry) => (entry.hooks || []).map((h) => h.command || ''));
  assert.ok(
    commands.some((c) => c.includes('capture-sweep.js')),
    'hooks.json 의 Stop 에 capture-sweep.js 가 없다 — 파일만 있고 배선이 없는 상태다',
  );
});

if (failures) { console.error(`\n${failures}건 실패`); process.exit(1); }
console.log('\ncapture-sweep 계약 전부 통과');
