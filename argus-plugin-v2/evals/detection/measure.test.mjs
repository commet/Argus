#!/usr/bin/env node
/**
 * 감지 코퍼스 CI 게이트 — 사전필터 skip-safety.
 *
 * 하드 불변식: 사전필터는 라벨된 양성(예측/결과/전제/숨은 전제)을 절대 스킵하지
 * 않는다. 스킵된 양성 = AI 진단 지시가 아예 주입되지 않는 턴 = 조용한 감지 사각.
 * (LLM-glue 불변식: 이 사각은 아무것도 빨간불로 만들지 않으므로 여기서 CI가
 * 빨간불을 만든다.)
 *
 * 부수 단언: (1) 명백한 잡담(expectSkip)은 실제로 스킵된다 — 사전필터가
 * 항상-참으로 퇴화해 비용 게이트 기능을 잃는 것을 막는다. (2) 코퍼스 규모·양쪽
 * 언어 존재 — 코퍼스가 조용히 비는 것을 막는다.
 *
 * Run: node argus-plugin-v2/evals/detection/measure.test.mjs
 */
import assert from 'node:assert/strict';
import { CORPUS } from './corpus.mjs';
import { measure } from './measure.mjs';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + (e && e.message)); fail++; }
}

const m = measure();

test('코퍼스 규모 — 30건 이상, 양성/음성 모두 존재', () => {
  assert.ok(CORPUS.length >= 30, `${CORPUS.length}건`);
  assert.ok(m.positives >= 15 && m.negatives >= 6);
});

test('코퍼스에 한국어·영어가 모두 있다', () => {
  assert.ok(CORPUS.some((c) => /[가-힣]/.test(c.user)));
  assert.ok(CORPUS.some((c) => /^[\x00-\x7F]+$/.test(c.user)));
});

test('네 라벨 모두 표본이 있다 (숨은 전제 포함)', () => {
  for (const label of ['prediction', 'outcome', 'assumption', 'hidden_assumption']) {
    assert.ok(m.rules[label].n >= 2, `${label}: n=${m.rules[label].n}`);
  }
});

test('하드 게이트 — 사전필터는 양성을 절대 스킵하지 않는다 (recall 1.0)', () => {
  assert.deepEqual(
    m.prefilter.missed_positive_ids, [],
    `사전필터가 양성을 스킵함: ${m.prefilter.missed_positive_ids.join(', ')} — 이 턴들엔 AI 진단이 아예 주입되지 않는다`,
  );
});

test('명백한 잡담은 스킵된다 (사전필터의 항상-참 퇴화 방지)', () => {
  assert.deepEqual(
    m.prefilter.expected_skip_violations, [],
    `스킵돼야 할 음성이 통과함: ${m.prefilter.expected_skip_violations.join(', ')}`,
  );
  assert.ok(m.prefilter.negatives_skipped >= 4, `음성 스킵 ${m.prefilter.negatives_skipped}건 — 비용 게이트가 무의미해짐`);
});

test('문서화 — 규칙 감지기는 양성을 전부 잡지 못한다 (감지기가 아니라 최저선인 이유)', () => {
  const missedSomething = Object.values(m.rules).some((r) => r.rules_missed_ids.length > 0);
  assert.ok(missedSomething, '규칙이 코퍼스 전 양성을 잡았다면 이 게이트와 설계 문서(규칙=최저선)를 함께 재검토할 것');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
