/**
 * Evidence analyzer: turns a run's steps.jsonl into
 *   1. report.md      — what happened, what broke, where to fix it
 *   2. p5-synthetic.json — the SYNTHETIC arm of the P5 gate input, honestly
 *      labeled. It contains ONLY the synthetic block; baseline/dkk_v6 real
 *      cycles are deliberately absent (the gate holds on absence — never
 *      zero-fill them, per the handoff).
 *
 *   npx tsx scripts/dogfood/analyze.ts scripts/dogfood/evidence/<run-id>
 */
import fs from 'node:fs';
import path from 'node:path';
import type { StepRecord } from './harness/evidence';

/** Failure-class → where the defect lives and what to do about it. */
const TRIAGE: Array<{ match: RegExp; layer: string; action: string }> = [
  { match: /I1_ADMITTED_ANOMALY/, layer: 'gateway preflight (src/lib/semantic-ledger-gateway.ts) or RPC port drift', action: 'A candidate that folds to a critical anomaly was admitted. Diff guardAppendBatch inputs vs the admitted stream; if only the emulator admits it, fix scripts/dogfood/harness/supabase-emulator.ts against the SQL.' },
  { match: /I2_APPEND_ONLY/, layer: 'storage layer (RPC / emulator)', action: 'An admitted event mutated or vanished. In production this is the RPC/table; locally, the emulator. Bisect with --only on the failing scenario.' },
  { match: /I3_CLOSE_WITHOUT_RESOLUTION/, layer: 'kernel reducer (argus-mcp/src/v3/reducer.ts)', action: 'judgment_closed admitted without its resolution — constitutional breach; add the failing stream to dkk-corpus.ts and fix the reducer guard.' },
  { match: /I7_CROSS_SURFACE/, layer: 'serialization boundary (decision-kernel façade)', action: 'Projections diverge across read paths — look for non-JSON state (Map/Set ordering, undefined dropping).' },
  { match: /I8_REPLAY_DETERMINISM/, layer: 'kernel reducer', action: 'fold() is order/format sensitive. Find nondeterminism (object iteration, Date parsing).' },
  { match: /I9_AUTHORITY/, layer: 'event builders (semantic-web.ts / semantic-plugin.ts / telegram-semantic.ts)', action: 'An authorial event was built without human authorization evidence — fix the builder, never the checker.' },
  { match: /I10_HINDSIGHT/, layer: 'kernel foldAsOf', action: 'Later knowledge leaked into an as-of read — temporal honesty breach; fixture + reducer fix.' },
  { match: /duplicate: expected/, layer: 'RPC retry branch (migration SQL / emulator port)', action: 'Exact-retry receipt semantics broke: an identical batch must return duplicate=true rows and append nothing.' },
  { match: /IDEMPOTENCY_CONFLICT/, layer: 'RPC idempotency checks', action: 'Altered/partial retry handling diverged from the SQL contract.' },
  { match: /SEMANTIC_JUDGMENT_CONFLICT/, layer: 'RPC pointer guard', action: 'The project pointer moved or failed to refuse — one project, one canonical judgment pointer.' },
  { match: /FORBIDDEN|OWNERSHIP/, layer: 'ownership gates (RPC + webhook)', action: 'A foreign (user, project) pair got further than the first check.' },
  { match: /SILENT_LOSS/, layer: 'gateway + RPC serialization', action: 'A raced intent disappeared without refusal or conflict marker — the exact bug class the advisory lock exists to prevent.' },
  { match: /appended: expected 0/, layer: 'the step\'s surface adapter', action: 'A refused/duplicate command still wrote events — check the adapter\'s error path for a write after refusal.' },
  { match: /THROWN/, layer: 'runner harness or adapter', action: 'An adapter threw instead of returning a coded refusal. Decide: harness bug (fix scripts/dogfood) or product crash path (fix adapter to fail closed with a named code).' },
];

function triageFor(detail: string): { layer: string; action: string } {
  for (const rule of TRIAGE) {
    if (rule.match.test(detail)) return rule;
  }
  return { layer: 'unclassified', action: 'Read the step record and the scenario source; classify and extend the TRIAGE table with it.' };
}

