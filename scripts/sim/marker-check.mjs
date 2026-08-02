/**
 * marker-check.mjs — prints every ablation marker with OK / MISS.
 *
 * Split out from ablate.mjs so the check runs in its own process against a
 * freshly bundled prompt, and so it can be run alone:
 *
 *   node scripts/sim/marker-check.mjs
 *
 * A marker that no longer matches would make ablate.mjs report "no measured
 * effect" for a rule that is still fully in the prompt — a gate that measures
 * nothing, which is the failure mode this repo keeps meeting. Zero LLM calls.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = path.resolve('src');
const alias = {
  name: 'argus-alias',
  setup(b) {
    b.onResolve({ filter: /^@\// }, (a) => {
      const base = path.join(SRC, a.path.slice(2));
      for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
        try { if (fs.statSync(c).isFile()) return { path: path.resolve(c) }; } catch { /* next */ }
      }
      return null;
    });
  },
};

const OUT = path.resolve('scripts/sim/.build/harness-probe.mjs');
await build({
  entryPoints: [path.resolve('src/lib/judgment-harness-v2.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: OUT,
  plugins: [alias], logLevel: 'silent',
});
const m = await import(pathToFileURL(OUT).href);

const { system: initial } = m.buildInitialJudgmentPrompt('x', 'ko');
const { system: deepening } = m.buildDeepeningJudgmentPrompt(
  'x', { real_question: 'q', hidden_assumptions: [], skeleton: [] }, [], 1, 3, 'ko',
);
const both = `${initial}\n${deepening}`;

// Kept in sync with RULES in ablate.mjs — deliberately duplicated as plain
// strings so this file has no import cycle with the runner that calls it.
const MARKERS = [
  '- MENTIONING IS NOT MATTERING.',
  '- SILENCE IS NOT DATA.',
  '- HOW THEY SAID IT IS NOT DATA EITHER.',
  '- NEVER ADJUDICATE BETWEEN THE USER AND ANOTHER PERSON.',
  '- AND WHEN THEY DO SAY IT, IT STANDS.',
  '11. ASK, DO NOT ASSERT.',
  '  WHERE TO LOOK.',
  '   ONE CLAIM PER PREMISE.',
  '- frame_line: what the decision turns on',
];

for (const mk of MARKERS) console.log(`${both.includes(mk) ? 'OK' : 'MISS'}\t${mk}`);
console.log(`chars\tinitial=${initial.length}\tdeepening=${deepening.length}`);
