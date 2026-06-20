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

import { applyRouteContract } from '@/lib/progressive-engine';

const NON_OPEN = ['vent', 'validation', 'info', 'self_profiling', 'flat', 'resistance'];

describe('applyRouteContract — enforces the restraint structural contract', () => {
  it.each(NON_OPEN)('blanks a manufactured plan when request_type is non-open (%s)', (rt) => {
    const { result, coerced } = applyRouteContract({ request_type: rt, skeleton: ['step 1', 'step 2'] });
    expect(coerced).toBe(true);
    expect(result.skeleton).toEqual([]);
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
