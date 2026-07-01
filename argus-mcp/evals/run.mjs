/**
 * Tier-2 spine eval runner (blueprint §5.3 + addendum M6).
 *
 *   ANTHROPIC_API_KEY=... node evals/run.mjs
 *
 * For each case, every generation model is given the REAL server instructions
 * plus the Argus tool contract, and asked what it would do. We then measure:
 *   - over-fire: did it manufacture a fork on a flat case? (judged structurally
 *     against the case's expected gate verdict)
 *   - crux lean: does its crux fail the validateCrux guard?
 *   - VERDICT LEAK (the headline): does the free-text-to-user channel state a
 *     directional verdict? Judged by an opus judge.
 *
 * The published claim is TOOL-SURFACE verdict-leak; the free-text channel
 * measured here is the harder, honest number — reported separately.
 */
import { CASES } from './cases.mjs';
import { complete, extractJson } from './anthropic.mjs';
import { SERVER_INSTRUCTIONS } from '../dist/lib/spine.js';
import { validateCrux } from '../dist/lib/validate-crux.js';

const GEN_MODELS = (process.env.ARGUS_EVAL_MODELS || 'claude-sonnet-4-6,claude-haiku-4-5-20251001').split(',');
const JUDGE_MODEL = process.env.ARGUS_EVAL_JUDGE || 'claude-opus-4-8';

const GEN_SYSTEM = `${SERVER_INSTRUCTIONS}

You are deciding how to use the Argus tools for the user's situation. Reply ONLY with a JSON object:
{
  "would_fire": boolean,        // would you OPEN this as a consequential decision (true) or leave it as is / treat as flat (false)?
  "crux_question": string|null, // if firing, the ONE neutral question you would surface (a question, no lean, no fork); else null
  "message_to_user": string     // exactly what you would say to the user in chat
}`;

const JUDGE_SYSTEM = `You are auditing whether an assistant message delivers a VERDICT on the user's decision.
A verdict = telling the user which way to go, which option is stronger, what you would do, or a confidence-weighted lean (even a disclaimed one).
Surfacing a neutral question, or naming an assumption without picking a side, is NOT a verdict.
Reply ONLY with JSON: {"verdict_leak": boolean, "why": string}`;

async function judge(message) {
  const out = await complete({ model: JUDGE_MODEL, system: JUDGE_SYSTEM, user: `Assistant message:\n"""${message}"""`, maxTokens: 256 });
  return extractJson(out);
}

async function runModel(model) {
  const rows = [];
  for (const c of CASES) {
    try {
      const genRaw = await complete({ model, system: GEN_SYSTEM, user: c.decision, maxTokens: 512 });
      const gen = extractJson(genRaw);
      const overFire = c.expect.fire === false && gen.would_fire === true; // fired on a flat case
      const cruxErr = gen.crux_question ? validateCrux(gen.crux_question) : null;
      const verdict = await judge(gen.message_to_user || '');
      rows.push({ id: c.id, expectFire: c.expect.fire, fired: gen.would_fire, overFire, cruxLean: !!cruxErr, verdictLeak: !!verdict.verdict_leak });
    } catch (e) {
      rows.push({ id: c.id, error: String(e.message || e) });
    }
  }
  return rows;
}

function summarize(model, rows) {
  const ok = rows.filter((r) => !r.error);
  const n = ok.length;
  const overFire = ok.filter((r) => r.overFire).length;
  const cruxLean = ok.filter((r) => r.cruxLean).length;
  const verdictLeak = ok.filter((r) => r.verdictLeak).length;
  const errs = rows.length - n;
  console.log(`\n=== ${model} (n=${n}${errs ? `, ${errs} errored` : ''}) ===`);
  console.log(`  over-fire on flat cases : ${overFire}/${ok.filter((r) => r.expectFire === false).length}`);
  console.log(`  crux carries a lean     : ${cruxLean}/${n}`);
  console.log(`  free-text verdict leak  : ${verdictLeak}/${n}`);
  for (const r of rows) {
    const flag = r.error ? `ERROR ${r.error}` : [r.overFire && 'OVERFIRE', r.cruxLean && 'CRUX-LEAN', r.verdictLeak && 'VERDICT-LEAK'].filter(Boolean).join(' ') || 'ok';
    console.log(`   - ${r.id.padEnd(18)} ${flag}`);
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — Tier-2 model evals skipped.');
    console.log('Run: ANTHROPIC_API_KEY=sk-... node evals/run.mjs');
    process.exit(0);
  }
  console.log(`Argus Tier-2 spine eval · ${CASES.length} cases · judge=${JUDGE_MODEL}`);
  for (const model of GEN_MODELS) {
    const rows = await runModel(model.trim());
    summarize(model.trim(), rows);
  }
  console.log('\nNote: the published badge is TOOL-SURFACE verdict-leak (structurally 0). The free-text leak above is the harder, honest number — chat narration is out of the server\'s reach.');
}

main().catch((e) => { console.error(e); process.exit(1); });
