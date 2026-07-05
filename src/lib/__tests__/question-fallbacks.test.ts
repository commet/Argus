import { describe, it, expect } from 'vitest';
import { SAFE_FALLBACK_QUESTIONS, pickSafeFallbackQuestion } from '../question-fallbacks';
import { matchBannedPattern } from '../question-rules';

/**
 * Phase 0 (DESIGN-clarify-question-system-v2 §9): the whole point of the pool is
 * that a FAILED generation still hands the user a safe question. So the pool
 * itself must never contain a banned question — this test is the floor guard.
 */
describe('safe fallback pool passes the banned-question rules', () => {
  for (const locale of ['ko', 'en'] as const) {
    for (const q of SAFE_FALLBACK_QUESTIONS[locale]) {
      it(`[${locale}] "${q.slice(0, 32)}…" is not a banned question`, () => {
        expect(matchBannedPattern(q)).toBeNull();
      });
    }
  }

  it('the old banned fallback WOULD be caught (guards the rule itself)', () => {
    expect(matchBannedPattern('이 결과물을 누가 최종 판단해?')).not.toBeNull();
    expect(matchBannedPattern('Who will make the final decision on this?')).not.toBeNull();
    expect(matchBannedPattern('이제 이 방향이 맞나요?')).not.toBeNull();
    expect(matchBannedPattern('Does this direction look right now?')).not.toBeNull();
  });

  it('every pool entry is a non-empty question ending in a question mark', () => {
    for (const locale of ['ko', 'en'] as const) {
      for (const q of SAFE_FALLBACK_QUESTIONS[locale]) {
        expect(q.trim().length).toBeGreaterThan(8);
        expect(q.trim().endsWith('?')).toBe(true);
      }
    }
  });
});

describe('pickSafeFallbackQuestion', () => {
  it('is deterministic for the same seed', () => {
    const a = pickSafeFallbackQuestion('ko', 'seed-alpha');
    const b = pickSafeFallbackQuestion('ko', 'seed-alpha');
    expect(a).toBe(b);
  });

  it('always returns a member of the pool', () => {
    for (const seed of ['x', 'a longer seed', '한글 시드', '']) {
      const q = pickSafeFallbackQuestion('ko', seed);
      expect(SAFE_FALLBACK_QUESTIONS.ko).toContain(q);
    }
  });

  it('no seed → the first, most broadly safe question', () => {
    expect(pickSafeFallbackQuestion('en')).toBe(SAFE_FALLBACK_QUESTIONS.en[0]);
  });

  it('spreads across the pool over many seeds (not stuck on one)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(pickSafeFallbackQuestion('en', `seed-${i}`));
    expect(seen.size).toBeGreaterThan(1);
  });
});
