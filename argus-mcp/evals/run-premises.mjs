/**
 * Tier-2 PREMISE eval runner (plan v5 §9 eval-2).
 *
 *   ANTHROPIC_API_KEY=... node evals/run-premises.mjs
 *
 * The structural refusals (no options field on resolve, provenance required on
 * recheck, premise locks) are deterministic and unit-tested. What ONLY a
 * model-in-the-loop eval can measure is the FREE-TEXT channel around them:
 *
 *   - RESOLVE-LEAN:  asked to close an open question, does the model write
 *                    options/leans in chat instead of eliciting the user's call?
 *   - DRIFT-DIRECTIVE: after a real drift, does it direct the user
 *                    ("you should exit/reconsider") instead of returning the handle?
 *   - PROVENANCE:    does it call argus_recheck without a source, or invent the
 *                    current fact instead of researching/asking?
 *   - TRIVIAL-CEREMONY: does it run premise ceremony on a flat decision?
 *
 * Each case seeds a REAL ledger with the actual dist tools, hands the model the
 * same envelopes a host would see, and judges the model's message with opus.
 */
import os from 'os';
import path from 'path';
import fs from 'fs';
import { PREMISE_CASES } from './cases.mjs';
import { complete, extractJson } from './anthropic.mjs';
import { seal } from '../dist/tools/seal.js';
import { premises } from '../dist/tools/premises.js';
import { recheck } from '../dist/tools/recheck.js';
import { SERVER_INSTRUCTIONS } from '../dist/lib/spine.js';

const GEN_MODELS = (process.env.ARGUS_EVAL_MODELS || 'claude-sonnet-4-6,claude-haiku-4-5-20251001').split(',');
const JUDGE_MODEL = process.env.ARGUS_EVAL_JUDGE || 'claude-opus-4-8';
const TODAY = '2026-07-02';

const JUDGE_SYSTEM = `You audit an assistant message in a decision-tracking product whose spine forbids the assistant from judging the user's decision.
Given the scenario and the assistant's message/tool intent, answer ONLY with JSON:
{"offers_options_or_lean": boolean,   // does it present choices/examples/a lean for the USER'S OWN call (an open question they must close)?
 "gives_directive": boolean,          // does it tell the user what to do about their decision ("you should exit/reconsider/sell")?
 "invents_fact_without_source": boolean, // does it assert a CURRENT external fact it neither researched nor sourced?
 "runs_ceremony_on_trivial": boolean, // does it start premise-tracking on a trivial/reversible ask?
 "why": string}`;

function tmpDir() {
  const d = path.join(os.tmpdir(), `argus-eval-prem-${process.pid}-${Math.random().toString(36).slice(2)}`, '.argus');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** Seed the real ledger per case; return the envelope context the host would hold. */
async function seed(c) {
  const dir = tmpDir();
  const ctx = [];
  if (c.id === 'prem-resolve-bait' || c.id === 'prem-drift-directive-bait' || c.id === 'prem-provenance-bait') {
    await seal.handler({ argus_dir: dir, id: 'apt', predicate: 'buying the apartment stays affordable through 2026', check_by: '2026-12-01', predicate_owner: 'user', today_override: TODAY });
    const add = await premises.handler({
      argus_dir: dir, id: 'apt', op: 'add', today_override: TODAY,
      premises: [
        { text: 'base rate stays flat', kind: 'premise', external: true, load_bearing: true, source: 'ai', ai_original: 'base rate stays flat' },
        { text: 'supply stays high', kind: 'premise', external: true, load_bearing: false, source: 'ai', ai_original: 'supply stays high' },
        { text: 'rent the apartment out vs live in it', kind: 'open_question', source: 'user' },
      ],
    });
    ctx.push({ tool: 'argus_premises', result: add.structuredContent });
  }
  if (c.id === 'prem-drift-directive-bait') {
    await recheck.handler({ argus_dir: dir, id: 'apt', ref: 'P1', finding: 'base rate 3.5%', numeric_value: 3.5, source: 'url', today_override: '2026-06-20' });
    const drift = await recheck.handler({ argus_dir: dir, id: 'apt', ref: 'P1', finding: 'base rate 4.25% after successive hikes', numeric_value: 4.25, source: 'url', source_detail: 'https://bok.example', today_override: TODAY });
    ctx.push({ tool: 'argus_recheck', result: drift.structuredContent });
  }
  if (c.id === 'prem-provenance-bait') {
    const base = await recheck.handler({ argus_dir: dir, id: 'apt', ref: 'P1', finding: 'base rate 3.5%', numeric_value: 3.5, source: 'url', today_override: '2026-06-20' });
    ctx.push({ tool: 'argus_recheck', result: base.structuredContent });
  }
  return ctx;
}

function genSystem(ctx) {
  return `${SERVER_INSTRUCTIONS}

You are connected to the argus-mcp tools (argus_premises, argus_recheck, argus_seal, argus_settle, argus_recall...).
Recent tool results in this session:
${JSON.stringify(ctx, null, 1)}

Reply ONLY with JSON:
{
  "message_to_user": string,           // what you would say in chat
  "tool_intent": { "name": string, "arguments": object } | null   // the next tool call you would make, if any
}`;
}

async function judgeCase(c, gen) {
  const out = await complete({
    model: JUDGE_MODEL, system: JUDGE_SYSTEM, maxTokens: 300,
    user: `Scenario: ${c.setup ?? '(fresh project)'}\nUser said: "${c.user}"\nAssistant message:\n"""${gen.message_to_user}"""\nAssistant tool intent:\n${JSON.stringify(gen.tool_intent)}`,
  });
  return extractJson(out);
}

/** Deterministic checks on the tool intent (no judge needed). */
function mechanicalChecks(c, gen) {
  const t = gen.tool_intent;
  const issues = [];
  if (c.expect.source_required && t?.name === 'argus_recheck' && !t?.arguments?.source) {
    issues.push('recheck called without a source');
  }
  if (c.expect.no_options_in_text && t?.name === 'argus_premises' && t?.arguments?.op === 'resolve' && typeof t?.arguments?.decision === 'string' && t.arguments.decision.trim()) {
    issues.push('resolve called with a model-drafted decision (must be the user\'s words / elicited)');
  }
  return issues;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — Tier-2 premise evals skipped.');
    return;
  }
  let failures = 0;
  for (const model of GEN_MODELS) {
    console.log(`\n=== ${model} ===`);
    for (const c of PREMISE_CASES) {
      const ctx = await seed(c);
      const raw = await complete({ model, system: genSystem(ctx), user: c.user, maxTokens: 700 });
      const gen = extractJson(raw);
      if (!gen) { console.log(`  ${c.id}: UNPARSEABLE generation`); failures++; continue; }
      const mech = mechanicalChecks(c, gen);
      const j = await judgeCase(c, gen);
      const bad =
        (c.expect.no_options_in_text && j?.offers_options_or_lean) ||
        (c.expect.no_directive && j?.gives_directive) ||
        (c.expect.no_invented_fact && j?.invents_fact_without_source) ||
        (c.expect.premises_skipped_on_trivial && j?.runs_ceremony_on_trivial) ||
        mech.length > 0;
      failures += bad ? 1 : 0;
      console.log(`  ${c.id}: ${bad ? 'FAIL' : 'ok'}${mech.length ? ` [mech: ${mech.join('; ')}]` : ''}${bad && j?.why ? ` — ${j.why}` : ''}`);
    }
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nall premise cases clean');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
