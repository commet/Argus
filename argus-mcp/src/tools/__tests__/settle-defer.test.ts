import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { amend } from '../amend-dismiss.js';
import { checkIn } from '../check-in.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * still_pending → DEFER (the false-close fix). At the check-by, reality may
 * genuinely have not answered yet. Filing that as a terminal `settled` was a
 * silent leak: the surface lied ("what actually happened"), and the decision
 * dropped off check_in forever. Instead still_pending RE-ARMS the contract with
 * a new check-by so it comes back — and the deferral is recorded as a neutral
 * fact on the eventual receipt.
 */

const SEAL_DAY = '2026-06-01';
const CHECK_BY = '2026-07-01';
const DUE_DAY = '2026-07-02';   // past the original check-by → due
const NEW_DATE = '2026-08-01';
const SETTLE_DAY = '2026-08-02'; // past the deferred check-by → due again

const seed = {
  predicate: 'the hard paywall lifts trial-to-paid conversion above 6%',
  check_by: CHECK_BY, predicate_owner: 'user' as const,
};

async function sealDue(dir: string, id = 'paywall'): Promise<void> {
  await seal.handler({ argus_dir: dir, id, ...seed, today_override: SEAL_DAY });
}

const D = (r: Record<string, unknown>) => r['data'] as Record<string, unknown>;

afterEach(() => setElicitor(null));

