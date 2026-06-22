import { describe, it, expect } from 'vitest';
import { calibrationDisclosure, gatedAccuracy, SETTLED_THRESHOLD } from '../calibration-disclosure';

describe('calibration disclosure — no unearned track record (dim9)', () => {
  it('settled=0 → no stats, "unproven" banner', () => {
    const d = calibrationDisclosure({ runs: 12, sealed: 4, settled: 0 });
    expect(d.showStats).toBe(false);
    expect(d.banner).toMatch(/unproven|not a track record/i);
  });

  it('settled below threshold → no stats', () => {
    for (let s = 1; s < SETTLED_THRESHOLD; s++) {
      expect(calibrationDisclosure({ runs: 9, sealed: 9, settled: s }).showStats).toBe(false);
    }
  });

  it('settled at/above threshold → stats allowed, no banner', () => {
    const d = calibrationDisclosure({ runs: 20, sealed: 10, settled: SETTLED_THRESHOLD });
    expect(d.showStats).toBe(true);
    expect(d.banner).toBeNull();
  });

  it('counts are always exposed (raw counts are safe)', () => {
    const c = { runs: 5, sealed: 2, settled: 0 };
    expect(calibrationDisclosure(c).counts).toEqual(c);
  });

  it('gatedAccuracy returns null below threshold, the figure at/above', () => {
    expect(gatedAccuracy({ runs: 9, sealed: 9, settled: 1 }, () => 0.83)).toBeNull();
    expect(gatedAccuracy({ runs: 9, sealed: 9, settled: SETTLED_THRESHOLD }, () => 0.83)).toBe(0.83);
  });

  it('never lets a negative/garbage settled count slip a stat through', () => {
    expect(calibrationDisclosure({ runs: 9, sealed: 9, settled: -5 }).showStats).toBe(false);
  });
});
