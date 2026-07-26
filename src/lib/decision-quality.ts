/**
 * Decision Quality Engine — Phase 3
 *
 * 학술 기반 의사결정 품질 측정 시스템.
 *
 * 이론적 근거:
 * - Spetzler, Winter & Meyer (2016) "Decision Quality" — DQ 6요소
 * - Kahneman, Sibony & Sunstein (2021) "Noise" — 의사결정 위생
 * - Sharma et al. (2023) "Towards Understanding Sycophancy" — 아첨 우회 효과
 * - Du et al. (2023) "Multiagent Debate" — 다관점 품질 향상
 *
 * 핵심 원칙:
 * - 결과와 독립적으로 의사결정 시점에 측정 (Spetzler: "좋은 결정 ≠ 좋은 결과")
 * - 나중에 OutcomeRecord와 비교하면 "높은 DQ → 더 나은 결과?" 검증 가능
 */

import type {
  DecisionQualityScore,
  ReframeItem,
  RecastItem,
  FeedbackRecord,
  JudgmentRecord,
  Persona,
} from '@/stores/types';
import { generateId } from './uuid';

/* ────────────────────────────────────
   DQ Score Computation
   ──────────────────────────────────── */

export interface DQInput {
  reframe: ReframeItem | null;
  recast: RecastItem | null;
  feedbackRecords: FeedbackRecord[];
  judgments: JudgmentRecord[];
  personas: Persona[];
  projectId: string;
  /** Force recalculation even if a cached score exists */
  force?: boolean;
}

/**
 * Compute Decision Quality score for a project.
 * Should be called when a project completes (before outcome is known).
 */
