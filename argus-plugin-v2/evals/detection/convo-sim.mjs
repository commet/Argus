/**
 * convo-sim.mjs — 진짜 다중 턴 에이전트 루프 (2026-07-21, 창업자 지시:
 * "현실에서만 된다던 것까지 실제 시뮬로 구현해서 극한으로 파악·개선").
 *
 * 왜 이게 필요한가 (근본 원인):
 *   기존 runDetector(auto-detect-eval)와 fireOnce(mcp-firing-sim)는 전부 단발이다.
 *   매 턴 모델을 1회 부르고 tool_use 이름만 기록한 뒤 툴 결과를 버린다. 열린 예측은
 *   system 프롬프트에 미리 붙여 "이미 봤다고 가정"한다. 그래서 MCP 정산 라이더
 *   (public-tools.ts attachOpenPredictions: 어떤 argus 툴이 불리든 그 결과에
 *   open_predictions 상위 10 + standing_sense 한 줄을 동봉)의 효과가 원리적으로
 *   측정 불가였다 — 툴 결과가 대화로 안 돌아가니 모델이 열린 예측을 손에 못 쥔다.
 *   이게 인계 문서가 "합성 하네스로는 못 재고 실사용에서만 검증됨"이라 적은 그 구멍.
 *
 * 이 모듈이 그 구멍을 메운다:
 *   1) MockLedger — 인메모리 목 Argus 서버. predict/resolve/capture/check_in 실제 구현.
 *   2) attachRider — 실제 서버와 동형으로 툴 결과에 라이더 동봉(상위 10, check_by 정렬,
 *      predicate 140자 컷). check_in은 이미 open을 담으므로 이중 동봉 안 함.
 *   3) runConvo — 진짜 tool_use 루프. 모델이 툴을 부르면 실행하고 tool_result를 대화에
 *      되먹인 뒤 이어서 부른다. 2턴에 argus_predict로 심은 예측이 원장에 남고, 7턴
 *      정산 발화 때 라이더로 다시 보이므로 argus_resolve가 실제로 가능해진다.
 *
 * 이것으로 "정산 라이더가 정말 정산을 살리는가"를 합성으로 측정한다(단발 하네스의
 * 13/38 정산 미스가 라이더 있는 루프에서 회복되는지). 정직: 최종 정답은 여전히
 * transcript-recall(실세션)이다. 이 모듈은 합성 충실도를 거기 훨씬 가깝게 끌어올릴
 * 뿐, 실사용을 대체하지 않는다.
 *
 * callModel 주입 가능 → 루프 배선(툴 결과 되먹임 + 라이더)은 fixture로 단위 검증
 * (convo-sim.test.mjs, 키 불요). 라이브는 GitHub Actions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeAnthropicCaller, serverInstructions, extractJson,
  TOOLS, WANT, PLUGIN_AUGMENT, generateScenario, scoreScenario, aggregate, runPool,
} from './auto-detect-eval.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ── standing_sense 한 줄 (정본 spine에서 읽는다; serverInstructions와 동일 관례) ── */
export async function standingSense() {
  const distPath = path.resolve(HERE, '../../../argus-mcp/dist/lib/spine.js');
  if (fs.existsSync(distPath)) {
    const mod = await import('file://' + distPath);
    if (mod.STANDING_SENSE_REFRESH) return mod.STANDING_SENSE_REFRESH;
  }
  const src = fs.readFileSync(path.resolve(HERE, '../../../argus-mcp/src/lib/spine.ts'), 'utf8');
  const m = src.match(/export const STANDING_SENSE_REFRESH =\s*'((?:[^'\\]|\\.)*)';/);
  return m ? m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : '';
}

/* ── 목 Argus 서버 (인메모리 원장) ─────────────────────────────────────────────
 * 실제 서버의 정산 경로만 충실히 재현하면 된다: 예측을 sealed로 쥐고, 정산 발화에
 * resolve가 그 sealed를 settled로 바꾼다. id는 모델이 모를 때가 많으므로(라이더가
 * 주는 id를 쓰거나 생략) 없으면 가장 최근 sealed에 귀속한다 — 실제 서버도 관대. */
