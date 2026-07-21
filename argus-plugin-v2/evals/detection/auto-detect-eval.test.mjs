#!/usr/bin/env node
/**
 * auto-detect-eval의 순수 로직(스코어러·집계·파서·감지기 오케스트레이션) 단위 검증.
 * LLM 호출은 callModel 주입 fixture로 대체 — 키 없이 로직이 맞는지 고정한다
 * (라이브 경로는 mcp-firing-sim의 검증된 fetch 패턴을 미러하므로 저위험).
 *
 * Run: node argus-plugin-v2/evals/detection/auto-detect-eval.test.mjs
 */
import assert from 'node:assert/strict';
import {
  scoreScenario, aggregate, runDetector, generateScenario, judgeHidden, judgeSpine, judgeUserSim, extractJson, WANT,
} from './auto-detect-eval.mjs';

let pass = 0, fail = 0;
function test(name, fn) {
  Promise.resolve().then(fn).then(() => { console.log('  ok   ' + name); pass++; })
    .catch((e) => { console.log('  FAIL ' + name + ' — ' + (e && e.message)); fail++; });
}

// ── scoreScenario: recall(올바른 툴) + over-fire(filler 발동) ────────────────
test('scoreScenario: 올바른 툴 발동만 hit, filler 발동은 over-fire', () => {
  const scenario = {
    turns: [{ role: 'user', text: 'a' }, { role: 'user', text: 'b' }, { role: 'user', text: 'c' }, { role: 'user', text: 'd' }],
    planted: [
      { turn: 0, kind: 'prediction', gist: 'x' },
      { turn: 1, kind: 'hidden_assumption', gist: 'y' },
      { turn: 2, kind: 'outcome', gist: 'z' },
    ],
    filler_user_turns: [3],
  };
  const fires = { 0: ['argus_predict'], 1: [], 2: ['argus_resolve'], 3: ['argus_capture'] };
  const s = scoreScenario(scenario, fires);
  assert.equal(s.planted.find((r) => r.turn === 0).hit, true, 'prediction→predict hit');
  assert.equal(s.planted.find((r) => r.turn === 1).hit, false, 'hidden not fired → miss');
  assert.equal(s.planted.find((r) => r.turn === 2).hit, true, 'outcome→resolve hit');
  assert.equal(s.overfire.length, 1, 'filler turn 3 fired → over-fire');
  assert.equal(s.overfire[0].turn, 3);
});

test('scoreScenario: 틀린 툴을 불러도 hit 아님', () => {
  const scenario = { turns: [{ role: 'user', text: 'a' }], planted: [{ turn: 0, kind: 'prediction', gist: 'x' }], filler_user_turns: [] };
  const s = scoreScenario(scenario, { 0: ['argus_capture'] }); // 예측인데 capture 부름
  assert.equal(s.planted[0].hit, false);
});

test('WANT 매핑: hidden_assumption과 assumption 둘 다 capture', () => {
  assert.equal(WANT.hidden_assumption, 'argus_capture');
  assert.equal(WANT.assumption, 'argus_capture');
  assert.equal(WANT.prediction, 'argus_predict');
  assert.equal(WANT.outcome, 'argus_resolve');
});

// ── aggregate: 종류별 recall + over-fire + 숨은전제 매치 ─────────────────────
test('aggregate: 여러 시나리오를 종류별로 접는다', () => {
  const per = [
    { scenario: { filler_user_turns: [9] }, score: { planted: [{ kind: 'prediction', hit: true }, { kind: 'hidden_assumption', hit: true }], overfire: [] }, hiddenJudged: [{ match: true }] },
    { scenario: { filler_user_turns: [8, 7] }, score: { planted: [{ kind: 'prediction', hit: false }, { kind: 'outcome', hit: true }], overfire: [{ turn: 8 }] }, hiddenJudged: [] },
  ];
  const a = aggregate(per);
  assert.equal(a.scenarios, 2);
  assert.equal(a.recall.prediction.n, 2);
  assert.equal(a.recall.prediction.hit, 1);
  assert.equal(a.recall.outcome.hit, 1);
  assert.equal(a.recall.hidden_assumption.hit, 1);
  assert.equal(a.over_fire.filler_total, 3);
  assert.equal(a.over_fire.fired, 1);
  assert.equal(a.hidden_extraction.judged, 1);
  assert.equal(a.hidden_extraction.matched, 1);
});

