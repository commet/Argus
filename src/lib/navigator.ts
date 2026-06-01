/**
 * Navigator (항해장) — 읽기 전용 코칭 레이어
 *
 * 기존 분석 인프라(eval-engine, context-builder, judgmentStore, prompt-mutation)의
 * 출력을 통합하여 사용자에게 메타적 인사이트와 단계별 코칭을 제공한다.
 *
 * 원칙:
 * - 새로운 데이터 수집 없음 — 기존 함수의 읽기 레이어만
 * - LLM 미사용 — 결정론적 템플릿
 * - 점진적 노출 — 세션 수에 따라 티어 상승
 */

import { getSessionInsights, getEvalSummary, analyzeStrategyPerformance } from '@/lib/eval-engine';
import { getWorstPerformingEvals } from '@/lib/prompt-mutation';
import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import { data, getLatestDone, getDoneItems } from '@/lib/storage-helpers';
import { getDQScores, analyzeDQTrend } from '@/lib/decision-quality';
import { getSignals } from '@/lib/signal-recorder';
import { t } from '@/lib/i18n';
import { analyzeVitalityTrend, getVitalityCoaching as getVitalityStepCoaching, generateInterventions } from '@/lib/judgment-vitality';
import type { JudgmentRecord, Project, PersonaAccuracyRating, ReframeItem, RecastItem, DecisionQualityScore, VitalityAssessment } from '@/stores/types';
import type { ReframingStrategy } from '@/lib/reframing-strategy';

/* ────────────────────────────────────
   Types
   ──────────────────────────────────── */

export interface NavigatorInsight {
  id: string;
  category: 'pattern' | 'coaching' | 'growth' | 'warning';
  message: string;
  detail?: string;
  tier: 1 | 2 | 3;
  priority: number;
}

export interface DemoSeedData {
  doubted_count: number;
  total_premises: number;
  ai_only_steps: number;
  human_only_steps: number;
  total_steps: number;
  completed: boolean;
}

export interface NavigatorProfile {
  sessionCount: number;
  projectCount: number;
  totalJudgments: number;
  overrideRate: number;
  dominantStrategy: ReframingStrategy | null;
  avgPassRate: number;
  tier: 1 | 2 | 3;
  demoSeedData?: DemoSeedData;
}

export type CoachingStep = 'reframe' | 'recast' | 'rehearse' | 'refine' | 'synthesize';

export interface StepCoaching {
  message: string;
  detail?: string;
  tone?: 'neutral' | 'positive' | 'counterfactual' | 'challenge';
}

/* ────────────────────────────────────
   Constants
   ──────────────────────────────────── */

import { getCurrentLanguage } from '@/lib/i18n';

function getStrategyDisplay(): Record<ReframingStrategy, string> {
  const ko = getCurrentLanguage() === 'ko';
  return {
    challenge_existence: ko ? '존재 의심' : 'Challenge Existence',
    narrow_scope: ko ? '범위 집중' : 'Narrow Scope',
    diagnose_root: ko ? '원인 진단' : 'Root Cause Diagnosis',
    redirect_angle: ko ? '관점 전환' : 'Redirect Angle',
  };
}

function getEvalDisplay(): Record<string, string> {
  const ko = getCurrentLanguage() === 'ko';
  return {
    question_accepted: ko ? '질문 채택률' : 'Question Acceptance Rate',
    assumptions_engaged: ko ? '가정 검토율' : 'Assumption Review Rate',
    no_immediate_reanalyze: ko ? '1회 분석 충분율' : 'First-pass Sufficiency Rate',
    has_useful_assumptions: ko ? '미확인 가정 발견율' : 'Unchecked Assumption Discovery Rate',
  };
}

/* ────────────────────────────────────
   1. buildNavigatorProfile
   ──────────────────────────────────── */

