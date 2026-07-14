/**
 * DKK v6 dogfood runner.
 *
 *   npx tsx scripts/dogfood/runner.ts                      # local, default volume
 *   npx tsx scripts/dogfood/runner.ts --fuzz 1000 --seed 7 # heavier, reproducible
 *   npx tsx scripts/dogfood/runner.ts --only W5,T1         # focus
 *   npx tsx scripts/dogfood/runner.ts --mode production    # real HTTPS P6 (needs env)
 *
 * Local mode drives the REAL kernel, gateway, telegram brain, and plugin
 * builders against a faithful in-memory port of the production RPC. It proves
 * structural/command-level conformance at volume. It does NOT check any
 * production Definition-of-done box — the production run (see README) does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EvidenceRecorder } from './harness/evidence';
import { Rng } from './harness/rng';
import { ScenarioAbort, World, type Scenario } from './harness/world';
import { webScenarios } from './scenarios/web';
import { telegramScenarios } from './scenarios/telegram';
import { pluginScenarios } from './scenarios/plugin';
import { crossScenarios } from './scenarios/cross';
import { fuzzScenario } from './scenarios/fuzz';
import { runProductionP6 } from './production';

interface Args {
  mode: 'local' | 'production';
  seed: number;
  fuzz: number;
  only: string[] | null;
  out: string;
  repeat: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    mode: (get('--mode') as Args['mode']) ?? 'local',
    seed: Number(get('--seed') ?? 20260714),
    fuzz: Number(get('--fuzz') ?? 300),
    only: get('--only')?.split(',').map((s) => s.trim()) ?? null,
    out: get('--out') ?? path.join('scripts', 'dogfood', 'evidence'),
    repeat: Number(get('--repeat') ?? 1),
  };
}

async function runLocal(args: Args): Promise<number> {
  const runId = `local-${new Date().toISOString().replace(/[:.]/g, '-')}-seed${args.seed}`;
  const evidence = new EvidenceRecorder(runId, 'local', args.out);
  const scratch = fs.mkdtempSync(path.join(evidence.dir, 'scratch-'));

  const scripted: Scenario[] = [...webScenarios, ...telegramScenarios, ...pluginScenarios, ...crossScenarios];
  const selected = args.only ? scripted.filter((s) => args.only!.includes(s.id)) : scripted;
  const runFuzz = !args.only || args.only.includes('FUZZ');

  let totalSteps = 0;
  const allFindings: Array<{ scenario: string; step: string; kind: string; detail: string; seed: number }> = [];
  const scenarioResults: Array<{ id: string; title: string; passed: boolean; steps: number }> = [];

  for (let round = 0; round < args.repeat; round++) {
    const roundSeed = args.seed + round;
    for (const scenario of selected) {
      const world = new World(new Rng(roundSeed), evidence, scratch);
      let passed = true;
      try {
        await scenario.run(world);
      } catch (error) {
        passed = false;
        if (!(error instanceof ScenarioAbort)) {
          world.findings.push({ scenario: scenario.id, step: 'run', kind: 'expectation', detail: `unexpected throw: ${(error as Error).message}`, seed: roundSeed });
          evidence.record({
            scenario: scenario.id, step: 'run', surface: 'kernel', action: 'scenario',
            outcome: { ok: false, code: 'SCENARIO_THREW' }, matched: false,
            event_ids: [], idempotency_keys: [], content_sha256: [],
            invariant_failures: [], note: (error as Error).message, elapsed_ms: 0,
          });
        }
      }
      if (world.findings.length > 0) passed = false;
      allFindings.push(...world.findings);
      totalSteps += world.steps;
      scenarioResults.push({ id: scenario.id, title: scenario.title, passed, steps: world.steps });
      const mark = passed ? 'ok ' : 'RED';
      console.log(`[${mark}] ${scenario.id.padEnd(4)} ${scenario.title}`);
    }

    if (runFuzz && args.fuzz > 0) {
      const fuzz = fuzzScenario(args.fuzz);
      const world = new World(new Rng(roundSeed * 7 + 1), evidence, scratch);
      let passed = true;
      try {
        await fuzz.run(world);
      } catch (error) {
        passed = false;
        world.findings.push({ scenario: 'FUZZ', step: 'run', kind: 'expectation', detail: `unexpected throw: ${(error as Error).message}`, seed: roundSeed * 7 + 1 });
      }
      if (world.findings.length > 0) passed = false;
      allFindings.push(...world.findings);
      totalSteps += world.steps;
      scenarioResults.push({ id: 'FUZZ', title: fuzz.title, passed, steps: world.steps });
      console.log(`[${passed ? 'ok ' : 'RED'}] FUZZ ${fuzz.title} (seed ${roundSeed * 7 + 1})`);
    }
  }

  evidence.writeMeta({
    seed: args.seed, repeat: args.repeat, fuzz_moves: args.fuzz,
    scenarios: scenarioResults, total_steps: totalSteps,
    findings: allFindings,
    finished_at: new Date().toISOString(),
  });
  await evidence.close();

  console.log(`\n${totalSteps} steps recorded → ${evidence.dir}`);
  if (allFindings.length > 0) {
    console.log(`\n${allFindings.length} FINDING(S):`);
    for (const finding of allFindings.slice(0, 30)) {
      console.log(`  - [${finding.kind}] ${finding.scenario}/${finding.step} (seed ${finding.seed}): ${finding.detail}`);
    }
    console.log('\nRun the analyzer for the full report: npx tsx scripts/dogfood/analyze.ts ' + evidence.dir);
    return 1;
  }
  console.log('All scenarios green. Run the analyzer for the report: npx tsx scripts/dogfood/analyze.ts ' + evidence.dir);
  return 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const exitCode = args.mode === 'production'
    ? await runProductionP6(args.out)
    : await runLocal(args);
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
