/**
 * MCP 발동 시뮬레이션 — "MCP에서 모델이 매 턴 스스로 발동하는가"를 실제 MCP
 * 메커니즘 그대로 잰다: 서버 instructions(SERVER_INSTRUCTIONS)를 system으로,
 * 진짜 공개 툴 정의를 tools로 주고, 훅의 강제 주입 없이 tool_choice:auto로 모델이
 * 스스로 툴을 부르는지 본다. 이것이 raw MCP의 정확한 조건이다 (플러그인 훅과 달리
 * 매 턴 진단 지시가 재주입되지 않는다).
 *
 *   ANTHROPIC_API_KEY=... node argus-plugin-v2/evals/detection/mcp-firing-sim.mjs
 *
 * 채점: 양성 케이스는 '올바른 툴'을 불렀나(예측→predict, 정산→resolve,
 * 전제/숨은전제→capture). 음성 케이스는 침묵했나(툴 호출 0). over-fire=음성에 호출.
 * 라벨/코퍼스/서버지침은 코드가 소유 — 그럴듯한 자기보고가 끼어들 자리 없음.
 *
 * 이 숫자는 raw MCP의 하한(floor)이다: instructions만으로 얼마나 발동하는지.
 * 플러그인은 이 위에 매 턴 강제 주입을 얹어 P(주입)=1로 만든다 — 둘의 차이가
 * 정확히 훅의 값어치다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORPUS } from './corpus.mjs';
import { windowOf } from './measure.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MCP_SIM_MODEL || 'claude-opus-4-8';
if (!KEY) { console.log('키 없음 — ANTHROPIC_API_KEY 필요'); process.exit(0); }

// 정본 서버 지침을 dist에서 읽는다(빌드 산출). 없으면 소스 문자열 추출.
async function serverInstructions() {
  const distPath = path.resolve(HERE, '../../../argus-mcp/dist/lib/spine.js');
  if (fs.existsSync(distPath)) {
    const mod = await import('file://' + distPath);
    if (mod.SERVER_INSTRUCTIONS) return mod.SERVER_INSTRUCTIONS;
  }
  const src = fs.readFileSync(path.resolve(HERE, '../../../argus-mcp/src/lib/spine.ts'), 'utf8');
  const m = src.match(/export const SERVER_INSTRUCTIONS = \[([\s\S]*?)\]\.join\('\\n'\);/);
  if (!m) throw new Error('SERVER_INSTRUCTIONS 추출 실패');
  // 간단 파서: 따옴표 문자열 라인들을 개행으로 잇는다.
  return m[1].split('\n').map((l) => {
    const q = l.match(/^\s*'((?:[^'\\]|\\.)*)',?\s*$/);
    return q ? q[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : null;
  }).filter((x) => x !== null).join('\n');
}

// 실제 공개 툴 정의(이름·설명은 public-tools.ts 정본과 동형; 스키마는 최소).
// 발동 여부만 재므로 인자 스키마는 대표 필드만 — 모델이 '부를지'만 본다.
const TOOLS = [
  { name: 'argus_predict', description: 'Make a falsifiable prediction and the date reality can answer it, in the user\'s own words. Users rarely say "predict"; a claim pairing a direction/target with a horizon or number IS a prediction.',
    input_schema: { type: 'object', properties: { predicate: { type: 'string' }, check_by: { type: 'string' } }, required: ['predicate'] } },
  { name: 'argus_resolve', description: 'Record what actually happened to a tracked prediction. When the conversation reveals the outcome — even by pronoun ("그거 결국 잘 됐어") — record it then; reality judges, not the model.',
    input_schema: { type: 'object', properties: { id: { type: 'string' }, what_happened: { type: 'string' } }, required: ['what_happened'] } },
  { name: 'argus_capture', description: 'Capture the reasoning a decision rests on in the user\'s own words — its load-bearing assumption, often UNSTATED — without deciding for the user. At most one, as an ai_surfaced draft, never a verdict.',
    input_schema: { type: 'object', properties: { decision: { type: 'string' }, load_bearing_assumption: { type: 'string' } } } },
  { name: 'argus_check_in', description: 'Show decisions, facts, and open questions that need attention now. Read-only.',
    input_schema: { type: 'object', properties: {} } },
];

const WANT = { prediction: 'argus_predict', outcome: 'argus_resolve', assumption: 'argus_capture', hidden_assumption: 'argus_capture' };

function openContext(c) {
  if (!c.open || !c.open.length) return '';
  // raw MCP에선 열린 예측을 모델이 check_in으로 이미 봤다고 가정 — system에 상주 사실로.
  return `\n\nAlready on record (open predictions you are tracking):\n${c.open.map((p) => `- "${p}"`).join('\n')}`;
}

async function fireOnce(instructions, c) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 700,
      system: instructions + openContext(c),
      tools: TOOLS, tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: windowOf(c) }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const calls = (data.content || []).filter((b) => b.type === 'tool_use').map((b) => b.name);
  return calls;
}

const instructions = await serverInstructions();
const results = [];
for (const c of CORPUS) {
  let calls = [];
  try { calls = await fireOnce(instructions, c); }
  catch (e) { console.log(`  ${c.id}: ERROR ${e.message}`); results.push({ id: c.id, calls: null }); continue; }
  results.push({ id: c.id, calls });
  console.log(`  ${c.id.padEnd(22)} [${c.labels.join(',') || 'none'}] → ${calls.length ? calls.join(',') : '(silent)'}`);
}

// ── 채점 ─────────────────────────────────────────────────────────────────────
const byId = new Map(results.map((r) => [r.id, r.calls]));
const positives = CORPUS.filter((c) => c.labels.length);
const negatives = CORPUS.filter((c) => !c.labels.length);

let firedCorrect = 0, firedAny = 0;
const missedIds = [];
for (const c of positives) {
  const calls = byId.get(c.id) || [];
  const want = new Set(c.labels.map((l) => WANT[l]).filter(Boolean));
  const hitCorrect = calls.some((n) => want.has(n));
  if (calls.length) firedAny++;
  if (hitCorrect) firedCorrect++; else missedIds.push(`${c.id}(${calls.join(',') || 'silent'})`);
}
const overFire = negatives.filter((c) => (byId.get(c.id) || []).length > 0);

function pct(n, d) { return d ? `${Math.round((n / d) * 1000) / 10}%` : 'n/a'; }
console.log(`\n=== MCP 발동 시뮬레이션 (raw MCP: instructions + tools, 훅 없음) — ${MODEL} ===`);
console.log(`양성 ${positives.length}건`);
console.log(`  올바른 툴 발동: ${firedCorrect}/${positives.length} (${pct(firedCorrect, positives.length)})`);
console.log(`  아무 툴이라도 발동: ${firedAny}/${positives.length} (${pct(firedAny, positives.length)})`);
if (missedIds.length) console.log(`  미발동/오발동: ${missedIds.join(' · ')}`);
console.log(`음성 ${negatives.length}건`);
console.log(`  over-fire(잡담에 발동): ${overFire.length}/${negatives.length} (${pct(overFire.length, negatives.length)})${overFire.length ? ' — ' + overFire.map((c) => c.id).join(', ') : ''}`);

fs.writeFileSync(path.join(HERE, 'mcp-firing-report.json'), JSON.stringify({
  model: MODEL, positives: positives.length, negatives: negatives.length,
  fired_correct: firedCorrect, fired_any: firedAny, over_fire: overFire.map((c) => c.id),
  missed: missedIds, raw: results,
}, null, 2));
console.log(`\n리포트 저장: evals/detection/mcp-firing-report.json`);