export function buildNavigatorProfile(): NavigatorProfile {
  const evalSummary = getEvalSummary();
  const judgments = data.judgments();
  const projects = data.projects();

  const totalJudgments = judgments.length;
  const overrides = judgments.filter((j) => j.user_changed);
  const overrideRate = totalJudgments > 0 ? overrides.length / totalJudgments : 0;

  const sessionCount = evalSummary.total_sessions;
  const projectCount = projects.length;

  // Dominant strategy from recent performance
  const perf = analyzeStrategyPerformance();
  const dominant = perf.length > 0
    ? [...perf].sort((a, b) => b.sample_count - a.sample_count)[0].strategy
    : null;

  const tier: 1 | 2 | 3 = sessionCount >= 10 && projectCount >= 2
    ? 3
    : sessionCount >= 2
      ? 2
      : 1;

  // Demo seed: check if user completed demo (for first-use personalization)
  let demoSeedData: DemoSeedData | undefined;
  if (sessionCount === 0) {
    const demoSeeds = getSignals().filter(s => s.signal_type === 'demo_seed');
    if (demoSeeds.length > 0) {
      const latest = [...demoSeeds].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).pop()!;
      const d = latest.signal_data as Record<string, unknown>;
      demoSeedData = {
        doubted_count: typeof d.doubted_count === 'number' ? d.doubted_count : 0,
        total_premises: typeof d.total_premises === 'number' ? d.total_premises : 3,
        ai_only_steps: typeof d.ai_only_steps === 'number' ? d.ai_only_steps : 0,
        human_only_steps: typeof d.human_only_steps === 'number' ? d.human_only_steps : 0,
        total_steps: typeof d.total_steps === 'number' ? d.total_steps : 4,
        completed: typeof d.completed === 'boolean' ? d.completed : false,
      };
    }
  }

  return {
    sessionCount,
    projectCount,
    totalJudgments,
    overrideRate,
    dominantStrategy: dominant,
    avgPassRate: evalSummary.avg_pass_rate,
    tier,
    demoSeedData,
  };
}

/* ────────────────────────────────────
   2. buildNavigatorInsights
   ──────────────────────────────────── */

