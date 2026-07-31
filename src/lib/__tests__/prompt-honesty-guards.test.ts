/**
 * Semantic honesty guards for the active judgment harness.
 *
 * Tests intentionally avoid exact prose from retired prompts. They assert the
 * current authority, provenance, state-transition, and synthesis contracts.
 */

import { describe, expect, it } from 'vitest';
import type { AnalysisSnapshot } from '@/stores/types';
import {
  buildDeepeningPrompt,
  buildInitialAnalysisPrompt,
  buildInitialRefinementPrompt,
  buildMixPrompt,
} from '../progressive-prompts';

const snapshot = {
  version: 1,
  real_question: '이직 제안을 일주일 안에 답해야 하는 상황',
  insight: '아직 무엇이 가장 걸리는지는 드러나지 않았어요.',
  hidden_assumptions: [],
  skeleton: [],
  stakes: 'routine',
  reversibility: 'reversible',
  request_type: 'open',
} as AnalysisSnapshot;

describe('initial and deepening honesty', () => {
  it('makes empty output and stopping legitimate', () => {
    const prompt = buildInitialAnalysisPrompt('노트북을 바꿀까 고민이에요.', 'ko');
    expect(prompt.system).toContain('There is NO minimum');
    expect(prompt.system).toContain('An empty field is better');
    expect(prompt.system).toContain('Stop when no grounded');
  });

  it('requires explicit user support rather than topic overlap for a premise', () => {
    const prompt = buildInitialAnalysisPrompt('리드 승진 얘기가 나오고 있어요.', 'ko');
    expect(prompt.system).toContain('explicitly presented by the user as a reason');
    expect(prompt.system).toContain('mentioned fact, option attribute, date, number');
    expect(prompt.system).toContain('Do not attribute a belief to the user');
  });

  it('preserves state and accepts honest stability after an answer', () => {
    const prompt = buildDeepeningPrompt(
      '이직 제안을 받았어요.',
      snapshot,
      [],
      1,
      3,
      'ko',
    );
    expect(prompt.system).toContain('Preserve every field the answer did not change');
    expect(prompt.system).toContain('what the latest answer actually changed, or that the picture held');
    expect(prompt.system).toContain('"premise_changes": []');
  });

  it('does not let conversational analysis become an action plan', () => {
    const prompt = buildDeepeningPrompt('이직 제안을 받았어요.', snapshot, [], 1, 3, 'ko');
    expect(prompt.system).toContain('skeleton MUST remain []');
    expect(prompt.system).toContain('Deep specialist execution is a separate explicit path');
  });
});

describe('synthesis honesty', () => {
  const prompt = buildMixPrompt(
    '이직 제안을 받았어요.',
    [snapshot],
    [],
    null,
    undefined,
    'ko',
  );

  it('produces a receipt rather than a recommendation report', () => {
    expect(prompt.system).toContain('judgment receipt, not a report');
    expect(prompt.system).toContain('Add no new fact, premise, risk');
    expect(prompt.system).toContain('Do not reduce the decision to one');
  });

  it('cannot replenish premises or invent next steps', () => {
    expect(prompt.system).toContain('key_assumptions may only restate');
    expect(prompt.system).toContain('next_steps may only restate');
    expect(prompt.system).toContain('[] is valid');
  });

  it('treats AI reviews as leads, not evidence or votes', () => {
    expect(prompt.system).toContain('leads, not evidence or votes');
    expect(prompt.system).toContain('No count of agreeing reviews makes a claim verified');
  });
});

describe('framing correction honesty', () => {
  const prompt = buildInitialRefinementPrompt(
    '이직 제안을 받았어요.',
    '연봉과 성장 중 무엇이 더 중요한가요?',
    '그게 아니라 가족과 떨어져야 하는지가 고민이에요.',
    'ko',
  );

  it('gives the user correction priority and re-routes from scratch', () => {
    expect(prompt.system).toContain('correction is new evidence');
    expect(prompt.system).toContain('Re-classify the route');
    expect(prompt.system).toContain('Do not defend');
  });

  it('keeps Korean voice and the world-fact boundary', () => {
    expect(prompt.system).toContain('해요체');
    expect(prompt.system).toContain("Training-memory facts are not evidence");
    expect(prompt.system).toContain('Do not choose for the user');
  });
});
