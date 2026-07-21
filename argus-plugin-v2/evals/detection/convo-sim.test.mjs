#!/usr/bin/env node
/**
 * convo-sim의 순수 배선 검증 — 진짜 다중 턴 루프가 (1) 툴 결과를 대화에 되먹이고
 * (2) 라이더(open_predictions + standing_sense)를 동봉하며 (3) 심은 예측이 원장에
 * 남아 나중 턴에 정산되는지를 키 없이 고정한다. callModel은 스크립트 fixture로 대체.
 *
 * Run: node argus-plugin-v2/evals/detection/convo-sim.test.mjs
 */
import assert from 'node:assert/strict';
import { MockLedger, attachRider, executeTool, runConvo, settlementSummary } from './convo-sim.mjs';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ── MockLedger: 봉인 → 열린 목록 → 정산 ─────────────────────────────────────
test('MockLedger: predict가 sealed로 열린 목록에 뜨고, resolve가 settled로 닫는다', () => {
  const l = new MockLedger();
  const p = l.predict({ predicate: 'ship by Friday', check_by: '2026-07-10' });
  assert.equal(p.ok, true);
  assert.equal(l._openList().length, 1, '봉인 후 열린 예측 1건');
  assert.equal(l.sealedCount(), 1);
  const r = l.resolve({ what_happened: 'shipped on time' }); // id 생략 → 최근 sealed에 귀속
  assert.equal(r.ok, true);
  assert.equal(r.settled, true);
  assert.equal(l.settledCount(), 1, 'settled 1건');
  assert.equal(l._openList().length, 0, '정산되면 열린 목록에서 빠진다');
});

test('MockLedger._openList: check_by 정렬 + 상위 10 컷 + predicate 140자 컷', () => {
  const l = new MockLedger();
  for (let i = 0; i < 12; i++) l.predict({ predicate: 'x'.repeat(200) + i, check_by: `2026-08-${String(12 - i).padStart(2, '0')}` });
  const open = l._openList();
  assert.equal(open.length, 10, '상위 10만');
  assert.ok(open[0].check_by <= open[1].check_by, 'check_by 오름차순');
  assert.equal(open[0].predicate.length, 140, 'predicate 140자 컷');
});

// ── 라이더: 실제 서버 attachOpenPredictions 미러 ────────────────────────────
test('attachRider: 비-checkin 결과엔 open_predictions + standing_sense 동봉', () => {
  const l = new MockLedger();
  l.predict({ predicate: 'churn under 3% by Q3', check_by: '2026-09-30' });
  const out = executeTool(l, 'argus_capture', { load_bearing_assumption: 'price is the buy driver' }, 'SENSE-LINE');
  assert.ok(Array.isArray(out.open_predictions) && out.open_predictions.length === 1, 'capture 결과에 열린 예측 동봉');
  assert.equal(out.standing_sense, 'SENSE-LINE', 'standing_sense 한 줄 동봉');
});

test('attachRider: check_in 결과는 이미 open을 담으므로 이중 동봉 안 함', () => {
  const l = new MockLedger();
  l.predict({ predicate: 'p', check_by: '2026-09-01' });
  const out = executeTool(l, 'argus_check_in', {}, 'SENSE-LINE');
  assert.ok(Array.isArray(out.open_predictions), 'check_in은 open을 담는다');
  assert.equal(out.standing_sense, undefined, 'check_in엔 라이더가 덧붙지 않는다(이미 담김)');
});

test('attachRider: 열린 예측이 없으면 라이더를 안 붙인다', () => {
  const l = new MockLedger();
  const out = executeTool(l, 'argus_capture', { load_bearing_assumption: 'a' }, 'SENSE-LINE');
  assert.equal(out.open_predictions, undefined, '빈 원장 → 라이더 없음');
});

