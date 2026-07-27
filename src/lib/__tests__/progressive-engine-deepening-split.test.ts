/**
 * Deepening split (workspace round-3 "JSON 파싱 실패" root fix).
 *
 * The deepening answer turn used to emit insight + question + the full
 * execution_plan as ONE streamed JSON object. By round 3 the plan inflated the
 * payload past maxTokens and the JSON truncated mid-structure → parseJSON threw
 * a user-facing "JSON 파싱 실패". These prove the structural fix:
 *
 *  1. The streamed narrative call NO LONGER carries the plan.
 *  2. Deep mode builds the execution_plan in its OWN call and merges it.
 *  3. Standard mode makes NO plan call.
 *  4. A plan-call FAILURE is best-effort: the turn still resolves and carries the
 *     prior plan forward — it never surfaces as a turn error.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
  clearUserCache: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
  callLLMJson: vi.fn(),
  callLLMStreamThenParse: vi.fn(),
}));

import { runDeepening } from '@/lib/progressive-engine';
import { callLLMJson, callLLMStreamThenParse } from '@/lib/llm';
import type { AnalysisSnapshot, FlowQuestion, FlowAnswer } from '@/stores/types';

const mockJson = vi.mocked(callLLMJson);
const mockStream = vi.mocked(callLLMStreamThenParse);

// A plain (NON-crisis) decision so the deterministic crisis gate does not fire
// and short-circuit before the LLM calls we want to observe.
const PROBLEM = 'should I open a small shop near my neighborhood?';
const ANSWER = 'there is no similar shop nearby, so I think there is demand';

const baseSnapshot: AnalysisSnapshot = {
  version: 1,
  real_question: 'is there real demand for this shop?',
  hidden_assumptions: ['no nearby competitor means demand exists'],
  skeleton: ['talk to potential customers', 'estimate monthly costs'],
  execution_plan: { steps: [{ task: 'OLD-PLAN-STEP', agent_type: 'ai', output: 'old', ai_scope: 'a', self_scope: 'b' }], key_assumptions: [] },
  framing_confidence: 80,
  framing_locked: false,
};
const q: FlowQuestion = { id: 'q1', text: 'How did you confirm demand?', type: 'short', engine_phase: 'recast' };
const ans: FlowAnswer = { question_id: 'q1', value: ANSWER };

const NARRATIVE = {
  insight: 'a sharp insight',
  real_question: 'how do you tell "no competitor" from "no demand"?',
  hidden_assumptions: ['no competitor could mean no demand, not untapped demand'],
  skeleton: ['run a cheap demand test first', 'then estimate costs'],
  ready_for_mix: false,
  next_question: { text: 'next q', subtext: 'why', options: ['a', 'b', 'c'], type: 'select' },
};
const PLAN = {
  steps: [{ task: 'NEW-PLAN-STEP', agent_type: 'ai', output: 'memo', ai_scope: 'research', self_scope: 'decide' }],
  key_assumptions: ['demand is testable cheaply'],
};

// Distinguish the plan call from any other callLLMJson use (e.g. typed question)
// by the plan prompt's distinctive "execution_plan" marker.
const isPlanCall = (options: unknown) =>
  typeof (options as { system?: string })?.system === 'string' &&
  (options as { system: string }).system.includes('execution_plan');

beforeEach(() => {
  vi.clearAllMocks();
  mockStream.mockResolvedValue(NARRATIVE as never);
});

describe('deepening narrative no longer carries the plan; plan is a separate call', () => {
  it('deep mode streams the narrative once and builds a separate plan on the first answered turn', async () => {
    mockJson.mockImplementation(async (_messages, options) =>
      (isPlanCall(options) ? PLAN : { text: 'typed', options: ['x', 'y'] }) as never,
    );

    const { snapshot } = await runDeepening(
      PROBLEM, baseSnapshot, [{ question: q, answer: ans }], 0, 3, [baseSnapshot],
      () => {}, // onToken → streaming path (the one that used to truncate)
      undefined, undefined, undefined,
      () => {}, // onTypedUpgrade → typed-question generation stays in the background
      'deep',
    );

    // The narrative came from exactly one streamed call...
    expect(mockStream).toHaveBeenCalledTimes(1);
    // ...and a DISTINCT call produced the plan, which got merged into the snapshot.
    expect(mockJson.mock.calls.some(([, options]) => isPlanCall(options))).toBe(true);
    expect(snapshot.real_question).toBe(NARRATIVE.real_question);
    expect(snapshot.execution_plan?.steps[0].task).toBe('NEW-PLAN-STEP');
  });

  it('standard mode makes NO execution_plan call', async () => {
    mockJson.mockImplementation(async () => ({ text: 'typed', options: ['x', 'y'] }) as never);

    await runDeepening(
      PROBLEM, baseSnapshot, [{ question: q, answer: ans }], 0, 3, [baseSnapshot],
      () => {}, undefined, undefined, undefined, () => {},
    );

    expect(mockJson.mock.calls.some(([, options]) => isPlanCall(options))).toBe(false);
  });

  it('plan-call failure is best-effort: the turn still resolves and keeps the prior plan', async () => {
    mockJson.mockImplementation(async (_messages, options) => {
      if (isPlanCall(options)) throw new Error('plan call exploded');
      return { text: 'typed', options: ['x', 'y'] } as never;
    });

    // No abort signal → the failure must be swallowed, not rethrown.
    const { snapshot } = await runDeepening(
      PROBLEM, baseSnapshot, [{ question: q, answer: ans }], 1, 3, [baseSnapshot],
      () => {}, undefined, undefined, undefined, () => {}, 'deep',
    );

    // Narrative still applied, and the previous plan is carried forward intact.
    expect(snapshot.real_question).toBe(NARRATIVE.real_question);
    expect(snapshot.execution_plan?.steps[0].task).toBe('OLD-PLAN-STEP');
  });
});
