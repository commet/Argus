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

/**
 * A ledger timestamp whose DATE is the tz-aware logical `today` (from
 * resolveToday), with the real UTC time-of-day appended for intra-day ordering
 * — or a fixed noon when `deterministic` (an explicit today_override, for tests).
 *
 * A bare `new Date().toISOString()` is always UTC, so near midnight in Korea
 * (UTC+9) an event lands a DAY EARLIER than the local date the user sees on
 * seals and receipts — which is why "record since" showed yesterday. Every
 * event-appending site must stamp through here so one date basis holds across
 * opens, seals, and settles.
 */
export function logicalNow(today: string, deterministic = false): string {
  return deterministic ? `${today}T12:00:00.000Z` : `${today}T${new Date().toISOString().slice(11)}`;
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

/**
 * asDate matches the digit SHAPE but never the calendar: "2026-13-01" (month 13)
 * and "2026-09-31" (Sept has 30 days) both pass its regex. A calendar-invalid
 * check_by used to seal — comparisons are lexical, so a future-looking bad date
 * slid past the "must be in the future" gate — producing a malformed .ics
 * (DTSTART:20261301) and a wrong due date. isRealDate rejects impossible
 * month/day so the seal gate can fail loud instead.
 */
export function isRealDate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * A caller-computable horizon: `+7d`, `+2w`, `+3m`.
 *
 * WHY THIS EXISTS. Dates were 44% of every refusal across 21 recorded journey
 * runs — more than double the next cause. The reason is structural, not
 * sloppiness: an absolute check-by can only be computed from "now", the caller
 * has no clock, and it does not know that it does not know. So it confidently
 * sends the year it was trained in (2025-06-13 against a 2026 today), burns a
 * call on the refusal, and in two recorded runs rewrote the whole predicate
 * while fixing the date and lost the seal entirely.
 *
 * The user never said an absolute date either. They said "in a couple of
 * weeks". Making the caller do clockless arithmetic to convert that is the
 * defect. This lets it pass through what it actually knows, and the side
 * holding the clock does the conversion.
 *
 * Absolute dates keep working unchanged — this is a second accepted form, not
 * a replacement.
 */
const HORIZON = /^\+(\d{1,3})([dwm])$/i;

export function isHorizon(value: unknown): boolean {
  return typeof value === 'string' && HORIZON.test(value.trim());
}

/** Resolve a horizon against `today` → YYYY-MM-DD. Returns null if not one. */
export function resolveHorizon(value: unknown, today: string): string | null {
  const m = typeof value === 'string' ? value.trim().match(HORIZON) : null;
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  // Parse as UTC noon so a DST shift can never roll the date backwards.
  const base = new Date(`${today}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  // `Date` NORMALIZES an impossible date instead of rejecting it: 2026-02-30
  // parses to 2026-03-02. Accepting that would resolve a horizon against a day
  // that does not exist and hand back a date nobody asked for. Round-trip the
  // parse and refuse any input the parser had to move.
  if (base.toISOString().slice(0, 10) !== today) return null;
  if (unit === 'd') base.setUTCDate(base.getUTCDate() + n);
  else if (unit === 'w') base.setUTCDate(base.getUTCDate() + n * 7);
  else {
    // CLAMP, don't roll. setUTCMonth overflows the day into the next month —
    // "+1m" from 2026-01-31 became 2026-03-03, two calendar months out, which
    // is exactly the surprise a horizon exists to prevent. A month from the
    // 31st is the last day of the shorter month.
    const day = base.getUTCDate();
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + n);
    const lastOfMonth = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    base.setUTCDate(Math.min(day, lastOfMonth));
  }
  return base.toISOString().slice(0, 10);
}

export function isFutureDate(check: string, today: string): boolean {
  const c = asDate(check);
  return !!c && c > today;
}
