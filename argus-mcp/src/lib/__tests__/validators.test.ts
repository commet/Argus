import { describe, it, expect } from 'vitest';
import { validateCrux } from '../validate-crux.js';
import { validateSeal } from '../validate-seal.js';

const TODAY = '2026-07-03';

describe('validateCrux — LEAN regex (11 P1-3 regression)', () => {
  it('does NOT flag a neutral question containing the word "id"', () => {
    // The old `i('| w)?d` alternation matched bare "id" and convicted this.
    expect(validateCrux('Will the user id migration finish before Q3?')).toBeNull();
  });

  it('still flags a real first-person lean ("I\'d")', () => {
    const err = validateCrux("Is this what I'd call the safer bet?");
    expect(err?.code).toBe('CRUX_CARRIES_LEAN');
  });

  it('still flags "I would"', () => {
    const err = validateCrux('Given the data, is option A what I would pick?');
    expect(err?.code).toBe('CRUX_CARRIES_LEAN');
  });
});

describe('validateSeal — Korean vibe heuristic (12 P1-4)', () => {
  it('flags a Korean vibe-predicate as weak NOT_FALSIFIABLE with a ko message', () => {
    const err = validateSeal('잘 될 것 같다 아마도', '2026-08-01', TODAY);
    expect(err?.code).toBe('NOT_FALSIFIABLE');
    expect(err?.weak).toBe(true);
    expect(err?.message).toContain('기분');
    expect(err?.recovery).toContain('휴리스틱');
  });

  it('passes a checkable Korean predicate', () => {
    expect(validateSeal('주간 활성 사용자가 100명을 넘는다', '2026-08-01', TODAY)).toBeNull();
  });

  it('keeps the English vibe heuristic (weak, en message)', () => {
    const err = validateSeal('things will go well for us', '2026-08-01', TODAY);
    expect(err?.code).toBe('NOT_FALSIFIABLE');
    expect(err?.weak).toBe(true);
    expect(err?.message).toContain('vibe');
  });
});
