/**
 * engine.js — 훅이 엔진을 찾는 단 한 곳.
 *
 * 지키는 것: `/plugin install` 만 한 기기(전역 설치 없음)에서도 MCP 서버가
 * 내려받아 둔 npx 캐시 사본으로 결정 장부 훅이 돈다. 그리고 결정 장부를
 * 모르는 낡은 사본은 **고르지 않는다** — 고르면 인자를 무시한 stdio 서버가
 * 떠서 훅 예산을 다 태운다.
 *
 * Run: node argus-plugin-v2/hooks/engine.test.mjs
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ENGINE = join(here, 'engine.js');

function cacheWith(versions) {
  const cache = mkdtempSync(join(tmpdir(), 'argus-npx-cache-'));
  versions.forEach((version, i) => {
    const pkg = join(cache, '_npx', `hash${i}`, 'node_modules', 'argus-decision-mcp');
    mkdirSync(join(pkg, 'dist'), { recursive: true });
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: 'argus-decision-mcp', version }));
    writeFileSync(join(pkg, 'dist', 'index.js'),
      `process.stdout.write(JSON.stringify({ version: ${JSON.stringify(version)}, args: process.argv.slice(2) }));`);
  });
  return cache;
}

/** 깨끗한 자식 프로세스에서 해석한다 — PATH·ARGUS_MCP_BIN 이 새지 않게. */
function resolveIn(cache, extraEnv = {}) {
  const env = { PATH: '', npm_config_cache: cache, HOME: cache, ...extraEnv };
  const r = spawnSync(process.execPath, ['-e',
    `process.stdout.write(JSON.stringify(require(${JSON.stringify(ENGINE)}).resolveFastEngine()))`,
  ], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

let failures = 0;
function testCase(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (error) { failures += 1; console.error(`  FAIL ${name}\n       ${error.message}`); }
}

console.log('engine.js (훅의 엔진 찾기)');

testCase('전역 설치 없이 npx 캐시의 가장 새 사본을 고르고, 그 사본이 실제로 돈다', () => {
  const cache = cacheWith(['2.1.0', '2.1.3', '2.0.23']);
  const engine = resolveIn(cache);
  assert.equal(engine.ok, true);
  assert.equal(engine.via, 'npx-cache@2.1.3');
  const run = spawnSync(engine.cmd, [...engine.prefix, 'dec-brief', '--dry'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(run.stdout), { version: '2.1.3', args: ['dec-brief', '--dry'] });
});

testCase('결정 장부 이전 판만 있으면 고르지 않고, 왜 못 골랐는지 말한다', () => {
  const engine = resolveIn(cacheWith(['2.0.23']));
  assert.equal(engine.ok, false);
  assert.match(engine.why, /2\.0\.23/);
  assert.match(engine.why, /2\.1\.0/);
});

testCase('아무것도 없으면 침묵하되 이유를 남긴다', () => {
  const engine = resolveIn(mkdtempSync(join(tmpdir(), 'argus-npx-empty-')));
  assert.equal(engine.ok, false);
  assert.equal(engine.via, 'none');
  assert.ok(engine.why.length > 0);
});

testCase('ARGUS_MCP_BIN 이 캐시보다 이긴다', () => {
  const cache = cacheWith(['9.9.9']);
  const bin = join(cache, 'fake-engine');
  writeFileSync(bin, '#!/bin/sh\n');
  const engine = resolveIn(cache, { ARGUS_MCP_BIN: bin });
  assert.equal(engine.ok, true);
  assert.equal(engine.cmd, bin);
  assert.deepEqual(engine.prefix, []);
});

testCase('판 비교는 자릿수가 아니라 숫자로 한다', () => {
  const { versionAtLeast } = require(ENGINE);
  assert.equal(versionAtLeast('2.10.0', '2.9.0'), true);
  assert.equal(versionAtLeast('2.1.0', '2.1.0'), true);
  assert.equal(versionAtLeast('2.0.99', '2.1.0'), false);
});

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
