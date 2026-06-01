/**
 * Judgment Vitality Engine
 *
 * "서로를 지탱함을 통해서 얻은 안정감과 체계화 때문에 이들은 경직되어 간다."
 * — 컴퓨터와 마음 기말고사 답안 (2014)
 *
 * 하나의 질문: "이 판단 과정은 살아있는가, 죽어있는가?"
 *
 * Read-only layer — navigator 패턴을 따름.
 * 기존 store/signal에서 읽고, recordSignal()로 쓰고, navigator coaching으로 전달.
 */

import type {
  ReframeItem,
  RecastItem,
  FeedbackRecord,
  Persona,
  RecastStep,
  StageFingerprint,
  TranslatedApproval,
  ProvenanceTag,
  RigiditySignal,
  RigidityCategory,
  VitalityAssessment,
  ActorRelationship,
  HiddenAssumption,
} from '@/stores/types';
import { computeSimilarity } from './similarity';

// ═══════════════════════════════════════════════════════════════
// Phase 1: INSTRUMENTATION — 볼 수 있게 만들기
// ═══════════════════════════════════════════════════════════════

/**
 * Build a structural fingerprint for any stage's output.
 * Pure function, no side effects.
 */
export function buildStageFingerprint(
  phase: 'reframe',
  item: ReframeItem
): StageFingerprint;
export function buildStageFingerprint(
  phase: 'recast',
  item: RecastItem
): StageFingerprint;
export function buildStageFingerprint(
  phase: 'rehearse',
  item: FeedbackRecord
): StageFingerprint;
export function buildStageFingerprint(
  phase: 'reframe' | 'recast' | 'rehearse',
  item: ReframeItem | RecastItem | FeedbackRecord
): StageFingerprint {
  const now = new Date().toISOString();

  if (phase === 'reframe') {
    const r = item as ReframeItem;
    const analysis = r.analysis;
    const assumptions: HiddenAssumption[] = analysis?.hidden_assumptions || [];
    const axes = [...new Set(assumptions.map(a => a.axis).filter(Boolean))];
    const surfaceTask = analysis?.surface_task || '';
    const reframed = analysis?.reframed_question || '';
    const isDifferent = surfaceTask && reframed
      ? computeSimilarity(surfaceTask, reframed) < 0.8
      : false;

    return {
      phase: 'reframe',
      item_id: r.id || '',
      timestamp: now,
      fingerprint: {
        assumption_count: assumptions.length,
        assumption_axes: axes as string[],
        reframed_vs_surface_different: isDifferent,
      },
    };
  }

  if (phase === 'recast') {
    const r = item as RecastItem;
    const steps: RecastStep[] = r.analysis?.steps || [];
    const criticalPath: number[] = r.analysis?.critical_path || [];

    return {
      phase: 'recast',
      item_id: r.id || '',
      timestamp: now,
      fingerprint: {
        step_count: steps.length,
        step_actors: steps.map(s => s.actor),
        checkpoint_count: steps.filter(s => s.checkpoint).length,
        critical_path_length: criticalPath.length,
      },
    };
  }

  // rehearse
  const r = item as FeedbackRecord;
  const allRisks = (r.results || []).flatMap(res => res.classified_risks || []);
  const allConcerns = (r.results || []).flatMap(res => [
    ...(res.concerns || []),
    ...(res.first_questions || []),
  ]);
  const uniqueConcerns = new Set(allConcerns.map(c => c.toLowerCase().trim()));
  const totalConcerns = allConcerns.length || 1;
  const allConditions = (r.results || []).flatMap(res => res.approval_conditions || []);

  return {
    phase: 'rehearse',
    item_id: r.id || '',
    timestamp: now,
    fingerprint: {
      risk_count: allRisks.length,
      critical_risk_count: allRisks.filter(r => r.category === 'critical').length,
      unspoken_risk_count: allRisks.filter(r => r.category === 'unspoken').length,
      approval_condition_count: allConditions.length,
      unique_concern_ratio: uniqueConcerns.size / totalConcerns,
    },
  };
}

/**
 * Translate approval conditions to plan-level references.
 * Maps each persona's approval conditions to affected RecastSteps
 * using text similarity.
 */
