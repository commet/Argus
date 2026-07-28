import type { AnalysisSnapshot } from '@/stores/types';

export type JudgmentMode = 'standard' | 'deep';

export type DeepRecommendationReason =
  | 'critical_stakes'
  | 'irreversible'
  | 'multiple_load_bearing_assumptions';

export interface DeepJudgmentRecommendation {
  recommended: boolean;
  reasons: DeepRecommendationReason[];
}

export interface ExecutionPlanLikeStep {
  task: string;
  who?: string;
  agent_type?: string;
  output: string;
  agent_hint?: string;
  ai_scope?: string;
  self_scope?: string;
  decision?: string;
  question_to_human?: string;
  human_contact_hint?: string;
  depends_on?: number[];
}

/**
 * Deep judgment is an optional execution mode, not a synonym for every open
 * question. Recommend it only when the already-computed decision facts earn
 * the extra time/cost. The recommendation never chooses a side.
 */
export function recommendDeepJudgment(
  snapshot: Pick<AnalysisSnapshot, 'request_type' | 'stakes' | 'reversibility' | 'hidden_assumptions'> | null | undefined,
): DeepJudgmentRecommendation {
  if (!snapshot || snapshot.request_type !== 'open') {
    return { recommended: false, reasons: [] };
  }

  const reasons: DeepRecommendationReason[] = [];
  if (snapshot.stakes === 'critical') reasons.push('critical_stakes');
  if (snapshot.reversibility === 'irreversible') reasons.push('irreversible');
  if ((snapshot.hidden_assumptions?.length ?? 0) >= 3) reasons.push('multiple_load_bearing_assumptions');
  return { recommended: reasons.length > 0, reasons };
}

/**
 * A deep run is deliberately bounded: two independent AI specialists for a
 * normal important decision, with one additional critic only when the decision
 * is critical or irreversible. Human/self tasks are never removed.
 *
 * Dependencies are remapped after filtering so a dropped decorative AI step
 * cannot leave a dangling or accidentally self-referential edge.
 */
export function boundDeepExecutionPlan<T extends ExecutionPlanLikeStep>(
  steps: readonly T[],
  snapshot: Pick<AnalysisSnapshot, 'stakes' | 'reversibility'> | null | undefined,
): T[] {
  const aiLimit = snapshot?.stakes === 'critical' || snapshot?.reversibility === 'irreversible' ? 3 : 2;
  let aiCount = 0;
  const kept = steps
    .map((step, oldIndex) => ({ step, oldIndex }))
    .filter(({ step }) => {
      const type = step.agent_type
        ?? (step.who === 'human' ? 'self' : 'ai');
      if (type !== 'ai') return true;
      aiCount += 1;
      return aiCount <= aiLimit;
    });

  const newIndexByOld = new Map(kept.map((entry, newIndex) => [entry.oldIndex, newIndex]));
  return kept.map(({ step }, newIndex) => ({
    ...step,
    depends_on: (step.depends_on ?? [])
      .map((dependency) => newIndexByOld.get(dependency))
      .filter((dependency): dependency is number => dependency !== undefined && dependency !== newIndex),
  }));
}
