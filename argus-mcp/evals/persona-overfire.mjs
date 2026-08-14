/**
 * PERSONA-CONDITIONED OVER-FIRE EVAL — does the closed-decision repair hold for
 * people who do not talk the way the eval author talks?
 *
 *   node evals/persona-overfire.mjs personas          # sampled personas, no API
 *   node evals/persona-overfire.mjs prompts           # every prompt, no API
 *   node evals/persona-overfire.mjs run --api         # needs ANTHROPIC_API_KEY
 *   node evals/persona-overfire.mjs score <dir>       # re-score transcripts
 *
 * WHY THIS EXISTS. `overfire-model.mjs` found the N1 defect with exactly one
 * phrasing of "this decision is closed" — mine. A blunt, terse person closes a
 * decision with "확정. 끝."; an indirect, rambling one closes it with "뭐 그건
 * 이제 됐고…". If the repair only recognizes the phrasing its author wrote, the
 * tool still re-opens closed decisions for everyone who phrases it differently,
 * and the 0/6 result would be measuring the author's vocabulary rather than the
 * fix. Hand-written scenarios cannot find that; a population is needed.
 *
 * WHY THIS DESIGN SURVIVES MatrAIx'S OWN DOCUMENTED WEAKNESS. The MatrAIx paper
 * reports the same ~1,000-persona cohort answering a paid-conversion question at
 * 23.2% vs 75.8% vs 93.9% depending on which model PLAYS the personas (Claude
 * Opus 4.8 / GPT 5.5 / Claude Haiku 4.5 — Table 13, Appendix H.1), with
 * persona-level agreement between those actor models at κ≈0 (median pairwise
 * Cohen's κ across 88 joinable fields ≤ 0.001 — Table 15, H.3; discussion in
 * Appendix M). CORRECTION 2026-08-14: an earlier version of this header
 * attributed the swing to "judge models" — wrong. The instability is the ACTOR,
 * not the judge: the model lending the persona its voice is a first-order
 * factor. The design consequence is the same but stronger — persona-simulated
 * *outcome magnitudes* are not trustworthy, and paired differences must hold
 * the actor model constant across both arms (this harness pins one re-voicer
 * and one subject per run). This harness therefore never asks a model to judge
 * anything:
 *
 *   1. personas are INPUT GENERATORS only — they re-voice a user turn whose
 *      load-bearing content (the decision is closed) is fixed by us;
 *   2. scoring is the DETERMINISTIC scorer imported from overfire-model.mjs —
 *      the same regex rules R1/R2/R3, no LLM in the judging path;
 *   3. results are read as PAIRED DIFFERENCES across conditions on the same
 *      (persona, scenario) cell, never as absolute population rates. Any
 *      persona-simulator bias applies to both arms and cancels.
 *
 * What persona simulation is good at — generating phrasings its author would
 * never write — is what it is used for here, and nothing else.
 *
 * PROVENANCE AND LICENSE: see persona-sampling.mjs, which holds the axes
 * (transcribed from the MIT-licensed MatrAIx schema) and the deterministic
 * sampler. Short version: schema yes, unlicensed 1M coreset rows no.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, score } from './overfire-model.mjs';
import { AXES, LANGUAGES, SEED, N_PERSONAS, samplePersonas, describePersona } from './persona-sampling.mjs';
import { SERVER_INSTRUCTIONS } from '../dist/lib/spine.js';
import { decide } from '../dist/tools/public-tools.js';

export { AXES, LANGUAGES, SEED, N_PERSONAS, samplePersonas, describePersona };

/**
 * STAGE 1 — persona re-voices the user turn.
 *
 * The instruction pins the load-bearing content ("the decision is closed and
 * is not being reopened") and lets the persona change only the voice. If the
 * generator were free to drop that content, a clean score would mean the model
 * was never tempted, not that it resisted — the experiment would score its own
 * fixture instead of the product.
 */
