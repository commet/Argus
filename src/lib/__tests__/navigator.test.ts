import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildNavigatorProfile,
  buildNavigatorInsights,
  getStepCoaching,
  buildLearningCurve,
} from '@/lib/navigator';
import type { NavigatorProfile } from '@/lib/navigator';

// Mock dependencies
vi.mock('@/lib/eval-engine', () => ({
  getSessionInsights: vi.fn(() => []),
  getEvalSummary: vi.fn(() => ({
    total_sessions: 0,
    avg_pass_rate: 0,
    best_strategy: null,
    worst_eval: null,
  })),
  analyzeStrategyPerformance: vi.fn(() => []),
}));

vi.mock('@/lib/prompt-mutation', () => ({
  getWorstPerformingEvals: vi.fn(() => []),
}));

vi.mock('@/lib/decision-quality', () => ({
  getDQScores: vi.fn(() => []),
  analyzeDQTrend: vi.fn(() => ({
    total_projects: 0, avg_dq: 0, trend: 'not_enough_data',
    weakest_element: null, strongest_element: null, avg_blind_spots: 0, framing_challenge_rate: 0,
  })),
}));

vi.mock('@/lib/signal-recorder', () => ({
  getSignals: vi.fn(() => []),
}));

vi.mock('@/lib/judgment-vitality', () => ({
  analyzeVitalityTrend: vi.fn(() => ({ trend: 'not_enough_data', avg_gamma: 0, avg_vitality: 0 })),
  getVitalityCoaching: vi.fn(() => []),
  generateInterventions: vi.fn(() => []),
}));

// i18n: passthrough — return key with params interpolated
vi.mock('@/lib/i18n', () => ({
  t: vi.fn((key: string, params?: Record<string, unknown>) => {
    // Resolve DQ element / axis keys to Korean labels (used across tests)
    const map: Record<string, string> = {
      'dq.element.appropriateFrame': '프레이밍',
      'dq.element.creativeAlternatives': '대안 탐색',
      'dq.element.relevantInformation': '정보 수집',
      'dq.element.clearValues': '관점 다양성',
      'dq.element.soundReasoning': '추론 품질',
      'dq.element.commitmentToAction': '실행 가능성',
      'axis.customerValue': '고객 가치',
      'axis.feasibility': '실현 가능성',
      'axis.business': '비즈니스',
      'axis.orgCapacity': '조직 역량',
      'navigator.defaultProject': '프로젝트',
    };
    let text = map[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
        text += ` ${k}=${v}`;
      }
    }
    return text;
  }),
  getCurrentLanguage: vi.fn(() => 'ko'),
}));

vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn(() => []),
  STORAGE_KEYS: {
    JUDGMENTS: 'sot_judgments',
    PROJECTS: 'sot_projects',
    ACCURACY_RATINGS: 'sot_accuracy_ratings',
    REFINE_LOOPS: 'sot_refine_loops',
    REFRAME_LIST: 'sot_reframe_list',
    RECAST_LIST: 'sot_recast_list',
    DQ_SCORES: 'sot_dq_scores',
    VITALITY_ASSESSMENTS: 'sot_vitality_assessments',
  },
}));

// Get mock references
import { getSessionInsights, getEvalSummary, analyzeStrategyPerformance } from '@/lib/eval-engine';
import { getWorstPerformingEvals } from '@/lib/prompt-mutation';
import { getStorage } from '@/lib/storage';
import { getDQScores, analyzeDQTrend } from '@/lib/decision-quality';

const mockGetSessionInsights = vi.mocked(getSessionInsights);
const mockGetEvalSummary = vi.mocked(getEvalSummary);
const mockAnalyzeStrategyPerformance = vi.mocked(analyzeStrategyPerformance);
const mockGetWorstPerformingEvals = vi.mocked(getWorstPerformingEvals);
const mockGetDQScores = vi.mocked(getDQScores);
const mockAnalyzeDQTrend = vi.mocked(analyzeDQTrend);
const mockGetStorage = vi.mocked(getStorage);

