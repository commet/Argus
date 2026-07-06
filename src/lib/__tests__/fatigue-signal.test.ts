import { describe, it, expect } from 'vitest';
import { detectFatigue } from '../fatigue-signal';
import { pickNextQuestionType, type QuestionStateContext } from '../question-types';

const A = (...vals: string[]) => vals.map((value) => ({ value }));

describe('detectFatigue — immediate cues (§7 A/B)', () => {
  it('fires on an explicit stop cue (ko/en)', () => {
    expect(detectFatigue(A('음 그건', '그냥 정해줘'))).toBe(true);
    expect(detectFatigue(A('just decide for me'))).toBe(true);
    expect(detectFatigue(A('빨리'))).toBe(true);
  });
  it('fires once the question budget (3) is spent', () => {
    expect(detectFatigue(A('길게 쓴 답 하나', '두 번째 긴 답', '세 번째 긴 답'))).toBe(true);
  });
});

describe('detectFatigue — one weak signal is NOT fatigue (§7 주의)', () => {
  it('a single "모르겠다" is an honest answer, not fatigue', () => {
    expect(detectFatigue(A('충분히 긴 첫 답변이에요', '잘 모르겠어요'))).toBe(false);
  });
  it('a single short answer alone is not fatigue', () => {
    expect(detectFatigue(A('네'))).toBe(false);
  });
});

describe('detectFatigue — two overlapping weak signals fire (§7 C+D)', () => {
  it('escape + a very short latest answer → fatigue', () => {
    // D (escape somewhere) + C (last answer < 5 chars)
    expect(detectFatigue(A('모르겠어요', '응'))).toBe(true);
  });
  it('empty answers never fire (round 0)', () => {
    expect(detectFatigue([])).toBe(false);
  });
});

describe('pickNextQuestionType — fatigue gates the remaining optional questions', () => {
  const base: QuestionStateContext = {
    round: 2, framingConfidence: 80, askedTypes: ['strategic_fork'], workerOutputsReady: true, requestType: 'open',
  };
  it('normally offers weakness_check after the fork', () => {
    expect(pickNextQuestionType(base)).toBe('weakness_check');
  });
  it('but stops when fatigued', () => {
    expect(pickNextQuestionType({ ...base, fatigueDetected: true })).toBeNull();
  });
  it('an explicit "한 번 더" still overrides fatigue', () => {
    expect(pickNextQuestionType({ ...base, fatigueDetected: true, userRequestedMore: true })).toBe('free_follow_up');
  });
});
