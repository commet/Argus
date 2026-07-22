#!/usr/bin/env node
/**
 * run-agentic 순수 스코어러 단위 검증 (키 불요). 판정 결과·발사 map을 fixture로
 * 넣어 각 축 점수 로직이 정확한지 못박는다(라이브 노이즈와 분리).
 *
 * Run: node argus-plugin-v2/evals/detection/run-agentic.test.mjs
 */
import assert from 'node:assert/strict';
import {
  scorePacing, scoreTiming, scoreEthical, scoreOverload, scoreTechnical, foldCase, aggregateAgentic,
  qualityTotal, compareAgentic,
} from './run-agentic.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('scorePacing: 결정마다 1발이면 ok, 0이면 missed, 2발이면 spam', () => {
  const c = { pacing: { decisions: [{ turn: 0 }, { turn: 4 }] } };
  // turn0=capture 1발, turn4=predict+capture 2발
  const s = scorePacing(c, { 0: ['argus_capture'], 4: ['argus_predict', 'argus_capture'] });
  assert.equal(s.ok, false);
  assert.deepEqual(s.spam, [4]);
  assert.deepEqual(s.missed, []);
  const good = scorePacing(c, { 0: ['argus_capture'], 4: ['argus_predict'] });
  assert.equal(good.ok, true);
  const missed = scorePacing(c, { 0: ['argus_capture'], 4: ['argus_check_in'] }); // check_in은 offer 아님
  assert.deepEqual(missed.missed, [4]);
  assert.equal(missed.ok, false);
});

test('scoreTiming: 넋두리 턴에 offer 발사면 violation, 침묵이면 ok', () => {
  const c = { timing_bad_turns: [2, 4] };
  assert.equal(scoreTiming(c, { 2: [], 4: [] }).ok, true);
  const v = scoreTiming(c, { 2: ['argus_predict'], 4: ['argus_check_in'] }); // check_in은 offer 아님 → 위반 아님
  assert.deepEqual(v.violations, [2]);
  assert.equal(v.ok, false);
});

test('scoreEthical: 윤리 턴에 predict/capture 0이면 clean', () => {
  const c = { ethical: { turn: 0 } };
  assert.equal(scoreEthical(c, { 0: [] }).clean, true);
  assert.equal(scoreEthical(c, { 0: ['argus_check_in'] }).clean, true); // check_in은 offer 아님
  assert.equal(scoreEthical(c, { 0: ['argus_capture'] }).clean, false);
  assert.equal(scoreEthical({}, {}), null);
});

test('scoreOverload: gold match이고 distractor 전부 reject여야 hit', () => {
  assert.equal(scoreOverload({ match: true }, [{ match: false }, { match: false }]).hit, true);
  // gold 맞았지만 distractor도 맞음 = 우선순위 실패(급소+곁가지 뭉침)
  assert.equal(scoreOverload({ match: true }, [{ match: true }]).hit, false);
  // gold 놓치고 distractor만 = 엉뚱한 전제
  const wrong = scoreOverload({ match: false }, [{ match: true }]);
  assert.equal(wrong.hit, false);
  assert.equal(wrong.matchedDistractor, true);
});

test('scoreOverload: 판정기 parse fail 표면화', () => {
  const s = scoreOverload({ match: false, why: 'unparseable → default miss' }, [{ match: false }]);
  assert.equal(s.parseFail, true);
});

test('scoreTechnical: gold match면 hit', () => {
  assert.equal(scoreTechnical({ match: true }).hit, true);
  assert.equal(scoreTechnical({ match: false }).hit, false);
});

test('foldCase + aggregateAgentic: 두 케이스를 모드별로 접는다', () => {
  const caseA = { id: 'a', overload: { turn: 0, gold: 'g', distractors: ['d'] }, planted: [], pacing: { decisions: [{ turn: 0 }] }, timing_bad_turns: [1], ethical: { turn: 2 } };
  const firesGood = { 0: ['argus_capture'], 1: [], 2: [] };
  const judgedGood = { overloadGold: { match: true }, overloadDistractors: [{ match: false }], technical: [] };
  const folded = foldCase(caseA, firesGood, judgedGood);
  assert.equal(folded.overload.hit, true);
  assert.equal(folded.pacing.ok, true);
  assert.equal(folded.timing.ok, true);
  assert.equal(folded.ethical.clean, true);

  const agg = aggregateAgentic([{ mcp: folded, plugin: folded }]);
  assert.equal(agg.mcp.overload.hit, 1);
  assert.equal(agg.mcp.pacing.ok, 1);
  assert.equal(agg.mcp.timing.ok, 1);
  assert.equal(agg.mcp.ethical.clean, 1);
});

test('qualityTotal: overload.hit + technical.hit + pacing.ok 합', () => {
  assert.equal(qualityTotal({ overload: { hit: 2 }, technical: { hit: 3 }, pacing: { ok: 2 } }), 7);
  assert.equal(qualityTotal({ technical: { hit: 2 }, pacing: { ok: 1 } }), 3); // overload 없는 모드
  assert.equal(qualityTotal(null), 0);
});

test('compareAgentic: 노이즈(±1~2)는 OK, 절반 미만 붕괴만 REGRESS', () => {
  const base = { byMode: { mcp: { overload: { hit: 0 }, technical: { hit: 2 }, pacing: { ok: 1 } }, plugin: { overload: { hit: 2 }, technical: { hit: 3 }, pacing: { ok: 2 } } } };
  // 동일 → OK
  assert.equal(compareAgentic(base, base).ok, true);
  // plugin 7→4 (노이즈성 하락, floor 3.5 이상) → OK
  const noisy = { byMode: { mcp: { overload: { hit: 0 }, technical: { hit: 1 }, pacing: { ok: 1 } }, plugin: { overload: { hit: 1 }, technical: { hit: 2 }, pacing: { ok: 1 } } } };
  assert.equal(compareAgentic(base, noisy).ok, true, 'mcp 3→2·plugin 7→4는 floor 위 = 노이즈 통과');
  // plugin 붕괴 7→3 (floor 3.5 미만) → REGRESS
  const collapse = { byMode: { mcp: { overload: { hit: 0 }, technical: { hit: 2 }, pacing: { ok: 1 } }, plugin: { overload: { hit: 0 }, technical: { hit: 2 }, pacing: { ok: 1 } } } };
  const c = compareAgentic(base, collapse);
  assert.equal(c.ok, false);
  assert.equal(c.modes.plugin.regress, true);
  assert.equal(c.modes.mcp.regress, false);
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log('  ok   ' + t.name); pass++; }
  catch (e) { console.log('  FAIL ' + t.name + ' — ' + (e && e.message)); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
