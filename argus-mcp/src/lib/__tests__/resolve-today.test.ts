import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDefaultTimeZone, resolveToday } from '../resolve-today.js';

const ORIGINAL_TZ = process.env.ARGUS_TZ;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (ORIGINAL_TZ === undefined) delete process.env.ARGUS_TZ;
  else process.env.ARGUS_TZ = ORIGINAL_TZ;
});

describe('resolveToday', () => {
  it('uses the system local timezone by default', () => {
    delete process.env.ARGUS_TZ;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T15:30:00.000Z'));

    const RealDateTimeFormat = Intl.DateTimeFormat;
    function FakeDateTimeFormat(_locale?: string | string[], options?: Intl.DateTimeFormatOptions) {
      if (options?.timeZone) {
        return { format: () => (options.timeZone === 'Asia/Seoul' ? '2026-01-02' : '2026-01-01') };
      }
      return { resolvedOptions: () => ({ ...new RealDateTimeFormat().resolvedOptions(), timeZone: 'Asia/Seoul' }) };
    }

    vi.stubGlobal('Intl', {
      ...Intl,
      DateTimeFormat: FakeDateTimeFormat as unknown as typeof Intl.DateTimeFormat,
    });

    expect(resolveDefaultTimeZone()).toBe('Asia/Seoul');
    expect(resolveToday()).toBe('2026-01-02');
  });

  it('lets ARGUS_TZ override the system local timezone', () => {
    process.env.ARGUS_TZ = 'UTC';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T15:30:00.000Z'));

    expect(resolveToday()).toBe('2026-01-01');
  });
});
