import { describe, it, expect } from 'vitest';
import { isTokenExpired, pluginTokenExpiry, PLUGIN_TOKEN_TTL_DAYS } from '../plugin-token';

describe('plugin-token expiry', () => {
  const NOW = Date.parse('2026-07-06T00:00:00.000Z');

  it('treats a null/undefined expiry as valid (legacy tokens)', () => {
    expect(isTokenExpired(null, NOW)).toBe(false);
    expect(isTokenExpired(undefined, NOW)).toBe(false);
  });

  it('is not expired when expires_at is in the future', () => {
    const future = new Date(NOW + 24 * 60 * 60 * 1000).toISOString();
    expect(isTokenExpired(future, NOW)).toBe(false);
  });

  it('is expired when expires_at is in the past', () => {
    const past = new Date(NOW - 1000).toISOString();
    expect(isTokenExpired(past, NOW)).toBe(true);
  });

  it('fails open on an unparseable timestamp (never locks a user out on bad data)', () => {
    expect(isTokenExpired('not-a-date', NOW)).toBe(false);
  });

  it('pluginTokenExpiry stamps exactly TTL days ahead', () => {
    const iso = pluginTokenExpiry(NOW);
    const expectedMs = NOW + PLUGIN_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(Date.parse(iso)).toBe(expectedMs);
  });

  it('a freshly-issued token is not immediately expired', () => {
    expect(isTokenExpired(pluginTokenExpiry(NOW), NOW)).toBe(false);
  });
});
