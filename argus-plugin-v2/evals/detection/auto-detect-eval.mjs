/**
 * 자동 감지 eval — 생성 → 감지 → 판정 루프. 밤새 무인 실행용(GitHub Actions).
 *
 * 목적: 손으로 만든 31케이스를 넘어, 현실적인 다중 턴 업무 대화를 대량으로
 * 생성하고 실제 MCP 감지 메커니즘에 흘려 recall·over-fire·숨은전제 매치를
 * 무인으로 잰다. "실제 데이터 가정 → 실제 상황에 먹이기 → 판정"의 자동화.
 *
 * 3역할 분리(자가채점 함정 차단):
 *   생성기 A  — 다중 턴 대화 + '몇 번 턴에 무엇을 심었나' 매니페스트(정답=설계).
 *   감지기    — 진짜 메커니즘: SERVER_INSTRUCTIONS(system) + 진짜 툴 정의 +
 *               tool_choice:auto. mcp-firing-sim과 동일 충실도(라이브 검증됨).
 *   판정기 B  — 숨은 전제를 실제로 잡았는지 심은 것과 대조. 애매하면 '미스'.
 *
 * 정직: 이것은 합성 스케일 도구다 — 실패 모드 발굴·회귀 추적을 대량·무인으로.
 * 실 트랜스크립트 recall(transcript-recall.mjs)을 대체하지 않는다. 둘 다 필요.
 *
 *   ANTHROPIC_API_KEY=... node auto-detect-eval.mjs [--scenarios 20]
 *
 * 산출: auto-detect-report.json(이번 실행) + auto-detect-trend.jsonl(누적 추이).
 * callModel 주입 가능 → 스코어러/파서는 fixture로 단위 검증(auto-detect-eval.test.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ── 진짜 서버 지침 + 툴 정의 (mcp-firing-sim와 동일 소스/충실도) ─────────── */
export async function serverInstructions() {
  const distPath = path.resolve(HERE, '../../../argus-mcp/dist/lib/spine.js');
  if (fs.existsSync(distPath)) {
    const mod = await import('file://' + distPath);
    if (mod.SERVER_INSTRUCTIONS) return mod.SERVER_INSTRUCTIONS;
  }
  const src = fs.readFileSync(path.resolve(HERE, '../../../argus-mcp/src/lib/spine.ts'), 'utf8');
  const m = src.match(/export const SERVER_INSTRUCTIONS = \[([\s\S]*?)\]\.join\('\\n'\);/);
  if (!m) throw new Error('SERVER_INSTRUCTIONS 추출 실패');
  return m[1].split('\n').map((l) => {
    const q = l.match(/^\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    return q ? q[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : null;
  }).filter((x) => x !== null).join('\n');
}

export const TOOLS = [
  { name: 'argus_predict', description: 'Make a falsifiable prediction and the date reality can answer it, in the user\'s own words. A claim pairing a direction/target with a horizon or number IS a prediction.',
    input_schema: { type: 'object', properties: { predicate: { type: 'string' }, check_by: { type: 'string' } }, required: ['predicate'] } },
  { name: 'argus_resolve', description: 'Record what actually happened to a tracked prediction. When the conversation reveals the outcome — even by pronoun — record it then.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, what_happened: { type: 'string' } }, required: ['what_happened'] } },
  { name: 'argus_capture', description: 'Capture the load-bearing assumption a decision rests on, in the user\'s words — often UNSTATED. At most one, as an ai_surfaced draft, never a verdict.',
    input_schema: { type: 'object', properties: { decision: { type: 'string' }, load_bearing_assumption: { type: 'string' } } } },
  { name: 'argus_check_in', description: 'Show decisions, facts, and open questions that need attention now. Read-only.',
    input_schema: { type: 'object', properties: {} } },
];

export const WANT = { prediction: 'argus_predict', outcome: 'argus_resolve', assumption: 'argus_capture', hidden_assumption: 'argus_capture' };

/* ── LLM 호출 (주입 가능) ─────────────────────────────────────────────────── */
export function makeAnthropicCaller(key, model) {
  return async function callModel({ system, messages, tools, tool_choice, max_tokens = 1200 }) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens, system, messages, ...(tools ? { tools } : {}), ...(tool_choice ? { tool_choice } : {}) }),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  };
}
const textOf = (data) => (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
const toolUsesOf = (data) => (data.content || []).filter((b) => b.type === 'tool_use').map((b) => ({ name: b.name, input: b.input || {} }));
export function extractJson(s) { const m = String(s).match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } }

