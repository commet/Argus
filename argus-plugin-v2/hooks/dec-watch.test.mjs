#!/usr/bin/env node
/**
 * dec-watch.js (어긋나면 한 줄 알린다) 실호출 테스트.
 *
 * 고정하는 계약:
 *  1. 파일을 고쳐서 걸리면 그 줄이 나온다 · 말이 걸려도 나온다
 *  2. **막지 않는다** — 언제나 exit 0, 종료 코드 2 를 쓰지 않는다
 *  3. 엔진이 "말한 게 아니다"라고 하면 아무것도 안 낸다
 *  4. 원장이 없으면 **엔진도 안 부른다** (편집마다 오는 훅이다)
 *  5. 오늘 몫을 다 썼으면 엔진도 안 부른다
 *  6. 두 자리(PostToolUse·UserPromptSubmit)에 실제로 걸려 있다
 *
 * Run: node argus-plugin-v2/hooks/dec-watch.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const DIR = dirname(fileURLToPath(import.meta.url));
const HOOK = join(DIR, 'dec-watch.js');
const today = () => {
  const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const tmp = (p) => mkdtempSync(join(tmpdir(), p));

/** 엔진 대역 — 받은 인자를 남기고, 정해진 답을 낸다. */
function fakeEngine(reply, recordTo) {
  const dir = tmp('argus-fake-watch-');
  const file = join(dir, 'engine.mjs');
  writeFileSync(file, [
    '#!/usr/bin/env node',
    "import { writeFileSync } from 'node:fs';",
    recordTo ? `writeFileSync(${JSON.stringify(recordTo)}, JSON.stringify(process.argv.slice(2)));` : '',
    `process.stdout.write(${JSON.stringify(JSON.stringify(reply))});`,
  ].join('\n'), 'utf8');
  chmodSync(file, 0o755);
  return file;
}

function world({ withLedger = true, spokenToday = null } = {}) {
  const repo = tmp('argus-watch-repo-');
  mkdirSync(join(repo, '.git'), { recursive: true });
  mkdirSync(join(repo, '.argus', 'ledger'), { recursive: true });
  if (withLedger) writeFileSync(join(repo, '.argus', 'ledger', 'ledger.jsonl'), '');
  if (spokenToday !== null) {
    writeFileSync(join(repo, '.argus', 'dec-spoken.json'),
      JSON.stringify({ date: today(), count: spokenToday, sessions: {} }));
  }
  return repo;
}

function runHook(repo, payload, bin) {
  const env = { ...process.env };
  if (bin) env.ARGUS_MCP_BIN = bin; else delete env.ARGUS_MCP_BIN;
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: 's1', cwd: repo, ...payload }),
    encoding: 'utf8', env,
  });
  assert.equal(r.status, 0, `훅은 막지 않는다 — 언제나 0 (실제: ${r.status}, stderr: ${r.stderr})`);
  return r.stdout;
}

let failures = 0;
function testCase(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL ${name}\n       ${error.message}`); }
}

console.log('dec-watch (어긋나면 한 줄 알린다)');

testCase('파일을 고쳐서 걸리면 그 줄이 나온다 — 그리고 막지 않는다', () => {
  const repo = world();
  const record = join(repo, 'argv.json');
  const out = runHook(repo,
    { hook_event_name: 'PostToolUse', tool_input: { file_path: 'src/app/page.tsx' } },
    fakeEngine({ spoke: true, say: ['[아르고스] D-0001 — 웹 화면은 나중에', '  방금 src/app/** 에 걸렸다.'] }, record));
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.ok(parsed.hookSpecificOutput.additionalContext.includes('D-0001'));
  const argv = JSON.parse(readFileSync(record, 'utf8'));
  assert.equal(argv[0], 'dec-check');
  assert.equal(argv[argv.indexOf('--file') + 1], 'src/app/page.tsx');
});

testCase('말이 걸려도 나온다 (다른 자리, 같은 기계)', () => {
  const repo = world();
  const record = join(repo, 'argv.json');
  const out = runHook(repo,
    { hook_event_name: 'UserPromptSubmit', prompt: '웹 화면 좀 볼까' },
    fakeEngine({ spoke: true, say: ['[아르고스] D-0001 — 웹 화면은 나중에'] }, record));
  assert.equal(JSON.parse(out).hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  const argv = JSON.parse(readFileSync(record, 'utf8'));
  assert.equal(argv[argv.indexOf('--text') + 1], '웹 화면 좀 볼까');
});

testCase('엔진이 "말한 게 아니다"라고 하면 아무것도 안 낸다', () => {
  const repo = world();
  assert.equal(runHook(repo,
    { hook_event_name: 'PostToolUse', tool_input: { file_path: 'src/app/page.tsx' } },
    fakeEngine({ spoke: false, would_speak: true, why_silent: 'already_said', say: [] })), '');
});

testCase('원장이 없으면 엔진도 안 부른다 (편집마다 오는 훅이다)', () => {
  const repo = world({ withLedger: false });
  const marker = join(repo, 'called');
  const dir = tmp('argus-fake-watch-');
  const file = join(dir, 'engine.mjs');
  writeFileSync(file, `#!/usr/bin/env node\nimport {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'x');process.stdout.write('{}');`, 'utf8');
  chmodSync(file, 0o755);
  assert.equal(runHook(repo, { hook_event_name: 'PostToolUse', tool_input: { file_path: 'a.ts' } }, file), '');
  assert.equal(existsSync(marker), false, '원장도 없는데 엔진을 불렀다');
});

testCase('오늘 몫(3번)을 다 썼으면 엔진도 안 부른다', () => {
  const repo = world({ spokenToday: 3 });
  const marker = join(repo, 'called');
  const dir = tmp('argus-fake-watch-');
  const file = join(dir, 'engine.mjs');
  writeFileSync(file, `#!/usr/bin/env node\nimport {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'x');process.stdout.write('{}');`, 'utf8');
  chmodSync(file, 0o755);
  assert.equal(runHook(repo, { hook_event_name: 'PostToolUse', tool_input: { file_path: 'a.ts' } }, file), '');
  assert.equal(existsSync(marker), false, '하루 상한을 넘겼는데 엔진을 불렀다');
});

testCase('엔진이 없거나 죽어도 작업을 막지 않는다', () => {
  const repo = world();
  assert.equal(runHook(repo, { hook_event_name: 'PostToolUse', tool_input: { file_path: 'a.ts' } },
    join(repo, 'does-not-exist')), '');
});

testCase('두 자리에 실제로 걸려 있다 (PostToolUse · UserPromptSubmit)', () => {
  const cfg = JSON.parse(readFileSync(join(DIR, 'hooks.json'), 'utf8'));
  for (const event of ['PostToolUse', 'UserPromptSubmit']) {
    const commands = (cfg.hooks[event] || []).flatMap((e) => (e.hooks || []).map((h) => h.command || ''));
    assert.ok(commands.some((c) => c.includes('dec-watch.js')),
      `hooks.json 의 ${event} 에 dec-watch.js 가 없다`);
  }
});

if (failures) { console.error(`\n${failures}건 실패`); process.exit(1); }
console.log('\ndec-watch 계약 전부 통과');