export function computeDecisionQuality(input: DQInput): DecisionQualityScore {
  const {
    reframe, recast, feedbackRecords,
    judgments, projectId,
  } = input;

  // ── DQ Element 1: Appropriate Frame (적절한 프레이밍) ──
  // Did the reframing produce a meaningfully different question?
  let appropriateFrame = 0;
  if (reframe?.analysis) {
    const a = reframe.analysis;
    // Has a reframed question different from surface task
    if (a.reframed_question && a.surface_task &&
        a.reframed_question !== a.surface_task) appropriateFrame += 2;
    // Has reasoning for why reframing matters
    if (a.why_reframing_matters && a.why_reframing_matters.length > 20) appropriateFrame += 1;
    // Assumptions were examined
    const evaluated = a.hidden_assumptions.filter(
      ha => ha.evaluation === 'likely_true' || ha.evaluation === 'uncertain' || ha.evaluation === 'doubtful'
    );
    if (evaluated.length >= 2) appropriateFrame += 2;
  }

  // ── DQ Element 2: Creative Alternatives (창의적 대안) ──
  // Were multiple perspectives/questions generated?
  let creativeAlternatives = 0;
  if (reframe?.analysis) {
    const questionCount = (reframe.analysis.hidden_questions || []).length;
    if (questionCount >= 3) creativeAlternatives += 3;
    else if (questionCount >= 2) creativeAlternatives += 2;
    else if (questionCount >= 1) creativeAlternatives += 1;

    // Were alternative framings considered?
    if (reframe.analysis.alternative_framings &&
        reframe.analysis.alternative_framings.length >= 2) creativeAlternatives += 2;
    else if (questionCount >= 3) creativeAlternatives += 1; // questions as proxy for alternatives
  }

  // ── DQ Element 3: Relevant Information (관련 정보) ──
  // Were key assumptions identified and evaluated?
  let relevantInformation = 0;
  if (reframe?.analysis) {
    const totalAssumptions = reframe.analysis.hidden_assumptions.length;
    if (totalAssumptions >= 3) relevantInformation += 2;
    else if (totalAssumptions >= 1) relevantInformation += 1;

    // Were AI limitations identified?
    if (reframe.analysis.ai_limitations.length >= 1) relevantInformation += 1;
  }
  if (recast?.analysis) {
    const keyAssumptions = recast.analysis.key_assumptions?.length || 0;
    if (keyAssumptions >= 2) relevantInformation += 2;
    else if (keyAssumptions >= 1) relevantInformation += 1;
  }

  // ── DQ Element 4: Clear Values (명확한 가치) ──
  // Were stakeholder perspectives incorporated?
  let clearValues = 0;
  if (feedbackRecords.length > 0) {
    const totalPersonas = new Set(
      feedbackRecords.flatMap(fr => fr.results.map(r => r.persona_id))
    ).size;
    if (totalPersonas >= 3) clearValues += 3;
    else if (totalPersonas >= 2) clearValues += 2;
    else if (totalPersonas >= 1) clearValues += 1;

    // Were approval conditions generated?
    const totalConditions = feedbackRecords.reduce(
      (sum, fr) => sum + fr.results.reduce(
        (s, r) => s + (r.approval_conditions?.length || 0), 0
      ), 0
    );
    if (totalConditions >= 3) clearValues += 2;
    else if (totalConditions >= 1) clearValues += 1;
  }

  // ── DQ Element 5: Sound Reasoning (건전한 추론) ──
  // Proxy: did the user go through stakeholder feedback at all?
  // The legacy refine-loop-based convergence signal is gone.
  let soundReasoning = 0;
  if (feedbackRecords.length > 0) {
    soundReasoning += 1;
    // Multiple rounds of feedback indicates deeper reasoning
    if (feedbackRecords.length >= 2) soundReasoning += 2;
  }

  // ── DQ Element 6: Commitment to Action (실행 의지) ──
  // Is the output actionable? (has concrete steps, checkpoints)
  let commitmentToAction = 0;
  if (recast?.analysis) {
    const steps = recast.analysis.steps || [];
    if (steps.length >= 3) commitmentToAction += 2;
    const hasCheckpoints = steps.some(s => s.checkpoint);
    if (hasCheckpoints) commitmentToAction += 1;
    if (recast.analysis.design_rationale) commitmentToAction += 1;
    if (recast.analysis.governing_idea) commitmentToAction += 1;
  }

  // ── Anti-Sycophancy Metrics ──
  const initialFramingChallenged = reframe?.analysis
    ? reframe.analysis.reframed_question !== reframe.analysis.surface_task
    : false;

  const blindSpotsSurfaced = feedbackRecords.reduce(
    (sum, fr) => sum + fr.results.reduce(
      (s, r) => s + (r.classified_risks?.filter(risk => risk.category === 'unspoken')?.length || 0), 0
    ), 0
  );

  // Did user change their mind after rehearsal?
  const projectJudgments = judgments.filter(j => j.project_id === projectId);
  const userChangedMind = projectJudgments.some(j => j.user_changed);

  // ── Overall DQ Score (0-100) ──
  const maxPerElement = 5;
  const elements = [
    appropriateFrame, creativeAlternatives, relevantInformation,
    clearValues, soundReasoning, commitmentToAction,
  ].map(v => Math.min(v, maxPerElement));

  const totalMax = maxPerElement * 6; // 30
  const totalScore = elements.reduce((a, b) => a + b, 0);
  const overallDq = Math.round((totalScore / totalMax) * 100);

  const score: DecisionQualityScore = {
    id: generateId(),
    project_id: projectId,
    appropriate_frame: Math.min(appropriateFrame, maxPerElement),
    creative_alternatives: Math.min(creativeAlternatives, maxPerElement),
    relevant_information: Math.min(relevantInformation, maxPerElement),
    clear_values: Math.min(clearValues, maxPerElement),
    sound_reasoning: Math.min(soundReasoning, maxPerElement),
    commitment_to_action: Math.min(commitmentToAction, maxPerElement),
    initial_framing_challenged: initialFramingChallenged,
    blind_spots_surfaced: blindSpotsSurfaced,
    user_changed_mind: userChangedMind,
    overall_dq: overallDq,
    created_at: new Date().toISOString(),
  };

  // Philosophy foundation I6: this legacy computation may support a private
  // migration/debug comparison, but a human-judgment score must never be
  // persisted, surfaced, injected, or used for routing. No local/Supabase write.
  return score;
}

/**
 * Get DQ scores from localStorage, optionally for a specific project.
 */
export function getDQScores(projectId?: string): DecisionQualityScore[] {
  void projectId;
  // Legacy rows remain exportable/erasable for compatibility, but are
  // quarantined from every product projection and prompt.
  return [];
}

/* ────────────────────────────────────
   DQ Trend Analysis
   ──────────────────────────────────── */

export interface DQTrend {
  total_projects: number;
  avg_dq: number;
  trend: 'improving' | 'stable' | 'declining' | 'not_enough_data';
  weakest_element: string | null;
  strongest_element: string | null;
  avg_blind_spots: number;
  framing_challenge_rate: number;
}