/* ── 생성기 A ─────────────────────────────────────────────────────────────── */
const GEN_SYSTEM = `You generate a REALISTIC multi-turn work conversation between a founder/engineer (user) and an AI assistant, for testing a decision-sense detector. Make it natural and specific (real product/eng/business texture), NOT a list of test sentences.

Plant a small number of DETECTABLE signals across the turns, and DECLARE them:
- prediction: a claim reality can later check (a direction/target + horizon or number).
- outcome: a turn where reality answers an EARLIER planted prediction (may be a pronoun reference).
- hidden_assumption: a consequential decision whose load-bearing premise is UNSTATED in the turn.
Also include FILLER turns that carry NO signal (a plain instruction, chitchat, a question) to test over-fire.

Return ONLY JSON:
{
 "turns": [{"role":"user"|"assistant","text": "..."}],
 "planted": [{"turn": <index of a USER turn>, "kind":"prediction"|"outcome"|"hidden_assumption", "gist":"one sentence: for hidden_assumption, the unstated premise itself; for outcome, which planted prediction it settles"}],
 "filler_user_turns": [<indices of USER turns with NO signal>]
}
Rules: 6–12 turns, mixing user/assistant, starting with a user turn. 1–3 planted signals + at least 2 filler user turns. turn indices are 0-based over the WHOLE turns array and must point at role:"user" turns. Vary domain and language (some Korean, some English). Keep it plausible — a real session, not a quiz.`;

export async function generateScenario(callModel, seedHint) {
  const data = await callModel({ system: GEN_SYSTEM, messages: [{ role: 'user', content: `Generate scenario #${seedHint}. Make it distinct from typical examples.` }], max_tokens: 1600 });
  const obj = extractJson(textOf(data));
  if (!obj || !Array.isArray(obj.turns) || !Array.isArray(obj.planted)) return null;
  obj.filler_user_turns = Array.isArray(obj.filler_user_turns) ? obj.filler_user_turns : [];
  return obj;
}

/* ── 감지기 (진짜 메커니즘) ───────────────────────────────────────────────── */
// 각 USER 턴에서, 그 턴까지의 대화를 messages로 주고 tool_choice:auto로 발동 여부.
export async function runDetector(callModel, instructions, scenario) {
  const fires = {};    // turnIndex -> [toolNames]
  const captures = {}; // turnIndex -> the captured load_bearing_assumption text (if any)
  const msgs = [];
  for (let i = 0; i < scenario.turns.length; i++) {
    const t = scenario.turns[i];
    msgs.push({ role: t.role === 'assistant' ? 'assistant' : 'user', content: t.text });
    if (t.role !== 'user') continue;
    const data = await callModel({ system: instructions, tools: TOOLS, tool_choice: { type: 'auto' }, messages: msgs.slice(-8) });
    const uses = toolUsesOf(data);
    fires[i] = [...new Set(uses.map((u) => u.name))];
    const cap = uses.find((u) => u.name === 'argus_capture');
    if (cap) captures[i] = String(cap.input.load_bearing_assumption || cap.input.decision || '');
  }
  return { fires, captures };
}

/* ── 판정기 B (숨은 전제 매치, 적대적) ────────────────────────────────────── */
const JUDGE_SYSTEM = `You are a STRICT adversarial judge. A detector was supposed to surface a specific UNSTATED assumption behind a decision. You are given the PLANTED assumption and the detector's CAPTURED text. Decide if the captured text expresses the SAME load-bearing assumption (same risk, not just the same topic). Default to "false" when uncertain or when the capture is vague/generic. Return ONLY JSON: {"match": boolean, "why": "<short>"}.`;

export async function judgeHidden(callModel, plantedGist, capturedText) {
  if (!capturedText) return { match: false, why: 'no capture' };
  const data = await callModel({ system: JUDGE_SYSTEM, messages: [{ role: 'user', content: `PLANTED: ${plantedGist}\nCAPTURED: ${capturedText}` }], max_tokens: 200 });
  const obj = extractJson(textOf(data));
  return obj && typeof obj.match === 'boolean' ? obj : { match: false, why: 'unparseable → default miss' };
}

/* ── 스코어러 (순수, 단위 검증 대상) ──────────────────────────────────────── */
export function scoreScenario(scenario, fires) {
  const rows = [];
  for (const p of scenario.planted) {
    const fired = fires[p.turn] || [];
    const want = WANT[p.kind];
    rows.push({ kind: p.kind, turn: p.turn, gist: p.gist, fired, hit: fired.includes(want) });
  }
  const overfire = (scenario.filler_user_turns || [])
    .map((t) => ({ turn: t, fired: fires[t] || [] }))
    .filter((r) => r.fired.length > 0);
  return { planted: rows, overfire };
}

