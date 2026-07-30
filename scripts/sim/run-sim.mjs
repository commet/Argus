/**
 * run-sim.mjs — simulation campaign against the TWO conversation engines.
 *
 *   node scripts/sim/run-sim.mjs                 # full run (engines + judge)
 *   node scripts/sim/run-sim.mjs --only id1,id2  # subset
 *   node scripts/sim/run-sim.mjs --skip-judge    # engines only
 *   node scripts/sim/run-sim.mjs --judge-only    # re-judge existing results
 *
 * PHASE A: read-only on src/. The real brains are bundled (esbuild) from src/
 * with '@/lib/llm' aliased to ./llm-shim.mjs (Node transport, call log, budget).
 * Results land in scripts/sim/results/<scenario>.json + _summary.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { SCENARIOS } from './scenarios.mjs';
import { judgeTranscript, judgeHasH } from './judge.mjs';
import * as shim from './llm-shim.mjs';

const SIM_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SIM_DIR, '..', '..');
const SRC = path.join(REPO, 'src');
const BUILD_DIR = path.join(SIM_DIR, '.build');
const RESULTS_DIR = path.join(SIM_DIR, 'results');
const BUNDLE = path.join(BUILD_DIR, 'sim-bundle.mjs');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

// ─── env ───

function loadEnv() {
  const candidates = [
    path.join(REPO, '.env.local'),
    'C:/Users/admin/Documents/GitHub/Argus/.env.local',
  ];
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
    if (process.env.ANTHROPIC_API_KEY) {
      console.log(`[env] ANTHROPIC_API_KEY loaded from ${f}`);
      return;
    }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[env] ANTHROPIC_API_KEY not found in .env.local (repo or main checkout)');
    process.exit(1);
  }
}

// ─── bundle the real brains ───

const aliasPlugin = {
  name: 'argus-alias',
  setup(b) {
    b.onResolve({ filter: /^@\// }, (a) => {
      if (a.path === '@/lib/llm') {
        // external + relative to the bundle location → run-sim.mjs and the
        // bundle share ONE llm-shim module instance (call log visibility).
        return { path: '../llm-shim.mjs', external: true };
      }
      const base = path.join(SRC, a.path.slice(2));
      const candidates = [
        base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`,
        path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
      ];
      for (const c of candidates) {
        try {
          if (fs.statSync(c).isFile()) return { path: c };
        } catch { /* keep trying */ }
      }
      return { errors: [{ text: `sim alias: unresolved ${a.path}` }] };
    });
  },
};

async function bundle() {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  await build({
    entryPoints: [path.join(SIM_DIR, 'sim-entry.ts')],
    outfile: BUNDLE,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    plugins: [aliasPlugin],
    logLevel: 'warning',
  });
  console.log('[build] sim-bundle.mjs ready');
}

// ─── transcript helpers ───

function push(transcript, actor, phase, text, meta) {
  transcript.push({ actor, phase, text: (text || '').trim(), ...(meta ? { meta } : {}) });
}

function lightTurnText(turn, locale, brain) {
  const parts = [];
  if (turn.mirror) parts.push(turn.mirror);
  if (turn.action === 'ask' && turn.question) parts.push(turn.question);
  if (turn.action === 'offer' && turn.offer) {
    // Mirror the REAL UI: when ask is absent (or was clamped), LightFlow.tsx
    // composes the neutral when-label fallback. Judging a raw placeholder here
    // flagged a harness artifact as a product route failure (light-02 re-run).
    const label = brain.lightWhenLabel(turn.offer.when, turn.offer.days, locale);
    parts.push(turn.offer.ask
      ? turn.offer.ask
      : (locale === 'ko'
        ? `${label}에 제가 한 번만 물어볼까요?`
        : `Want me to ask you just once, ${label}?`));
  }
  if (turn.action === 'escalate' && turn.escalate) parts.push(turn.escalate.bigger_question);
  if (turn.action === 'close' && turn.crisis) parts.push(`[crisis 게이트 발화: ${turn.crisis.category}]`);
  return parts.join('\n');
}

