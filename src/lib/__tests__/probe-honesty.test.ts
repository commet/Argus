/**
 * Probe honesty regression — the G-W1 contact #1 bug, sealed forever.
 *
 * The shipped bug: an ABORTED probe run (dev StrictMode double-mount) returned
 * empty samples, and the empty result rendered the convergence-silence card
 * ("선원들이 같은 곳으로 갔어요"). Silence must be a RESULT of measurement —
 * never the costume of its absence. These tests fail if that lie ever comes
 * back, at both layers:
 *   1. engine — abort throws; non-abort empty → failed:true, silent:false
 *   2. store  — silent requires ≥2 REAL samples
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (before imports) ───
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/lib/db', () => ({ upsertToSupabase: vi.fn(), loadAndMerge: vi.fn(() => Promise.resolve([])) }));
vi.mock('@/lib/llm', () => ({
  callLLMJson: vi.fn(),
  callLLMParallel: vi.fn(),
}));

import { callLLMJson, callLLMParallel } from '@/lib/llm';
import { runDivergenceProbe, runAblationProbe } from '../probe-engine';
import type { ProbeSample } from '../probe-engine';
import { useProbeStore } from '@/stores/useProbeStore';

const SAMPLE: ProbeSample = {
  week1_action: 'a',
  key_resource: 'b',
  success_test: 'c',
  purpose_reading: 'd',
};

beforeEach(() => {
  vi.mocked(callLLMParallel).mockReset();
  vi.mocked(callLLMJson).mockReset();
  useProbeStore.getState().reset();
});

describe('engine: failure ≠ silence', () => {
  it('all sample calls fail (no abort) → failed:true, silent:false — NEVER convergence', async () => {
    vi.mocked(callLLMParallel).mockResolvedValue({
      results: [null, null, null],
      errors: [new Error('x'), new Error('x'), new Error('x')],
      successCount: 0,
      failureCount: 3,
    });
    const r = await runDivergenceProbe('문단입니다.');
    expect(r.failed).toBe(true);
    expect(r.silent).toBe(false); // the lie: this used to be true
    expect(r.forks).toEqual([]);
  });

  it('aborted run THROWS — an abort is not a measurement at all', async () => {
    const abort = new AbortController();
    vi.mocked(callLLMParallel).mockImplementation(async () => {
      abort.abort();
      return { results: [null, null, null], errors: [null, null, null], successCount: 0, failureCount: 3 };
    });
    await expect(runDivergenceProbe('문단입니다.', { signal: abort.signal })).rejects.toThrow();
  });

  it('real convergence (≥2 samples, zero forks) IS silent — the honest case still works', async () => {
    vi.mocked(callLLMParallel).mockImplementation(async (calls, opts) => {
      const o = opts as { onItemComplete?: (i: number, r: ProbeSample) => void };
      calls.forEach((_, i) => o.onItemComplete?.(i, SAMPLE));
      return { results: [SAMPLE, SAMPLE, SAMPLE], errors: [null, null, null], successCount: 3, failureCount: 0 };
    });
    vi.mocked(callLLMJson).mockResolvedValue({ forks: [] });
    const r = await runDivergenceProbe('문단입니다.');
    expect(r.failed).toBeFalsy();
    expect(r.silent).toBe(true);
    expect(r.samples).toHaveLength(3);
  });

  it('ablation call failure → failed:true, silent:false', async () => {
    vi.mocked(callLLMJson).mockRejectedValue(new Error('boom'));
    const r = await runAblationProbe('문단입니다.');
    expect(r.failed).toBe(true);
    expect(r.silent).toBe(false);
  });
});

describe('store: the silence card requires real samples', () => {
  it('completed with ZERO samples never sets silent', () => {
    const s = useProbeStore.getState();
    s.begin(3);
    s.completed({ forks: [], findings: [], calls: [] });
    expect(useProbeStore.getState().silent).toBe(false); // the rendered lie, sealed
    expect(useProbeStore.getState().status).toBe('done');
  });

  it('completed with 2+ samples and nothing found → silent (honest convergence)', () => {
    const s = useProbeStore.getState();
    s.begin(3);
    s.sampleArrived(SAMPLE);
    s.sampleArrived(SAMPLE);
    s.completed({ forks: [], findings: [], calls: [] });
    expect(useProbeStore.getState().silent).toBe(true);
  });

  it('failed() is a distinct state — not done, not silent', () => {
    const s = useProbeStore.getState();
    s.begin(3);
    s.failed('측정이 닿지 않았어요');
    expect(useProbeStore.getState().status).toBe('error');
    expect(useProbeStore.getState().silent).toBe(false);
  });

  it('reset() returns to idle so a remount can re-run cleanly', () => {
    const s = useProbeStore.getState();
    s.begin(3);
    s.reset();
    expect(useProbeStore.getState().status).toBe('idle');
    expect(useProbeStore.getState().samples).toEqual([]);
  });
});
