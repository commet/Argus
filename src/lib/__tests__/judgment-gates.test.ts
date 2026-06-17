import { describe, it, expect } from 'vitest';
import { assessFrameStatus, applyDecisionDensityGate } from '../judgment-gates';

describe('assessFrameStatus (over-fire / mirror clause)', () => {
  it('flat when the reframe is identical to the surface question', () => {
    expect(
      assessFrameStatus({ realQuestion: 'tabs or spaces?', surfaceQuestion: 'tabs or spaces?', assumptions: [] }),
    ).toBe('flat');
  });

  it('flat when near-identical with no distinct assumptions (cosmetic reframe)', () => {
    expect(
      assessFrameStatus({
        realQuestion: 'paint blue or green wall',
        surfaceQuestion: 'blue or green wall',
        assumptions: [],
      }),
    ).toBe('flat');
  });

  it('load_bearing when the reframe materially changes the question', () => {
    expect(
      assessFrameStatus({
        realQuestion: 'how much long-term velocity will we trade for short-term setup speed',
        surfaceQuestion: 'typescript or javascript',
        assumptions: ['the team is junior'],
      }),
    ).toBe('load_bearing');
  });

  it('defaults to load_bearing when ambiguous (a missed fork is worse than one flat answer)', () => {
    expect(assessFrameStatus({ realQuestion: '', surfaceQuestion: 'x', assumptions: [] })).toBe('load_bearing');
  });
});

describe('applyDecisionDensityGate (low only when all four hold)', () => {
  const base = { reversibility: 'reversible' as const, framingConfidence: 90, actionCollapsesToOneSentence: true, checkIsQuick: true };

  it('low when all four conditions hold', () => {
    expect(applyDecisionDensityGate(base)).toBe('low');
  });

  it('medium when reversibility is not reversible', () => {
    expect(applyDecisionDensityGate({ ...base, reversibility: 'irreversible' })).toBe('medium');
    expect(applyDecisionDensityGate({ ...base, reversibility: 'partial' })).toBe('medium');
  });

  it('medium when confidence < 80', () => {
    expect(applyDecisionDensityGate({ ...base, framingConfidence: 70 })).toBe('medium');
  });

  it('medium when action does not collapse / check is not quick', () => {
    expect(applyDecisionDensityGate({ ...base, actionCollapsesToOneSentence: false })).toBe('medium');
    expect(applyDecisionDensityGate({ ...base, checkIsQuick: false })).toBe('medium');
  });
});
