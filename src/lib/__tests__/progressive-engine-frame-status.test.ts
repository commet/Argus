/**
 * R60 — frame_status population. assessFrameStatus existed but was DEAD (never
 * called), so snapshot.frame_status was always undefined and the flat-decision
 * over-fire gate in ProgressiveFlow had nothing to read. runInitialAnalysis now
 * populates it. These prove BOTH directions so the gate (shouldMix && !frameIsFlat)
 * has real data — and that a genuine decision is NOT mislabeled flat (the gate must
 * not suppress real crew work; assessFrameStatus is conservative by design).
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

import { refineInitialFraming, runInitialAnalysis } from '@/lib/progressive-engine';
import { callLLMJson } from '@/lib/llm';

const mockJson = vi.mocked(callLLMJson);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runInitialAnalysis populates frame_status (R60)', () => {
  it("marks a genuinely flat decision 'flat' (reframe ≈ surface, no assumptions) → the gate can suppress over-fire", async () => {
    mockJson.mockResolvedValue({
      real_question: 'rename the tab from Workspace to Project?', // == the surface
      framing_confidence: 60,
      hidden_assumptions: [],                                     // nothing to pivot on
      skeleton: ['rename it', 'or do not'],
      next_question: null,
    } as never);

    const { snapshot } = await runInitialAnalysis('rename the tab from Workspace to Project?');
    expect(snapshot.frame_status).toBe('flat');
  });

  it("marks a real decision 'load_bearing' (reframe differs / has assumptions) → crew work is NOT suppressed", async () => {
    mockJson.mockResolvedValue({
      real_question: 'are we optimizing for speed or for long-term maintainability here?',
      framing_confidence: 80,
      hidden_assumptions: ['you assume the current team can absorb the new stack', 'you assume the deadline is fixed'],
      skeleton: ['step one', 'step two'],
      next_question: null,
    } as never);

    const { snapshot } = await runInitialAnalysis('should we migrate the backend to Kubernetes?');
    expect(snapshot.frame_status).toBe('load_bearing');
  });

  it('preserves routing fields on the framing-rejection path', async () => {
    mockJson.mockResolvedValue({
      request_type: 'flat',
      real_question: 'rename the tab from Workspace to Project?',
      framing_confidence: 82,
      stakes: 'routine',
      reversibility: 'reversible',
      decision_density: 'low',
      decision_density_reasoning: 'Small reversible copy decision.',
      hidden_assumptions: [],
      skeleton: ['rename it anyway'],
      next_question: null,
    } as never);

    const { snapshot } = await refineInitialFraming(
      'rename the tab from Workspace to Project?',
      'Should we reposition the workspace?',
      'No, this is just a label tweak.',
    );

    expect(snapshot.request_type).toBe('flat');
    expect(snapshot.frame_status).toBe('flat');
    expect(snapshot.stakes).toBe('routine');
    expect(snapshot.reversibility).toBe('reversible');
    expect(snapshot.decision_density).toBe('low');
    expect(snapshot.skeleton).toEqual([]);
  });
});
