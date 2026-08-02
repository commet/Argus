import { describe, expect, it } from 'vitest';
import { migrateDuplicateOriginWaypoints } from '@/stores/useProgressiveStore';
import type { ProgressiveSession } from '@/stores/types';

describe('duplicate origin waypoint migration', () => {
  it('keeps the first departure and every real later turn', () => {
    const session = {
      id: 'session-1',
      waypoints: [
        { id: 'departure-1', checkpoint_id: 'origin-1', type: 'departure', headline: 'full ask', created_at: '1' },
        { id: 'departure-2', checkpoint_id: 'origin-2', type: 'departure', headline: 'full ask', created_at: '2' },
        { id: 'turn-1', checkpoint_id: 'briefing-1', type: 'course_change', headline: 'real question', created_at: '3' },
      ],
    } as ProgressiveSession;

    const [migrated] = migrateDuplicateOriginWaypoints([session]);
    expect(migrated.waypoints?.map(waypoint => waypoint.id)).toEqual(['departure-1', 'turn-1']);
  });

  it('preserves object identity when there is nothing to repair', () => {
    const session = {
      id: 'session-1',
      waypoints: [{ id: 'departure-1', checkpoint_id: 'origin-1', type: 'departure', headline: 'ask', created_at: '1' }],
    } as ProgressiveSession;

    expect(migrateDuplicateOriginWaypoints([session])[0]).toBe(session);
  });
});
