#!/usr/bin/env node
/**
 * Agentic 코퍼스 무결성 검증 (키 불요) — 정답 라벨이 well-formed인지, 그리고
 * 새 품질 축(overload/pacing/technical/timing_bad/ethical)이 충분히 커버되는지.
 * 이 게이트가 초록이어야 다음 라운드의 실행/판정 하네스가 믿고 이 라벨을 쓴다.
 *
 * Run: node argus-plugin-v2/evals/detection/corpus-agentic.test.mjs
 */
import assert from 'node:assert/strict';
import { AGENTIC_CORPUS } from './corpus-agentic.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const isUserTurn = (c, i) => c.turns[i] && c.turns[i].role === 'user';

test('케이스 기본형: id 유일 · persona · lang · turns가 user로 시작', () => {
  const ids = new Set();
  for (const c of AGENTIC_CORPUS) {
    assert.ok(c.id && !ids.has(c.id), `id 유일해야: ${c.id}`);
    ids.add(c.id);
    assert.ok(c.persona && c.persona.length > 3, `${c.id}: persona`);
    assert.ok(c.lang === 'ko' || c.lang === 'en', `${c.id}: lang ko|en`);
    assert.ok(Array.isArray(c.turns) && c.turns.length >= 3, `${c.id}: turns ≥3`);
    assert.equal(c.turns[0].role, 'user', `${c.id}: 첫 턴 user`);
    for (const t of c.turns) {
      assert.ok((t.role === 'user' || t.role === 'assistant') && t.text && t.text.length > 0, `${c.id}: 턴 형식`);
    }
  }
});

test('planted turn은 user 턴을 가리키고, hidden엔 gold/counter, technical은 gold≠counter', () => {
  for (const c of AGENTIC_CORPUS) {
    assert.ok(Array.isArray(c.planted), `${c.id}: planted 배열`);
    for (const p of c.planted) {
      assert.ok(isUserTurn(c, p.turn), `${c.id}: planted.turn(${p.turn})은 user`);
      assert.ok(['prediction', 'outcome', 'hidden_assumption'].includes(p.kind), `${c.id}: kind`);
      assert.ok(p.gist && p.gist.length > 10, `${c.id}: gist`);
      if (p.kind === 'hidden_assumption') {
        assert.ok(p.gold && p.gold.length > 20, `${c.id}: hidden gold`);
        assert.ok(p.counter && p.counter.length > 5, `${c.id}: hidden counter`);
        assert.notEqual(p.gold, p.counter, `${c.id}: gold≠counter`);
      }
    }
  }
});

test('overload: gold 1 + distractors ≥2, distractor는 gold와 다름, turn은 user', () => {
  const withOverload = AGENTIC_CORPUS.filter((c) => c.overload);
  assert.ok(withOverload.length >= 5, `overload 케이스 ≥5 (실제 ${withOverload.length})`);
  for (const c of withOverload) {
    const o = c.overload;
    assert.ok(isUserTurn(c, o.turn), `${c.id}: overload.turn user`);
    assert.ok(o.gold && o.gold.length > 20, `${c.id}: overload gold`);
    assert.ok(Array.isArray(o.distractors) && o.distractors.length >= 2, `${c.id}: distractors ≥2`);
    for (const d of o.distractors) {
      assert.ok(d && d.length > 5, `${c.id}: distractor 내용`);
      assert.notEqual(d, o.gold, `${c.id}: distractor≠gold`);
    }
    for (const a of o.gold_alt || []) {
      assert.ok(a && a.length > 10, `${c.id}: overload gold_alt 내용`);
      assert.ok(!o.distractors.includes(a), `${c.id}: gold_alt는 distractor 아님`);
    }
  }
});

test('gold_alt(있으면): 유효한 다른 크럭스 — len>10, counter/distractor와 다름', () => {
  const withAlt = AGENTIC_CORPUS.flatMap((c) => [
    ...(c.overload?.gold_alt || []),
    ...c.planted.flatMap((p) => p.gold_alt || []),
  ]);
  assert.ok(withAlt.length >= 3, `gold_alt ≥3 (R31 다면 크럭스, 실제 ${withAlt.length})`);
  for (const c of AGENTIC_CORPUS) {
    for (const p of c.planted) {
      for (const a of p.gold_alt || []) {
        assert.ok(a.length > 10, `${c.id}: technical gold_alt 내용`);
        assert.notEqual(a, p.counter, `${c.id}: gold_alt≠counter`);
        assert.notEqual(a, p.gold, `${c.id}: gold_alt≠gold`);
      }
    }
  }
});

test('pacing: decisions ≥2, 각 turn은 서로 다른 user 턴 + gold', () => {
  const withPacing = AGENTIC_CORPUS.filter((c) => c.pacing);
  assert.ok(withPacing.length >= 2, `pacing 케이스 ≥2 (실제 ${withPacing.length})`);
  for (const c of withPacing) {
    const ds = c.pacing.decisions;
    assert.ok(Array.isArray(ds) && ds.length >= 2, `${c.id}: decisions ≥2`);
    const seen = new Set();
    for (const d of ds) {
      assert.ok(isUserTurn(c, d.turn), `${c.id}: pacing.turn(${d.turn}) user`);
      assert.ok(!seen.has(d.turn), `${c.id}: pacing turn 중복 금지`);
      seen.add(d.turn);
      assert.ok(d.gold && d.gold.length > 10, `${c.id}: pacing gold`);
    }
  }
});

test('technical: gold/counter 갖춘 hidden_assumption이 ≥3건 (깊은 기술 급소 커버)', () => {
  const tech = AGENTIC_CORPUS.flatMap((c) => c.planted.filter((p) => p.technical));
  assert.ok(tech.length >= 6, `technical planted ≥6 (실제 ${tech.length})`);
  for (const p of tech) {
    assert.equal(p.kind, 'hidden_assumption', 'technical은 hidden_assumption');
    assert.ok(p.gold && p.counter, 'technical gold/counter');
  }
});

test('timing_bad_turns / filler_user_turns는 유효한 user 인덱스', () => {
  for (const c of AGENTIC_CORPUS) {
    for (const t of c.timing_bad_turns || []) assert.ok(isUserTurn(c, t), `${c.id}: timing_bad ${t} user`);
    for (const t of c.filler_user_turns || []) assert.ok(isUserTurn(c, t), `${c.id}: filler ${t} user`);
  }
  const withTiming = AGENTIC_CORPUS.filter((c) => (c.timing_bad_turns || []).length);
  assert.ok(withTiming.length >= 1, 'timing_bad 케이스 ≥1 (R22 늦은-발사 패턴)');
});

test('ethical: turn은 user + issue/expect/note, expect는 no_track_no_endorse', () => {
  const eth = AGENTIC_CORPUS.filter((c) => c.ethical);
  assert.ok(eth.length >= 3, `ethical 케이스 ≥3 (실제 ${eth.length})`);
  for (const c of eth) {
    const e = c.ethical;
    assert.ok(isUserTurn(c, e.turn), `${c.id}: ethical.turn user`);
    assert.ok(e.issue && e.issue.length > 10, `${c.id}: ethical issue`);
    assert.equal(e.expect, 'no_track_no_endorse', `${c.id}: expect`);
    assert.ok(e.note && e.note.length > 10, `${c.id}: ethical note`);
  }
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log('  ok   ' + t.name); pass++; }
  catch (e) { console.log('  FAIL ' + t.name + ' — ' + (e && e.message)); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed · ${AGENTIC_CORPUS.length} agentic cases`);
process.exit(fail ? 1 : 0);
