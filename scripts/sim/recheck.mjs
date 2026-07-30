/**
 * recheck.mjs — post-hoc repair + extended mechanical checks (zero LLM calls).
 *
 * The first campaign ran 3 scenarios concurrently against ONE shared shim call
 * log, so `record.calls` / per-turn `_rawText` slices captured neighbours'
 * calls. Transcripts and judge inputs were never affected (they come from the
 * engine's return values). This script:
 *   1. pools every persisted call across results, dedupes by seq,
 *   2. re-attributes calls by "user prompt embeds the scenario opening",
 *   3. re-derives per-turn raw text (fast-tier calls in seq order),
 *   4. recomputes mechanical checks (+ 2 new checks:
 *      open real_question must end with '?', EN locale purity),
 *   5. rewrites results/<id>.json and _summary.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS } from './scenarios.mjs';

const SIM_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SIM_DIR, 'results');

const records = [];
for (const sc of SCENARIOS) {
  const f = path.join(RESULTS_DIR, `${sc.id}.json`);
  if (fs.existsSync(f)) records.push({ sc, rec: JSON.parse(fs.readFileSync(f, 'utf8')), file: f });
}

// 1) global pool, dedupe by seq
const pool = new Map();
for (const { rec } of records) {
  for (const c of rec.calls || []) if (!pool.has(c.seq)) pool.set(c.seq, c);
}
const allCalls = [...pool.values()].sort((a, b) => a.seq - b.seq);

const belongs = (c, sc) => typeof c.user === 'string' && c.user.includes(sc.opening.slice(0, 30));

const BANNED = [
  { rule: '금지어:초안', src: '초안' },
  { rule: '금지어:걸어두(내기 어휘)', src: '걸어\\s?[두둘둔]' },
  { rule: '금지어:베팅', src: '베팅' },
  { rule: '금지어:「」괄호 인용', src: '「|」' },
];

function mechanicalChecks(record) {
  const findings = [];
  const argusTurns = record.transcript.filter((t) => t.actor === 'argus');

  for (const t of argusTurns) {
    for (const b of BANNED) {
      const re = new RegExp(b.src);
      if (re.test(t.text)) {
        const line = t.text.split('\n').find((l) => re.test(l)) || t.text.slice(0, 120);
        findings.push({ rule: b.rule, phase: t.phase, detail: `"${line.trim()}"` });
      }
    }
  }

  if (record.light) {
    for (const c of record.calls) {
      if (c.tier !== 'fast' || !c.rawText) continue;
      if (/"options"\s*:/.test(c.rawText)) {
        findings.push({ rule: 'light:options 배열 출력(코어션이 드랍)', phase: `call#${c.seq}`, detail: c.rawText.slice(0, 200) });
      }
    }
    const asks = 1 + (record.light.turns || []).filter((t) => t.action === 'ask').length;
    if (asks > 2) findings.push({ rule: 'light:질문 상한 초과(>2)', phase: 'light', detail: `asks=${asks}` });
    for (const [i, t] of (record.light.turns || []).entries()) {
      if ((t._qasLen ?? 0) >= 2 && t._rawText && /"action"\s*:\s*"ask"/.test(t._rawText)) {
        findings.push({ rule: 'light:질문 예산 소진 후 3번째 질문 시도(클램프가 차단)', phase: `light_turn_${i + 1}`, detail: t._rawText.slice(0, 150) });
      }
    }
  }

  if (record.heavy && record.heavy.initial) {
    const raw = record.heavy.initial.raw || {};
    const rt = raw.request_type;
    const nonOpen = ['vent', 'validation', 'info', 'self_profiling', 'flat', 'resistance', 'crisis'];
    if (nonOpen.includes(rt)) {
      if (Array.isArray(raw.skeleton) && raw.skeleton.length > 0) {
        findings.push({ rule: `heavy:${rt}인데 skeleton ${raw.skeleton.length}개(route contract 위반, 코어션이 제거)`, phase: 'heavy_initial', detail: String(raw.skeleton[0]) });
      }
      if (raw.next_question && raw.next_question.text) {
        findings.push({ rule: `heavy:${rt}인데 next_question 생성`, phase: 'heavy_initial', detail: raw.next_question.text });
      }
    }
    // NEW: prompt contract — open real_question must BE a question
    if ((rt === 'open' || rt === undefined) && typeof raw.real_question === 'string'
        && raw.real_question.trim() && !/[?？]\s*$/.test(raw.real_question.trim())) {
      findings.push({ rule: 'heavy:open인데 real_question이 의문문이 아님(?로 안 끝남)', phase: 'heavy_initial', detail: `"${raw.real_question}"` });
    }
    for (const [i, d] of (record.heavy.deepening || []).entries()) {
      if (typeof d.real_question === 'string' && d.real_question.trim() && !/[?？]\s*$/.test(d.real_question.trim())) {
        findings.push({ rule: 'heavy:deepening real_question이 의문문이 아님', phase: `heavy_deepening_${i + 1}`, detail: `"${d.real_question}"` });
      }
    }
  }

  // NEW: EN locale purity — an en scenario must not surface Hangul
  if (record.locale === 'en') {
    for (const t of argusTurns) {
      if (/[가-힣]/.test(t.text)) {
        findings.push({ rule: 'locale:EN 시나리오에 한글 노출', phase: t.phase, detail: t.text.slice(0, 120) });
      }
    }
  }

  const qFields = [];
  if (record.route?.gate?.question) qFields.push(['light_gate', record.route.gate.question]);
  for (const [i, t] of (record.light?.turns || []).entries()) {
    if (t.question) qFields.push([`light_turn_${i + 1}`, t.question]);
  }
  if (record.heavy?.initial?.result?.next_question?.text) qFields.push(['heavy_initial', record.heavy.initial.result.next_question.text]);
  for (const d of record.heavy?.deepening || []) {
    if (d.next_question?.text) qFields.push(['heavy_deepening', d.next_question.text]);
  }
  for (const [phase, q] of qFields) {
    if ((q.match(/\?/g) || []).length >= 2) {
      findings.push({ rule: '질문 1회 1개 위반(한 질문 필드에 ?가 2개 이상)', phase, detail: `"${q}"` });
    }
  }

  return { findings };
}

const canAttribute = allCalls.some((c) => typeof c.user === 'string');
for (const { sc, rec, file } of records) {
  // correct calls for this scenario — ONLY when the persisted entries carry the
  // user prompt (older runs did not; wiping them would destroy raw evidence).
  if (canAttribute) {
    const own = allCalls.filter((c) => belongs(c, sc));
    rec.calls = own;
    // re-derive per-turn raw: successful fast calls in order → [gate, turn1, turn2…]
    if (rec.light) {
      const fastOk = own.filter((c) => c.tier === 'fast' && c.rawText && !c.error);
      const nextCalls = fastOk.slice(1); // first is the gate
      for (const [i, t] of (rec.light.turns || []).entries()) {
        t._qasLen = i + 1;
        t._rawText = nextCalls[i]?.rawText || '';
      }
    }
  }

  rec.mechanical = mechanicalChecks(rec);
  fs.writeFileSync(file, JSON.stringify(rec, null, 2), 'utf8');
  console.log(`${sc.id}: calls=${own.length} mech=${rec.mechanical.findings.length}`);
}

// summary refresh
const sumFile = path.join(RESULTS_DIR, '_summary.json');
if (fs.existsSync(sumFile)) {
  const sum = JSON.parse(fs.readFileSync(sumFile, 'utf8'));
  for (const s of sum.scenarios || []) {
    const r = records.find((x) => x.sc.id === s.id);
    if (r) s.mechanicalFindings = r.rec.mechanical.findings.length;
  }
  fs.writeFileSync(sumFile, JSON.stringify(sum, null, 2), 'utf8');
}
console.log('recheck complete');
