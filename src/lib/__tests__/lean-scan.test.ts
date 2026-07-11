import { describe, it, expect } from 'vitest';
import { coerceLeanFlags, buildLeanScanPrompt, locateFlag, applyNeutral, insightMayLean } from '../lean-scan';

describe('insightMayLean (과도하지 않게 pre-gate)', () => {
  it('fires on verdict-shaped insights', () => {
    expect(insightMayLean('지금은 안 사도 돼요.')).toBe(true);
    expect(insightMayLean('기다리는 게 나아요.')).toBe(true);
    expect(insightMayLean('사실 답은 이미 정해진 것 같아요.')).toBe(true);
    expect(insightMayLean('지금이 협상 타이밍이에요.')).toBe(true);
  });
  it('skips a pure neutral crux (no extra call)', () => {
    expect(insightMayLean('이건 결국 불편이 새 값만큼인지에 달렸어요 — 어떻게 느껴져요?')).toBe(false);
    expect(insightMayLean('핵심은 회의 수가 아니라 목적이 분명한가예요.')).toBe(false);
    expect(insightMayLean('')).toBe(false);
  });
});

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

describe('applyNeutral', () => {
  const insight = '노트북은 아직 쓸 만해요 — 지금은 안 사도 돼요. 느려지면 그때 사세요.';
  it('replaces a matched verdict span with its neutral rewrite', () => {
    const out = applyNeutral(insight, [{ text: '지금은 안 사도 돼요', neutral: '이건 불편이 새 값만큼인지에 달렸어요' }]);
    expect(out).toContain('이건 불편이 새 값만큼인지에 달렸어요');
    expect(out).not.toContain('지금은 안 사도 돼요');
    expect(out).toContain('노트북은 아직 쓸 만해요'); // rest untouched
  });
  it('leaves the insight UNTOUCHED when a flag does not match (no corruption from a stale flag)', () => {
    expect(applyNeutral(insight, [{ text: '존재하지 않는 판정', neutral: 'x' }])).toBe(insight);
    expect(applyNeutral(insight, [])).toBe(insight);
    expect(applyNeutral('', [{ text: 'a', neutral: 'b' }])).toBe('');
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
