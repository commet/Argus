#!/usr/bin/env node
/**
 * dec-block.js (하지 않기로 한 일을 막는다) 실호출 테스트.
 *
 * 고정하는 계약:
 *  1. 엔진이 "막아라"라고 하면 **exit 2 + stderr** — 이게 유일하게 막는 자리다
 *  2. 엔진이 안 막으면 exit 0 · 아무 말 없음
 *  3. **판정을 못 하면 안 막는다** — 엔진 없음·죽음·쓰레기 응답 전부 통과
 *  4. 원장이 없으면 엔진도 안 부른다
 *  5. Bash 는 명령을, Write/Edit 은 파일을 보낸다 — 파일 **본문은 안 보낸다**
 *  6. 막는 글에 우회 방법이 없다 (훅이 친절을 보태지 않는다)
 *  7. PreToolUse 에 실제로 걸려 있다
 *
 * Run: node argus-plugin-v2/hooks/dec-block.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const DIR = dirname(fileURLToPath(import.meta.url));
const HOOK = join(DIR, 'dec-block.js');
const tmp = (p) => mkdtempSync(join(tmpdir(), p));

/** 엔진 대역. `raw` 를 주면 그 바이트를 그대로 낸다 (쓰레기 응답 시험용). */
function fakeEngine(reply, recordTo, { raw = null, die = false } = {}) {
  const dir = tmp('argus-fake-block-');
  const file = join(dir, 'engine.mjs');
  writeFileSync(file, [
    '#!/usr/bin/env node',
    "import { writeFileSync } from 'node:fs';",
    recordTo ? `writeFileSync(${JSON.stringify(recordTo)}, JSON.stringify(process.argv.slice(2)));` : '',
    die ? 'process.exit(3);' : `process.stdout.write(${JSON.stringify(raw ?? JSON.stringify(reply))});`,
  ].join('\n'), 'utf8');
  chmodSync(file, 0o755);
  return file;
}

function world({ withLedger = true } = {}) {
  const repo = tmp('argus-block-repo-');
  mkdirSync(join(repo, '.git'), { recursive: true });
  mkdirSync(join(repo, '.argus', 'ledger'), { recursive: true });
  if (withLedger) writeFileSync(join(repo, '.argus', 'ledger', 'ledger.jsonl'), '');
  return repo;
}

function runHook(repo, payload, bin) {
  const env = { ...process.env };
  if (bin) env.ARGUS_MCP_BIN = bin; else delete env.ARGUS_MCP_BIN;
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: 's1', cwd: repo, ...payload }),
    encoding: 'utf8', env,
  });
}

const DENY = {
  block: true,
  say: ['[아르고스] 여기서 하지 않기로 정해 둔 일이다.', '', '  D-0002  이름으로 프로세스를 죽이지 않는다.'],
};

let failures = 0;
function testCase(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL ${name}\n       ${error.message}`); }
}

console.log('dec-block (하지 않기로 한 일을 막는다)');

testCase('막으라고 하면 2 로 끝나고 이유가 stderr 로 나간다', () => {
  const repo = world();
  const r = runHook(repo, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'pkill claude' } },
    fakeEngine(DENY));
  assert.equal(r.status, 2, `막아야 하는데 ${r.status} 로 끝났다`);
  assert.ok(r.stderr.includes('하지 않기로 정해 둔 일'), `stderr 에 이유가 없다: ${r.stderr}`);
  assert.ok(r.stderr.includes('D-0002'));
});

testCase('안 막으면 조용히 0', () => {
  const repo = world();
  const r = runHook(repo, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } },
    fakeEngine({ block: false, say: [] }));
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim(), '');
  assert.equal(r.stdout.trim(), '');
});

testCase('엔진이 안 깔려 있으면 통과시킨다 (판정을 못 하면 못 막는다)', () => {
  const repo = world();
  const r = runHook(repo, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'pkill claude' } },
    join(repo, 'no-such-engine'));
  assert.equal(r.status, 0, '엔진이 없는데 막았다 — 사람의 하루가 멈춘다');
});

testCase('엔진이 죽어도 통과시킨다', () => {
  const repo = world();
  const r = runHook(repo, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'pkill claude' } },
    fakeEngine(null, null, { die: true }));
  assert.equal(r.status, 0);
});

testCase('엔진이 쓰레기를 뱉어도 통과시킨다', () => {
  const repo = world();
  for (const raw of ['이건 JSON 이 아니다', '{"block":"yes"}', '{}', '{"block":true}']) {
    const r = runHook(repo, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'x' } },
      fakeEngine(null, null, { raw }));
    assert.equal(r.status, 0, `"${raw}" 에 막혔다 — 말 없는 차단은 사람이 이유를 알 수 없다`);
  }
});

testCase('원장이 없으면 엔진도 안 부른다', () => {
  const repo = world({ withLedger: false });
  const record = join(repo, 'argv.json');
  const r = runHook(repo, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'pkill claude' } },
    fakeEngine(DENY, record));
  assert.equal(r.status, 0);
  assert.throws(() => readFileSync(record, 'utf8'), '아무것도 안 정했는데 엔진을 띄웠다');
});

testCase('Bash 는 명령을, Write 는 파일을 보낸다 — 본문은 안 보낸다', () => {
  const repo = world();
  const a = join(repo, 'a.json');
  runHook(repo, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'pkill claude' } },
    fakeEngine({ block: false, say: [] }, a));
  const argvA = JSON.parse(readFileSync(a, 'utf8'));
  assert.equal(argvA[0], 'dec-block');
  assert.equal(argvA[argvA.indexOf('--text') + 1], 'pkill claude');

  const b = join(repo, 'b.json');
  runHook(repo, {
    hook_event_name: 'PreToolUse', tool_name: 'Write',
    tool_input: { file_path: 'src/app/page.tsx', content: '비밀이 든 본문' },
  }, fakeEngine({ block: false, say: [] }, b));
  const argvB = JSON.parse(readFileSync(b, 'utf8'));
  assert.equal(argvB[argvB.indexOf('--file') + 1], 'src/app/page.tsx');
  assert.ok(!argvB.some((x) => String(x).includes('비밀이 든 본문')), '파일 본문이 인자로 샜다');
});

testCase('훅이 우회 방법을 보태지 않는다', () => {
  const repo = world();
  const r = runHook(repo, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'pkill claude' } },
    fakeEngine(DENY));
  for (const key of ['--force', '우회', '무시', '건너뛰', '끄려면', '대신']) {
    assert.ok(!r.stderr.includes(key), `막는 글이 "${key}" 를 가르친다`);
  }
});

testCase('PreToolUse 에 실제로 걸려 있다', () => {
  const hooks = JSON.parse(readFileSync(join(DIR, 'hooks.json'), 'utf8')).hooks;
  const entry = (hooks.PreToolUse || []).find((e) => JSON.stringify(e).includes('dec-block.js'));
  assert.ok(entry, 'hooks.json 의 PreToolUse 에 dec-block 이 없다');
  assert.ok(/Write/.test(entry.matcher) && /Edit/.test(entry.matcher) && /Bash/.test(entry.matcher),
    `matcher 가 셋을 다 안 받는다: ${entry.matcher}`);
});

console.log(failures === 0 ? '\ndec-block 계약 전부 통과' : `\n${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
