import { describe, it, expect } from 'vitest';
import { recordDisclosure, type CrossProjectRecord } from '../decision-contract';
import { SETTLED_THRESHOLD } from '../calibration-disclosure';

/** Dim9 wiring: the cross-project record drives the honest disclosure — no
 *  track-record/accuracy framing before SETTLED_THRESHOLD settled loops. */
const rec = (loops: number): CrossProjectRecord => ({
  loops, betsHeld: 0, risksAvoided: 0, betsBroke: 0, risksHappened: 0, goodOutcomesOnLuck: 0,
});

describe('recordDisclosure (dim9 wired to the real record)', () => {
  it('0 settled loops → no stats + "unproven" banner', () => {
    const d = recordDisclosure(rec(0));
    expect(d.showStats).toBe(false);
    expect(d.banner).toMatch(/unproven|not a track record/i);
  });

  it('below threshold → still no stats', () => {
    for (let n = 1; n < SETTLED_THRESHOLD; n++) {
      expect(recordDisclosure(rec(n)).showStats).toBe(false);
    }
  });

  it('at threshold → stats allowed', () => {
    expect(recordDisclosure(rec(SETTLED_THRESHOLD)).showStats).toBe(true);
  });
});
