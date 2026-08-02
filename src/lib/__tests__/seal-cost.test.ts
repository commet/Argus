/**
 * The seal count was never the interesting number.
 *
 * The report has always said how many people sealed. It has never said what
 * sealing cost them, and only the second number tells you whether the entrance
 * to the loop sits too far from the door — a flow reached in two answers
 * converts differently from one reached in nine phases, and the count cannot
 * tell those apart.
 *
 * The rule these tests exist to hold: an unreported cost is reported as
 * unreported. Absorbing it as zero would make the flow look free, which is
 * precisely the claim under examination.
 */
import { describe, expect, it } from 'vitest';
import { sealCostLine, sealCostSummary, type CostEvent } from '../seal-cost';

const human = (...ids: string[]) => new Set(ids);
const seal = (session_id: string, properties: Record<string, unknown> | null): CostEvent =>
  ({ session_id, event_name: 'decision_sealed', properties });

describe('what the seal cost', () => {
  it('reports nothing to measure when nobody sealed', () => {
    const cost = sealCostSummary([], human());
    expect(cost).toEqual({ seals: 0, medianAnswers: null, medianMinutes: null, withoutCost: 0 });
    expect(sealCostLine(cost)).toContain('표본이 없음');
  });

  it('takes the median, not the mean', () => {
    // One twenty-minute session should not be able to drag the reported cost.
    const cost = sealCostSummary([
      seal('a', { answers: 2, minutes: 4 }),
      seal('b', { answers: 3, minutes: 6 }),
      seal('c', { answers: 3, minutes: 90 }),
    ], human('a', 'b', 'c'));

    expect(cost.seals).toBe(3);
    expect(cost.medianAnswers).toBe(3);
    expect(cost.medianMinutes).toBe(6);
  });

  it('counts one seal per session, not per press', () => {
    // A re-seal from the sealed drawer is an adjustment to the same decision.
    // Counting it again would report the cost of the cheapest possible action.
    const cost = sealCostSummary([
      seal('a', { answers: 5, minutes: 12 }),
      seal('a', { answers: 5, minutes: 13 }),
    ], human('a'));

    expect(cost.seals).toBe(1);
    expect(cost.medianAnswers).toBe(5);
  });

  it('never lets an unreported cost read as a free flow', () => {
    const cost = sealCostSummary([
      seal('a', { answers: 4, minutes: 9 }),
      seal('b', null),
      seal('c', { interval: '2w' }),
    ], human('a', 'b', 'c'));

    expect(cost.seals).toBe(3);
    expect(cost.withoutCost).toBe(2);
    expect(cost.medianAnswers).toBe(4);
    expect(sealCostLine(cost)).toContain('비용 미보고 2건');
  });

  it('says so plainly when every seal came from a client that cannot report', () => {
    const cost = sealCostSummary([seal('a', null), seal('b', null)], human('a', 'b'));
    expect(cost.medianAnswers).toBeNull();
    expect(sealCostLine(cost)).toContain('비용 미보고');
    expect(sealCostLine(cost)).not.toMatch(/중앙값/);
  });

  it('ignores sessions that were not classified as human', () => {
    const cost = sealCostSummary([
      seal('bot', { answers: 1, minutes: 0 }),
      seal('a', { answers: 6, minutes: 15 }),
    ], human('a'));

    expect(cost.seals).toBe(1);
    expect(cost.medianAnswers).toBe(6);
  });

  it('rejects a nonsense cost rather than averaging it in', () => {
    const cost = sealCostSummary([
      seal('a', { answers: -3, minutes: Number.NaN }),
      seal('b', { answers: 2, minutes: 5 }),
    ], human('a', 'b'));

    expect(cost.withoutCost).toBe(1);
    expect(cost.medianAnswers).toBe(2);
  });

  it('reports a zero-answer seal as zero, not as missing', () => {
    // Sealing without answering anything is a real and interesting outcome —
    // it is what an early-seal path would look like. It must not be confused
    // with a client that failed to report.
    const cost = sealCostSummary([seal('a', { answers: 0, minutes: 1 })], human('a'));
    expect(cost.withoutCost).toBe(0);
    expect(cost.medianAnswers).toBe(0);
    expect(sealCostLine(cost)).toContain('답변 0개');
  });
});
