import { z } from 'zod';
import { P5_GO_KILL } from './fixtures/p5-measurement-plan.js';

const rate = z.number().min(0).max(1);
const cycleSchema = z.strictObject({
  cycle_id: z.string().min(1).max(128),
  completed_lifecycle: z.boolean(),
  task_completion_seconds: z.number().nonnegative(),
  confirmation_actions: z.number().int().nonnegative(),
  silent_false_seal: z.boolean(),
  missed_judgment: z.boolean(),
});

const conditionSchema = z.strictObject({
  cycles: z.array(cycleSchema).max(1000),
  authorship_attribution_error: rate,
  hindsight_leakage_rate: rate,
  premise_provenance_reconstruction: rate,
  return_contract_reconstruction: rate,
  resolution_subject_and_evidence_reconstruction: rate,
  fabrication_rate: rate,
});

export const P5GateInputSchema = z.strictObject({
  synthetic: z.strictObject({
    corpus_case_count: z.number().int().nonnegative(),
    structural_conformance: rate,
    unnamed_loss_count: z.number().int().nonnegative(),
  }),
  baseline: conditionSchema,
  dkk_v6: conditionSchema,
});
export type P5GateInput = z.infer<typeof P5GateInputSchema>;

export type P5GateStatus = 'go' | 'no_go' | 'hold';

export interface P5GateReport {
  status: P5GateStatus;
  reasons: readonly string[];
  measures: {
    completed_cycles: number;
    silent_false_seal_rate: number;
    additional_median_confirmation_actions?: number;
    additional_median_task_seconds?: number;
  };
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function completedCycles(input: P5GateInput['dkk_v6']) {
  return input.cycles.filter((cycle) => cycle.completed_lifecycle);
}

/**
 * Deterministic P5 decision engine. It can make a no-go call from bad evidence,
 * but it deliberately cannot manufacture a go from structural/synthetic tests:
 * missing real cycles returns HOLD and keeps later surface work blocked.
 */
export function evaluateP5(raw: unknown): P5GateReport {
  const parsed = P5GateInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'hold',
      reasons: ['P5 evidence is incomplete or invalid; no value decision can be made.'],
      measures: { completed_cycles: 0, silent_false_seal_rate: 0 },
    };
  }
  const input = parsed.data;
  const dkkCompleted = completedCycles(input.dkk_v6);
  const baselineCompleted = completedCycles(input.baseline);
  const falseSeals = input.dkk_v6.cycles.filter((cycle) => cycle.silent_false_seal).length;
  const falseSealRate = input.dkk_v6.cycles.length === 0 ? 0 : falseSeals / input.dkk_v6.cycles.length;
  const dkkSeconds = median(dkkCompleted.map((cycle) => cycle.task_completion_seconds));
  const baselineSeconds = median(baselineCompleted.map((cycle) => cycle.task_completion_seconds));
  const dkkConfirmations = median(dkkCompleted.map((cycle) => cycle.confirmation_actions));
  const baselineConfirmations = median(baselineCompleted.map((cycle) => cycle.confirmation_actions));
  const extraSeconds = dkkSeconds !== undefined && baselineSeconds !== undefined ? dkkSeconds - baselineSeconds : undefined;
  const extraConfirmations = dkkConfirmations !== undefined && baselineConfirmations !== undefined ? dkkConfirmations - baselineConfirmations : undefined;
  const measures = {
    completed_cycles: dkkCompleted.length,
    silent_false_seal_rate: falseSealRate,
    ...(extraConfirmations === undefined ? {} : { additional_median_confirmation_actions: extraConfirmations }),
    ...(extraSeconds === undefined ? {} : { additional_median_task_seconds: extraSeconds }),
  };
  const reasons: string[] = [];

  if (input.synthetic.corpus_case_count < P5_GO_KILL.corpusCaseCount) reasons.push('Synthetic corpus coverage is below the preregistered minimum.');
  if (input.synthetic.structural_conformance < P5_GO_KILL.structuralConformance) reasons.push('Structural conformance is not complete.');
  if (input.synthetic.unnamed_loss_count > 0) reasons.push('Synthetic corpus contains unnamed loss.');
  if (falseSealRate > P5_GO_KILL.silentFalseSealRate) reasons.push('At least one silent false seal occurred.');
  if (input.dkk_v6.fabrication_rate > 0) reasons.push('Fabrication occurred in the v6 condition.');
  if (reasons.length > 0) return { status: 'no_go', reasons, measures };

  if (dkkCompleted.length < P5_GO_KILL.minimumDogfoodCompletedCycles) {
    return {
      status: 'hold',
      reasons: [`Need ${P5_GO_KILL.minimumDogfoodCompletedCycles} completed real dogfood cycles; observed ${dkkCompleted.length}.`],
      measures,
    };
  }
  if (baselineCompleted.length < P5_GO_KILL.minimumDogfoodCompletedCycles) {
    return {
      status: 'hold',
      reasons: [`Need a matched baseline cohort of ${P5_GO_KILL.minimumDogfoodCompletedCycles} completed cycles; observed ${baselineCompleted.length}.`],
      measures,
    };
  }
  if (input.baseline.hindsight_leakage_rate === 0) {
    return { status: 'hold', reasons: ['Baseline hindsight leakage is zero, so the preregistered relative-reduction claim is not measurable.'], measures };
  }
  if (extraSeconds === undefined || extraConfirmations === undefined) {
    return { status: 'hold', reasons: ['Matched task-cost data is incomplete.'], measures };
  }

  if (input.baseline.authorship_attribution_error - input.dkk_v6.authorship_attribution_error < P5_GO_KILL.authorshipAttributionAbsoluteImprovement) {
    reasons.push('Authorship attribution improvement is below the preregistered floor.');
  }
  if (input.dkk_v6.hindsight_leakage_rate / input.baseline.hindsight_leakage_rate > 1 - P5_GO_KILL.hindsightLeakageRelativeReduction) {
    reasons.push('Hindsight leakage reduction is below the preregistered floor.');
  }
  for (const [name, value] of Object.entries({
    premise_provenance_reconstruction: input.dkk_v6.premise_provenance_reconstruction,
    return_contract_reconstruction: input.dkk_v6.return_contract_reconstruction,
    resolution_subject_and_evidence_reconstruction: input.dkk_v6.resolution_subject_and_evidence_reconstruction,
  })) {
    if (value < P5_GO_KILL.provenanceAndReturnReconstructionFloor) reasons.push(`${name} is below the reconstruction floor.`);
  }
  if (extraConfirmations > P5_GO_KILL.additionalMedianConfirmationActions) reasons.push('Median additional confirmation actions exceed the cost limit.');
  if (extraSeconds > P5_GO_KILL.additionalMedianTaskSeconds) reasons.push('Median additional task time exceeds the cost limit.');

  return reasons.length > 0 ? { status: 'no_go', reasons, measures } : { status: 'go', reasons: ['All preregistered P5 criteria passed with matched real-cycle evidence.'], measures };
}
