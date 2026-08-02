/**
 * ablate.mjs — what does each rule actually buy?
 *
 *   node scripts/sim/ablate.mjs                 # every rule, default scenarios
 *   node scripts/sim/ablate.mjs --only R_STANCE # one rule
 *   node scripts/sim/ablate.mjs --scenarios a,b # pick the scenarios
 *
 * Every rule in this harness was added because a run measured a failure. Not
 * one has ever been tested by REMOVAL, and that asymmetry has a direction: the
 * prompt only ever grows, because a failure is evidence for adding and nothing
 * is evidence for deleting. After enough of that, nobody can say which lines are
 * carrying the result and which are furniture the model would behave identically
 * without — and a prompt full of furniture is not free. It costs latency, it
 * costs attention the model spends on dead text, and worst, it makes the next
 * person add rule twenty-one instead of fixing rule three.
 *
 * So: run the same scenarios with the block present and with it removed, and
 * diff the independent judge's verdicts. That difference is the rule's price.
 *
 *   REGRESSES  removing it makes things worse  -> it is load-bearing, keep it
 *   NEUTRAL    nothing changes                 -> a deletion candidate
 *   IMPROVES   removing it makes things BETTER -> it is actively harmful
 *
 * The third outcome is the one worth building this for. Today already produced
 * two of them by accident: a light-path exemplar that had been teaching the
 * violation it was meant to prevent, and a worked example whose content leaked
 * into the scenario it was drawn from. Neither was findable by adding anything.
 *
 * Judge verdicts are noisy, so a single run is a hint, not a finding. The
 * summary prints per-criterion deltas and the transcripts stay on disk; treat
 * anything under two criteria of movement as noise.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SIM = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(SIM, 'results');
const OUT = path.join(SIM, 'ablation');

/**
 * Each entry names ONE block by its opening words. The marker has to be the
 * literal start of the line in the prompt, so a rename breaks the ablation
 * loudly instead of silently measuring nothing.
 */
const RULES = [
  { id: 'R_MENTIONING', marker: '- MENTIONING IS NOT MATTERING.', what: 'a mention is not their stance' },
  { id: 'R_SILENCE', marker: '- SILENCE IS NOT DATA.', what: 'what they did not say means nothing' },
  { id: 'R_HOWSAID', marker: '- HOW THEY SAID IT IS NOT DATA EITHER.', what: 'their grammar is not evidence' },
  { id: 'R_ADJUDICATE', marker: '- NEVER ADJUDICATE BETWEEN THE USER AND ANOTHER PERSON.', what: 'no siding in a dispute' },
  { id: 'R_THEIRRANK', marker: '- AND WHEN THEY DO SAY IT, IT STANDS.', what: 'their own weighting holds' },
  { id: 'R_ASKDONT', marker: '11. ASK, DO NOT ASSERT.', what: 'your belief becomes the question' },
  { id: 'R_WHERELOOK', marker: '  WHERE TO LOOK.', what: 'the worked premise exemplar' },
  { id: 'R_ONECLAIM', marker: '   ONE CLAIM PER PREMISE.', what: 'no stapled conditionals' },
  { id: 'R_FRAMETAIL', marker: '- frame_line: what the decision turns on', what: 'the frame spec and its bans' },
];

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const only = (opt('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const scenarios = opt('--scenarios')
  || 'heavy-01-job-offer-40,heavy-04-fire-teammate,heavy-05-cofounder,heavy-03-jeonse-maemae';

const plan = only.length ? RULES.filter((r) => only.includes(r.id)) : RULES;
fs.mkdirSync(OUT, { recursive: true });

// A marker that matches nothing would report "no measured effect" for a rule
// that is still fully present — the exact shape of a gate that measures
// nothing, which this repo has now met five times. Verify before spending a
// single token.
{
  const probe = spawnSync(process.execPath, [path.join(SIM, 'marker-check.mjs')], {
    cwd: path.resolve(SIM, '..', '..'), encoding: 'utf8',
  });
  const found = (probe.stdout || '') + (probe.stderr || '');
  const missing = plan.filter((r) => !found.includes(`OK\t${r.marker}`));
  if (missing.length) {
    console.error('[ablate] these markers no longer appear in the built prompt:');
    for (const m of missing) console.error(`  ${m.id}  ${JSON.stringify(m.marker)}`);
    console.error('Fix the marker (a rule was reworded) — measuring with a dead marker is worse than not measuring.');
    process.exit(1);
  }
  console.log(`[ablate] ${plan.length} markers verified present`);
}

/** One run of the real sim, with the judge, returning per-scenario verdicts. */
function run(label, ablateSpec) {
  console.log(`\n[${label}] ${ablateSpec || '(baseline — nothing removed)'}`);
  const res = spawnSync(
    process.execPath,
    [path.join(SIM, 'run-sim.mjs'), '--only', scenarios],
    {
      cwd: path.resolve(SIM, '..', '..'),
      env: { ...process.env, ARGUS_SIM_ABLATE: ablateSpec || '' },
      encoding: 'utf8',
      timeout: 20 * 60 * 1000,
    },
  );
  if (res.status !== 0) console.log(`  (run exited ${res.status}) ${(res.stderr || '').slice(0, 300)}`);

  const out = {};
  for (const id of scenarios.split(',')) {
    const f = path.join(RESULTS, `${id}.json`);
    if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const fails = {};
    for (const r of j.judge?.runs || []) {
      for (const [k, v] of Object.entries(r.criteria || {})) {
        if (v?.verdict === 'FAIL') fails[k] = Math.max(fails[k] || 0, v.severity === 'H' ? 3 : v.severity === 'M' ? 2 : 1);
      }
    }
    out[id] = fails;
  }
  fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(out, null, 2));
  return out;
}

const score = (v) => Object.values(v).reduce((a, b) => a + b, 0);
const total = (o) => Object.values(o).reduce((a, v) => a + score(v), 0);

const baseline = run('baseline', '');
console.log(`\nbaseline harm score: ${total(baseline)}  ${JSON.stringify(baseline)}`);

const rows = [];
for (const rule of plan) {
  const got = run(rule.id, rule.marker);
  const delta = total(got) - total(baseline);
  const moved = [];
  for (const id of Object.keys(baseline)) {
    const b = baseline[id] || {};
    const a = got[id] || {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if ((b[k] || 0) !== (a[k] || 0)) moved.push(`${id.split('-')[1]}:${k} ${b[k] || 0}->${a[k] || 0}`);
    }
  }
  rows.push({ ...rule, delta, moved });
  console.log(`  delta ${delta > 0 ? '+' : ''}${delta}  ${moved.join(' | ') || 'no change'}`);
}

console.log('\n\nABLATION SUMMARY  (harm score: H=3 M=2 L=1, higher is worse)\n');
console.log('  removing this rule ...          delta   reading');
for (const r of rows.sort((a, b) => b.delta - a.delta)) {
  const reading = r.delta >= 2 ? 'LOAD-BEARING — keep'
    : r.delta <= -2 ? 'HARMFUL — the rule is making it worse'
      : 'no measured effect — deletion candidate';
  console.log(`  ${r.id.padEnd(16)} ${r.what.slice(0, 30).padEnd(32)} ${String(r.delta).padStart(4)}   ${reading}`);
}
console.log(`\n  transcripts: ${OUT}`);
console.log('  One run per arm is a hint, not a finding — re-run a surprising row before acting on it.\n');