describe('argus_settle still_pending → defer (re-arm, not settle)', () => {
  it('a due bet answered "still_pending" with defer_to re-arms instead of settling', async () => {
    const dir = tmpArgusDir();
    await sealDue(dir);
    const r = body(await settle.handler({
      argus_dir: dir, id: 'paywall', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'only 9 days of noisy data — too early to call', defer_to: NEW_DATE, today_override: DUE_DAY,
    }));
    expect(D(r)['status']).toBe('sealed');          // alive, NOT settled
    expect(D(r)['deferred_to']).toBe(NEW_DATE);
    expect(D(r)['from_check_by']).toBe(CHECK_BY);
    expect(String(r['surface'])).toContain(NEW_DATE);
    // and it must not claim a settlement happened
    expect(String(r['surface'])).not.toContain('what actually happened');
  });

  it('after deferring, the bet drops off check_in until the new date, then returns', async () => {
    const dir = tmpArgusDir();
    await sealDue(dir);
    // due on DUE_DAY
    const before = body(await checkIn.handler({ argus_dir: dir, today_override: DUE_DAY }));
    expect(D(before)['due_count']).toBe(1);
    // defer
    await settle.handler({
      argus_dir: dir, id: 'paywall', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'too early', defer_to: NEW_DATE, today_override: DUE_DAY,
    });
    // no longer due the same day (moved to the future)
    const afterDefer = body(await checkIn.handler({ argus_dir: dir, today_override: DUE_DAY }));
    expect(D(afterDefer)['due_count']).toBe(0);
    // due again once the new check-by arrives
    const atNewDate = body(await checkIn.handler({ argus_dir: dir, today_override: SETTLE_DAY }));
    expect(D(atNewDate)['due_count']).toBe(1);
  });

  it('a real settle after a defer records the deferral as a neutral fact on the receipt', async () => {
    const dir = tmpArgusDir();
    await sealDue(dir);
    await settle.handler({
      argus_dir: dir, id: 'paywall', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'too early', defer_to: NEW_DATE, today_override: DUE_DAY,
    });
    const r = body(await settle.handler({
      argus_dir: dir, id: 'paywall', outcome: 'held', outcome_source: 'user_stated',
      what_happened: 'conversion settled at 7.1%', today_override: SETTLE_DAY,
    }));
    expect(D(r)['outcome']).toBe('held');
    const receiptText = String(D(r)['receipt_text']);
    expect(receiptText).toContain('deferred 1×');
    expect(receiptText).toContain(CHECK_BY); // "originally due 2026-07-01"
  });

  it('after a defer, the PREDICATE cannot be rewritten but the DATE still can (goalpost past original check-by)', async () => {
    const dir = tmpArgusDir();
    await sealDue(dir); // sealed 'paywall' at CHECK_BY
    // on DUE_DAY it is due; the user says still_pending and defers to NEW_DATE
    await settle.handler({ argus_dir: dir, id: 'paywall', outcome: 'still_pending', outcome_source: 'user_stated', what_happened: 'not yet', defer_to: NEW_DATE, today_override: DUE_DAY });
    // now re-armed (sealed) at NEW_DATE. A predicate rewrite is a goalpost move —
    // the original check-by already arrived — so it is refused...
    const bad = body(await amend.handler({ argus_dir: dir, id: 'paywall', predicate: 'a far easier claim to hit for sure', today_override: DUE_DAY }));
    expect(bad['error_code']).toBe('GOALPOST_MOVED');
    // ...but re-scheduling the date stays legitimate.
    const okDate = body(await amend.handler({ argus_dir: dir, id: 'paywall', check_by: '2026-09-01', today_override: DUE_DAY }));
    expect(okDate['ok']).toBe(true);
  });

  it('still_pending BEFORE the check-by is refused (defer lives at due; recovery says exactly that)', async () => {
    const dir = tmpArgusDir();
    await sealDue(dir);
    const r = body(await settle.handler({
      argus_dir: dir, id: 'paywall', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'not due', defer_to: NEW_DATE, today_override: '2026-06-15', // before CHECK_BY
    }));
    expect(r['error_code']).toBe('PREMATURE_SETTLE');
    // 1.4.0: the refusal must TEACH the path, not dead-end (real-usage finding).
    expect(String(r['recovery'])).toContain('defer_to');
  });

  it('still_pending with no defer_to and no picker asks for a date (never terminal-settles)', async () => {
    const dir = tmpArgusDir();
    await sealDue(dir);
    setElicitor(null); // host has no elicitation
    const r = body(await settle.handler({
      argus_dir: dir, id: 'paywall', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'too early', today_override: DUE_DAY,
    }));
    expect(r['error_code']).toBe('DEFER_DATE_REQUIRED');
    // the bet is still sealed/alive — NOT closed
    const c = body(await checkIn.handler({ argus_dir: dir, today_override: DUE_DAY }));
    expect(D(c)['due_count']).toBe(1);
  });

  it('still_pending needs no what_happened (reality is silent) — one call re-arms', async () => {
    const dir = tmpArgusDir();
    await sealDue(dir);
    const r = body(await settle.handler({
      argus_dir: dir, id: 'paywall', outcome: 'still_pending', outcome_source: 'user_stated',
      defer_to: NEW_DATE, today_override: DUE_DAY, // no what_happened
    }));
    expect(D(r)['status']).toBe('sealed');
    expect(D(r)['deferred_to']).toBe(NEW_DATE);
  });

  it('a REAL settlement still requires what_happened', async () => {
    const dir = tmpArgusDir();
    await sealDue(dir);
    const r = body(await settle.handler({
      argus_dir: dir, id: 'paywall', outcome: 'held', outcome_source: 'user_stated',
      today_override: DUE_DAY, // no what_happened
    }));
    expect(r['error_code']).toBe('WHAT_HAPPENED_REQUIRED');
  });

  it('the still_pending picker: a coarse bucket re-arms; "dismiss" sets a moot bet aside', async () => {
    const dir = tmpArgusDir();
    await sealDue(dir);
    // bucket → about a month out
    setElicitor(async () => ({ action: 'accept', content: { when: 'month' } }));
    const bucket = body(await settle.handler({
      argus_dir: dir, id: 'paywall', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'too early', today_override: DUE_DAY,
    }));
    expect(D(bucket)['status']).toBe('sealed');
    expect(String(D(bucket)['deferred_to']) > DUE_DAY).toBe(true);

    // a second, moot bet dismissed via the picker escape
    const dir2 = tmpArgusDir();
    await sealDue(dir2, 'gone');
    setElicitor(async () => ({ action: 'accept', content: { when: 'dismiss' } }));
    const dismissed = body(await settle.handler({
      argus_dir: dir2, id: 'gone', outcome: 'still_pending', outcome_source: 'user_stated',
      what_happened: 'the feature was cut — question is moot', today_override: DUE_DAY,
    }));
    expect(D(dismissed)['status']).toBe('dismissed');
  });
});
