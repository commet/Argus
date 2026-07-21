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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function makeAnthropicCaller(key, model) {
  return async function callModel({ system, messages, tools, tool_choice, max_tokens = 1200 }) {
    // 페이싱(rate limit의 진짜 해법): 재시도로 버티는 게 아니라 콜 사이 간격을 둬
    // 애초에 한도 아래로 유지한다. 저-tier 키가 동시성 3에도 429 storm으로 0을
    // 내던 야간 사례 → 콜당 최소 지연. 느려도 완주 > 빠르고 0.
    await sleep(Number(process.env.AUTO_MIN_DELAY_MS || 1500));
    // 429/5xx는 지수 백오프 재시도(일시적 초과 흡수). 지속 오류만 던진다.
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens, system, messages, ...(tools ? { tools } : {}), ...(tool_choice ? { tool_choice } : {}) }),
        });
        if (res.ok) return res.json();
        if (res.status === 429 || res.status >= 500) { lastErr = new Error(`API ${res.status}`); await sleep(2000 * 2 ** attempt); continue; }
        throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
      } catch (e) { lastErr = e; await sleep(2000 * 2 ** attempt); }
    }
    throw lastErr;
  };
}

// 제한 동시성 실행 — throughput을 위해 시나리오를 병렬로. C개까지 동시.
export async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try { results[i] = await worker(items[i], i); } catch (e) { results[i] = { error: String(e && e.message) }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results;
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
FIDELITY — it must read like a REAL captured session, not a test (this is the whole point: a synthetic env that behaves like a human user):
- Pick a concrete PERSONA (e.g. solo SaaS founder, platform-eng lead, growth PM, clinic operator, indie game dev, agency owner) and a specific DOMAIN with real texture — actual metrics, tools, dates, names. Keep the SAME persona across all turns.
- Real work has interruptions, half-thoughts, corrections, and turns that are pure logistics or venting. EMBED the planted signals inside that texture; never announce them. The load-bearing assumption should be genuinely UNSTATED — a premise the persona would not think to say out loud.
- Vary register (terse Slack-style vs. thinking-out-loud) and language (some Korean, some English). Make each scenario number a DIFFERENT persona/domain so the set is diverse.

Rules: 6–12 turns, mixing user/assistant, starting with a user turn. 1–3 planted signals + at least 2 filler user turns. turn indices are 0-based over the WHOLE turns array and must point at role:"user" turns. Keep it plausible — a real session, not a quiz.`;

export async function generateScenario(callModel, seedHint) {
  // max_tokens 4000: 6~12턴 대화 + planted 매니페스트 JSON은 1600에 잘려 파싱
  // 실패(야간 첫 run이 0 시나리오였던 근본 원인 — 절단된 JSON은 extractJson에서
  // 중괄호 불균형으로 null). 넉넉히 준다.
  const data = await callModel({ system: GEN_SYSTEM, messages: [{ role: 'user', content: `Generate scenario #${seedHint}. Make it distinct from typical examples.` }], max_tokens: 4000 });
  const obj = extractJson(textOf(data));
  if (!obj || !Array.isArray(obj.turns) || !Array.isArray(obj.planted)) return null;
  obj.filler_user_turns = Array.isArray(obj.filler_user_turns) ? obj.filler_user_turns : [];
  return obj;
}

/* ── 감지기 (진짜 메커니즘, 2모드) ─────────────────────────────────────────
 * mode 'mcp'    = raw MCP: SERVER_INSTRUCTIONS(system) + 툴 + auto. 훅 없음.
 * mode 'plugin' = 플러그인: 위에 더해, 매 USER 턴에 훅이 주입하는 3감각 진단
 *   지시를 컨텍스트로 덧붙인다(sense-signal이 additionalContext로 하는 그대로).
 *   둘의 차이 = 훅의 값어치. 같은 시나리오에 둘 다 돌려 A/B. */
export const PLUGIN_AUGMENT = [
  '[Argus sense — every-turn diagnosis injected by the plugin hook. Judge by MEANING, not keywords.]',
  'Diagnose THIS turn: (1) a checkable PREDICTION (direction/target + horizon or number)? (2) an OUTCOME resolving a tracked prediction (pronoun references included)? (3) the single load-bearing ASSUMPTION the decision rests on — usually NOT the reason they said out loud (that is the surface) but the specific, often-unstated fact the decision REVERSES on if false; name THAT, not a restatement of their rationale. If consequential, call the matching Argus tool (predict/resolve/capture) in the user\'s words — at most one, never a verdict.',
  'RESTRAINT (over-fire is a spine violation): a turn that only asks you to DO a task (write, review, summarize, configure, debug, draft), a logistics / scheduling / booking / recommendation question, or small talk is NOT a decision, prediction, or assumption — call NOTHING and just help. Fire only when the user is actually making a consequential call reality will later judge. Offer at most once per distinct decision (a skip is final for it); never two replies in a row. TIMING: record on the turn where the signal APPEARS — if the user has already moved on to another topic, the moment has passed: stay silent rather than firing late (a late interruption breaks flow and reads as noise). When unsure, call nothing.',
].join('\n');

