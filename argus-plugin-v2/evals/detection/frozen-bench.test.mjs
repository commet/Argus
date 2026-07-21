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

test('래칫: 톨러런스 안의 요동은 노이즈로 허용 (실 API 변동)', () => {
  // 정발동 -2, 과발동 +2 까지는 노이즈 (TOL=2). 첫 야간 run에서 20/0→21/1이
  // false-fail했던 실제 사례.
  const noise = { byMode: { mcp: { fired_correct: 21, over_fire: { fired: 1 } }, plugin: { fired_correct: 22, over_fire: { fired: 0 } } } };
  assert.equal(compareFrozen(base, noise).ok, true);
  const edge = { byMode: { mcp: { fired_correct: 16, over_fire: { fired: 2 } }, plugin: base.byMode.plugin } };
  assert.equal(compareFrozen(base, edge).ok, true, '정확히 TOL만큼은 허용');
});

test('래칫: 톨러런스 초과 정발동 하락은 회귀 (3+)', () => {
  const worse = { byMode: { mcp: { fired_correct: 15, over_fire: { fired: 0 } }, plugin: base.byMode.plugin } };
  const v = compareFrozen(base, worse);
  assert.equal(v.ok, false);
  assert.match(v.reasons.join(' '), /mcp: fired_correct 18→15/);
});

test('래칫: 톨러런스 초과 과발동 상승은 회귀 (한 모드만 나빠져도)', () => {
  const worse = { byMode: { mcp: base.byMode.mcp, plugin: { fired_correct: 22, over_fire: { fired: 4 } } } };
  const v = compareFrozen(base, worse);
  assert.equal(v.ok, false);
  assert.match(v.reasons.join(' '), /plugin: over_fire 1→4/);
});

test('래칫: 베이스라인 없는 모드는 건너뛴다', () => {
  assert.equal(compareFrozen({ byMode: {} }, base).ok, true);
});

test('추출 래칫: 베이스라인 judged:0(미측정)이면 매치가 낮아도 회귀 아님(새 지표 도입)', () => {
  const b = { byMode: { mcp: { fired_correct: 18, over_fire: { fired: 0 }, hidden_extraction: { judged: 0, matched: 0 } }, plugin: base.byMode.plugin } };
  const c = { byMode: { mcp: { fired_correct: 18, over_fire: { fired: 0 }, hidden_extraction: { judged: 6, matched: 1 } }, plugin: base.byMode.plugin } };
  assert.equal(compareFrozen(b, c).ok, true, '구지표 baseline엔 추출 회귀를 안 건다');
});

test('추출 래칫: 확립된 지표(judged>0)에서 매치가 hidTol 초과 하락하면 회귀', () => {
  const b = { byMode: { mcp: { fired_correct: 18, over_fire: { fired: 0 }, hidden_extraction: { judged: 14, matched: 11 } }, plugin: base.byMode.plugin } };
  const c = { byMode: { mcp: { fired_correct: 18, over_fire: { fired: 0 }, hidden_extraction: { judged: 14, matched: 6 } }, plugin: base.byMode.plugin } };
  const v = compareFrozen(b, c); // 11→6 = 5칸 하락 > hidTol(3)
  assert.equal(v.ok, false);
  assert.match(v.reasons.join(' '), /hidden_extraction\.matched 11→6/);
});

test('추출 래칫: hidTol=3(기본) — matched 10→8은 run 노이즈 허용, 10→6은 회귀', () => {
  // R15: 비결정 감지기+LLM 판정이라 단일 run ±2~3 요동. 10→8(2칸)은 노이즈로 통과해야
  // 거짓 회귀를 안 낸다(hidTol=1이 정확히 이 지점에서 거짓 회귀를 냈다).
  const b = { byMode: { mcp: { fired_correct: 29, over_fire: { fired: 0 }, hidden_extraction: { judged: 14, matched: 10 } }, plugin: base.byMode.plugin } };
  const noise = { byMode: { mcp: { fired_correct: 27, over_fire: { fired: 0 }, hidden_extraction: { judged: 14, matched: 8 } }, plugin: base.byMode.plugin } };
  assert.equal(compareFrozen(b, noise).ok, true, '10→8(2칸)은 노이즈로 허용');
  const collapse = { byMode: { mcp: { fired_correct: 29, over_fire: { fired: 0 }, hidden_extraction: { judged: 14, matched: 6 } }, plugin: base.byMode.plugin } };
  const v = compareFrozen(b, collapse); // 10→6 = 4칸 > 3
  assert.equal(v.ok, false, '10→6(4칸) 실회귀는 잡힌다');
  assert.match(v.reasons.join(' '), /hidden_extraction\.matched 10→6/);
});

test('추출 래칫: 현재 judged:0(인프라 실패)이면 매치 회귀로 오판 안 함', () => {
  const b = { byMode: { mcp: { fired_correct: 18, over_fire: { fired: 0 }, hidden_extraction: { judged: 6, matched: 5 } }, plugin: base.byMode.plugin } };
  const c = { byMode: { mcp: { fired_correct: 18, over_fire: { fired: 0 }, hidden_extraction: { judged: 0, matched: 0 } }, plugin: base.byMode.plugin } };
  assert.equal(compareFrozen(b, c).ok, true, '현재 judged:0은 회귀 아님(스킵)');
});

test('래칫: 0-시나리오 현재값은 rate-limit로 보고 회귀 오판 안 함', () => {
  // 실 사례: rate limit로 프로즌이 20→0을 냈으나 회귀가 아니라 인프라 실패.
  const empty = { byMode: {
    mcp: { scenarios: 0, planted_total: 0, fired_correct: 0, over_fire: { fired: 0 } },
    plugin: { scenarios: 0, planted_total: 0, fired_correct: 0, over_fire: { fired: 0 } },
  } };
  assert.equal(compareFrozen(base, empty).ok, true);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
