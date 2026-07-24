import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * Settle picker self-sufficiency (2026-07-24, 창업자 도그푸딩에서 관찰된 막다른 길).
 *
 * The outcome picker used to collect ONLY the category, so a settle that reached
 * the picker (model passed no what_happened) still dead-ended on
 * WHAT_HAPPENED_REQUIRED *after* the user had already answered the picker — a
 * jarring failure at the product's payoff moment. The picker now also carries an
 * optional what_happened field: what the user types there is THEIR words
 * (spine-safe), and it completes the settle in one round. If the model already
 * supplied what_happened, the user can leave it blank.
 */

const SEAL_DAY = '2026-06-01';
const DUE_DAY = '2026-07-02';
const seed = { predicate: 'the hard paywall lifts trial-to-paid conversion above 6%', check_by: '2026-07-01', predicate_owner: 'user' as const };

afterEach(() => setElicitor(null));

async function sealed(dir: string, id = 'p1') {
  await seal.handler({ argus_dir: dir, id, ...seed, today_override: SEAL_DAY });
}

describe('settle picker is self-sufficient', () => {
  it('picker supplies outcome AND what_happened → settle completes in one round', async () => {
    const dir = tmpArgusDir();
    await sealed(dir);
    setElicitor(async () => ({ action: 'accept', content: { outcome: 'held', what_happened: 'conversion landed at 7.1% after the paywall' } }));
    const r = body(await settle.handler({ argus_dir: dir, id: 'p1', today_override: DUE_DAY }));
    expect(isError({ ...r, isError: false } as never)).toBe(false);
    expect(r['data']).toBeTruthy();
    expect((r['data'] as Record<string, unknown>)['outcome']).toBe('held');
  });

  it('picker outcome but blank what_happened AND none from model → still the honest WHAT_HAPPENED_REQUIRED', async () => {
    const dir = tmpArgusDir();
    await sealed(dir, 'p2');
    setElicitor(async () => ({ action: 'accept', content: { outcome: 'held' } })); // no what_happened anywhere
    const r = await settle.handler({ argus_dir: dir, id: 'p2', today_override: DUE_DAY });
    expect(isError(r)).toBe(true);
    expect(body(r)['error_code']).toBe('WHAT_HAPPENED_REQUIRED');
  });

  it('model-supplied what_happened wins; picker text does not override it', async () => {
    const dir = tmpArgusDir();
    await sealed(dir, 'p3');
    setElicitor(async () => ({ action: 'accept', content: { outcome: 'held', what_happened: 'FROM PICKER' } }));
    const r = body(await settle.handler({ argus_dir: dir, id: 'p3', what_happened: 'FROM MODEL (user words in convo)', today_override: DUE_DAY }));
    // The receipt records the model-passed words (already the user's, from the
    // conversation); the picker text only fills the gap when the model had none.
    const receiptText = JSON.stringify(r['data']);
    expect(receiptText).toContain('FROM MODEL');
    expect(receiptText).not.toContain('FROM PICKER');
  });
});
