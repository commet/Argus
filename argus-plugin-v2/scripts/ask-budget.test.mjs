#!/usr/bin/env node
/**
 * Global ambient ask budget + crisis screen (scripts/lib/ask-budget.js) —
 * the tranche-4 repair that caps TOTAL Argus asks across the five ambient
 * hooks (anchor / sense / ambient-nudge / keel / recall).
 *
 * Pinned contracts:
 *  1. unit — tryClaimAsk: 3 per session, 1 per turn (same turn key), keyless
 *     recency rule (keel), corrupt state = deny.
 *  2. unit — isCrisisShaped: precision-biased ruin/safety shapes fire, ordinary
 *     consequential decisions do NOT (a false crisis-fire is its own over-fire).
 *  3. integration — anchor stays silent on a crisis-shaped START turn and marks
 *     the session; keel then stays silent for that session too.
 *  4. integration — anchor claims the turn's ask, so sense's diagnosis on the
 *     SAME turn stays silent (one Argus ask per reply).
 *  5. integration — session cap: after 3 claimed asks, a 4th ask-mandating hook
 *     stays silent.
 *
 * Run: node argus-plugin-v2/scripts/ask-budget.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const DIR = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const ANCHOR = join(DIR, 'anchor-signal.js');
const KEEL = join(DIR, 'keel-signal.js');
const SENSE = join(DIR, 'sense-signal.js');

const tmps = [];
function tmp(prefix) { const d = mkdtempSync(join(tmpdir(), prefix)); tmps.push(d); return d; }

// Load the module fresh per config dir (configDir() reads the env at call time,
// so setting CLAUDE_CONFIG_DIR before each unit block is enough).
const budget = require('./lib/ask-budget.js');

function runHook(script, input, cfg, extraEnv = {}) {
  const r = spawnSync(process.execPath, [script], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: cfg, ARGUS_HOME: join(cfg, 'no-argus-home'), ...extraEnv },
  });
  assert.equal(r.status, 0, `hook must exit 0 (stderr: ${r.stderr})`);
  return r.stdout;
}

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + (e && e.message)); fail++; }
}

// ── 1. unit: tryClaimAsk ────────────────────────────────────────────────────
test('session cap: 3 asks then deny', () => {
  process.env.CLAUDE_CONFIG_DIR = tmp('argus-ab-');
  assert.ok(budget.tryClaimAsk('s1', 'k1'));
  assert.ok(budget.tryClaimAsk('s1', 'k2'));
  assert.ok(budget.tryClaimAsk('s1', 'k3'));
  assert.ok(!budget.tryClaimAsk('s1', 'k4'), '4th ask must be denied');
});

test('turn rule: same turn key within the window is denied, a new key allowed', () => {
  process.env.CLAUDE_CONFIG_DIR = tmp('argus-ab-');
  assert.ok(budget.tryClaimAsk('s2', 'turnA'));
  assert.ok(!budget.tryClaimAsk('s2', 'turnA'), 'same turn = one ask');
  assert.ok(budget.tryClaimAsk('s2', 'turnB'), 'next turn may ask again');
});

test('keyless claim (keel): denied within the recency window of any ask/touch', () => {
  process.env.CLAUDE_CONFIG_DIR = tmp('argus-ab-');
  assert.ok(budget.tryClaimAsk('s3', 'turnA'));
  assert.ok(!budget.tryClaimAsk('s3', null), 'keyless claim inside the window = same turn');
});

test('turn touch (sense diagnosis) blocks keyless claims but consumes no session slot', () => {
  process.env.CLAUDE_CONFIG_DIR = tmp('argus-ab-');
  budget.recordTurnTouch('s4'); // no prior state → no-op is acceptable; claim then touch
  assert.ok(budget.tryClaimAsk('s4', 'k1'));
  budget.recordTurnTouch('s4');
  assert.ok(!budget.tryClaimAsk('s4', null), 'touch keeps the turn taken for keyless claimers');
  assert.ok(budget.tryClaimAsk('s4', 'k2'), 'touch consumed no session slot');
});

test('no session id / corrupt state = deny (restrained side)', () => {
  const cfg = tmp('argus-ab-');
  process.env.CLAUDE_CONFIG_DIR = cfg;
  assert.ok(!budget.tryClaimAsk(null, 'k'), 'no session substrate = no ask');
  mkdirSync(join(cfg, 'argus-ask-budget'), { recursive: true });
  writeFileSync(join(cfg, 'argus-ask-budget', 'sX'), '{corrupt');
  assert.ok(!budget.tryClaimAsk('sX', 'k'), 'corrupt budget state = deny');
});

// ── 2. unit: isCrisisShaped ─────────────────────────────────────────────────
for (const s of [
  '전 재산을 코인에 몰빵할까 말까 고민이야',
  'should I put my entire 401k into this guaranteed 100x crypto coin',
  '약을 다 끊고 그냥 버틸까 해',
  '죽고 싶다는 생각이 자꾸 들어',
]) test('crisis+ ' + s.slice(0, 30), () => assert.ok(budget.isCrisisShaped(s)));
for (const s of [
  'Redis 쓸까 말까 고민이야',
  'should I take the new job in Berlin or stay',
  '다음 분기까지 매출 20% 성장할 것으로 예상합니다',
  '서버 이전을 이번 주말에 할까 말까',
]) test('crisis- ' + s.slice(0, 30), () => assert.ok(!budget.isCrisisShaped(s)));

// ── 3. integration: crisis-shaped turn → anchor silent + session marked → keel silent ──
test('anchor: crisis-shaped START turn → silence + session crisis marker', () => {
  const cfg = tmp('argus-ab-cfg-');
  const out = runHook(ANCHOR, { session_id: 'c1', user_message: '전 재산을 코인에 몰빵할까 말까 고민이야' }, cfg);
  assert.equal(out.trim(), '', 'no lean pre-ask on a ruin-shaped bet');
  assert.ok(existsSync(join(cfg, 'argus-crisis', 'c1')), 'session must be marked');
  // keel (text-blind) reads the marker and stays silent for this session
  const keelOut = runHook(KEEL, { session_id: 'c1', tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } }, cfg);
  assert.equal(keelOut.trim(), '', 'no seal-adjacent ceremony in a crisis-marked session');
});

test('keel: un-marked session still warns (crisis screen is not a blanket mute)', () => {
  const cfg = tmp('argus-ab-cfg-');
  const out = runHook(KEEL, { session_id: 'c2', tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } }, cfg);
  assert.match(out, /irreversible/i);
});

// ── 4. integration: one ask per turn across hooks ───────────────────────────
test('anchor claims the turn → sense diagnosis on the same turn stays silent', () => {
  const cfg = tmp('argus-ab-cfg-');
  const prompt = 'Redis 쓸까 말까 고민이야. 이번 분기 안에 결정해야 하는데.';
  const anchorOut = runHook(ANCHOR, { session_id: 't1', user_message: prompt }, cfg);
  assert.match(anchorOut, /\[Argus\]/, 'anchor fires first');
  const senseOut = runHook(SENSE, { session_id: 't1', prompt }, cfg);
  assert.equal(senseOut.trim(), '', 'second ask-capable injection on the same turn is silent');
});

test('sense diagnosis alone (no other ask) still fires — the dial is not starved', () => {
  const cfg = tmp('argus-ab-cfg-');
  const out = runHook(SENSE, { session_id: 't2', prompt: '다음 분기까지 매출 20% 성장할 것으로 예상합니다.' }, cfg);
  assert.match(out, /LOAD-BEARING/, 'diagnosis fires when the turn is unclaimed');
});

// ── 5. integration: session cap holds across hooks ──────────────────────────
test('after 3 claimed asks, an ask-mandating hook stays silent', () => {
  const cfg = tmp('argus-ab-cfg-');
  mkdirSync(join(cfg, 'argus-ask-budget'), { recursive: true });
  writeFileSync(join(cfg, 'argus-ask-budget', 'cap1'),
    JSON.stringify({ total: 3, lastAskKey: 'old', lastAskAt: 0, lastTouchAt: 0 }));
  const out = runHook(ANCHOR, { session_id: 'cap1', user_message: 'Redis 쓸까 말까 고민이야' }, cfg);
  assert.equal(out.trim(), '', 'session ask budget exhausted = silence');
  // and the anchor slot was NOT burned: state dir has no argus-anchored marker
  assert.ok(!existsSync(join(cfg, 'argus-anchored', 'cap1')), 'denied ask must not arm the anchor');
});

test('budget state file shape: { total, lastAskKey, lastAskAt, lastTouchAt }', () => {
  const cfg = tmp('argus-ab-cfg-');
  runHook(ANCHOR, { session_id: 'shape', user_message: 'Redis 쓸까 말까 고민이야' }, cfg);
  const s = JSON.parse(readFileSync(join(cfg, 'argus-ask-budget', 'shape'), 'utf8'));
  assert.equal(s.total, 1);
  assert.equal(typeof s.lastAskKey, 'string');
  assert.equal(typeof s.lastAskAt, 'number');
});

console.log(`\nask-budget: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
