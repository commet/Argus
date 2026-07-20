/**
 * 감지 LLM 레이어 — 주입되는 진단 지시(sense-signal.js가 매 턴 꽂는 것)를 실모델에
 * 돌려, 코퍼스 라벨 대비 감지 품질(특히 숨은 전제 recall)을 잰다.
 *
 *   ANTHROPIC_API_KEY=... node argus-plugin-v2/evals/detection/detect-eval.mjs
 *
 * 키가 없으면: 각 케이스의 정확한 진단 프롬프트를 dump하고(--dump), 별도로 채운
 * 결과 파일(results.json)을 채점만 한다(--score results.json). 이렇게 해야
 * "모델을 스크립트로 못 부르는 환경"에서도 사람이/세션모델이 감지를 수행하고 그
 * 산출을 결정론적으로 채점할 수 있다 — 채점 로직은 코드가 소유(라벨은 코드에).
 *
 * 산출 계약(모델이 케이스마다 반환할 JSON):
 *   { prediction: bool, outcome: bool, assumption_stated: bool,
 *     hidden_assumption: string|null }   // hidden = 발화에 없던 전제의 추출문(핵심)
 * hidden_assumption은 bool이 아니라 '무엇을 뽑았는지' 문자열이다 — 추출 품질을
 * 사람이 라벨 의도와 대조할 수 있어야 하기 때문(그럴듯한 걸 맞다고 우기기 금지).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORPUS } from './corpus.mjs';
import { windowOf } from './measure.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// 실모델에 주입되는 지시의 정본 압축 — sense-signal.js buildDiagnosis와 같은 3감각.
// (러너는 훅을 import하지 않는다: 훅은 stdin 파이프라인이라 여기선 지시 텍스트만 필요.)
export const DIAGNOSIS_INSTRUCTION = [
  'You are the sense running under an Argus session. Diagnose THIS conversation turn by MEANING, not keywords. Return ONLY a JSON object:',
  '{ "prediction": boolean, "outcome": boolean, "assumption_stated": boolean, "hidden_assumption": string|null }',
  '- prediction: does anything imply a future state reality will later prove true or false (even with a soft horizon like "나중에 무리가 올 것 같은데")? A checkable claim, not a vibe.',
  '- outcome: given the OPEN PREDICTIONS listed (if any), does this turn reveal what reality did to one — including an implicit/pronoun reference ("그거 결국 잘 됐어")?',
  '- assumption_stated: is there a MARKED load-bearing premise (an explicit "as long as / ~니까 / only if" the call would flip on)?',
  '- hidden_assumption: the single UNSTATED premise the reasoning most rests on — the one that flips the call if it breaks, that the user did NOT say out loud. Write it as one plain sentence, or null if there is genuinely none. This is the core sense: surface what was not said.',
].join('\n');

export function buildPrompt(c) {
  const openLine = (c.open && c.open.length)
    ? `OPEN PREDICTIONS on record:\n${c.open.map((p) => `  - "${p}"`).join('\n')}\n\n`
    : 'OPEN PREDICTIONS on record: (none)\n\n';
  return `${DIAGNOSIS_INSTRUCTION}\n\n${openLine}CONVERSATION TURN:\n${windowOf(c)}`;
}

/* ── 채점 ─────────────────────────────────────────────────────────────────────
 * detected: { prediction, outcome, assumption_stated, hidden_assumption }
 * hidden_assumption recall = hidden 라벨 케이스 중 모델이 non-null 추출을 낸 비율.
 * 추출의 '정확도'(의미가 라벨 의도와 맞나)는 사람/세션모델 판정 필드로 남긴다 —
 * 코드는 non-null 여부(표면 recall)까지만 결정론으로 채점하고, 의미 일치는
 * results.json의 hidden_ok(사람이 채운 bool)로 받는다. */
