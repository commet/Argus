import { describe, expect, it } from 'vitest';
import {
  dropRepeatedQuestion,
  guardLowConfidenceOpeningQuestion,
  lowConfidenceOpeningCopy,
  validationAcknowledgementOnly,
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

  it('keeps only the receiving sentence on validation until check provenance exists', () => {
    expect(validationAcknowledgementOnly(
      '다음 달부터 병행하기로 결정하셨군요. 회사에 알렸는지는 확인해 보세요.',
    )).toBe('다음 달부터 병행하기로 결정하셨군요. 제가 맞다고 대신 확정하진 않을게요.');
  });

  it('replaces a low-confidence binary with one open ownership question', () => {
    expect(guardLowConfidenceOpeningQuestion(
      {
        text: '돈이 더 중요한가요, 커리어 방향이 더 중요한가요?',
        type: 'select',
        options: ['돈', '커리어'],
        subtext: '둘 중 하나를 골라주세요.',
      },
      42,
      'ko',
    )).toEqual(lowConfidenceOpeningCopy('ko').question);
  });

  it('does not rewrite a question after the frame is established', () => {
    const question = { text: '승진 가능성을 얼마나 믿고 있나요?', type: 'short' };
    expect(guardLowConfidenceOpeningQuestion(question, 78, 'ko')).toEqual(question);
  });

  it('treats an omitted confidence report as uncertainty', () => {
    expect(guardLowConfidenceOpeningQuestion(
      { text: 'Which option is better?', type: 'select' },
      null,
      'en',
    )).toEqual(lowConfidenceOpeningCopy('en').question);
  });
});