export function buildNavigatorInsights(profile: NavigatorProfile): NavigatorInsight[] {
  const insights: NavigatorInsight[] = [];
  let priority = 0;

  // ── Tier 1+: Session insights (last strategy + pattern) ──
  const sessionInsights = getSessionInsights();
  for (let idx = 0; idx < sessionInsights.length; idx++) {
    const si = sessionInsights[idx];
    if (si.type === 'last_strategy') {
      insights.push({
        id: `session_last_strategy_${idx}`,
        category: 'pattern',
        message: si.message,
        tier: 1,
        priority: priority++,
      });
    }
    if (si.type === 'pattern' && profile.tier >= 2) {
      insights.push({
        id: `session_pattern_${idx}`,
        category: 'pattern',
        message: si.message,
        tier: 2,
        priority: priority++,
      });
    }
    if (si.type === 'tip') {
      insights.push({
        id: `session_tip_${idx}`,
        category: 'growth',
        message: si.message,
        tier: 1,
        priority: priority++,
      });
    }
  }

  // ── Tier 2+: Eval summary ──
  if (profile.tier >= 2) {
    const evalSummary = getEvalSummary();
    if (evalSummary.total_sessions > 0) {
      const pct = Math.round(evalSummary.avg_pass_rate * 100);
      insights.push({
        id: 'eval_summary',
        category: 'growth',
        message: t('navigator.evalSummary', { count: evalSummary.total_sessions, pct }),
        tier: 2,
        priority: priority++,
      });
    }

    // Worst performing evals → coaching
    const worstEvals = getWorstPerformingEvals();
    for (const mutation of worstEvals.slice(0, 2)) {
      const evalName = getEvalDisplay()[mutation.evalId] || mutation.evalId;
      const pct = Math.round(mutation.passRate * 100);
      insights.push({
        id: `coaching_${mutation.evalId}`,
        category: 'coaching',
        message: t('navigator.evalLow', { name: evalName, pct }),
        detail: mutation.instruction,
        tier: 2,
        priority: priority++,
      });
    }

    // Override rate interpretation
    if (profile.totalJudgments >= 3) {
      const pct = Math.round(profile.overrideRate * 100);
      if (profile.overrideRate > 0.4) {
        insights.push({
          id: 'override_rate_high',
          category: 'pattern',
          message: t('navigator.overrideHighMessage', { pct }),
          detail: t('navigator.overrideHighDetail'),
          tier: 2,
          priority: priority++,
        });
      } else if (profile.overrideRate < 0.1 && profile.totalJudgments >= 5) {
        insights.push({
          id: 'override_rate_low',
          category: 'coaching',
          message: t('navigator.overrideLowMessage', { pct }),
          detail: t('navigator.overrideLowDetail'),
          tier: 2,
          priority: priority++,
        });
      }
    }
  }

  // ── Tier 3: Cross-project + strategy performance ──
  if (profile.tier >= 3) {
    // Coda insights
    const projects = data.projects();
    const withReflection = projects.filter(
      (p) => p.meta_reflection?.surprising_discovery || p.meta_reflection?.next_time_differently
    );
    for (const p of withReflection.slice(0, 2)) {
      const r = p.meta_reflection!;
      const content = r.surprising_discovery || r.next_time_differently || '';
      insights.push({
        id: `coda_${p.id}`,
        category: 'growth',
        message: `${p.name}: ${content}`,
        tier: 3,
        priority: priority++,
      });
    }

    // Strategy performance comparison
    const perf = analyzeStrategyPerformance();
    const sorted = perf.filter((p) => p.sample_count >= 3).sort((a, b) => b.avg_pass_rate - a.avg_pass_rate);
    if (sorted.length >= 2) {
      const best = sorted[0];
      const bestName = getStrategyDisplay()[best.strategy] || best.strategy;
      const bestPct = Math.round(best.avg_pass_rate * 100);
      insights.push({
        id: 'strategy_best',
        category: 'growth',
        message: t('navigator.strategyBest', { name: bestName, pct: bestPct }),
        tier: 3,
        priority: priority++,
      });
    }
  }

  // ── Tier 2+: Vitality Engine insights ──
  if (profile.tier >= 2) {
    const vitalityAssessments = data.vitalityAssessments();
    if (vitalityAssessments.length >= 3) {
      const trend = analyzeVitalityTrend(vitalityAssessments);
      if (trend.trend === 'declining') {
        insights.push({
          id: 'vitality_declining',
          category: 'warning',
          message: trend.insight,
          tier: 2,
          priority: priority++,
        });
      }
      // Latest assessment warnings
      const latest = vitalityAssessments[vitalityAssessments.length - 1];
      if (latest && (latest.tier === 'performing' || latest.tier === 'dead')) {
        const interventions = generateInterventions(latest.signals, vitalityAssessments.slice(0, -1));
        for (const intervention of interventions.slice(0, 2)) {
          insights.push({
            id: `vitality_${intervention.target_signal}`,
            category: 'warning',
            message: intervention.message,
            detail: intervention.detail,
            tier: Math.min(intervention.tier, 3) as 1 | 2 | 3,
            priority: priority++,
          });
        }
      }
    }
  }

  // Filter by tier and sort by priority
  return insights
    .filter((i) => i.tier <= profile.tier)
    .sort((a, b) => a.priority - b.priority);
}

/* ────────────────────────────────────
   3. getStepCoaching
   ──────────────────────────────────── */

/**
 * Returns up to 2 coaching messages per step, prioritized by comfort ratio.
 * Phase 1: returns array instead of single item, enabling multi-tone coaching.
 */
export function getStepCoaching(step: CoachingStep, profile: NavigatorProfile): StepCoaching[] {
  let candidates: StepCoaching[];
  switch (step) {
    case 'reframe':
      candidates = getReframeCoaching(profile);
      break;
    case 'recast':
      candidates = getRecastCoaching(profile);
      break;
    case 'rehearse':
      candidates = getPersonaFeedbackCoaching(profile);
      break;
    case 'refine':
      candidates = getRefineCoaching(profile);
      break;
    case 'synthesize':
      candidates = getSynthesizeCoaching(profile);
      break;
    default:
      candidates = [];
  }
  // Vitality coaching — max 1, only if vitality concerns exist (tier 2+)
  // Insert at front so it survives the slice(0, 2) truncation
  if (profile.tier >= 2) {
    const vitalityAssessments = data.vitalityAssessments();
    const latest = vitalityAssessments[vitalityAssessments.length - 1];
    if (latest && latest.signals?.length > 0) {
      if (!['reframe', 'recast', 'rehearse', 'refine'].includes(step)) return candidates.slice(0, 2);
      const vc = getVitalityStepCoaching(step as 'reframe' | 'recast' | 'rehearse' | 'refine', latest.signals, vitalityAssessments);
      if (vc) {
        candidates.unshift({ message: vc.message, detail: vc.detail, tone: vc.tone });
      }
    }
  }

  // Max 2 coaching messages per step to avoid overwhelming the user
  return candidates.slice(0, 2);
}