export function translateApprovalsToPlan(
  record: FeedbackRecord,
  steps: RecastStep[],
  personas: Persona[]
): TranslatedApproval[] {
  const results: TranslatedApproval[] = [];

  for (const result of record.results || []) {
    const persona = personas.find(p => p.id === result.persona_id);
    if (!persona) continue;

    for (const condition of result.approval_conditions || []) {
      // Find which steps this condition references
      const affectedSteps: number[] = [];
      let bestTranslation: string | null = null;
      let bestScore = 0;

      steps.forEach((step, idx) => {
        const stepText = `${step.task} ${step.expected_output || ''} ${step.actor_reasoning || ''}`;
        const similarity = computeSimilarity(condition, stepText);
        if (similarity > 0.3) {
          affectedSteps.push(idx);
          if (similarity > bestScore) {
            bestScore = similarity;
            bestTranslation = `Step ${idx + 1}: ${step.task}`;
          }
        }
      });

      results.push({
        persona_id: result.persona_id,
        persona_name: persona.name,
        influence: persona.influence,
        condition,
        translated_to_plan: bestTranslation,
        affected_steps: affectedSteps,
        met: false,
      });
    }
  }

  return results;
}

/**
 * Build provenance chain: trace assumptions from reframe through all stages.
 * Returns a map: assumption text → ProvenanceTag[] showing where it appeared.
 */
export function buildProvenanceChain(
  reframe: ReframeItem | null,
  recast: RecastItem | null,
  feedbackRecords: FeedbackRecord[],
): Map<string, ProvenanceTag[]> {
  const chain = new Map<string, ProvenanceTag[]>();
  const now = new Date().toISOString();

  // Seed: reframe assumptions
  const assumptions = reframe?.analysis?.hidden_assumptions || [];
  for (let i = 0; i < assumptions.length; i++) {
    const text = assumptions[i].assumption;
    chain.set(text, [{
      phase: 'reframe',
      source_id: reframe?.id || '',
      source_field: `hidden_assumptions[${i}]`,
      created_at: now,
    }]);
  }

  // Trace into recast key_assumptions
  const keyAssumptions = recast?.analysis?.key_assumptions || [];
  for (const ka of keyAssumptions) {
    for (const [assumptionText, tags] of chain) {
      if (computeSimilarity(assumptionText, ka.assumption) > 0.3) {
        tags.push({
          phase: 'recast',
          source_id: recast?.id || '',
          source_field: 'key_assumptions',
          created_at: now,
        });
      }
    }
  }

  // Trace into rehearsal risks
  const latestFeedback = feedbackRecords.length > 0
    ? [...feedbackRecords].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).pop()!
    : undefined;
  if (latestFeedback) {
    const allRisks = (latestFeedback.results || []).flatMap(r => r.classified_risks || []);
    for (const risk of allRisks) {
      for (const [assumptionText, tags] of chain) {
        if (computeSimilarity(assumptionText, risk.text) > 0.25) {
          tags.push({
            phase: 'rehearse',
            source_id: latestFeedback.id,
            source_field: 'classified_risks',
            created_at: now,
          });
        }
      }
    }
  }

  return chain;
}


// ═══════════════════════════════════════════════════════════════
// Phase 2: MEASUREMENT — γ (genuine novelty) + structural change
// ═══════════════════════════════════════════════════════════════

/**
 * Compute per-stage gamma: how much "genuine novelty" did this stage produce?
 * Each stage is measured against its OWN quality signals, not compared cross-phase.
 */