const DQ_ELEMENT_LABELS: Record<string, string> = {
  appropriate_frame: '문제 프레이밍',
  creative_alternatives: '대안 생성',
  relevant_information: '정보 수집',
  clear_values: '이해관계자 반영',
  sound_reasoning: '추론 건전성',
  commitment_to_action: '실행 구체성',
};

/**
 * Analyze DQ trend across projects.
 */
export function analyzeDQTrend(scores: DecisionQualityScore[]): DQTrend {
  if (scores.length < 2) {
    return {
      total_projects: scores.length,
      avg_dq: scores.length > 0 ? scores[0].overall_dq : 0,
      trend: 'not_enough_data',
      weakest_element: null,
      strongest_element: null,
      avg_blind_spots: 0,
      framing_challenge_rate: 0,
    };
  }

  const sorted = [...scores].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const avgDq = sorted.reduce((s, sc) => s + sc.overall_dq, 0) / sorted.length;

  // Trend: compare first half vs second half
  const mid = Math.floor(sorted.length / 2);
  const firstHalfAvg = sorted.slice(0, mid).reduce((s, sc) => s + sc.overall_dq, 0) / mid;
  const secondHalfAvg = sorted.slice(mid).reduce((s, sc) => s + sc.overall_dq, 0) / (sorted.length - mid);

  let trend: DQTrend['trend'] = 'stable';
  if (secondHalfAvg > firstHalfAvg * 1.1) trend = 'improving';
  else if (secondHalfAvg < firstHalfAvg * 0.9) trend = 'declining';

  // Find weakest/strongest element
  const elementKeys = [
    'appropriate_frame', 'creative_alternatives', 'relevant_information',
    'clear_values', 'sound_reasoning', 'commitment_to_action',
  ] as const;

  const elementAvgs = elementKeys.map(key => ({
    key,
    avg: sorted.reduce((s, sc) => s + sc[key], 0) / sorted.length,
  }));

  elementAvgs.sort((a, b) => a.avg - b.avg);
  const weakest = elementAvgs[0];
  const strongest = elementAvgs[elementAvgs.length - 1];

  // Anti-sycophancy metrics
  const avgBlindSpots = sorted.reduce((s, sc) => s + sc.blind_spots_surfaced, 0) / sorted.length;
  const framingChallengeRate = sorted.filter(sc => sc.initial_framing_challenged).length / sorted.length;

  return {
    total_projects: sorted.length,
    avg_dq: Math.round(avgDq),
    trend,
    weakest_element: DQ_ELEMENT_LABELS[weakest.key] || weakest.key,
    strongest_element: DQ_ELEMENT_LABELS[strongest.key] || strongest.key,
    avg_blind_spots: Math.round(avgBlindSpots * 10) / 10,
    framing_challenge_rate: Math.round(framingChallengeRate * 100),
  };
}

/* ────────────────────────────────────
   DQ + Outcome Correlation (연구 핵심)
   ──────────────────────────────────── */

import type { OutcomeRecord } from '@/stores/types';

export interface DQOutcomeCorrelation {
  sample_size: number;
  high_dq_success_rate: number;  // DQ >= 70 인 프로젝트의 성공률
  low_dq_success_rate: number;   // DQ < 50 인 프로젝트의 성공률
  correlation_significant: boolean;
  insight: string;
}

/**
 * Correlate DQ scores with outcomes.
 * THIS IS THE KEY RESEARCH QUESTION:
 * "Does higher decision quality lead to better outcomes?"
 */