function getReframeCoaching(profile: NavigatorProfile): StepCoaching[] {
  const results: StepCoaching[] = [];

  // Tier 1: First use — demo seed personalization or generic counterfactual
  if (profile.sessionCount === 0) {
    const seed = profile.demoSeedData;
    if (seed?.completed) {
      // Personalized coaching based on demo behavior
      if (seed.doubted_count === 0) {
        results.push({
          message: t('coaching.reframe.demoAllAccepted'),
          detail: t('coaching.reframe.demoAllAcceptedDetail'),
          tone: 'challenge',
        });
      } else if (seed.doubted_count >= seed.total_premises) {
        results.push({
          message: t('coaching.reframe.demoAllDoubted', { total: seed.total_premises }),
          detail: t('coaching.reframe.demoAllDoubtedDetail'),
          tone: 'positive',
        });
      } else {
        results.push({
          message: t('coaching.reframe.demoPartialDoubted', { total: seed.total_premises, doubted: seed.doubted_count }),
          detail: t('coaching.reframe.demoPartialDoubtedDetail'),
          tone: 'positive',
        });
      }
    } else {
      // No demo seed — generic counterfactual
      results.push({
        message: t('coaching.reframe.firstUse'),
        detail: t('coaching.reframe.firstUseDetail'),
        tone: 'counterfactual',
      });
    }
    return results;
  }

  // Positive: improving assumption discovery rate
  if (profile.tier >= 2) {
    const reframeItems = data.reframeItems();
    const doneItems = reframeItems.filter(d => d.status === 'done' && d.analysis);
    if (doneItems.length >= 2) {
      const recent = doneItems.slice(-2);
      const recentAssumptions = recent.map(d => d.analysis!.hidden_assumptions?.length || 0);
      const older = doneItems.slice(0, -2);
      if (older.length > 0) {
        const olderAvg = older.reduce((sum, d) => sum + (d.analysis!.hidden_assumptions?.length || 0), 0) / older.length;
        const recentAvg = recentAssumptions.reduce((a, b) => a + b, 0) / recentAssumptions.length;
        if (recentAvg > olderAvg * 1.3 && olderAvg > 0) {
          results.push({
            message: t('coaching.reframe.assumptionGrowth', { old: Math.round(olderAvg), new: Math.round(recentAvg) }),
            detail: t('coaching.reframe.assumptionGrowthDetail'),
            tone: 'positive',
          });
        }
      }
    }
  }

  // Strategy repetition detection (tier 2+) — challenge tone
  if (profile.tier >= 2 && profile.dominantStrategy) {
    const sessionInsights = getSessionInsights();
    const patternInsight = sessionInsights.find((si) => si.type === 'pattern');
    if (patternInsight) {
      const strategyName = getStrategyDisplay()[profile.dominantStrategy];
      results.push({
        message: t('coaching.reframe.strategyRepetition', { strategy: strategyName }),
        tone: 'challenge',
      });
    }
  }

  // Assumptions engagement failure — compensate
  if (profile.tier >= 2) {
    const worstEvals = getWorstPerformingEvals();
    const assumptionFail = worstEvals.find((m) => m.evalId === 'assumptions_engaged');
    if (assumptionFail) {
      results.push({
        message: t('coaching.reframe.assumptionEngage'),
        detail: t('coaching.reframe.assumptionEngageDetail'),
      });
    }
  }

  // High pass rate — specific acknowledgment
  if (results.length === 0 && profile.avgPassRate >= 0.75 && profile.sessionCount >= 3) {
    const pct = Math.round(profile.avgPassRate * 100);
    results.push({
      message: t('coaching.reframe.highPassRate', { pct }),
      tone: 'positive',
    });
  }

  return results;
}

