/**
 * The founder's read of their own daily email: it did not feel like it carried
 * the current state of the product.
 *
 * Looking at it, that was exactly right and specific. Fifteen blocks, thirteen
 * of them yesterday-vs-the-day-before — and at three to eight real sessions a
 * day, that delta is a coin flip wearing a percentage ("완주 10 → 2, ↓80%").
 * Meanwhile the numbers that decide whether the product works — does anyone
 * reach the seal, does the loop ever close, does the front door open — were
 * 11px grey footnotes underneath other blocks, in caption type.
 *
 * So every morning the reader had to assemble the story themselves out of
 * fifteen equally-weighted boxes. This produces the story instead: the first
 * thing that is both TRUE and LOAD-BEARING, over seven days.
 *
 * The ordering is the entire design, and it is what these tests pin. There is
 * no point telling someone their seal rate when their front door is shut, and
 * none in reporting loop closure to someone nobody has sealed for.
 */
import { describe, expect, it } from 'vitest';
import { conversion, weeklyVerdict, type WeeklyVerdictInput } from '../report-verdict';

const HEALTHY: WeeklyVerdictInput = {
  sessions: 40, signups: 3, completed: 12, sealed: 5,
  due: 4, settled: 2, undateable: 0, missingCrons: 0,
};

describe('the first true and load-bearing thing', () => {
  it('reports a dead collector before any demand number', () => {
    // The numbers below a missing cron are not trustworthy, so nothing else may
    // outrank it — including good news.
    const v = weeklyVerdict({ ...HEALTHY, missingCrons: 1 });
    expect(v.stage).toBe('broken');
    expect(v.headline).toContain('크론 1개');
  });

  it('reports a seal that can never come back before demand', () => {
    // A product defect the founder can fix today outranks a demand question
    // they cannot. 57 of these existed when this was written.
    const v = weeklyVerdict({ ...HEALTHY, undateable: 57 });
    expect(v.stage).toBe('broken');
    expect(v.headline).toContain('57건');
    expect(v.headline).toContain('돌아오지 않습니다');
  });

  it('says there is nothing to measure rather than reporting zeros', () => {
    const v = weeklyVerdict({
      sessions: 0, signups: 0, completed: 0, sealed: 0,
      due: 0, settled: 0, undateable: 0, missingCrons: 0,
    });
    expect(v.stage).toBe('nobody');
    expect(v.headline).toContain('잴 것이 없습니다');
  });

  it('names the front of the funnel when nobody finishes', () => {
    const v = weeklyVerdict({ ...HEALTHY, completed: 0, sealed: 0, due: 0, settled: 0 });
    expect(v.stage).toBe('shallow');
    expect(v.headline).toContain('앞쪽입니다');
  });

  it('names the seal when people finish and nobody seals', () => {
    const v = weeklyVerdict({ ...HEALTHY, sealed: 0, due: 0, settled: 0 });
    expect(v.stage).toBe('unsealed');
    expect(v.headline).toContain('해자는 전부 봉인 뒤');
  });

  it('names the loop when seals never settle', () => {
    const v = weeklyVerdict({ ...HEALTHY, settled: 0 });
    expect(v.stage).toBe('unsettled');
    expect(v.headline).toContain('한 번도 닫히지 않았습니다');
  });

  it('does not call an unsettled loop a failure before its date arrives', () => {
    // due=0 means no decision has reached its check-in yet. Reporting that as a
    // closure failure would blame people for not answering a question nobody
    // has asked them.
    const v = weeklyVerdict({ ...HEALTHY, due: 0, settled: 0 });
    expect(v.stage).toBe('closing');
    expect(v.headline).toContain('판정은 그날부터');
  });

  it('says so plainly when the loop is turning', () => {
    const v = weeklyVerdict(HEALTHY);
    expect(v.stage).toBe('closing');
    expect(v.headline).toContain('고리가 돕니다');
  });

  it('never congratulates and never scores the reader', () => {
    // Same rule the product follows: report the outcome, never grade the person.
    const forbidden = /잘하|훌륭|축하|대단|좋은 성과|나쁘|실패했군|분발/;
    for (const input of [
      HEALTHY,
      { ...HEALTHY, missingCrons: 2 },
      { ...HEALTHY, sealed: 0, due: 0, settled: 0 },
      { ...HEALTHY, sessions: 0, completed: 0, sealed: 0, due: 0, settled: 0 },
    ]) {
      expect(weeklyVerdict(input).headline).not.toMatch(forbidden);
    }
  });
});

describe('a rate is never printed without a denominator', () => {
  it('shows a dash rather than 0% when nothing entered', () => {
    // "0%" reads as a measured failure. An em dash reads as what it is.
    expect(conversion(0, 0)).toBe('—');
  });

  it('reports the pair alongside the percentage', () => {
    // The percentage alone hides the sample size, and at n=3 the sample size is
    // the more honest half of the number.
    expect(conversion(232, 128)).toBe('128/232 (55%)');
    expect(conversion(3, 1)).toBe('1/3 (33%)');
  });

  it('handles a full conversion without rounding surprises', () => {
    expect(conversion(7, 7)).toBe('7/7 (100%)');
  });
});
