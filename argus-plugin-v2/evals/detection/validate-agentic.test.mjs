#!/usr/bin/env node
/**
 * agenticProbes 구성 검증 (키 불요) — 프로브가 gold(positive)+distractor/counter
 * (negative)로 올바로 만들어지는지. scoreJudge 자체는 validate-judge.test.mjs가
 * 이미 검증하므로 여기선 프로브 소스 무결성만.
 *
 * Run: node argus-plugin-v2/evals/detection/validate-agentic.test.mjs
 */
import assert from 'node:assert/strict';
import { AGENTIC_CORPUS } from './corpus-agentic.mjs';
import { agenticProbes } from './validate-agentic.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('overload 케이스마다 positive 1 + distractor 수만큼 negative', () => {
  const probes = agenticProbes();
  for (const c of AGENTIC_CORPUS.filter((x) => x.overload)) {
    const pos = probes.filter((p) => p.id === `${c.id}:ov` && p.kind === 'positive');
    const neg = probes.filter((p) => p.id.startsWith(`${c.id}:ov-d`) && p.kind === 'negative');
    assert.equal(pos.length, 1, `${c.id}: overload positive 1`);
    assert.equal(neg.length, c.overload.distractors.length, `${c.id}: distractor 수만큼 negative`);
    assert.equal(pos[0].expect, true);
    assert.equal(neg[0].expect, false);
  }
});

test('technical hidden마다 gold positive + counter negative', () => {
  const probes = agenticProbes();
  const techCount = AGENTIC_CORPUS.flatMap((c) => c.planted.filter((p) => p.technical)).length;
  assert.equal(probes.filter((p) => p.id.endsWith(':tech')).length, techCount);
  assert.equal(probes.filter((p) => p.id.endsWith(':tech-c') && p.kind === 'negative').length, techCount);
});

test('negative 프로브의 captured는 gold (specificity: gold 잡아도 distractor/counter로 오인 금지)', () => {
  const probes = agenticProbes();
  const c = AGENTIC_CORPUS.find((x) => x.overload);
  const neg = probes.find((p) => p.id.startsWith(`${c.id}:ov-d`));
  assert.equal(neg.captured, c.overload.gold, 'negative captured=gold');
  assert.notEqual(neg.planted, c.overload.gold, 'negative planted=distractor(≠gold)');
});

test('프로브 총량 > 0 이고 positive/negative 둘 다 존재', () => {
  const probes = agenticProbes();
  assert.ok(probes.length >= 8, `프로브 ≥8 (실제 ${probes.length})`);
  assert.ok(probes.some((p) => p.kind === 'positive'));
  assert.ok(probes.some((p) => p.kind === 'negative'));
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log('  ok   ' + t.name); pass++; }
  catch (e) { console.log('  FAIL ' + t.name + ' — ' + (e && e.message)); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed · ${agenticProbes().length} probes`);
process.exit(fail ? 1 : 0);