function main(): void {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(path.join(dir, 'steps.jsonl'))) {
    console.error('Usage: npx tsx scripts/dogfood/analyze.ts <evidence-dir>');
    process.exit(2);
  }
  const steps: StepRecord[] = fs.readFileSync(path.join(dir, 'steps.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map((line) => JSON.parse(line) as StepRecord);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as Record<string, unknown>;

  const byScenario = new Map<string, StepRecord[]>();
  for (const step of steps) {
    byScenario.set(step.scenario, [...(byScenario.get(step.scenario) ?? []), step]);
  }
  const mismatches = steps.filter((s) => !s.matched);
  const invariantHits = steps.filter((s) => s.invariant_failures.length > 0);
  const refusalCodes = new Map<string, number>();
  for (const step of steps) {
    if (!step.outcome.ok && step.outcome.code) {
      refusalCodes.set(step.outcome.code, (refusalCodes.get(step.outcome.code) ?? 0) + 1);
    }
  }
  const funnel = steps.find((s) => s.scenario === 'FUZZ' && s.step === 'funnel')?.note ?? 'no fuzz funnel in this run';

  // ---- report.md ----
  const lines: string[] = [];
  lines.push(`# DKK v6 dogfood report — ${meta.run_id}`);
  lines.push('');
  lines.push(`- mode: **${meta.mode}** · started ${meta.started_at} · finished ${meta.finished_at ?? '?'}`);
  lines.push(`- steps: **${steps.length}** · expectation mismatches: **${mismatches.length}** · steps with invariant failures: **${invariantHits.length}**`);
  if (meta.mode === 'local') {
    lines.push(`- seed: ${meta.seed} · fuzz moves: ${meta.fuzz_moves} · repeat: ${meta.repeat}`);
    lines.push('');
    lines.push('> **Scope honesty:** this is the SYNTHETIC/structural arm. A green run here');
    lines.push('> proves command-level conformance at volume against a faithful RPC port.');
    lines.push('> It does NOT check any production Definition-of-done box, does not prove');
    lines.push('> user value, and is not P5 evidence for the baseline/dkk_v6 conditions.');
  }
  lines.push('');
  lines.push('## Scenario results');
  lines.push('');
  lines.push('| scenario | steps | mismatches | invariant failures |');
  lines.push('|---|---:|---:|---:|');
  for (const [scenario, records] of [...byScenario.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const bad = records.filter((r) => !r.matched).length;
    const inv = records.filter((r) => r.invariant_failures.length > 0).length;
    lines.push(`| ${scenario} | ${records.length} | ${bad === 0 ? '—' : `**${bad}**`} | ${inv === 0 ? '—' : `**${inv}**`} |`);
  }
  lines.push('');
  lines.push('## Refusal-code distribution (each refusal is a named, visible outcome)');
  lines.push('');
  for (const [code, count] of [...refusalCodes.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- \`${code}\` × ${count}`);
  }
  lines.push('');
  lines.push(`## Fuzz funnel\n\n${funnel}`);
  lines.push('');
  lines.push('## Findings and triage');
  lines.push('');
  const findings = [
    ...mismatches.map((s) => ({ step: s, detail: `expectation mismatch: expected ${s.expected}, saw ${JSON.stringify(s.outcome)}` })),
    ...invariantHits.flatMap((s) => s.invariant_failures.map((f) => ({ step: s, detail: f }))),
  ];
  if (findings.length === 0) {
    lines.push('None. Every step matched its scripted expectation and every invariant held.');
  } else {
    for (const { step, detail } of findings) {
      const triage = triageFor(detail);
      lines.push(`### ${step.scenario}/${step.step} (seq ${step.seq})`);
      lines.push('');
      lines.push(`- **what**: ${detail}`);
      lines.push(`- **where**: ${triage.layer}`);
      lines.push(`- **do**: ${triage.action}`);
      lines.push(`- **repro**: \`npx tsx scripts/dogfood/runner.ts --only ${step.scenario} --seed ${(meta.seed as number) ?? '?'}\``);
      lines.push('');
    }
  }
  lines.push('## How to apply this to improvement (the loop)');
  lines.push('');
  lines.push('1. Every finding above names a layer. Fix at that layer; never "fix" by weakening the invariant or the expectation.');
  lines.push('2. A kernel-layer fix must land WITH a new case in `argus-mcp/src/v3/fixtures/dkk-corpus.ts` (the constitutional corpus), so the dogfood finding becomes a permanent CI guard.');
  lines.push('3. An RPC/SQL-layer fix must change the migration AND `scripts/dogfood/harness/supabase-emulator.ts` in the same commit (the port is a declared copy).');
  lines.push('4. Re-run with the SAME seed until green, then run 3 fresh seeds (`--seed`) before considering the class closed.');
  lines.push('5. When the founder runs `--mode production`, compare that report to this one: any code that refuses locally but succeeds in production (or vice versa) is an emulator-fidelity bug — file it against the port, not the product.');
  lines.push('');

  fs.writeFileSync(path.join(dir, 'report.md'), lines.join('\n'));

  // ---- p5-synthetic.json (synthetic arm ONLY) ----
  const scriptedSteps = steps.filter((s) => s.scenario !== 'FUZZ');
  const conformance = steps.length === 0 ? 0 : (steps.length - mismatches.length - invariantHits.length) / steps.length;
  const p5Synthetic = {
    _label: 'SYNTHETIC ARM ONLY — real baseline/dkk_v6 cycles must come from live dogfood; never zero-fill them (p5-gate holds on absence).',
    synthetic: {
      corpus_case_count: new Set(scriptedSteps.map((s) => s.scenario)).size + (byScenario.has('FUZZ') ? 1 : 0),
      structural_conformance: Number(conformance.toFixed(6)),
      unnamed_loss_count: findings.length,
    },
  };
  fs.writeFileSync(path.join(dir, 'p5-synthetic.json'), JSON.stringify(p5Synthetic, null, 2));

  console.log(`report  → ${path.join(dir, 'report.md')}`);
  console.log(`p5 arm  → ${path.join(dir, 'p5-synthetic.json')}`);
  console.log(`${steps.length} steps, ${findings.length} finding(s).`);
  process.exit(findings.length > 0 ? 1 : 0);
}

main();
