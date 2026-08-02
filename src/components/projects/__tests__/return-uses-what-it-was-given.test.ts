/**
 * The return asked a generic question while holding the specific one.
 *
 * Two fields on a sealed Predicate exist for the settle and for nothing else:
 *
 *   observable  "carried to the return so the check-in can ask about the thing
 *                itself instead of 실제로 어떻게 됐나요?"
 *   decisive    "Only 'flips' premises are worth bringing back — the rest are
 *                background, and returning them is noise dressed as diligence."
 *
 * Both are asked of the model, gated by the contract, copied onto the predicate
 * by extractPredicatesFromSession, and stored. Measured 2026-08-03: neither had
 * a single reader. The return asked "실제로 일어났나요" — the exact question the
 * first field was added to replace — and listed premises in extraction order,
 * so a premise the user had called background could sit above the one they said
 * would have flipped their decision.
 *
 * This is the one-ended-wire class landing on the moat. field-liveness-contract
 * could not see it: it matches by NAME, and `observable` is read on
 * PremiseRecord elsewhere, so the name looked alive while this type's copy was
 * dead. Hence a narrow per-type check, here.
 */
import { describe, expect, it } from 'vitest';
import { decisiveFirst, predicateObservable } from '../DecisionContractCard';
import type { Predicate } from '@/stores/types';

const pred = (over: Partial<Predicate> = {}): Predicate => ({
  id: over.id || 'p1',
  text: '다음 분기 매출이 지금 수준을 유지한다',
  source: 'governing_idea',
  verdict: 'pending',
  ...over,
} as Predicate);

describe('the return asks about the thing itself', () => {
  it('names what the user said they would see', () => {
    const p = pred({ observable: '다음 라운드 발표' });
    expect(predicateObservable(p, true)).toBe('무엇을 보면 아나 — 다음 라운드 발표');
    expect(predicateObservable(p, false)).toBe('Where to look — 다음 라운드 발표');
  });

  it('stays silent when nothing observable was named', () => {
    // Honest gap, not a filled one. The model is told to omit `observable` when
    // nothing would settle the claim by observation, so inventing a place to
    // look here would be the fabrication the whole contract forbids.
    expect(predicateObservable(pred(), true)).toBe('');
    expect(predicateObservable(pred({ observable: '   ' }), true)).toBe('');
  });
});

describe('the return leads with what the user called decisive', () => {
  it('puts a flips premise above an unanswered one, and background last', () => {
    const ordered = decisiveFirst([
      pred({ id: 'holds', decisive: 'holds' }),
      pred({ id: 'unanswered' }),
      pred({ id: 'flips', decisive: 'flips' }),
    ]);

    expect(ordered.map((p) => p.id)).toEqual(['flips', 'unanswered', 'holds']);
  });

  it('drops nothing — deciding which of their premises stops mattering is not ours', () => {
    const input = [
      pred({ id: 'a', decisive: 'holds' }),
      pred({ id: 'b', decisive: 'flips' }),
      pred({ id: 'c' }),
    ];
    expect(decisiveFirst(input)).toHaveLength(3);
    expect(input.map((p) => p.id)).toEqual(['a', 'b', 'c']); // and does not mutate
  });

  it('is stable inside a group, so extraction order still decides ties', () => {
    const ordered = decisiveFirst([
      pred({ id: 'f1', decisive: 'flips' }),
      pred({ id: 'f2', decisive: 'flips' }),
      pred({ id: 'f3', decisive: 'flips' }),
    ]);
    expect(ordered.map((p) => p.id)).toEqual(['f1', 'f2', 'f3']);
  });

  it('leaves a contract where nobody answered the question untouched', () => {
    const ordered = decisiveFirst([pred({ id: 'a' }), pred({ id: 'b' }), pred({ id: 'c' })]);
    expect(ordered.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});
