import { describe, it, expect } from 'vitest';
import { shouldShowLantern, localYMD } from '@/lib/lantern';

describe('workspace lantern gating (P0-6 ② — restraint is the spec)', () => {
  it('due 0 → render 0, regardless of snooze state (no absence notices)', () => {
    expect(shouldShowLantern(0, null, '2026-07-03')).toBe(false);
    expect(shouldShowLantern(0, '2026-07-03', '2026-07-03')).toBe(false);
    expect(shouldShowLantern(0, '2026-07-01', '2026-07-03')).toBe(false);
    expect(shouldShowLantern(-1, null, '2026-07-03')).toBe(false);
  });

  it('due > 0 and never snoozed → renders', () => {
    expect(shouldShowLantern(1, null, '2026-07-03')).toBe(true);
    expect(shouldShowLantern(3, null, '2026-07-03')).toBe(true);
  });

  it('"나중에 할게요" is a SAME-DAY snooze: hidden today, back tomorrow (never permanent)', () => {
    expect(shouldShowLantern(2, '2026-07-03', '2026-07-03')).toBe(false); // snoozed today
    expect(shouldShowLantern(2, '2026-07-03', '2026-07-04')).toBe(true); // next day → back
    expect(shouldShowLantern(2, '2026-06-01', '2026-07-03')).toBe(true); // old snooze never sticks
  });

  it('localYMD formats a local calendar date', () => {
    // 2026-07-03 12:00 local
    const t = new Date(2026, 6, 3, 12, 0, 0).getTime();
    expect(localYMD(t)).toBe('2026-07-03');
    // zero-pads month/day
    const t2 = new Date(2026, 0, 5, 1, 0, 0).getTime();
    expect(localYMD(t2)).toBe('2026-01-05');
  });
});