// ── runDetector: USER 턴에서만 감지, capture 인자 텍스트 수집 ────────────────
test('runDetector: user 턴만 감지·assistant 턴은 건너뜀·capture 텍스트 수집', async () => {
  const scenario = { turns: [
    { role: 'user', text: '무료 플랜 없애자' },
    { role: 'assistant', text: '검토해볼게요' },
    { role: 'user', text: '고마워' },
  ] };
  // fixture callModel: 0번 턴엔 capture 발동(인자 포함), 2번 턴엔 무발동
  let call = 0;
  const fake = async () => {
    call++;
    if (call === 1) return { content: [{ type: 'tool_use', name: 'argus_capture', input: { load_bearing_assumption: '무료를 없애면 유료로 전환한다' } }] };
    return { content: [{ type: 'text', text: 'ok' }] };
  };
  const { fires, captures } = await runDetector(fake, 'SYS', scenario);
  assert.deepEqual(fires[0], ['argus_capture']);
  assert.equal(fires[1], undefined, 'assistant 턴은 감지 안 함');
  assert.deepEqual(fires[2], []);
  assert.equal(captures[0], '무료를 없애면 유료로 전환한다');
  assert.equal(call, 2, 'user 턴 2개만 호출');
});

// ── generateScenario: JSON 파싱·기본값 ──────────────────────────────────────
test('generateScenario: 코드펜스 감싼 JSON도 파싱, filler 기본값', async () => {
  const fake = async () => ({ content: [{ type: 'text', text: '```json\n{"turns":[{"role":"user","text":"a"}],"planted":[]}\n```' }] });
  const s = await generateScenario(fake, 1);
  assert.ok(Array.isArray(s.turns) && Array.isArray(s.planted));
  assert.deepEqual(s.filler_user_turns, []);
});

test('generateScenario: turns 없으면 null', async () => {
  const fake = async () => ({ content: [{ type: 'text', text: '{"nope":true}' }] });
  assert.equal(await generateScenario(fake, 1), null);
});

// ── judgeHidden: 적대적 기본값(미스) ────────────────────────────────────────
test('judgeHidden: 캡처 없으면 즉시 미스, 파싱 실패도 미스', async () => {
  assert.equal((await judgeHidden(async () => ({}), 'gist', '')).match, false);
  const garbage = async () => ({ content: [{ type: 'text', text: 'no json here' }] });
  assert.equal((await judgeHidden(garbage, 'gist', 'captured')).match, false);
});

test('judgeHidden: 판정기 match:true를 전달', async () => {
  const yes = async () => ({ content: [{ type: 'text', text: '{"match":true,"why":"same risk"}' }] });
  assert.equal((await judgeHidden(yes, 'gist', 'captured')).match, true);
});

test('extractJson: 앞뒤 산문 무시', () => {
  assert.deepEqual(extractJson('sure: {"a":1} done'), { a: 1 });
  assert.equal(extractJson('none'), null);
});


// ── 거울 품질 판정기: 기본값이 엄격/정직한가 ─────────────────────────────────
test('judgeSpine: 파싱 실패는 위반으로 플래그(스파인은 관대하게 안 넘김)', async () => {
  const garbage = async () => ({ content: [{ type: 'text', text: 'no json' }] });
  const v = await judgeSpine(garbage, 'argus_capture', 'some capture');
  assert.equal(v.violation, true);
  assert.equal(v.kind, 'unparseable');
});

test('judgeSpine: 텍스트 없으면 검사 대상 아님', async () => {
  const v = await judgeSpine(async () => ({}), 'argus_check_in', '');
  assert.equal(v.violation, false);
});

test('judgeSpine: 판정 JSON 전달', async () => {
  const yes = async () => ({ content: [{ type: 'text', text: '{"violation":true,"kind":"verdict","why":"says should"}' }] });
  const v = await judgeSpine(yes, 'argus_capture', 'you should reconsider');
  assert.equal(v.violation, true);
  assert.equal(v.kind, 'verdict');
});

test('judgeUserSim: 파싱 실패는 inconclusive(수락률 부풀리기 금지)', async () => {
  const garbage = async () => ({ content: [{ type: 'text', text: 'nah' }] });
  const u = await judgeUserSim(garbage, [{ role: 'user', text: 'hi' }], 'argus_predict', 'p');
  assert.equal(u.inconclusive, true);
  assert.equal(u.would_keep, false);
});

test('judgeUserSim: 역할극 반응 전달', async () => {
  const yes = async () => ({ content: [{ type: 'text', text: '{"would_keep":true,"annoyed":false,"why":"real call"}' }] });
  const u = await judgeUserSim(yes, [{ role: 'user', text: 'x' }], 'argus_capture', 'premise');
  assert.equal(u.would_keep, true);
  assert.equal(u.annoyed, false);
});

test('runDetector: firedTexts에 predict predicate도 수집', async () => {
  const fake = async () => ({ content: [{ type: 'tool_use', name: 'argus_predict', input: { predicate: 'churn drops below 3% by Q3' } }] });
  const { firedTexts } = await runDetector(fake, 'SYS', { turns: [{ role: 'user', text: 'we will cut churn' }] });
  assert.equal(firedTexts[0][0].tool, 'argus_predict');
  assert.match(firedTexts[0][0].text, /churn drops/);
});

// 비동기 test들 완료 대기 후 요약
setTimeout(() => {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 500);