describe('navigator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildNavigatorProfile', () => {
    it('returns tier 1 for new users', () => {
      mockGetEvalSummary.mockReturnValue({
        total_sessions: 0,
        avg_pass_rate: 0,
        best_strategy: null,
        worst_eval: null,
      });
      mockGetStorage.mockReturnValue([]);
      mockAnalyzeStrategyPerformance.mockReturnValue([]);

      const profile = buildNavigatorProfile();
      expect(profile.tier).toBe(1);
      expect(profile.sessionCount).toBe(0);
      expect(profile.totalJudgments).toBe(0);
    });

    it('returns tier 2 for 3+ sessions', () => {
      mockGetEvalSummary.mockReturnValue({
        total_sessions: 5,
        avg_pass_rate: 0.7,
        best_strategy: 'redirect_angle',
        worst_eval: null,
      });
      mockGetStorage.mockImplementation((key: string) => {
        if (key === 'sot_judgments') return [
          { id: '1', user_changed: true, type: 'actor_override', decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
          { id: '2', user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
        ];
        if (key === 'sot_projects') return [{ id: 'p1', name: 'P1' }];
        return [];
      });
      mockAnalyzeStrategyPerformance.mockReturnValue([
        { strategy: 'redirect_angle', sample_count: 4, avg_pass_rate: 0.8, per_eval_pass_rates: {} },
      ]);

      const profile = buildNavigatorProfile();
      expect(profile.tier).toBe(2);
      expect(profile.sessionCount).toBe(5);
      expect(profile.dominantStrategy).toBe('redirect_angle');
      expect(profile.overrideRate).toBe(0.5);
    });

    it('returns tier 3 for 10+ sessions and 2+ projects', () => {
      mockGetEvalSummary.mockReturnValue({
        total_sessions: 12,
        avg_pass_rate: 0.8,
        best_strategy: 'diagnose_root',
        worst_eval: null,
      });
      mockGetStorage.mockImplementation((key: string) => {
        if (key === 'sot_judgments') return [];
        if (key === 'sot_projects') return [{ id: 'p1' }, { id: 'p2' }];
        return [];
      });
      mockAnalyzeStrategyPerformance.mockReturnValue([
        { strategy: 'diagnose_root', sample_count: 8, avg_pass_rate: 0.85, per_eval_pass_rates: {} },
      ]);

      const profile = buildNavigatorProfile();
      expect(profile.tier).toBe(3);
    });
  });

  describe('buildNavigatorInsights', () => {
    it('returns empty for tier 1 with no history', () => {
      mockGetSessionInsights.mockReturnValue([]);
      mockGetStorage.mockReturnValue([]);
      mockGetWorstPerformingEvals.mockReturnValue([]);

      const profile: NavigatorProfile = {
        sessionCount: 0, projectCount: 0, totalJudgments: 0,
        overrideRate: 0, dominantStrategy: null, avgPassRate: 0, tier: 1,
      };

      const insights = buildNavigatorInsights(profile);
      expect(insights).toHaveLength(0);
    });

    it('includes session insights at tier 1', () => {
      mockGetSessionInsights.mockReturnValue([
        { type: 'last_strategy', message: '지난 분석에서 "관점 전환" 접근이 효과적이었습니다.' },
      ]);
      mockGetStorage.mockReturnValue([]);
      mockGetWorstPerformingEvals.mockReturnValue([]);

      const profile: NavigatorProfile = {
        sessionCount: 1, projectCount: 1, totalJudgments: 0,
        overrideRate: 0, dominantStrategy: null, avgPassRate: 0.5, tier: 1,
      };

      const insights = buildNavigatorInsights(profile);
      expect(insights.length).toBeGreaterThanOrEqual(1);
      expect(insights[0].category).toBe('pattern');
    });

    it('includes eval coaching at tier 2', () => {
      mockGetSessionInsights.mockReturnValue([]);
      mockGetEvalSummary.mockReturnValue({
        total_sessions: 5, avg_pass_rate: 0.6, best_strategy: null, worst_eval: 'assumptions_engaged',
      });
      mockGetWorstPerformingEvals.mockReturnValue([
        { evalId: 'assumptions_engaged', instruction: '전제를 더 적극적으로 찾으세요', passRate: 0.3 },
      ]);
      mockGetStorage.mockReturnValue([]);

      const profile: NavigatorProfile = {
        sessionCount: 5, projectCount: 1, totalJudgments: 5,
        overrideRate: 0.2, dominantStrategy: null, avgPassRate: 0.6, tier: 2,
      };

      const insights = buildNavigatorInsights(profile);
      const coaching = insights.filter((i) => i.category === 'coaching');
      expect(coaching.length).toBeGreaterThanOrEqual(1);
    });

    it('includes cross-project insights at tier 3', () => {
      mockGetSessionInsights.mockReturnValue([]);
      mockGetEvalSummary.mockReturnValue({
        total_sessions: 12, avg_pass_rate: 0.8, best_strategy: 'redirect_angle', worst_eval: null,
      });
      mockGetWorstPerformingEvals.mockReturnValue([]);
      mockAnalyzeStrategyPerformance.mockReturnValue([
        { strategy: 'redirect_angle', sample_count: 5, avg_pass_rate: 0.9, per_eval_pass_rates: {} },
        { strategy: 'diagnose_root', sample_count: 4, avg_pass_rate: 0.6, per_eval_pass_rates: {} },
      ]);
      mockGetStorage.mockImplementation((key: string) => {
        if (key === 'sot_projects') return [
          { id: 'p1', name: '프로젝트A', meta_reflection: { surprising_discovery: '시장이 예상보다 성숙했다' } },
        ];
        return [];
      });

      const profile: NavigatorProfile = {
        sessionCount: 12, projectCount: 3, totalJudgments: 10,
        overrideRate: 0.3, dominantStrategy: 'redirect_angle', avgPassRate: 0.8, tier: 3,
      };

      const insights = buildNavigatorInsights(profile);
      const growth = insights.filter((i) => i.category === 'growth');
      expect(growth.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getStepCoaching', () => {
    it('returns generic counterfactual for reframe with 0 sessions and no demo', () => {
      mockGetSessionInsights.mockReturnValue([]);
      mockGetWorstPerformingEvals.mockReturnValue([]);

      const profile: NavigatorProfile = {
        sessionCount: 0, projectCount: 0, totalJudgments: 0,
        overrideRate: 0, dominantStrategy: null, avgPassRate: 0, tier: 1,
      };

      const coaching = getStepCoaching('reframe', profile);
      expect(Array.isArray(coaching)).toBe(true);
      expect(coaching.length).toBeGreaterThan(0);
      expect(coaching[0].message).toContain('coaching.reframe.firstUse');
      expect(coaching[0].tone).toBe('counterfactual');
    });

    it('returns personalized coaching for reframe when demo seed exists (all doubted)', () => {
      const profile: NavigatorProfile = {
        sessionCount: 0, projectCount: 0, totalJudgments: 0,
        overrideRate: 0, dominantStrategy: null, avgPassRate: 0, tier: 1,
        demoSeedData: { doubted_count: 3, total_premises: 3, ai_only_steps: 1, human_only_steps: 1, total_steps: 4, completed: true },
      };

      const coaching = getStepCoaching('reframe', profile);
      expect(coaching[0].message).toContain('coaching.reframe.demoAllDoubted');
      expect(coaching[0].tone).toBe('positive');
    });

    it('returns challenge coaching for reframe when demo seed shows zero doubts', () => {
      const profile: NavigatorProfile = {
        sessionCount: 0, projectCount: 0, totalJudgments: 0,
        overrideRate: 0, dominantStrategy: null, avgPassRate: 0, tier: 1,
        demoSeedData: { doubted_count: 0, total_premises: 3, ai_only_steps: 0, human_only_steps: 0, total_steps: 4, completed: true },
      };

      const coaching = getStepCoaching('reframe', profile);
      expect(coaching[0].message).toContain('coaching.reframe.demoAllAccepted');
      expect(coaching[0].tone).toBe('challenge');
    });

    it('returns personalized recast coaching when demo seed shows heavy AI delegation', () => {
      mockGetStorage.mockReturnValue([]);
      const profile: NavigatorProfile = {
        sessionCount: 0, projectCount: 0, totalJudgments: 0,
        overrideRate: 0, dominantStrategy: null, avgPassRate: 0, tier: 1,
        demoSeedData: { doubted_count: 1, total_premises: 3, ai_only_steps: 3, human_only_steps: 0, total_steps: 4, completed: true },
      };

      const coaching = getStepCoaching('recast', profile);
      expect(coaching[0].message).toContain('coaching.recast.demoAiHeavy');
      expect(coaching[0].tone).toBe('challenge');
    });

    it('returns override coaching for recast', () => {
      mockGetStorage.mockReturnValue([
        { id: '1', type: 'actor_override', user_changed: true, decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
        { id: '2', type: 'actor_override', user_changed: true, decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
        { id: '3', type: 'actor_override', user_changed: true, decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
      ]);

      const profile: NavigatorProfile = {
        sessionCount: 5, projectCount: 1, totalJudgments: 5,
        overrideRate: 0.5, dominantStrategy: null, avgPassRate: 0.6, tier: 2,
      };

      const coaching = getStepCoaching('recast', profile);
      expect(coaching.length).toBeGreaterThan(0);
      expect(coaching[0].message).toContain('coaching.recast.overrideHigh');
    });

    it('returns empty array for recast with few judgments and no cross-stage data', () => {
      mockGetStorage.mockReturnValue([]);

      const profile: NavigatorProfile = {
        sessionCount: 1, projectCount: 1, totalJudgments: 1,
        overrideRate: 0, dominantStrategy: null, avgPassRate: 0, tier: 1,
      };

      const coaching = getStepCoaching('recast', profile);
      expect(coaching).toEqual([]);
    });

    it('returns persona accuracy coaching when ratings exist', () => {
      mockGetStorage.mockImplementation((key: string) => {
        if (key === 'sot_accuracy_ratings') return [
          {
            id: 'r1', persona_id: 'p1', accuracy_score: 3.5,
            which_aspects_accurate: ['톤', '관점'],
            which_aspects_inaccurate: ['깊이'],
            created_at: '',
          },
          {
            id: 'r2', persona_id: 'p1', accuracy_score: 4.0,
            which_aspects_accurate: ['톤'],
            which_aspects_inaccurate: ['깊이', '현실성'],
            created_at: '',
          },
        ];
        return [];
      });

      const profile: NavigatorProfile = {
        sessionCount: 5, projectCount: 1, totalJudgments: 5,
        overrideRate: 0.2, dominantStrategy: null, avgPassRate: 0.7, tier: 2,
      };

      const coaching = getStepCoaching('rehearse', profile);
      expect(coaching.length).toBeGreaterThan(0);
      const accuracyMsg = coaching.find(c => c.message.includes('coaching.rehearse.personaAccuracy'));
      expect(accuracyMsg).toBeDefined();
    });

    it('returns at most 2 coaching items', () => {
      // Tier 2 user with strategy pattern + assumption failure + high pass rate
      mockGetSessionInsights.mockReturnValue([
        { type: 'pattern', message: '관점 전환 패턴' },
      ]);
      mockGetWorstPerformingEvals.mockReturnValue([
        { evalId: 'assumptions_engaged', instruction: '전제를 찾으세요', passRate: 0.2 },
      ]);
      mockGetStorage.mockReturnValue([]);

      const profile: NavigatorProfile = {
        sessionCount: 8, projectCount: 1, totalJudgments: 10,
        overrideRate: 0.2, dominantStrategy: 'redirect_angle', avgPassRate: 0.8, tier: 2,
      };

      const coaching = getStepCoaching('reframe', profile);
      expect(coaching.length).toBeLessThanOrEqual(2);
    });
  });

  describe('buildLearningCurve', () => {
    it('returns has_data: false when no DQ scores', () => {
      mockGetDQScores.mockReturnValue([]);
      mockAnalyzeDQTrend.mockReturnValue({
        total_projects: 0, avg_dq: 0, trend: 'not_enough_data',
        weakest_element: null, strongest_element: null, avg_blind_spots: 0, framing_challenge_rate: 0,
      });
      mockGetStorage.mockReturnValue([]);
      mockAnalyzeStrategyPerformance.mockReturnValue([]);
      mockGetEvalSummary.mockReturnValue({
        total_sessions: 0, avg_pass_rate: 0, best_strategy: null, worst_eval: null,
      });

      const curve = buildLearningCurve();
      expect(curve.has_data).toBe(false);
      expect(curve.dq_points).toHaveLength(0);
      expect(curve.most_improved_element).toBeNull();
    });

    it('computes element trends from DQ scores', () => {
      const scores = [
        { project_id: 'p1', appropriate_frame: 2, creative_alternatives: 3, relevant_information: 2, clear_values: 1, sound_reasoning: 1, commitment_to_action: 2, overall_dq: 37, created_at: '2026-01-01', initial_framing_challenged: false, blind_spots_surfaced: 0, user_changed_mind: false, id: 's1' },
        { project_id: 'p2', appropriate_frame: 4, creative_alternatives: 3, relevant_information: 3, clear_values: 3, sound_reasoning: 3, commitment_to_action: 3, overall_dq: 63, created_at: '2026-02-01', initial_framing_challenged: true, blind_spots_surfaced: 2, user_changed_mind: true, id: 's2' },
      ];
      mockGetDQScores.mockReturnValue(scores);
      mockAnalyzeDQTrend.mockReturnValue({
        total_projects: 2, avg_dq: 50, trend: 'improving',
        weakest_element: '관점 다양성', strongest_element: '프레이밍', avg_blind_spots: 1, framing_challenge_rate: 50,
      });
      mockGetStorage.mockImplementation((key: string) => {
        if (key === 'sot_projects') return [
          { id: 'p1', name: '프로젝트A', refs: [] },
          { id: 'p2', name: '프로젝트B', refs: [] },
        ];
        return [];
      });
      mockAnalyzeStrategyPerformance.mockReturnValue([]);
      mockGetEvalSummary.mockReturnValue({
        total_sessions: 2, avg_pass_rate: 0.5, best_strategy: null, worst_eval: null,
      });

      const curve = buildLearningCurve();
      expect(curve.has_data).toBe(true);
      expect(curve.dq_points).toHaveLength(2);
      expect(curve.dq_points[0].project_name).toBe('프로젝트A');
      expect(curve.dq_points[1].overall_dq).toBe(63);
      expect(curve.trend).toBe('improving');
      expect(curve.most_improved_element).toBe('프레이밍'); // 2 → 4 = +2, biggest gain
      expect(curve.improvement_delta).toBe(2);
    });

    it('identifies axis gap from assumption data', () => {
      mockGetDQScores.mockReturnValue([]);
      mockAnalyzeDQTrend.mockReturnValue({
        total_projects: 0, avg_dq: 0, trend: 'not_enough_data',
        weakest_element: null, strongest_element: null, avg_blind_spots: 0, framing_challenge_rate: 0,
      });
      mockGetStorage.mockImplementation((key: string) => {
        if (key === 'sot_reframe_list') return [
          {
            id: 'd1', status: 'done',
            analysis: {
              hidden_assumptions: [
                { assumption: 'a', axis: 'customer_value', risk_if_false: 'r' },
                { assumption: 'b', axis: 'customer_value', risk_if_false: 'r' },
                { assumption: 'c', axis: 'customer_value', risk_if_false: 'r' },
                { assumption: 'd', axis: 'business', risk_if_false: 'r' },
                { assumption: 'e', axis: 'business', risk_if_false: 'r' },
                { assumption: 'f', axis: 'business', risk_if_false: 'r' },
                { assumption: 'g', axis: 'feasibility', risk_if_false: 'r' },
                { assumption: 'h', axis: 'feasibility', risk_if_false: 'r' },
                // 8 assumptions, No org_capacity → should be the gap
              ],
            },
          },
        ];
        return [];
      });
      mockAnalyzeStrategyPerformance.mockReturnValue([]);
      mockGetEvalSummary.mockReturnValue({
        total_sessions: 3, avg_pass_rate: 0.5, best_strategy: null, worst_eval: null,
      });

      const curve = buildLearningCurve();
      expect(curve.axis_gap).toBe('조직 역량');
      expect(curve.axis_coverage['조직 역량']).toBe(0);
      expect(curve.axis_coverage['고객 가치']).toBe(38); // 3/8 = 37.5 → 38
    });

    it('computes tier progress correctly', () => {
      mockGetDQScores.mockReturnValue([]);
      mockAnalyzeDQTrend.mockReturnValue({
        total_projects: 0, avg_dq: 0, trend: 'not_enough_data',
        weakest_element: null, strongest_element: null, avg_blind_spots: 0, framing_challenge_rate: 0,
      });
      mockGetStorage.mockReturnValue([]);
      mockAnalyzeStrategyPerformance.mockReturnValue([]);

      // Tier 1 with 1/2 sessions → 50% progress toward tier 2 (threshold is now 2)
      mockGetEvalSummary.mockReturnValue({
        total_sessions: 1, avg_pass_rate: 0.5, best_strategy: null, worst_eval: null,
      });
      const curve = buildLearningCurve();
      expect(curve.current_tier).toBe(1);
      expect(curve.tier_progress).toBe(50);
    });
  });
});