export class MockLedger {
  constructor() { this.seq = 0; this.contracts = new Map(); }
  _id() { return 'pred_' + (++this.seq); }
  _openList() {
    return [...this.contracts.values()]
      .filter((c) => c.status === 'sealed')
      .sort((x, y) => ((x.check_by || '') < (y.check_by || '') ? -1 : 1))
      .slice(0, 10)
      .map((c) => ({ id: c.id, predicate: String(c.predicate).slice(0, 140), check_by: c.check_by }));
  }
  predict({ predicate, check_by } = {}) {
    const id = this._id();
    this.contracts.set(id, { id, predicate: String(predicate || ''), check_by: check_by || null, status: 'sealed', outcome: null });
    return { ok: true, id, predicate: String(predicate || ''), check_by: check_by || null };
  }
  resolve({ id, what_happened } = {}) {
    let c = id ? this.contracts.get(id) : null;
    if (!c) { const open = this._openList(); c = open.length ? this.contracts.get(open[open.length - 1].id) : null; }
    if (!c) return { ok: false, error: 'no_open_prediction' };
    c.status = 'settled'; c.outcome = String(what_happened || '');
    return { ok: true, id: c.id, settled: true };
  }
  capture({ decision, load_bearing_assumption } = {}) {
    return { ok: true, captured: true, assumption: String(load_bearing_assumption || decision || '') };
  }
  checkIn() { return { ok: true, open_predictions: this._openList() }; }
  settledCount() { return [...this.contracts.values()].filter((c) => c.status === 'settled').length; }
  sealedCount() { return [...this.contracts.values()].filter((c) => c.status === 'sealed').length; }
}

/* 라이더 — attachOpenPredictions 미러. 이미 open을 담은 결과(check_in)엔 안 붙인다.
 * 실제 서버는 여기서 sanitizeOutput을 한 번 더 태운다(신뢰 경계). 시뮬 텍스트는
 * 모델/코퍼스 산출이라 무해하므로 세탁은 생략 — 발동/정산 측정에 영향 없음(주석 명시). */
export function attachRider(data, ledger, sense) {
  if (!data || data.ok === false || data.open_predictions) return data;
  const open = ledger._openList();
  if (!open.length) return data;
  return { ...data, open_predictions: open, standing_sense: sense };
}

export function executeTool(ledger, name, input, sense) {
  let data;
  switch (name) {
    case 'argus_predict': data = ledger.predict(input || {}); break;
    case 'argus_resolve': data = ledger.resolve(input || {}); break;
    case 'argus_capture': data = ledger.capture(input || {}); break;
    case 'argus_check_in': data = ledger.checkIn(); break;
    default: data = { ok: false, error: 'unknown_tool' };
  }
  return attachRider(data, ledger, sense);
}

const textOf = (data) => (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
const captureText = (input = {}) => String(
  input.load_bearing_assumption || input.predicate || input.what_happened || input.decision || '',
).slice(0, 400);

/* ── 진짜 다중 턴 에이전트 루프 ─────────────────────────────────────────────────
 * 대화를 turn-by-turn으로 재생하되, user 턴마다 tool_use가 나오면 실행하고
 * tool_result(라이더 포함)를 대화에 되먹인 뒤 이어서 부른다(MAX_TOOL_HOPS 상한).
 * messages는 실제 대화 전체를 유지한다 — 실세션처럼 모델이 전 맥락을 본다.
 *
 * plugin 모드: sense-signal 훅이 매 user 턴에 진단 지시를 additionalContext로 붙이는
 * 그대로, 각 user 발화에 PLUGIN_AUGMENT를 이어붙인다(매 턴 재주입 — 훅의 실제 동작).
 * mcp 모드: augment 없음. 둘 다 라이더 되먹임은 동일 — 차이는 훅 주입뿐. */
export async function runConvo(callModel, instructions, scenario, opts = {}) {
  const sense = opts.sense || '';
  const augment = opts.augment || null;
  const ledger = opts.ledger || new MockLedger();
  const maxHops = opts.maxToolHops || 4;
  const fires = {}; const captures = {}; const firedTexts = {};
  const messages = [];
  for (let i = 0; i < scenario.turns.length; i++) {
    const t = scenario.turns[i];
    const isUser = t.role !== 'assistant';
    const content = augment && isUser ? `${t.text}\n\n${augment}` : t.text;
    messages.push({ role: isUser ? 'user' : 'assistant', content });
    if (!isUser) continue;
    let hops = 0;
    while (hops++ < maxHops) {
      const data = await callModel({ system: instructions, tools: TOOLS, tool_choice: { type: 'auto' }, messages });
      const blocks = data.content || [];
      const uses = blocks.filter((b) => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: blocks.length ? blocks : [{ type: 'text', text: textOf(data) || 'ok' }] });
      if (!uses.length) break;
      fires[i] = [...new Set([...(fires[i] || []), ...uses.map((u) => u.name)])];
      for (const u of uses) {
        const txt = captureText(u.input);
        if (txt) (firedTexts[i] = firedTexts[i] || []).push({ tool: u.name, text: txt });
        if (u.name === 'argus_capture') captures[i] = String((u.input || {}).load_bearing_assumption || (u.input || {}).decision || '');
      }
      const results = uses.map((u) => ({
        type: 'tool_result',
        tool_use_id: u.id,
        content: JSON.stringify(executeTool(ledger, u.name, u.input || {}, sense)),
      }));
      messages.push({ role: 'user', content: results });
    }
  }
  return { fires, captures, firedTexts, ledger, messages };
}

