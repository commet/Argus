import { describe, it, expect } from 'vitest';
import {
  pickNextQuestionType,
  applyFrameClarifyEffect,
  findEffectForAnswer,
  buildFlowQuestion,
  type QuestionStateContext,
  type FrameClarifyEffect,
} from '../question-types';
import type { AnalysisSnapshot } from '@/stores/types';

const base: QuestionStateContext = {
  round: 0,
  framingConfidence: 50,
  askedTypes: [],
  workerOutputsReady: false,
};

describe('pickNextQuestionType — requestType structural gate (§4.7)', () => {
  it('a confirmed non-open request routes to NO typed question', () => {
    expect(pickNextQuestionType({ ...base, requestType: 'flat' })).toBeNull();
    expect(pickNextQuestionType({ ...base, requestType: 'vent' })).toBeNull();
    expect(pickNextQuestionType({ ...base, requestType: 'validation' })).toBeNull();
  });
  it('open + low framing confidence → frame_clarify', () => {
    expect(pickNextQuestionType({ ...base, requestType: 'open', framingConfidence: 50 })).toBe('frame_clarify');
  });
  it('undefined requestType is permissive (older models omit it)', () => {
    expect(pickNextQuestionType({ ...base, framingConfidence: 50 })).toBe('frame_clarify');
  });
  it('framing confidence >= 70 → strategic_fork, not frame_clarify', () => {
    expect(pickNextQuestionType({ ...base, requestType: 'open', framingConfidence: 80 })).toBe('strategic_fork');
  });
  it('frame_clarify does not re-fire once asked', () => {
    expect(pickNextQuestionType({ ...base, requestType: 'open', framingConfidence: 50, askedTypes: ['frame_clarify'] })).toBe('strategic_fork');
  });
});

function snap(overrides: Partial<AnalysisSnapshot> = {}): AnalysisSnapshot {
  return {
    version: 0,
    real_question: '원래 질문은 무엇인가?',
    hidden_assumptions: [],
    skeleton: [],
    framing_confidence: 50,
    framing_locked: false,
    ...overrides,
  } as AnalysisSnapshot;
}

describe('applyFrameClarifyEffect — consumption contract (§4.3)', () => {
  it('consumes chosenFrame (→ override reason) AND framingBoost (→ raised confidence)', () => {
    const effect: FrameClarifyEffect = {
      chosenFrame: '이 일을 할지 말지부터 정해야 한다',
      framingBoost: 30,
      snapshotPatch: { real_question: '이 일을 아예 할지 말지 정할 것인가?' },
    };
    const out = applyFrameClarifyEffect(snap({ framing_confidence: 50 }), effect);
    expect(out.real_question).toBe('이 일을 아예 할지 말지 정할 것인가?');   // snapshotPatch consumed
    expect(out.framing_confidence).toBe(80);                                  // 50 + 30 boost consumed
    expect(out.framing_override_reason).toBe('이 일을 할지 말지부터 정해야 한다'); // chosenFrame consumed
  });

  it('clamps raised confidence to 100', () => {
    const out = applyFrameClarifyEffect(snap({ framing_confidence: 90 }), { chosenFrame: 'x', framingBoost: 40 });
    expect(out.framing_confidence).toBe(100);
  });

  it('defaults the boost to 20 when the effect omits it', () => {
    const out = applyFrameClarifyEffect(snap({ framing_confidence: 40 }), { chosenFrame: 'x' });
    expect(out.framing_confidence).toBe(60);
  });
});

describe('frame_clarify effect round-trips through the FlowQuestion', () => {
  it('findEffectForAnswer recovers the FrameClarifyEffect by label', () => {
    const effect: FrameClarifyEffect = { chosenFrame: '범위를 정하는 문제다', framingBoost: 25 };
    const q = buildFlowQuestion('q1', 'frame_clarify', '지금 진짜 정해야 하는 건?', undefined,
      [{ label: '범위를 정하는 문제다', effect }], 'reframe');
    const found = findEffectForAnswer(q, '범위를 정하는 문제다');
    expect(found).not.toBeNull();
    expect(found && 'chosenFrame' in found && found.chosenFrame).toBe('범위를 정하는 문제다');
  });
});