export function computeStageGamma(fp: StageFingerprint): number {
  const f = fp.fingerprint;
  const signals: number[] = [];

  switch (fp.phase) {
    case 'reframe':
      // Did reframing actually change the question?
      if (f.reframed_vs_surface_different !== undefined) {
        signals.push(f.reframed_vs_surface_different ? 0.7 : 0.1);
      }
      // Did it find meaningful assumptions? (more than 2 with diverse axes)
      if (f.assumption_count !== undefined) {
        signals.push(Math.min(f.assumption_count / 4, 1)); // 4+ assumptions = 1.0
      }
      if (f.assumption_axes && f.assumption_axes.length > 0) {
        signals.push(Math.min(f.assumption_axes.length / 3, 1)); // 3+ axes = 1.0
      }
      break;

    case 'recast':
      // Actor diversity (not all ai or all human)
      if (f.step_actors && f.step_actors.length > 0) {
        const unique = new Set(f.step_actors);
        signals.push(Math.min(unique.size / 3, 1));
      }
      // Has checkpoints (sign of thoughtful design)
      if (f.step_count !== undefined && f.checkpoint_count !== undefined) {
        const checkpointRatio = f.step_count > 0 ? f.checkpoint_count / f.step_count : 0;
        signals.push(Math.min(checkpointRatio * 3, 1)); // 33%+ checkpoints = 1.0
      }
      // Has critical path
      if (f.critical_path_length !== undefined && f.step_count !== undefined) {
        signals.push(f.critical_path_length > 0 ? 0.5 : 0);
      }
      break;

    case 'rehearse':
      // Found risks with diversity
      if (f.unique_concern_ratio !== undefined) {
        signals.push(f.unique_concern_ratio);
      }
      // Found unspoken risks (novel insights not in the plan)
      if (f.unspoken_risk_count !== undefined && f.risk_count !== undefined) {
        const unspokenRatio = f.risk_count > 0 ? f.unspoken_risk_count / f.risk_count : 0;
        signals.push(unspokenRatio);
      }
      // Has actionable approval conditions
      if (f.approval_condition_count !== undefined) {
        signals.push(Math.min(f.approval_condition_count / 3, 1));
      }
      break;

    case 'refine':
      // Actually resolved issues
      if (f.issues_resolved !== undefined) {
        signals.push(Math.min((f.issues_resolved || 0) / 3, 1));
      }
      // Approval conditions met
      if (f.conditions_met_ratio !== undefined) {
        signals.push(f.conditions_met_ratio);
      }
      // Multiple iterations (sign of genuine refinement, not rubber-stamping)
      if (f.iteration_count !== undefined) {
        signals.push(f.iteration_count >= 2 ? 0.7 : f.iteration_count === 1 ? 0.3 : 0);
      }
      break;
  }

  if (signals.length === 0) return 0.5; // no data = neutral, not dead
  return signals.reduce((sum, s) => sum + s, 0) / signals.length;
}

/**
 * Compute project-level gamma: average of per-stage gammas + provenance bonus.
 * Each stage is measured independently (no cross-phase comparison).
 */
export function computeProjectGamma(
  reframe: ReframeItem | null,
  recast: RecastItem | null,
  feedbackRecords: FeedbackRecord[],
): { per_stage: Array<{ phase: string; gamma: number }>; overall: number; fingerprints: StageFingerprint[] } {
  const fingerprints: StageFingerprint[] = [];
  const stageGammas: Array<{ phase: string; gamma: number }> = [];

  if (reframe) {
    const fp = buildStageFingerprint('reframe', reframe);
    fingerprints.push(fp);
    stageGammas.push({ phase: 'reframe', gamma: computeStageGamma(fp) });
  }
  if (recast) {
    const fp = buildStageFingerprint('recast', recast);
    fingerprints.push(fp);
    stageGammas.push({ phase: 'recast', gamma: computeStageGamma(fp) });
  }
  const latestFeedback = feedbackRecords.length > 0
    ? [...feedbackRecords].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).pop()!
    : undefined;
  if (latestFeedback) {
    const fp = buildStageFingerprint('rehearse', latestFeedback);
    fingerprints.push(fp);
    stageGammas.push({ phase: 'rehearse', gamma: computeStageGamma(fp) });
  }
  // Provenance bonus: how far did reframe insights travel?
  let provenanceBonus = 0;
  if (reframe && fingerprints.length >= 2) {
    const chain = buildProvenanceChain(reframe, recast, feedbackRecords);
    const totalAssumptions = chain.size || 1;
    let traveledCount = 0;
    for (const [, tags] of chain) {
      if (tags.length > 1) traveledCount++;
    }
    provenanceBonus = (traveledCount / totalAssumptions) * 0.2; // max 0.2 bonus
  }

  const avgGamma = stageGammas.length > 0
    ? stageGammas.reduce((sum, s) => sum + s.gamma, 0) / stageGammas.length
    : 0.5; // no stages = neutral

  return {
    per_stage: stageGammas,
    overall: Math.min(avgGamma + provenanceBonus, 1),
    fingerprints,
  };
}

