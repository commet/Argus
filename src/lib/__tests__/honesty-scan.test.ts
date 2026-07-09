import { describe, it, expect } from 'vitest';
import { coerceHonestyFlags, locateFlag, buildHonestyScanPrompt } from '../honesty-scan';

describe('coerceHonestyFlags', () => {
  it('keeps only valid flags and trims', () => {
    const out = coerceHonestyFlags({
      flags: [
        { text: '  수급이 크게 달라요  ', kind: 'world_fact', why: '외부 사실', where: ' 청약홈 ' },
        { text: '온보딩 1~3개월', kind: 'fabricated' },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ text: '수급이 크게 달라요', kind: 'world_fact', why: '외부 사실', where: '청약홈' });
    expect(out[1].why).toBe('');
    expect(out[1].where).toBeUndefined(); // omitted (not '') when absent
  });

  it('drops malformed/unknown-kind/empty entries', () => {
    expect(coerceHonestyFlags({ flags: [{ text: '', kind: 'world_fact' }] })).toHaveLength(0);
    expect(coerceHonestyFlags({ flags: [{ text: 'x', kind: 'opinion' }] })).toHaveLength(0);
    expect(coerceHonestyFlags({ flags: [{ kind: 'fabricated' }] })).toHaveLength(0);
    expect(coerceHonestyFlags(null)).toEqual([]);
    expect(coerceHonestyFlags({})).toEqual([]);
  });

  it('de-dupes by text and caps at 8 (no whole-card painting)', () => {
    const dup = coerceHonestyFlags({ flags: [{ text: 'a', kind: 'world_fact' }, { text: 'a', kind: 'fabricated' }] });
    expect(dup).toHaveLength(1);
    const many = coerceHonestyFlags({ flags: Array.from({ length: 12 }, (_, i) => ({ text: `f${i}`, kind: 'world_fact' })) });
    expect(many).toHaveLength(8);
  });
});

describe('locateFlag (verbatim + punctuation-tolerant)', () => {
  const hay = '대출 40%는 원리금 기준이고, 실제 지출은 더 높게 나오는 경우가 많아요. 다음 질문은요.';
  it('finds an exact substring', () => {
    expect(locateFlag(hay, '실제 지출은 더 높게 나오는 경우가 많아요')).toBeGreaterThanOrEqual(0);
  });
  it('tolerates trailing punctuation the model normalizes away', () => {
    expect(locateFlag(hay, '실제 지출은 더 높게 나오는 경우가 많아요.')).toBeGreaterThanOrEqual(0);
  });
  it('returns -1 when genuinely absent (never a false shade)', () => {
    expect(locateFlag(hay, '존재하지 않는 문장')).toBe(-1);
    expect(locateFlag('', 'x')).toBe(-1);
    expect(locateFlag(hay, '')).toBe(-1);
  });
});

describe('buildHonestyScanPrompt', () => {
  it('includes the user input and the analysis body', () => {
    const { system, user } = buildHonestyScanPrompt('집 살까?', { real_question: '진짜 질문?', insight: '어쩌구' }, 'ko');
    expect(system).toContain('정직');
    expect(user).toContain('집 살까?');
    expect(user).toContain('진짜 질문?');
    expect(user).toContain('어쩌구');
  });
});
