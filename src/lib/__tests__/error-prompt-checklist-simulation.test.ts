/**
 * Error Handler + Prompt Mutation + Checklist Simulation
 *
 * 3개 중간 우선순위 모듈 통합 테스트 (25개):
 * - error-handler.ts: classifyError, handleError, withRetry
 * - prompt-mutation.ts: getWorstPerformingEvals, applyPromptMutations
 * - checklist.ts: generateChecklist
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Error Handler mocks ───

vi.mock('@/lib/logger', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Prompt Mutation & Checklist share storage mock ───

vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn(() => []),
  setStorage: vi.fn(),
  STORAGE_KEYS: {
    REFRAME_LIST: 'sot_reframe_list',
    RECAST_LIST: 'sot_recast_list',
    FEEDBACK_HISTORY: 'sot_feedback_history',
  },
}));

import { classifyError, handleError, withRetry } from '@/lib/error-handler';
import { getWorstPerformingEvals, applyPromptMutations } from '@/lib/prompt-mutation';
import { generateChecklist } from '@/lib/checklist';
import { getStorage } from '@/lib/storage';
import type { Project, ReframeItem, RecastItem, FeedbackRecord } from '@/stores/types';
import type { EvalResult } from '@/lib/eval-engine';

const mockGetStorage = vi.mocked(getStorage);

// ═══════════════════════════════════════════
// 1. error-handler.ts
// ═══════════════════════════════════════════

describe('Error Handler', () => {
  describe('classifyError', () => {
    it('1: TypeError with "fetch" -> network, retryable', () => {
      const err = new TypeError('Failed to fetch');
      const result = classifyError(err);
      expect(result.category).toBe('network');
      expect(result.retryable).toBe(true);
    });

    it('2: Error with "429" -> llm, retryable', () => {
      const err = new Error('API returned 429');
      const result = classifyError(err);
      expect(result.category).toBe('llm');
      expect(result.retryable).toBe(true);
    });

    it('3: Error with "rate limit" -> llm, retryable', () => {
      const err = new Error('rate limit exceeded');
      const result = classifyError(err);
      expect(result.category).toBe('llm');
      expect(result.retryable).toBe(true);
    });

    it('4: Error with "anthropic" -> llm, NOT retryable', () => {
      const err = new Error('anthropic API error');
      const result = classifyError(err);
      expect(result.category).toBe('llm');
      expect(result.retryable).toBe(false);
    });

    it('5: Error with "401" -> auth, NOT retryable', () => {
      const err = new Error('HTTP 401 unauthorized');
      const result = classifyError(err);
      expect(result.category).toBe('auth');
      expect(result.retryable).toBe(false);
    });

    it('6: Error with "unauthorized" -> auth', () => {
      const err = new Error('unauthorized access');
      const result = classifyError(err);
      expect(result.category).toBe('auth');
      expect(result.retryable).toBe(false);
    });

    it('7: Error with "localstorage" -> storage, NOT retryable', () => {
      const err = new Error('localstorage quota exceeded');
      const result = classifyError(err);
      expect(result.category).toBe('storage');
      expect(result.retryable).toBe(false);
    });

    it('8: Error with "supabase" -> storage, retryable', () => {
      const err = new Error('supabase connection timeout');
      const result = classifyError(err);
      expect(result.category).toBe('storage');
      expect(result.retryable).toBe(true);
    });

    it('9: Non-Error value -> unknown', () => {
      const result = classifyError('just a string');
      expect(result.category).toBe('unknown');
      expect(result.retryable).toBe(false);
      expect(result.message).toBe('just a string');
    });

    it('10: Generic Error -> unknown', () => {
      const err = new Error('something went wrong');
      const result = classifyError(err);
      expect(result.category).toBe('unknown');
      expect(result.retryable).toBe(false);
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('11: succeeds on first try -> returns result', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await withRetry(fn, { maxRetries: 2 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('12: retries on retryable error, succeeds on 2nd try', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce('recovered');

      const promise = withRetry(fn, { maxRetries: 2, baseDelay: 1000 });

      // First call fails immediately, timer starts for 1000ms delay
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('13: throws after max retries exceeded', async () => {
      const networkError = new TypeError('Failed to fetch');
      const fn = vi.fn().mockRejectedValue(networkError);

      const promise = withRetry(fn, { maxRetries: 2, baseDelay: 1000 });

      // Attach catch handler immediately to prevent unhandled rejection
      const caughtPromise = promise.catch((e) => e);

      // attempt 0 fails -> wait 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      // attempt 1 fails -> wait 2000ms
      await vi.advanceTimersByTimeAsync(2000);
      // attempt 2 fails -> no more retries, throws

      const error = await caughtPromise;
      expect(error).toBeInstanceOf(TypeError);
      expect((error as TypeError).message).toBe('Failed to fetch');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('14: does NOT retry non-retryable errors (immediately throws)', async () => {
      const authError = new Error('unauthorized');
      const fn = vi.fn().mockRejectedValue(authError);

      await expect(
        withRetry(fn, { maxRetries: 3, baseDelay: 1000 })
      ).rejects.toThrow('unauthorized');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});

// ═══════════════════════════════════════════
// 2. prompt-mutation.ts
// ═══════════════════════════════════════════

function makeEvalResult(
  evals: Record<string, boolean>,
  overrides: Partial<EvalResult> = {}
): EvalResult {
  return {
    id: `eval-${Math.random().toString(36).slice(2)}`,
    item_id: 'item-1',
    strategy: null,
    interview_signals: null,
    evals,
    pass_rate: 0,
    recorded_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Prompt Mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStorage.mockReturnValue([]);
  });

  it('15: returns empty when no eval history', () => {
    mockGetStorage.mockReturnValue([]);
    const result = getWorstPerformingEvals('reframe');
    expect(result).toEqual([]);
  });

  it('16: returns mutations for evals with < 0.4 pass rate', () => {
    // Create 6 samples (above MIN_SAMPLES=5) where question_accepted mostly fails
    const history: EvalResult[] = Array.from({ length: 6 }, () =>
      makeEvalResult({
        question_accepted: false,  // 0/6 = 0.0 pass rate
        assumptions_engaged: true, // 6/6 = 1.0 pass rate
      })
    );

    mockGetStorage.mockReturnValue(history);
    const result = getWorstPerformingEvals('reframe');

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(m => m.evalId === 'question_accepted')).toBe(true);
    expect(result.every(m => m.passRate < 0.4)).toBe(true);
  });

  it('17: does not return mutations for evals with >= 0.4 pass rate', () => {
    // All evals pass -> all pass rates = 1.0
    const history: EvalResult[] = Array.from({ length: 6 }, () =>
      makeEvalResult({
        question_accepted: true,
        assumptions_engaged: true,
      })
    );

    mockGetStorage.mockReturnValue(history);
    const result = getWorstPerformingEvals('reframe');
    expect(result).toEqual([]);
  });

  it('18: applyPromptMutations appends instructions to base prompt', () => {
    // All fail -> mutations get applied
    const history: EvalResult[] = Array.from({ length: 6 }, () =>
      makeEvalResult({
        question_accepted: false,
        assumptions_engaged: false,
      })
    );

    mockGetStorage.mockReturnValue(history);
    const basePrompt = 'You are a reframing assistant.';
    const result = applyPromptMutations(basePrompt, 'reframe');

    expect(result).toContain(basePrompt);
    expect(result).toContain('[자동 보정 — eval 기반]');
    expect(result.length).toBeGreaterThan(basePrompt.length);
  });

  it('19: returns empty when no failing evals (all pass)', () => {
    const history: EvalResult[] = Array.from({ length: 6 }, () =>
      makeEvalResult({
        question_accepted: true,
        assumptions_engaged: true,
        no_immediate_reanalyze: true,
      })
    );

    mockGetStorage.mockReturnValue(history);
    const result = getWorstPerformingEvals('reframe');
    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════
// 3. checklist.ts
// ═══════════════════════════════════════════

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
    input_text: 'Should we expand?',
    analysis: {
      surface_task: 'Market expansion decision',
      reframed_question: 'What conditions make expansion viable?',
      why_reframing_matters: 'Avoids premature commitment',
      reasoning_narrative: 'The real question is...',
      hidden_assumptions: [
        { assumption: 'Market is ready', impact: 'high', evidence: 'none' },
      ],
      hidden_questions: [
        { question: 'Who is the real customer?', why_it_matters: 'Defines strategy' },
      ],
      ai_limitations: ['Cannot predict market timing', 'Lacks industry-specific data'],
    },
    selected_question: 'What conditions make expansion viable?',
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
    input_text: 'Expansion plan',
    analysis: {
      governing_idea: 'Phased expansion',
      storyline: {
        situation: 'Growing demand',
        complication: 'Limited resources',
        resolution: 'Phase approach',
      },
      goal_summary: 'Expand market presence',
      steps: [
        {
          task: 'Research target market',
          actor: 'ai' as const,
          actor_reasoning: 'Data gathering',
          expected_output: 'Market report',
          checkpoint: false,
          checkpoint_reason: '',
          estimated_time: '2 days',
        },
        {
          task: 'Decide go/no-go',
          actor: 'human' as const,
          actor_reasoning: 'Strategic judgment',
          expected_output: 'Decision memo',
          checkpoint: true,
          checkpoint_reason: 'Critical decision point',
          estimated_time: '1 day',
        },
      ],
      key_assumptions: [
        {
          assumption: 'Market size is sufficient',
          importance: 'high' as const,
          certainty: 'medium' as const,
          if_wrong: 'Investment wasted',
        },
      ],
      critical_path: [0, 1],
      total_estimated_time: '3 days',
      ai_ratio: 0.5,
      human_ratio: 0.5,
    },
    steps: [],
    status: 'done',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStorage.mockReturnValue([]);
  });

  it('20: returns empty for null project', () => {
    const result = generateChecklist(null);
    expect(result).toBe('');
  });

  it('21: generates header with project name', () => {
    // First getStorage call is SETTINGS (via getCurrentLanguage). Pin ko so the
    // header renders in Korean — matches the pattern in tests 22–25.
    mockGetStorage.mockReturnValueOnce({ language: 'ko' });
    const project = makeProject({ name: 'Alpha Launch' });
    const result = generateChecklist(project);
    expect(result).toContain('# 실행 체크리스트: Alpha Launch');
    expect(result).toContain('Generated by Argus');
  });

  it('22: includes core question section when reframe data exists', () => {
    const project = makeProject();
    const reframeItem = makeReframeItem();

    // getStorage is called 4 times: settings (via getCurrentLanguage), reframe, recast, feedback
    mockGetStorage
      .mockReturnValueOnce({ language: 'ko' }) // SETTINGS (for getCurrentLanguage)
      .mockReturnValueOnce([reframeItem])   // REFRAME_LIST
      .mockReturnValueOnce([])              // RECAST_LIST
      .mockReturnValueOnce([]);             // FEEDBACK_HISTORY

    const result = generateChecklist(project);
    expect(result).toContain('## 핵심 질문');
    expect(result).toContain('What conditions make expansion viable?');
  });

  it('23: includes assumptions section when recast data has key_assumptions', () => {
    const project = makeProject();
    const recastItem = makeRecastItem();

    mockGetStorage
      .mockReturnValueOnce({ language: 'ko' }) // SETTINGS
      .mockReturnValueOnce([])              // REFRAME_LIST
      .mockReturnValueOnce([recastItem])    // RECAST_LIST
      .mockReturnValueOnce([]);             // FEEDBACK_HISTORY

    const result = generateChecklist(project);
    expect(result).toContain('## 가정 검증 체크포인트');
    expect(result).toContain('Market size is sufficient');
    expect(result).toContain('확신도: 중간');
  });

  it('24: includes steps section when recast data exists', () => {
    const project = makeProject();
    const recastItem = makeRecastItem();

    mockGetStorage
      .mockReturnValueOnce({ language: 'ko' }) // SETTINGS
      .mockReturnValueOnce([])              // REFRAME_LIST
      .mockReturnValueOnce([recastItem])    // RECAST_LIST
      .mockReturnValueOnce([]);             // FEEDBACK_HISTORY

    const result = generateChecklist(project);
    expect(result).toContain('## 실행 단계');
    expect(result).toContain('Research target market');
    expect(result).toContain('Decide go/no-go');
    expect(result).toContain('체크포인트: Critical decision point');
  });

  it('25: handles missing data gracefully', () => {
    const project = makeProject();
    // Return items with minimal/null data
    const emptyReframe: ReframeItem = {
      id: 'r-empty',
      project_id: 'proj-1',
      input_text: '',
      analysis: null,
      selected_question: '',
      status: 'done',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const emptyRecast: RecastItem = {
      id: 'rc-empty',
      project_id: 'proj-1',
      input_text: '',
      analysis: null,
      steps: [],
      status: 'done',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockGetStorage
      .mockReturnValueOnce({ language: 'ko' }) // SETTINGS
      .mockReturnValueOnce([emptyReframe])  // REFRAME_LIST
      .mockReturnValueOnce([emptyRecast])   // RECAST_LIST
      .mockReturnValueOnce([]);             // FEEDBACK_HISTORY

    const result = generateChecklist(project);
    // Should not crash, should still have header and footer
    expect(result).toContain('# 실행 체크리스트: Test Project');
    expect(result).toContain('Generated by Argus');
    // Should NOT contain sections that depend on null analysis
    expect(result).not.toContain('## 핵심 질문');
    expect(result).not.toContain('## 가정 검증 체크포인트');
  });
});
