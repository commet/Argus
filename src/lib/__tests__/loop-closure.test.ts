/**
 * The one number that separates this product from a good analysis tool.
 *
 * The report has counted seals, and returns opened, and returns answered. None
 * of them is the rate: those belong to different cohorts days or weeks apart,
 * so dividing one by the other says nothing. Whether a sealed decision actually
 * came back and got answered has never appeared anywhere.
 *
 * These tests pin the three ways the number could lie.
 */
import { describe, expect, it } from 'vitest';
import { loopClosure, loopClosureLine, type ClosureRow } from '../loop-closure';

const NOW = Date.parse('2026-08-03T00:00:00Z');
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();
const inDays = (n: number) => new Date(NOW + n * DAY).toISOString();

const row = (checkIn: string | null, settled: string | null = null): ClosureRow => ({
  check_in_at: checkIn,
  settled_at: settled,
});

describe('the closure rate', () => {
  it('is the share of come-due decisions their person came back to', () => {
    const closure = loopClosure([
      row(daysAgo(30), daysAgo(28)),
      row(daysAgo(20), daysAgo(19)),
      row(daysAgo(10)),
      row(daysAgo(9)),
    ], NOW);

    expect(closure.due).toBe(4);
    expect(closure.settled).toBe(2);
    expect(closure.stillOpen).toBe(2);
    expect(closure.rate).toBe(0.5);
    expect(loopClosureLine(closure)).toContain('4건 중 2건 정산 (50%)');
  });

  it('gives a decision that just came due a fair chance', () => {
    // Without a grace window every seal from the last few days counts as an
    // unanswered return, and a real signal reads as noise.
    const closure = loopClosure([row(daysAgo(1)), row(daysAgo(2))], NOW);
    expect(closure.due).toBe(0);
    expect(closure.pending).toBe(2);
    expect(closure.rate).toBeNull();
  });

  it('says "no sample" rather than 0%', () => {
    const closure = loopClosure([row(inDays(7)), row(inDays(30))], NOW);
    expect(closure.rate).toBeNull();
    expect(loopClosureLine(closure)).toContain('아직 확인일이 지난 결정이 없음');
    expect(loopClosureLine(closure)).not.toContain('0%');
  });

  it('does not count a decision that is not due yet as a failure', () => {
    const closure = loopClosure([
      row(daysAgo(30), daysAgo(29)),
      row(inDays(14)),
    ], NOW);
    expect(closure.due).toBe(1);
    expect(closure.pending).toBe(1);
    expect(closure.rate).toBe(1);
  });
});

describe('a seal that can never come back', () => {
  it('is counted apart, never inside the rate', () => {
    // A contract with no check_in_at has no return. That is a product defect,
    // and putting it in the denominator would blame the person for a door that
    // was never built.
    const closure = loopClosure([
      row(daysAgo(30), daysAgo(29)),
      row(null),
      row(undefined as unknown as string),
      row('   '),
    ], NOW);

    expect(closure.due).toBe(1);
    expect(closure.rate).toBe(1);
    expect(closure.undateable).toBe(3);
    expect(loopClosureLine(closure)).toContain('확인일 없는 봉인 3건');
  });

  it('is reported even when nothing has come due', () => {
    const closure = loopClosure([row(null), row(inDays(5))], NOW);
    expect(closure.rate).toBeNull();
    expect(loopClosureLine(closure)).toContain('확인일 없는 봉인 1건');
  });

  it('stays silent when there are none', () => {
    const closure = loopClosure([row(daysAgo(30), daysAgo(29))], NOW);
    expect(loopClosureLine(closure)).not.toContain('확인일 없는');
  });
});

describe('malformed rows', () => {
  it('treats an unparseable check-in date as no date, not as due', () => {
    // Counting garbage as a come-due decision would invent unanswered returns.
    const closure = loopClosure([row('not a date'), row(daysAgo(30), daysAgo(29))], NOW);
    expect(closure.due).toBe(1);
    expect(closure.undateable).toBe(1);
  });

  it('treats an unparseable settle date as unsettled rather than settled', () => {
    // The failure direction matters: reading garbage as a settle would inflate
    // the one number this product would most like to see go up.
    const closure = loopClosure([row(daysAgo(30), 'yes')], NOW);
    expect(closure.due).toBe(1);
    expect(closure.settled).toBe(0);
  });

  it('survives an empty list', () => {
    expect(loopClosure([], NOW)).toEqual({
      due: 0, settled: 0, rate: null, stillOpen: 0, pending: 0, undateable: 0,
    });
  });
});