// ── runConvo: end-to-end 정산 (라이더 되먹임의 핵심) ────────────────────────
// 스크립트 모델: prediction 발화 → argus_predict, 나중 outcome 발화 → argus_resolve.
// tool_result가 되먹여진 다음 hop에서는 텍스트로 멈춘다(무한 발동 방지).
function scriptedCaller() {
  return async ({ messages }) => {
    const last = messages[messages.length - 1];
    // 직전이 tool_result면 이 턴 발동은 끝 — 텍스트로 마무리.
    if (last && Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_result')) {
      return { content: [{ type: 'text', text: 'noted' }] };
    }
    const text = typeof last?.content === 'string' ? last.content : '';
    if (/ship to TestFlight by Friday/i.test(text)) {
      return { content: [{ type: 'tool_use', id: 'tu-pred', name: 'argus_predict', input: { predicate: 'shipped to TestFlight by Friday', check_by: '2026-07-10' } }] };
    }
    if (/shipped fine|that shipped/i.test(text)) {
      return { content: [{ type: 'tool_use', id: 'tu-res', name: 'argus_resolve', input: { what_happened: 'shipped to TestFlight, on time' } }] };
    }
    return { content: [{ type: 'text', text: 'ok' }] };
  };
}

test('runConvo: 2턴에 심은 예측이 원장에 남아 3턴 정산 발화에서 settled 된다', async () => {
  const scenario = {
    turns: [
      { role: 'user', text: 'We will ship to TestFlight by Friday.' },
      { role: 'assistant', text: 'Sounds good, tracking that.' },
      { role: 'user', text: 'yeah that shipped fine.' },
    ],
    planted: [
      { turn: 0, kind: 'prediction', gist: 'ship Friday' },
      { turn: 2, kind: 'outcome', gist: 'settles the ship prediction' },
    ],
    filler_user_turns: [],
  };
  const run = await runConvo(scriptedCaller(), 'INSTR', scenario, { sense: 'SENSE-LINE' });
  assert.ok((run.fires[0] || []).includes('argus_predict'), '0턴에 predict 발동');
  assert.ok((run.fires[2] || []).includes('argus_resolve'), '2턴에 resolve 발동');
  assert.equal(run.ledger.settledCount(), 1, '원장이 예측을 settled로 닫음(end-to-end 정산)');
});

test('runConvo: tool_result가 실제로 대화에 되먹여진다 (단발이 아님)', async () => {
  const scenario = { turns: [{ role: 'user', text: 'We will ship to TestFlight by Friday.' }], planted: [], filler_user_turns: [] };
  const run = await runConvo(scriptedCaller(), 'INSTR', scenario, { sense: 'SENSE-LINE' });
  const toolResults = run.messages.filter((m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_result'));
  assert.equal(toolResults.length, 1, 'tool_result 메시지가 대화에 1건 추가됨');
  const payload = JSON.parse(toolResults[0].content[0].content);
  assert.ok(Array.isArray(payload.open_predictions) && payload.open_predictions.length === 1, '되먹인 tool_result에 라이더(열린 예측) 포함');
  assert.equal(payload.standing_sense, 'SENSE-LINE', '되먹인 결과에 standing_sense 포함');
});

test('settlementSummary: 심은 예측/결과와 정산 결과를 집계한다', async () => {
  const scenario = {
    turns: [
      { role: 'user', text: 'We will ship to TestFlight by Friday.' },
      { role: 'user', text: 'yeah that shipped fine.' },
    ],
    planted: [{ turn: 0, kind: 'prediction', gist: 'p' }, { turn: 1, kind: 'outcome', gist: 'o' }],
    filler_user_turns: [],
  };
  const run = await runConvo(scriptedCaller(), 'INSTR', scenario, { sense: 'S' });
  const sum = settlementSummary(scenario, run);
  assert.equal(sum.planted_prediction, 1);
  assert.equal(sum.planted_outcome, 1);
  assert.equal(sum.resolve_fires, 1);
  assert.equal(sum.settled, 1);
});

// ── 순차 실행 + 요약 (async 안전) ────────────────────────────────────────────
let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log('  ok   ' + t.name); pass++; }
  catch (e) { console.log('  FAIL ' + t.name + ' — ' + (e && e.message)); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
