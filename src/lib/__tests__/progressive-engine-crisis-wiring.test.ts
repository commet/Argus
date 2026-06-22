/**
 * Crisis backstop wiring (decision 3) — the deterministic gate must fire IN FRONT
 * of the LLM in runInitialAnalysis, and must NOT false-fire on a navigable input.
 *
 * Proves the wiring the R27 deep-dive asked for: classifyCrisis was DEAD CODE
 * (never called in src/), so a future model regression could process a self-harm
 * / abuse / ruin input as an ordinary voyage. Now it short-circuits before any
 * LLM call. Precision-by-design: the navigable battery (big-but-healthy
 * decisions) must pass through to the LLM untouched (mirror clause — over-firing
 * here is its own harm).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the import-time supabase client (no env in the test runner) + the LLM so
// we can assert the crisis path spends ZERO tokens. Mirrors the established
// auto-persona-simulation.test.ts mock shape.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
  clearUserCache: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
  callLLMJson: vi.fn(),
  callLLMStreamThenParse: vi.fn(),
}));

import { runInitialAnalysis, refineInitialFraming, runDeepening } from '@/lib/progressive-engine';
import { callLLMJson, callLLMStreamThenParse } from '@/lib/llm';
import { classifyCrisis } from '@/lib/crisis-gate';
import type { AnalysisSnapshot, FlowQuestion, FlowAnswer } from '@/stores/types';

const mockJson = vi.mocked(callLLMJson);
const mockStream = vi.mocked(callLLMStreamThenParse);

// Genuine crisis inputs (subset of crisis-gate.test.ts's battery) — the gate fires.
const CRISIS = [
  "there's no point to any of it anymore, I'm going to stop trying with everything",
  'putting my entire 401k plus a second mortgage into a coin that will 100x',
];

// Navigable big-but-healthy decisions — the gate must NOT fire.
const NAVIGABLE = [
  'should I quit my stable job to join an early-stage startup?',
  'we are deciding whether to move the family to another city for my partner’s career',
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('crisis backstop fires before the LLM', () => {
  it.each(CRISIS)('short-circuits with ZERO LLM calls on a crisis input', async (text) => {
    const { snapshot, question } = await runInitialAnalysis(text);

    // The deterministic gate set the machine-readable flag...
    expect(snapshot.crisis?.isCrisis).toBe(true);
    expect(snapshot.crisis?.category).toBe(classifyCrisis(text).category);

    // ...suppressed the planning machinery (empty plan blocks contract sealing too)
    expect(snapshot.skeleton).toEqual([]);
    expect(snapshot.hidden_assumptions).toEqual([]);
    expect(snapshot.framing_locked).toBe(true);

    // ...kept real_question as the user's own words (the concern lives ONLY on
    // snapshot.crisis, rendered solely by the banner — no decision-card mislabel)
    expect(snapshot.real_question).toBe(text);

    // ...and spent NOTHING on the model.
    expect(mockJson).not.toHaveBeenCalled();
    expect(mockStream).not.toHaveBeenCalled();

    // A valid (UI-suppressed) question is still returned for the continue path.
    expect(question).toBeTruthy();
    expect(question.id).toBeTruthy();
  });
});

describe('crisis backstop does NOT false-fire (precision / mirror clause)', () => {
  it.each(NAVIGABLE)('lets a navigable decision reach the LLM untouched', async (text) => {
    // A canned, valid initial-analysis response so the normal path completes.
    mockJson.mockResolvedValue({
      real_question: 'What is the real question here?',
      framing_confidence: 80,
      hidden_assumptions: ['an assumption'],
      skeleton: ['step one', 'step two'],
      next_question: null,
    } as never);

    const { snapshot } = await runInitialAnalysis(text);

    expect(snapshot.crisis).toBeUndefined();
    expect(mockJson).toHaveBeenCalled(); // the LLM WAS consulted
    expect(snapshot.skeleton.length).toBeGreaterThan(0);
  });
});

// F17 — the framing-rejection path: a crisis can arrive in the rejection reason
// after a safe initial problem. It must be screened before any LLM call.
describe('crisis backstop fires on the framing-rejection path (F17)', () => {
  it('short-circuits refineInitialFraming with ZERO LLM calls when the rejection reason is a crisis', async () => {
    const { snapshot, question } = await refineInitialFraming(
      'should I change careers?',                       // safe original problem (already screened at round 0)
      'How will this land with your family?',           // the rejected question
      "honestly I just want to drive somewhere far and not come back", // crisis in the REASON
    );
    expect(snapshot.crisis?.isCrisis).toBe(true);
    expect(snapshot.skeleton).toEqual([]);
    expect(snapshot.framing_locked).toBe(true);
    expect(snapshot.real_question).toBe('should I change careers?'); // user's own words, not the crisis text
    expect(mockJson).not.toHaveBeenCalled();
    expect(mockStream).not.toHaveBeenCalled();
    expect(question).toBeTruthy();
  });

  it('lets a navigable rejection reason reach the LLM untouched (precision)', async () => {
    mockJson.mockResolvedValue({
      real_question: 'refined question', framing_confidence: 75,
      hidden_assumptions: ['a'], skeleton: ['s1', 's2'], next_question: null,
    } as never);
    const { snapshot } = await refineInitialFraming(
      'should I change careers?', 'rejected q', 'actually I care more about growth than money',
    );
    expect(snapshot.crisis).toBeUndefined();
    expect(mockJson).toHaveBeenCalled();
  });
});

// F18 — the Q&A deepening path: a crisis can surface in a round-1+ answer, not just
// the round-0 problem. It must be screened before the deepening LLM call.
describe('crisis backstop fires on the Q&A deepening path (F18)', () => {
  const baseSnapshot: AnalysisSnapshot = {
    version: 0,
    real_question: 'should I take a gap year?',
    hidden_assumptions: ['a'],
    skeleton: ['s1', 's2'],
    framing_confidence: 80,
    framing_locked: true,
  };
  const q: FlowQuestion = { id: 'q1', text: 'What matters most?', type: 'short', engine_phase: 'reframe' };

  it('short-circuits runDeepening with ZERO LLM calls when an ANSWER carries a crisis', async () => {
    const answer: FlowAnswer = { question_id: 'q1', value: "i don't care anymore, there's no point to any of it" };
    const { snapshot, question, readyForMix } = await runDeepening(
      'should I take a gap year?', baseSnapshot,
      [{ question: q, answer }], 1, 3, [baseSnapshot],
    );
    expect(snapshot.crisis?.isCrisis).toBe(true);
    expect(snapshot.skeleton).toEqual([]);
    expect(readyForMix).toBe(false);
    expect(snapshot.real_question).toBe('should I take a gap year?'); // user's own words preserved
    expect(mockJson).not.toHaveBeenCalled();
    expect(mockStream).not.toHaveBeenCalled();
    expect(question).toBeTruthy();
  });
});

describe('the workspace empty-result guard exempts a crisis snapshot', () => {
  // page.tsx throws a retryable error when skeleton AND hidden_assumptions are
  // both empty — but a crisis snapshot is intentionally that shape. The guard
  // predicate must treat it as a valid terminal state, not a failed parse.
  const guardWouldThrow = (s: { crisis?: { isCrisis: boolean }; skeleton: unknown[]; hidden_assumptions: unknown[] }) =>
    !s.crisis?.isCrisis && s.skeleton.length === 0 && s.hidden_assumptions.length === 0;

  it('does not throw on a crisis snapshot', () => {
    expect(guardWouldThrow({ crisis: { isCrisis: true }, skeleton: [], hidden_assumptions: [] })).toBe(false);
  });

  it('still throws on a genuinely empty parse', () => {
    expect(guardWouldThrow({ skeleton: [], hidden_assumptions: [] })).toBe(true);
  });
});