function heavyInitialText(r) {
  const parts = [];
  if (r.insight) parts.push(`인사이트: ${r.insight}`);
  if (r.real_question) parts.push(`진짜 질문: ${r.real_question}`);
  if (Array.isArray(r.hidden_assumptions) && r.hidden_assumptions.length) {
    parts.push(`숨은 전제:\n- ${r.hidden_assumptions.join('\n- ')}`);
  }
  if (Array.isArray(r.skeleton) && r.skeleton.length) {
    parts.push(`플랜:\n- ${r.skeleton.join('\n- ')}`);
  }
  const q = r.next_question;
  if (q && typeof q === 'object' && q.text) {
    const opts = Array.isArray(q.options) && q.options.length ? `\n(선택지: ${q.options.join(' / ')})` : '';
    parts.push(`다음 질문: ${q.text}${q.subtext ? `\n(부제: ${q.subtext})` : ''}${opts}`);
  }
  return parts.join('\n\n');
}

function mixText(m) {
  const parts = [];
  if (m.title) parts.push(`제목: ${m.title}`);
  if (m.decision_read) parts.push(`decision_read: ${m.decision_read}`);
  if (m.executive_summary) parts.push(`요약: ${m.executive_summary}`);
  if (Array.isArray(m.sections)) {
    for (const s of m.sections) {
      if (!s) continue;
      const head = s.heading || s.title || '';
      const body = s.content || (Array.isArray(s.sentences) ? s.sentences.map((x) => (typeof x === 'string' ? x : x?.text || '')).join(' ') : '');
      parts.push(`## ${head}\n${body}`);
    }
  }
  if (Array.isArray(m.key_assumptions) && m.key_assumptions.length) parts.push(`전제:\n- ${m.key_assumptions.join('\n- ')}`);
  if (Array.isArray(m.next_steps) && m.next_steps.length) parts.push(`다음 단계:\n- ${m.next_steps.map((s) => (typeof s === 'string' ? s : JSON.stringify(s))).join('\n- ')}`);
  return parts.join('\n\n');
}

// ─── scenario runner ───

/** Concurrency-safe call attribution: a shim call belongs to this scenario iff
 *  its user prompt embeds the scenario's opening text (openings are unique).
 *  The label/slice approach is racy across the 3-scenario pool. */
function callBelongsTo(c, sc) {
  const snippet = sc.opening.slice(0, 30);
  return typeof c.user === 'string' && c.user.includes(snippet);
}

