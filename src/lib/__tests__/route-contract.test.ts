/**
 * R31 — runtime route-contract guard (the "rules=data on the surface with a
 * runtime" move). R29 measured that weaker/mid models (esp. sonnet, the webapp's
 * default tier) ignore the STEP-0 under-fire gate ~44% of the time and build a
 * plan on a non-open request. The markdown plugin cannot stop this (no runtime);
 * the webapp can. applyRouteContract enforces the structural contract the prompt
 * already states: a skeleton/plan exists ONLY for `open`.
 *
 * The guard must be SAFE: purely subtractive (blanks a plan that shouldn't exist),
 * never touches prose, and DEFAULTS TO NO-OP on a missing/unknown request_type so
 * it can never blank a legitimate open-decision plan.
 */
import { describe, it, expect, vi } from 'vitest';

// progressive-engine imports the supabase/llm chain at module load (no test env) —
// mock them so the pure helper can be imported. Mirrors progressive-engine-crisis-wiring.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
  clearUserCache: vi.fn(),
}));
vi.mock('@/lib/llm', () => ({
  callLLMJson: vi.fn(),
  callLLMStreamThenParse: vi.fn(),
}));

import { applyRouteContract, runInitialAnalysis } from '@/lib/progressive-engine';
import { callLLMJson } from '@/lib/llm';

const mockJson = vi.mocked(callLLMJson);
const NON_OPEN = ['vent', 'validation', 'info', 'self_profiling', 'flat', 'resistance'];

describe('applyRouteContract — enforces the restraint structural contract', () => {
  it.each(NON_OPEN)('blanks a manufactured plan when request_type is non-open (%s)', (rt) => {
    const { result, coerced } = applyRouteContract({
      request_type: rt,
      skeleton: ['step 1', 'step 2'],
      hidden_assumptions: ['made up'],
      next_question: { text: 'another question' },
    });
    expect(coerced).toBe(true);
    expect(result.skeleton).toEqual([]);
    expect(result.hidden_assumptions).toEqual([]);
    expect(result.next_question).toBeNull();
  });

  it('leaves an open-decision plan untouched', () => {
    const { result, coerced } = applyRouteContract({ request_type: 'open', skeleton: ['step 1', 'step 2'] });
    expect(coerced).toBe(false);
    expect(result.skeleton).toEqual(['step 1', 'step 2']);
  });
});

describe('applyRouteContract — safe defaults (never blanks a legitimate plan by mistake)', () => {
  it('no-ops when request_type is MISSING (older/weaker model omits it)', () => {
    const { result, coerced } = applyRouteContract({ skeleton: ['step 1', 'step 2'] });
    expect(coerced).toBe(false);
    expect(result.skeleton).toEqual(['step 1', 'step 2']);
  });

  it('no-ops on an UNKNOWN request_type value', () => {
    const { result, coerced } = applyRouteContract({ request_type: 'something_new', skeleton: ['step 1'] });
    expect(coerced).toBe(false);
    expect(result.skeleton).toEqual(['step 1']);
  });

  it('no-ops when a non-open request already has an empty skeleton (nothing to fix)', () => {
    const { coerced } = applyRouteContract({ request_type: 'vent', skeleton: [] });
    expect(coerced).toBe(false);
  });

  it('only ever removes — never adds or rewrites other fields', () => {
    const input = { request_type: 'flat', skeleton: ['a'], real_question: 'keep me', insight: 'keep me too' };
    const { result } = applyRouteContract(input);
    expect(result.real_question).toBe('keep me');
    expect(result.insight).toBe('keep me too');
    expect(result.skeleton).toEqual([]);
  });
});

/**
 * R32 — the engine WIRES the model's STEP-0 classification onto the snapshot
 * (previously a dead/unwired field) so ProgressiveFlow can make a non-open route
 * terminal. Together with R31's coercion: a non-open snapshot carries its
 * request_type AND has its plan blanked.
 */
describe('runInitialAnalysis pins request_type on the snapshot (R31+R32 together)', () => {
  it('a non-open classification is pinned AND its manufactured plan is blanked', async () => {
    mockJson.mockResolvedValue({
      real_question: '회의가 많아 지친 마음',
      framing_confidence: 55,
      hidden_assumptions: [],
      skeleton: ['먼저 일정을 줄여라', '그다음 위임하라'], // model over-fired a plan on a vent
      request_type: 'vent',
      next_question: null,
    } as never);
    const { snapshot } = await runInitialAnalysis('회의가 너무 많아서 지친다');
    expect(snapshot.request_type).toBe('vent');
    expect(snapshot.skeleton).toEqual([]); // R31 contract guard blanked the plan
  });

  it('an open classification is pinned open without pre-building a plan', async () => {
    mockJson.mockResolvedValue({
      real_question: '핵심 질문은?',
      insight: '지금 이직하는 쪽이 정답이다.',
      framing_confidence: 82,
      hidden_assumptions: ['가정 1'],
      skeleton: ['단계 1', '단계 2'],
      request_type: 'open',
      next_question: { text: '상황 질문', type: 'select', options: ['A', 'B', 'C'] },
    } as never);
    const { snapshot } = await runInitialAnalysis('이직할지 남을지 큰 결정이야');
    expect(snapshot.request_type).toBe('open');
    expect(snapshot.skeleton).toEqual([]);
    expect(snapshot.insight).toBe('핵심 질문은?');
  });
});