/**
 * Measure how much feedback changed between initial rehearsal and re-review.
 * 0 = identical feedback (predictable), 1 = completely different (novel).
 */
export function measureFeedbackNovelty(
  initial: FeedbackRecord,
  reReview: FeedbackRecord
): number {
  const initialRisks = (initial.results || []).flatMap(r => (r.classified_risks || []).map(risk => risk.text));
  const reReviewRisks = (reReview.results || []).flatMap(r => (r.classified_risks || []).map(risk => risk.text));

  if (initialRisks.length === 0 && reReviewRisks.length === 0) return 0;
  if (initialRisks.length === 0 || reReviewRisks.length === 0) return 1;

  // Count how many re-review risks are genuinely new (not similar to any initial risk)
  let novelCount = 0;
  for (const reRisk of reReviewRisks) {
    const maxSimilarity = Math.max(
      ...initialRisks.map(iRisk => computeSimilarity(reRisk, iRisk)),
      0
    );
    if (maxSimilarity < 0.4) novelCount++;
  }

  return novelCount / reReviewRisks.length;
}


// ═══════════════════════════════════════════════════════════════
// Phase 3: DETECTION — 경직 감지 + Vitality Score
// ═══════════════════════════════════════════════════════════════

const RIGIDITY_THRESHOLDS = {
  convergence_too_fast: { severity: 0.3 },
  frame_unchanged: { similarity_threshold: 0.8, severity: 0.6 },
  all_suggestions_accepted: { severity: 0.5 },
  feedback_predictable: { novelty_threshold: 0.2, severity: 0.4 },
  same_persona_set: { min_sessions: 3, severity: 0.3 },
  low_gamma_high_dq: { gamma_threshold: 0.2, dq_threshold: 70, severity: 0.7 },
  actor_pattern_rigid: { min_sessions: 3, severity: 0.3 },
  translated_approval_ignored: { severity: 0.5 },
} as const;

/**
 * Detect rigidity signals from project data.
 * Returns signals sorted by severity (highest first).
 */
