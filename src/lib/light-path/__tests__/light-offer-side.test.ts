/**
 * The light path may not decide for someone and then ask reality to confirm it.
 *
 * Measured (sim, light-08): the user's last words were "honestly I'm having fun
 * though" — no decision — and the sealed sentence was "I stayed till the end and
 * still made my early start tomorrow without dragging." It picked the branch AND
 * predicted the outcome. On the check-in date that person would be shown a
 * commitment they never made, attributed to them.
 *
 * A sentence may state an outcome only when the user stated the decision.
 */
import { describe, expect, it } from 'vitest';
import { coerceLightTurn, offerPicksUnstatedSide, todayLine } from '../light-engine';

describe('a leave-behind sentence cannot choose the side', () => {
  it('rejects an outcome sentence from an undecided session', () => {
    expect(offerPicksUnstatedSide(
      'I stayed till the end and still made my early start tomorrow.',
      ['I have an early start tomorrow', "honestly I'm having fun though"],
    )).toBe(true);
    expect(offerPicksUnstatedSide(
      '케이크 자르고 바로 집에 갔다.',
      ['남편 회사 모임인데 피곤해요', '아직 잘 모르겠어요'],
    )).toBe(true);
  });

  it('allows it once the user has said which way they are going', () => {
    expect(offerPicksUnstatedSide(
      '케이크 자르고 바로 집에 갔다.',
      ['일찍 집에 가기로 했어요'],
    )).toBe(false);
  });

  it('leaves a sentence that states no outcome alone', () => {
    expect(offerPicksUnstatedSide(
      '내일 아침에 피곤하지 않다.',
      ['아직 고민 중이에요'],
    )).toBe(false);
  });

  it('degrades the whole offer rather than sealing the guessed side', () => {
    const turn = coerceLightTurn(
      {
        mirror: '아직 어느 쪽인지는 안 정하셨고요.',
        action: 'offer',
        offer: { sentence: '끝까지 있다가 나왔다.', when: 'tomorrow_morning' },
      },
      1,
      ['모임인데 내일 일찍 일어나야 해요', '재밌긴 해요'],
    );
    expect(turn.offer).toBeUndefined();
  });
});

describe('the model is told what day it is', () => {
  it('names the date and the weekday', () => {
    const line = todayLine('ko', new Date(2026, 7, 1));
    expect(line).toContain('2026-08-01');
    expect(line).toContain('토요일');
    expect(todayLine('en', new Date(2026, 7, 1))).toContain('Saturday');
  });
});