/* ── 정산 요약 — 라이더 루프의 핵심 측정치 ────────────────────────────────────
 * 예측을 몇 개 심었나(planted pred), 모델이 몇 개를 predict로 봉인했나(sealed),
 * 결과를 몇 개 심었나(planted outcome), resolve가 몇 번 발동했나, 원장이 몇 개를
 * settled로 닫았나. "심은 예측이 원장에 남아 나중에 정산됐는가"의 end-to-end. */
export function settlementSummary(scenario, run) {
  const planted = scenario.planted || [];
  const plantedPred = planted.filter((p) => p.kind === 'prediction').length;
  const plantedOut = planted.filter((p) => p.kind === 'outcome').length;
  const resolveFires = Object.values(run.fires).flat().filter((n) => n === 'argus_resolve').length;
  return {
    planted_prediction: plantedPred,
    planted_outcome: plantedOut,
    sealed: run.ledger.sealedCount() + run.ledger.settledCount(),
    resolve_fires: resolveFires,
    settled: run.ledger.settledCount(),
  };
}

/* ── main (라이브, 키 필요) ────────────────────────────────────────────────────
 * 생성 시나리오를 mcp/plugin 두 모드로 진짜 루프에 흘려 recall/over-fire + 정산
 * 요약을 낸다. 판정기(hidden/spine/user-sim)는 auto-detect-eval이 이미 담당하므로
 * 여기선 라이더가 발동·정산에 주는 효과에 집중(중복 판정 비용 회피). */
async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log('키 없음 — ANTHROPIC_API_KEY 필요. (루프 배선 단위 검증: convo-sim.test.mjs)'); process.exit(0); }
  const N = Number((process.argv.find((a) => a.startsWith('--scenarios='))?.split('=')[1]) || process.env.CONVO_SCENARIOS || 6);
  const genModel = process.env.AUTO_GEN_MODEL || 'claude-sonnet-5';
  const detModel = process.env.AUTO_DETECT_MODEL || 'claude-opus-4-8';
  const gen = makeAnthropicCaller(key, genModel);
  const det = makeAnthropicCaller(key, detModel);
  const instructions = await serverInstructions();
  const sense = await standingSense();
  const CONC = Number(process.env.CONVO_CONCURRENCY || 1);
  const MODES = [{ key: 'mcp', augment: null }, { key: 'plugin', augment: PLUGIN_AUGMENT }];

  async function one(_item, i) {
    let scenario; try { scenario = await generateScenario(gen, i + 1); } catch (e) { return { error: 'gen ' + e.message }; }
    if (!scenario) return { error: 'gen parse-fail' };
    const out = { scenario, modes: {} };
    for (const m of MODES) {
      try {
        const run = await runConvo(det, instructions, scenario, { augment: m.augment, sense });
        out.modes[m.key] = { score: scoreScenario(scenario, run.fires), settlement: settlementSummary(scenario, run) };
      } catch (e) { out.modes[m.key] = { error: 'run ' + e.message }; }
    }
    console.log(`  scenario ${i + 1}/${N}: ` + MODES.map((m) => {
      const s = out.modes[m.key]; return s.score ? `${m.key} ${s.settlement.settled}/${s.settlement.planted_outcome} settled` : `${m.key} ERR`;
    }).join(' · '));
    return out;
  }

  const raw = await runPool(Array.from({ length: N }), one, CONC);
  const results = raw.filter((r) => r && r.scenario && r.modes);
  const genErrors = raw.filter((r) => r && r.error).map((r) => r.error);
  console.log(`\nGENERATOR_HEALTH: ok=${results.length} err=${genErrors.length}/${N}`);
  if (results.length === 0) console.log('GENERATOR_BROKEN: 0 usable scenarios.');

  const report = { at: process.env.RUN_STAMP || null, scenarios: results.length, byMode: {} };
  for (const m of MODES) {
    const per = results.filter((r) => r.modes[m.key] && r.modes[m.key].score)
      .map((r) => ({ scenario: r.scenario, score: r.modes[m.key].score, hiddenJudged: [] }));
    const agg = aggregate(per);
    const settlements = results.map((r) => r.modes[m.key] && r.modes[m.key].settlement).filter(Boolean);
    agg.settlement = settlements.reduce((a, s) => ({
      planted_outcome: a.planted_outcome + s.planted_outcome,
      resolve_fires: a.resolve_fires + s.resolve_fires,
      settled: a.settled + s.settled,
    }), { planted_outcome: 0, resolve_fires: 0, settled: 0 });
    report.byMode[m.key] = agg;
  }
  console.log('\n=== convo-sim (진짜 루프 + 라이더 되먹임) ===');
  console.log(JSON.stringify(report.byMode, null, 2));
  fs.writeFileSync(path.join(HERE, 'convo-sim-report.json'), JSON.stringify({ ...report, perScenario: results }, null, 2));
  console.log('\n리포트: convo-sim-report.json');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
