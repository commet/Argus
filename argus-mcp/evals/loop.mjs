/**
 * MCP self-drive loop (blueprint §5 tooling).
 *
 *   npm run loop
 *
 * The web-app analog of a Playwright run — but an MCP server has NO browser and
 * NO UI, so there is nothing to click or screenshot. A tool "surface" is just the
 * text the server returns. So we do the honest, faster thing: spawn the REAL
 * built server over stdio exactly as a host does (`node dist/index.js`), drive it
 * through realistic decision journeys, and LINT every surface it actually returns
 * for spine + contract breaks (src/lib/surface-lint.ts, shared with the crux
 * guard). Deterministic — no API key, no model, no flake. Exit non-zero on any
 * RED so it gates a watch loop or CI.
 *
 * This catches the failure the LLM-glue invariant warns about: a wire that
 * silently breaks and returns a plausible-but-empty surface. Here it turns red.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { lintEnvelope } from '../dist/lib/surface-lint.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');
const TODAY = '2026-07-02';

const SAMPLE_DOC = `# Q4 이전 계획
결론: 12월 1일에 신규 결제 시스템으로 전환한다.
근거: 현재 시스템은 초당 2000건을 처리하며, 신규 시스템은 3배 빠르다.
가정: 마이그레이션 중 다운타임은 없다.`;

// Each journey is an ordered list of real tool calls. today_override keeps them
// reproducible. Every step's returned surface is linted; a few carry a light
// journey-health `expect` on top (the lint is the main product).
const JOURNEYS = [
  {
    name: 'J1 · seal → premise → recall → recheck (happy path)',
    steps: (dir) => [
      { tool: 'argus_seal', args: { argus_dir: dir, id: 'j1', predicate: 'the migration ships with no customer-visible downtime', check_by: '2026-12-01', predicate_owner: 'user', unverified_assumption: 'the read replica keeps up with write volume', today_override: TODAY } },
      { tool: 'argus_premises', args: { argus_dir: dir, id: 'j1', op: 'add', today_override: TODAY, premises: [{ text: 'write volume stays under 2000 tps through Q4', kind: 'premise', external: true, load_bearing: true, source: 'user' }] } },
      { tool: 'argus_recall', args: { argus_dir: dir, view: 'bearing', today_override: TODAY } },
      { tool: 'argus_recall', args: { argus_dir: dir, view: 'premises', id: 'j1', today_override: TODAY } },
    ],
  },
  {
    name: 'J2 · flat reversible decision → restraint (no manufactured fork)',
    lang: 'ko',
    steps: (dir) => [
      { tool: 'argus_open_decision', args: { argus_dir: dir, id: 'j2', decision: '오늘 점심 뭐 먹을지', stakes: 'low', reversibility: 'easily_reversible', status_quo: '어제 먹은 김밥', today_override: TODAY },
        expect: (env) => (env.data && env.data.harvest_written === false) ? null : 'expected restraint (harvest_written=false) on a flat, reversible decision' },
    ],
  },
  {
    name: 'J3 · open(fires) → open_question → seal → check_in → resolve (return loop)',
    lang: 'ko',
    steps: (dir) => [
      { tool: 'argus_open_decision', args: { argus_dir: dir, id: 'j3', decision: '공동창업자 지분을 어떻게 나눌지', stakes: 'high', reversibility: 'one_way_door', status_quo: '현행 지분 유지', today_override: TODAY },
        expect: (env) => (env.data && env.data.harvest_written === true) ? null : 'high one-way-door decision should fire (harvest_written=true)' },
      { tool: 'argus_premises', args: { argus_dir: dir, id: 'j3', op: 'add', today_override: TODAY, premises: [{ text: '지분 배분 기준 미정', kind: 'open_question', source: 'user' }] } },
      { tool: 'argus_seal', args: { argus_dir: dir, id: 'j3', predicate: '3개월 내 지분 합의를 문서로 확정', check_by: '2026-10-02', predicate_owner: 'user', today_override: TODAY } },
      { tool: 'argus_check_in', args: { argus_dir: dir, today_override: '2026-07-26' } },
      { tool: 'argus_premises', args: { argus_dir: dir, id: 'j3', op: 'resolve', ref: 'P1', decision: '창업자 55 / 공동창업자 45로 합의', today_override: '2026-07-26' } },
    ],
  },
  {
    name: 'J4 · seal → settle(missed) → recall (the honest miss)',
    lang: 'ko',
    steps: (dir) => [
      { tool: 'argus_seal', args: { argus_dir: dir, id: 'j4', predicate: '신규 채용이 분기 내 목표를 달성', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY } },
      { tool: 'argus_settle', args: { argus_dir: dir, id: 'j4', outcome: 'missed', outcome_source: 'user_stated', what_happened: '목표의 절반만 채용했고 두 명이 초기 이탈함', today_override: '2026-09-15' } },
      { tool: 'argus_recall', args: { argus_dir: dir, view: 'bearing', today_override: '2026-09-15' } },
    ],
  },
  {
    name: 'J5 · document review (read, never verdict)',
    lang: 'ko',
    steps: () => [
      { tool: 'argus_review', args: { text: SAMPLE_DOC, source_kind: 'paste' } },
    ],
  },
  {
    name: 'J6 · error paths are honest (name + recovery)',
    steps: (dir) => [
      { tool: 'argus_settle', args: { argus_dir: dir, id: 'never-sealed', outcome: 'held', outcome_source: 'user_stated', what_happened: 'x', today_override: TODAY },
        expectError: 'NO_PRIOR_SEAL' },
      { tool: 'argus_premises', args: { argus_dir: dir, id: 'j1', op: 'nonsense', today_override: TODAY },
        expectError: 'INVALID_INPUT' },
    ],
  },
];

function structured(res) {
  // Both ok and error tools return structuredContent; error tools also set isError.
  return { env: res?.structuredContent ?? null, isError: res?.isError === true };
}

async function main() {
  execSync('npm run build', { cwd: ROOT, stdio: 'ignore' }); // always rebuild — a stale dist silently tests old surfaces

  // One base dir for the server env, but each journey gets its OWN ledger dir —
  // a shared dir let J1's English decisions pollute J3's Korean-journey locale
  // detection (the ledger voice sample), which is a loop artifact, not a product
  // behavior. Isolation makes each journey read like a real single user.
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-loop-'));
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  env.ARGUS_DIR = baseDir;

  const client = new Client({ name: 'argus-self-drive-loop', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));

  let calls = 0;
  let reds = 0;
  let yellows = 0;
  const journeyReports = [];

  let jn = 0;
  for (const journey of JOURNEYS) {
    const jdir = path.join(baseDir, `journey-${++jn}`);
    fs.mkdirSync(jdir, { recursive: true });
    const steps = journey.steps(jdir);
    const stepLines = [];
    let journeyRed = 0;
    let journeyYellow = 0;

    for (const step of steps) {
      calls++;
      const flags = [];
      let lastEnv = null;
      try {
        const res = await client.callTool({ name: step.tool, arguments: step.args });
        const { env: envlp, isError } = structured(res);
        lastEnv = envlp;

        // journey-health expectations (light; the lint is the main product)
        if (step.expectError) {
          const code = envlp && typeof envlp.error_code === 'string' ? envlp.error_code : '(none)';
          if (!isError) flags.push({ severity: 'red', rule: 'expected-error', message: `expected an error (${step.expectError}) but the call succeeded` });
          else if (code !== step.expectError) flags.push({ severity: 'red', rule: 'wrong-error', message: `expected ${step.expectError}, got ${code}` });
        } else if (isError) {
          flags.push({ severity: 'red', rule: 'unexpected-error', message: `tool errored: ${envlp?.error_code ?? '?'} — ${envlp?.message ?? ''}` });
        } else if (typeof step.expect === 'function') {
          const problem = step.expect(envlp);
          if (problem) flags.push({ severity: 'red', rule: 'expectation', message: problem });
        }

        // the surface lint — runs on every response (ok OR error)
        flags.push(...lintEnvelope(envlp));

        // language drift (M4): a Korean-input journey must not get an English
        // surface back. First cut used "has any Hangul", but that let an English
        // FRAME slip through if it merely quoted the user's Korean words ("Open
        // question P1 closed: '창업자 55/45'"). So measure the Hangul share of the
        // prose instead — after stripping tool names, file paths and URLs, which
        // are legitimately Latin even in a Korean surface. Yellow (polish), never fatal.
        if (journey.lang === 'ko' && envlp && envlp.ok === true && typeof envlp.surface === 'string') {
          const prose = envlp.surface
            .replace(/argus_\w+/g, ' ')
            .replace(/[A-Za-z]:\\[^\s]+/g, ' ')
            .replace(/https?:\/\/[^\s]+/g, ' ');
          const hangul = (prose.match(/[가-힣]/g) || []).length;
          const latin = (prose.match(/[A-Za-z]/g) || []).length;
          const ratio = hangul + latin === 0 ? 1 : hangul / (hangul + latin);
          if (ratio < 0.35) {
            flags.push({ severity: 'yellow', rule: 'language-drift', message: `Korean journey, but this surface is ${Math.round((1 - ratio) * 100)}% English (M4 localization gap)` });
          }
        }
      } catch (e) {
        flags.push({ severity: 'red', rule: 'threw', message: String(e?.message ?? e) });
      }

      const r = flags.filter((f) => f.severity === 'red').length;
      const y = flags.filter((f) => f.severity === 'yellow').length;
      journeyRed += r;
      journeyYellow += y;
      const mark = r ? '✗' : y ? '!' : '✓';
      stepLines.push(`    ${mark} ${step.tool}`);
      // show what the user actually sees — this is the whole point of the loop
      const shown = lastEnv ?? {};
      const line = typeof shown.surface === 'string' ? shown.surface : (typeof shown.message === 'string' ? shown.message : '(no surface)');
      stepLines.push(`        surface: ${JSON.stringify(line)}`);
      if (Array.isArray(shown.next_actions)) stepLines.push(`        next:    [${shown.next_actions.join(', ')}]`);
      if (!shown.ok && shown.error_code) stepLines.push(`        error:   ${shown.error_code}  ·  recovery: ${JSON.stringify(shown.recovery ?? shown.recovery_action ?? null)}`);
      for (const f of flags) stepLines.push(`        ${f.severity === 'red' ? '❗RED' : '·yellow'}: ${f.message}`);
    }

    reds += journeyRed;
    yellows += journeyYellow;
    journeyReports.push({ name: journey.name, journeyRed, journeyYellow, stepLines });
  }

  await client.close();
  fs.rmSync(baseDir, { recursive: true, force: true });

  // ── report ────────────────────────────────────────────────────────────────
  process.stdout.write(`\nArgus MCP self-drive loop · ${JOURNEYS.length} journeys · ${calls} real tool calls\n`);
  process.stdout.write('(real built server over stdio; every returned surface linted for spine + contract)\n');
  for (const jr of journeyReports) {
    const mark = jr.journeyRed ? '✗' : jr.journeyYellow ? '!' : '✓';
    process.stdout.write(`\n  ${mark} ${jr.name}\n`);
    for (const line of jr.stepLines) process.stdout.write(line + '\n');
  }
  process.stdout.write(`\n── ${reds ? '❌' : '✅'} ${calls} calls · ${reds} RED · ${yellows} yellow ──\n`);
  if (reds) {
    process.stdout.write('RED = a spine/contract break. Fix it, then re-run `npm run loop`.\n');
    process.exit(1);
  }
  process.stdout.write('All surfaces honor the contract and carry no verdict. (yellow = smell, not failure.)\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