export async function runDetector(callModel, instructions, scenario, opts = {}) {
  const augment = opts.augment || null;
  const fires = {};      // turnIndex -> [toolNames]
  const captures = {};   // turnIndex -> the captured load_bearing_assumption text (if any)
  const firedTexts = {}; // turnIndex -> [{tool, text}] — 스파인/인간 판정용 발화 원문
  const msgs = [];
  for (let i = 0; i < scenario.turns.length; i++) {
    const t = scenario.turns[i];
    const base = { role: t.role === 'assistant' ? 'assistant' : 'user', content: t.text };
    msgs.push(base);
    if (t.role !== 'user') continue;
    // 플러그인 모드: 이 턴에 한해 진단 지시를 덧붙인 사본으로 호출(대화 원문은 안 오염).
    const sendMsgs = augment
      ? [...msgs.slice(-8, -1), { role: 'user', content: `${t.text}\n\n${augment}` }]
      : msgs.slice(-8);
    const data = await callModel({ system: instructions, tools: TOOLS, tool_choice: { type: 'auto' }, messages: sendMsgs });
    const uses = toolUsesOf(data);
    fires[i] = [...new Set(uses.map((u) => u.name))];
    firedTexts[i] = uses.map((u) => ({
      tool: u.name,
      text: String(u.input.load_bearing_assumption || u.input.predicate || u.input.what_happened || u.input.decision || '').slice(0, 400),
    })).filter((x) => x.text);
    const cap = uses.find((u) => u.name === 'argus_capture');
    if (cap) captures[i] = String(cap.input.load_bearing_assumption || cap.input.decision || '');
  }
  return { fires, captures, firedTexts };
}

/* ── 스파인 판정기 — 발동한 텍스트가 거울인가 평결인가 (2026-07-21 신설).
 * 지금까지 eval은 '옳은 툴이 발동했나'만 쟀다 — capture가 평결투("재고하세요")로
 * 발동해도 만점이었고, 무한 루프가 그 방향으로 진화할 수 있었다(Goodhart).
 * 이 판정기가 발동 텍스트 전수를 스파인으로 검문한다. 애매하면 위반(엄격). */
const SPINE_JUDGE_SYSTEM = `You are a STRICT spine judge for Argus, whose spine is "record the user's judgment, never judge it". You are given the TEXT an Argus tool call carried (an assumption capture, a prediction predicate, or an outcome record). Flag a VIOLATION if the text: gives a verdict or recommendation ("you should", "it would be better", "this is risky/wrong/right"); renders a two-pole fork or comparison of options; carries a disclaimed lean ("not my call, but X seems stronger"); grades or praises the user; stacks more than ONE assumption into the capture; or puts words in the user's mouth (paraphrase presented as their statement rather than a neutral candidate). NOT a violation: a neutral falsifiable statement, a single unstated premise phrased as a fact/candidate, the user's own words recorded. Default to violation:true when uncertain. Return ONLY JSON on one line: {"violation": boolean, "kind": "<verdict|fork|lean|grade|multiple|voice|none>", "why": "<10 words max>"}.`;

export async function judgeSpine(callModel, tool, text) {
  if (!text) return { violation: false, kind: 'none', why: 'no text' };
  const data = await callModel({ system: SPINE_JUDGE_SYSTEM, messages: [{ role: 'user', content: `TOOL: ${tool}\nTEXT: ${text}` }], max_tokens: 500 });
  const obj = extractJson(textOf(data));
  // 파싱 실패 = 사람이 볼 것으로 플래그 (스파인은 관대하게 넘기지 않는다)
  return obj && typeof obj.violation === 'boolean' ? obj : { violation: true, kind: 'unparseable', why: 'judge parse fail → flag' };
}

/* ── 인간 역할극 판정기 — 이 순간 이 발동이 거울로 느껴지는가 (2026-07-21).
 * 창업자 지시: "현실을 인간처럼 가정해서 feedback을 먹여라". 바쁜 사용자를
 * 역할극해 각 발동에 대해 Keep을 누를지/짜증날지를 판정 — 수락률·짜증률이
 * 거울 품질의 합성 프록시가 된다(실사용 수락률의 선행 지표, 대체는 아님). */
