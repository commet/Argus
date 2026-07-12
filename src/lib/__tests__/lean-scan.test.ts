import { describe, it, expect } from 'vitest';
import { coerceLeanFlags, buildLeanScanPrompt, locateFlag, neutralizeLeanText } from '../lean-scan';

describe('coerceLeanFlags', () => {
  it('keeps only flags with both text and neutral, trims', () => {
    const out = coerceLeanFlags({
      flags: [
        { text: '  지금은 안 사도 돼요  ', neutral: '  불편이 값만큼인지에 달렸어요  ', why: '판정' },
        { text: '판정만', neutral: '' },      // no neutral → drop
        { text: '', neutral: '중립만' },        // no text → drop
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ text: '지금은 안 사도 돼요', neutral: '불편이 값만큼인지에 달렸어요', why: '판정' });
  });

  it('de-dupes by text and caps at 6; safe on junk', () => {
    expect(coerceLeanFlags({ flags: [{ text: 'a', neutral: 'x' }, { text: 'a', neutral: 'y' }] })).toHaveLength(1);
    expect(coerceLeanFlags({ flags: Array.from({ length: 9 }, (_, i) => ({ text: `t${i}`, neutral: 'n' })) })).toHaveLength(6);
    expect(coerceLeanFlags(null)).toEqual([]);
    expect(coerceLeanFlags({})).toEqual([]);
    expect(coerceLeanFlags({ flags: [{ text: 'x' }] })).toEqual([]); // missing neutral
  });
});

describe('buildLeanScanPrompt', () => {
  it('fences inputs in <user-data> and includes them', () => {
    const { system, user } = buildLeanScanPrompt('노트북 살까?', { insight: '지금은 안 사도 돼요' }, 'ko');
    expect(system).toContain('중립');
    expect(user).toContain('<user-data>');
    expect(user).toContain('노트북 살까?');
    expect(user).toContain('지금은 안 사도 돼요');
  });
  it('re-exports locateFlag (verbatim locate)', () => {
    expect(locateFlag('그래서 지금은 안 사도 돼요.', '지금은 안 사도 돼요')).toBeGreaterThanOrEqual(0);
    expect(locateFlag('무관한 문장', '없는 것')).toBe(-1);
  });
});

describe('neutralizeLeanText', () => {
  it('replaces only a located verdict and preserves surrounding prose', () => {
    expect(neutralizeLeanText('결론: 지금은 안 사도 돼요. 다음 질문입니다.', [
      { text: '지금은 안 사도 돼요.', neutral: '불편이 새 값만큼인지에 달렸어요.' },
    ])).toBe('결론: 불편이 새 값만큼인지에 달렸어요. 다음 질문입니다.');
  });

  it('leaves text unchanged when the quoted verdict is not present', () => {
    expect(neutralizeLeanText('중립 문장', [{ text: '없는 판정', neutral: '대체' }])).toBe('중립 문장');
  });
});
