/**
 * Workspace landing lantern — gating logic (P0-6 ②, polish audit 2026-07-03).
 *
 * The lantern is the one line on /workspace that says "그래서, 어떻게 됐어요?
 * — 돌아올 결정 N건". Pure and tested because its restraint contract is spine
 * (master §4):
 *
 *   - due 0건이면 렌더 0 — no absence notices, no over-fire.
 *   - "나중에 할게요" = SAME-DAY snooze only. It re-renders the next day.
 *     Never a permanent dismiss: a lantern that goes out forever quietly
 *     kills the return loop the seal promised.
 *   - No absence-length greetings ("오랜만이에요") — counting absence is an
 *     attendance sheet wearing warmth.
 */

/** Local calendar date (YYYY-MM-DD) — the snooze follows the USER's day, the
 *  same local-midnight rule contractStatus uses for "due". */
export function localYMD(now: number = Date.now()): string {
  const d = new Date(now);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Whether the lantern renders. `snoozedYMD` is the stored "나중에 할게요" date
 * (null when never snoozed / storage empty).
 */
export function shouldShowLantern(
  dueCount: number,
  snoozedYMD: string | null,
  todayYMD: string,
): boolean {
  if (dueCount <= 0) return false; // nothing waiting → total silence
  if (snoozedYMD === todayYMD) return false; // snoozed today → back tomorrow
  return true;
}