export function correlateDQWithOutcomes(
  scores: DecisionQualityScore[],
  outcomes: OutcomeRecord[]
): DQOutcomeCorrelation {
  // Match scores to outcomes by project_id
  const pairs: Array<{ dq: number; success: boolean }> = [];

  for (const score of scores) {
    const outcome = outcomes.find(o => o.project_id === score.project_id);
    if (!outcome) continue;

    pairs.push({
      dq: score.overall_dq,
      success: outcome.overall_success === 'exceeded' || outcome.overall_success === 'met',
    });
  }

  if (pairs.length < 4) {
    return {
      sample_size: pairs.length,
      high_dq_success_rate: 0,
      low_dq_success_rate: 0,
      correlation_significant: false,
      insight: '충분한 데이터가 쌓이면 "높은 DQ → 더 나은 결과?"를 검증할 수 있습니다.',
    };
  }

  const highDq = pairs.filter(p => p.dq >= 70);
  const lowDq = pairs.filter(p => p.dq < 50);

  const highSuccessRate = highDq.length > 0
    ? highDq.filter(p => p.success).length / highDq.length : 0;
  const lowSuccessRate = lowDq.length > 0
    ? lowDq.filter(p => p.success).length / lowDq.length : 0;

  // Simple significance check: enough samples in each group
  const significant = highDq.length >= 3 && lowDq.length >= 3;

  let insight: string;
  if (!significant) {
    insight = `현재 ${pairs.length}건의 데이터. 그룹별 3건 이상이면 유의미한 분석이 가능합니다.`;
  } else if (highSuccessRate > lowSuccessRate + 0.15) {
    insight = `높은 DQ(≥70) 프로젝트의 성공률이 ${Math.round(highSuccessRate * 100)}%로, 낮은 DQ(<50)의 ${Math.round(lowSuccessRate * 100)}%보다 ${Math.round((highSuccessRate - lowSuccessRate) * 100)}%p 높습니다. 구조화된 의사결정이 효과가 있습니다.`;
  } else if (lowSuccessRate > highSuccessRate + 0.15) {
    insight = `예상과 다르게, 낮은 DQ 프로젝트의 성공률이 더 높습니다. DQ 측정 기준을 재검토할 필요가 있습니다.`;
  } else {
    insight = `현재 DQ와 성과 간 유의미한 차이가 관찰되지 않습니다. 더 많은 데이터가 필요합니다.`;
  }

  return {
    sample_size: pairs.length,
    high_dq_success_rate: Math.round(highSuccessRate * 100),
    low_dq_success_rate: Math.round(lowSuccessRate * 100),
    correlation_significant: significant,
    insight,
  };
}

/* ────────────────────────────────────
   Confidence Calibration (Validation Chain ②)
   사용자의 자기 평가 정확도를 측정한다.
   ──────────────────────────────────── */

import type { Project } from '@/stores/types';

export interface CalibrationData {
  data_points: Array<{ confidence: number; success: boolean; project_name: string }>;
  overconfident: boolean;
  underconfident: boolean;
  well_calibrated: boolean;
  calibration_gap: number; // avg confidence - actual success rate (positive = overconfident)
  insight: string;
}

/**
 * Analyze confidence calibration: user's predicted confidence vs actual outcomes.
 * Requires projects with confidence_at_completion AND matching outcome records.
 */
export function analyzeConfidenceCalibration(
  projects: Project[],
  outcomes: OutcomeRecord[]
): CalibrationData {
  const points: CalibrationData['data_points'] = [];

  for (const project of projects) {
    if (!project.confidence_at_completion) continue;
    const outcome = outcomes.find(o => o.project_id === project.id);
    if (!outcome) continue;

    points.push({
      confidence: project.confidence_at_completion,
      success: outcome.overall_success === 'exceeded' || outcome.overall_success === 'met',
      project_name: project.name,
    });
  }

  if (points.length < 3) {
    return {
      data_points: points,
      overconfident: false,
      underconfident: false,
      well_calibrated: false,
      calibration_gap: 0,
      insight: points.length === 0
        ? '완료 시 확신도를 기록하면 자기 평가의 정확도를 추적할 수 있습니다.'
        : `${points.length}건의 데이터. 3건 이상이면 보정 분석이 가능합니다.`,
    };
  }

  // Average confidence (1-5 → 0-100%)
  const avgConfidence = points.reduce((s, p) => s + p.confidence, 0) / points.length;
  const avgConfidencePct = (avgConfidence / 5) * 100;

  // Actual success rate
  const successRate = points.filter(p => p.success).length / points.length * 100;

  const gap = avgConfidencePct - successRate;
  const overconfident = gap > 15;
  const underconfident = gap < -15;
  const well_calibrated = Math.abs(gap) <= 15;

  let insight: string;
  if (overconfident) {
    insight = `평균 확신도 ${Math.round(avgConfidencePct)}% vs 실제 성공률 ${Math.round(successRate)}% — 과신 경향이 있습니다. 리스크를 더 보수적으로 평가해보세요.`;
  } else if (underconfident) {
    insight = `평균 확신도 ${Math.round(avgConfidencePct)}% vs 실제 성공률 ${Math.round(successRate)}% — 실제보다 자신을 낮게 평가합니다. 확신을 가져도 좋습니다.`;
  } else {
    insight = `평균 확신도 ${Math.round(avgConfidencePct)}% vs 실제 성공률 ${Math.round(successRate)}% — 자기 평가가 정확합니다.`;
  }

  return {
    data_points: points,
    overconfident,
    underconfident,
    well_calibrated,
    calibration_gap: Math.round(gap),
    insight,
  };
}

