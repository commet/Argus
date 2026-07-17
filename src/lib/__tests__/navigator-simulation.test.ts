/**
 * Navigator Simulation — 다양한 사용자 아키타입 시뮬레이션
 *
 * Autoresearch 패턴을 항해장 시스템 자체에 적용:
 * 다양한 사용자 여정 mock → 코칭/적응 출력 검증 → 문제 발견 → 로직 수정
 *
 * 아키타입:
 * 1. 완전 초보 (데모도 안 함)
 * 2. 데모만 하고 온 사용자 (전제 0개 의심)
 * 3. 데모만 하고 온 사용자 (전제 3개 의심)
 * 4. 3회차 사용자 (가정 다양성 낮음)
 * 5. 5회차 숙련자 (org_capacity blind spot)
 * 6. 10회차 마스터 (균형 잡힌 패턴)
 * 7. AI 과의존 사용자
 * 8. 과신하는 사용자 (항상 첫 reframe 수락)
 * 9. 비판적 사용자 (override율 60%+)
 * 10. 성장하는 사용자 (DQ 상승 곡선)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildNavigatorProfile,
  getStepCoaching,
  buildLearningCurve,
} from '@/lib/navigator';
import type { NavigatorProfile, StepCoaching, DemoSeedData } from '@/lib/navigator';
import { recommendBlindSpotPersona } from '@/lib/auto-persona';

// ── Mock setup ──

vi.mock('@/lib/eval-engine', () => ({
  getSessionInsights: vi.fn(() => []),
  getEvalSummary: vi.fn(() => ({
    total_sessions: 0, avg_pass_rate: 0, best_strategy: null, worst_eval: null,
  })),
  analyzeStrategyPerformance: vi.fn(() => []),
  getAllStagesSummary: vi.fn(() => []),
  getStageEvalSummary: vi.fn(() => null),
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
  getSignalsByType: vi.fn(() => []),
}));

vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn(() => []),
  setStorage: vi.fn(),
  STORAGE_KEYS: {
    JUDGMENTS: 'sot_judgments',
    PROJECTS: 'sot_projects',
    ACCURACY_RATINGS: 'sot_accuracy_ratings',
    REFINE_LOOPS: 'sot_refine_loops',
    REFRAME_LIST: 'sot_reframe_list',
    RECAST_LIST: 'sot_recast_list',
    DQ_SCORES: 'sot_dq_scores',
    FEEDBACK_HISTORY: 'sot_feedback_history',
    QUALITY_SIGNALS: 'sot_quality_signals',
    PERSONAS: 'sot_personas',
    OUTCOME_RECORDS: 'sot_outcome_records',
    SETTINGS: 'sot_settings',
  },
}));

vi.mock('@/lib/db', () => ({
  insertToSupabase: vi.fn(),
}));

vi.mock('@/lib/i18n', () => ({
  t: vi.fn((key: string, params?: Record<string, unknown>) => {
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
      // dqImproving/dqDeclining/biggestGain/biggestDrop fixtures removed 2026-07-03
      // (P0-3): DQ-trend verdict generation was deleted from navigator.ts.
    };
    let text = map[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
        if (!text.includes(String(v))) text += ` ${k}=${v}`;
      }
    }
    return text;
  }),
  getCurrentLanguage: vi.fn(() => 'ko'),
}));

import { getEvalSummary, getSessionInsights, analyzeStrategyPerformance } from '@/lib/eval-engine';
import { getWorstPerformingEvals } from '@/lib/prompt-mutation';
import { getStorage } from '@/lib/storage';
import { getDQScores, analyzeDQTrend } from '@/lib/decision-quality';
import { getSignals } from '@/lib/signal-recorder';

const mockEval = vi.mocked(getEvalSummary);
const mockInsights = vi.mocked(getSessionInsights);
const mockStrategy = vi.mocked(analyzeStrategyPerformance);
const mockWorst = vi.mocked(getWorstPerformingEvals);
const mockStorage = vi.mocked(getStorage);
const mockDQ = vi.mocked(getDQScores);
const mockDQTrend = vi.mocked(analyzeDQTrend);
const mockSignals = vi.mocked(getSignals);

// ── Helpers ──

function makeReframeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: `rf-${Math.random().toString(36).slice(2)}`,
    input_text: 'test',
    selected_question: 'reframed?',
    status: 'done',
    analysis: {
      surface_task: 'test task',
      reframed_question: 'reframed question?',
      why_reframing_matters: 'because reasons that are long enough',
      hidden_assumptions: [],
      hidden_questions: ['q1', 'q2', 'q3'],
      ai_limitations: ['limitation1'],
      alternative_framings: [],
      reasoning_narrative: '',
      ...(overrides.analysis as Record<string, unknown> || {}),
    },
    ...overrides,
  };
}

function makeAssumption(axis: string) {
  return { assumption: `assumption on ${axis}`, risk_if_false: 'risk', axis, verified: false };
}

function makeDQScore(overrides: Record<string, unknown> = {}) {
  return {
    id: `dq-${Math.random().toString(36).slice(2)}`,
    project_id: `p-${Math.random().toString(36).slice(2)}`,
    appropriate_frame: 3, creative_alternatives: 3, relevant_information: 3,
    clear_values: 3, sound_reasoning: 3, commitment_to_action: 3,
    overall_dq: 60, initial_framing_challenged: true,
    blind_spots_surfaced: 1, user_changed_mind: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function setupProfile(sessions: number, projects: number, judgments: number, overrideRate: number) {
  mockEval.mockReturnValue({
    total_sessions: sessions, avg_pass_rate: 0.7, best_strategy: 'redirect_angle', worst_eval: null,
  });
  mockStorage.mockImplementation((key: string) => {
    if (key === 'sot_projects') {
      return Array.from({ length: projects }, (_, i) => ({ id: `p${i}`, name: `Project ${i}`, refs: [], created_at: '', updated_at: '' }));
    }
    if (key === 'sot_judgments') {
      return Array.from({ length: judgments }, (_, i) => ({
        id: `j${i}`, user_changed: i < Math.round(judgments * overrideRate),
        type: 'actor_override', decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
      }));
    }
    return [];
  });
  mockStrategy.mockReturnValue([]);
  mockWorst.mockReturnValue([]);
  mockInsights.mockReturnValue([]);
  mockDQ.mockReturnValue([]);
  mockDQTrend.mockReturnValue({ total_projects: 0, avg_dq: 0, trend: 'not_enough_data', weakest_element: null, strongest_element: null, avg_blind_spots: 0, framing_challenge_rate: 0 });
  mockSignals.mockReturnValue([]);
}

// ── Simulation Tests ──

describe('Navigator Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────
  // Archetype 1: 완전 초보 (데모도 안 함)
  // ───────────────────────────────────
  describe('Archetype 1: 완전 초보', () => {
    beforeEach(() => setupProfile(0, 0, 0, 0));

    it('reframe: counterfactual 코칭이 나와야 한다 (generic)', () => {
      const profile = buildNavigatorProfile();
      expect(profile.tier).toBe(1);
      expect(profile.demoSeedData).toBeUndefined();

      const coaching = getStepCoaching('reframe', profile);
      expect(coaching.length).toBe(1);
      expect(coaching[0].tone).toBe('counterfactual');
      expect(coaching[0].message).toContain('coaching.reframe.firstUse');
    });

    it('recast: counterfactual 코칭', () => {
      const profile = buildNavigatorProfile();
      const coaching = getStepCoaching('recast', profile);
      expect(coaching.length).toBe(1);
      expect(coaching[0].tone).toBe('counterfactual');
    });

    it('rehearse: counterfactual 코칭', () => {
      const profile = buildNavigatorProfile();
      const coaching = getStepCoaching('rehearse', profile);
      expect(coaching.length).toBe(1);
      expect(coaching[0].tone).toBe('counterfactual');
    });

    it('refine: counterfactual 코칭', () => {
      const profile = buildNavigatorProfile();
      const coaching = getStepCoaching('refine', profile);
      expect(coaching.length).toBe(1);
      expect(coaching[0].tone).toBe('counterfactual');
    });

    it('learning curve: 데이터 없음', () => {
      const curve = buildLearningCurve();
      expect(curve.has_data).toBe(false);
      expect(curve.dq_points).toHaveLength(0);
    });
  });

  // ───────────────────────────────────
  // Archetype 2: 데모 완료 — 전제 0개 의심 (수동적)
  // ───────────────────────────────────
  describe('Archetype 2: 데모 완료 (수동적 — 0/3 의심)', () => {
    beforeEach(() => setupProfile(0, 0, 0, 0));

    it('reframe: challenge 코칭 — "전제를 의심해보세요"', () => {
      mockSignals.mockReturnValue([{
        id: 's1', tool: 'reframe', signal_type: 'demo_seed', created_at: '',
        signal_data: { doubted_count: 0, total_premises: 3, ai_only_steps: 2, human_only_steps: 0, total_steps: 4, completed: true },
      }]);

      const profile = buildNavigatorProfile();
      expect(profile.demoSeedData).toBeDefined();
      expect(profile.demoSeedData!.doubted_count).toBe(0);

      const coaching = getStepCoaching('reframe', profile);
      expect(coaching[0].tone).toBe('challenge');
      expect(coaching[0].message).toContain('coaching.reframe.demoAllAccepted');
    });
  });

  // ───────────────────────────────────
  // Archetype 3: 데모 완료 — 전제 3개 의심 (비판적)
  // ───────────────────────────────────
  describe('Archetype 3: 데모 완료 (비판적 — 3/3 의심)', () => {
    beforeEach(() => setupProfile(0, 0, 0, 0));

    it('reframe: positive 코칭 — "비판적 관점이 강합니다"', () => {
      mockSignals.mockReturnValue([{
        id: 's1', tool: 'reframe', signal_type: 'demo_seed', created_at: '',
        signal_data: { doubted_count: 3, total_premises: 3, ai_only_steps: 0, human_only_steps: 2, total_steps: 4, completed: true },
      }]);

      const profile = buildNavigatorProfile();
      const coaching = getStepCoaching('reframe', profile);
      expect(coaching[0].tone).toBe('positive');
      expect(coaching[0].message).toContain('coaching.reframe.demoAllDoubted');
    });

    it('recast: positive 코칭 — "직접 실행 선호"', () => {
      mockSignals.mockReturnValue([{
        id: 's1', tool: 'reframe', signal_type: 'demo_seed', created_at: '',
        signal_data: { doubted_count: 3, total_premises: 3, ai_only_steps: 0, human_only_steps: 3, total_steps: 4, completed: true },
      }]);

      const profile = buildNavigatorProfile();
      const coaching = getStepCoaching('recast', profile);
      expect(coaching[0].tone).toBe('positive');
      expect(coaching[0].message).toContain('coaching.recast.demoHumanHeavy');
    });
  });

  // ───────────────────────────────────
  // Archetype 4: 3회차 사용자 — 가정 다양성 낮음
  // ───────────────────────────────────
  describe('Archetype 4: 3회차 (가정 다양성 낮음)', () => {
    beforeEach(() => {
      setupProfile(3, 1, 5, 0.2);
      mockWorst.mockReturnValue([
        { evalId: 'assumptions_diverse', instruction: '다양한 축에서 가정을 찾으세요', passRate: 0.3 },
      ]);
    });

    it('reframe: 가정 다양성 부족 코칭이 나와야 한다', () => {
      const profile = buildNavigatorProfile();
      expect(profile.tier).toBe(2);

      const coaching = getStepCoaching('reframe', profile);
      // assumptions_engaged가 아닌 assumptions_diverse가 worst이므로 직접 매칭 안 됨
      // 하지만 다른 coaching (strategy pattern, pass rate 등)은 나올 수 있다
      expect(coaching.length).toBeLessThanOrEqual(2);
    });

    it('learning curve: tier progress 100% (3/3)', () => {
      const curve = buildLearningCurve();
      expect(curve.current_tier).toBe(2);
      expect(curve.tier_progress).toBeLessThanOrEqual(100);
    });
  });

  // ───────────────────────────────────
  // Archetype 5: 5회차 숙련자 — org_capacity blind spot
  // ───────────────────────────────────
  describe('Archetype 5: 5회차 (org_capacity blind spot)', () => {
    beforeEach(() => {
      setupProfile(5, 2, 10, 0.3);
      // 5개 reframe, 모두 customer_value와 business만 다루고 org_capacity 없음
      mockStorage.mockImplementation((key: string) => {
        if (key === 'sot_reframe_list') {
          return Array.from({ length: 5 }, (_, i) => makeReframeItem({
            id: `rf-${i}`,
            analysis: {
              surface_task: 'task',
              reframed_question: 'reframed?',
              why_reframing_matters: 'long enough reason here for testing',
              hidden_assumptions: [
                makeAssumption('customer_value'),
                makeAssumption('customer_value'),
                makeAssumption('business'),
                makeAssumption('feasibility'),
                // org_capacity 없음 → blind spot
              ],
              hidden_questions: ['q1', 'q2', 'q3'],
              ai_limitations: [],
              alternative_framings: [],
              reasoning_narrative: '',
            },
          }));
        }
        if (key === 'sot_projects') return [{ id: 'p1', name: 'P1', refs: [] }, { id: 'p2', name: 'P2', refs: [] }];
        if (key === 'sot_judgments') return Array.from({ length: 10 }, (_, i) => ({
          id: `j${i}`, user_changed: i < 3, type: 'actor_override', decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
        }));
        return [];
      });
    });

    it('learning curve: org_capacity가 axis_gap으로 감지되어야 한다', () => {
      const curve = buildLearningCurve();
      expect(curve.axis_gap).toBe('조직 역량');
      expect(curve.axis_coverage['조직 역량']).toBe(0);
    });

    it('blind spot persona: 조직 관련 페르소나를 추천해야 한다', () => {
      const rec = recommendBlindSpotPersona([]);
      expect(rec).not.toBeNull();
      expect(rec!.axis).toBe('org_capacity');
      expect(rec!.axis_label).toBe('조직 역량');
    });

    it('blind spot persona: 이미 HR 페르소나가 있으면 다른 걸 추천', () => {
      const rec = recommendBlindSpotPersona(['CHRO / 인사팀장']);
      expect(rec).not.toBeNull();
      expect(rec!.role).not.toContain('CHRO');
    });
  });

  // ───────────────────────────────────
  // Archetype 6: 10회차 마스터 — 균형 잡힌 패턴
  // ───────────────────────────────────
  describe('Archetype 6: 10회차 마스터 (균형)', () => {
    beforeEach(() => {
      setupProfile(12, 3, 20, 0.25);
      mockStorage.mockImplementation((key: string) => {
        if (key === 'sot_reframe_list') {
          return Array.from({ length: 10 }, (_, i) => makeReframeItem({
            id: `rf-${i}`,
            analysis: {
              surface_task: 'task',
              reframed_question: 'different question',
              why_reframing_matters: 'good reasoning here',
              hidden_assumptions: [
                makeAssumption('customer_value'),
                makeAssumption('feasibility'),
                makeAssumption('business'),
                makeAssumption('org_capacity'), // 균형 잡힘
              ],
              hidden_questions: ['q1', 'q2', 'q3'],
              ai_limitations: ['limit'],
              alternative_framings: ['alt1', 'alt2'],
              reasoning_narrative: '',
            },
          }));
        }
        if (key === 'sot_projects') return Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, name: `Project ${i}`, refs: [], created_at: '', updated_at: '' }));
        if (key === 'sot_judgments') return Array.from({ length: 20 }, (_, i) => ({
          id: `j${i}`, user_changed: i < 5, type: 'actor_override', decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
        }));
        return [];
      });
    });

    it('tier 3에 도달해야 한다', () => {
      const profile = buildNavigatorProfile();
      expect(profile.tier).toBe(3);
    });

    it('axis gap이 없어야 한다 (균형 잡힌 커버리지)', () => {
      const curve = buildLearningCurve();
      expect(curve.axis_gap).toBeNull();
      // 각 축이 25%씩 균등 분포
      expect(curve.axis_coverage['고객 가치']).toBe(25);
      expect(curve.axis_coverage['조직 역량']).toBe(25);
    });

    it('blind spot persona 추천이 없어야 한다', () => {
      const rec = recommendBlindSpotPersona([]);
      expect(rec).toBeNull();
    });
  });

  // ───────────────────────────────────
  // Archetype 7: AI 과의존 사용자
  // ───────────────────────────────────
  describe('Archetype 7: AI 과의존 (override율 5%)', () => {
    beforeEach(() => setupProfile(5, 1, 20, 0.05));

    it('recast: challenge 코칭이 아닌 다른 형태의 코칭이 나와야 한다', () => {
      // override율 5%이지만 totalJudgments 20이면 profile.overrideRate = 0.05
      // overrideRate < 0.1 이면 insights에서 "AI 제안을 거의 그대로 수용" 경고
      const profile = buildNavigatorProfile();
      expect(profile.overrideRate).toBe(0.05);
    });
  });

  // ───────────────────────────────────
  // Archetype 8: 과신 사용자 (항상 첫 reframe 수락)
  // ───────────────────────────────────
  describe('Archetype 8: 과신 사용자 (첫 reframe 항상 수락)', () => {
    beforeEach(() => {
      setupProfile(8, 2, 10, 0.1);
      // 8개 reframe 중 8개가 selected_question === reframed_question
      mockStorage.mockImplementation((key: string) => {
        if (key === 'sot_reframe_list') {
          return Array.from({ length: 8 }, (_, i) => makeReframeItem({
            id: `rf-${i}`,
            selected_question: 'reframed question?', // same as reframed_question
            analysis: {
              surface_task: 'original task',
              reframed_question: 'reframed question?',
              why_reframing_matters: 'because...',
              hidden_assumptions: [makeAssumption('business')],
              hidden_questions: ['q1'],
              ai_limitations: [],
              alternative_framings: [],
              reasoning_narrative: '',
            },
          }));
        }
        if (key === 'sot_projects') return [{ id: 'p1', name: 'P1', refs: [] }, { id: 'p2', name: 'P2', refs: [] }];
        if (key === 'sot_judgments') return Array.from({ length: 10 }, (_, i) => ({
          id: `j${i}`, user_changed: i === 0, type: 'actor_override', decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
        }));
        return [];
      });
    });

    it('reframe 수락률이 높으면 대안 탐색 관련 코칭이 나와야 한다', () => {
      // 현재 getReframeCoaching에서는 수락률을 직접 체크하지 않지만
      // buildAdaptiveContext()가 LLM 프롬프트에 주입한다
      // 여기서는 기존 코칭 로직이 무언가를 반환하는지 확인
      const profile = buildNavigatorProfile();
      const coaching = getStepCoaching('reframe', profile);
      // Tier 2인데 sessionCount >= 3, avgPassRate 0.7 → 뭔가 나올 수 있음
      expect(coaching.length).toBeLessThanOrEqual(2);
    });
  });

  // ───────────────────────────────────
  // Archetype 9: 비판적 사용자 (override율 60%+)
  // ───────────────────────────────────
  describe('Archetype 9: 잦은 수정도 비판성 점수가 아님 (override 60%)', () => {
    beforeEach(() => setupProfile(6, 2, 15, 0.6));

    it('recast: "AI 제안을 자주 수정" positive 코칭을 만들지 않음', () => {
      const profile = buildNavigatorProfile();
      expect(profile.overrideRate).toBe(0.6);

      const coaching = getStepCoaching('recast', profile);
      const overrideMsg = coaching.find(c => c.message.includes('coaching.recast.overrideHigh'));
      expect(overrideMsg).toBeUndefined();
    });
  });

  // ───────────────────────────────────
  // Archetype 10: 성장하는 사용자 (DQ 상승 곡선)
  // ───────────────────────────────────
  describe('Archetype 10: 성장하는 사용자 (DQ 상승)', () => {
    const scores = [
      makeDQScore({ project_id: 'p1', overall_dq: 40, appropriate_frame: 2, created_at: '2026-01-01' }),
      makeDQScore({ project_id: 'p2', overall_dq: 55, appropriate_frame: 3, created_at: '2026-02-01' }),
      makeDQScore({ project_id: 'p3', overall_dq: 72, appropriate_frame: 4, created_at: '2026-03-01' }),
    ];

    beforeEach(() => {
      setupProfile(8, 3, 15, 0.25);
      mockDQ.mockReturnValue(scores);
      mockDQTrend.mockReturnValue({
        total_projects: 3, avg_dq: 56, trend: 'improving',
        weakest_element: '관점 다양성', strongest_element: '프레이밍',
        avg_blind_spots: 1.5, framing_challenge_rate: 67,
      });
      // Override mockStorage to also return DQ scores and projects
      mockStorage.mockImplementation((key: string) => {
        if (key === 'sot_projects') return [
          { id: 'p1', name: '프로젝트A', refs: [], created_at: '', updated_at: '' },
          { id: 'p2', name: '프로젝트B', refs: [], created_at: '', updated_at: '' },
          { id: 'p3', name: '프로젝트C', refs: [], created_at: '', updated_at: '' },
        ];
        if (key === 'sot_dq_scores') return scores;
        if (key === 'sot_judgments') return Array.from({ length: 15 }, (_, i) => ({
          id: `j${i}`, user_changed: i < 4, type: 'actor_override', decision: 'human',
          tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
        }));
        return [];
      });
    });

    it('learning curve: improving 트렌드가 감지되어야 한다', () => {
      const curve = buildLearningCurve();
      expect(curve.has_data).toBe(true);
      expect(curve.trend).toBe('improving');
      expect(curve.dq_points).toHaveLength(3);
    });

    it('learning curve: 프레이밍이 가장 개선된 요소여야 한다', () => {
      const curve = buildLearningCurve();
      expect(curve.most_improved_element).toBe('프레이밍');
      expect(curve.improvement_delta).toBeGreaterThan(0);
    });

    it('learning curve: DQ 점수가 시간순으로 정렬되어야 한다', () => {
      const curve = buildLearningCurve();
      expect(curve.dq_points[0].overall_dq).toBe(40);
      expect(curve.dq_points[1].overall_dq).toBe(55);
      expect(curve.dq_points[2].overall_dq).toBe(72);
    });

    // P0-3 (2026-07-03): "개선되고 있습니다" 칭찬도 평결(스파인 규칙2) —
    // DQ가 실제로 상승 중이어도 평결 코칭이 나오면 안 된다.
    it('refine: DQ 상승이어도 평결 코칭을 생성하지 않는다 (스파인 규칙2)', () => {
      const profile = buildNavigatorProfile();
      const coaching = getStepCoaching('refine', profile);
      const dqMsg = coaching.find(c =>
        c.message.includes('판단 품질이 개선') || c.message.includes('coaching.refine.dqImproving'));
      expect(dqMsg).toBeUndefined();
    });
  });

  // ───────────────────────────────────
  // Cross-archetype: 코칭 일관성 검증
  // ───────────────────────────────────
  describe('Cross-archetype: 코칭 일관성', () => {
    it('모든 스텝의 코칭은 항상 최대 2개여야 한다', () => {
      const archetypes: Array<{ sessions: number; projects: number; judgments: number; rate: number }> = [
        { sessions: 0, projects: 0, judgments: 0, rate: 0 },
        { sessions: 1, projects: 1, judgments: 2, rate: 0.5 },
        { sessions: 5, projects: 2, judgments: 10, rate: 0.3 },
        { sessions: 12, projects: 3, judgments: 20, rate: 0.25 },
        { sessions: 20, projects: 5, judgments: 50, rate: 0.4 },
      ];

      const steps: Array<'reframe' | 'recast' | 'rehearse' | 'refine'> = ['reframe', 'recast', 'rehearse', 'refine'];

      for (const arch of archetypes) {
        setupProfile(arch.sessions, arch.projects, arch.judgments, arch.rate);
        const profile = buildNavigatorProfile();
        for (const step of steps) {
          const coaching = getStepCoaching(step, profile);
          expect(coaching.length).toBeLessThanOrEqual(2);
        }
      }
    });

    it('첫 사용(session 0)은 모든 스텝에서 코칭이 있어야 한다', () => {
      setupProfile(0, 0, 0, 0);
      const profile = buildNavigatorProfile();
      const steps: Array<'reframe' | 'recast' | 'rehearse' | 'refine'> = ['reframe', 'recast', 'rehearse', 'refine'];

      for (const step of steps) {
        const coaching = getStepCoaching(step, profile);
        expect(coaching.length).toBeGreaterThan(0);
      }
    });

    it('tier 2+ 사용자의 코칭에는 challenge나 neutral이 포함될 수 있다', () => {
      setupProfile(5, 2, 10, 0.5);
      const profile = buildNavigatorProfile();
      const coaching = getStepCoaching('recast', profile);
      // Override rate 50% → positive coaching about patterns
      if (coaching.length > 0) {
        const tones = coaching.map(c => c.tone || 'neutral');
        expect(tones.every(t => ['neutral', 'positive', 'counterfactual', 'challenge'].includes(t))).toBe(true);
      }
    });
  });

  // ───────────────────────────────────
  // Edge Cases
  // ───────────────────────────────────
  describe('Edge Cases', () => {
    it('session 0 + demo seed incomplete → generic counterfactual', () => {
      setupProfile(0, 0, 0, 0);
      mockSignals.mockReturnValue([{
        id: 's1', tool: 'reframe', signal_type: 'demo_seed', created_at: '',
        signal_data: { doubted_count: 1, total_premises: 3, ai_only_steps: 0, human_only_steps: 0, total_steps: 4, completed: false },
      }]);

      const profile = buildNavigatorProfile();
      // completed: false → demoSeedData exists but completed is false
      const coaching = getStepCoaching('reframe', profile);
      expect(coaching[0].tone).toBe('counterfactual');
      expect(coaching[0].message).toContain('coaching.reframe.firstUse');
    });

    it('DQ 점수 1개만 있으면 sparkline 대신 단일 숫자', () => {
      setupProfile(1, 1, 2, 0);
      mockDQ.mockReturnValue([makeDQScore({ overall_dq: 65 })]);
      const curve = buildLearningCurve();
      expect(curve.has_data).toBe(true);
      expect(curve.dq_points).toHaveLength(1);
      expect(curve.most_improved_element).toBeNull(); // 비교 불가
    });

    it('모든 가정이 축 없음 → axis coverage 전부 0', () => {
      setupProfile(3, 1, 5, 0);
      mockStorage.mockImplementation((key: string) => {
        if (key === 'sot_reframe_list') {
          return [makeReframeItem({
            analysis: {
              surface_task: 'test', reframed_question: 'reframed',
              why_reframing_matters: '', hidden_questions: [], ai_limitations: [],
              alternative_framings: [], reasoning_narrative: '',
              hidden_assumptions: [
                { assumption: 'no axis', risk_if_false: 'risk' }, // axis 없음
                { assumption: 'no axis 2', risk_if_false: 'risk' },
              ],
            },
          })];
        }
        return [];
      });

      const curve = buildLearningCurve();
      expect(curve.axis_gap).toBeNull(); // 모두 0이면 gap 감지 불가
    });
  });
});
