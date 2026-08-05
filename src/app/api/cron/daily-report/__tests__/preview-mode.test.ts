/**
 * A report nobody can look at without sending it is a report nobody iterates on.
 *
 * That is how fifteen blocks accumulated with the load-bearing numbers rendered
 * as 11px grey footnotes: the only way to see the email was to receive it, so
 * the layout was only ever reasoned about in source. `?preview=1` returns the
 * same HTML, built by the same path, and delivers nothing.
 *
 * Two properties matter more than the feature, and both are checked here:
 * preview must return BEFORE the send call can be reached, and it must still
 * require the same authorisation — a preview is the entire founder report,
 * including every user's activity.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(process.cwd(), 'src/app/api/cron/daily-report/route.ts'),
  'utf8',
);

describe('preview renders and never delivers', () => {
  it('returns the html before the send call is reachable', () => {
    const previewReturn = src.indexOf('if (preview) {');
    const send = src.indexOf('resend.emails.send');
    expect(previewReturn, 'preview branch not found').toBeGreaterThan(-1);
    expect(send, 'send call not found').toBeGreaterThan(-1);
    expect(
      previewReturn,
      'the preview branch must come before the send, or a preview mails the report',
    ).toBeLessThan(send);
  });

  it('is behind the same authorisation as the cron', () => {
    // The preview contains the whole report. Reading the flag after the auth
    // check is what keeps it from becoming an open endpoint.
    const auth = src.indexOf("safeCompare(authHeader, expected)");
    const flag = src.indexOf("searchParams.get('preview')");
    expect(auth).toBeGreaterThan(-1);
    expect(flag).toBeGreaterThan(auth);
  });

  it('does not require a mail key it will not use', () => {
    // Requiring RESEND_API_KEY for a render that sends nothing would make the
    // preview impossible in exactly the environment where you want it.
    expect(src).toContain('...(preview ? [] : [[\'RESEND_API_KEY\'');
  });
});

describe('the week block leads, and says when its numbers are dirty', () => {
  it('renders the seven-day verdict above the daily blocks', () => {
    const week = src.indexOf('THE WEEK, AND WHAT IT SAYS');
    const daily = src.indexOf('DAILY CHANGE');
    expect(week).toBeGreaterThan(-1);
    expect(week).toBeLessThan(daily);
  });

  it('warns while the window still reaches before synthetic marking', () => {
    // A prettier layout over polluted numbers is a more convincing wrong
    // answer. The banner is conditional on the window, so it retires itself
    // once the seven days are entirely after the marking date — no cleanup, and
    // no chance of a stale warning outliving the problem.
    expect(src).toContain("const SYNTHETIC_MARKING_SINCE = '2026-08-05'");
    expect(src).toContain('thisWeek[0] < SYNTHETIC_MARKING_SINCE');
  });

  it('does not print the same line twice in one email', () => {
    // Both of these moved up into the week block. Leaving the originals in
    // place would add noise to the exact complaint that prompted the change.
    expect(src.split('sealCostLine(sealCost').length - 1).toBe(1);
    expect(src.split('loopClosureLine(closure)').length - 1).toBe(1);
  });
});
