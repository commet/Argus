import { describe, expect, it, vi } from 'vitest';
import type { WorkerTask } from '@/stores/types';

const mocks = vi.hoisted(() => ({
  planTask: vi.fn(),
  executePlan: vi.fn(),
  stream: vi.fn((_messages: unknown, _options: unknown, callbacks: { onComplete: (text: string) => void }) => {
    callbacks.onComplete('one bounded review');
  }),
}));

vi.mock('@/lib/llm', () => ({ callLLMStream: mocks.stream }));
vi.mock('@/lib/agent-planner', () => ({
  shouldPlan: vi.fn(() => true),
  planTask: mocks.planTask,
  executePlan: mocks.executePlan,
}));
vi.mock('@/lib/worker-quality', () => ({
  validateWorkerOutput: vi.fn(async () => ({ score: 90, passed: true, issues: [] })),
  checkSpecificity: vi.fn(() => ({ score: 80, issues: [] })),
}));
vi.mock('@/stores/useAgentStore', () => ({
  useAgentStore: {
    getState: () => ({
      getAgent: () => ({
        id: 'builtin-reviewer',
        name: 'Reviewer',
        nameEn: 'Reviewer',
        role: 'Review',
        roleEn: 'Review',
        level: 5,
        capabilities: [],
      }),
      recordActivity: vi.fn(),
    }),
  },
}));
vi.mock('@/lib/agent-tools', () => ({ gatherToolContext: () => '' }));
vi.mock('@/lib/agent-prompt-builder', () => ({
  buildSearchContext: () => '',
  buildAgentContext: () => '',
}));

import { runWorkerTask } from '@/lib/worker-engine';

const worker = {
  id: 'w1',
  task: 'Analyze a complex irreversible choice',
  expected_output: 'A bounded independent review',
  who: 'ai',
  agent_type: 'ai',
  agent_id: 'builtin-reviewer',
  level: 'senior',
  status: 'pending',
  persona: null,
  stream_text: '',
  result: null,
  human_input: null,
  error: null,
  approved: null,
  completion_note: null,
  started_at: null,
  completed_at: null,
} as WorkerTask;

describe('bounded decision-workspace orchestration', () => {
  it('runs one reviewer call and blocks that reviewer from spawning a private sub-team', async () => {
    const result = await runWorkerTask(worker, {
      problemText: 'A consequential decision',
      realQuestion: 'What does this turn on?',
      skeleton: [],
      hiddenAssumptions: [],
      qaHistory: [],
      allowAutonomousPlanning: false,
    }, () => {});

    expect(result.text).toBe('one bounded review');
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(mocks.planTask).not.toHaveBeenCalled();
    expect(mocks.executePlan).not.toHaveBeenCalled();
  });
});
