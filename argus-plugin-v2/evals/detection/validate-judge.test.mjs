#!/usr/bin/env node
/**
 * validate-judge 순수 로직 + 코퍼스 무결성 검증 (키 불요).
 *   - 모든 hidden_assumption 케이스가 gold/gold_para/counter 3종을 갖췄나(프로브 소스).
 *   - judgeProbes가 케이스당 positive 1 + negative 1을 만든다.
 *   - scoreJudge가 recall/specificity와 게이트를 정확히 계산한다.
 *
 * Run: node argus-plugin-v2/evals/detection/validate-judge.test.mjs
 */
import assert from 'node:assert/strict';
import { CORPUS } from './corpus.mjs';
import { judgeProbes, scoreJudge } from './validate-judge.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('코퍼스 무결성: 모든 hidden_assumption 케이스가 gold/gold_para/counter를 갖춘다', () => {
  const hidden = CORPUS.filter((c) => c.labels?.includes('hidden_assumption'));
  assert.ok(hidden.length >= 6, `hidden 케이스 ≥6 (실제 ${hidden.length})`);
  for (const c of hidden) {
    assert.ok(c.gold && c.gold.length > 10, `${c.id}: gold 있어야`);
    assert.ok(c.gold_para && c.gold_para.length > 10, `${c.id}: gold_para 있어야`);
    assert.ok(c.counter && c.counter.length > 5, `${c.id}: counter 있어야`);
    assert.notEqual(c.gold, c.counter, `${c.id}: counter는 gold와 달라야`);
  }
});

test('judgeProbes: hidden 케이스당 positive 1 + negative 1', () => {
  const probes = judgeProbes();
  const pos = probes.filter((p) => p.kind === 'positive');
  const neg = probes.filter((p) => p.kind === 'negative');
  const hidden = CORPUS.filter((c) => c.labels?.includes('hidden_assumption') && c.gold);
  assert.equal(pos.length, hidden.length, 'positive = hidden 케이스 수');
  assert.equal(neg.length, hidden.length, 'negative = hidden 케이스 수');
  assert.equal(pos[0].expect, true);
  assert.equal(neg[0].expect, false);
});

test('scoreJudge: 완벽 판정기 → recall 1 · specificity 1 · ok', () => {
  const results = [
    { id: 'a', kind: 'positive', match: true },
    { id: 'b', kind: 'positive', match: true },
    { id: 'a', kind: 'negative', match: false },
    { id: 'b', kind: 'negative', match: false },
  ];
  const s = scoreJudge(results);
  assert.equal(s.recall, 1);
  assert.equal(s.specificity, 1);
  assert.equal(s.ok, true);
});

test('scoreJudge: 너무 관대(counter를 통과) → specificity 하락 · 게이트 실패', () => {
  const results = [
    { id: 'a', kind: 'positive', match: true },
    { id: 'b', kind: 'positive', match: true },
    { id: 'a', kind: 'negative', match: true },  // 오통과 (theater 위험)
    { id: 'b', kind: 'negative', match: false },
  ];
  const s = scoreJudge(results, 0.85, 0.85);
  assert.equal(s.specificity, 0.5, 'counter 2건 중 1건만 기각');
  assert.equal(s.ok, false, '임계 미달 → 게이트 실패');
  assert.deepEqual(s.false_positive_ids, ['a']);
});

test('scoreJudge: 너무 엄격(gold_para를 miss) → recall 하락 · 게이트 실패', () => {
  const results = [
    { id: 'a', kind: 'positive', match: false }, // 충실한 캡처를 놓침
    { id: 'b', kind: 'positive', match: true },
    { id: 'a', kind: 'negative', match: false },
    { id: 'b', kind: 'negative', match: false },
  ];
  const s = scoreJudge(results, 0.85, 0.85);
  assert.equal(s.recall, 0.5);
  assert.equal(s.ok, false);
  assert.deepEqual(s.false_negative_ids, ['a']);
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log('  ok   ' + t.name); pass++; }
  catch (e) { console.log('  FAIL ' + t.name + ' — ' + (e && e.message)); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
