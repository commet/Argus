/**
 * Navigator Content Simulation — 코칭의 "내용적" 정확성 검증
 *
 * 구조적 검증(코칭이 나오는가?)을 넘어,
 * 실제 의사결정 시나리오에서 코칭 메시지가 정말 맞는 말인지 검증한다.
 *
 * 검증 대상:
 * 1. getStepCoaching() → 코칭 메시지 텍스트의 적절성
 * 2. buildAdaptiveContext() → LLM 프롬프트 주입 텍스트의 정확성
 * 3. recommendBlindSpotPersona() → 추천 페르소나의 맥락 적합성
 * 4. buildLearningCurve() → 성장 지표의 정확한 계산
 *
 * 시나리오:
 * A. 스타트업 창업자: 제품 피벗 (customer 과집중, org 무시)
 * B. 대기업 임원: 조직 구조조정 (org 과집중, customer 무시)
 * C. 빠른 결정자: 항상 1회 반복 (challenge 필요)
 * D. 분석 마비: 5회+ 반복해도 수렴 안 됨
 * E. DQ 하락 사용자: 초반 좋았다가 나빠짐
 * F. 전략 전환 사용자: narrow_scope → redirect_angle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStepCoaching,
  buildNavigatorProfile,
  buildLearningCurve,
} from '@/lib/navigator';
import { recommendBlindSpotPersona } from '@/lib/auto-persona';
import { buildEnhancedSystemPrompt } from '@/lib/context-builder';

// ── Mocks ──

vi.mock('@/lib/eval-engine', () => ({
  getSessionInsights: vi.fn(() => []),
  getEvalSummary: vi.fn(() => ({ total_sessions: 0, avg_pass_rate: 0, best_strategy: null, worst_eval: null })),
  analyzeStrategyPerformance: vi.fn(() => []),
  getAllStagesSummary: vi.fn(() => []),
  getStageEvalSummary: vi.fn(() => null),
}));

vi.mock('@/lib/prompt-mutation', () => ({
  getWorstPerformingEvals: vi.fn(() => []),
}));

vi.mock('@/lib/decision-quality', () => ({
  getDQScores: vi.fn(() => []),
  analyzeDQTrend: vi.fn(() => ({ total_projects: 0, avg_dq: 0, trend: 'not_enough_data', weakest_element: null, strongest_element: null, avg_blind_spots: 0, framing_challenge_rate: 0 })),
}));

vi.mock('@/lib/signal-recorder', () => ({
  getSignals: vi.fn(() => []),
  getSignalsByType: vi.fn(() => []),
}));

vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn(() => []),
  setStorage: vi.fn(),
  STORAGE_KEYS: {
    JUDGMENTS: 'sot_judgments', PROJECTS: 'sot_projects',
    ACCURACY_RATINGS: 'sot_accuracy_ratings', REFINE_LOOPS: 'sot_refine_loops',
    REFRAME_LIST: 'sot_reframe_list', RECAST_LIST: 'sot_recast_list',
    DQ_SCORES: 'sot_dq_scores', FEEDBACK_HISTORY: 'sot_feedback_history',
    QUALITY_SIGNALS: 'sot_quality_signals', PERSONAS: 'sot_personas',
    OUTCOME_RECORDS: 'sot_outcome_records', SETTINGS: 'sot_settings',
  },
}));

vi.mock('@/lib/db', () => ({ insertToSupabase: vi.fn() }));

vi.mock('@/lib/retrospective', () => ({
  getActionableInsights: vi.fn(() => []),
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

import { getEvalSummary, getSessionInsights, analyzeStrategyPerformance, getStageEvalSummary } from '@/lib/eval-engine';
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
const mockStageEval = vi.mocked(getStageEvalSummary);

// ── 시나리오 빌더 ──

function makeAssumptions(axes: string[]) {
  return axes.map(axis => ({
    assumption: `${axis} 관련 가정`, risk_if_false: `${axis} 리스크`, axis, verified: false,
  }));
}

function makeReframeItems(count: number, axisDistribution: string[], selectedEqualsReframed = false) {
  return Array.from({ length: count }, (_, i) => ({
    id: `rf-${i}`, input_text: '실제 과제', status: 'done',
    selected_question: selectedEqualsReframed ? '재정의된 질문?' : `사용자가 수정한 질문 ${i}`,
    analysis: {
      surface_task: '원래 과제',
      reframed_question: '재정의된 질문?',
      why_reframing_matters: '이 관점의 전환이 중요한 이유는 충분히 긴 설명이 필요합니다',
      hidden_assumptions: makeAssumptions(axisDistribution),
      hidden_questions: ['q1', 'q2', 'q3'],
      ai_limitations: ['AI 한계 1'],
      alternative_framings: ['대안 1', '대안 2'],
      reasoning_narrative: '',
    },
  }));
}

function makeDQScores(trajectory: Array<{ dq: number; frame: number; date: string }>) {
  return trajectory.map((t, i) => ({
    id: `dq-${i}`, project_id: `p${i}`,
    appropriate_frame: t.frame, creative_alternatives: 3, relevant_information: 3,
    clear_values: 3, sound_reasoning: 3, commitment_to_action: 3,
    overall_dq: t.dq, initial_framing_challenged: true,
    blind_spots_surfaced: 1, user_changed_mind: false,
    created_at: t.date,
  }));
}

function setupScenario(opts: {
  sessions: number; projects: number;
  reframeItems?: unknown[];
  dqScores?: unknown[];
  dqTrend?: Record<string, unknown>;
  judgments?: unknown[];
  strategyPattern?: string;
  refineLoops?: unknown[];
}) {
  mockEval.mockReturnValue({
    total_sessions: opts.sessions, avg_pass_rate: 0.65,
    best_strategy: (opts.strategyPattern as never) || null, worst_eval: null,
  });
  mockStrategy.mockReturnValue([]);
  mockWorst.mockReturnValue([]);
  mockInsights.mockReturnValue(
    opts.strategyPattern
      ? [{ type: 'pattern', message: `${opts.strategyPattern} 패턴 감지` }]
      : []
  );
  mockSignals.mockReturnValue([]);

  const dqScores = opts.dqScores || [];
  mockDQ.mockReturnValue(dqScores as never);
  mockDQTrend.mockReturnValue({
    total_projects: opts.projects, avg_dq: 50, trend: 'not_enough_data',
    weakest_element: null, strongest_element: null, avg_blind_spots: 0, framing_challenge_rate: 0,
    ...(opts.dqTrend || {}),
  } as never);

  const judgments = opts.judgments || [];
  mockStorage.mockImplementation((key: string) => {
    if (key === 'sot_projects') return Array.from({ length: opts.projects }, (_, i) => ({
      id: `p${i}`, name: `프로젝트 ${i}`, refs: [], created_at: '', updated_at: '',
    }));
    if (key === 'sot_reframe_list') return opts.reframeItems || [];
    if (key === 'sot_dq_scores') return dqScores;
    if (key === 'sot_judgments') return judgments;
    if (key === 'sot_refine_loops') return opts.refineLoops || [];
    if (key === 'sot_accuracy_ratings') return [];
    return [];
  });
}

// ══════════════════════════════════════
// Scenario A: 스타트업 창업자 — customer 과집중, org 무시
// "제품 피벗할까?" 류의 결정을 반복하면서 항상 고객 관점만 본다
// ══════════════════════════════════════

describe('Scenario A: 스타트업 창업자 (customer 과집중)', () => {
  beforeEach(() => {
    setupScenario({
      sessions: 7, projects: 3,
      reframeItems: makeReframeItems(7, ['customer_value', 'customer_value', 'business']),
      // 7건 × 3가정 = 21가정, customer 14(67%), business 7(33%), feasibility 0, org 0
    });
  });

  it('axis gap: feasibility 또는 org_capacity가 감지되어야 한다', () => {
    const curve = buildLearningCurve();
    expect(curve.axis_gap).not.toBeNull();
    // feasibility와 org_capacity 모두 0% → 둘 중 하나가 gap
    const gapAxes = ['실현 가능성', '조직 역량'];
    expect(gapAxes).toContain(curve.axis_gap);
  });

  it('blind spot persona: 기술 또는 조직 관련 페르소나를 추천해야 한다', () => {
    const rec = recommendBlindSpotPersona([]);
    expect(rec).not.toBeNull();
    // feasibility 또는 org_capacity 중 하나의 페르소나
    const expectedRoles = ['CTO', '개발팀장', 'COO', '운영팀장', 'CHRO', '인사팀장', '조직개발'];
    expect(expectedRoles.some(r => rec!.role.includes(r))).toBe(true);
  });

  it('blind spot persona: 이미 CTO가 있으면 COO 또는 CHRO를 추천', () => {
    const rec = recommendBlindSpotPersona(['CTO / 개발팀장']);
    if (rec && rec.axis === 'feasibility') {
      // CTO가 이미 있으므로 COO를 추천해야 함
      expect(rec.role).toContain('운영');
    }
  });
});

// ══════════════════════════════════════
// Scenario B: 대기업 임원 — org 과집중, customer 무시
// "조직 구조조정" 류의 결정에서 항상 내부 관점만 본다
// ══════════════════════════════════════

describe('Scenario B: 대기업 임원 (org 과집중)', () => {
  beforeEach(() => {
    setupScenario({
      sessions: 8, projects: 3,
      reframeItems: makeReframeItems(8, ['org_capacity', 'org_capacity', 'business', 'feasibility']),
      // 8건 × 4가정 = 32, org 16(50%), business 8(25%), feasibility 8(25%), customer 0(0%)
    });
  });

  it('axis gap: customer_value가 0%로 감지되어야 한다', () => {
    const curve = buildLearningCurve();
    expect(curve.axis_gap).toBe('고객 가치');
    expect(curve.axis_coverage['고객 가치']).toBe(0);
  });

  it('blind spot persona: CX 또는 프로덕트 관련 페르소나 추천', () => {
    const rec = recommendBlindSpotPersona([]);
    expect(rec).not.toBeNull();
    expect(rec!.axis).toBe('customer_value');
    expect(rec!.axis_label).toBe('고객 가치');
    // CX 팀장 또는 프로덕트 매니저
    const expectedRoles = ['CX', '프로덕트'];
    expect(expectedRoles.some(r => rec!.role.includes(r))).toBe(true);
  });

  it('대기업 임원이 이미 HR팀장을 페르소나로 갖고 있어도 customer 추천은 변하지 않음', () => {
    const rec = recommendBlindSpotPersona(['CHRO / 인사팀장', '조직개발 매니저']);
    expect(rec).not.toBeNull();
    expect(rec!.axis).toBe('customer_value'); // HR이 있어도 gap은 customer
  });
});

// ══════════════════════════════════════
// Scenario E: DQ 하락 사용자
// 초반에 잘하다가 최근에 나빠짐 (번아웃? 복잡한 결정?)
// ══════════════════════════════════════

describe('Scenario E: DQ 하락 사용자', () => {
  const scores = makeDQScores([
    { dq: 75, frame: 4, date: '2026-01-01' },
    { dq: 70, frame: 4, date: '2026-02-01' },
    { dq: 48, frame: 2, date: '2026-03-01' }, // 급격한 하락
  ]);

  beforeEach(() => {
    setupScenario({
      sessions: 6, projects: 3,
      dqScores: scores,
      dqTrend: { trend: 'declining', avg_dq: 64, weakest_element: '프레이밍', strongest_element: '추론 품질' },
      reframeItems: makeReframeItems(3, ['business', 'feasibility']),
    });
  });

  // P0-3 (2026-07-03): DQ 하락 "경고"는 사용자에 대한 평결(스파인 규칙2)이라
  // 생성 자체가 제거됐다 — 하락 상황에서도 평결 코칭이 나오면 안 된다.
  it('refine 코칭: DQ 하락 평결을 생성하지 않는다 (스파인 규칙2)', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('refine', profile);
    const warnMsg = coaching.find(c =>
      c.message.includes('판단 품질이 하락') || c.message.includes('coaching.refine.dqDeclining'));
    expect(warnMsg).toBeUndefined();
  });

  it('learning curve: declining 트렌드', () => {
    const curve = buildLearningCurve();
    expect(curve.trend).toBe('declining');
  });
});

// ══════════════════════════════════════
// Scenario F: 전략 전환 사용자
// narrow_scope만 쓰다가 redirect_angle로 전환 시도 중
// ══════════════════════════════════════

describe('Scenario F: 전략 전환 사용자', () => {
  beforeEach(() => {
    setupScenario({
      sessions: 8, projects: 3,
      strategyPattern: 'narrow_scope',
      reframeItems: makeReframeItems(8, ['customer_value', 'business', 'feasibility', 'org_capacity']),
    });
    mockStrategy.mockReturnValue([
      { strategy: 'narrow_scope', sample_count: 6, avg_pass_rate: 0.65, per_eval_pass_rates: {} },
      { strategy: 'redirect_angle', sample_count: 2, avg_pass_rate: 0.80, per_eval_pass_rates: {} },
    ]);
    mockInsights.mockReturnValue([
      { type: 'pattern', message: '범위 집중을 자주 사용합니다' },
    ]);
  });

  it('reframe 코칭: 전략 반복 패턴을 challenge tone으로 알려야 한다', () => {
    mockEval.mockReturnValue({
      total_sessions: 8, avg_pass_rate: 0.65, best_strategy: 'narrow_scope', worst_eval: null,
    });

    const profile = buildNavigatorProfile();
    expect(profile.dominantStrategy).toBe('narrow_scope');

    const coaching = getStepCoaching('reframe', profile);
    const strategyMsg = coaching.find(c => c.message.includes('범위 집중'));
    expect(strategyMsg).toBeDefined();
    expect(strategyMsg!.tone).toBe('challenge');
  });
});

// ══════════════════════════════════════
// Scenario G: 가정 평가를 전혀 안 하는 사용자
// assumptions_engaged eval이 계속 실패
// ══════════════════════════════════════

describe('Scenario G: 가정 미평가 사용자', () => {
  beforeEach(() => {
    setupScenario({
      sessions: 5, projects: 2,
      reframeItems: makeReframeItems(5, ['customer_value', 'business']),
    });
    mockWorst.mockReturnValue([
      { evalId: 'assumptions_engaged', instruction: '가정을 평가해보세요', passRate: 0.2 },
    ]);
  });

  // P0-3 (2026-07-03): "가정 평가를 더 적극적으로 해보세요"는 지시형 코칭
  // (스파인 위반)이라 생성 자체가 제거됐다.
  it('reframe 코칭: 가정 평가 독려(지시형 코칭)를 생성하지 않는다', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('reframe', profile);
    const engageMsg = coaching.find(c => c.message.includes('coaching.reframe.assumptionEngage'));
    expect(engageMsg).toBeUndefined();
  });
});

// ══════════════════════════════════════
// Scenario H: 데모에서 AI에 올인한 사용자
// ══════════════════════════════════════

describe('Scenario H: 데모에서 AI 올인', () => {
  beforeEach(() => {
    setupScenario({ sessions: 0, projects: 0 });
    mockSignals.mockReturnValue([{
      id: 's1', tool: 'reframe', signal_type: 'demo_seed', created_at: '',
      signal_data: {
        doubted_count: 1, total_premises: 3,
        ai_only_steps: 4, human_only_steps: 0, total_steps: 4,
        completed: true,
      },
    }]);
  });

  it('recast 코칭: AI 과위임을 challenge해야 한다', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('recast', profile);
    expect(coaching[0].tone).toBe('challenge');
    expect(coaching[0].message).toContain('coaching.recast.demoAiHeavy');
  });

  it('recast 코칭: 체크포인트 detail이 있어야 한다', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('recast', profile);
    expect(coaching[0].detail).toContain('coaching.recast.demoAiHeavyDetail');
  });
});

// ══════════════════════════════════════
// Scenario I: 페르소나 정확도가 개선되는 사용자
// ══════════════════════════════════════

describe('Scenario I: 페르소나 정확도 개선', () => {
  beforeEach(() => {
    setupScenario({ sessions: 6, projects: 3, reframeItems: [] });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_accuracy_ratings') return [
        { id: 'r1', persona_id: 'p1', accuracy_score: 2.0, which_aspects_accurate: ['톤'], which_aspects_inaccurate: ['깊이', '현실성'], created_at: '2026-01-01' },
        { id: 'r2', persona_id: 'p1', accuracy_score: 2.5, which_aspects_accurate: ['톤'], which_aspects_inaccurate: ['깊이'], created_at: '2026-01-15' },
        { id: 'r3', persona_id: 'p1', accuracy_score: 3.5, which_aspects_accurate: ['톤', '깊이'], which_aspects_inaccurate: ['현실성'], created_at: '2026-02-01' },
        { id: 'r4', persona_id: 'p1', accuracy_score: 4.0, which_aspects_accurate: ['톤', '깊이', '현실성'], which_aspects_inaccurate: [], created_at: '2026-02-15' },
      ];
      if (key === 'sot_projects') return Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, refs: [], created_at: '', updated_at: '' }));
      if (key === 'sot_judgments') return Array.from({ length: 10 }, (_, i) => ({
        id: `j${i}`, user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
      }));
      return [];
    });
  });

  it('rehearse 코칭: 페르소나 정확도 향상을 positive로 알려야 한다', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('rehearse', profile);
    const accuracyMsg = coaching.find(c => c.message.includes('coaching.rehearse.accuracyImproving'));
    expect(accuracyMsg).toBeDefined();
    expect(accuracyMsg!.tone).toBe('positive');
  });

  it('rehearse 코칭: 정확도 수치가 포함되어야 한다', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('rehearse', profile);
    // mock t() returns "coaching.rehearse.accuracyImproving from=2.0 to=3.8" with numeric params
    const accuracyMsg = coaching.find(c => c.message.includes('coaching.rehearse.accuracyImproving'));
    expect(accuracyMsg!.message).toMatch(/\d+\.\d/);
  });
});

// ══════════════════════════════════════
// Scenario J: 불확실한 가정이 많은 상태에서 선원 배치 진입
// reframe → recast 체인 연결 검증
// ══════════════════════════════════════

describe('Scenario J: 불확실한 가정 → 선원 배치 체인', () => {
  beforeEach(() => {
    setupScenario({ sessions: 3, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_reframe_list') return [{
        id: 'rf-1', input_text: 'B2B SaaS 가격 전략', status: 'done',
        selected_question: '우리 고객이 실제로 가격에 민감한가?',
        analysis: {
          surface_task: 'B2B SaaS 가격 인상',
          reframed_question: '우리 고객이 실제로 가격에 민감한가?',
          why_reframing_matters: '가격 인상이 아니라 가치 인식의 문제일 수 있다',
          hidden_assumptions: [
            { assumption: '고객이 가격에 민감하다', risk_if_false: '불필요한 할인 경쟁', axis: 'customer_value', evaluation: 'doubtful' },
            { assumption: '경쟁사 대비 기능이 부족하다', risk_if_false: '잘못된 개발 우선순위', axis: 'business', evaluation: 'uncertain' },
            { assumption: '영업팀이 가격 협상에 능숙하다', risk_if_false: '가격 정책이 현장에서 무시됨', axis: 'org_capacity', evaluation: 'doubtful' },
          ],
          hidden_questions: ['q1', 'q2'], ai_limitations: [], alternative_framings: [], reasoning_narrative: '',
        },
      }];
      if (key === 'sot_projects') return [{ id: 'p0', name: 'SaaS', refs: [] }];
      if (key === 'sot_judgments') return Array.from({ length: 5 }, (_, i) => ({
        id: `j${i}`, user_changed: i < 1, type: 'actor_override', decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
      }));
      return [];
    });
  });

  it('recast 코칭: 불확실한 가정 수와 내용을 알려줘야 한다', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('recast', profile);
    // 3개 가정 중 2개가 doubtful, 1개 uncertain = 3건 불확실
    const assumptionMsg = coaching.find(c => c.message.includes('uncertainAssumptions'));
    expect(assumptionMsg).toBeDefined();
    expect(assumptionMsg!.message).toContain('count=3');
  });

  it('recast 코칭: detail에 실제 가정 텍스트가 포함되어야 한다', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('recast', profile);
    const assumptionMsg = coaching.find(c => c.message.includes('uncertainAssumptions'));
    expect(assumptionMsg?.detail).toBeDefined();
    // 가격 또는 경쟁사 또는 영업팀 관련 텍스트
    expect(assumptionMsg!.detail).toMatch(/가격|경쟁사|영업팀/);
  });
});

// ══════════════════════════════════════
// Cross-scenario: 코칭 품질 메트릭
// ══════════════════════════════════════

describe('Cross-scenario: 코칭 품질 규칙', () => {
  it('challenge tone 코칭에는 항상 행동 제안이 포함되어야 한다', () => {
    // 데모 수동 사용자
    setupScenario({ sessions: 0, projects: 0 });
    mockSignals.mockReturnValue([{
      id: 's1', tool: 'reframe', signal_type: 'demo_seed', created_at: '',
      signal_data: { doubted_count: 0, total_premises: 3, ai_only_steps: 4, human_only_steps: 0, total_steps: 4, completed: true },
    }]);
    const profile = buildNavigatorProfile();

    // reframe challenge
    const reframeCoaching = getStepCoaching('reframe', profile);
    const challengeMsg = reframeCoaching.find(c => c.tone === 'challenge');
    if (challengeMsg) {
      // challenge 메시지의 detail에는 "~해보세요" 같은 행동 제안이 있어야 한다
      expect(challengeMsg.detail).toBeDefined();
      expect(challengeMsg.detail!.length).toBeGreaterThan(10);
    }
  });

  it('positive tone 코칭에는 구체적 수치가 포함되어야 한다', () => {
    setupScenario({ sessions: 0, projects: 0 });
    mockSignals.mockReturnValue([{
      id: 's1', tool: 'reframe', signal_type: 'demo_seed', created_at: '',
      signal_data: { doubted_count: 3, total_premises: 3, ai_only_steps: 1, human_only_steps: 1, total_steps: 4, completed: true },
    }]);
    const profile = buildNavigatorProfile();

    const coaching = getStepCoaching('reframe', profile);
    const positiveMsg = coaching.find(c => c.tone === 'positive');
    if (positiveMsg) {
      // positive 메시지에는 숫자가 있어야 한다 (earned recognition: 구체적이어야 한다)
      expect(positiveMsg.message).toMatch(/\d/);
    }
  });

  it('counterfactual 코칭의 detail은 유효한 i18n Detail 키여야 한다', () => {
    setupScenario({ sessions: 0, projects: 0 });
    const profile = buildNavigatorProfile();

    const steps: Array<'reframe' | 'recast' | 'rehearse' | 'refine'> = ['reframe', 'recast', 'rehearse', 'refine'];
    for (const step of steps) {
      const coaching = getStepCoaching(step, profile);
      const cfMsg = coaching.find(c => c.tone === 'counterfactual');
      if (cfMsg?.detail) {
        // detail is an i18n key like "coaching.reframe.firstUseDetail"
        expect(cfMsg.detail).toContain('Detail');
      }
    }
  });
});

// ══════════════════════════════════════
// Scenario K: 정체된 사용자 — DQ 5회 연속 같은 수준
// "다른 건 해봤지만 나아지지 않는다" 상태
// ══════════════════════════════════════

describe('Scenario K: 정체된 사용자 (DQ plateau)', () => {
  const scores = makeDQScores([
    { dq: 58, frame: 3, date: '2026-01-01' },
    { dq: 60, frame: 3, date: '2026-02-01' },
    { dq: 57, frame: 3, date: '2026-03-01' },
    { dq: 59, frame: 3, date: '2026-04-01' },
    { dq: 58, frame: 3, date: '2026-05-01' },
  ]);

  beforeEach(() => {
    setupScenario({
      sessions: 10, projects: 5,
      dqScores: scores,
      dqTrend: { trend: 'stable', avg_dq: 58, weakest_element: '관점 다양성', strongest_element: '프레이밍' },
      reframeItems: makeReframeItems(10, ['customer_value', 'business', 'feasibility', 'org_capacity']),
    });
  });

  it('learning curve: stable 트렌드여야 한다', () => {
    const curve = buildLearningCurve();
    expect(curve.trend).toBe('stable');
    expect(curve.avg_dq).toBe(58);
  });

  it('learning curve: most_improved_element가 없거나 delta가 매우 작아야 한다', () => {
    const curve = buildLearningCurve();
    // 모든 요소가 3으로 동일하므로 delta = 0
    expect(curve.improvement_delta).toBe(0);
  });
});

// ══════════════════════════════════════
// Scenario L: 침묵의 원칙 — 균형 잡힌 숙련자에게 과잉 칭찬 금지
// Earned Recognition: "잘한 게 없으면 아무 말도 하지 않는다"
// ══════════════════════════════════════

describe('Scenario L: 침묵의 원칙 (anti-sycophancy in coaching)', () => {
  beforeEach(() => {
    // 숙련자: 패턴 없음, worst eval 없음, avgPassRate 보통
    setupScenario({
      sessions: 7, projects: 2,
      reframeItems: makeReframeItems(7, ['customer_value', 'business', 'feasibility', 'org_capacity']),
    });
    // 특별히 나쁜 것도 좋은 것도 없는 상태
    mockEval.mockReturnValue({
      total_sessions: 7, avg_pass_rate: 0.65, best_strategy: null, worst_eval: null,
    });
    mockWorst.mockReturnValue([]); // 나쁜 eval 없음
    mockInsights.mockReturnValue([]); // 전략 패턴 없음
  });

  it('reframe: 특별한 코칭 없이 빈 배열이거나 최소한의 메시지만', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('reframe', profile);
    // avgPassRate 0.65 < 0.75 → high pass rate 칭찬 안 나옴
    // 나쁜 eval 없음 → 개선 제안 없음
    // 전략 패턴 없음 → 전략 challenge 없음
    // ∴ 코칭이 없거나 매우 적어야 한다
    expect(coaching.length).toBeLessThanOrEqual(1);
  });

  it('reframe: 나오더라도 범용 칭찬("잘하고 있습니다")이 아니어야 한다', () => {
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('reframe', profile);
    for (const c of coaching) {
      // "잘하고 계십니다", "훌륭합니다", "뛰어납니다" 같은 범용 칭찬 금지
      expect(c.message).not.toMatch(/잘하고|훌륭|뛰어|대단/);
    }
  });
});

// ══════════════════════════════════════
// Scenario M: 프롬프트 주입 내용 검증
// buildEnhancedSystemPrompt()의 실제 출력 텍스트 검증
// ══════════════════════════════════════

describe('Scenario M: 프롬프트 주입 내용 검증', () => {
  it('5회 미만이면 적응형 컨텍스트가 주입되지 않아야 한다 (premature adaptation 방지)', () => {
    setupScenario({
      sessions: 3, projects: 1,
      reframeItems: makeReframeItems(3, ['customer_value', 'customer_value']),
    });
    mockStageEval.mockReturnValue(null);

    const prompt = buildEnhancedSystemPrompt('기본 프롬프트');
    expect(prompt).not.toContain('적응형 컨텍스트');
    expect(prompt).not.toContain('참고: 이 사용자');
  });

  it('5회 이상 + org blind spot 후보도 승인 전에는 프롬프트에 주입하지 않는다', () => {
    setupScenario({
      sessions: 7, projects: 2,
      reframeItems: makeReframeItems(7, ['customer_value', 'customer_value', 'business']),
      judgments: Array.from({ length: 3 }, (_, i) => ({
        id: `j${i}`, user_changed: false, type: 'actor_override', decision: 'ai',
        tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
      })),
    });
    mockStageEval.mockReturnValue({
      tool: 'reframe', total_sessions: 7, avg_pass_rate: 0.6, worst_eval: null,
      per_eval_rates: { assumptions_diverse: 0.3, assumptions_engaged: 0.8 },
    });

    const prompt = buildEnhancedSystemPrompt('기본 프롬프트');
    expect(prompt).not.toContain('참고:');
    expect(prompt).not.toMatch(/조직 역량|실현 가능성/);
  });

  it('assumptions_diverse eval이 낮아도 4축 지시를 자동 주입하지 않는다', () => {
    setupScenario({
      sessions: 6, projects: 2,
      reframeItems: makeReframeItems(6, ['customer_value', 'business', 'feasibility', 'org_capacity']),
      judgments: [{ id: 'j1', user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' }],
    });
    mockStageEval.mockReturnValue({
      tool: 'reframe', total_sessions: 6, avg_pass_rate: 0.5, worst_eval: 'assumptions_diverse',
      per_eval_rates: { assumptions_diverse: 0.3, assumptions_engaged: 0.9 },
    });

    const prompt = buildEnhancedSystemPrompt('기본 프롬프트');
    expect(prompt).not.toContain('customer');
    expect(prompt).not.toContain('feasibility');
    expect(prompt).not.toContain('business');
    expect(prompt).not.toContain('org');
  });

  it('프롬프트 주입은 "참고:" 형식이어야 한다 (directive가 아닌 reference)', () => {
    setupScenario({
      sessions: 8, projects: 3,
      reframeItems: makeReframeItems(8, ['customer_value', 'customer_value']),
    });
    mockStageEval.mockReturnValue({
      tool: 'reframe', total_sessions: 8, avg_pass_rate: 0.5, worst_eval: null,
      per_eval_rates: { assumptions_diverse: 0.4, assumptions_engaged: 0.5 },
    });

    const prompt = buildEnhancedSystemPrompt('기본 프롬프트');
    // "반드시", "무조건", "꼭" 같은 directive 표현 금지
    if (prompt.includes('적응형 컨텍스트')) {
      expect(prompt).not.toMatch(/반드시|무조건|꼭 /);
    }
  });
});

// ══════════════════════════════════════
// Scenario N: reframe 수락 사건을 사용자 성향으로 자동 승격하지 않음
// 8회 중 7회 첫 reframe 수락도 E2 grant 전에는 미래 프롬프트 영향 0
// ══════════════════════════════════════

describe('Scenario N: reframe 수락 패턴 격리', () => {
  beforeEach(() => {
    setupScenario({
      sessions: 8, projects: 3,
      reframeItems: makeReframeItems(8, ['customer_value', 'business', 'feasibility', 'org_capacity'], true),
      judgments: [{ id: 'j1', user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' }],
    });
    mockStageEval.mockReturnValue({
      tool: 'reframe', total_sessions: 8, avg_pass_rate: 0.7, worst_eval: null,
      per_eval_rates: { assumptions_diverse: 0.8, assumptions_engaged: 0.8 },
    });
  });

  it('프롬프트에 reframe 수락 패턴과 대안 압력을 주입하지 않는다', () => {
    const prompt = buildEnhancedSystemPrompt('기본 프롬프트');
    expect(prompt).not.toContain('수락');
    expect(prompt).not.toContain('대안');
  });
});

// ══════════════════════════════════════
// Scenario O: 코칭 메시지의 한국어 자연스러움
// 어색한 표현, 잘린 문장, 과잉 존대 검증
// ══════════════════════════════════════

describe('Scenario O: 코칭 i18n 키 품질', () => {
  it('모든 코칭 메시지는 유효한 i18n 키를 포함해야 한다', () => {
    const scenarios = [
      { sessions: 0, projects: 0 }, // 초보
      { sessions: 5, projects: 2 }, // 중급
    ];

    for (const s of scenarios) {
      setupScenario({ sessions: s.sessions, projects: s.projects, reframeItems: [] });
      const profile = buildNavigatorProfile();
      const steps: Array<'reframe' | 'recast' | 'rehearse' | 'refine'> = ['reframe', 'recast', 'rehearse', 'refine'];

      for (const step of steps) {
        const coaching = getStepCoaching(step, profile);
        for (const c of coaching) {
          // i18n mock returns key as-is; messages should contain a valid coaching key
          expect(c.message).toMatch(/^coaching\./);
        }
      }
    }
  });

  it('코칭 메시지에 내부 코드 변수명이 직접 노출되면 안 된다', () => {
    setupScenario({ sessions: 0, projects: 0 });
    const profile = buildNavigatorProfile();
    const steps: Array<'reframe' | 'recast' | 'rehearse' | 'refine'> = ['reframe', 'recast', 'rehearse', 'refine'];

    for (const step of steps) {
      const coaching = getStepCoaching(step, profile);
      for (const c of coaching) {
        // Internal variable names / function names should not leak into messages
        expect(c.message).not.toMatch(/pass_rate|eval_result|signal_type/);
        if (c.detail) {
          expect(c.detail).not.toMatch(/pass_rate|eval_result|signal_type/);
        }
      }
    }
  });
});

// ══════════════════════════════════════
// Scenario P: DQ 하락 후 회복 — 코칭이 적절히 전환되는지
// ══════════════════════════════════════

describe('Scenario P: DQ 하락 후 회복', () => {
  // P0-3 (2026-07-03): "개선되고 있습니다" 칭찬도 같은 평결이다(칭찬을 남기면
  // 침묵이 곧 나쁜 성적표) — 회복 상황에서도 평결 코칭이 나오면 안 된다.
  it('하락→회복이어도 DQ 평결 코칭을 생성하지 않는다 (스파인 규칙2)', () => {
    const scores = makeDQScores([
      { dq: 70, frame: 4, date: '2026-01-01' },
      { dq: 45, frame: 2, date: '2026-02-01' }, // 하락
      { dq: 68, frame: 4, date: '2026-03-01' }, // 회복
    ]);
    setupScenario({
      sessions: 6, projects: 3,
      dqScores: scores,
      dqTrend: { trend: 'stable', avg_dq: 61 },
    });
    // getRefineCoaching는 마지막 2개 DQ를 비교: 45 → 68 = 개선
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_dq_scores') return scores;
      if (key === 'sot_projects') return [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }];
      if (key === 'sot_judgments') return [];
      return [];
    });

    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('refine', profile);
    const recoveryMsg = coaching.find(c =>
      c.message.includes('판단 품질이 개선') || c.message.includes('coaching.refine.dqImproving'));
    expect(recoveryMsg).toBeUndefined();
  });
});

// ══════════════════════════════════════
// Scenario Q: recast에서 unverified 가정 체인 — 다양한 evaluation 조합
// ══════════════════════════════════════

describe('Scenario Q: 가정 evaluation 조합별 recast 코칭', () => {
  it('모든 가정이 likely_true → 불확실한 가정 코칭 안 나옴', () => {
    setupScenario({ sessions: 3, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_reframe_list') return [{
        id: 'rf-1', status: 'done',
        analysis: {
          surface_task: 'test', reframed_question: 'reframed',
          why_reframing_matters: '', hidden_questions: [], ai_limitations: [],
          alternative_framings: [], reasoning_narrative: '',
          hidden_assumptions: [
            { assumption: '확실한 가정 1', risk_if_false: 'r', axis: 'business', evaluation: 'likely_true' },
            { assumption: '확실한 가정 2', risk_if_false: 'r', axis: 'customer_value', evaluation: 'likely_true' },
          ],
        },
      }];
      if (key === 'sot_judgments') return Array.from({ length: 5 }, (_, i) => ({
        id: `j${i}`, user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
      }));
      return [];
    });

    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('recast', profile);
    const uncertainMsg = coaching.find(c => c.message.includes('불확실'));
    expect(uncertainMsg).toBeUndefined(); // 불확실한 가정이 없으므로
  });

  it('doubtful 2개 + likely_true 1개 → 불확실한 가정 2건으로 코칭', () => {
    setupScenario({ sessions: 3, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_reframe_list') return [{
        id: 'rf-1', status: 'done',
        analysis: {
          surface_task: 'test', reframed_question: 'reframed',
          why_reframing_matters: '', hidden_questions: [], ai_limitations: [],
          alternative_framings: [], reasoning_narrative: '',
          hidden_assumptions: [
            { assumption: '의심 가정 A', risk_if_false: 'r', axis: 'business', evaluation: 'doubtful' },
            { assumption: '의심 가정 B', risk_if_false: 'r', axis: 'org_capacity', evaluation: 'doubtful' },
            { assumption: '확실한 가정', risk_if_false: 'r', axis: 'customer_value', evaluation: 'likely_true' },
          ],
        },
      }];
      if (key === 'sot_judgments') return Array.from({ length: 5 }, (_, i) => ({
        id: `j${i}`, user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
      }));
      return [];
    });

    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('recast', profile);
    const uncertainMsg = coaching.find(c => c.message.includes('uncertainAssumptions'));
    expect(uncertainMsg).toBeDefined();
    expect(uncertainMsg!.message).toContain('count=2');
    // detail에 실제 가정 텍스트
    expect(uncertainMsg!.detail).toContain('의심 가정');
  });
});

// ══════════════════════════════════════════════════════════════
//
//   THIN DATA CONSERVATISM — 과잉 해석 방지 검증 14건
//
//   Argus는 사용자가 직접 입력하는 정보가 적다.
//   대부분 클릭, 체류, 수용/거부 같은 암묵적 시그널이다.
//   따라서 데이터가 적을 때 과잉 해석하면 신뢰를 잃는다.
//
//   원칙: "확신 없으면 침묵한다. 추측보다 데이터를 기다린다."
//
// ══════════════════════════════════════════════════════════════

describe('Thin Data Conservatism: 과잉 해석 방지', () => {

  // 1. reframe 2건으로 "가정 발견 수 증가" 패턴을 주장하면 안 된다
  it('reframe 2건에서 "증가 패턴" 주장 금지 — 노이즈일 수 있다', () => {
    setupScenario({ sessions: 2, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_reframe_list') return [
        makeReframeItems(1, ['customer_value', 'business'])[0],           // 2개 가정
        makeReframeItems(1, ['customer_value', 'business', 'feasibility'])[0], // 3개 가정
      ];
      if (key === 'sot_projects') return [{ id: 'p0', name: 'P', refs: [] }];
      if (key === 'sot_judgments') return [];
      return [];
    });

    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('reframe', profile);
    // 2건에서 2→3은 "증가 패턴"이라 부를 수 없다
    const growthMsg = coaching.find(c => c.message.includes('증가'));
    expect(growthMsg).toBeUndefined();
  });

  // 2. 가정 총 4개로 axis gap을 주장하면 안 된다
  it('가정 총 4개 이하에서 axis gap 판정 금지', () => {
    setupScenario({ sessions: 2, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_reframe_list') return [makeReframeItems(1, ['customer_value'])[0]];
      return [];
    });

    const curve = buildLearningCurve();
    // 가정 1개로는 gap을 판단할 수 없다
    expect(curve.axis_gap).toBeNull();
  });

  // 3. 전략 2회 사용으로 "자주 사용합니다" 금지
  it('전략 2회 사용은 "패턴"이 아니다', () => {
    setupScenario({ sessions: 4, projects: 1 });
    // getSessionInsights에서 pattern이 나오려면 dominant가 2+ in last 5
    // 하지만 4회 중 2회면 insights에서 pattern을 반환하지 않도록 해야
    mockInsights.mockReturnValue([]); // 패턴 없음
    mockEval.mockReturnValue({
      total_sessions: 4, avg_pass_rate: 0.6, best_strategy: 'narrow_scope', worst_eval: null,
    });
    mockStrategy.mockReturnValue([
      { strategy: 'narrow_scope', sample_count: 2, avg_pass_rate: 0.7, per_eval_pass_rates: {} },
    ]);

    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('reframe', profile);
    const strategyMsg = coaching.find(c => c.message.includes('자주 사용'));
    // insights에서 pattern이 안 나왔으므로 전략 반복 코칭도 안 나와야
    expect(strategyMsg).toBeUndefined();
  });

  // 4. 판단 3건에서 override율 67%는 "패턴"이 아니다
  it('판단 3건의 override율은 신뢰할 수 없다 — 코칭 자제', () => {
    setupScenario({ sessions: 3, projects: 1, judgments: [] });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_judgments') return [
        { id: 'j1', user_changed: true, type: 'actor_override', decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
        { id: 'j2', user_changed: true, type: 'actor_override', decision: 'human', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
        // 2/2 = 100% override지만 표본이 너무 적다
      ];
      return [];
    });

    const profile = buildNavigatorProfile();
    // recast에서 totalJudgments < 3이면 override 코칭을 건너뛴다
    const coaching = getStepCoaching('recast', profile);
    const overrideMsg = coaching.find(c => c.message.includes('coaching.recast.overrideHigh'));
    // 판단이 2건밖에 없으므로 override 코칭이 나오면 안 된다
    expect(overrideMsg).toBeUndefined();
  });

  // 5. DQ 2개에서 "트렌드" 주장 가능하지만 learning curve는 보수적이어야
  it('DQ 2개로 most_improved는 계산하되, delta가 작으면 표시 안 함', () => {
    const scores = makeDQScores([
      { dq: 58, frame: 3, date: '2026-01-01' },
      { dq: 62, frame: 3, date: '2026-02-01' }, // frame이 같으므로 delta=0
    ]);
    setupScenario({ sessions: 3, projects: 2, dqScores: scores });

    const curve = buildLearningCurve();
    // frame이 둘 다 3이므로 improvement_delta = 0
    expect(curve.improvement_delta).toBe(0);
  });

  // 6. 페르소나 정확도 1건으로 "향상/하락" 판정 금지
  it('페르소나 정확도 1건에서 트렌드 판정 금지', () => {
    setupScenario({ sessions: 3, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_accuracy_ratings') return [{
        id: 'r1', persona_id: 'p1', accuracy_score: 4.5,
        which_aspects_accurate: ['톤'], which_aspects_inaccurate: [],
        created_at: '2026-01-01',
      }];
      if (key === 'sot_projects') return [{ id: 'p0', name: 'P', refs: [] }];
      if (key === 'sot_judgments') return [
        { id: 'j1', user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
        { id: 'j2', user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
        { id: 'j3', user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' },
      ];
      return [];
    });

    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('rehearse', profile);
    // "향상" 메시지는 4건 이상에서만 비교 가능
    const trendMsg = coaching.find(c => c.message.includes('coaching.rehearse.accuracyImproving'));
    expect(trendMsg).toBeUndefined();
  });

  // 7. 데모에서 1/3 의심 — "비판적"도 "수동적"도 아닌 중간 상태
  it('데모 1/3 의심은 과잉 해석 없이 중립적 코칭', () => {
    setupScenario({ sessions: 0, projects: 0 });
    mockSignals.mockReturnValue([{
      id: 's1', tool: 'reframe', signal_type: 'demo_seed', created_at: '',
      signal_data: { doubted_count: 1, total_premises: 3, ai_only_steps: 1, human_only_steps: 1, total_steps: 4, completed: true },
    }]);

    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('reframe', profile);
    // "모두 수락" (challenge)이면 안 됨
    expect(coaching[0].message).not.toContain('coaching.reframe.demoAllAccepted');
    // "모두 의심" (strong positive)이면 안 됨
    expect(coaching[0].message).not.toContain('coaching.reframe.demoAllDoubted');
    // partial doubted with doubted=1 param
    expect(coaching[0].message).toContain('coaching.reframe.demoPartialDoubted');
    expect(coaching[0].tone).toBe('positive');
  });

  // 8. 가정 evaluation 1건만으로 "항상 의심한다" 추론 금지
  it('가정 평가 1건으로 사용자 성향을 단정하면 안 된다', () => {
    setupScenario({ sessions: 2, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_reframe_list') return [{
        id: 'rf-1', status: 'done',
        analysis: {
          surface_task: 'test', reframed_question: 'reframed',
          why_reframing_matters: '', hidden_questions: [], ai_limitations: [],
          alternative_framings: [], reasoning_narrative: '',
          hidden_assumptions: [
            { assumption: '가정1', risk_if_false: 'r', axis: 'business', evaluation: 'doubtful' },
          ],
        },
      }];
      if (key === 'sot_judgments') return [];
      return [];
    });

    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('recast', profile);
    // 1건이라도 불확실 가정이 있으면 코칭은 나올 수 있지만
    // "항상", "일관되게" 같은 패턴 주장은 없어야 한다
    for (const c of coaching) {
      expect(c.message).not.toMatch(/항상|일관되게|매번/);
    }
  });

  // 9. actor override 1건으로 "사람 선호 경향" 금지
  it('actor override 1건으로 경향 판정 금지', () => {
    setupScenario({ sessions: 2, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_judgments') return [{
        id: 'j1', user_changed: true, type: 'actor_override', decision: 'human',
        tool: 'recast', context: '', original_ai_suggestion: '', created_at: '',
      }];
      return [];
    });

    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('recast', profile);
    // 1건으로는 "선호하시는 경향" 같은 말 금지
    const prefMsg = coaching.find(c => c.message.includes('경향') || c.message.includes('선호'));
    expect(prefMsg).toBeUndefined();
  });

  // 10. reframe 3/5 수락은 "과신"이 아니다
  it('reframe 3/5 수락은 과신 패턴이 아니다 — 프롬프트 주입 안 됨', () => {
    setupScenario({
      sessions: 5, projects: 2,
      // 5개 중 3개만 수락 (60%)
      reframeItems: [
        ...makeReframeItems(3, ['customer_value', 'business'], true),  // 수락
        ...makeReframeItems(2, ['customer_value', 'business'], false), // 수정
      ],
      judgments: [{ id: 'j1', user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' }],
    });
    mockStageEval.mockReturnValue(null);

    const prompt = buildEnhancedSystemPrompt('기본');
    // 60% 수락은 80% 임계값 미달이므로 수락 패턴 주입 안 됨
    expect(prompt).not.toContain('수락');
  });

  // 11. refine 1회로 "수렴 패턴" 판정 불가
  it('refine loop 1개로 수렴 패턴을 주장하면 안 된다', () => {
    setupScenario({ sessions: 3, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_refine_loops') return [{
        id: 'loop-1', project_id: 'p0', status: 'converged',
        iterations: [
          { convergence: { total_issues: 5, critical_risks: 1 } },
          { convergence: { total_issues: 2, critical_risks: 0 } },
        ],
        created_at: '',
      }];
      return [];
    });

    // convergencePatterns는 completed >= 2에서만 작동
    // 1개면 "빠르게 수렴하는 편" 같은 말 안 해야
    const prompt = buildEnhancedSystemPrompt('기본');
    expect(prompt).not.toContain('수렴 패턴');
    expect(prompt).not.toContain('빠르게 수렴');
  });

  // 12. 정확히 5회 세션 + 얇은 데이터에서 프롬프트 주입의 보수성
  it('5회차에서 데이터가 얇으면 프롬프트 주입이 최소화되어야 한다', () => {
    setupScenario({
      sessions: 5, projects: 1,
      // 5개 reframe이지만 각각 가정 1개씩만 (매우 얇은 데이터)
      reframeItems: Array.from({ length: 5 }, (_, i) => makeReframeItems(1, ['customer_value'])[0]),
      judgments: [{ id: 'j1', user_changed: false, type: 'actor_override', decision: 'ai', tool: 'recast', context: '', original_ai_suggestion: '', created_at: '' }],
    });
    mockStageEval.mockReturnValue({
      tool: 'reframe', total_sessions: 5, avg_pass_rate: 0.7, worst_eval: null,
      per_eval_rates: { assumptions_diverse: 0.7, assumptions_engaged: 0.7 },
    });

    const prompt = buildEnhancedSystemPrompt('기본');
    // 5개 × 1가정 = 5가정, 전부 customer_value
    // 다른 축이 0%이지만 총 가정이 5개뿐 → gap 판정은 할 수 있다
    // 하지만 "대안적 프레이밍" 주장은 안 해야 (수락률 체크에 필요한 데이터 부족)
    if (prompt.includes('적응형 컨텍스트')) {
      // 주입이 됐다면, 최대 2-3줄이어야 (과잉 금지)
      const adaptiveSection = prompt.split('적응형 컨텍스트')[1];
      const lines = adaptiveSection.split('\n').filter(l => l.startsWith('- 참고:'));
      expect(lines.length).toBeLessThanOrEqual(3);
    }
  });

  // 13. blind spot: reframe 3개, 가정 총 3개 (각 1개씩) → 추천 자제
  it('가정 총 3개로 blind spot 페르소나 추천 자제', () => {
    setupScenario({ sessions: 3, projects: 1 });
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_reframe_list') return [
        makeReframeItems(1, ['customer_value'])[0],
        makeReframeItems(1, ['business'])[0],
        makeReframeItems(1, ['feasibility'])[0],
        // 각 1개씩 = 총 3개, org_capacity 0이지만 표본 부족
      ];
      return [];
    });

    const rec = recommendBlindSpotPersona([]);
    // 총 3개 가정은 recommendBlindSpotPersona의 total < 4 조건에 걸림
    expect(rec).toBeNull();
  });

  // 14. DQ 점수 전부 동일 → "안정"이지 "정체"가 아님, delta = 0이어야
  it('DQ 전부 동일 (60, 60, 60) → 개선도 하락도 아닌 순수 안정', () => {
    const scores = makeDQScores([
      { dq: 60, frame: 3, date: '2026-01-01' },
      { dq: 60, frame: 3, date: '2026-02-01' },
      { dq: 60, frame: 3, date: '2026-03-01' },
    ]);
    setupScenario({
      sessions: 6, projects: 3, dqScores: scores,
      dqTrend: { trend: 'stable', avg_dq: 60 },
    });

    const curve = buildLearningCurve();
    expect(curve.trend).toBe('stable');
    expect(curve.improvement_delta).toBe(0);
    expect(curve.most_improved_element).toBeNull();

    // refine 코칭에서 "개선"이나 "하락" 언급 없어야
    mockStorage.mockImplementation((key: string) => {
      if (key === 'sot_dq_scores') return scores;
      if (key === 'sot_projects') return [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }];
      return [];
    });
    const profile = buildNavigatorProfile();
    const coaching = getStepCoaching('refine', profile);
    const dqMsg = coaching.find(c => c.message.includes('coaching.refine.dqImproving') || c.message.includes('coaching.refine.dqDeclining'));
    expect(dqMsg).toBeUndefined();
  });
});
