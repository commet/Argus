/**
 * Layer 0 — dependency ready-gate (worker-engine runPipeline).
 *
 * The live 민서/GTM placeholder: an AI step that depends on a HUMAN step ran on
 * empty input and fabricated a placeholder. The gate must:
 *  - BLOCK an AI worker whose human/self dependency has no input yet (don't run it).
 *  - RUN it once that human input arrives (and the input must be visible — it lives
 *    in human_input, not result).
 *  - NOT deadlock on a missing AI upstream (run with an honest marker instead).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
  clearUserCache: vi.fn(),
}));

// Capture the user prompt each worker runs with, so we can assert the human
// input (or the MISSING marker) actually reached the model.
const seenPrompts: string[] = [];
vi.mock('@/lib/llm', () => ({
  callLLMStream: vi.fn((messages: Array<{ content: string }>, options: { system?: string }, cb: { onComplete: (t: string) => void }) => {
    // Capture system + user — peerResults / markers may land in either.
    seenPrompts.push(`${options?.system ?? ''}\n${messages?.[0]?.content ?? ''}`);
    cb.onComplete('canned worker result');
  }),
}));
vi.mock('@/lib/worker-quality', () => ({
  validateWorkerOutput: vi.fn(async () => ({ score: 90, passed: true, issues: [] })),
  checkSpecificity: vi.fn(() => ({ score: 80, issues: [] })),
}));

import { runPipeline } from '@/lib/worker-engine';
import type { WorkerTask, WorkerStatus, PipelineStage } from '@/stores/types';

function mk(over: Partial<WorkerTask> & { id: string }): WorkerTask {
  return {
    task: 'a task', who: 'ai', expected_output: 'out', status: 'pending' as WorkerStatus,
    persona: null, level: 'junior', stream_text: '', result: null, human_input: null,
    error: null, approved: null, completion_note: null, started_at: null, completed_at: null,
    ...over,
  } as WorkerTask;
}

const STAGES: PipelineStage[] = [
  { id: 'stage_1' } as PipelineStage,
  { id: 'stage_2', dependsOnStageId: 'stage_1' } as PipelineStage,
];

const ctx = { problemText: 'p', realQuestion: 'q?', skeleton: [], hiddenAssumptions: [], qaHistory: [], sessionId: 's1' };

async function run(workers: WorkerTask[]) {
  const started: string[] = [];
  const blocked: Array<{ id: string; on: string[] }> = [];
  await runPipeline(workers, STAGES, ctx, {
    onStart: (id) => started.push(id),
    onStream: () => {},
    onComplete: () => {},
    onError: () => {},
    onBlocked: (id, on) => blocked.push({ id, on }),
  });
  return { started, blocked };
}

beforeEach(() => { vi.clearAllMocks(); seenPrompts.length = 0; });

describe('dependency ready-gate', () => {
  it('BLOCKS an AI worker whose human dependency has no input (does not run it)', async () => {
    const workers = [
      mk({ id: 'A', who: 'human', agent_type: 'human', persona: { name: '윤석' } as never, stage_id: 'stage_1', status: 'waiting_input' }),
      mk({ id: 'B', who: 'ai', agent_type: 'ai', stage_id: 'stage_2', depends_on: ['A'] }),
    ];
    const { started, blocked } = await run(workers);
    expect(started).not.toContain('B');           // never ran on empty input
    expect(blocked.map(b => b.id)).toContain('B'); // surfaced as blocked
    expect(blocked.find(b => b.id === 'B')!.on).toContain('윤석');
  });

  it('RUNS the dependent worker once the human input arrives (reseed sees human_input, not result)', async () => {
    // If readyOutput read only `result` (the old bug), A's answer would be
    // invisible and B would BLOCK. That B runs proves the human_input reseed.
    const workers = [
      mk({ id: 'A', who: 'human', agent_type: 'human', persona: { name: '윤석' } as never, stage_id: 'stage_1', status: 'done', human_input: 'legal says the DPA covers it' }),
      mk({ id: 'B', who: 'ai', agent_type: 'ai', stage_id: 'stage_2', depends_on: ['A'] }),
    ];
    const { started, blocked } = await run(workers);
    expect(started).toContain('B');
    expect(blocked).toHaveLength(0);
  });

  it('does NOT deadlock on a missing AI upstream — the dependent still runs (AI-missing is not a block)', async () => {
    const workers = [
      mk({ id: 'A', who: 'ai', agent_type: 'ai', persona: { name: '규민' } as never, stage_id: 'stage_1', status: 'error', result: null }),
      mk({ id: 'B', who: 'ai', agent_type: 'ai', stage_id: 'stage_2', depends_on: ['A'] }),
    ];
    const { started, blocked } = await run(workers);
    expect(started).toContain('B');   // no deadlock
    expect(blocked).toHaveLength(0);  // AI-missing degrades, never blocks
  });

  it('keeps completed stage output in context when a pipeline resumes', async () => {
    const workers = [
      mk({ id: 'A', who: 'ai', agent_type: 'ai', stage_id: 'stage_1', status: 'done', result: 'already completed evidence' }),
      mk({ id: 'B', who: 'ai', agent_type: 'ai', stage_id: 'stage_2', depends_on: ['A'] }),
    ];
    const { started } = await run(workers);
    expect(started).not.toContain('A');
    expect(started).toContain('B');
    expect(seenPrompts.some((prompt) => prompt.includes('already completed evidence'))).toBe(true);
  });
});
