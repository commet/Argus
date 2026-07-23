import { describe, it, expect } from 'vitest';
import { isRealUser } from '../supabase';

/**
 * Anonymous auth exists only as durable server identity for a logged-out
 * voyager's log. It must NEVER read as a signed-in account, or the soft wall /
 * header / migration / expiry gates that key on `useAuth().user` would treat a
 * crawler-free anonymous visitor as a real customer.
 */
describe('isRealUser — anonymous is not a signed-in account', () => {
  it('is false for null/undefined', () => {
    expect(isRealUser(null)).toBe(false);
    expect(isRealUser(undefined)).toBe(false);
  });

  it('is false for an anonymous user', () => {
    expect(isRealUser({ is_anonymous: true })).toBe(false);
  });

  it('is true for a real (non-anonymous) user', () => {
    expect(isRealUser({ is_anonymous: false })).toBe(true);
    // Supabase omits the flag on classic accounts — absent means real.
    expect(isRealUser({})).toBe(true);
  });
});
