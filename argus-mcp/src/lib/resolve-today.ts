/**
 * Deterministic "today" (blueprint §3.5 / addendum M4 + N).
 *
 * The old `localToday()` read `new Date()` local fields, so DUE computation
 * depended on the server's local timezone and ignored every override. This
 * replaces it with one source: an explicit override wins, else ARGUS_TZ wins,
 * else the machine's local timezone formats the wall clock once per request.
 *
 * `Date.now()` is the only ambient time read; everything downstream takes the
 * resulting YYYY-MM-DD string so it is fully testable.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveToday(opts?: { override?: string | null; tz?: string | null }): string {
  const override = opts?.override;
  if (typeof override === 'string' && DATE_RE.test(override)) return override;

  const tz = opts?.tz || process.env['ARGUS_TZ'] || resolveDefaultTimeZone();
  return formatInTz(new Date(), tz);
}

export function resolveDefaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatInTz(d: Date, tz: string): string {
  try {
    // en-CA yields YYYY-MM-DD; timeZone applies the fixed zone deterministically.
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.format(d); // "2026-07-01"
    if (DATE_RE.test(parts)) return parts;
  } catch {
    // invalid tz — fall through to UTC
  }
  return d.toISOString().slice(0, 10);
}

export function asDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function isFutureDate(check: string, today: string): boolean {
  const c = asDate(check);
  return !!c && c > today;
}
