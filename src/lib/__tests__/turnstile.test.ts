import { describe, it, expect, afterEach } from 'vitest';
import { verifyTurnstile, isTurnstileEnabled } from '../turnstile';

describe('verifyTurnstile — inert by default', () => {
  const saved = process.env.TURNSTILE_SECRET_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = saved;
  });

  it('ALLOWS everything when the secret is unset (deploying must not break anon)', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(isTurnstileEnabled()).toBe(false);
    expect(await verifyTurnstile(null)).toBe(true);
    expect(await verifyTurnstile(undefined)).toBe(true);
    expect(await verifyTurnstile('anything')).toBe(true);
  });

  it('REJECTS a missing token once the secret is set (enforcement path)', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    expect(isTurnstileEnabled()).toBe(true);
    expect(await verifyTurnstile(null)).toBe(false);
    expect(await verifyTurnstile('')).toBe(false);
  });
});