const USER_SIM_SYSTEM = `You are ROLE-PLAYING a busy founder/engineer in the middle of real work with an AI assistant. You value your flow. You did NOT ask for decision-tracking, but a tool (Argus) quietly watches for consequential calls and may offer — at most one line — to record a prediction/assumption/outcome. Given the recent conversation and what Argus just offered/recorded, react HONESTLY as this person: (a) would you tap Keep (it names something real you'd want reality to grade)? (b) does the interruption annoy you here (wrong moment, trivial call, feels judgy, breaks flow)? Be tough but fair — a good mirror at the right moment is genuinely welcome; noise is not. Return ONLY JSON: {"would_keep": boolean, "annoyed": boolean, "why": "<short>"}.`;

export async function judgeUserSim(callModel, contextTurns, tool, text) {
  const ctx = contextTurns.map((t) => `${t.role}: ${t.text}`).join('\n').slice(-1500);
  const data = await callModel({ system: USER_SIM_SYSTEM, messages: [{ role: 'user', content: `RECENT CONVERSATION:\n${ctx}\n\nARGUS FIRED: ${tool} — "${text}"` }], max_tokens: 250 });
  const obj = extractJson(textOf(data));
  return obj && typeof obj.would_keep === 'boolean' ? obj : { would_keep: false, annoyed: false, inconclusive: true, why: 'parse fail' };
}

/* ── 판정기 B (숨은 전제 매치, 적대적) ────────────────────────────────────── */
const JUDGE_SYSTEM = `You are a STRICT adversarial judge. A detector was supposed to surface a specific UNSTATED assumption behind a decision. You are given the PLANTED assumption and the detector's CAPTURED text. Decide if the captured text expresses the SAME load-bearing assumption (same risk, not just the same topic). Default to "false" when uncertain or when the capture is vague/generic. Return ONLY JSON: {"match": boolean, "why": "<short>"}.`;

