import { describe, it, expect } from 'vitest';
import {
  numericDrift,
  evaluateMateriality,
  NUMERIC_DRIFT_THRESHOLD,
  type MaterialityRule,
} from '../numeric-drift';

/**
 * numeric-drift is the 3-valued MATERIALITY engine (M2 spec) and carries a spine
 * invariant: the default is UNDER-fire — when a rule isn't declared and the
 * heuristic is unsure, the answer is `uncertain` (SILENT), never a manufactured
 * `material` alert. These tests pin that default, the declared-rule branches, and
 * the legacy boolean shim so a regression can't silently start over-firing.
 */

describe('numericDrift (legacy 2-valued shim)', () => {
  it('does not drift on a sub-threshold relative move', () => {
    expect(numericDrift(100, 103).drifted).toBe(false); // 3% < 10%
  });
  it('drifts on a clearly material relative move', () => {
    expect(numericDrift(100, 130).drifted).toBe(true); // 30% >= 10%
  });
  it('exposes the threshold constant it uses', () => {
    expect(NUMERIC_DRIFT_THRESHOLD).toBe(0.1);
  });
});

describe('evaluateMateriality — default heuristic (under-fire)', () => {
  it('unchanged when the values are equal', () => {
    expect(evaluateMateriality(100, 100).status).toBe('unchanged');
  });

  it('unchanged when the move is below measurement resolution', () => {
    // integers → resolution 1, needs ≥2 to count; a move of 1 is noise.
    expect(evaluateMateriality(100, 101).status).toBe('unchanged');
  });

  it('material on a clear scale-free relative move above threshold', () => {
    expect(evaluateMateriality(100, 130).status).toBe('material');
  });

  it('uncertain (not material) exactly at the relative knife-edge', () => {
    const r = evaluateMateriality(100, 110); // rel == 0.10, within EPS of threshold
    expect(r.status).toBe('uncertain');
    expect(r.low_confidence).toBe(true);
  });

  it('uncertain on a ratio-looking value — it asks for the axis instead of deciding', () => {
    const r = evaluateMateriality(0.2, 0.6); // both in [0,1] → ratio axis
    expect(r.status).toBe('uncertain');
    expect(r.low_confidence).toBe(true);
  });

  it('uncertain on a sign flip when zero_meaningful is NOT declared', () => {
    expect(evaluateMateriality(5, -5).status).toBe('uncertain');
  });

  it('unchanged for non-finite input (not comparable, never fabricated)', () => {
    expect(evaluateMateriality(Number.NaN, 5).status).toBe('unchanged');
  });
});

describe('evaluateMateriality — declared rules beat the heuristic', () => {
  it('threshold: crossing the line in the declared direction is material', () => {
    const rule: MaterialityRule = { type: 'threshold', params: { line: 100, direction: 'above' }, modifiers: { boundary: 'inclusive' } };
    expect(evaluateMateriality(95, 105, rule).status).toBe('material');
    expect(evaluateMateriality(95, 99, rule).status).toBe('unchanged');
  });

  it('threshold: at the line with boundary undeclared → uncertain (>= vs > hostage)', () => {
    const rule: MaterialityRule = { type: 'threshold', params: { line: 100, direction: 'above' } };
    expect(evaluateMateriality(100, 105, rule).status).toBe('uncertain');
  });

  it('delta: an absolute move at/above D is material, below is unchanged', () => {
    const rule: MaterialityRule = { type: 'delta', params: { D: 5 } };
    expect(evaluateMateriality(10, 16, rule).status).toBe('material');
    expect(evaluateMateriality(10, 13, rule).status).toBe('unchanged');
  });

  it('band: leaving the band is material, staying inside is unchanged', () => {
    const rule: MaterialityRule = { type: 'band', params: { lo: 10, hi: 20 } };
    expect(evaluateMateriality(15, 25, rule).status).toBe('material');
    expect(evaluateMateriality(15, 18, rule).status).toBe('unchanged');
  });

  it('harmful_only: a harmful move fires, a beneficial move of equal size does not', () => {
    const rule: MaterialityRule = { type: 'delta', params: { D: 5 }, modifiers: { direction: 'harmful_only', harmful_dir: 'up' } };
    expect(evaluateMateriality(10, 16, rule).status).toBe('material');   // up = harmful
    expect(evaluateMateriality(16, 10, rule).status).toBe('unchanged');  // down = beneficial
  });

  it('sign_flip: material only when zero_meaningful is declared', () => {
    const declared: MaterialityRule = { type: 'delta', params: {}, modifiers: { direction: 'sign_flip', zero_meaningful: true } };
    expect(evaluateMateriality(5, -5, declared).status).toBe('material');
    const undeclared: MaterialityRule = { type: 'delta', params: {}, modifiers: { direction: 'sign_flip' } };
    expect(evaluateMateriality(5, -5, undeclared).status).toBe('uncertain');
  });

  it('ratio axis + relative/delta rule → uncertain (axis must be picked first)', () => {
    const rule: MaterialityRule = { type: 'relative', params: { P: 0.1 }, modifiers: { unit_axis: 'ratio' } };
    expect(evaluateMateriality(0.5, 0.7, rule).status).toBe('uncertain');
  });

  it('stateful: cannot be judged from two snapshots → uncertain, never fabricated', () => {
    const rule: MaterialityRule = { type: 'stateful', params: {} };
    expect(evaluateMateriality(1, 2, rule).status).toBe('uncertain');
  });
});

describe('evaluateMateriality — label map rule', () => {
  const rule: MaterialityRule = { type: 'map', params: { material_states: ['red'] } };

  it('entering a registered material state is material', () => {
    expect(evaluateMateriality({ label: 'green' }, { label: 'red' }, rule).status).toBe('material');
  });

  it('a transition to an unregistered state is uncertain (host judgment)', () => {
    expect(evaluateMateriality({ label: 'green' }, { label: 'yellow' }, rule).status).toBe('uncertain');
  });

  it('the same label (after normalization) is unchanged', () => {
    expect(evaluateMateriality({ label: 'Red' }, { label: 'red' }, rule).status).toBe('unchanged');
  });
});