export function detectRigiditySignals(
  reframe: ReframeItem | null,
  recast: RecastItem | null,
  feedbackRecords: FeedbackRecord[],
  gamma: number,
  dqScore?: number,
  pastFeedbackRecords?: FeedbackRecord[],
): RigiditySignal[] {
  const signals: RigiditySignal[] = [];
  let signalIdx = 0;
  const mkId = () => `rs-${Date.now()}-${signalIdx++}`;

  // ── User ↔ AI ──

  // frame_unchanged: reframed question ≈ surface task
  if (reframe?.analysis) {
    const surface = reframe.analysis.surface_task || '';
    const reframed = reframe.analysis.reframed_question || '';
    if (surface && reframed && computeSimilarity(surface, reframed) > RIGIDITY_THRESHOLDS.frame_unchanged.similarity_threshold) {
      signals.push({
        id: mkId(),
        category: 'user_ai',
        signal_type: 'frame_unchanged',
        severity: RIGIDITY_THRESHOLDS.frame_unchanged.severity,
        evidence: '리프레임된 질문이 원래 질문과 거의 같습니다.',
        recommendation: '정반대 관점에서 질문을 다시 구성해보세요.',
      });
    }
  }

  // ── User ↔ Persona ──

  // feedback_predictable: re-review novelty < threshold
  if (feedbackRecords.length >= 2) {
    const sortedFB = [...feedbackRecords].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    const initial = sortedFB[sortedFB.length - 2];
    const reReview = sortedFB[sortedFB.length - 1];
    if (initial && reReview && initial.project_id === reReview.project_id) {
      const novelty = measureFeedbackNovelty(initial, reReview);
      if (novelty < RIGIDITY_THRESHOLDS.feedback_predictable.novelty_threshold) {
        signals.push({
          id: mkId(),
          category: 'user_persona',
          signal_type: 'feedback_predictable',
          severity: RIGIDITY_THRESHOLDS.feedback_predictable.severity,
          evidence: `리리뷰 피드백의 ${Math.round((1 - novelty) * 100)}%가 초기 리뷰와 유사합니다.`,
          recommendation: '다른 perspective나 intensity를 시도해보세요.',
        });
      }
    }
  }

  // same_persona_set: check past feedback records
  if (pastFeedbackRecords && pastFeedbackRecords.length >= RIGIDITY_THRESHOLDS.same_persona_set.min_sessions) {
    const recentSets = pastFeedbackRecords.slice(-3).map(r => [...(r.persona_ids || [])].sort().join(','));
    if (recentSets.length >= 3 && recentSets.every(s => s === recentSets[0])) {
      signals.push({
        id: mkId(),
        category: 'user_persona',
        signal_type: 'same_persona_set',
        severity: RIGIDITY_THRESHOLDS.same_persona_set.severity,
        evidence: '최근 3회 연속 같은 페르소나 세트를 사용했습니다.',
        recommendation: '새로운 페르소나를 추가하거나 기존 페르소나의 특성을 변경해보세요.',
      });
    }
  }

  // ── User ↔ System ──

  // low_gamma_high_dq: gaming signal
  if (gamma < RIGIDITY_THRESHOLDS.low_gamma_high_dq.gamma_threshold
    && dqScore !== undefined
    && dqScore > RIGIDITY_THRESHOLDS.low_gamma_high_dq.dq_threshold) {
    signals.push({
      id: mkId(),
      category: 'user_system',
      signal_type: 'low_gamma_high_dq',
      severity: RIGIDITY_THRESHOLDS.low_gamma_high_dq.severity,
      evidence: `DQ ${dqScore}이지만 γ는 ${gamma.toFixed(2)}입니다. 프로세스는 거쳤지만 사고는 변하지 않았을 수 있습니다.`,
      recommendation: 'Reframe 단계에서 더 시간을 투자해보세요.',
    });
  }

  // actor_pattern_rigid: always same actor distribution
  if (pastFeedbackRecords && pastFeedbackRecords.length >= RIGIDITY_THRESHOLDS.actor_pattern_rigid.min_sessions) {
    // This would need recast data from past sessions — simplified check via step_actors in fingerprints
    // For now, skip — will be enhanced when fingerprint history is available
  }

  return signals.sort((a, b) => b.severity - a.severity);
}

/**
 * Compute the Vitality Score for a project.
 * vitality = gamma × (1 - max_rigidity_severity)
 */