/* ────────────────────────────────────
   Eval Criteria Validation (Validation Chain ④)
   DQ 요소들이 실제로 결과를 예측하는지 메타 검증.
   ──────────────────────────────────── */

export interface EvalValidation {
  /** DQ 요소 중 성공과 양의 상관을 보이는 것 */
  predictive_elements: Array<{ element: string; correlation: number }>;
  /** DQ 요소 중 상관이 없거나 음의 상관인 것 */
  non_predictive_elements: Array<{ element: string; correlation: number }>;
  /** 충분한 데이터가 있는지 */
  significant: boolean;
  insight: string;
}

/**
 * Meta-validate: do our DQ scoring criteria actually predict outcomes?
 * This is the system checking whether its own rubric works.
 */
export function validateEvalCriteria(
  scores: DecisionQualityScore[],
  outcomes: OutcomeRecord[]
): EvalValidation {
  const elementKeys = [
    { key: 'appropriate_frame' as const, label: '프레이밍' },
    { key: 'creative_alternatives' as const, label: '대안 탐색' },
    { key: 'relevant_information' as const, label: '정보 수집' },
    { key: 'clear_values' as const, label: '관점 다양성' },
    { key: 'sound_reasoning' as const, label: '추론 품질' },
    { key: 'commitment_to_action' as const, label: '실행 가능성' },
  ];

  // Match scores to outcomes
  const pairs: Array<{ score: DecisionQualityScore; success: boolean }> = [];
  for (const score of scores) {
    const outcome = outcomes.find(o => o.project_id === score.project_id);
    if (!outcome) continue;
    pairs.push({
      score,
      success: outcome.overall_success === 'exceeded' || outcome.overall_success === 'met',
    });
  }

  if (pairs.length < 5) {
    return {
      predictive_elements: [],
      non_predictive_elements: [],
      significant: false,
      insight: `${pairs.length}건의 매칭 데이터. 5건 이상이면 DQ 기준의 예측력을 검증할 수 있습니다.`,
    };
  }

  // For each DQ element, compute point-biserial-like correlation:
  // avg element score for successful vs failed projects
  const predictive: EvalValidation['predictive_elements'] = [];
  const nonPredictive: EvalValidation['non_predictive_elements'] = [];

  for (const { key, label } of elementKeys) {
    const successPairs = pairs.filter(p => p.success);
    const failPairs = pairs.filter(p => !p.success);

    if (successPairs.length === 0 || failPairs.length === 0) continue;

    const successAvg = successPairs.reduce((s, p) => s + p.score[key], 0) / successPairs.length;
    const failAvg = failPairs.reduce((s, p) => s + p.score[key], 0) / failPairs.length;
    const diff = successAvg - failAvg; // positive = higher score → more success

    if (diff > 0.3) {
      predictive.push({ element: label, correlation: Math.round(diff * 10) / 10 });
    } else {
      nonPredictive.push({ element: label, correlation: Math.round(diff * 10) / 10 });
    }
  }

  predictive.sort((a, b) => b.correlation - a.correlation);

  let insight: string;
  if (predictive.length > 0) {
    const topPredictors = predictive.slice(0, 2).map(p => p.element).join(', ');
    insight = `${topPredictors}이(가) 실제 성공과 가장 높은 상관을 보입니다.`;
    if (nonPredictive.length > 0) {
      insight += ` ${nonPredictive[0].element}은 현재 예측력이 낮습니다.`;
    }
  } else {
    insight = '현재 DQ 요소와 성과 간 명확한 패턴이 아직 없습니다. 더 많은 데이터가 필요합니다.';
  }

  return {
    predictive_elements: predictive,
    non_predictive_elements: nonPredictive,
    significant: pairs.length >= 5 && (predictive.length > 0 || nonPredictive.length > 0),
    insight,
  };
}