function getRecastCoaching(profile: NavigatorProfile): StepCoaching[] {
  const results: StepCoaching[] = [];

  // First use — demo seed personalization or generic counterfactual
  if (profile.sessionCount === 0) {
    const seed = profile.demoSeedData;
    if (seed?.completed) {
      if (seed.ai_only_steps >= seed.total_steps - 1) {
        results.push({ message: t('coaching.recast.demoAiHeavy'), detail: t('coaching.recast.demoAiHeavyDetail'), tone: 'challenge' });
      } else if (seed.human_only_steps >= seed.total_steps - 1) {
        results.push({ message: t('coaching.recast.demoHumanHeavy'), detail: t('coaching.recast.demoHumanHeavyDetail'), tone: 'positive' });
      } else {
        results.push({ message: t('coaching.recast.demoBalanced'), detail: t('coaching.recast.demoBalancedDetail'), tone: 'positive' });
      }
    } else {
      results.push({ message: t('coaching.recast.firstUse'), detail: t('coaching.recast.firstUseDetail'), tone: 'counterfactual' });
    }
    return results;
  }

  if (profile.totalJudgments < 3) {
    // Cross-stage: check reframe for unverified assumptions (always show if available)
    const reframeItems = data.reframeItems();
    const latestReframe = reframeItems.filter(d => d.status === 'done').sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).pop();
    if (latestReframe?.analysis) {
      const uncertain = (latestReframe.analysis.hidden_assumptions || []).filter(
        a => a.evaluation === 'uncertain' || a.evaluation === 'doubtful'
      );
      if (uncertain.length > 0) {
        results.push({
          message: t('coaching.recast.uncertainAssumptions', { count: uncertain.length }),
          detail: uncertain.slice(0, 2).map(a => a.assumption).join(' / '),
        });
      }
    }
    return results;
  }

  const judgments = data.judgments();
  const actorOverrides = judgments.filter((j) => j.type === 'actor_override');

  // Override rate > 40%
  if (profile.overrideRate > 0.4) {
    const pct = Math.round(profile.overrideRate * 100);
    results.push({
      message: t('coaching.recast.overrideHigh', { pct }),
      tone: 'positive',
    });
  }

  // Actor preference — challenge tone for extreme patterns
  if (actorOverrides.length >= 3) {
    const humanPrefs = actorOverrides.filter((j) => j.decision === 'human').length;
    const aiPrefs = actorOverrides.filter((j) => j.decision === 'ai').length;
    if (humanPrefs > aiPrefs * 1.5) {
      results.push({
        message: t('coaching.recast.prefersHuman'),
      });
    }
    if (aiPrefs > humanPrefs * 1.5) {
      results.push({
        message: t('coaching.recast.prefersAi'),
        tone: 'challenge',
      });
    }
  }

  // Cross-stage: check reframe for unverified assumptions
  const reframeItems = data.reframeItems();
  const latestReframe = reframeItems.filter(d => d.status === 'done').sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).pop();
  if (latestReframe?.analysis) {
    const uncertain = (latestReframe.analysis.hidden_assumptions || []).filter(
      a => a.evaluation === 'uncertain' || a.evaluation === 'doubtful'
    );
    if (uncertain.length > 0) {
      results.push({
        message: t('coaching.recast.uncertainAssumptions', { count: uncertain.length }),
        detail: uncertain.slice(0, 2).map(a => a.assumption).join(' / '),
      });
    }
  }

  return results;
}

