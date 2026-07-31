/**
 * Active judgment-harness regression contract.
 *
 * Historical versions pinned dozens of exact sentences from the retired
 * 1,400-line prompt. These tests pin behavior that must survive a rewrite:
 * safety, groundedness, route restraint, question novelty, and no forced plan.
 */

import { describe, expect, it } from 'vitest';
import type { AnalysisSnapshot } from '@/stores/types';
import {
  buildDeepeningPrompt,
  buildInitialAnalysisPrompt,
  buildInitialRefinementPrompt,
} from '../progressive-prompts';
import {
  dropRepeatedQuestion,
  ensureCrisisResource,
  validationAcknowledgementOnly,
} from '../progressive-guards';

const snapshot = {
  version: 1,
  real_question: '이직 제안을 일주일 안에 답해야 하는 상황',
  hidden_assumptions: [],
  skeleton: [],
  request_type: 'open',
  stakes: 'important',
  reversibility: 'partial',
} as AnalysisSnapshot;

describe('active prompt safety and route restraint', () => {
  const initial = buildInitialAnalysisPrompt('결정이 어려워요.', 'ko');
  const refinement = buildInitialRefinementPrompt(
    '결정이 어려워요.',
    'A와 B 중 무엇이 진짜 질문인가요?',
    '그게 아니라 일정이 문제예요.',
    'ko',
  );

  it('keeps a reachable crisis resource and rejects guaranteed comfort', () => {
    expect(initial.system).toContain('109');
    expect(initial.system).toContain('reachable resource');
    expect(initial.system).toContain('Do not promise that a solution or safe path is guaranteed');
    expect(ensureCrisisResource('', 'ko')).toContain('109');
  });

  it('keeps validation closed unless the user named a concrete constraint', () => {
    expect(initial.system).toContain('receive the decision as already made');
    expect(initial.system).toContain('directly named by the user');
    expect(validationAcknowledgementOnly(
      '다음 달부터 시작하기로 결정하셨군요. 회사 허가는 확인해 보세요.',
      'ko',
    )).toBe('다음 달부터 시작하기로 결정하셨군요. 제가 맞다고 대신 확정하진 않을게요.');
  });

  it('reclassifies a rejected frame and never uses the rejected AI question as evidence', () => {
    expect(refinement.system).toContain('Re-classify the route');
    expect(refinement.system).toContain('never the rejected AI question');
    expect(refinement.system).toContain('skeleton remains []');
  });

  it('does not manufacture a binary real question or a first-turn plan', () => {
    expect(initial.system).toMatch(/Do not manufacture a\s+binary/);
    expect(initial.system).toContain('skeleton MUST remain []');
    expect(initial.system).toContain('"frame_line"');
  });
});

describe('answer update fidelity', () => {
  const deepening = buildDeepeningPrompt(
    '이직 제안을 받았어요.',
    snapshot,
    [{
      question: { id: 'q1', text: '무엇이 가장 걸리나요?', type: 'short', engine_phase: 'reframe' },
      answer: { question_id: 'q1', value: '런웨이가 18개월이래요.' },
    }],
    1,
    3,
    'ko',
  );

  it('treats an off-axis answer as a redirection instead of repeating the old question', () => {
    expect(deepening.system).toContain('answer off-axis with new information');
    expect(deepening.system).toContain('rather than returning to the skipped question');
  });

  it('does not convert a newly mentioned fact into a plan or outside-world implication', () => {
    expect(deepening.system).toContain('skeleton MUST remain []');
    expect(deepening.system).toContain('Do not translate a newly mentioned fact');
  });

  it('drops exact and near-paraphrase question repeats by code', () => {
    expect(dropRepeatedQuestion(
      { text: '리드 승진 얘기는 누구한테 들었어요? 직속 상사가 말했나요?' },
      ['리드 승진 얘기가 어느 정도예요? 윗사람한테 직접 들었나요?'],
    )).toBeNull();
  });

  it('forbids loaded metaphors and importance inflation', () => {
    expect(deepening.system).toContain('Do not introduce a loaded metaphor');
    expect(deepening.system).toContain('Never repeat a question already asked');
  });
});
