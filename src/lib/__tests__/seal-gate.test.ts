import { describe, it, expect } from 'vitest';
import { shouldSealContract } from '../decision-contract';
import type { Predicate } from '@/stores/types';

const pred = (text: string): Predicate => ({ id: `p_${text}`, text, source: 'governing_idea' });
const PREDS = [pred('the milestone ships in 6 months')];

describe('shouldSealContract (§0 sealing gate — decision 2)', () => {
  it('does not seal an empty predicate set (nothing falsifiable)', () => {
    const r = shouldSealContract({ stakes: 'critical', reversibility: 'irreversible', framingConfidence: 90, predicates: [] });
    expect(r.seal).toBe(false);
    expect(r.mode).toBe('none');
  });

  it('routine + reversible + confident → single check, no contract (never silently dropped)', () => {
    const r = shouldSealContract({ stakes: 'routine', reversibility: 'reversible', framingConfidence: 80, predicates: PREDS });
    expect(r.seal).toBe(false);
    expect(r.mode).toBe('single_check');
  });

  it('seals when stakes are critical', () => {
    const r = shouldSealContract({ stakes: 'critical', reversibility: 'reversible', framingConfidence: 90, predicates: PREDS });
    expect(r.seal).toBe(true);
    expect(r.mode).toBe('contract');
  });

  it('seals when irreversible even if routine + confident', () => {
    const r = shouldSealContract({ stakes: 'routine', reversibility: 'irreversible', framingConfidence: 95, predicates: PREDS });
    expect(r.seal).toBe(true);
  });

  it('seals when confidence is low (the framing itself is uncertain)', () => {
    const r = shouldSealContract({ stakes: 'routine', reversibility: 'reversible', framingConfidence: 40, predicates: PREDS });
    expect(r.seal).toBe(true);
  });

  it('seals an important decision (not routine)', () => {
    const r = shouldSealContract({ stakes: 'important', reversibility: 'reversible', framingConfidence: 90, predicates: PREDS });
    expect(r.seal).toBe(true);
  });
});