async function runScenario(engine, sc) {
  shim.setCallLabel(sc.id);
  const callStart = shim.callLog.length;
  const transcript = [];
  const record = {
    id: sc.id, group: sc.group, locale: sc.locale,
    expect: sc.expect, notes: sc.notes,
    opening: sc.opening, replies: sc.replies,
    route: {}, light: null, heavy: null, error: null,
  };

  push(transcript, 'user', 'opening', sc.opening);

  try {
    // Deterministic crisis check (recorded — the light gate runs it internally too)
    const det = engine.classifyCrisis(sc.opening);
    record.route.deterministicCrisis = det;

    // 1) THE gate every submission passes through (workspace/page.tsx)
    const gate = await engine.runLightGate(sc.opening, sc.locale);
    record.route.gate = gate;

    if (gate.need === 'light') {
      // ── light loop (mirrors LightFlow: answer → runLightNext → until non-ask) ──
      push(transcript, 'argus', 'light_gate', `${gate.mirror}\n${gate.question}`);
      const qas = [];
      const turns = [];
      let pendingQuestion = gate.question;
      let outcome = 'exhausted_replies';
      for (const reply of sc.replies) {
        if (!pendingQuestion) break;
        qas.push({ question: pendingQuestion, answer: reply });
        push(transcript, 'user', 'answer', reply);
        const seqBefore = shim.callLog.length;
        const turn = await engine.runLightNext(sc.opening, qas, sc.locale);
        turn._qasLen = qas.length;
        turn._rawText = shim.callLog.slice(seqBefore)
          .filter((c) => callBelongsTo(c, sc))
          .map((c) => c.rawText || '').join('\n');
        turns.push(turn);
        push(transcript, 'argus', `light_turn_${turns.length}`, lightTurnText(turn, sc.locale, engine));
        if (turn.crisis) { outcome = 'crisis'; pendingQuestion = null; break; }
        if (turn.action === 'ask') { pendingQuestion = turn.question; continue; }
        outcome = turn.action; // offer | escalate | close
        pendingQuestion = null;
        if (turn.action === 'escalate' && sc.acceptEscalation) {
          // heavy handoff — the REAL wire (composeDeepenText)
          const composed = engine.composeDeepenText(sc.opening, qas, sc.locale);
          record.light = { qas, turns, outcome, escalatedText: composed };
          push(transcript, 'user', 'escalation_accept', '[사용자가 "더 깊이 보기"를 수락]');
          const heavy = await engine.runHeavyInitial(composed, sc.locale);
          record.heavy = { initial: heavy };
          push(transcript, 'argus', 'heavy_initial(escalated)', heavyInitialText(heavy.result));
        }
        break;
      }
      if (!record.light) record.light = { qas, turns, outcome };
    } else {
      // ── heavy path ──
      const initial = await engine.runHeavyInitial(sc.opening, sc.locale);
      record.heavy = { initial, deepening: [], mix: null };
      push(transcript, 'argus', 'heavy_initial', heavyInitialText(initial.result));

      const isOpen = (initial.result.request_type || 'open') === 'open';
      const rounds = isOpen ? (sc.deepenRounds || 0) : 0;
      let snapshot = {
        version: 1,
        insight: initial.result.insight,
        real_question: initial.result.real_question || '',
        hidden_assumptions: initial.result.hidden_assumptions || [],
        skeleton: initial.result.skeleton || [],
        stakes: initial.result.stakes,
        reversibility: initial.result.reversibility,
        request_type: initial.result.request_type,
        timestamp: Date.now(),
      };
      const snapshots = [snapshot];
      const qas = [];
      let nextQ = initial.result.next_question && initial.result.next_question.text
        ? initial.result.next_question : null;

      for (let r = 0; r < rounds; r++) {
        if (!nextQ || !sc.replies[r]) break;
        const answer = sc.replies[r];
        qas.push({
          question: { id: `q${r + 1}`, text: nextQ.text, subtext: nextQ.subtext, options: nextQ.options, type: nextQ.type || 'select' },
          answer: { question_id: `q${r + 1}`, value: answer },
        });
        push(transcript, 'user', 'answer', answer);
        const deep = await engine.runHeavyDeepening(sc.opening, snapshot, qas, r, 5, sc.locale);
        record.heavy.deepening.push(deep);
        push(transcript, 'argus', `heavy_deepening_${r + 1}`, heavyInitialText(deep));
        snapshot = {
          version: snapshot.version + 1,
          insight: deep.insight,
          real_question: deep.real_question || snapshot.real_question,
          hidden_assumptions: deep.hidden_assumptions || snapshot.hidden_assumptions,
          skeleton: deep.skeleton || snapshot.skeleton,
          stakes: snapshot.stakes,
          reversibility: snapshot.reversibility,
          request_type: snapshot.request_type,
          timestamp: Date.now(),
        };
        snapshots.push(snapshot);
        nextQ = deep.next_question && deep.next_question.text ? deep.next_question : null;
        if (deep.ready_for_mix === true && !nextQ) break;
      }

      if (sc.runMix && isOpen) {
        const dm = typeof initial.result.detected_decision_maker === 'string'
          && initial.result.detected_decision_maker !== 'null'
          ? initial.result.detected_decision_maker : null;
        const mix = await engine.runHeavyMix(sc.opening, snapshots, qas, dm, sc.locale);
        record.heavy.mix = mix;
        push(transcript, 'argus', 'heavy_mix', mixText(mix));
      }
    }
  } catch (e) {
    record.error = String(e && e.stack || e);
    push(transcript, 'argus', 'ERROR', String(e && e.message || e));
  }

  record.transcript = transcript;
  record.calls = shim.callLog.slice(callStart).filter((c) => callBelongsTo(c, sc)).map((c) => ({
    seq: c.seq, label: c.label, tier: c.tier, modelId: c.modelId, maxTokens: c.maxTokens,
    attempt: c.attempt, ms: c.ms, usage: c.usage, error: c.error,
    user: (c.user || '').slice(0, 400), // keeps post-hoc attribution possible (recheck.mjs)
    rawText: c.rawText, // full raw for mechanical checks / audit
  }));
  return record;
}

