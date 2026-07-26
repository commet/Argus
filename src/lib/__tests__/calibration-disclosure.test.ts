import { describe, it, expect } from 'vitest';
import { calibrationDisclosure, gatedAccuracy, SETTLED_THRESHOLD } from '../calibration-disclosure';

describe('calibration disclosure — performance statistics stay closed', () => {
  it('settled=0 → no stats and a neutral explanation', () => {
    const d = calibrationDisclosure({ runs: 12, sealed: 4, settled: 0 });
    expect(d.showStats).toBe(false);
    expect(d.banner).toMatch(/does not produce a performance statistic/i);
  });

  it('settled below threshold → no stats', () => {
    for (let s = 1; s < SETTLED_THRESHOLD; s++) {
      expect(calibrationDisclosure({ runs: 9, sealed: 9, settled: s }).showStats).toBe(false);
    }
  });

  it('settled at/above the legacy ceremony threshold still does not open stats', () => {
    const d = calibrationDisclosure({ runs: 20, sealed: 10, settled: SETTLED_THRESHOLD });
    expect(d.showStats).toBe(false);
    expect(d.banner).toBeTruthy();
  });

  it('counts are always exposed (raw counts are safe)', () => {
    const c = { runs: 5, sealed: 2, settled: 0 };
    expect(calibrationDisclosure(c).counts).toEqual(c);
  });

  it('gatedAccuracy never returns a figure', () => {
    expect(gatedAccuracy({ runs: 9, sealed: 9, settled: 1 }, () => 0.83)).toBeNull();
    expect(gatedAccuracy({ runs: 9, sealed: 9, settled: SETTLED_THRESHOLD }, () => 0.83)).toBeNull();
  });

  it('never lets a negative/garbage settled count slip a stat through', () => {
    expect(calibrationDisclosure({ runs: 9, sealed: 9, settled: -5 }).showStats).toBe(false);
  });
});
