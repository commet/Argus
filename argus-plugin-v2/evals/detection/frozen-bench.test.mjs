#!/usr/bin/env node
/**
 * frozen-bench 순수 로직 검증(키 불요): 코퍼스→시나리오 변환 + 래칫 비교.
 * Run: node argus-plugin-v2/evals/detection/frozen-bench.test.mjs
 */
import assert from 'node:assert/strict';
import { corpusToScenarios, compareFrozen } from './frozen-bench.mjs';
import { CORPUS } from './corpus.mjs';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + (e && e.message)); fail++; }
}

const S = corpusToScenarios();

test('전 코퍼스가 변환된다 (31)', () => assert.equal(S.length, CORPUS.length));

test('planted는 항상 user 턴을 가리킨다', () => {
  for (const s of S) for (const p of s.planted) assert.equal(s.turns[p.turn].role, 'user', s.id);
});

test('assistant-선행 케이스는 중립 user 턴이 앞에 붙는다 (API 계약)', () => {
  const withA = S.filter((s) => s.turns.some((t) => t.role === 'assistant'));
  assert.ok(withA.length >= 2);
  for (const s of withA) assert.equal(s.turns[0].role, 'user', s.id);
});

test('음성은 filler로, 양성은 planted로 (겹침 없음)', () => {
  for (const s of S) {
    assert.ok(!(s.planted.length && s.filler_user_turns.length), s.id);
    const src = CORPUS.find((c) => c.id === s.id);
    assert.equal(s.planted.length > 0, src.labels.length > 0, s.id);
  }
});

test('open 예측이 보존된다', () => {
  const out = S.find((s) => s.id === 'out-ko-pronoun');
  assert.ok(out.open.length === 1);
});

const base = { byMode: { mcp: { fired_correct: 18, over_fire: { fired: 0 } }, plugin: { fired_correct: 20, over_fire: { fired: 1 } } } };

test('래칫: 동일/개선이면 ok', () => {
  assert.equal(compareFrozen(base, base).ok, true);
  const better = { byMode: { mcp: { fired_correct: 19, over_fire: { fired: 0 } }, plugin: { fired_correct: 21, over_fire: { fired: 0 } } } };
  assert.equal(compareFrozen(base, better).ok, true);
});

test('래칫: 정발동 하락은 회귀', () => {
  const worse = { byMode: { mcp: { fired_correct: 17, over_fire: { fired: 0 } }, plugin: base.byMode.plugin } };
  const v = compareFrozen(base, worse);
  assert.equal(v.ok, false);
  assert.match(v.reasons.join(' '), /mcp: fired_correct 18→17/);
});

test('래칫: 과발동 상승은 회귀 (한 모드만 나빠져도)', () => {
  const worse = { byMode: { mcp: base.byMode.mcp, plugin: { fired_correct: 22, over_fire: { fired: 3 } } } };
  const v = compareFrozen(base, worse);
  assert.equal(v.ok, false);
  assert.match(v.reasons.join(' '), /plugin: over_fire 1→3/);
});

test('래칫: 베이스라인 없는 모드는 건너뛴다', () => {
  assert.equal(compareFrozen({ byMode: {} }, base).ok, true);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
