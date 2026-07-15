/**
 * P5 experiment — final gate-input assembler.
 *
 * Merges:
 *  - the SYNTHETIC block from a dogfood analyzer run (structural arm),
 *  - the baseline / dkk_v6 cohort blocks from score.ts (agent-driven dogfood).
 *
 * The output is the literal input for `npm --prefix argus-mcp run eval:p5`.
 * The cohort label is carried in `_cohort_label` — evaluateP5 ignores unknown
 * top-level keys? NO — it strict-parses. So the label lives in the sibling
 * evidence file p5-results.provenance.json instead; the ADR references both.
 *
 * Usage: npx tsx scripts/dogfood/p5-experiment/assemble.ts <dogfood-evidence-dir>
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = path.join('scripts', 'dogfood', 'p5-experiment');

function main(): void {
  const dogfoodDir = process.argv[2];
  if (!dogfoodDir || !fs.existsSync(path.join(dogfoodDir, 'p5-synthetic.json'))) {
    console.error('Usage: npx tsx scripts/dogfood/p5-experiment/assemble.ts <dogfood-evidence-dir with p5-synthetic.json>');
    process.exit(2);
  }
  const synthetic = (JSON.parse(fs.readFileSync(path.join(dogfoodDir, 'p5-synthetic.json'), 'utf8')) as {
    synthetic: { corpus_case_count: number; structural_conformance: number; unnamed_loss_count: number };
  }).synthetic;
  const scores = JSON.parse(fs.readFileSync(path.join(BASE, 'scores.json'), 'utf8')) as Record<string, {
    cycles: unknown[];
    authorship_attribution_error: number;
    hindsight_leakage_rate: number;
    premise_provenance_reconstruction: number;
    return_contract_reconstruction: number;
    resolution_subject_and_evidence_reconstruction: number;
    fabrication_rate: number;
  }>;

  const condition = (arm: 'baseline' | 'dkk_v6') => ({
    cycles: scores[arm]!.cycles,
    authorship_attribution_error: scores[arm]!.authorship_attribution_error,
    hindsight_leakage_rate: scores[arm]!.hindsight_leakage_rate,
    premise_provenance_reconstruction: scores[arm]!.premise_provenance_reconstruction,
    return_contract_reconstruction: scores[arm]!.return_contract_reconstruction,
    resolution_subject_and_evidence_reconstruction: scores[arm]!.resolution_subject_and_evidence_reconstruction,
    fabrication_rate: scores[arm]!.fabrication_rate,
  });

  const input = { synthetic, baseline: condition('baseline'), dkk_v6: condition('dkk_v6') };
  fs.writeFileSync(path.join(BASE, 'p5-results.json'), JSON.stringify(input, null, 2));
  fs.writeFileSync(path.join(BASE, 'p5-results.provenance.json'), JSON.stringify({
    cohort_label: 'AGENT-DRIVEN DOGFOOD — a model agent played the deciding user; commands ran through the real production builders/gateway against the line-by-line RPC port. NOT a human-user cohort. Reconstruction was blind (record-only packets, separate agents per arm). Scoring definitions were preregistered in score.ts before any answer was read. task_completion_seconds are agent wall-clock, not human time.',
    synthetic_source: dogfoodDir,
    scenario_source: 'scripts/dogfood/p5-experiment/scenarios.ts',
    scoring: 'scripts/dogfood/p5-experiment/score.ts (deterministic; fabrication candidates audited via audit.json)',
    generated_at_note: 'see git commit timestamp',
  }, null, 2));
  console.log(`gate input → ${path.join(BASE, 'p5-results.json')} (+ provenance sidecar)`);
}

main();