export function assessVitality(
  reframe: ReframeItem | null,
  recast: RecastItem | null,
  feedbackRecords: FeedbackRecord[],
  dqScore?: number,
  pastFeedbackRecords?: FeedbackRecord[],
): VitalityAssessment {
  // Compute gamma + fingerprints in one pass (no duplication)
  const { per_stage, overall: gamma, fingerprints } = computeProjectGamma(
    reframe, recast, feedbackRecords,
  );

  const signals = detectRigiditySignals(
    reframe, recast, feedbackRecords, gamma, dqScore, pastFeedbackRecords
  );

  // Use weighted severity: high signals matter more, but average for stored metric
  const rigidityScore = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.severity, 0) / signals.length
    : 0;

  // Vitality uses the same rigidityScore (not max) for consistency
  const vitalityScore = gamma * (1 - rigidityScore);

  let tier: VitalityAssessment['tier'];
  if (vitalityScore > 0.7) tier = 'alive';
  else if (vitalityScore > 0.4) tier = 'coasting';
  else if (vitalityScore > 0.2) tier = 'performing';
  else tier = 'dead';

  return {
    id: `va-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    project_id: reframe?.project_id || recast?.project_id || undefined,
    gamma,
    rigidity_score: rigidityScore,
    vitality_score: vitalityScore,
    signals,
    fingerprints,
    tier,
    created_at: new Date().toISOString(),
  };
}

/**
 * Analyze vitality trends across multiple assessments.
 */
export function analyzeVitalityTrend(
  assessments: VitalityAssessment[]
): {
  trend: 'improving' | 'stable' | 'declining' | 'not_enough_data';
  avg_vitality: number;
  avg_gamma: number;
  dominant_rigidity: RigidityCategory | null;
  insight: string;
} {
  if (assessments.length < 3) {
    return {
      trend: 'not_enough_data',
      avg_vitality: 0,
      avg_gamma: 0,
      dominant_rigidity: null,
      insight: '3개 이상의 프로젝트가 필요합니다.',
    };
  }

  const sorted = [...assessments].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const half = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, half);
  const secondHalf = sorted.slice(half);

  const avgFirst = firstHalf.reduce((s, a) => s + a.vitality_score, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, a) => s + a.vitality_score, 0) / secondHalf.length;

  const avgVitality = sorted.reduce((s, a) => s + a.vitality_score, 0) / sorted.length;
  const avgGamma = sorted.reduce((s, a) => s + a.gamma, 0) / sorted.length;

  // Find dominant rigidity category
  const categoryCounts: Record<string, number> = {};
  for (const a of sorted) {
    for (const s of a.signals) {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    }
  }
  const dominant = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];

  const diff = avgSecond - avgFirst;
  let trend: 'improving' | 'stable' | 'declining';
  if (diff > 0.1) trend = 'improving';
  else if (diff < -0.1) trend = 'declining';
  else trend = 'stable';

  const insights: Record<string, string> = {
    improving: `판단 과정의 생명력이 향상되고 있습니다 (${avgFirst.toFixed(2)} → ${avgSecond.toFixed(2)}).`,
    stable: `판단 과정이 안정적입니다 (평균 vitality ${avgVitality.toFixed(2)}).`,
    declining: `판단 과정이 경직되고 있습니다 (${avgFirst.toFixed(2)} → ${avgSecond.toFixed(2)}). ${dominant ? `주요 원인: ${dominant[0]}` : ''}`,
  };

  return {
    trend,
    avg_vitality: avgVitality,
    avg_gamma: avgGamma,
    dominant_rigidity: (dominant?.[0] as RigidityCategory) || null,
    insight: insights[trend],
  };
}


// ═══════════════════════════════════════════════════════════════
// Phase 4: RESPONSE — 티어별 개입 + navigator 통합
// ═══════════════════════════════════════════════════════════════

export interface VitalityIntervention {
  tier: 1 | 2 | 3 | 4;
  message: string;
  detail?: string;
  tone: 'neutral' | 'positive' | 'counterfactual' | 'challenge';
  target_signal: string;
}

const SIGNAL_INTERVENTIONS: Record<string, {
  tiers: Array<{ tier: 1 | 2 | 3 | 4; tone: VitalityIntervention['tone']; message: string; detail?: string }>;
}> = {
  convergence_too_fast: {
    tiers: [
      { tier: 1, tone: 'counterfactual', message: '빠른 수렴은 때때로 깊은 검토 없이 진행된 신호일 수 있습니다.' },
      { tier: 2, tone: 'challenge', message: '1회 만에 수렴했습니다. 페르소나 피드백을 더 꼼꼼히 검토해보세요.', detail: '수렴이 빠를수록 놓친 것이 있을 확률이 높습니다.' },
      { tier: 3, tone: 'challenge', message: '반복적으로 1회 수렴하고 있습니다. 의도적으로 2회차 리뷰를 진행해보세요.' },
    ],
  },
  frame_unchanged: {
    tiers: [
      { tier: 1, tone: 'counterfactual', message: '리프레임된 질문이 원래 질문과 비슷합니다. 다른 각도가 있을 수 있습니다.' },
      { tier: 2, tone: 'challenge', message: '원래 프레임이 거의 바뀌지 않았습니다.', detail: '정반대 관점에서 질문을 재구성해보세요.' },
      { tier: 3, tone: 'challenge', message: '"존재 자체에 도전" 전략을 시도해보세요. 이 문제가 정말 풀어야 할 문제인가?' },
    ],
  },
  feedback_predictable: {
    tiers: [
      { tier: 1, tone: 'neutral', message: '페르소나 피드백이 이전과 비슷한 패턴입니다.' },
      { tier: 2, tone: 'counterfactual', message: '리뷰와 리리뷰의 피드백이 거의 같습니다. 다른 관점(perspective)이나 강도(intensity)를 시도해보세요.' },
      { tier: 3, tone: 'challenge', message: '새로운 페르소나를 추가하거나, 기존 페르소나의 특성을 의도적으로 변경해보세요.' },
    ],
  },
  same_persona_set: {
    tiers: [
      { tier: 2, tone: 'neutral', message: '최근 같은 페르소나 세트를 반복 사용하고 있습니다.' },
      { tier: 3, tone: 'challenge', message: '다른 관점의 페르소나를 추가해보세요. 같은 사람에게만 물으면 같은 답이 나옵니다.' },
    ],
  },
  low_gamma_high_dq: {
    tiers: [
      { tier: 2, tone: 'challenge', message: 'DQ 점수는 높지만 각 단계에서 새로운 통찰이 적습니다.', detail: '프로세스가 형식화되고 있을 수 있습니다.' },
      { tier: 3, tone: 'challenge', message: '프로세스를 거치는 것 자체가 목표가 되고 있지 않은지 점검해보세요.' },
      { tier: 4, tone: 'challenge', message: '"서로 지탱하면 경직된다" — 이 도구와의 관계도 마찬가지일 수 있습니다. 이 도구를 잘 쓰는 것이 아니라, 진짜 판단을 내리는 것이 목표입니다.' },
    ],
  },
  translated_approval_ignored: {
    tiers: [
      { tier: 2, tone: 'counterfactual', message: '구체적 수정 제안이 있었지만 반영 없이 수렴했습니다.', detail: '무시한 제안이 의도적인지 검토해보세요.' },
    ],
  },
};

/**
 * Generate interventions based on rigidity signals.
 * Escalation: 1st occurrence → Tier 1, 2nd → Tier 2, 3rd+ → Tier 3, 5+ → Tier 4
 */
export function generateInterventions(
  signals: RigiditySignal[],
  pastAssessments?: VitalityAssessment[],
): VitalityIntervention[] {
  const interventions: VitalityIntervention[] = [];

  for (const signal of signals) {
    const template = SIGNAL_INTERVENTIONS[signal.signal_type];
    if (!template) continue;

    // Count how many times this signal has appeared in past assessments
    let occurrenceCount = 1;
    if (pastAssessments) {
      for (const pa of pastAssessments) {
        if (pa.signals.some(s => s.signal_type === signal.signal_type)) {
          occurrenceCount++;
        }
      }
    }

    // Determine which tier to use based on occurrence count
    let targetTier: 1 | 2 | 3 | 4;
    if (occurrenceCount >= 5) targetTier = 4;
    else if (occurrenceCount >= 3) targetTier = 3;
    else if (occurrenceCount >= 2) targetTier = 2;
    else targetTier = 1;

    // Find the best matching tier template (highest tier ≤ targetTier)
    const available = template.tiers
      .filter(t => t.tier <= targetTier)
      .sort((a, b) => b.tier - a.tier);

    if (available.length > 0) {
      const chosen = available[0];
      interventions.push({
        tier: chosen.tier,
        message: chosen.message,
        detail: chosen.detail,
        tone: chosen.tone,
        target_signal: signal.signal_type,
      });
    }
  }

  return interventions;
}

/**
 * Get vitality-specific step coaching for navigator integration.
 * Returns at most 1 coaching message to avoid overwhelming.
 */
export function getVitalityCoaching(
  step: 'reframe' | 'recast' | 'rehearse' | 'refine',
  signals: RigiditySignal[],
  pastAssessments?: VitalityAssessment[],
): { message: string; detail?: string; tone: 'neutral' | 'positive' | 'counterfactual' | 'challenge' } | null {
  // Map signal types to relevant steps
  const stepSignalMap: Record<string, string[]> = {
    reframe: ['frame_unchanged', 'low_gamma_high_dq'],
    recast: ['actor_pattern_rigid'],
    rehearse: ['feedback_predictable', 'same_persona_set'],
    refine: ['convergence_too_fast', 'translated_approval_ignored'],
  };

  const relevantTypes = stepSignalMap[step] || [];
  const relevantSignals = signals.filter(s => relevantTypes.includes(s.signal_type));

  if (relevantSignals.length === 0) return null;

  // Pick the highest severity signal
  const topSignal = relevantSignals[0]; // already sorted by severity
  const interventions = generateInterventions([topSignal], pastAssessments);

  if (interventions.length === 0) return null;

  return {
    message: interventions[0].message,
    detail: interventions[0].detail,
    tone: interventions[0].tone,
  };
}