export function aggregate(perScenario) {
  const flat = perScenario.flatMap((s) => s.score.planted);
  const byKind = {};
  for (const k of ['prediction', 'outcome', 'assumption', 'hidden_assumption']) {
    const rows = flat.filter((r) => r.kind === k);
    byKind[k] = { n: rows.length, hit: rows.filter((r) => r.hit).length };
  }
  const fillerTotal = perScenario.reduce((a, s) => a + (s.scenario.filler_user_turns || []).length, 0);
  const overfire = perScenario.reduce((a, s) => a + s.score.overfire.length, 0);
  const hiddenJudged = perScenario.flatMap((s) => s.hiddenJudged || []);
  return {
    scenarios: perScenario.length,
    recall: byKind,
    planted_total: flat.length,
    fired_correct: flat.filter((r) => r.hit).length,
    over_fire: { filler_total: fillerTotal, fired: overfire },
    hidden_extraction: { judged: hiddenJudged.length, matched: hiddenJudged.filter((m) => m.match).length },
  };
}

/* ── main (라이브) ────────────────────────────────────────────────────────── */
async function main() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.log('키 없음 — ANTHROPIC_API_KEY 필요. (스코어러 단위 검증: auto-detect-eval.test.mjs)'); process.exit(0); }
  const N = Number((process.argv.find((a) => a.startsWith('--scenarios='))?.split('=')[1]) || process.env.AUTO_SCENARIOS || 12);
  const genModel = process.env.AUTO_GEN_MODEL || 'claude-sonnet-5';
  const detModel = process.env.AUTO_DETECT_MODEL || 'claude-opus-4-8';
  const judgeModel = process.env.AUTO_JUDGE_MODEL || 'claude-sonnet-5';
  const instructions = await serverInstructions();
  const gen = makeAnthropicCaller(key, genModel);
  const det = makeAnthropicCaller(key, detModel);
  const jud = makeAnthropicCaller(key, judgeModel);

  const perScenario = [];
  for (let i = 0; i < N; i++) {
    let scenario; try { scenario = await generateScenario(gen, i + 1); } catch (e) { console.log(`  gen#${i} ERR ${e.message}`); continue; }
    if (!scenario) { console.log(`  gen#${i} parse-fail`); continue; }
    let detected; try { detected = await runDetector(det, instructions, scenario); } catch (e) { console.log(`  det#${i} ERR ${e.message}`); continue; }
    const { fires, captures } = detected;
    const score = scoreScenario(scenario, fires);
    const hiddenJudged = [];
    for (const r of score.planted.filter((p) => p.kind === 'hidden_assumption')) {
      // 실제로 잡은 전제 텍스트(captures[turn])를 심은 gist와 대조 — 발동만으로는
      // '같은 위험을 잡았나'를 알 수 없으므로 판정기 B가 적대적으로 대조한다.
      const capturedText = captures[r.turn] || '';
      const verdict = capturedText ? await judgeHidden(jud, r.gist, capturedText) : { match: false, why: 'not captured' };
      hiddenJudged.push({ turn: r.turn, captured: capturedText.slice(0, 200), ...verdict });
    }
    perScenario.push({ scenario, score, hiddenJudged });
    const pr = score.planted.filter((p) => p.hit).length;
    console.log(`  scenario ${i + 1}/${N}: planted ${score.planted.length} → hit ${pr} · over-fire ${score.overfire.length}/${(scenario.filler_user_turns || []).length}`);
  }

  const agg = aggregate(perScenario);
  console.log('\n=== 자동 감지 eval 집계 ===');
  console.log(JSON.stringify(agg, null, 2));
  fs.writeFileSync(path.join(HERE, 'auto-detect-report.json'), JSON.stringify({ at: process.env.RUN_STAMP || null, models: { genModel, detModel, judgeModel }, agg, perScenario }, null, 2));
  // 추이 1줄 append (시간은 CI가 RUN_STAMP로 주입 — 스크립트는 Date 불가 환경 대비)
  fs.appendFileSync(path.join(HERE, 'auto-detect-trend.jsonl'), JSON.stringify({ at: process.env.RUN_STAMP || null, ...agg }) + '\n');
  console.log('\n리포트: auto-detect-report.json · 추이: auto-detect-trend.jsonl');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
