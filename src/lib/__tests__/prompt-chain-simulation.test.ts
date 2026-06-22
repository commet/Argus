/**
 * Prompt Chain Simulation — generatePromptChain 검증
 *
 * 핵심 검증:
 * - null project 처리
 * - 헤더/푸터 생성
 * - AI / human / checkpoint 단계별 프롬프트 형태
 * - reframe context 주입 (핵심 질문, 미확인 전제)
 * - feedback constraints 주입
 * - recast 없을 때 decomposition fallback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Project, ReframeItem, RecastItem, FeedbackRecord } from '@/stores/types';

vi.mock('@/lib/db', () => ({
  insertToSupabase: vi.fn(),
}));

const mockStorage: Record<string, unknown> = {};
vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn((key: string, fallback: unknown) => mockStorage[key] ?? fallback),
  setStorage: vi.fn(),
  STORAGE_KEYS: {
    REFRAME_LIST: 'sot_reframe_list',
    RECAST_LIST: 'sot_recast_list',
    FEEDBACK_HISTORY: 'sot_feedback_history',
    SETTINGS: 'sot_settings',
  },
}));

vi.mock('@/lib/context-chain', () => ({
  buildReframeContext: vi.fn(() => ({
    surface_task: 'Surface task text',
    reframed_question: 'Reframed question text',
    why_reframing_matters: 'Because it matters',
    selected_direction: 'Selected direction text',
    unverified_assumptions: [
      { assumption: 'Users want this feature', risk_if_false: 'Wasted effort', verified: false },
    ],
    verified_assumptions: [],
    ai_limitations: ['Cannot assess market sentiment'],
  })),
}));

import { generatePromptChain } from '@/lib/prompt-chain';
import { setModuleLocale } from '@/lib/i18n';

// i18n default is now 'en' (en-first). These suites verify the KOREAN prompt
// output, so pin the locale. The English branch is verified in Phase 3.
beforeEach(() => setModuleLocale('ko'));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project',
    refs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeReframeItem(overrides: Partial<ReframeItem> = {}): ReframeItem {
  return {
    id: 'reframe-1',
    project_id: 'proj-1',
    input_text: 'How to grow revenue?',
    analysis: {
      surface_task: 'Grow revenue',
      reframed_question: 'What customer segments offer highest LTV?',
      why_reframing_matters: 'Focusing on LTV avoids churn traps',
      reasoning_narrative: 'Revenue growth is too broad',
      hidden_assumptions: [
        { assumption: 'Market is ready', risk_if_false: 'Launch fails', verified: false },
      ],
      hidden_questions: [],
      ai_limitations: ['Cannot predict market timing'],
    },
    selected_question: 'What customer segments offer highest LTV?',
    status: 'done',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeRecastItem(overrides: Partial<RecastItem> = {}): RecastItem {
  return {
    id: 'recast-1',
    project_id: 'proj-1',
    input_text: 'Execution plan',
    analysis: {
      governing_idea: 'Focus on high-LTV segments',
      storyline: { situation: 'S', complication: 'C', resolution: 'R' },
      goal_summary: 'Identify and capture high-LTV segments',
      steps: [],
      key_assumptions: [],
      critical_path: [1, 2],
      total_estimated_time: '2 weeks',
      ai_ratio: 0.6,
      human_ratio: 0.4,
    },
    steps: [
      {
        task: 'Analyze customer data',
        actor: 'ai',
        actor_reasoning: 'AI is good at data analysis',
        expected_output: 'Segment report',
        checkpoint: false,
        checkpoint_reason: '',
        estimated_time: '30min',
      },
      {
        task: 'Review analysis with team',
        actor: 'human',
        actor_reasoning: 'Human judgment needed for strategy',
        expected_output: 'Approved segments',
        checkpoint: false,
        checkpoint_reason: '',
        estimated_time: '1h',
      },
      {
        task: 'Validate key assumptions',
        actor: 'both',
        actor_reasoning: 'Cross-check needed',
        expected_output: 'Validated assumptions',
        checkpoint: true,
        checkpoint_reason: 'Critical decision point',
        estimated_time: '2h',
      },
    ],
    status: 'done',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeFeedbackRecord(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: 'fb-1',
    project_id: 'proj-1',
    document_title: 'Plan v1',
    document_text: 'The plan...',
    persona_ids: ['p-1'],
    feedback_perspective: '전반적 인상',
    feedback_intensity: '솔직하게',
    results: [
      {
        persona_id: 'p-1',
        overall_reaction: 'Concerned',
        failure_scenario: 'Market shifts',
        untested_assumptions: ['Pricing model'],
        classified_risks: [{ text: 'Competitor move', category: 'critical' }],
        first_questions: ['What is the timeline?', 'Who is responsible?'],
        praise: ['Clear structure'],
        concerns: ['Budget is unclear', 'Team capacity'],
        wants_more: ['Risk mitigation plan'],
        approval_conditions: ['Show ROI data'],
      },
    ],
    synthesis: 'Overall mixed feedback',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Prompt Chain Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear mockStorage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  });

  // ═══════════════════════════════════════
  // Null / empty cases
  // ═══════════════════════════════════════
  it('returns empty string for null project', () => {
    const result = generatePromptChain(null);
    expect(result).toBe('');
  });

  // ═══════════════════════════════════════
  // Header
  // ═══════════════════════════════════════
  it('generates header with project name', () => {
    const result = generatePromptChain(makeProject({ name: 'Revenue Growth Plan' }));
    expect(result).toContain('# 프롬프트 체인: Revenue Growth Plan');
    expect(result).toContain('Argus에서 생성');
  });

  // ═══════════════════════════════════════
  // AI step prompts
  // ═══════════════════════════════════════
  it('generates AI step prompts with code blocks', () => {
    mockStorage['sot_recast_list'] = [makeRecastItem()];
    mockStorage['sot_reframe_list'] = [makeReframeItem()];

    const result = generatePromptChain(makeProject());
    // AI step should have code block delimiters
    expect(result).toContain('```');
    // Should contain task
    expect(result).toContain('Analyze customer data');
    // Should have prompt header
    expect(result).toContain('Prompt 1/3');
    // Should contain AI label
    expect(result).toContain('AI');
  });

  // ═══════════════════════════════════════
  // Human-only steps
  // ═══════════════════════════════════════
  it('generates human-only steps without code blocks', () => {
    mockStorage['sot_recast_list'] = [makeRecastItem()];

    const result = generatePromptChain(makeProject());
    // Find the human step section
    const humanStepIndex = result.indexOf('Step 2/3');
    expect(humanStepIndex).toBeGreaterThan(-1);
    // Human step should have "직접 수행하세요"
    expect(result).toContain('직접 수행하세요');
    // The section between Step 2/3 and the next --- should NOT contain ``` code blocks
    const humanSection = result.slice(
      humanStepIndex,
      result.indexOf('---', humanStepIndex + 10)
    );
    expect(humanSection).not.toContain('```');
  });

  // ═══════════════════════════════════════
  // Checkpoint steps
  // ═══════════════════════════════════════
  it('generates checkpoint steps with checklist', () => {
    mockStorage['sot_recast_list'] = [makeRecastItem()];
    mockStorage['sot_feedback_history'] = [makeFeedbackRecord()];

    const result = generatePromptChain(makeProject());
    // Checkpoint step
    expect(result).toContain('Checkpoint 3/3');
    // Should have checkpoint instructions
    expect(result).toContain('직접 확인하세요');
    // Should include checkpoint_reason
    expect(result).toContain('Critical decision point');
  });

  // ═══════════════════════════════════════
  // Footer
  // ═══════════════════════════════════════
  it('includes footer', () => {
    const result = generatePromptChain(makeProject());
    expect(result).toContain('Generated by Argus');
  });

  // ═══════════════════════════════════════
  // Reframe context injection
  // ═══════════════════════════════════════
  it('includes reframe context (core question, assumptions)', () => {
    mockStorage['sot_reframe_list'] = [makeReframeItem()];
    mockStorage['sot_recast_list'] = [makeRecastItem()];

    const result = generatePromptChain(makeProject());
    // Core question from buildReframeContext mock (selected_direction)
    expect(result).toContain('Selected direction text');
    // Unverified assumptions from the mock
    expect(result).toContain('Users want this feature');
    // Why reframing matters
    expect(result).toContain('Because it matters');
  });

  // ═══════════════════════════════════════
  // Feedback constraints
  // ═══════════════════════════════════════
  it('includes feedback constraints', () => {
    mockStorage['sot_recast_list'] = [makeRecastItem()];
    mockStorage['sot_feedback_history'] = [makeFeedbackRecord()];

    const result = generatePromptChain(makeProject());
    // Concerns from feedback should appear as constraints
    expect(result).toContain('Budget is unclear');
    expect(result).toContain('Team capacity');
    // First questions should appear as constraints too
    expect(result).toContain('예상 질문 대비: What is the timeline?');
  });

  // ═══════════════════════════════════════
  // Fallback: decomposition only (no recasts)
  // ═══════════════════════════════════════
  it('falls back to single prompt when no recasts exist but decomposition exists', () => {
    mockStorage['sot_reframe_list'] = [makeReframeItem()];
    // No recast items

    const result = generatePromptChain(makeProject());
    // Should have a single prompt
    expect(result).toContain('Prompt 1/1');
    // Should reference the reframed question
    expect(result).toContain('What customer segments offer highest LTV?');
    // Should have code block for the prompt
    expect(result).toContain('```');
    // Should contain assumptions from analysis
    expect(result).toContain('Market is ready');
  });

  // ═══════════════════════════════════════
  // AI limitations in checkpoint
  // ═══════════════════════════════════════
  it('includes AI limitations in checkpoint steps', () => {
    mockStorage['sot_reframe_list'] = [makeReframeItem()];
    mockStorage['sot_recast_list'] = [makeRecastItem()];

    const result = generatePromptChain(makeProject());
    // AI limitations from buildReframeContext mock
    expect(result).toContain('Cannot assess market sentiment');
    expect(result).toContain('AI가 못하는 부분');
  });
});