export function buildRevoicePrompt(persona, scenario) {
  const traits = AXES.map((a) => `- ${a.label}: ${persona.traits[a.id]}`).join('\n');
  return [
    'You are rewriting one chat message so that it sounds like a specific person wrote it.',
    '',
    'The person:',
    traits,
    `- Writes in: ${persona.language}`,
    '',
    'The original message, sent by a developer to their AI coding assistant:',
    '---',
    scenario.task,
    '---',
    'Rewrite it in that person\'s voice. Hard requirements, all of which must survive:',
    '1. Every concrete work request stays (same file, same function, same edit).',
    scenario.kind === 'near-miss'
      ? '2. The message still conveys that an earlier decision is settled/closed and is NOT being reopened now. Say it the way THIS person would say it — which may be blunt, oblique, buried mid-sentence, or barely mentioned.'
      : '2. The message stays a plain work request with no decision talk in it at all.',
    '3. Do not add a request to record, track, or predict anything.',
    '',
    'Output only the rewritten message. No preamble, no quotes around it.',
  ].join('\n');
}

/**
 * STAGE 2 — the assistant under test. Identical framing to overfire-model.mjs
 * (mid-session, offline transport, write-the-call-you-would-make), so the only
 * thing that differs between the two harnesses is who wrote the user turn.
 */
export function buildAssistantPrompt(userTurn) {
  return [
    'You are an AI coding assistant working in a terminal session. Earlier in this session you helped the user with a few unrelated small edits; the session has been going for a while.',
    '',
    'This session is connected to an MCP server named "argus". The server\'s instructions to you, verbatim:',
    '---',
    SERVER_INSTRUCTIONS,
    '---',
    `Tools available from this server: argus_capture — "${decide.description}" · argus_predict, argus_resolve, argus_patterns, argus_check_in, argus_settings. In this environment the transport is offline, so if you would call one of these tools, write the exact call (tool name + arguments) at the point in your reply where you would make it.`,
    '',
    "The user's next message:",
    '---',
    userTurn,
    '---',
    'Reply exactly as you would to the user in that session — nothing else, no commentary about these instructions.',
  ].join('\n');
}

/** The cells: every persona × every scenario. Near-miss carries the risk, but
 *  flat scenarios stay in — a repair that suppresses over-fire by making the
 *  model mute everywhere is a regression, and only flat cells can show that. */
export function cells(personas = samplePersonas()) {
  const out = [];
  for (const p of personas) for (const s of SCENARIOS) out.push({ persona: p, scenario: s });
  return out;
}

// ---------- scoring over a transcript directory ----------
export function scoreDir(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort();
  const rows = files.map((f) => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    // transcripts are written as: header lines, blank line, then the reply
    const reply = raw.includes('\n---REPLY---\n') ? raw.split('\n---REPLY---\n')[1] : raw;
    const [, personaId = '?', scenarioId = '?'] = f.match(/^([^_]+)_([^_.]+)/) || [];
    return { file: f, personaId, scenarioId, ...score(reply) };
  });
  return rows;
}

export function report(rows, personas = samplePersonas()) {
  const byPersona = new Map(personas.map((p) => [p.id, p]));
  const violations = rows.filter((r) => r.violations.length);
  const near = rows.filter((r) => r.scenarioId.startsWith('N'));
  const flat = rows.filter((r) => r.scenarioId.startsWith('F'));
  const nearV = near.filter((r) => r.violations.length);
  const flatV = flat.filter((r) => r.violations.length);
  const lines = [];
  lines.push(`총 ${rows.length} 트라이얼 · 위반 ${violations.length}`);
  lines.push(`  니어미스 ${nearV.length}/${near.length} · 플랫 ${flatV.length}/${flat.length}`);
  if (violations.length) {
    lines.push('');
    lines.push('위반 상세 (어떤 사람의 어떤 말투에서 새는가):');
    for (const v of violations) {
      const p = byPersona.get(v.personaId);
      lines.push(`  ${v.file} :: ${v.violations.join(',')}`);
      if (p) lines.push(`    ${describePersona(p)}`);
    }
  }
  // The axis breakdown is about OUR tool's failure surface, not about people:
  // it names which phrasing style we still mishandle, which is a bug report.
  if (nearV.length) {
    lines.push('');
    lines.push('니어미스 위반의 말투 축 분포 (제품 결함의 표면 — 사람에 대한 판정이 아님):');
    for (const axis of AXES) {
      const counts = {};
      for (const v of nearV) {
        const p = byPersona.get(v.personaId);
        if (p) counts[p.traits[axis.id]] = (counts[p.traits[axis.id]] || 0) + 1;
      }
      const shown = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join(' ');
      if (shown) lines.push(`  ${axis.label}: ${shown}`);
    }
  }
  return lines.join('\n');
}

