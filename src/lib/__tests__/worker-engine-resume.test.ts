/**
 * Crash-resume worker selection (workspace "다시 실행" stuck at 0/N).
 *
 * When a reload happens mid-run, useProgressiveStore's hydration resets in-flight
 * workers ('running'/'ai_preparing') back to 'pending'. The executor's filter only
 * AI-ran self/human-with-ai_scope workers when status === 'ai_preparing', so after
 * a reload every such worker was filtered out → aiWorkers empty → the executor
 * returned immediately and "다시 실행" did nothing. The filter must also accept the
 * crash-reset 'pending' state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
  clearUserCache: vi.fn(),
}));

// callLLMStream → resolve immediately so runWorkerTask completes without network.
vi.mock('@/lib/llm', () => ({
  callLLMStream: vi.fn((_messages: unknown, _options: unknown, cb: { onComplete: (t: string) => void }) => {
    cb.onComplete('canned worker result');
  }),
}));

// AI-worker validation path (who === 'ai') — keep it offline.
vi.mock('@/lib/worker-quality', () => ({
  validateWorkerOutput: vi.fn(async () => ({ score: 90, passed: true, issues: [] })),
  checkSpecificity: vi.fn(() => ({ score: 80, issues: [] })),
}));

import { runAllAIWorkers } from '@/lib/worker-engine';
import type { WorkerTask, WorkerStatus } from '@/stores/types';

function makeWorker(over: Partial<WorkerTask> & { id: string }): WorkerTask {
  return {
    task: 'a task', who: 'ai', expected_output: 'out', status: 'pending' as WorkerStatus,
    persona: null, level: 'junior', stream_text: '', result: null, human_input: null,
    error: null, approved: null, completion_note: null, started_at: null, completed_at: null,
    ...over,
  } as WorkerTask;
}

const ctx = {
  problemText: 'p', realQuestion: 'q?', skeleton: [], hiddenAssumptions: [],
  qaHistory: [], sessionId: 's1',
};

beforeEach(() => vi.clearAllMocks());

describe('runAllAIWorkers selects the right workers after a crash-reset', () => {
  it('AI-runs a self/human-with-ai_scope worker reset to "pending" (the bug), and skips no-ai_scope / done', async () => {
    const workers: WorkerTask[] = [
      makeWorker({ id: 'A', who: 'human', agent_type: 'self', ai_scope: 'draft a first pass', status: 'pending' }),      // crash-reset → MUST run now
      makeWorker({ id: 'B', who: 'human', agent_type: 'human', ai_scope: 'prep the question', status: 'ai_preparing' }), // normal pre-pass → runs
      makeWorker({ id: 'C', who: 'human', agent_type: 'self', ai_scope: undefined, status: 'waiting_input' }),           // no ai_scope → waits for the user
      makeWorker({ id: 'D', who: 'ai', agent_type: 'ai', status: 'pending' }),                                          // ai → always runs
      makeWorker({ id: 'E', who: 'ai', agent_type: 'ai', status: 'done', result: 'already done' }),                     // completed → skip
    ];

    const started: string[] = [];
    await runAllAIWorkers(
      workers, ctx,
      { onStart: (id) => started.push(id), onStream: () => {}, onComplete: () => {}, onError: () => {} },
    );

    expect(started.sort()).toEqual(['A', 'B', 'D']); // A is the fix; C and E correctly excluded
  });

  it('does NOT return early when the only pending workers are self/human-with-ai_scope (regression guard)', async () => {
    const workers = [
      makeWorker({ id: 'X', who: 'human', agent_type: 'self', ai_scope: 'do the prelim', status: 'pending' }),
      makeWorker({ id: 'Y', who: 'human', agent_type: 'human', ai_scope: 'prep it', status: 'pending' }),
    ];

    const started: string[] = [];
    await runAllAIWorkers(
      workers, ctx,
      { onStart: (id) => started.push(id), onStream: () => {}, onComplete: () => {}, onError: () => {} },
    );

    expect(started.sort()).toEqual(['X', 'Y']); // before the fix: [] (stuck 0/N)
  });
});