// ─── mechanical checks ───

const BANNED = [
  { rule: '금지어:초안', src: '초안' },
  { rule: '금지어:걸어두(내기 어휘)', src: '걸어\\s?[두둘둔]' },
  { rule: '금지어:베팅', src: '베팅' },
  { rule: '금지어:「」괄호 인용', src: '「|」' },
];

function mechanicalChecks(record) {
  const findings = [];
  const argusTurns = record.transcript.filter((t) => t.actor === 'argus');

  // 1) banned vocabulary in user-facing text
  for (const t of argusTurns) {
    for (const b of BANNED) {
      const re = new RegExp(b.src);
      if (re.test(t.text)) {
        const line = t.text.split('\n').find((l) => re.test(l)) || t.text.slice(0, 120);
        findings.push({ rule: b.rule, phase: t.phase, detail: `"${line.trim()}"` });
      }
    }
  }

  // 2) option arrays in LIGHT raw output (anti-술 invariant: model emitted them
  //    even though coercion drops them)
  if (record.light) {
    for (const c of record.calls) {
      if (c.tier !== 'fast' || !c.rawText) continue;
      if (/"options"\s*:/.test(c.rawText)) {
        findings.push({ rule: 'light:options 배열 출력(코어션이 드랍)', phase: c.label, detail: c.rawText.slice(0, 200) });
      }
    }
    // 3) question cap — count asks (gate question + subsequent ask turns)
    const asks = 1 + (record.light.turns || []).filter((t) => t.action === 'ask').length;
    if (asks > 2) findings.push({ rule: 'light:질문 상한 초과(>2)', phase: 'light', detail: `asks=${asks}` });
    // raw third-question attempts the clamp blocked: a turn that ran with the
    // question budget already spent (_qasLen >= 2) but whose RAW action is 'ask'
    for (const [i, t] of (record.light.turns || []).entries()) {
      if ((t._qasLen ?? 0) >= 2 && t._rawText && /"action"\s*:\s*"ask"/.test(t._rawText)) {
        findings.push({ rule: 'light:질문 예산 소진 후 3번째 질문 시도(클램프가 차단)', phase: `light_turn_${i + 1}`, detail: t._rawText.slice(0, 150) });
      }
    }
  }

  // 4) heavy route contract — non-open with a plan or a next question
  if (record.heavy && record.heavy.initial) {
    const raw = record.heavy.initial.raw || {};
    const rt = raw.request_type;
    const nonOpen = ['vent', 'validation', 'info', 'self_profiling', 'flat', 'resistance', 'crisis'];
    if (nonOpen.includes(rt)) {
      if (Array.isArray(raw.skeleton) && raw.skeleton.length > 0) {
        findings.push({ rule: `heavy:${rt}인데 skeleton ${raw.skeleton.length}개(route contract 위반, 코어션이 제거)`, phase: 'heavy_initial', detail: raw.skeleton[0] });
      }
      if (raw.next_question && raw.next_question.text) {
        findings.push({ rule: `heavy:${rt}인데 next_question 생성`, phase: 'heavy_initial', detail: raw.next_question.text });
      }
    }
  }

  // 5) multi-question in a single turn (2+ '?' in one question field)
  const qFields = [];
  if (record.route.gate && record.route.gate.question) qFields.push(['light_gate', record.route.gate.question]);
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

// ─── main ───

async function main() {
  loadEnv();
  shim.setApiKey(process.env.ANTHROPIC_API_KEY);
  shim.setBudget(Number(opt('--budget') || 200));
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const only = opt('--only')?.split(',').map((s) => s.trim());
  const list = only ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;
  if (!list.length) { console.error('no scenarios matched'); process.exit(1); }

  let records = [];

  if (!flag('--judge-only')) {
    await bundle();
    const engine = await import(pathToFileURL(BUNDLE).href);

    // concurrency pool of 3 scenarios
    const queue = [...list];
    const running = [];
    const runNext = async () => {
      const sc = queue.shift();
      if (!sc) return;
      console.log(`[run] ${sc.id} …`);
      const rec = await runScenario(engine, sc);
      rec.mechanical = mechanicalChecks(rec);
      fs.writeFileSync(path.join(RESULTS_DIR, `${sc.id}.json`), JSON.stringify(rec, null, 2), 'utf8');
      console.log(`[done] ${sc.id} — calls so far: ${shim.callsUsed()}${rec.error ? ' (ERROR)' : ''}`);
      records.push(rec);
      await runNext();
    };
    for (let i = 0; i < 3; i++) running.push(runNext());
    await Promise.all(running);
  } else {
    for (const sc of list) {
      const f = path.join(RESULTS_DIR, `${sc.id}.json`);
      if (fs.existsSync(f)) records.push(JSON.parse(fs.readFileSync(f, 'utf8')));
    }
  }

  // ── judge phase ──
  if (!flag('--skip-judge')) {
    for (const rec of records) {
      if (rec.error && !rec.transcript?.some((t) => t.actor === 'argus' && t.phase !== 'ERROR')) {
        console.log(`[judge] skip ${rec.id} (engine error, nothing to judge)`);
        continue;
      }
      const sc = SCENARIOS.find((s) => s.id === rec.id);
      const routeSummary = [
        `결정적 crisis regex: ${rec.route?.deterministicCrisis?.isCrisis ? `발화(${rec.route.deterministicCrisis.category})` : '침묵'}`,
        `light 게이트: ${rec.route?.gate?.need || '?'}`,
        rec.light ? `light 진행: 질문 ${rec.light.qas?.length || 0}개 답변됨 → 종결 ${rec.light.outcome}` : null,
        rec.heavy?.initial ? `heavy 분류: request_type=${rec.heavy.initial.raw?.request_type} stakes=${rec.heavy.initial.raw?.stakes} reversibility=${rec.heavy.initial.raw?.reversibility}${rec.heavy.initial.routeCoerced ? ' (route contract 코어션 발동!)' : ''}` : null,
      ].filter(Boolean).join('\n');

      shim.setCallLabel(`judge:${rec.id}`);
      console.log(`[judge] ${rec.id} …`);
      const runs = [];
      try {
        const j1 = await judgeTranscript(sc, rec.transcript, routeSummary, rec.mechanical);
        runs.push(j1.parsed);
        if (judgeHasH(j1.parsed)) {
          console.log(`[judge] ${rec.id} flagged H — re-running twice for consistency`);
          for (let k = 0; k < 2; k++) {
            const jr = await judgeTranscript(sc, rec.transcript, routeSummary, rec.mechanical);
            runs.push(jr.parsed);
          }
        }
      } catch (e) {
        runs.push({ error: String(e && e.message || e) });
      }
      rec.judge = { runs };
      fs.writeFileSync(path.join(RESULTS_DIR, `${rec.id}.json`), JSON.stringify(rec, null, 2), 'utf8');
    }
  }

  // ── summary ──
  const summary = records.map((r) => ({
    id: r.id,
    error: !!r.error,
    gate: r.route?.gate?.need,
    requestType: r.heavy?.initial?.raw?.request_type,
    lightOutcome: r.light?.outcome,
    mechanicalFindings: r.mechanical?.findings?.length || 0,
    judgeFails: r.judge?.runs?.[0]?.criteria
      ? Object.entries(r.judge.runs[0].criteria).filter(([, v]) => v?.verdict === 'FAIL').map(([k, v]) => `${k}:${v.severity}`)
      : [],
  }));
  fs.writeFileSync(path.join(RESULTS_DIR, '_summary.json'), JSON.stringify({
    at: new Date().toISOString(),
    totalLLMCalls: shim.callsUsed(),
    scenarios: summary,
  }, null, 2), 'utf8');
  console.log('\n=== SUMMARY ===');
  console.table(summary.map((s) => ({ id: s.id, gate: s.gate, rt: s.requestType || '-', light: s.lightOutcome || '-', mech: s.mechanicalFindings, judge: s.judgeFails.join(',') || 'clean', err: s.error ? 'Y' : '' })));
  console.log(`total LLM calls: ${shim.callsUsed()}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