function getPersonaFeedbackCoaching(profile: NavigatorProfile): StepCoaching[] {
  const results: StepCoaching[] = [];

  // First use — counterfactual
  if (profile.sessionCount === 0) {
    results.push({
      message: t('coaching.rehearse.firstUse'),
      detail: t('coaching.rehearse.firstUseDetail'),
      tone: 'counterfactual',
    });
    return results;
  }

  // Positive: improving persona accuracy over time
  const allRatings = data.ratings();
  if (allRatings.length >= 4) {
    const sorted = [...allRatings].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
    const firstAvg = firstHalf.reduce((s, r) => s + r.accuracy_score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + r.accuracy_score, 0) / secondHalf.length;
    if (secondAvg > firstAvg + 0.5) {
      results.push({
        message: t('coaching.rehearse.accuracyImproving', { from: firstAvg.toFixed(1), to: secondAvg.toFixed(1) }),
        detail: t('coaching.rehearse.accuracyImprovingDetail'),
        tone: 'positive',
      });
    }
  }

  // Cross-stage: check recast for key assumptions to test
  const recastItems = data.recastItems();
  const latestRecast = recastItems.filter(o => o.status === 'done').sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).pop();
  if (latestRecast?.analysis?.key_assumptions) {
    const highImportance = latestRecast.analysis.key_assumptions.filter(ka => ka.importance === 'high');
    if (highImportance.length > 0) {
      results.push({
        message: t('coaching.rehearse.keyAssumptions', { count: highImportance.length }),
        detail: highImportance.slice(0, 2).map(ka => ka.assumption).join(' / '),
      });
    }
  }

  // Persona accuracy summary
  const ratings = data.ratings();
  if (ratings.length > 0) {
    const byPersona: Record<string, PersonaAccuracyRating[]> = {};
    for (const r of ratings) {
      if (!byPersona[r.persona_id]) byPersona[r.persona_id] = [];
      byPersona[r.persona_id].push(r);
    }

    const entries = Object.entries(byPersona);
    if (entries.length > 0) {
      const [, personaRatings] = entries.sort(([, a], [, b]) => b.length - a.length)[0];
      const avg = personaRatings.reduce((sum, r) => sum + r.accuracy_score, 0) / personaRatings.length;
      const score = Math.round(avg * 10) / 10;

      const aspectCounts: Record<string, { accurate: number; inaccurate: number }> = {};
      for (const r of personaRatings) {
        for (const a of (r.which_aspects_accurate || [])) {
          if (!aspectCounts[a]) aspectCounts[a] = { accurate: 0, inaccurate: 0 };
          aspectCounts[a].accurate++;
        }
        for (const a of (r.which_aspects_inaccurate || [])) {
          if (!aspectCounts[a]) aspectCounts[a] = { accurate: 0, inaccurate: 0 };
          aspectCounts[a].inaccurate++;
        }
      }

      const sortedAspects = Object.entries(aspectCounts).sort(
        ([, a], [, b]) => (b.accurate - b.inaccurate) - (a.accurate - a.inaccurate)
      );
      const best = sortedAspects.find(([, v]) => v.accurate > v.inaccurate)?.[0];
      const worst = sortedAspects.find(([, v]) => v.inaccurate >= v.accurate)?.[0];

      let detail: string | undefined;
      if (best && worst) {
        detail = t('coaching.rehearse.accurateNeedsFix', { best, worst });
      } else if (best) {
        detail = t('coaching.rehearse.accurateAt', { best });
      }

      results.push({
        message: t('coaching.rehearse.personaAccuracy', { score, count: personaRatings.length }),
        detail,
      });
    }
  }

  return results;
}

function getRefineCoaching(profile: NavigatorProfile): StepCoaching[] {
  const results: StepCoaching[] = [];

  // First use — counterfactual
  if (profile.sessionCount === 0) {
    results.push({
      message: t('coaching.refine.firstUse'),
      detail: t('coaching.refine.firstUseDetail'),
      tone: 'counterfactual',
    });
    return results;
  }

  // Cross-stage: DQ trend from previous projects
  const dqScores = data.dqScores();
  if (dqScores.length >= 2) {
    const sorted = [...dqScores].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const prev = sorted[sorted.length - 2];
    const last = sorted[sorted.length - 1];
    const dqElements = [
      { key: 'appropriate_frame' as const, label: t('dq.element.appropriateFrame') },
      { key: 'creative_alternatives' as const, label: t('dq.element.creativeAlternatives') },
      { key: 'relevant_information' as const, label: t('dq.element.relevantInformation') },
      { key: 'clear_values' as const, label: t('dq.element.clearValues') },
      { key: 'sound_reasoning' as const, label: t('dq.element.soundReasoning') },
      { key: 'commitment_to_action' as const, label: t('dq.element.commitmentToAction') },
    ];
    if (last.overall_dq > prev.overall_dq) {
      let biggestGainLabel = '';
      let biggestDelta = 0;
      for (const { key, label } of dqElements) {
        const delta = (last[key] || 0) - (prev[key] || 0);
        if (delta > biggestDelta) { biggestDelta = delta; biggestGainLabel = label; }
      }
      const detail = biggestGainLabel ? t('coaching.refine.biggestGain', { element: biggestGainLabel }) : undefined;
      results.push({
        message: t('coaching.refine.dqImproving', { prev: prev.overall_dq, current: last.overall_dq }),
        detail,
        tone: 'positive',
      });
    } else if (last.overall_dq < prev.overall_dq * 0.85) {
      let biggestDropLabel = '';
      let biggestDelta = 0;
      for (const { key, label } of dqElements) {
        const delta = (prev[key] || 0) - (last[key] || 0);
        if (delta > biggestDelta) { biggestDelta = delta; biggestDropLabel = label; }
      }
      const detail = biggestDropLabel ? t('coaching.refine.biggestDrop', { element: biggestDropLabel }) : undefined;
      results.push({
        message: t('coaching.refine.dqDeclining', { prev: prev.overall_dq, current: last.overall_dq }),
        detail,
        tone: 'challenge',
      });
    }
  }

  // (Removed) Active refine loops coaching — legacy path gone.

  return results;
}

