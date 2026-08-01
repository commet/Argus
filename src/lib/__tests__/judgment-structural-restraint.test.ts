import { describe, expect, it } from 'vitest';
import {
  dropRepeatedQuestion,
  guardLowConfidenceOpeningQuestion,
  lowConfidenceOpeningCopy,
  stripConditionalReassurance,
} from '../progressive-guards';

describe('judgment structural restraint', () => {
  it('drops the same question after the user answered with different information', () => {
    const repeated = {
      text: '리드 승진 얘기가 어느 정도 수준이에요?',
      type: 'short',
    };
    expect(dropRepeatedQuestion(repeated, [
      '리드 승진 얘기가 어느 정도 수준이에요?',
    ])).toBeNull();
  });

  it('keeps a genuinely different next question', () => {
    const next = { text: '런웨이 18개월을 어떻게 느끼세요?', type: 'short' };
    expect(dropRepeatedQuestion(next, [
      '리드 승진 얘기가 어느 정도 수준이에요?',
    ])).toEqual(next);
  });

  it('drops a paraphrase of a skipped question', () => {
    const next = {
      text: '리드 승진 얘기는 누구한테 들었어요? 직속 상사가 직접 한 말인가요?',
      type: 'short',
    };
    expect(dropRepeatedQuestion(next, [
      '리드 승진 얘기가 어느 정도 수준이에요? 윗사람한테 직접 들은 건가요?',
    ])).toBeNull();
  });

  it('keeps a genuinely different Korean question', () => {
    const next = {
      text: '18개월이라는 정보가 본인에게 어떤 걱정과 연결돼요?',
      type: 'short',
    };
    expect(dropRepeatedQuestion(next, [
      '리드 승진 얘기가 어느 정도 수준이에요? 윗사람한테 직접 들은 건가요?',
    ])).toEqual(next);
  });

  it('validation keeps the grounded check and drops only the laundered verdict', () => {
    // The old guard kept the FIRST sentence and bolted on "제가 맞다고 대신
    // 확정하진 않을게요", which deleted the one concrete check the prompt
    // explicitly allows and ended every validation reply on a refusal.
    expect(stripConditionalReassurance(
      '다음 달부터 병행하기로 결정하셨군요. 회사에 알렸는지는 확인해 보세요.',
    )).toBe('다음 달부터 병행하기로 결정하셨군요. 회사에 알렸는지는 확인해 보세요.');
    // What must still go: the verdict wearing a condition.
    expect(stripConditionalReassurance(
      '취업규칙을 확인해 보세요. 제한이 없다면 걸림돌은 없어요.',
    )).toBe('취업규칙을 확인해 보세요.');
  });

  it('opens up a fork the user never drew', () => {
    expect(guardLowConfidenceOpeningQuestion(
      {
        text: '돈이 더 중요한가요, 커리어 방향이 더 중요한가요?',
        type: 'select',
        options: ['돈', '커리어'],
        subtext: '둘 중 하나를 골라주세요.',
      },
      '퇴사하고 여행이나 갈까',
      'ko',
    )).toEqual(lowConfidenceOpeningCopy('ko').question);
  });

  it('leaves an open question alone, however unsure the model says it is', () => {
    const question = { text: '승진 가능성을 얼마나 믿고 있나요?', type: 'short' };
    expect(guardLowConfidenceOpeningQuestion(question, '승진 얘기가 나오는 중이에요', 'ko')).toEqual(question);
  });

  it('keeps a two-sided question when BOTH sides came from the user', () => {
    const question = {
      text: '지금 회사에 남는 쪽인가요, 아니면 스타트업 오퍼 쪽인가요?',
      type: 'short',
    };
    expect(guardLowConfidenceOpeningQuestion(
      question,
      '지금 회사에 남을지 스타트업 오퍼를 받을지 고민이에요',
      'ko',
    )).toEqual(question);
  });

  it('opens up an invented either/or in English too', () => {
    expect(guardLowConfidenceOpeningQuestion(
      { text: 'Is it about money, or about growth?', type: 'select' },
      'thinking about quitting and travelling',
      'en',
    )).toEqual(lowConfidenceOpeningCopy('en').question);
  });
});
