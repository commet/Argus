import { describe, expect, it } from 'vitest';
import { hasFlatFrame, shouldDefaultFastPath } from '../routing-default';

describe('routing defaults', () => {
  it('defaults low-density or flat requests to the fast path', () => {
    expect(shouldDefaultFastPath([{ decision_density: 'low' }])).toBe(true);
    expect(shouldDefaultFastPath([{ frame_status: 'flat', decision_density: 'high' }])).toBe(true);
    expect(hasFlatFrame([{ frame_status: 'load_bearing' }, { frame_status: 'flat' }])).toBe(true);
  });

  it('defaults confident routine reversible decisions to the fast path', () => {
    expect(shouldDefaultFastPath([{
      stakes: 'routine',
      reversibility: 'reversible',
      framing_confidence: 75,
      decision_density: 'medium',
    }])).toBe(true);
  });

  it('uses the last known routing signal when a later snapshot omits carried fields', () => {
    expect(shouldDefaultFastPath([
      {
        stakes: 'routine',
        reversibility: 'reversible',
        framing_confidence: 82,
        decision_density: 'low',
      },
      {
        frame_status: 'load_bearing',
      },
    ])).toBe(true);
  });

  it('keeps material or uncertain decisions on team review by default', () => {
    expect(shouldDefaultFastPath([])).toBe(false);
    expect(shouldDefaultFastPath([{
      stakes: 'important',
      reversibility: 'partial',
      framing_confidence: 80,
      decision_density: 'medium',
      frame_status: 'load_bearing',
    }])).toBe(false);
    expect(shouldDefaultFastPath([{
      stakes: 'routine',
      reversibility: 'reversible',
      framing_confidence: 60,
      decision_density: 'medium',
    }])).toBe(false);
  });

  it('critical / irreversible NEVER fast-paths, even on low density (verify must run)', () => {
    expect(shouldDefaultFastPath([{ decision_density: 'low', stakes: 'critical' }])).toBe(false);
    expect(shouldDefaultFastPath([{ decision_density: 'low', reversibility: 'irreversible' }])).toBe(false);
  });
});
