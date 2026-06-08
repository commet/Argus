/**
 * Voyage state machine — unit tests for the DERIVED ship-state.
 *
 * The whole point of voyage-state is that state is computed from signals and
 * can never drift from reality. These tests pin the locked decisions in
 * voyage-state.ts: Coda-wins precedence, the "no unfair shipwrecks" cap, the
 * exact drift/wreck day boundaries, and bad-data safety.
 */

import { describe, it, expect } from 'vitest';
import {
  getVoyageState,
  daysUntilWreck,
  wreckPin,
  DRIFT_DAYS,
  WRECK_DAYS,
  type VoyageSignals,
} from '../voyage-state';

const NOW = Date.UTC(2026, 5, 9); // 2026-06-09, fixed clock
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

/** A plain, mid-voyage signal: started, incomplete, fresh activity, no Coda. */
function signals(overrides: Partial<VoyageSignals> = {}): VoyageSignals {
  return {
    started: true,
    completedAllLegs: false,
    lastActivityAt: daysAgo(1),
    hasCoda: false,
    lastLeg: 'recast',
    outcomeVerdict: undefined,
    ...overrides,
  };
}

describe('getVoyageState', () => {
  describe('docked — never left harbor', () => {
    it('returns docked when not started', () => {
      expect(getVoyageState(signals({ started: false }), NOW)).toBe('docked');
    });

    it('stays docked even when the (irrelevant) timestamp is ancient', () => {
      expect(
        getVoyageState(signals({ started: false, lastActivityAt: daysAgo(999) }), NOW),
      ).toBe('docked');
    });
  });

  describe('sailing — underway', () => {
    it('returns sailing when started, incomplete, and recently active', () => {
      expect(getVoyageState(signals({ lastActivityAt: daysAgo(3) }), NOW)).toBe('sailing');
    });

    it('caps at sailing when all legs are done but no Coda (approaching port)', () => {
      expect(getVoyageState(signals({ completedAllLegs: true }), NOW)).toBe('sailing');
    });

    it('NEVER wrecks a finished-but-no-Coda voyage, however long it idles', () => {
      // The "no unfair shipwrecks" rule: completedAllLegs beats idleness.
      expect(
        getVoyageState(
          signals({ completedAllLegs: true, lastActivityAt: daysAgo(365) }),
          NOW,
        ),
      ).toBe('sailing');
    });
  });

  describe('adrift / wrecked — incomplete + idle, both required', () => {
    it('is still sailing one day before the drift threshold', () => {
      expect(getVoyageState(signals({ lastActivityAt: daysAgo(DRIFT_DAYS - 1) }), NOW)).toBe(
        'sailing',
      );
    });

    it('becomes adrift exactly at the drift threshold', () => {
      expect(getVoyageState(signals({ lastActivityAt: daysAgo(DRIFT_DAYS) }), NOW)).toBe(
        'adrift',
      );
    });

    it('stays adrift in the window between drift and wreck', () => {
      expect(getVoyageState(signals({ lastActivityAt: daysAgo(WRECK_DAYS - 1) }), NOW)).toBe(
        'adrift',
      );
    });

    it('becomes wrecked exactly at the wreck threshold', () => {
      expect(getVoyageState(signals({ lastActivityAt: daysAgo(WRECK_DAYS) }), NOW)).toBe(
        'wrecked',
      );
    });

    it('stays wrecked well past the threshold', () => {
      expect(getVoyageState(signals({ lastActivityAt: daysAgo(120) }), NOW)).toBe('wrecked');
    });
  });

  describe('arrived / verified — a written Coda is terminal and overrides everything', () => {
    it('returns arrived when the Coda is written and no outcome yet', () => {
      expect(getVoyageState(signals({ hasCoda: true }), NOW)).toBe('arrived');
    });

    it('treats a pending verdict as still just arrived', () => {
      expect(
        getVoyageState(signals({ hasCoda: true, outcomeVerdict: 'pending' }), NOW),
      ).toBe('arrived');
    });

    it.each(['right', 'wrong', 'mixed'] as const)(
      'returns verified when the outcome is reckoned (%s)',
      (verdict) => {
        expect(
          getVoyageState(signals({ hasCoda: true, outcomeVerdict: verdict }), NOW),
        ).toBe('verified');
      },
    );

    it('a Coda refloats an otherwise-wrecked voyage to arrived (Coda wins over idleness)', () => {
      expect(
        getVoyageState(signals({ hasCoda: true, lastActivityAt: daysAgo(999) }), NOW),
      ).toBe('arrived');
    });
  });

  describe('bad-data safety', () => {
    it('treats an unparseable timestamp as fresh — never wrecks on bad data', () => {
      expect(getVoyageState(signals({ lastActivityAt: 'not-a-date' }), NOW)).toBe('sailing');
    });

    it('treats an empty timestamp as fresh', () => {
      expect(getVoyageState(signals({ lastActivityAt: '' }), NOW)).toBe('sailing');
    });
  });
});

describe('daysUntilWreck', () => {
  it('is null once the Coda is written', () => {
    expect(daysUntilWreck(signals({ hasCoda: true }), NOW)).toBeNull();
  });

  it('is null when not started', () => {
    expect(daysUntilWreck(signals({ started: false }), NOW)).toBeNull();
  });

  it('is null when all legs are done (cannot wreck)', () => {
    expect(daysUntilWreck(signals({ completedAllLegs: true }), NOW)).toBeNull();
  });

  it('counts down from the full wreck window when freshly active', () => {
    expect(daysUntilWreck(signals({ lastActivityAt: daysAgo(0) }), NOW)).toBe(WRECK_DAYS);
  });

  it('returns the remaining days mid-drift', () => {
    expect(daysUntilWreck(signals({ lastActivityAt: daysAgo(20) }), NOW)).toBe(WRECK_DAYS - 20);
  });

  it('clamps to 0 at and past the wreck threshold (never negative)', () => {
    expect(daysUntilWreck(signals({ lastActivityAt: daysAgo(WRECK_DAYS) }), NOW)).toBe(0);
    expect(daysUntilWreck(signals({ lastActivityAt: daysAgo(45) }), NOW)).toBe(0);
  });
});

describe('wreckPin', () => {
  it('returns null when there is no last leg', () => {
    expect(wreckPin(null, 'ko')).toBeNull();
    expect(wreckPin(undefined, 'en')).toBeNull();
  });

  it('pins the leg where the voyage ran aground (ko)', () => {
    expect(wreckPin('reframe', 'ko')).toBe('재정의 단계에서 멈춤');
  });

  it('pins the leg where the voyage ran aground (en)', () => {
    expect(wreckPin('rehearse', 'en')).toBe('Ran aground at Rehearse');
  });
});
