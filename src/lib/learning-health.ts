/**
 * Learning Health Assessment — Navigator's Journal
 *
 * Meta-assessment: "Is the learning system itself working?"
 * Tracks whether override rates decrease, convergence speeds improve, etc.
 */

import { getStorage, STORAGE_KEYS } from './storage';
import { getSignals } from './signal-recorder';
import type {
  JudgmentRecord,
  PersonaAccuracyRating,
  LearningHealth,
} from '@/stores/types';

/**
 * Assess the health of the learning system.
 * Returns metrics + recommendations.
 */
export function assessLearningHealth(): LearningHealth {
  const signals = getSignals();
  const judgments = getStorage<JudgmentRecord[]>(STORAGE_KEYS.JUDGMENTS, []);
  const ratings = getStorage<PersonaAccuracyRating[]>(STORAGE_KEYS.ACCURACY_RATINGS, []);
  const reframeItems = getStorage<{ id: string }[]>(STORAGE_KEYS.REFRAME_LIST, []);

  const recommendations: string[] = [];

  // Signal count
  const signal_count = signals.length;

  // Eval coverage
  const evalSignals = signals.filter(s => s.signal_type === 'assumption_diversity');
  const eval_coverage = reframeItems.length > 0
    ? Math.round((evalSignals.length / reframeItems.length) * 100)
    : 0;

  // Override trend: compare first half vs second half
  const overrideJudgments = judgments
    .filter(j => j.type === 'actor_override' && j.user_changed)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  let override_trend: LearningHealth['override_trend'] = 'not_enough_data';
  if (overrideJudgments.length >= 4) {
    const mid = Math.floor(overrideJudgments.length / 2);
    const firstHalf = overrideJudgments.slice(0, mid);
    const secondHalf = overrideJudgments.slice(mid);

    const totalJudgmentsFirstHalf = judgments
      .filter(j => j.type === 'actor_override')
      .filter(j => j.created_at <= firstHalf[firstHalf.length - 1].created_at).length;
    const totalJudgmentsSecondHalf = judgments
      .filter(j => j.type === 'actor_override')
      .filter(j => j.created_at > firstHalf[firstHalf.length - 1].created_at).length;

    const firstRate = totalJudgmentsFirstHalf > 0 ? firstHalf.length / totalJudgmentsFirstHalf : 0;
    const secondRate = totalJudgmentsSecondHalf > 0 ? secondHalf.length / totalJudgmentsSecondHalf : 0;

    if (secondRate < firstRate * 0.8) {
      override_trend = 'improving';
    } else {
      override_trend = 'stable';
    }
  }

  // Convergence speed trend — legacy RefineLoop-based. Kept as 'not_enough_data'
  // since the post-finalize iteration path now lives in ProgressiveFlow drafts.
  const convergence_trend: LearningHealth['convergence_trend'] = 'not_enough_data';

  // Learning tier
  let learning_tier: 1 | 2 | 3 = 1;
  if (signal_count >= 10 && judgments.length >= 5) learning_tier = 2;
  if (signal_count >= 30 && judgments.length >= 15) learning_tier = 3;

  // Recommendations
  if (signal_count < 5) {
    recommendations.push('프로젝트를 더 진행하면 학습 데이터가 축적됩니다.');
  }
  if (eval_coverage < 50 && reframeItems.length >= 3) {
    recommendations.push('항로 재설정에서 전제를 평가하면 전략 학습이 활성화됩니다.');
  }
  if (ratings.length < 2) {
    recommendations.push('리허설 정확도를 평가하면 페르소나 캘리브레이션이 시작됩니다.');
  }
  if (override_trend === 'stable' && overrideJudgments.length >= 6) {
    recommendations.push('오버라이드율이 줄어들지 않고 있습니다. AI 제안이 아직 최적화되지 않았을 수 있습니다.');
  }
  if (override_trend === 'improving') {
    recommendations.push('오버라이드율이 감소하고 있습니다. 학습이 작동하고 있습니다.');
  }

  return {
    signal_count,
    eval_coverage,
    override_trend,
    convergence_trend,
    learning_tier,
    recommendations,
  };
}