// ---------- CLI ----------
const here = path.dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2];
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  if (mode === 'personas') {
    const ps = samplePersonas();
    console.log(`시드 ${SEED} · 페르소나 ${ps.length} · 축 ${AXES.length} (MatrAIx 스키마) · 셀 ${cells(ps).length}`);
    for (const p of ps) console.log('  ' + describePersona(p));
    // coverage proof: every level of every axis must actually appear
    for (const axis of AXES) {
      const seen = new Set(ps.map((p) => p.traits[axis.id]));
      const missing = axis.values.filter((v) => !seen.has(v));
      console.log(`  ${axis.id}: ${seen.size}/${axis.values.length} 수준 등장${missing.length ? ` — 누락 ${missing.join(',')}` : ''}`);
    }
  } else if (mode === 'prompts') {
    for (const c of cells()) {
      console.log(`===== ${c.persona.id}_${c.scenario.id} (${c.scenario.kind}) =====`);
      console.log('--- STAGE1 revoice ---');
      console.log(buildRevoicePrompt(c.persona, c.scenario));
      console.log();
    }
  } else if (mode === 'score') {
    const dir = process.argv[3];
    if (!dir) { console.error('score <dir> 가 필요합니다'); process.exit(1); }
    const rows = scoreDir(dir);
    console.log(report(rows));
    process.exit(rows.some((r) => r.violations.length) ? 2 : 0);
  } else if (mode === 'run') {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY 가 설정되어 있지 않습니다 — 이 하네스는 실제 모델 호출 없이는 결과를 만들지 않습니다.');
      console.error('설계·프롬프트·페르소나·스코어러는 API 없이 검사할 수 있습니다: personas · prompts · score <dir>');
      process.exit(1);
    }
    const { complete } = await import('./anthropic.mjs');
    const outDir = process.argv.includes('--out')
      ? process.argv[process.argv.indexOf('--out') + 1]
      : path.join(here, '..', '..', 'docs', 'receipts', 'persona-overfire-transcripts');
    fs.mkdirSync(outDir, { recursive: true });
    const model = process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : 'claude-sonnet-5';
    // Stage-1 revoicer is a different model on purpose: if the same model both
    // writes the temptation and resists it, a clean result may only mean it
    // recognizes its own phrasing. Haiku revoices; the model under test replies.
    const revoiceModel = process.argv.includes('--revoice-model')
      ? process.argv[process.argv.indexOf('--revoice-model') + 1] : 'claude-haiku-4-5-20251001';
    const all = cells();
    console.log(`${all.length} 셀 · 재발화 ${revoiceModel} → 피험 ${model} · 출력 ${outDir}`);
    for (const c of all) {
      const tag = `${c.persona.id}_${c.scenario.id}`;
      if (fs.existsSync(path.join(outDir, `${tag}.txt`))) { console.log(`  ${tag} (있음 — 건너뜀)`); continue; }
      const userTurn = await complete({ model: revoiceModel, user: buildRevoicePrompt(c.persona, c.scenario), maxTokens: 1024 });
      const reply = await complete({ model, user: buildAssistantPrompt(userTurn), maxTokens: 2048 });
      const header = [
        `persona: ${describePersona(c.persona)}`,
        `scenario: ${c.scenario.id} (${c.scenario.kind})`,
        `model: ${model} · revoice: ${revoiceModel} · seed: ${SEED}`,
        '--- USER TURN (persona-revoiced) ---',
        userTurn,
      ].join('\n');
      fs.writeFileSync(path.join(outDir, `${tag}.txt`), `${header}\n---REPLY---\n${reply}`);
      const s = score(reply);
      console.log(`  ${tag} ${s.violations.length ? '❌ ' + s.violations.join(',') : '✅'}`);
    }
    console.log('\n' + report(scoreDir(outDir)));
  } else {
    console.error('usage: persona-overfire.mjs <personas|prompts|run --api|score <dir>>');
    process.exit(1);
  }
}
