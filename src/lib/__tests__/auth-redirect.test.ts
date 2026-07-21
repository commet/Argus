import { describe, expect, it } from 'vitest';
import { safePostAuthRedirect } from '@/lib/auth-redirect';

describe('safePostAuthRedirect', () => {
  it('preserves an internal path, query, and hash', () => {
    expect(safePostAuthRedirect('/ko/teams?invite=abc%20123#members')).toBe('/ko/teams?invite=abc%20123#members');
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/\\evil.example/phish',
    '\\evil.example/phish',
    'javascript:alert(1)',
    '/ko/login?redirect=/ko/teams',
    '/en/auth/callback?code=secret',
    '/workspace\nSet-Cookie:x',
  ])('rejects unsafe or looping destination %s', (destination) => {
    expect(safePostAuthRedirect(destination)).toBe('/workspace');
  });

  it('supports a caller-provided fallback', () => {
    expect(safePostAuthRedirect(null, '/ko')).toBe('/ko');
  });
});
