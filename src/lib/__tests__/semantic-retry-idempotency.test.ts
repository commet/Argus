/**
 * Regression: a genuine retry of one web command re-preflights with a FRESH
 * clock, so time.occurred_at/recorded_at/authorized_at are re-stamped. That used
 * to read as IDEMPOTENCY_CONFLICT (409) instead of returning the duplicate
 * receipt. The dogfood `retry_exact` fuzz case missed it because it replays the
 * stored bytes verbatim rather than re-preflighting — so this drives the real
 * re-stamped path through the emulator (the in-repo mirror of the SQL RPC).
 *
 * The fix lives in the idempotency FINGERPRINT (strips the volatile time fields),
 * mirrored across the SQL RPC, the v3 reducer, and the emulator.
 */
import { describe, expect, it } from 'vitest';
import { SupabaseEmulator, semanticIdemFingerprint } from '../../../scripts/dogfood/harness/supabase-emulator';
import { WebSurface } from '../../../scripts/dogfood/harness/surfaces';
import type { SemanticWebCommand } from '@/lib/semantic-web';

const USER = 'user-idem';
const PROJECT = '4c8fe7bf-820a-4d8d-9721-8a7e3f4a4112';

function setup() {
  const emu = new SupabaseEmulator();
  emu.projects.push({ id: PROJECT, user_id: USER });
  return { emu, web: new WebSurface(emu, USER) };
}

const sealCommand = (statement = 'Keep the current price.'): SemanticWebCommand => ({
  kind: 'seal',
  command_id: 'seal-1',
  judgment_id: 'judgment-1',
  return_contract_id: 'return-1',
  statement,
  review_at: '2026-09-01T00:00:00.000Z',
  review_question: 'Did conversion stay above 3.2%?',
});

describe('web command retry idempotency', () => {
  it('a re-stamped retry (fresh recorded_at, same command) returns a duplicate receipt, not 409', async () => {
    const { web } = setup();

    const first = await web.command(PROJECT, sealCommand(), '2026-07-14T00:00:00.000Z');
    expect(first.ok).toBe(true);
    expect(first.duplicate).toEqual([false, false]); // seal + return, both fresh

    // Same command, DIFFERENT recorded_at — the exact shape of a browser retry.
    const retry = await web.command(PROJECT, sealCommand(), '2026-07-14T09:30:00.000Z');
    expect(retry.ok).toBe(true);
    expect(retry.code).toBeUndefined();
    expect(retry.duplicate).toEqual([true, true]);
  });

  it('an altered payload under the same command_id still conflicts', async () => {
    const { web } = setup();
    await web.command(PROJECT, sealCommand('Keep the current price.'), '2026-07-14T00:00:00.000Z');

    const altered = await web.command(PROJECT, sealCommand('Raise the price 10%.'), '2026-07-14T01:00:00.000Z');
    expect(altered.ok).toBe(false);
    expect(altered.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('fingerprint ignores volatile time fields but keeps the semantic payload', () => {
    const a = {
      event: 'judgment_sealed', event_id: 'x1', idempotency_key: 'k', statement: 'S',
      time: { occurred_at: 'T1', recorded_at: 'T1', authorized_at: 'T1', temporal_mode: 'contemporaneous' },
      authority: { originated_by: { kind: 'human', id: 'u' }, recorded_by: { kind: 'system', id: 'web:a' }, authorization_mode: 'explicit_confirmation' },
    };
    const b = {
      event: 'judgment_sealed', event_id: 'x2', idempotency_key: 'k', statement: 'S',
      time: { occurred_at: 'T2', recorded_at: 'T2', authorized_at: 'T2', temporal_mode: 'contemporaneous' },
      authority: { originated_by: { kind: 'human', id: 'u' }, recorded_by: { kind: 'system', id: 'web:b' }, authorization_mode: 'explicit_confirmation' },
    };
    // Same fingerprint: only event_id / time.* / authority.recorded_by differ.
    expect(semanticIdemFingerprint(a)).toEqual(semanticIdemFingerprint(b));

    // Different statement → different fingerprint.
    expect(semanticIdemFingerprint({ ...a, statement: 'DIFFERENT' })).not.toEqual(semanticIdemFingerprint(a));
    // Different temporal_mode is semantic → different fingerprint.
    expect(semanticIdemFingerprint({ ...a, time: { ...a.time, temporal_mode: 'retrospective' } }))
      .not.toEqual(semanticIdemFingerprint(a));
  });
});
