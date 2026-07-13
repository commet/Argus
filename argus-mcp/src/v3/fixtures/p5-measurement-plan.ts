/** DKK v6 P1 — P5 가치 관문의 사전 등록 측정 계획. */

export const P5_BASELINES = [
  'raw_transcript_search',
  'transcript_rag_with_citations',
  'decision_journal_template',
  'argus_judgment_ledger',
] as const;
export const P5_METRICS = [
  'judgment_statement_reconstruction',
  'authorship_attribution_error',
  'hindsight_leakage_rate',
  'premise_provenance_reconstruction',
  'return_contract_reconstruction',
  'resolution_subject_and_evidence_reconstruction',
  'fabrication_rate',
  'task_completion_seconds',
  'confirmation_actions',
  'silent_false_seal_rate',
  'missed_judgment_rate',
] as const;

export type P5Metric = (typeof P5_METRICS)[number];

/**
 * 숫자는 P1이 corpus를 본 뒤 고정한다. 통계적 유의성이라는 모호한 말 대신
 * 어떤 개선과 비용을 받아들일지 사전에 정한다.
 */
export const P5_GO_KILL = {
  corpusCaseCount: 30,
  structuralConformance: 1,
  silentFalseSealRate: 0,
  authorshipAttributionAbsoluteImprovement: 0.1,
  hindsightLeakageRelativeReduction: 0.5,
  provenanceAndReturnReconstructionFloor: 0.9,
  additionalMedianConfirmationActions: 1,
  additionalMedianTaskSeconds: 30,
  minimumDogfoodCompletedCycles: 10,
} as const;

export const P5_KILL_CONDITIONS = [
  'No reconstruction advantage remains after confirmation cost is included.',
  'Authority validation is routinely bypassed by ordinary direct commands.',
  'Any corpus case requires unnamed loss or silent fabrication.',
  'A surface creates a second semantic state machine.',
  'Local ownership or erasure cannot be made operational at acceptable cost.',
] as const;
