import { describe, expect, it } from 'vitest';
import { evaluateP5 } from './p5-gate.js';

const cycle = (id: string) => ({
  cycle_id: id, completed_lifecycle: true, task_completion_seconds: 80, confirmation_actions: 2,
  silent_false_seal: false, missed_judgment: false,
});
const base = () => ({
  synthetic: { corpus_case_count: 30, structural_conformance: 1, unnamed_loss_count: 0 },
  baseline: {
    cycles: Array.from({ length: 10 }, (_, index) => ({ ...cycle(`base-${index}`), task_completion_seconds: 55, confirmation_actions: 1 })),
    authorship_attribution_error: 0.3, hindsight_leakage_rate: 0.4,
    premise_provenance_reconstruction: 0.7, return_contract_reconstruction: 0.7, resolution_subject_and_evidence_reconstruction: 0.7, fabrication_rate: 0,
  },
  dkk_v6: {
    cycles: Array.from({ length: 10 }, (_, index) => cycle(`v6-${index}`)),
    authorship_attribution_error: 0.1, hindsight_leakage_rate: 0.1,
    premise_provenance_reconstruction: 0.95, return_contract_reconstruction: 0.95, resolution_subject_and_evidence_reconstruction: 0.95, fabrication_rate: 0,
  },
});

describe('DKK v6 P5 value gate', () => {
  it('holds rather than inferring value when real dogfood evidence is absent', () => {
    const input = base();
    input.baseline.cycles = [];
    input.dkk_v6.cycles = [];
    expect(evaluateP5(input)).toMatchObject({ status: 'hold', measures: { completed_cycles: 0 } });
  });

  it('makes a no-go decision from a silent false seal even with otherwise strong metrics', () => {
    const input = base();
    input.dkk_v6.cycles[0]!.silent_false_seal = true;
    expect(evaluateP5(input)).toMatchObject({ status: 'no_go' });
  });

  it('permits go only when reconstruction gains and interaction costs both clear the preregistered gate', () => {
    expect(evaluateP5(base())).toMatchObject({ status: 'go', measures: { completed_cycles: 10, additional_median_confirmation_actions: 1, additional_median_task_seconds: 25 } });
  });
});
