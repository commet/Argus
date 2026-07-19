/**
 * Document Generators Simulation
 *
 * 3개 문서 생성기 공통 패턴 검증:
 * - generateDecisionRationale (판단 근거서)
 * - generateProjectBrief (프로젝트 브리프)
 * - generateAgentSpec (에이전트 스펙)
 *
 * 공통 테스트:
 * - null 프로젝트 → 빈 문자열
 * - 프로젝트명 포함 헤더 생성
 * - 스토리지 데이터 기반 콘텐츠 생성
 * - 빈/누락 데이터 안전 처리
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ insertToSupabase: vi.fn() }));

let mockStorage: Record<string, unknown> = {};
vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn((key: string, fallback: unknown) => mockStorage[key] ?? fallback),
  setStorage: vi.fn(),
  STORAGE_KEYS: {
    REFRAME_LIST: 'sot_reframe_list',
    RECAST_LIST: 'sot_recast_list',
    FEEDBACK_HISTORY: 'sot_feedback_history',
    PERSONAS: 'sot_personas',
    JUDGMENTS: 'sot_judgments',
    SYNTHESIZE_LIST: 'sot_synthesize_list',
    PROGRESSIVE_SESSIONS: 'sot_progressive_sessions',
    SETTINGS: 'sot_settings',
  },
}));

vi.mock('@/lib/context-chain', () => ({
  buildReframeContext: vi.fn(() => ({
    surface_task: '테스트 과제',
    reframed_question: '재정의된 질문',
    why_reframing_matters: '중요한 이유',
    selected_direction: '',
    unverified_assumptions: [{ assumption: '가정1', risk_if_false: '위험1', verified: false }],
    verified_assumptions: [],
    ai_limitations: ['AI 한계'],
  })),
}));

vi.mock('@/lib/output-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/output-helpers')>();
  return actual;
});

import { generateDecisionRationale } from '@/lib/decision-rationale';
import { generateProjectBrief } from '@/lib/project-brief';
import { generateAgentSpec } from '@/lib/agent-spec';
import type { Project, ReframeItem, RecastItem, FeedbackRecord, JudgmentRecord } from '@/stores/types';
import { setModuleLocale } from '@/lib/i18n';

// i18n default is now 'en' (en-first). These suites verify the KOREAN prompt
// output, so pin the locale. The English branch is verified in Phase 3.
beforeEach(() => setModuleLocale('ko'));

// ── Helpers ──

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: '테스트 프로젝트',
    description: '설명',
    refs: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeReframe(overrides: Partial<ReframeItem> = {}): ReframeItem {
  return {
    id: 'rf-1',
    project_id: 'proj-1',
    input_text: '원래 과제 텍스트',
    analysis: {
      surface_task: '표면 과제',
      reframed_question: '재정의된 질문',
      why_reframing_matters: '재정의 이유',
      reasoning_narrative: '분석 내러티브',
      hidden_assumptions: [
        { assumption: '가정A', risk_if_false: '위험A', evaluation: 'doubtful', verified: false },
      ],
      hidden_questions: [
        { question: '질문1', reasoning: '이유1' },
        { question: '질문2', reasoning: '이유2' },
      ],
      ai_limitations: ['한계1'],
    },
    selected_question: '질문1',
    status: 'done',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeRecast(overrides: Partial<RecastItem> = {}): RecastItem {
  return {
    id: 'rc-1',
    project_id: 'proj-1',
    input_text: '실행 설계 입력',
    analysis: {
      governing_idea: '핵심 방향',
      storyline: { situation: '상황', complication: '문제', resolution: '해결' },
      goal_summary: '목표 요약',
      steps: [],
      key_assumptions: [],
      critical_path: [1],
      total_estimated_time: '3시간',
      ai_ratio: 60,
      human_ratio: 40,
      design_rationale: '설계 근거',
    },
    steps: [
      {
        task: '데이터 수집',
        actor: 'ai' as const,
        actor_reasoning: 'AI가 적합',
        expected_output: '데이터셋',
        checkpoint: false,
        checkpoint_reason: '',
      },
      {
        task: '판단 내리기',
        actor: 'human' as const,
        actor_reasoning: '사람이 판단',
        expected_output: '결정',
        checkpoint: true,
        checkpoint_reason: '최종 확인 필요',
        judgment: '핵심 판단 포인트',
      },
    ],
    status: 'done',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFeedback(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: 'fb-1',
    project_id: 'proj-1',
    document_title: '테스트 문서',
    document_text: '문서 내용',
    persona_ids: ['persona-1'],
    feedback_perspective: '비판적',
    feedback_intensity: '강',
    results: [
      {
        persona_id: 'persona-1',
        overall_reaction: '우려가 큼',
        failure_scenario: '실패 시나리오 설명',
        untested_assumptions: [],
        classified_risks: [
          { text: '핵심 위험', category: 'critical' },
          { text: '침묵 위험', category: 'unspoken' },
        ],
        first_questions: ['질문A'],
        praise: ['칭찬A'],
        concerns: ['우려A'],
        wants_more: ['더 필요A'],
        approval_conditions: ['조건A'],
      },
    ],
    synthesis: '종합 분석 텍스트',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeJudgment(overrides: Partial<JudgmentRecord> = {}): JudgmentRecord {
  return {
    id: 'j-1',
    type: 'actor_override',
    context: 'Step 1 역할',
    decision: 'human으로 변경',
    original_ai_suggestion: 'ai',
    user_changed: true,
    project_id: 'proj-1',
    tool: 'recast',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Tests ──

describe('Document Generators Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};
  });

  // ════════════════════════════════════════════
  // generateDecisionRationale
  // ════════════════════════════════════════════
  describe('generateDecisionRationale', () => {
    it('null 프로젝트 → 빈 문자열', () => {
      expect(generateDecisionRationale(null)).toBe('');
    });

    it('프로젝트명이 포함된 헤더 생성', () => {
      const result = generateDecisionRationale(makeProject({ name: '신규 서비스 런칭' }));
      expect(result).toContain('# 판단 근거서: 신규 서비스 런칭');
    });

    it('reframe 데이터로 과제 재정의 섹션 포함', () => {
      mockStorage = {
        sot_reframe_list: [makeReframe()],
        sot_recast_list: [],
        sot_feedback_history: [],
        sot_personas: [],
        sot_judgments: [],
      };
      const result = generateDecisionRationale(makeProject());
      expect(result).toContain('## 1. 과제 재정의');
      expect(result).toContain('표면 과제');
      expect(result).toContain('질문1');
      expect(result).toContain('한계1');
    });

    it('recast 데이터로 실행 설계 섹션 포함', () => {
      mockStorage = {
        sot_reframe_list: [],
        sot_recast_list: [makeRecast()],
        sot_feedback_history: [],
        sot_personas: [],
        sot_judgments: [],
      };
      const result = generateDecisionRationale(makeProject());
      expect(result).toContain('## 2. 실행 설계 근거');
      expect(result).toContain('핵심 방향');
      expect(result).toContain('데이터 수집');
      expect(result).toContain('판단 내리기');
    });

    it('feedback 데이터로 이해관계자 검증 섹션 포함', () => {
      mockStorage = {
        sot_reframe_list: [],
        sot_recast_list: [],
        sot_feedback_history: [makeFeedback()],
        sot_personas: [{ id: 'persona-1', name: 'CTO', influence: 'high' }],
        sot_judgments: [],
      };
      const result = generateDecisionRationale(makeProject());
      expect(result).toContain('## 3. 이해관계자 검증');
      expect(result).toContain('CTO');
      expect(result).toContain('(영향력 높음)');
      expect(result).toContain('핵심 위험');
      expect(result).toContain('조건A');
    });

    it('judgment 이력 포함 (user_changed)', () => {
      mockStorage = {
        sot_reframe_list: [],
        sot_recast_list: [],
        sot_feedback_history: [],
        sot_personas: [],
        sot_judgments: [makeJudgment()],
      };
      const result = generateDecisionRationale(makeProject());
      expect(result).toContain('## 4. 판단 이력');
      expect(result).toContain('역할 변경');
      expect(result).toContain('AI 제안 수정 1건');
    });

    it('빈 스토리지에서 헤더와 푸터만 출력', () => {
      const result = generateDecisionRationale(makeProject());
      expect(result).toContain('# 판단 근거서');
      expect(result).toContain('Argus 판단 근거서');
      expect(result).not.toContain('## 1.');
      expect(result).not.toContain('## 2.');
    });
  });

  // ════════════════════════════════════════════
  // generateProjectBrief
  // ════════════════════════════════════════════
  describe('generateProjectBrief', () => {
    it('null 프로젝트 → 빈 문자열', () => {
      expect(generateProjectBrief(null)).toBe('');
    });

    it('프로젝트명이 포함된 헤더 생성', () => {
      const result = generateProjectBrief(makeProject({ name: '시장 분석' }));
      expect(result).toContain('# 시장 분석');
      expect(result).toContain('Argus Project Brief');
    });

    it('reframe 데이터로 사고 궤적 + 문제 재정의 포함', () => {
      mockStorage = {
        sot_reframe_list: [makeReframe()],
        sot_recast_list: [],
        sot_feedback_history: [],
        sot_synthesize_list: [],
      };
      const result = generateProjectBrief(makeProject());
      expect(result).toContain('## 사고의 궤적');
      expect(result).toContain('## 1. 항로 재설정 | 문제 재정의');
      expect(result).toContain('표면 과제');
      expect(result).toContain('질문1');
      expect(result).toContain('한계1');
    });

    it('recast 데이터로 실행 설계 테이블 포함', () => {
      mockStorage = {
        sot_reframe_list: [],
        sot_recast_list: [makeRecast()],
        sot_feedback_history: [],
        sot_synthesize_list: [],
      };
      const result = generateProjectBrief(makeProject());
      expect(result).toContain('## 2. 선원 배치 | 실행 설계');
      expect(result).toContain('목표 요약');
      expect(result).toContain('데이터 수집');
    });

    it('feedback 데이터로 리허설 섹션 포함', () => {
      mockStorage = {
        sot_reframe_list: [],
        sot_recast_list: [],
        sot_feedback_history: [makeFeedback()],
        sot_synthesize_list: [],
      };
      const result = generateProjectBrief(makeProject());
      expect(result).toContain('## 4. 리허설 | 사전 검증');
      expect(result).toContain('우려A');
      expect(result).toContain('칭찬A');
      expect(result).toContain('종합 분석 텍스트');
    });

    it('새 항해 프로젝트의 실제 결과물과 요약을 포함', () => {
      mockStorage = {
        sot_reframe_list: [],
        sot_recast_list: [],
        sot_feedback_history: [],
        sot_synthesize_list: [],
        sot_progressive_sessions: [{
          id: 'session-1',
          project_id: 'proj-1',
          problem_text: 'AI 시대의 물류 전략을 정한다',
          decision_maker: '전략 책임자',
          phase: 'complete',
          round: 2,
          max_rounds: 3,
          questions: [],
          answers: [],
          snapshots: [],
          workers: [],
          worker_deploy_phase: 'none',
          mix: {
            title: '물류 전략',
            executive_summary: '자동화보다 데이터 표준화를 먼저 진행한다.',
            sections: [],
            key_assumptions: ['화주 데이터 연동이 가능하다'],
            next_steps: ['핵심 고객 3곳과 인터뷰한다'],
          },
          dm_feedback: null,
          final_deliverable: '# 실행안\n\n첫 90일 계획',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        }],
      };

      const result = generateProjectBrief(makeProject());

      expect(result).toContain('## 프로젝트 요약');
      expect(result).toContain('자동화보다 데이터 표준화를 먼저 진행한다.');
      expect(result).toContain('## 최종 결과물');
      expect(result).toContain('첫 90일 계획');
    });

    it('프로젝트의 판단과 확인 계획을 포함', () => {
      const result = generateProjectBrief(makeProject({
        decision_contract: {
          id: 'contract-1',
          project_id: 'proj-1',
          created_at: '2026-01-01T00:00:00Z',
          check_in_at: '2026-07-26T00:00:00Z',
          predicates: [{ id: 'p-1', source: 'governing_idea', text: '3개월 안에 물류비가 10% 줄어든다', verdict: 'pending' }],
          judgment_receipt: {
            real_question: '실제로 비용이 줄었는가?',
            unverified_assumption: '데이터 연동이 가능하다',
            human_only: '최종 투자 판단',
            human_judgment: '데이터 표준화를 먼저 한다',
          },
        },
      }));

      expect(result).toContain('## 판단과 확인 계획');
      expect(result).toContain('데이터 표준화를 먼저 한다');
      expect(result).toContain('실제로 비용이 줄었는가?');
      expect(result).toContain('3개월 안에 물류비가 10% 줄어든다');
    });

    it('analysis null인 reframe은 내부 콘텐츠 없음', () => {
      mockStorage = {
        sot_reframe_list: [makeReframe({ analysis: null })],
        sot_recast_list: [],
        sot_feedback_history: [],
        sot_synthesize_list: [],
      };
      const result = generateProjectBrief(makeProject());
      // 섹션 헤더는 출력되지만 analysis 하위 내용은 없음
      expect(result).toContain('## 1. 항로 재설정');
      expect(result).not.toContain('### 표면 과제');
      expect(result).not.toContain('### 전제 점검 결과');
    });

    it('빈 스토리지에서 헤더와 푸터만 출력', () => {
      const result = generateProjectBrief(makeProject());
      expect(result).toContain('# 테스트 프로젝트');
      expect(result).toContain('Generated by Argus');
      expect(result).not.toContain('## 사고의 궤적');
      expect(result).not.toContain('## 2.');
    });
  });

  // ════════════════════════════════════════════
  // generateAgentSpec
  // ════════════════════════════════════════════
  describe('generateAgentSpec', () => {
    it('null 프로젝트 → project name은 Untitled', () => {
      const result = generateAgentSpec(null);
      expect(result).toContain('name: "Untitled"');
    });

    it('프로젝트명 포함된 YAML 헤더 생성', () => {
      const result = generateAgentSpec(makeProject({ name: 'AI 전략' }));
      expect(result).toContain('# Argus Agent Spec');
      expect(result).toContain('name: "AI 전략"');
    });

    it('reframe 데이터로 task_definition + context_chain 생성', () => {
      mockStorage = {
        sot_reframe_list: [makeReframe()],
        sot_recast_list: [],
        sot_feedback_history: [],
      };
      const result = generateAgentSpec(makeProject());
      expect(result).toContain('task_definition:');
      expect(result).toContain('surface_task: "표면 과제"');
      expect(result).toContain('reframed_question: "질문1"');
      expect(result).toContain('context_chain:');
      expect(result).toContain('가정A');
    });

    it('recast 데이터로 workflow 섹션 생성', () => {
      mockStorage = {
        sot_reframe_list: [],
        sot_recast_list: [makeRecast()],
        sot_feedback_history: [],
      };
      const result = generateAgentSpec(makeProject());
      expect(result).toContain('workflow:');
      expect(result).toContain('goal: "목표 요약"');
      expect(result).toContain('task: "데이터 수집"');
      expect(result).toContain('actor: ai');
      expect(result).toContain('checkpoint: true');
    });

    it('feedback 데이터로 evaluation + guardrails 생성', () => {
      mockStorage = {
        sot_reframe_list: [],
        sot_recast_list: [],
        sot_feedback_history: [makeFeedback()],
      };
      const result = generateAgentSpec(makeProject());
      expect(result).toContain('evaluation:');
      expect(result).toContain('perspective: "비판적"');
      expect(result).toContain('overall_reaction: "우려가 큼"');
      expect(result).toContain('guardrails:');
      expect(result).toContain('must_address:');
      expect(result).toContain('우려A');
    });

    it('feedback의 critical risk가 context_chain.risks_addressed에 포함', () => {
      mockStorage = {
        sot_reframe_list: [makeReframe()],
        sot_recast_list: [],
        sot_feedback_history: [makeFeedback()],
      };
      const result = generateAgentSpec(makeProject());
      expect(result).toContain('risks_addressed:');
      expect(result).toContain('핵심 위험');
    });

    it('빈 스토리지에서 project 헤더만 출력', () => {
      const result = generateAgentSpec(makeProject());
      expect(result).toContain('project:');
      expect(result).toContain('name: "테스트 프로젝트"');
      expect(result).not.toContain('task_definition:');
      expect(result).not.toContain('workflow:');
      expect(result).not.toContain('evaluation:');
    });
  });
});
