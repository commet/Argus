#!/usr/bin/env node
/**
 * dec-brief.js (SessionStart 훅 — 정해 둔 것을 세션 앞에 편다) 실호출 테스트.
 *
 * 고정하는 계약:
 *  1. 펼 것이 있으면 additionalContext 로 에이전트에게 간다
 *  2. 아무것도 안 정했으면 **완전 침묵** (원장 파일조차 없으면 엔진도 안 부른다)
 *  3. 저장소 밖이면 침묵
 *  4. 엔진이 없으면 침묵하되 **왜 못 폈는지 상태 파일에 남는다** (조용히 안 사라진다)
 *  5. 어느 경우에도 exit 0
 *  6. 훅이 hooks.json 의 SessionStart 에 실제로 걸려 있다
 *
 * Run: node argus-plugin-v2/hooks/dec-brief.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const DIR = dirname(fileURLToPath(import.meta.url));
const HOOK = join(DIR, 'dec-brief.js');

function tmp(prefix) { return mkdtempSync(join(tmpdir(), prefix)); }

/** 엔진 대역 — 실제 dec-brief 출력 모양을 그대로 흉내 낸다. */
function fakeEngine(payload) {
  const dir = tmp('argus-fake-brief-');
  const file = join(dir, 'engine.mjs');
  writeFileSync(file, [
    '#!/usr/bin/env node',
    `process.stdout.write(${JSON.stringify(JSON.stringify(payload))});`,
  ].join('\n'), 'utf8');
  chmodSync(file, 0o755);
  return file;
}

function world({ withLedger = true } = {}) {
  const repo = tmp('argus-brief-repo-');
  mkdirSync(join(repo, '.git'), { recursive: true });
  mkdirSync(join(repo, '.argus', 'ledger'), { recursive: true });
  if (withLedger) writeFileSync(join(repo, '.argus', 'ledger', 'ledger.jsonl'), '');
  return repo;
}

function runHook(repo, { bin, cwd } = {}) {
  const env = { ...process.env };
  if (bin) env.ARGUS_MCP_BIN = bin; else delete env.ARGUS_MCP_BIN;
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: 's1', cwd: cwd ?? repo, hook_event_name: 'SessionStart' }),
    encoding: 'utf8', env,
  });
  assert.equal(r.status, 0, `훅은 언제나 0으로 끝나야 한다 (stderr: ${r.stderr})`);
  return r.stdout;
}

let failures = 0;
function testCase(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL ${name}\n       ${error.message}`); }
}

console.log('dec-brief (SessionStart 훅 — 정해 둔 것을 편다)');

testCase('펼 것이 있으면 에이전트에게 그대로 간다 (줄바꿈이 살아 있다)', () => {
  const repo = world();
  const out = runHook(repo, {
    bin: fakeEngine({ shown: [{ id: 'D-0001', slot: 'due' }], omitted: 2, say: ['첫 줄', '둘째 줄'] }),
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(parsed.hookSpecificOutput.additionalContext, '첫 줄\n둘째 줄');
  const state = JSON.parse(readFileSync(join(repo, '.argus', 'dec-brief-state.json'), 'utf8'));
  assert.equal(state.shown, 1);
  assert.equal(state.omitted, 2);
  assert.equal(state.last_error, null);
});

testCase('아직 아무것도 안 정했으면 완전히 침묵한다 (엔진도 안 부른다)', () => {
  const repo = world({ withLedger: false });
  const marker = join(repo, 'engine-was-called');
  const dir = tmp('argus-fake-brief-');
  const file = join(dir, 'engine.mjs');
  writeFileSync(file, `#!/usr/bin/env node\nimport {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},'x');`, 'utf8');
  chmodSync(file, 0o755);
  assert.equal(runHook(repo, { bin: file }), '');
  assert.equal(existsSync(marker), false, '원장도 없는데 엔진을 불렀다');
});

testCase('엔진이 낼 말이 없으면 침묵한다', () => {
  const repo = world();
  assert.equal(runHook(repo, { bin: fakeEngine({ shown: [], omitted: 0, say: [] }) }), '');
});

testCase('저장소 밖에서는 침묵한다', () => {
  const outside = tmp('argus-brief-outside-');
  assert.equal(runHook(outside, { bin: fakeEngine({ say: ['안 나와야 한다'] }), cwd: outside }), '');
});

testCase('엔진이 없으면 침묵하되 **왜 못 폈는지 남는다**', () => {
  const repo = world();
  assert.equal(runHook(repo, { bin: join(repo, 'does-not-exist') }), '');
  const state = JSON.parse(readFileSync(join(repo, '.argus', 'dec-brief-state.json'), 'utf8'));
  assert.ok(state.last_error, '못 편 이유가 아무데도 안 남았다');
});

testCase('훅이 hooks.json 의 SessionStart 에 실제로 걸려 있다 (안 걸린 훅은 안 도는 훅이다)', () => {
  const cfg = JSON.parse(readFileSync(join(DIR, 'hooks.json'), 'utf8'));
  const commands = (cfg.hooks.SessionStart || []).flatMap((e) => (e.hooks || []).map((h) => h.command || ''));
  assert.ok(commands.some((c) => c.includes('dec-brief.js')),
    'hooks.json 의 SessionStart 에 dec-brief.js 가 없다 — 파일만 있고 배선이 없는 상태다');
});

if (failures) { console.error(`\n${failures}건 실패`); process.exit(1); }
console.log('\ndec-brief 계약 전부 통과');