export function score(results) {
  const byId = new Map(results.map((r) => [r.id, r.detected]));
  const rows = CORPUS.map((c) => ({ ...c, detected: byId.get(c.id) || null }));

  const metric = (label, key) => {
    const labeled = rows.filter((r) => r.labels.includes(label));
    const hit = labeled.filter((r) => r.detected && r.detected[key]);
    return { n: labeled.length, hit: hit.length, missed: labeled.filter((r) => !(r.detected && r.detected[key])).map((r) => r.id) };
  };

  const hiddenCases = rows.filter((r) => r.labels.includes('hidden_assumption'));
  const hiddenIds = new Set(hiddenCases.map((r) => r.id));
  const hiddenSurfaced = hiddenCases.filter((r) => r.detected && r.detected.hidden_assumption);
  // meaning_ok는 hidden 라벨 케이스에 한정 — 예측 케이스에 부수로 뽑힌 hidden(맞아도)이
  // 지표를 부풀리지 않게 교차한다.
  const hiddenOkField = results.filter((r) => r.hidden_ok === true && hiddenIds.has(r.id)).map((r) => r.id);

  // 음성 오탐: 라벨이 빈(잡담) 케이스에 무언가를 감지했나
  const negatives = rows.filter((r) => r.labels.length === 0);
  const falseFires = negatives.filter((r) => r.detected &&
    (r.detected.prediction || r.detected.outcome || r.detected.assumption_stated || r.detected.hidden_assumption));

  return {
    n: rows.length,
    prediction: metric('prediction', 'prediction'),
    outcome: metric('outcome', 'outcome'),
    assumption_stated: metric('assumption', 'assumption_stated'),
    hidden_assumption: {
      n: hiddenCases.length,
      surfaced_nonnull: hiddenSurfaced.length,
      surfaced_ids: hiddenSurfaced.map((r) => r.id),
      missed_ids: hiddenCases.filter((r) => !(r.detected && r.detected.hidden_assumption)).map((r) => r.id),
      meaning_ok_ids: hiddenOkField,
      recall_surface: hiddenCases.length ? hiddenSurfaced.length / hiddenCases.length : null,
      recall_meaning: hiddenCases.length ? hiddenOkField.length / hiddenCases.length : null,
    },
    negatives: { n: negatives.length, false_fire_ids: falseFires.map((r) => r.id) },
    rows,
  };
}

function pct(x) { return x == null ? 'n/a' : `${Math.round(x * 1000) / 10}%`; }

function printReport(s) {
  console.log(`\n감지 LLM 레이어 리포트 — 코퍼스 ${s.n}건\n`);
  const line = (label, m) => console.log(`  ${label.padEnd(20)} ${m.hit}/${m.n} (${pct(m.n ? m.hit / m.n : null)})${m.missed.length ? `  미스: ${m.missed.join(', ')}` : ''}`);
  line('prediction', s.prediction);
  line('outcome', s.outcome);
  line('assumption(stated)', s.assumption_stated);
  const h = s.hidden_assumption;
  console.log(`\n  ★ hidden_assumption (핵심 지표)`);
  console.log(`    표면 recall (non-null 추출): ${h.surfaced_nonnull}/${h.n} (${pct(h.recall_surface)})`);
  console.log(`    의미 recall (라벨 의도 일치): ${h.meaning_ok_ids.length}/${h.n} (${pct(h.recall_meaning)})`);
  if (h.missed_ids.length) console.log(`    미추출: ${h.missed_ids.join(', ')}`);
  console.log(`\n  음성 오탐(잡담에 발화): ${s.negatives.false_fire_ids.length}/${s.negatives.n}${s.negatives.false_fire_ids.length ? ` — ${s.negatives.false_fire_ids.join(', ')}` : ''}`);
}

const arg = process.argv[2];
if (arg === '--dump') {
  for (const c of CORPUS) {
    console.log(`\n===== ${c.id} [labels: ${c.labels.join(',') || 'none'}] =====`);
    console.log(buildPrompt(c));
  }
} else if (arg === '--score') {
  const results = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const s = score(results);
  printReport(s);
  fs.writeFileSync(path.join(HERE, 'detect-report.json'), JSON.stringify(s, null, 2));
  console.log(`\n리포트 저장: evals/detection/detect-report.json`);
} else if (process.env.ANTHROPIC_API_KEY) {
  // 라이브: 키가 있으면 실제 API로 각 케이스를 돌린다.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const MODEL = process.env.EVAL_DETECT_MODEL || 'claude-opus-4-8';
  const results = [];
  for (const c of CORPUS) {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 400,
      messages: [{ role: 'user', content: buildPrompt(c) }],
    });
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const m = text.match(/\{[\s\S]*\}/);
    let detected = null;
    try { detected = m ? JSON.parse(m[0]) : null; } catch { detected = null; }
    results.push({ id: c.id, detected });
    console.log(`  ${c.id}: ${detected ? JSON.stringify(detected) : 'PARSE_FAIL'}`);
  }
  fs.writeFileSync(path.join(HERE, 'results.live.json'), JSON.stringify(results, null, 2));
  printReport(score(results));
} else {
  console.log('키 없음. 프롬프트 dump: node detect-eval.mjs --dump');
  console.log('결과 채점:      node detect-eval.mjs --score results.json');
}