function getSynthesizeCoaching(profile: NavigatorProfile): StepCoaching[] {
  const results: StepCoaching[] = [];

  if (profile.sessionCount === 0) {
    results.push({
      message: t('coaching.synthesize.firstUse'),
      detail: t('coaching.synthesize.firstUseDetail'),
      tone: 'counterfactual',
    });
    return results;
  }

  // Override rate coaching — prompts based on how often the user rewrites AI suggestions
  if (profile.overrideRate > 0.5 && profile.totalJudgments >= 5) {
    results.push({
      message: t('coaching.synthesize.overrideHigh'),
      tone: 'positive',
    });
  } else if (profile.overrideRate < 0.1 && profile.totalJudgments >= 5) {
    results.push({
      message: t('coaching.synthesize.overrideLow'),
      tone: 'challenge',
    });
  }

  return results;
}

/* ────────────────────────────────────
   4. buildLearningCurve
   Learning-by-doing의 가시화.
   Anthropic Economic Index가 증명한 학습 곡선을
   사용자의 실제 데이터로 보여준다.
   ──────────────────────────────────── */

export interface LearningCurvePoint {
  project_id: string;
  project_name: string;
  overall_dq: number;
  date: string;
}

export interface LearningCurve {
  /** DQ 점수 시계열 */
  dq_points: LearningCurvePoint[];

  /** 6개 DQ 요소별 추이 (시간순) */
  element_trends: Record<string, number[]>;

  /** 가장 많이 개선된 요소 */
  most_improved_element: string | null;
  /** 개선 폭 (점) */
  improvement_delta: number;

  /** DQ 트렌드 분석 */
  trend: 'improving' | 'stable' | 'declining' | 'not_enough_data';
  avg_dq: number;

  /** 현재 티어 + 다음 티어까지 진행률 (0-100) */
  current_tier: 1 | 2 | 3;
  tier_progress: number;

  /** Axis Fingerprint: 축별 커버리지 % (최근 10개 기준, Sliding Windows) */
  axis_coverage: Record<string, number>;
  /** 가장 약한 축 (blind spot) — null이면 유의미한 갭 없음 */
  axis_gap: string | null;

  /** 충분한 데이터가 있는지 */
  has_data: boolean;
}

function getDqElements() {
  return [
    { key: 'appropriate_frame' as const, label: t('dq.element.appropriateFrame') },
    { key: 'creative_alternatives' as const, label: t('dq.element.creativeAlternatives') },
    { key: 'relevant_information' as const, label: t('dq.element.relevantInformation') },
    { key: 'clear_values' as const, label: t('dq.element.clearValues') },
    { key: 'sound_reasoning' as const, label: t('dq.element.soundReasoning') },
    { key: 'commitment_to_action' as const, label: t('dq.element.commitmentToAction') },
  ];
}

function getAxisLabels(): Record<string, string> {
  return {
    customer_value: t('axis.customerValue'),
    feasibility: t('axis.feasibility'),
    business: t('axis.business'),
    org_capacity: t('axis.orgCapacity'),
  };
}