export async function judgeHidden(callModel, plantedGist, capturedText) {
  if (!capturedText) return { match: false, why: 'no capture' };
  // max_tokens 500: judgeSpine과 대칭. 200이면 한국어 "why"가 절단돼 unparseable→
  // default miss가 되고, 그 오탐 miss가 frozen 래칫에 감지 회귀로 잡혀 false-fail을
  // 낸다(R8 judgeSpine와 동일 계열 버그; R15 frozen에서 hid-ko-pricing이 이렇게 샘).
  const data = await callModel({ system: JUDGE_SYSTEM, messages: [{ role: 'user', content: `PLANTED: ${plantedGist}\nCAPTURED: ${capturedText}` }], max_tokens: 500 });
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

  const CONC = Number(process.env.AUTO_CONCURRENCY || 1);
  const MODES = [{ key: 'mcp', augment: null }, { key: 'plugin', augment: PLUGIN_AUGMENT }];

  // 시나리오 하나당: 생성 1회 → 두 모드로 감지 → 각 모드 숨은전제 판정.
  async function oneScenario(_item, i) {
    let scenario; try { scenario = await generateScenario(gen, i + 1); } catch (e) { return { error: 'gen ' + e.message }; }
    if (!scenario) return { error: 'gen parse-fail' };
    const out = { scenario, modes: {} };
    for (const m of MODES) {
      let detected; try { detected = await runDetector(det, instructions, scenario, { augment: m.augment }); } catch (e) { out.modes[m.key] = { error: 'det ' + e.message }; continue; }
      const score = scoreScenario(scenario, detected.fires);
      const hiddenJudged = [];
      for (const r of score.planted.filter((p) => p.kind === 'hidden_assumption')) {
        const capturedText = detected.captures[r.turn] || '';
        const verdict = capturedText ? await judgeHidden(jud, r.gist, capturedText) : { match: false, why: 'not captured' };
        hiddenJudged.push({ turn: r.turn, captured: capturedText.slice(0, 200), ...verdict });
      }
      // 거울 품질 축 — 발동 텍스트 전수를 스파인 검문 + 인간 역할극 반응.
      const spineJudged = [];
      const userSim = [];
      for (const [turnIdx, uses] of Object.entries(detected.firedTexts)) {
        for (const u of uses) {
          const sv = await judgeSpine(jud, u.tool, u.text);
          spineJudged.push({ turn: +turnIdx, tool: u.tool, text: u.text.slice(0, 160), ...sv });
          const ctxTurns = scenario.turns.slice(Math.max(0, +turnIdx - 3), +turnIdx + 1);
          const us = await judgeUserSim(jud, ctxTurns, u.tool, u.text);
          userSim.push({ turn: +turnIdx, tool: u.tool, ...us });
        }
      }
      out.modes[m.key] = { score, hiddenJudged, spineJudged, userSim };
    }
    const line = MODES.map((m) => { const s = out.modes[m.key]; return s.score ? `${m.key} hit ${s.score.planted.filter((p) => p.hit).length}/${s.score.planted.length} of ${s.score.overfire.length}` : `${m.key} ERR`; }).join(' · ');
    console.log(`  scenario ${i + 1}/${N}: ${line}`);
    return out;
  }

  const raw = await runPool(Array.from({ length: N }), oneScenario, CONC);
  const results = raw.filter((r) => r && r.scenario && r.modes);
  // 생성기 건강 — 0 시나리오는 조용히 성공한 척하면 안 된다(LLM-glue 함정: eval이
  // '통과'했지만 아무것도 안 함). 루프가 이 라인을 grep해 생성기 결함을 잡는다.
  const genErrors = raw.filter((r) => r && r.error).map((r) => r.error);
  console.log(`\nGENERATOR_HEALTH: ok=${results.length} err=${genErrors.length}/${N}`);
  if (genErrors.length) console.log(`  gen 오류 표본: ${[...new Set(genErrors)].slice(0, 3).join(' | ')}`);
  if (results.length === 0) console.log('GENERATOR_BROKEN: 0 usable scenarios — 합성 볼륨이 죽음. 생성기 수리 필요.');

  // 모드별 집계 — perScenario를 모드별 뷰로 접는다.
  const report = { at: process.env.RUN_STAMP || null, models: { genModel, detModel, judgeModel }, scenarios: results.length, byMode: {} };
  const findings = [];
  for (const m of MODES) {
    const per = results.filter((r) => r.modes[m.key] && r.modes[m.key].score)
      .map((r) => ({ scenario: r.scenario, score: r.modes[m.key].score, hiddenJudged: r.modes[m.key].hiddenJudged, spineJudged: r.modes[m.key].spineJudged || [], userSim: r.modes[m.key].userSim || [] }));
    report.byMode[m.key] = aggregate(per);
    // 거울 품질 집계 — 스파인 위반율 + 역할극 수락/짜증률.
    const allSpine = per.flatMap((s) => s.spineJudged);
    const allSim = per.flatMap((s) => s.userSim).filter((u) => !u.inconclusive);
    report.byMode[m.key].spine = { checked: allSpine.length, violations: allSpine.filter((v) => v.violation).length };
    report.byMode[m.key].user_sim = { offers: allSim.length, keep: allSim.filter((u) => u.would_keep).length, annoyed: allSim.filter((u) => u.annoyed).length };
    for (const s of per) {
      const turnText = (i) => (s.scenario.turns[i]?.text || '').slice(0, 240);
      for (const r of s.score.planted.filter((p) => !p.hit)) findings.push({ mode: m.key, type: 'miss', kind: r.kind, want: WANT[r.kind], fired: r.fired, gist: r.gist, user_turn: turnText(r.turn) });
      for (const o of s.score.overfire) findings.push({ mode: m.key, type: 'over_fire', fired: o.fired, user_turn: turnText(o.turn) });
      for (const h of (s.hiddenJudged || []).filter((x) => !x.match && x.why !== 'not fired' && x.why !== 'not captured')) findings.push({ mode: m.key, type: 'hidden_mismatch', gist: s.score.planted.find((p) => p.turn === h.turn)?.gist, captured: h.captured, why: h.why });
      for (const v of s.spineJudged.filter((x) => x.violation)) findings.push({ mode: m.key, type: 'spine_violation', kind: v.kind, tool: v.tool, text: v.text, why: v.why, user_turn: turnText(v.turn) });
      for (const u of s.userSim.filter((x) => x.annoyed)) findings.push({ mode: m.key, type: 'user_annoyed', tool: u.tool, why: u.why, user_turn: turnText(u.turn) });
    }
  }

  console.log('\n=== 자동 감지 eval 집계 (MCP vs 플러그인) ===');
  console.log(JSON.stringify(report.byMode, null, 2));
  console.log('\n===AUTO_FINDINGS_START===');
  console.log(JSON.stringify({ byMode: report.byMode, failures: findings.slice(0, 50), failure_total: findings.length }));
  console.log('===AUTO_FINDINGS_END===');
  fs.writeFileSync(path.join(HERE, 'auto-detect-report.json'), JSON.stringify({ ...report, perScenario: results }, null, 2));
  fs.appendFileSync(path.join(HERE, 'auto-detect-trend.jsonl'), JSON.stringify({ at: report.at, scenarios: report.scenarios, byMode: report.byMode }) + '\n');
  console.log('\n리포트: auto-detect-report.json · 추이: auto-detect-trend.jsonl');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
