import { describe, it, expect } from 'vitest';
import { recordDisclosure, type CrossProjectRecord } from '../decision-contract';
import { SETTLED_THRESHOLD } from '../calibration-disclosure';

/** Compatibility wiring: no record count ever opens performance statistics. */
const rec = (loops: number): CrossProjectRecord => ({
  loops, betsHeld: 0, risksAvoided: 0, betsBroke: 0, risksHappened: 0, goodOutcomesOnLuck: 0,
});

describe('recordDisclosure (dim9 wired to the real record)', () => {
  it('0 settled loops → no stats + "unproven" banner', () => {
    const d = recordDisclosure(rec(0));
    expect(d.showStats).toBe(false);
    expect(d.banner).toMatch(/does not produce a performance statistic/i);
  });

  it('below threshold → still no stats', () => {
    for (let n = 1; n < SETTLED_THRESHOLD; n++) {
      expect(recordDisclosure(rec(n)).showStats).toBe(false);
    }
  });

  it('at threshold → stats remain closed', () => {
    expect(recordDisclosure(rec(SETTLED_THRESHOLD)).showStats).toBe(false);
  });
});