export function buildLearningCurve(): LearningCurve {
  const projects = data.projects();
  const dqScores = getDQScores();
  const sorted = [...dqScores].sort((a, b) => a.created_at.localeCompare(b.created_at));

  // ── DQ points with project names ──
  const projectNameMap = new Map(projects.map(p => [p.id, p.name]));
  const defaultProject = t('navigator.defaultProject');
  const dq_points: LearningCurvePoint[] = sorted.map(s => ({
    project_id: s.project_id,
    project_name: projectNameMap.get(s.project_id) || defaultProject,
    overall_dq: s.overall_dq,
    date: s.created_at,
  }));

  // ── Element trends ──
  const dqElements = getDqElements();
  const element_trends: Record<string, number[]> = {};
  for (const { key, label } of dqElements) {
    element_trends[label] = sorted.map(s => s[key]);
  }

  // ── Most improved element (compare first half vs second half) ──
  let most_improved_element: string | null = null;
  let improvement_delta = 0;

  if (sorted.length >= 2) {
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    for (const { key, label } of dqElements) {
      const firstAvg = firstHalf.reduce((s, sc) => s + sc[key], 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, sc) => s + sc[key], 0) / secondHalf.length;
      const delta = secondAvg - firstAvg;
      if (delta > improvement_delta) {
        improvement_delta = Math.round(delta * 10) / 10;
        most_improved_element = label;
      }
    }
  }

  // ── DQ Trend ──
  const dqTrend = analyzeDQTrend(sorted);

  // ── Tier progress ──
  const profile = buildNavigatorProfile();
  let tier_progress = 0;
  if (profile.tier === 1) {
    tier_progress = Math.min(100, Math.round((profile.sessionCount / 2) * 100));
  } else if (profile.tier === 2) {
    const sessionProgress = Math.min(100, Math.round((profile.sessionCount / 10) * 100));
    const projectProgress = Math.min(100, Math.round((profile.projectCount / 2) * 100));
    tier_progress = Math.min(sessionProgress, projectProgress);
  } else {
    tier_progress = 100;
  }

  // ── Axis Fingerprint (Sliding Window: last 10 decisions) ──
  const reframeItems = data.reframeItems();
  const doneItems = reframeItems.filter(d => d.status === 'done' && d.analysis);
  const recentItems = doneItems.slice(-10);

  const axisCounts: Record<string, number> = {
    customer_value: 0, feasibility: 0, business: 0, org_capacity: 0,
  };
  let totalAssumptions = 0;

  for (const item of recentItems) {
    for (const assumption of item.analysis!.hidden_assumptions || []) {
      if (assumption.axis && assumption.axis in axisCounts) {
        axisCounts[assumption.axis]++;
        totalAssumptions++;
      }
    }
  }

  const axisLabels = getAxisLabels();
  const axis_coverage: Record<string, number> = {};
  for (const [axis, count] of Object.entries(axisCounts)) {
    axis_coverage[axisLabels[axis] || axis] = totalAssumptions > 0
      ? Math.round((count / totalAssumptions) * 100)
      : 0;
  }

  // Find blind spot: axis significantly below average
  // Guard: 최소 8개 가정이 있어야 축 분포를 신뢰할 수 있다 (과잉 해석 방지)
  let axis_gap: string | null = null;
  if (totalAssumptions >= 8) {
    let minCoverage = Infinity;
    let minLabel = '';
    for (const [label, pct] of Object.entries(axis_coverage)) {
      if (pct < minCoverage) {
        minCoverage = pct;
        minLabel = label;
      }
    }
    const avgCoverage = Object.values(axis_coverage).reduce((a, b) => a + b, 0) / Object.keys(axis_coverage).length;
    if (minCoverage < avgCoverage * 0.5) {
      axis_gap = minLabel;
    }
  }

  return {
    dq_points,
    element_trends,
    most_improved_element,
    improvement_delta,
    trend: dqTrend.trend,
    avg_dq: dqTrend.avg_dq,
    current_tier: profile.tier,
    tier_progress,
    axis_coverage,
    axis_gap,
    has_data: sorted.length >= 1,
  };
}
